/**
 * Circuit Breaker Pattern Implementation for SSH MCP Server
 * Provides resilience patterns for connection failures and automatic recovery mechanisms
 */

import { EventEmitter } from 'events';
import { AuditLogger, AuditEventType } from '../audit/audit-logger.js';
import { SSHError, ErrorCategory, ErrorSeverity } from '../errors/ssh-errors.js';

export enum CircuitState {
  CLOSED = 'closed',      // Normal operation, requests pass through
  OPEN = 'open',          // Circuit is open, requests fail fast
  HALF_OPEN = 'half_open' // Testing if service recovered
}

export enum CircuitEventType {
  STATE_CHANGE = 'state_change',
  FAILURE_RECORDED = 'failure_recorded',
  SUCCESS_RECORDED = 'success_recorded',
  CIRCUIT_OPENED = 'circuit_opened',
  CIRCUIT_CLOSED = 'circuit_closed',
  HEALTH_CHECK = 'health_check',
  RECOVERY_ATTEMPT = 'recovery_attempt'
}

export interface CircuitBreakerConfig {
  failureThreshold: number;        // Number of failures before opening circuit
  successThreshold: number;        // Number of successes in half-open to close
  timeout: number;                 // Time in ms before attempting recovery
  volumeThreshold: number;         // Minimum requests before evaluating
  errorThresholdPercentage: number; // Error rate to open circuit
  resetTimeout: number;            // Time to reset failure count
  enableHealthChecks: boolean;     // Enable periodic health checks
  healthCheckInterval: number;     // Health check interval in ms
  exponentialBackoff: boolean;     // Use exponential backoff for recovery
  maxBackoffTime: number;          // Maximum backoff time in ms
  enableMetrics: boolean;          // Enable detailed metrics tracking
}

export interface CircuitMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rejectedRequests: number;
  averageResponseTime: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  stateChanges: number;
  currentFailureCount: number;
  consecutiveSuccesses: number;
  errorRate: number;
  availability: number;
}

export interface CircuitHealthStatus {
  state: CircuitState;
  healthy: boolean;
  metrics: CircuitMetrics;
  lastStateChange: Date;
  nextRetryTime: Date | null;
  message: string;
}

export interface CircuitOperation<T> {
  execute: () => Promise<T>;
  fallback?: () => Promise<T>;
  timeout?: number;
}

/**
 * Circuit Breaker implementation for fault tolerance
 */
export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private config: CircuitBreakerConfig;
  private auditLogger: AuditLogger;
  private metrics: CircuitMetrics;
  private lastStateChangeTime: Date = new Date();
  private nextRetryTime: Date | null = null;
  private healthCheckTimer?: NodeJS.Timeout;
  private resetTimer?: NodeJS.Timeout;
  private backoffMultiplier: number = 1;
  private requestTimes: number[] = [];

  constructor(
    private name: string,
    config: Partial<CircuitBreakerConfig> = {},
    auditLogger?: AuditLogger
  ) {
    super();
    
    this.config = {
      failureThreshold: parseInt(process.env.SSH_CIRCUIT_FAILURE_THRESHOLD || '5'),
      successThreshold: parseInt(process.env.SSH_CIRCUIT_SUCCESS_THRESHOLD || '3'),
      timeout: parseInt(process.env.SSH_CIRCUIT_TIMEOUT || '60000'), // 1 minute
      volumeThreshold: parseInt(process.env.SSH_CIRCUIT_VOLUME_THRESHOLD || '10'),
      errorThresholdPercentage: parseFloat(process.env.SSH_CIRCUIT_ERROR_THRESHOLD || '0.5'),
      resetTimeout: parseInt(process.env.SSH_CIRCUIT_RESET_TIMEOUT || '300000'), // 5 minutes
      enableHealthChecks: process.env.SSH_CIRCUIT_HEALTH_CHECKS !== 'false',
      healthCheckInterval: parseInt(process.env.SSH_CIRCUIT_HEALTH_CHECK_INTERVAL || '30000'), // 30 seconds
      exponentialBackoff: process.env.SSH_CIRCUIT_EXPONENTIAL_BACKOFF !== 'false',
      maxBackoffTime: parseInt(process.env.SSH_CIRCUIT_MAX_BACKOFF || '300000'), // 5 minutes
      enableMetrics: process.env.SSH_CIRCUIT_METRICS !== 'false',
      ...config
    };

    this.auditLogger = auditLogger || new AuditLogger();
    
    // Initialize metrics
    this.metrics = this.initializeMetrics();
    
    // Start health checks if enabled
    if (this.config.enableHealthChecks) {
      this.startHealthChecks();
    }
    
    // Start reset timer
    this.startResetTimer();
  }

  /**
   * Execute an operation through the circuit breaker
   */
  async execute<T>(operation: CircuitOperation<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptRecovery()) {
        this.transitionToHalfOpen();
      } else {
        this.metrics.rejectedRequests++;
        this.emit(CircuitEventType.FAILURE_RECORDED, {
          reason: 'Circuit breaker is OPEN',
          nextRetryTime: this.nextRetryTime
        });
        
        if (operation.fallback) {
          return operation.fallback();
        }
        
        throw new CircuitBreakerOpenError(
          `Circuit breaker '${this.name}' is OPEN`,
          this.nextRetryTime
        );
      }
    }

    const startTime = Date.now();
    
    try {
      // Set timeout for operation
      const timeout = operation.timeout || this.config.timeout;
      const result = await this.executeWithTimeout(operation.execute(), timeout);
      
      // Record success
      this.recordSuccess(Date.now() - startTime);
      
      return result;
    } catch (error) {
      // Record failure
      this.recordFailure(error as Error, Date.now() - startTime);
      
      // Try fallback if available
      if (operation.fallback) {
        try {
          return await operation.fallback();
        } catch (fallbackError) {
          throw new CircuitBreakerError(
            `Circuit breaker '${this.name}' operation failed and fallback failed`,
            error as Error,
            fallbackError as Error
          );
        }
      }
      
      throw error;
    }
  }

  /**
   * Get current circuit health status
   */
  getHealthStatus(): CircuitHealthStatus {
    const errorRate = this.calculateErrorRate();
    const availability = this.calculateAvailability();
    
    return {
      state: this.state,
      healthy: this.state === CircuitState.CLOSED && errorRate < this.config.errorThresholdPercentage,
      metrics: {
        ...this.metrics,
        errorRate,
        availability
      },
      lastStateChange: this.lastStateChangeTime,
      nextRetryTime: this.nextRetryTime,
      message: this.getHealthMessage()
    };
  }

  /**
   * Manually close the circuit
   */
  async close(): Promise<void> {
    if (this.state !== CircuitState.CLOSED) {
      this.transitionToClosed();
      
      await this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
        description: `Circuit breaker '${this.name}' manually closed`,
        outcome: 'success',
        eventDetails: {
          previousState: this.state,
          newState: CircuitState.CLOSED,
          metrics: this.metrics
        }
      });
    }
  }

  /**
   * Manually open the circuit
   */
  async open(): Promise<void> {
    if (this.state !== CircuitState.OPEN) {
      this.transitionToOpen();
      
      await this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
        description: `Circuit breaker '${this.name}' manually opened`,
        outcome: 'success',
        eventDetails: {
          previousState: this.state,
          newState: CircuitState.OPEN,
          metrics: this.metrics
        }
      });
    }
  }

  /**
   * Reset circuit breaker state and metrics
   */
  async reset(): Promise<void> {
    this.state = CircuitState.CLOSED;
    this.metrics = this.initializeMetrics();
    this.lastStateChangeTime = new Date();
    this.nextRetryTime = null;
    this.backoffMultiplier = 1;
    this.requestTimes = [];
    
    this.emit(CircuitEventType.STATE_CHANGE, {
      from: this.state,
      to: CircuitState.CLOSED,
      reason: 'Manual reset'
    });
    
    await this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
      description: `Circuit breaker '${this.name}' reset`,
      outcome: 'success',
      eventDetails: {
        state: CircuitState.CLOSED,
        metrics: this.metrics
      }
    });
  }

  /**
   * Get current circuit metrics
   */
  getMetrics(): CircuitMetrics {
    return {
      ...this.metrics,
      errorRate: this.calculateErrorRate(),
      availability: this.calculateAvailability(),
      averageResponseTime: this.calculateAverageResponseTime()
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    if (this.resetTimer) {
      clearInterval(this.resetTimer);
    }
    
    await this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
      description: `Circuit breaker '${this.name}' shutdown`,
      outcome: 'success',
      eventDetails: {
        finalState: this.state,
        finalMetrics: this.metrics
      }
    });
  }

  // Private methods

  private initializeMetrics(): CircuitMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rejectedRequests: 0,
      averageResponseTime: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      stateChanges: 0,
      currentFailureCount: 0,
      consecutiveSuccesses: 0,
      errorRate: 0,
      availability: 100
    };
  }

  private recordSuccess(responseTime: number): void {
    this.metrics.totalRequests++;
    this.metrics.successfulRequests++;
    this.metrics.lastSuccessTime = new Date();
    this.metrics.consecutiveSuccesses++;
    this.metrics.currentFailureCount = 0;
    
    if (this.config.enableMetrics) {
      this.requestTimes.push(responseTime);
      if (this.requestTimes.length > 100) {
        this.requestTimes.shift();
      }
    }
    
    this.emit(CircuitEventType.SUCCESS_RECORDED, {
      responseTime,
      state: this.state,
      metrics: this.metrics
    });
    
    // Handle state transitions based on success
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.metrics.consecutiveSuccesses >= this.config.successThreshold) {
        this.transitionToClosed();
      }
    }
  }

  private recordFailure(error: Error, responseTime: number): void {
    this.metrics.totalRequests++;
    this.metrics.failedRequests++;
    this.metrics.lastFailureTime = new Date();
    this.metrics.currentFailureCount++;
    this.metrics.consecutiveSuccesses = 0;
    
    if (this.config.enableMetrics) {
      this.requestTimes.push(responseTime);
      if (this.requestTimes.length > 100) {
        this.requestTimes.shift();
      }
    }
    
    this.emit(CircuitEventType.FAILURE_RECORDED, {
      error: error.message,
      responseTime,
      state: this.state,
      metrics: this.metrics
    });
    
    // Handle state transitions based on failure
    if (this.state === CircuitState.CLOSED) {
      if (this.shouldOpenCircuit()) {
        this.transitionToOpen();
      }
    } else if (this.state === CircuitState.HALF_OPEN) {
      this.transitionToOpen();
    }
  }

  private shouldOpenCircuit(): boolean {
    // Check absolute failure threshold
    if (this.metrics.currentFailureCount >= this.config.failureThreshold) {
      return true;
    }
    
    // Check error rate threshold if enough volume
    if (this.metrics.totalRequests >= this.config.volumeThreshold) {
      const errorRate = this.calculateErrorRate();
      return errorRate >= this.config.errorThresholdPercentage;
    }
    
    return false;
  }

  private shouldAttemptRecovery(): boolean {
    if (!this.nextRetryTime) return true;
    return new Date() >= this.nextRetryTime;
  }

  private transitionToOpen(): void {
    const previousState = this.state;
    this.state = CircuitState.OPEN;
    this.lastStateChangeTime = new Date();
    this.metrics.stateChanges++;
    
    // Calculate next retry time with exponential backoff if enabled
    const baseTimeout = this.config.timeout;
    const timeout = this.config.exponentialBackoff
      ? Math.min(baseTimeout * this.backoffMultiplier, this.config.maxBackoffTime)
      : baseTimeout;
    
    this.nextRetryTime = new Date(Date.now() + timeout);
    
    if (this.config.exponentialBackoff) {
      this.backoffMultiplier = Math.min(this.backoffMultiplier * 2, 16);
    }
    
    this.emit(CircuitEventType.CIRCUIT_OPENED, {
      previousState,
      currentState: this.state,
      nextRetryTime: this.nextRetryTime,
      metrics: this.metrics
    });
    
    this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
      description: `Circuit breaker '${this.name}' opened`,
      outcome: 'failure',
      eventDetails: {
        previousState,
        failureCount: this.metrics.currentFailureCount,
        errorRate: this.calculateErrorRate(),
        nextRetryTime: this.nextRetryTime
      }
    });
  }

  private transitionToHalfOpen(): void {
    const previousState = this.state;
    this.state = CircuitState.HALF_OPEN;
    this.lastStateChangeTime = new Date();
    this.metrics.stateChanges++;
    
    this.emit(CircuitEventType.RECOVERY_ATTEMPT, {
      previousState,
      currentState: this.state,
      metrics: this.metrics
    });
    
    this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
      description: `Circuit breaker '${this.name}' attempting recovery`,
      outcome: 'unknown',
      eventDetails: {
        previousState,
        timeSinceOpen: Date.now() - this.lastStateChangeTime.getTime(),
        metrics: this.metrics
      }
    });
  }

  private transitionToClosed(): void {
    const previousState = this.state;
    this.state = CircuitState.CLOSED;
    this.lastStateChangeTime = new Date();
    this.metrics.stateChanges++;
    this.metrics.currentFailureCount = 0;
    this.nextRetryTime = null;
    this.backoffMultiplier = 1;
    
    this.emit(CircuitEventType.CIRCUIT_CLOSED, {
      previousState,
      currentState: this.state,
      metrics: this.metrics
    });
    
    this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
      description: `Circuit breaker '${this.name}' closed`,
      outcome: 'success',
      eventDetails: {
        previousState,
        recoveryTime: Date.now() - this.lastStateChangeTime.getTime(),
        metrics: this.metrics
      }
    });
  }

  private calculateErrorRate(): number {
    if (this.metrics.totalRequests === 0) return 0;
    return this.metrics.failedRequests / this.metrics.totalRequests;
  }

  private calculateAvailability(): number {
    if (this.metrics.totalRequests === 0) return 100;
    const successRate = this.metrics.successfulRequests / this.metrics.totalRequests;
    return successRate * 100;
  }

  private calculateAverageResponseTime(): number {
    if (this.requestTimes.length === 0) return 0;
    const sum = this.requestTimes.reduce((a, b) => a + b, 0);
    return sum / this.requestTimes.length;
  }

  private async executeWithTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          reject(new CircuitBreakerTimeoutError(
            `Operation timed out after ${timeout}ms`,
            timeout
          ));
        }, timeout);
      })
    ]);
  }

  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(async () => {
      const health = this.getHealthStatus();
      
      this.emit(CircuitEventType.HEALTH_CHECK, {
        health,
        timestamp: new Date()
      });
      
      // Auto-recovery check for open circuits
      if (this.state === CircuitState.OPEN && this.shouldAttemptRecovery()) {
        this.transitionToHalfOpen();
      }
    }, this.config.healthCheckInterval);
  }

  private startResetTimer(): void {
    this.resetTimer = setInterval(() => {
      // Reset failure count if no recent failures
      if (
        this.metrics.lastFailureTime &&
        Date.now() - this.metrics.lastFailureTime.getTime() > this.config.resetTimeout
      ) {
        this.metrics.currentFailureCount = 0;
      }
    }, this.config.resetTimeout);
  }

  private getHealthMessage(): string {
    switch (this.state) {
      case CircuitState.CLOSED:
        return `Circuit is functioning normally with ${this.calculateAvailability().toFixed(1)}% availability`;
      case CircuitState.OPEN:
        return `Circuit is open due to failures. Will retry at ${this.nextRetryTime?.toLocaleTimeString()}`;
      case CircuitState.HALF_OPEN:
        return `Circuit is testing recovery. ${this.metrics.consecutiveSuccesses}/${this.config.successThreshold} successful requests`;
      default:
        return 'Unknown circuit state';
    }
  }
}

/**
 * Circuit Breaker specific errors
 */
export class CircuitBreakerError extends SSHError {
  constructor(
    message: string,
    public readonly originalError?: Error,
    public readonly fallbackError?: Error
  ) {
    super(
      message,
      ErrorCategory.SYSTEM,
      ErrorSeverity.HIGH,
      'CIRCUIT_BREAKER_ERROR',
      {},
      {
        strategy: RecoveryStrategy.RETRY,
        retryable: true,
        userMessage: 'Service temporarily unavailable. Please try again later.',
        technicalDetails: message
      }
    );
  }
}

export class CircuitBreakerOpenError extends CircuitBreakerError {
  constructor(
    message: string,
    public readonly nextRetryTime: Date | null
  ) {
    super(message);
    this.recovery.retryable = true;
    this.recovery.retryDelay = nextRetryTime 
      ? nextRetryTime.getTime() - Date.now()
      : 60000;
  }
}

export class CircuitBreakerTimeoutError extends CircuitBreakerError {
  constructor(
    message: string,
    public readonly timeout: number
  ) {
    super(message);
    this.recovery.userMessage = `Operation timed out after ${timeout}ms. Please try again.`;
  }
}

// Import missing types
import { RecoveryStrategy } from '../errors/ssh-errors.js';