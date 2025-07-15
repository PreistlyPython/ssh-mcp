/**
 * Prometheus Metrics Exporter for SSH-MCP
 * Provides comprehensive metrics collection and export for monitoring
 * 
 * @author Andre (OptinampOut) with Claude Code assistance
 * @organization LYFTIUM-INC
 * @date July 15, 2025
 */

import { createPrometheusRegistry } from 'prom-client';
import { Counter, Histogram, Gauge, Registry } from 'prom-client';
import { AuditLogger, AuditEventType } from '../audit/audit-logger.js';
import { SSHService } from '../index.js';

export interface PrometheusMetricsConfig {
  port: number;
  path: string;
  collectDefaultMetrics: boolean;
  collectInterval: number;
  enableSystemMetrics: boolean;
}

export class PrometheusMetrics {
  private registry: Registry;
  private config: PrometheusMetricsConfig;
  private auditLogger: AuditLogger;
  private sshService: SSHService;

  // SSH Connection Metrics
  private sshConnectionsTotal: Counter<string>;
  private sshConnectionFailures: Counter<string>;
  private sshActiveConnections: Gauge<string>;
  private sshConnectionDuration: Histogram<string>;

  // SSH Command Metrics
  private sshCommandsTotal: Counter<string>;
  private sshCommandDuration: Histogram<string>;
  private sshCommandTimeouts: Counter<string>;
  private sshCommandErrors: Counter<string>;

  // Cache Metrics
  private cacheHitRate: Gauge<string>;
  private cacheOperations: Counter<string>;
  private cacheSize: Gauge<string>;
  private cacheLatency: Histogram<string>;

  // Security Metrics
  private securityViolations: Counter<string>;
  private authenticationFailures: Counter<string>;
  private authenticationSuccesses: Counter<string>;
  private mfaChallenges: Counter<string>;

  // Agentic Workflow Metrics
  private agenticWorkflowExecutions: Counter<string>;
  private agenticWorkflowFailures: Counter<string>;
  private agenticWorkflowDuration: Histogram<string>;
  private agenticWorkflowActiveCount: Gauge<string>;

  // System Metrics
  private systemCpuUsage: Gauge<string>;
  private systemMemoryUsage: Gauge<string>;
  private systemDiskUsage: Gauge<string>;

  // Application Metrics
  private applicationErrors: Counter<string>;
  private applicationUptime: Gauge<string>;
  private applicationVersion: Gauge<string>;

  constructor(config: Partial<PrometheusMetricsConfig> = {}, auditLogger: AuditLogger, sshService: SSHService) {
    this.config = {
      port: config.port || parseInt(process.env.PROMETHEUS_PORT || '9090'),
      path: config.path || '/metrics',
      collectDefaultMetrics: config.collectDefaultMetrics ?? true,
      collectInterval: config.collectInterval || parseInt(process.env.METRICS_COLLECTION_INTERVAL || '10000'),
      enableSystemMetrics: config.enableSystemMetrics ?? true
    };

    this.auditLogger = auditLogger;
    this.sshService = sshService;
    this.registry = new Registry();

    this.initializeMetrics();
    this.startCollection();
  }

  private initializeMetrics(): void {
    // SSH Connection Metrics
    this.sshConnectionsTotal = new Counter({
      name: 'ssh_connections_total',
      help: 'Total number of SSH connections attempted',
      labelNames: ['server', 'method', 'status'],
      registers: [this.registry]
    });

    this.sshConnectionFailures = new Counter({
      name: 'ssh_connection_failures_total',
      help: 'Total number of failed SSH connections',
      labelNames: ['server', 'error_type'],
      registers: [this.registry]
    });

    this.sshActiveConnections = new Gauge({
      name: 'ssh_active_connections',
      help: 'Current number of active SSH connections',
      labelNames: ['server'],
      registers: [this.registry]
    });

    this.sshConnectionDuration = new Histogram({
      name: 'ssh_connection_duration_seconds',
      help: 'SSH connection establishment duration',
      labelNames: ['server'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.registry]
    });

    // SSH Command Metrics
    this.sshCommandsTotal = new Counter({
      name: 'ssh_commands_total',
      help: 'Total number of SSH commands executed',
      labelNames: ['server', 'command_type', 'status'],
      registers: [this.registry]
    });

    this.sshCommandDuration = new Histogram({
      name: 'ssh_command_duration_seconds',
      help: 'SSH command execution duration',
      labelNames: ['server', 'command_type'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 300],
      registers: [this.registry]
    });

    this.sshCommandTimeouts = new Counter({
      name: 'ssh_command_timeouts_total',
      help: 'Total number of SSH command timeouts',
      labelNames: ['server', 'command_type'],
      registers: [this.registry]
    });

    this.sshCommandErrors = new Counter({
      name: 'ssh_command_errors_total',
      help: 'Total number of SSH command errors',
      labelNames: ['server', 'error_type'],
      registers: [this.registry]
    });

    // Cache Metrics
    this.cacheHitRate = new Gauge({
      name: 'cache_hit_rate',
      help: 'Cache hit rate percentage',
      registers: [this.registry]
    });

    this.cacheOperations = new Counter({
      name: 'cache_operations_total',
      help: 'Total number of cache operations',
      labelNames: ['operation', 'status'],
      registers: [this.registry]
    });

    this.cacheSize = new Gauge({
      name: 'cache_size_bytes',
      help: 'Current cache size in bytes',
      registers: [this.registry]
    });

    this.cacheLatency = new Histogram({
      name: 'cache_operation_duration_seconds',
      help: 'Cache operation duration',
      labelNames: ['operation'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [this.registry]
    });

    // Security Metrics
    this.securityViolations = new Counter({
      name: 'security_violations_total',
      help: 'Total number of security violations',
      labelNames: ['type', 'severity'],
      registers: [this.registry]
    });

    this.authenticationFailures = new Counter({
      name: 'authentication_failures_total',
      help: 'Total number of authentication failures',
      labelNames: ['method', 'reason'],
      registers: [this.registry]
    });

    this.authenticationSuccesses = new Counter({
      name: 'authentication_successes_total',
      help: 'Total number of successful authentications',
      labelNames: ['method'],
      registers: [this.registry]
    });

    this.mfaChallenges = new Counter({
      name: 'mfa_challenges_total',
      help: 'Total number of MFA challenges',
      labelNames: ['method', 'status'],
      registers: [this.registry]
    });

    // Agentic Workflow Metrics
    this.agenticWorkflowExecutions = new Counter({
      name: 'agentic_workflow_executions_total',
      help: 'Total number of agentic workflow executions',
      labelNames: ['workflow_name', 'status'],
      registers: [this.registry]
    });

    this.agenticWorkflowFailures = new Counter({
      name: 'agentic_workflow_failures_total',
      help: 'Total number of failed agentic workflows',
      labelNames: ['workflow_name', 'error_type'],
      registers: [this.registry]
    });

    this.agenticWorkflowDuration = new Histogram({
      name: 'agentic_workflow_duration_seconds',
      help: 'Agentic workflow execution duration',
      labelNames: ['workflow_name'],
      buckets: [1, 5, 10, 30, 60, 300, 600, 1800],
      registers: [this.registry]
    });

    this.agenticWorkflowActiveCount = new Gauge({
      name: 'agentic_workflow_active_count',
      help: 'Current number of active agentic workflows',
      labelNames: ['workflow_name'],
      registers: [this.registry]
    });

    // System Metrics
    this.systemCpuUsage = new Gauge({
      name: 'system_cpu_usage_percent',
      help: 'System CPU usage percentage',
      registers: [this.registry]
    });

    this.systemMemoryUsage = new Gauge({
      name: 'system_memory_usage_percent',
      help: 'System memory usage percentage',
      registers: [this.registry]
    });

    this.systemDiskUsage = new Gauge({
      name: 'system_disk_usage_percent',
      help: 'System disk usage percentage',
      labelNames: ['mount_point'],
      registers: [this.registry]
    });

    // Application Metrics
    this.applicationErrors = new Counter({
      name: 'application_errors_total',
      help: 'Total number of application errors',
      labelNames: ['component', 'severity'],
      registers: [this.registry]
    });

    this.applicationUptime = new Gauge({
      name: 'application_uptime_seconds',
      help: 'Application uptime in seconds',
      registers: [this.registry]
    });

    this.applicationVersion = new Gauge({
      name: 'application_version',
      help: 'Application version information',
      labelNames: ['version'],
      registers: [this.registry]
    });

    // Set initial values
    this.applicationVersion.set({ version: '1.0.0' }, 1);
  }

  private startCollection(): void {
    // Collect metrics at regular intervals
    setInterval(() => {
      this.collectMetrics();
    }, this.config.collectInterval);

    // Initial collection
    this.collectMetrics();
  }

  private async collectMetrics(): Promise<void> {
    try {
      // Update active connections
      const activeSessions = this.sshService.sessions.size;
      this.sshActiveConnections.set(activeSessions);

      // Update cache metrics
      if (this.sshService.cacheHealthCheck) {
        const cacheStats = await this.sshService.getCacheStats();
        this.cacheHitRate.set(cacheStats.hitRate);
        this.cacheSize.set(cacheStats.memoryUsage);
      }

      // Update application uptime
      this.applicationUptime.set(process.uptime());

      // Update system metrics if enabled
      if (this.config.enableSystemMetrics) {
        await this.collectSystemMetrics();
      }

    } catch (error) {
      this.auditLogger.logEvent(AuditEventType.SERVER_START, {
        description: 'Failed to collect metrics',
        outcome: 'failure',
        eventDetails: { error: error instanceof Error ? error.message : String(error) }
      });
    }
  }

  private async collectSystemMetrics(): Promise<void> {
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      // Memory metrics
      this.systemMemoryUsage.set((memUsage.heapUsed / memUsage.heapTotal) * 100);
      
      // CPU metrics would need more detailed implementation
      // For now, we'll use a simple approximation
      const cpuPercent = ((cpuUsage.user + cpuUsage.system) / 1000000) * 100;
      this.systemCpuUsage.set(cpuPercent);

    } catch (error) {
      // Silently handle system metrics collection errors
    }
  }

  // Public methods for incrementing metrics
  incrementConnectionAttempt(server: string, method: string, status: 'success' | 'failure'): void {
    this.sshConnectionsTotal.inc({ server, method, status });
    
    if (status === 'failure') {
      this.sshConnectionFailures.inc({ server, error_type: 'connection_failed' });
    }
  }

  recordConnectionDuration(server: string, duration: number): void {
    this.sshConnectionDuration.observe({ server }, duration);
  }

  incrementCommandExecution(server: string, commandType: string, status: 'success' | 'failure'): void {
    this.sshCommandsTotal.inc({ server, command_type: commandType, status });
  }

  recordCommandDuration(server: string, commandType: string, duration: number): void {
    this.sshCommandDuration.observe({ server, command_type: commandType }, duration);
  }

  incrementCommandTimeout(server: string, commandType: string): void {
    this.sshCommandTimeouts.inc({ server, command_type: commandType });
  }

  incrementSecurityViolation(type: string, severity: string): void {
    this.securityViolations.inc({ type, severity });
  }

  incrementAuthenticationFailure(method: string, reason: string): void {
    this.authenticationFailures.inc({ method, reason });
  }

  incrementAuthenticationSuccess(method: string): void {
    this.authenticationSuccesses.inc({ method });
  }

  incrementAgenticWorkflowExecution(workflowName: string, status: 'success' | 'failure'): void {
    this.agenticWorkflowExecutions.inc({ workflow_name: workflowName, status });
  }

  recordAgenticWorkflowDuration(workflowName: string, duration: number): void {
    this.agenticWorkflowDuration.observe({ workflow_name: workflowName }, duration);
  }

  incrementApplicationError(component: string, severity: string): void {
    this.applicationErrors.inc({ component, severity });
  }

  recordCacheOperation(operation: string, status: 'hit' | 'miss' | 'set' | 'delete', duration: number): void {
    this.cacheOperations.inc({ operation, status });
    this.cacheLatency.observe({ operation }, duration);
  }

  // Get metrics for export
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  // Start HTTP server for metrics endpoint
  startHttpServer(): void {
    const express = require('express');
    const app = express();

    app.get(this.config.path, async (req: any, res: any) => {
      try {
        const metrics = await this.getMetrics();
        res.set('Content-Type', 'text/plain');
        res.send(metrics);
      } catch (error) {
        res.status(500).send('Error collecting metrics');
      }
    });

    app.listen(this.config.port, () => {
      this.auditLogger.logEvent(AuditEventType.SERVER_START, {
        description: 'Prometheus metrics server started',
        outcome: 'success',
        eventDetails: { port: this.config.port, path: this.config.path }
      });
    });
  }

  // Shutdown metrics collection
  async shutdown(): Promise<void> {
    this.registry.clear();
  }
}

// Export factory function
export const createPrometheusMetrics = (config?: Partial<PrometheusMetricsConfig>, auditLogger?: AuditLogger, sshService?: SSHService) => {
  return new PrometheusMetrics(config, auditLogger!, sshService!);
};