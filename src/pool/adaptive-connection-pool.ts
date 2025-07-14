/**
 * Adaptive Connection Pool for SSH MCP Server
 * Implements intelligent connection management with load-based scaling
 */

import { EventEmitter } from 'events';
import { Client } from 'ssh2';
import { AuditLogger, AuditEventType } from '../audit/audit-logger.js';
import { CreateSessionParams } from '../types.js';

export enum PoolEventType {
  CONNECTION_CREATED = 'connection_created',
  CONNECTION_REUSED = 'connection_reused',
  CONNECTION_EXPIRED = 'connection_expired',
  CONNECTION_FAILED = 'connection_failed',
  POOL_SCALED_UP = 'pool_scaled_up',
  POOL_SCALED_DOWN = 'pool_scaled_down',
  POOL_HEALTH_CHECK = 'pool_health_check'
}

export interface PoolConfig {
  minPoolSize: number;
  maxPoolSize: number;
  connectionTimeout: number;
  maxIdleTime: number; // milliseconds
  healthCheckInterval: number; // milliseconds
  scaleUpThreshold: number; // percentage of pool utilization
  scaleDownThreshold: number; // percentage of pool utilization
  scaleUpCooldown: number; // milliseconds
  scaleDownCooldown: number; // milliseconds
  maxConnectionsPerHost: number;
  enableAdaptiveScaling: boolean;
  enableHealthChecks: boolean;
  enableConnectionReuse: boolean;
  connectionRetryAttempts: number;
  connectionRetryDelay: number; // milliseconds
}

export interface PooledConnection {
  client: Client;
  key: string;
  host: string;
  username: string;
  createdAt: Date;
  lastUsed: Date;
  usageCount: number;
  isHealthy: boolean;
  isActive: boolean;
  params: CreateSessionParams;
}

export interface PoolMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  poolUtilization: number; // percentage
  connectionHitRate: number; // percentage
  averageConnectionAge: number; // milliseconds
  connectionsPerHost: Record<string, number>;
  healthyConnections: number;
  unhealthyConnections: number;
  lastScaleEvent: Date | null;
  scaleEvents: number;
}

export interface PoolStatistics {
  metrics: PoolMetrics;
  performance: {
    avgConnectionTime: number;
    avgReuseTime: number;
    totalConnectionRequests: number;
    totalConnectionReuses: number;
    totalConnectionCreations: number;
    totalConnectionFailures: number;
    totalExpiredConnections: number;
  };
  config: PoolConfig;
}

/**
 * Adaptive Connection Pool with intelligent scaling and health monitoring
 */
export class AdaptiveConnectionPool extends EventEmitter {
  private config: PoolConfig;
  private auditLogger: AuditLogger;
  private connections = new Map<string, PooledConnection>();
  private connectionsByHost = new Map<string, Set<string>>();
  private healthCheckTimer?: NodeJS.Timeout;
  private scaleTimer?: NodeJS.Timeout;
  private lastScaleUp = 0;
  private lastScaleDown = 0;
  private scaleEvents = 0;
  
  // Performance tracking
  private connectionRequests = 0;
  private connectionReuses = 0;
  private connectionCreations = 0;
  private connectionFailures = 0;
  private expiredConnections = 0;
  private connectionTimes: number[] = [];
  private reuseTimes: number[] = [];

  constructor(config: Partial<PoolConfig> = {}, auditLogger?: AuditLogger) {
    super();
    
    this.config = {
      minPoolSize: parseInt(process.env.SSH_MIN_POOL_SIZE || '5'),
      maxPoolSize: parseInt(process.env.SSH_MAX_POOL_SIZE || '100'),
      connectionTimeout: parseInt(process.env.SSH_CONNECTION_TIMEOUT || '30000'),
      maxIdleTime: parseInt(process.env.SSH_MAX_IDLE_TIME || '300000'), // 5 minutes
      healthCheckInterval: parseInt(process.env.SSH_HEALTH_CHECK_INTERVAL || '60000'), // 1 minute
      scaleUpThreshold: parseFloat(process.env.SSH_SCALE_UP_THRESHOLD || '0.8'), // 80%
      scaleDownThreshold: parseFloat(process.env.SSH_SCALE_DOWN_THRESHOLD || '0.3'), // 30%
      scaleUpCooldown: parseInt(process.env.SSH_SCALE_UP_COOLDOWN || '60000'), // 1 minute
      scaleDownCooldown: parseInt(process.env.SSH_SCALE_DOWN_COOLDOWN || '300000'), // 5 minutes
      maxConnectionsPerHost: parseInt(process.env.SSH_MAX_CONNECTIONS_PER_HOST || '10'),
      enableAdaptiveScaling: process.env.SSH_ENABLE_ADAPTIVE_SCALING !== 'false',
      enableHealthChecks: process.env.SSH_ENABLE_HEALTH_CHECKS !== 'false',
      enableConnectionReuse: process.env.SSH_ENABLE_CONNECTION_REUSE !== 'false',
      connectionRetryAttempts: parseInt(process.env.SSH_CONNECTION_RETRY_ATTEMPTS || '3'),
      connectionRetryDelay: parseInt(process.env.SSH_CONNECTION_RETRY_DELAY || '1000'),
      ...config
    };

    this.auditLogger = auditLogger || new AuditLogger();
    
    // Initialize health checks and scaling
    this.initializeHealthChecks();
    this.initializeAdaptiveScaling();
  }

  /**
   * Get or create a connection from the pool
   */
  async getConnection(params: CreateSessionParams): Promise<Client> {
    const startTime = Date.now();
    this.connectionRequests++;
    
    const key = this.generateKey(params.host, params.username);
    
    try {
      // Try to reuse existing connection
      if (this.config.enableConnectionReuse) {
        const reusedConnection = await this.tryReuseConnection(key, params);
        if (reusedConnection) {
          this.connectionReuses++;
          this.reuseTimes.push(Date.now() - startTime);
          this.emit(PoolEventType.CONNECTION_REUSED, { key, params });
          return reusedConnection;
        }
      }
      
      // Create new connection
      const newConnection = await this.createConnection(params);
      this.connectionCreations++;
      this.connectionTimes.push(Date.now() - startTime);
      this.emit(PoolEventType.CONNECTION_CREATED, { key, params });
      
      return newConnection;
    } catch (error: any) {
      this.connectionFailures++;
      this.emit(PoolEventType.CONNECTION_FAILED, { key, params, error });
      
      await this.auditLogger.logEvent(AuditEventType.SSH_CONNECTION_FAILED, {
        description: `Connection pool failed to get connection for ${params.host}`,
        outcome: 'failure',
        eventDetails: {
          host: params.host,
          username: params.username,
          errorMessage: error.message,
          poolSize: this.connections.size,
          utilization: this.getPoolUtilization()
        }
      });
      
      throw error;
    }
  }

  /**
   * Return a connection to the pool
   */
  async returnConnection(client: Client, key: string): Promise<void> {
    const connection = this.connections.get(key);
    if (connection) {
      connection.isActive = false;
      connection.lastUsed = new Date();
      
      // Check if connection is still healthy
      const isHealthy = await this.checkConnectionHealth(connection);
      connection.isHealthy = isHealthy;
      
      if (!isHealthy) {
        await this.removeConnection(key);
      }
    }
  }

  /**
   * Remove a connection from the pool
   */
  async removeConnection(key: string): Promise<void> {
    const connection = this.connections.get(key);
    if (connection) {
      // Remove from host tracking
      const hostConnections = this.connectionsByHost.get(connection.host);
      if (hostConnections) {
        hostConnections.delete(key);
        if (hostConnections.size === 0) {
          this.connectionsByHost.delete(connection.host);
        }
      }
      
      // Close connection
      try {
        connection.client.end();
      } catch (error) {
        // Ignore errors when closing
      }
      
      this.connections.delete(key);
      
      await this.auditLogger.logEvent(AuditEventType.SSH_CONNECTION_CLOSED, {
        description: `Connection removed from pool: ${key}`,
        outcome: 'success',
        eventDetails: {
          key,
          host: connection.host,
          username: connection.username,
          usageCount: connection.usageCount,
          connectionAge: Date.now() - connection.createdAt.getTime(),
          poolSize: this.connections.size
        }
      });
    }
  }

  /**
   * Get pool statistics
   */
  getStatistics(): PoolStatistics {
    const metrics = this.getMetrics();
    
    return {
      metrics,
      performance: {
        avgConnectionTime: this.calculateAverage(this.connectionTimes),
        avgReuseTime: this.calculateAverage(this.reuseTimes),
        totalConnectionRequests: this.connectionRequests,
        totalConnectionReuses: this.connectionReuses,
        totalConnectionCreations: this.connectionCreations,
        totalConnectionFailures: this.connectionFailures,
        totalExpiredConnections: this.expiredConnections
      },
      config: this.config
    };
  }

  /**
   * Get current pool metrics
   */
  getMetrics(): PoolMetrics {
    const activeConnections = Array.from(this.connections.values()).filter(c => c.isActive).length;
    const idleConnections = this.connections.size - activeConnections;
    const healthyConnections = Array.from(this.connections.values()).filter(c => c.isHealthy).length;
    const unhealthyConnections = this.connections.size - healthyConnections;
    
    const connectionsPerHost: Record<string, number> = {};
    for (const [host, connections] of this.connectionsByHost) {
      connectionsPerHost[host] = connections.size;
    }
    
    const connectionAges = Array.from(this.connections.values()).map(c => 
      Date.now() - c.createdAt.getTime()
    );
    
    return {
      totalConnections: this.connections.size,
      activeConnections,
      idleConnections,
      poolUtilization: this.getPoolUtilization(),
      connectionHitRate: this.connectionRequests > 0 ? 
        (this.connectionReuses / this.connectionRequests) * 100 : 0,
      averageConnectionAge: this.calculateAverage(connectionAges),
      connectionsPerHost,
      healthyConnections,
      unhealthyConnections,
      lastScaleEvent: this.lastScaleUp > 0 || this.lastScaleDown > 0 ? 
        new Date(Math.max(this.lastScaleUp, this.lastScaleDown)) : null,
      scaleEvents: this.scaleEvents
    };
  }

  /**
   * Gracefully shutdown the pool
   */
  async shutdown(): Promise<void> {
    // Clear timers
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.scaleTimer) {
      clearInterval(this.scaleTimer);
    }
    
    // Close all connections
    const closePromises = Array.from(this.connections.keys()).map(key => 
      this.removeConnection(key)
    );
    
    await Promise.allSettled(closePromises);
    
    await this.auditLogger.logEvent(AuditEventType.SSH_CONNECTION_CLOSED, {
      description: 'Connection pool shutdown completed',
      outcome: 'success',
      eventDetails: {
        totalConnectionsClosed: closePromises.length,
        finalPoolSize: this.connections.size
      }
    });
  }

  // Private methods

  private generateKey(host: string, username: string): string {
    return `${username}@${host}`;
  }

  private getPoolUtilization(): number {
    return (this.connections.size / this.config.maxPoolSize) * 100;
  }

  private async tryReuseConnection(key: string, params: CreateSessionParams): Promise<Client | null> {
    const connection = this.connections.get(key);
    if (!connection || connection.isActive || !connection.isHealthy) {
      return null;
    }
    
    // Check if connection is still valid
    const isHealthy = await this.checkConnectionHealth(connection);
    if (!isHealthy) {
      await this.removeConnection(key);
      return null;
    }
    
    // Check if connection has been idle too long
    const idleTime = Date.now() - connection.lastUsed.getTime();
    if (idleTime > this.config.maxIdleTime) {
      await this.removeConnection(key);
      this.expiredConnections++;
      this.emit(PoolEventType.CONNECTION_EXPIRED, { key, connection });
      return null;
    }
    
    // Mark as active and update usage
    connection.isActive = true;
    connection.lastUsed = new Date();
    connection.usageCount++;
    
    return connection.client;
  }

  private async createConnection(params: CreateSessionParams): Promise<Client> {
    const key = this.generateKey(params.host, params.username);
    
    // Check per-host connection limits
    const hostConnections = this.connectionsByHost.get(params.host) || new Set();
    if (hostConnections.size >= this.config.maxConnectionsPerHost) {
      throw new Error(`Maximum connections per host exceeded for ${params.host}`);
    }
    
    // Check global pool limit
    if (this.connections.size >= this.config.maxPoolSize) {
      // Try to evict idle connections
      await this.evictIdleConnections();
      
      if (this.connections.size >= this.config.maxPoolSize) {
        throw new Error('Connection pool is full');
      }
    }
    
    const client = new Client();
    
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Connection timeout after ${this.config.connectionTimeout}ms`));
        }, this.config.connectionTimeout);
        
        client.on('ready', () => {
          clearTimeout(timeout);
          resolve();
        });
        
        client.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
        
        client.connect({
          host: params.host,
          port: params.port || 22,
          username: params.username,
          password: params.password,
          privateKey: params.privateKey,
          passphrase: params.passphrase,
          readyTimeout: this.config.connectionTimeout,
          keepaliveInterval: 10000
        });
      });
      
      // Create pooled connection
      const pooledConnection: PooledConnection = {
        client,
        key,
        host: params.host,
        username: params.username,
        createdAt: new Date(),
        lastUsed: new Date(),
        usageCount: 1,
        isHealthy: true,
        isActive: true,
        params
      };
      
      this.connections.set(key, pooledConnection);
      
      // Track by host
      if (!this.connectionsByHost.has(params.host)) {
        this.connectionsByHost.set(params.host, new Set());
      }
      this.connectionsByHost.get(params.host)!.add(key);
      
      return client;
    } catch (error) {
      try {
        client.end();
      } catch {
        // Ignore errors when cleaning up
      }
      throw error;
    }
  }

  private async checkConnectionHealth(connection: PooledConnection): Promise<boolean> {
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Health check timeout'));
        }, 5000);
        
        connection.client.exec(':', (err) => {
          clearTimeout(timeout);
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
      
      return true;
    } catch {
      return false;
    }
  }

  private async evictIdleConnections(): Promise<void> {
    const now = Date.now();
    const connectionsToEvict: string[] = [];
    
    for (const [key, connection] of this.connections) {
      if (!connection.isActive) {
        const idleTime = now - connection.lastUsed.getTime();
        if (idleTime > this.config.maxIdleTime) {
          connectionsToEvict.push(key);
        }
      }
    }
    
    // Evict oldest connections first
    connectionsToEvict.sort((a, b) => {
      const connA = this.connections.get(a)!;
      const connB = this.connections.get(b)!;
      return connA.lastUsed.getTime() - connB.lastUsed.getTime();
    });
    
    for (const key of connectionsToEvict) {
      await this.removeConnection(key);
      this.expiredConnections++;
    }
  }

  private initializeHealthChecks(): void {
    if (!this.config.enableHealthChecks) return;
    
    this.healthCheckTimer = setInterval(async () => {
      const unhealthyConnections: string[] = [];
      
      for (const [key, connection] of this.connections) {
        if (!connection.isActive) {
          const isHealthy = await this.checkConnectionHealth(connection);
          connection.isHealthy = isHealthy;
          
          if (!isHealthy) {
            unhealthyConnections.push(key);
          }
        }
      }
      
      // Remove unhealthy connections
      for (const key of unhealthyConnections) {
        await this.removeConnection(key);
      }
      
      this.emit(PoolEventType.POOL_HEALTH_CHECK, {
        totalChecked: this.connections.size,
        unhealthyRemoved: unhealthyConnections.length,
        poolSize: this.connections.size
      });
    }, this.config.healthCheckInterval);
  }

  private initializeAdaptiveScaling(): void {
    if (!this.config.enableAdaptiveScaling) return;
    
    this.scaleTimer = setInterval(async () => {
      const utilization = this.getPoolUtilization();
      const now = Date.now();
      
      // Scale up if utilization is high
      if (utilization > this.config.scaleUpThreshold * 100 && 
          now - this.lastScaleUp > this.config.scaleUpCooldown) {
        await this.scaleUp();
      }
      
      // Scale down if utilization is low
      if (utilization < this.config.scaleDownThreshold * 100 && 
          now - this.lastScaleDown > this.config.scaleDownCooldown) {
        await this.scaleDown();
      }
    }, 30000); // Check every 30 seconds
  }

  private async scaleUp(): Promise<void> {
    const currentSize = this.connections.size;
    const targetSize = Math.min(currentSize + Math.ceil(currentSize * 0.2), this.config.maxPoolSize);
    
    if (targetSize > currentSize) {
      this.lastScaleUp = Date.now();
      this.scaleEvents++;
      
      this.emit(PoolEventType.POOL_SCALED_UP, {
        previousSize: currentSize,
        targetSize,
        utilization: this.getPoolUtilization()
      });
      
      await this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
        description: `Connection pool scaled up from ${currentSize} to ${targetSize}`,
        outcome: 'success',
        eventDetails: {
          previousSize: currentSize,
          targetSize,
          utilization: this.getPoolUtilization()
        }
      });
    }
  }

  private async scaleDown(): Promise<void> {
    const currentSize = this.connections.size;
    const targetSize = Math.max(currentSize - Math.ceil(currentSize * 0.1), this.config.minPoolSize);
    
    if (targetSize < currentSize) {
      // Remove idle connections
      const idleConnections = Array.from(this.connections.entries())
        .filter(([_, conn]) => !conn.isActive)
        .sort(([_, a], [__, b]) => a.lastUsed.getTime() - b.lastUsed.getTime());
      
      const connectionsToRemove = idleConnections.slice(0, currentSize - targetSize);
      
      for (const [key, _] of connectionsToRemove) {
        await this.removeConnection(key);
      }
      
      this.lastScaleDown = Date.now();
      this.scaleEvents++;
      
      this.emit(PoolEventType.POOL_SCALED_DOWN, {
        previousSize: currentSize,
        newSize: this.connections.size,
        utilization: this.getPoolUtilization()
      });
      
      await this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
        description: `Connection pool scaled down from ${currentSize} to ${this.connections.size}`,
        outcome: 'success',
        eventDetails: {
          previousSize: currentSize,
          newSize: this.connections.size,
          utilization: this.getPoolUtilization()
        }
      });
    }
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
}