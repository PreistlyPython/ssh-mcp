/**
 * Circuit Breaker Manager for SSH MCP Server
 * Manages multiple circuit breakers for different services and operations
 */

import { EventEmitter } from 'events';
import { 
  CircuitBreaker, 
  CircuitBreakerConfig, 
  CircuitState,
  CircuitHealthStatus,
  CircuitMetrics,
  CircuitOperation
} from './circuit-breaker.js';
import { AuditLogger, AuditEventType } from '../audit/audit-logger.js';

export enum CircuitBreakerService {
  SSH_CONNECTION = 'ssh_connection',
  COMMAND_EXECUTION = 'command_execution',
  FILE_TRANSFER = 'file_transfer',
  AUTHENTICATION = 'authentication',
  CONTEXT7_API = 'context7_api',
  GITHUB_API = 'github_api',
  MEMORY_PERSISTENCE = 'memory_persistence',
  AUDIT_LOGGING = 'audit_logging'
}

export interface CircuitBreakerManagerConfig {
  enableGlobalMetrics: boolean;
  enableAutoRecovery: boolean;
  enableCascadingFailure: boolean;
  defaultCircuitConfig: Partial<CircuitBreakerConfig>;
  serviceConfigs: Map<CircuitBreakerService, Partial<CircuitBreakerConfig>>;
}

export interface GlobalCircuitMetrics {
  totalCircuits: number;
  healthyCircuits: number;
  degradedCircuits: number;
  failedCircuits: number;
  overallAvailability: number;
  services: Map<string, CircuitHealthStatus>;
}

export interface ServiceDependency {
  service: CircuitBreakerService;
  required: boolean;
  fallbackService?: CircuitBreakerService;
}

/**
 * Manages multiple circuit breakers across different services
 */
export class CircuitBreakerManager extends EventEmitter {
  private circuits = new Map<CircuitBreakerService, CircuitBreaker>();
  private config: CircuitBreakerManagerConfig;
  private auditLogger: AuditLogger;
  private dependencies = new Map<CircuitBreakerService, ServiceDependency[]>();
  
  constructor(
    config: Partial<CircuitBreakerManagerConfig> = {},
    auditLogger?: AuditLogger
  ) {
    super();
    
    this.config = {
      enableGlobalMetrics: true,
      enableAutoRecovery: true,
      enableCascadingFailure: false,
      defaultCircuitConfig: {
        failureThreshold: 5,
        successThreshold: 3,
        timeout: 60000,
        enableHealthChecks: true,
        exponentialBackoff: true
      },
      serviceConfigs: new Map(),
      ...config
    };

    this.auditLogger = auditLogger || new AuditLogger();
    
    // Initialize default service configurations
    this.initializeServiceConfigs();
    
    // Initialize service dependencies
    this.initializeDependencies();
    
    // Create circuit breakers for all services
    this.initializeCircuitBreakers();
  }

  /**
   * Execute an operation through a specific circuit breaker
   */
  async executeWithCircuitBreaker<T>(
    service: CircuitBreakerService,
    operation: CircuitOperation<T>
  ): Promise<T> {
    const circuit = this.circuits.get(service);
    if (!circuit) {
      throw new Error(`Circuit breaker not found for service: ${service}`);
    }

    try {
      return await circuit.execute(operation);
    } catch (error) {
      // Check for cascading failures if enabled
      if (this.config.enableCascadingFailure) {
        await this.handleCascadingFailure(service, error as Error);
      }
      throw error;
    }
  }

  /**
   * Get circuit breaker for a specific service
   */
  getCircuitBreaker(service: CircuitBreakerService): CircuitBreaker | undefined {
    return this.circuits.get(service);
  }

  /**
   * Get health status for all circuits
   */
  getGlobalHealthStatus(): GlobalCircuitMetrics {
    const services = new Map<string, CircuitHealthStatus>();
    let healthyCount = 0;
    let degradedCount = 0;
    let failedCount = 0;
    let totalAvailability = 0;

    for (const [service, circuit] of this.circuits) {
      const health = circuit.getHealthStatus();
      services.set(service, health);
      
      if (health.state === CircuitState.CLOSED && health.healthy) {
        healthyCount++;
      } else if (health.state === CircuitState.HALF_OPEN) {
        degradedCount++;
      } else {
        failedCount++;
      }
      
      totalAvailability += health.metrics.availability;
    }

    return {
      totalCircuits: this.circuits.size,
      healthyCircuits: healthyCount,
      degradedCircuits: degradedCount,
      failedCircuits: failedCount,
      overallAvailability: totalAvailability / this.circuits.size,
      services
    };
  }

  /**
   * Check if a service is healthy
   */
  isServiceHealthy(service: CircuitBreakerService): boolean {
    const circuit = this.circuits.get(service);
    if (!circuit) return false;
    
    const health = circuit.getHealthStatus();
    return health.state === CircuitState.CLOSED && health.healthy;
  }

  /**
   * Get service dependencies
   */
  getServiceDependencies(service: CircuitBreakerService): ServiceDependency[] {
    return this.dependencies.get(service) || [];
  }

  /**
   * Reset a specific circuit breaker
   */
  async resetCircuit(service: CircuitBreakerService): Promise<void> {
    const circuit = this.circuits.get(service);
    if (!circuit) {
      throw new Error(`Circuit breaker not found for service: ${service}`);
    }

    await circuit.reset();
    
    await this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
      description: `Circuit breaker reset for service: ${service}`,
      outcome: 'success',
      eventDetails: {
        service,
        metrics: circuit.getMetrics()
      }
    });
  }

  /**
   * Reset all circuit breakers
   */
  async resetAllCircuits(): Promise<void> {
    const resetPromises = Array.from(this.circuits.keys()).map(service => 
      this.resetCircuit(service)
    );
    
    await Promise.allSettled(resetPromises);
    
    await this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
      description: 'All circuit breakers reset',
      outcome: 'success',
      eventDetails: {
        totalCircuits: this.circuits.size
      }
    });
  }

  /**
   * Enable auto-recovery for all circuits
   */
  async enableAutoRecovery(): Promise<void> {
    this.config.enableAutoRecovery = true;
    
    // Monitor circuit health and attempt recovery
    setInterval(() => {
      this.attemptAutoRecovery();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Get aggregated metrics for a service
   */
  getServiceMetrics(service: CircuitBreakerService): CircuitMetrics | null {
    const circuit = this.circuits.get(service);
    return circuit ? circuit.getMetrics() : null;
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    // Shutdown all circuit breakers
    const shutdownPromises = Array.from(this.circuits.values()).map(circuit => 
      circuit.shutdown()
    );
    
    await Promise.allSettled(shutdownPromises);
    
    await this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
      description: 'Circuit breaker manager shutdown',
      outcome: 'success',
      eventDetails: {
        finalMetrics: this.getGlobalHealthStatus()
      }
    });
  }

  // Private methods

  private initializeServiceConfigs(): void {
    // SSH Connection - Critical service with lower thresholds
    this.config.serviceConfigs.set(CircuitBreakerService.SSH_CONNECTION, {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 30000,
      exponentialBackoff: true,
      maxBackoffTime: 300000
    });

    // Command Execution - Higher tolerance for failures
    this.config.serviceConfigs.set(CircuitBreakerService.COMMAND_EXECUTION, {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 60000,
      errorThresholdPercentage: 0.3
    });

    // File Transfer - Longer timeouts
    this.config.serviceConfigs.set(CircuitBreakerService.FILE_TRANSFER, {
      failureThreshold: 3,
      timeout: 300000, // 5 minutes
      exponentialBackoff: true
    });

    // Authentication - Very low tolerance
    this.config.serviceConfigs.set(CircuitBreakerService.AUTHENTICATION, {
      failureThreshold: 2,
      successThreshold: 5,
      timeout: 10000,
      errorThresholdPercentage: 0.1
    });

    // External APIs - Higher tolerance, longer recovery
    this.config.serviceConfigs.set(CircuitBreakerService.CONTEXT7_API, {
      failureThreshold: 5,
      timeout: 15000,
      exponentialBackoff: true,
      maxBackoffTime: 600000 // 10 minutes
    });

    this.config.serviceConfigs.set(CircuitBreakerService.GITHUB_API, {
      failureThreshold: 5,
      timeout: 20000,
      exponentialBackoff: true,
      maxBackoffTime: 900000 // 15 minutes
    });

    // Internal services - Moderate settings
    this.config.serviceConfigs.set(CircuitBreakerService.MEMORY_PERSISTENCE, {
      failureThreshold: 10,
      timeout: 5000,
      enableHealthChecks: false // Non-critical
    });

    this.config.serviceConfigs.set(CircuitBreakerService.AUDIT_LOGGING, {
      failureThreshold: 20,
      timeout: 3000,
      enableHealthChecks: false // Non-critical
    });
  }

  private initializeDependencies(): void {
    // SSH Connection depends on authentication
    this.dependencies.set(CircuitBreakerService.SSH_CONNECTION, [{
      service: CircuitBreakerService.AUTHENTICATION,
      required: true
    }]);

    // Command execution depends on SSH connection
    this.dependencies.set(CircuitBreakerService.COMMAND_EXECUTION, [{
      service: CircuitBreakerService.SSH_CONNECTION,
      required: true
    }]);

    // File transfer depends on SSH connection
    this.dependencies.set(CircuitBreakerService.FILE_TRANSFER, [{
      service: CircuitBreakerService.SSH_CONNECTION,
      required: true
    }]);

    // Context7 API has no hard dependencies
    this.dependencies.set(CircuitBreakerService.CONTEXT7_API, []);

    // GitHub API has no hard dependencies
    this.dependencies.set(CircuitBreakerService.GITHUB_API, []);

    // Memory persistence depends on nothing (can fail gracefully)
    this.dependencies.set(CircuitBreakerService.MEMORY_PERSISTENCE, []);

    // Audit logging depends on nothing (can fail gracefully)
    this.dependencies.set(CircuitBreakerService.AUDIT_LOGGING, []);
  }

  private initializeCircuitBreakers(): void {
    for (const service of Object.values(CircuitBreakerService)) {
      const serviceConfig = this.config.serviceConfigs.get(service) || {};
      const config = {
        ...this.config.defaultCircuitConfig,
        ...serviceConfig
      };

      const circuit = new CircuitBreaker(service, config, this.auditLogger);
      
      // Set up event listeners
      circuit.on('state_change', (event) => {
        this.emit('circuit_state_change', {
          service,
          ...event
        });
      });

      circuit.on('circuit_opened', async (event) => {
        await this.handleCircuitOpened(service, event);
      });

      circuit.on('circuit_closed', async (event) => {
        await this.handleCircuitClosed(service, event);
      });

      this.circuits.set(service, circuit);
    }
  }

  private async handleCircuitOpened(
    service: CircuitBreakerService, 
    event: any
  ): Promise<void> {
    // Check for dependent services
    const dependents = this.findDependentServices(service);
    
    if (dependents.length > 0 && this.config.enableCascadingFailure) {
      this.emit('cascade_warning', {
        failedService: service,
        affectedServices: dependents,
        event
      });
    }

    await this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
      description: `Circuit opened for service: ${service}`,
      outcome: 'failure',
      eventDetails: {
        service,
        dependents,
        metrics: event.metrics
      }
    });
  }

  private async handleCircuitClosed(
    service: CircuitBreakerService,
    event: any
  ): Promise<void> {
    // Notify recovery
    this.emit('service_recovered', {
      service,
      recoveryTime: event.recoveryTime,
      metrics: event.metrics
    });

    await this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
      description: `Circuit recovered for service: ${service}`,
      outcome: 'success',
      eventDetails: {
        service,
        recoveryTime: event.recoveryTime,
        metrics: event.metrics
      }
    });
  }

  private findDependentServices(service: CircuitBreakerService): CircuitBreakerService[] {
    const dependents: CircuitBreakerService[] = [];
    
    for (const [depService, deps] of this.dependencies) {
      if (deps.some(dep => dep.service === service && dep.required)) {
        dependents.push(depService);
      }
    }
    
    return dependents;
  }

  private async handleCascadingFailure(
    service: CircuitBreakerService,
    error: Error
  ): Promise<void> {
    const dependencies = this.dependencies.get(service) || [];
    
    for (const dep of dependencies) {
      if (dep.required && !this.isServiceHealthy(dep.service)) {
        // Open dependent circuit if required dependency is down
        const circuit = this.circuits.get(service);
        if (circuit) {
          await circuit.open();
        }
      }
    }
  }

  private async attemptAutoRecovery(): Promise<void> {
    if (!this.config.enableAutoRecovery) return;

    for (const [service, circuit] of this.circuits) {
      const health = circuit.getHealthStatus();
      
      // Attempt to close circuits that have been half-open for too long
      if (health.state === CircuitState.HALF_OPEN) {
        const timeSinceChange = Date.now() - health.lastStateChange.getTime();
        if (timeSinceChange > 300000) { // 5 minutes
          await circuit.reset();
          
          this.emit('auto_recovery_attempted', {
            service,
            reason: 'Half-open timeout',
            success: true
          });
        }
      }
    }
  }
}

/**
 * Create preconfigured circuit breaker manager
 */
export function createCircuitBreakerManager(
  auditLogger?: AuditLogger
): CircuitBreakerManager {
  return new CircuitBreakerManager({
    enableGlobalMetrics: true,
    enableAutoRecovery: true,
    enableCascadingFailure: false,
    defaultCircuitConfig: {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 60000,
      enableHealthChecks: true,
      exponentialBackoff: true,
      enableMetrics: true
    }
  }, auditLogger);
}