/**
 * Redis Cache Manager for SSH-MCP
 * Provides high-performance caching with Redis integration
 * 
 * @author Andre (OptinampOut) with Claude Code assistance
 * @organization LYFTIUM-INC
 * @date July 15, 2025
 */

import { createClient } from 'redis';
import { AuditLogger, AuditEventType } from '../audit/audit-logger.js';

export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  defaultTtl: number;
  maxRetries: number;
  retryDelay: number;
  connectionTimeout: number;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  totalOperations: number;
  hitRate: number;
  averageResponseTime: number;
  memoryUsage: number;
}

export interface CacheItem<T = any> {
  value: T;
  timestamp: number;
  ttl: number;
  metadata?: Record<string, any>;
}

export class RedisCacheManager {
  private client: any;
  private config: CacheConfig;
  private metrics: CacheMetrics;
  private auditLogger: AuditLogger;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private operationTimes: number[] = [];

  constructor(config: Partial<CacheConfig> = {}, auditLogger: AuditLogger) {
    this.config = {
      host: config.host || process.env.REDIS_HOST || 'localhost',
      port: config.port || parseInt(process.env.REDIS_PORT || '6379'),
      password: config.password || process.env.REDIS_PASSWORD,
      db: config.db || parseInt(process.env.REDIS_DB || '0'),
      keyPrefix: config.keyPrefix || process.env.REDIS_KEY_PREFIX || 'ssh-mcp:',
      defaultTtl: config.defaultTtl || parseInt(process.env.REDIS_TTL_SECONDS || '300'),
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      connectionTimeout: config.connectionTimeout || 5000
    };

    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      totalOperations: 0,
      hitRate: 0,
      averageResponseTime: 0,
      memoryUsage: 0
    };

    this.auditLogger = auditLogger;
    this.client = this.createRedisClient();
  }

  private createRedisClient(): any {
    const client = createClient({
      url: `redis://${this.config.password ? ':' + this.config.password + '@' : ''}${this.config.host}:${this.config.port}/${this.config.db}`,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > this.config.maxRetries) {
            this.auditLogger.logEvent(AuditEventType.COMPLIANCE_VIOLATION, {
              description: 'Redis connection failed after maximum retries',
              outcome: 'failure',
              eventDetails: { retries, maxRetries: this.config.maxRetries }
            });
            return false;
          }
          return Math.min(retries * this.config.retryDelay, 30000);
        },
        connectTimeout: this.config.connectionTimeout
      }
    });

    client.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.auditLogger.logEvent(AuditEventType.SERVER_START, {
        description: 'Redis cache connected successfully',
        outcome: 'success',
        eventDetails: { host: this.config.host, port: this.config.port }
      });
    });

    client.on('error', (error) => {
      this.metrics.errors++;
      this.auditLogger.logEvent(AuditEventType.COMPLIANCE_VIOLATION, {
        description: 'Redis cache error',
        outcome: 'failure',
        eventDetails: { error: error.message, host: this.config.host }
      });
    });

    client.on('reconnecting', () => {
      this.reconnectAttempts++;
      this.isConnected = false;
    });

    client.on('end', () => {
      this.isConnected = false;
    });

    return client;
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.auditLogger.logEvent(AuditEventType.SERVER_START, {
        description: 'Redis cache manager initialized',
        outcome: 'success',
        eventDetails: { config: this.config }
      });
    } catch (error) {
      this.metrics.errors++;
      this.auditLogger.logEvent(AuditEventType.COMPLIANCE_VIOLATION, {
        description: 'Failed to connect to Redis',
        outcome: 'failure',
        eventDetails: { error: error instanceof Error ? error.message : String(error) }
      });
      throw error;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      await this.client.disconnect();
      this.isConnected = false;
    } catch (error) {
      this.metrics.errors++;
    }
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      if (!this.isConnected) {
        this.metrics.misses++;
        return null;
      }

      const fullKey = this.config.keyPrefix + key;
      const value = await this.client.get(fullKey);
      
      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime);

      if (value === null) {
        this.metrics.misses++;
        return null;
      }

      try {
        const cached: CacheItem<T> = JSON.parse(value);
        
        // Check if expired
        if (cached.ttl > 0 && Date.now() > cached.timestamp + cached.ttl * 1000) {
          await this.delete(key);
          this.metrics.misses++;
          return null;
        }

        this.metrics.hits++;
        return cached.value;
      } catch (parseError) {
        this.metrics.errors++;
        await this.delete(key); // Remove corrupted data
        return null;
      }
    } catch (error) {
      this.metrics.errors++;
      this.metrics.misses++;
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T = any>(key: string, value: T, ttl?: number): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      if (!this.isConnected) {
        return false;
      }

      const fullKey = this.config.keyPrefix + key;
      const cacheTtl = ttl || this.config.defaultTtl;
      
      const cacheItem: CacheItem<T> = {
        value,
        timestamp: Date.now(),
        ttl: cacheTtl,
        metadata: {
          size: JSON.stringify(value).length,
          type: typeof value
        }
      };

      const serialized = JSON.stringify(cacheItem);
      
      if (cacheTtl > 0) {
        await this.client.setEx(fullKey, cacheTtl, serialized);
      } else {
        await this.client.set(fullKey, serialized);
      }

      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime);
      this.metrics.sets++;

      return true;
    } catch (error) {
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      if (!this.isConnected) {
        return false;
      }

      const fullKey = this.config.keyPrefix + key;
      const result = await this.client.del(fullKey);
      
      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime);
      this.metrics.deletes++;

      return result > 0;
    } catch (error) {
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }

      const fullKey = this.config.keyPrefix + key;
      const result = await this.client.exists(fullKey);
      return result === 1;
    } catch (error) {
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Get multiple values from cache
   */
  async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    try {
      if (!this.isConnected || keys.length === 0) {
        return keys.map(() => null);
      }

      const fullKeys = keys.map(key => this.config.keyPrefix + key);
      const values = await this.client.mGet(fullKeys);
      
      return values.map((value: any, index: number) => {
        if (value === null) {
          this.metrics.misses++;
          return null;
        }

        try {
          const cached: CacheItem<T> = JSON.parse(value);
          
          // Check if expired
          if (cached.ttl > 0 && Date.now() > cached.timestamp + cached.ttl * 1000) {
            this.delete(keys[index]);
            this.metrics.misses++;
            return null;
          }

          this.metrics.hits++;
          return cached.value;
        } catch (parseError) {
          this.metrics.errors++;
          this.delete(keys[index]);
          return null;
        }
      });
    } catch (error) {
      this.metrics.errors++;
      return keys.map(() => null);
    }
  }

  /**
   * Clear all cache entries with the configured prefix
   */
  async clear(): Promise<number> {
    try {
      if (!this.isConnected) {
        return 0;
      }

      const keys = await this.client.keys(this.config.keyPrefix + '*');
      if (keys.length === 0) {
        return 0;
      }

      const result = await this.client.del(keys);
      this.metrics.deletes += result;
      
      this.auditLogger.logEvent(AuditEventType.SERVER_START, {
        description: 'Cache cleared',
        outcome: 'success',
        eventDetails: { deletedKeys: result }
      });

      return result;
    } catch (error) {
      this.metrics.errors++;
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheMetrics> {
    try {
      if (this.isConnected) {
        const info = await this.client.info('memory');
        const memoryMatch = info.match(/used_memory:(\d+)/);
        this.metrics.memoryUsage = memoryMatch ? parseInt(memoryMatch[1]) : 0;
      }

      this.metrics.totalOperations = this.metrics.hits + this.metrics.misses + this.metrics.sets + this.metrics.deletes;
      this.metrics.hitRate = this.metrics.totalOperations > 0 ? 
        (this.metrics.hits / (this.metrics.hits + this.metrics.misses)) * 100 : 0;
      
      return { ...this.metrics };
    } catch (error) {
      this.metrics.errors++;
      return { ...this.metrics };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    connected: boolean;
    latency: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      if (!this.isConnected) {
        return {
          healthy: false,
          connected: false,
          latency: 0,
          error: 'Not connected to Redis'
        };
      }

      await this.client.ping();
      const latency = Date.now() - startTime;

      return {
        healthy: true,
        connected: true,
        latency
      };
    } catch (error) {
      return {
        healthy: false,
        connected: false,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(responseTime: number): void {
    this.operationTimes.push(responseTime);
    
    // Keep only last 1000 operations for average calculation
    if (this.operationTimes.length > 1000) {
      this.operationTimes = this.operationTimes.slice(-1000);
    }

    this.metrics.averageResponseTime = this.operationTimes.reduce((a, b) => a + b, 0) / this.operationTimes.length;
  }

  /**
   * Get connection status
   */
  isHealthy(): boolean {
    return this.isConnected && this.reconnectAttempts < this.config.maxRetries;
  }

  /**
   * Get configuration
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const createRedisCacheManager = (config?: Partial<CacheConfig>, auditLogger?: AuditLogger) => {
  return new RedisCacheManager(config, auditLogger!);
};