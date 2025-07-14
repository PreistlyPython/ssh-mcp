/**
 * Comprehensive Error Monitoring System for SSH MCP Server
 * Provides real-time error tracking, alerting, and automatic recovery mechanisms
 */

import { EventEmitter } from 'events';
import { AuditLogger, AuditEventType, AuditSeverity } from '../audit/audit-logger.js';
import { SSHError, ErrorCategory, ErrorSeverity } from '../errors/ssh-errors.js';

export enum ErrorType {
  SSH_CONNECTION_ERROR = 'ssh_connection_error',
  SSH_COMMAND_ERROR = 'ssh_command_error',
  SSH_AUTHENTICATION_ERROR = 'ssh_authentication_error',
  CIRCUIT_BREAKER_ERROR = 'circuit_breaker_error',
  CONTEXT7_API_ERROR = 'context7_api_error',
  GITHUB_API_ERROR = 'github_api_error',
  MEMORY_PERSISTENCE_ERROR = 'memory_persistence_error',
  AUDIT_LOGGING_ERROR = 'audit_logging_error',
  SYSTEM_ERROR = 'system_error',
  PERFORMANCE_ERROR = 'performance_error',
  SECURITY_ERROR = 'security_error'
}

export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export enum RecoveryAction {
  NONE = 'none',
  RETRY = 'retry',
  CIRCUIT_BREAKER_RESET = 'circuit_breaker_reset',
  CONNECTION_POOL_RESET = 'connection_pool_reset',
  SERVICE_RESTART = 'service_restart',
  FAILOVER = 'failover'
}

export interface ErrorContext {
  sessionId?: string;
  userId?: string;
  host?: string;
  command?: string;
  service?: string;
  operation?: string;
  timestamp: Date;
  stackTrace?: string;
  metadata?: Record<string, any>;
}

export interface ErrorMetrics {
  errorType: ErrorType;
  count: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  averageFrequency: number; // errors per minute
  trend: 'increasing' | 'decreasing' | 'stable';
  impactScore: number; // 0-100
  affectedSessions: Set<string>;
  affectedUsers: Set<string>;
  relatedErrors: ErrorType[];
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  errorTypes: ErrorType[];
  conditions: {
    threshold: number;
    timeWindow: number; // milliseconds
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
  };
  alertLevel: AlertLevel;
  recoveryActions: RecoveryAction[];
  cooldownPeriod: number; // milliseconds
  enabled: boolean;
}

export interface ErrorAlert {
  id: string;
  alertRuleId: string;
  alertLevel: AlertLevel;
  errorType: ErrorType;
  title: string;
  description: string;
  context: ErrorContext;
  metrics: ErrorMetrics;
  suggestedActions: RecoveryAction[];
  timestamp: Date;
  acknowledged: boolean;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface MonitoringConfig {
  enabled: boolean;
  realTimeTracking: boolean;
  alertingEnabled: boolean;
  autoRecoveryEnabled: boolean;
  metricsRetentionDays: number;
  alertRetentionDays: number;
  performanceThresholds: {
    responseTimeMs: number;
    memoryUsageMB: number;
    cpuUsagePercent: number;
    connectionPoolUtilizationPercent: number;
  };
  alerting: {
    maxAlertsPerHour: number;
    duplicateSuppressionWindow: number; // milliseconds
    escalationDelay: number; // milliseconds
  };
  recovery: {
    maxRetryAttempts: number;
    retryBackoffMs: number;
    autoRecoveryTimeoutMs: number;
  };
}

/**
 * Real-time error monitoring and alerting system
 */
export class ErrorMonitor extends EventEmitter {
  private config: MonitoringConfig;
  private auditLogger: AuditLogger;
  private errorMetrics = new Map<ErrorType, ErrorMetrics>();
  private alertRules = new Map<string, AlertRule>();
  private activeAlerts = new Map<string, ErrorAlert>();
  private alertHistory: ErrorAlert[] = [];
  private recentErrors: Array<{ error: Error; context: ErrorContext; timestamp: Date }> = [];
  private lastCleanup = Date.now();

  constructor(config: Partial<MonitoringConfig> = {}, auditLogger?: AuditLogger) {
    super();
    
    this.config = {
      enabled: true,
      realTimeTracking: true,
      alertingEnabled: true,
      autoRecoveryEnabled: true,
      metricsRetentionDays: 30,
      alertRetentionDays: 90,
      performanceThresholds: {
        responseTimeMs: 5000,
        memoryUsageMB: 1024,
        cpuUsagePercent: 80,
        connectionPoolUtilizationPercent: 90
      },
      alerting: {
        maxAlertsPerHour: 100,
        duplicateSuppressionWindow: 300000, // 5 minutes
        escalationDelay: 900000 // 15 minutes
      },
      recovery: {
        maxRetryAttempts: 3,
        retryBackoffMs: 1000,
        autoRecoveryTimeoutMs: 300000 // 5 minutes
      },
      ...config
    };

    this.auditLogger = auditLogger || new AuditLogger();
    
    // Initialize default alert rules
    this.initializeDefaultAlertRules();
    
    // Start monitoring processes
    this.startMonitoring();
  }

  /**
   * Track an error occurrence
   */
  async trackError(
    error: Error | SSHError,
    context: Partial<ErrorContext> = {}
  ): Promise<void> {
    if (!this.config.enabled) return;

    const errorType = this.classifyError(error);
    const fullContext: ErrorContext = {
      timestamp: new Date(),
      stackTrace: error.stack,
      ...context
    };

    // Store recent error
    this.recentErrors.push({
      error,
      context: fullContext,
      timestamp: fullContext.timestamp
    });

    // Update metrics
    await this.updateErrorMetrics(errorType, fullContext);

    // Check alert rules
    await this.checkAlertRules(errorType, fullContext);

    // Emit real-time event
    this.emit('error_tracked', {
      errorType,
      error,
      context: fullContext
    });

    // Log audit event
    await this.auditLogger.logEvent(AuditEventType.SUSPICIOUS_ACTIVITY, {
      sessionId: fullContext.sessionId,
      description: `Error tracked: ${errorType}`,
      outcome: 'failure',
      eventDetails: {
        errorType,
        errorMessage: error.message,
        context: fullContext
      }
    });
  }

  /**
   * Get current error metrics
   */
  getErrorMetrics(): Map<ErrorType, ErrorMetrics> {
    return new Map(this.errorMetrics);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): ErrorAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit: number = 100): ErrorAlert[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    alert.acknowledged = true;
    this.emit('alert_acknowledged', { alert, acknowledgedBy });

    await this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
      description: `Alert acknowledged: ${alert.title}`,
      outcome: 'success',
      eventDetails: {
        alertId,
        acknowledgedBy,
        alertLevel: alert.alertLevel
      }
    });
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, resolvedBy: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();
    alert.resolvedBy = resolvedBy;

    // Move to history
    this.alertHistory.push(alert);
    this.activeAlerts.delete(alertId);

    this.emit('alert_resolved', { alert, resolvedBy });

    await this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
      description: `Alert resolved: ${alert.title}`,
      outcome: 'success',
      eventDetails: {
        alertId,
        resolvedBy,
        resolution: 'manual',
        duration: alert.resolvedAt!.getTime() - alert.timestamp.getTime()
      }
    });
  }

  /**
   * Add custom alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    this.emit('alert_rule_added', rule);
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(ruleId: string): boolean {
    const removed = this.alertRules.delete(ruleId);
    if (removed) {
      this.emit('alert_rule_removed', { ruleId });
    }
    return removed;
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStatistics(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    activeAlertsCount: number;
    alertsByLevel: Record<string, number>;
    systemHealth: {
      overallStatus: 'healthy' | 'degraded' | 'critical';
      errorRate: number; // errors per minute
      topErrors: Array<{ type: ErrorType; count: number }>;
    };
  } {
    const now = Date.now();
    const hourAgo = now - 3600000; // 1 hour

    // Count recent errors
    const recentErrorCount = this.recentErrors.filter(
      e => e.timestamp.getTime() > hourAgo
    ).length;

    const errorsByType: Record<string, number> = {};
    for (const [type, metrics] of this.errorMetrics) {
      errorsByType[type] = metrics.count;
    }

    const alertsByLevel: Record<string, number> = {
      [AlertLevel.INFO]: 0,
      [AlertLevel.WARNING]: 0,
      [AlertLevel.ERROR]: 0,
      [AlertLevel.CRITICAL]: 0
    };

    for (const alert of this.activeAlerts.values()) {
      alertsByLevel[alert.alertLevel]++;
    }

    // Calculate error rate (errors per minute)
    const errorRate = recentErrorCount / 60;

    // Determine system health
    let overallStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (alertsByLevel[AlertLevel.CRITICAL] > 0) {
      overallStatus = 'critical';
    } else if (alertsByLevel[AlertLevel.ERROR] > 0 || errorRate > 5) {
      overallStatus = 'degraded';
    }

    // Top errors
    const topErrors = Array.from(this.errorMetrics.entries())
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5)
      .map(([type, metrics]) => ({ type, count: metrics.count }));

    return {
      totalErrors: this.recentErrors.length,
      errorsByType,
      activeAlertsCount: this.activeAlerts.size,
      alertsByLevel,
      systemHealth: {
        overallStatus,
        errorRate,
        topErrors
      }
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.config.enabled = false;
    
    // Cleanup monitoring processes
    this.removeAllListeners();
    
    await this.auditLogger.logEvent(AuditEventType.SERVER_STOP, {
      description: 'Error monitoring system shutdown',
      outcome: 'success',
      eventDetails: {
        finalMetrics: this.getMonitoringStatistics()
      }
    });
  }

  // Private methods

  private classifyError(error: Error | SSHError): ErrorType {
    if (error instanceof SSHError) {
      switch (error.category) {
        case ErrorCategory.CONNECTION:
          return ErrorType.SSH_CONNECTION_ERROR;
        case ErrorCategory.AUTHENTICATION:
          return ErrorType.SSH_AUTHENTICATION_ERROR;
        case ErrorCategory.COMMAND_EXECUTION:
          return ErrorType.SSH_COMMAND_ERROR;
        case ErrorCategory.SYSTEM:
          return ErrorType.SYSTEM_ERROR;
        case ErrorCategory.SECURITY:
          return ErrorType.SECURITY_ERROR;
        default:
          return ErrorType.SYSTEM_ERROR;
      }
    }

    // Classify by error message patterns
    const message = error.message.toLowerCase();
    
    if (message.includes('connection') || message.includes('ssh')) {
      return ErrorType.SSH_CONNECTION_ERROR;
    }
    if (message.includes('circuit breaker')) {
      return ErrorType.CIRCUIT_BREAKER_ERROR;
    }
    if (message.includes('context7') || message.includes('documentation')) {
      return ErrorType.CONTEXT7_API_ERROR;
    }
    if (message.includes('github') || message.includes('repository')) {
      return ErrorType.GITHUB_API_ERROR;
    }
    if (message.includes('memory') || message.includes('persistence')) {
      return ErrorType.MEMORY_PERSISTENCE_ERROR;
    }
    if (message.includes('audit') || message.includes('logging')) {
      return ErrorType.AUDIT_LOGGING_ERROR;
    }
    if (message.includes('performance') || message.includes('timeout')) {
      return ErrorType.PERFORMANCE_ERROR;
    }
    if (message.includes('auth') || message.includes('permission')) {
      return ErrorType.SSH_AUTHENTICATION_ERROR;
    }

    return ErrorType.SYSTEM_ERROR;
  }

  private async updateErrorMetrics(
    errorType: ErrorType,
    context: ErrorContext
  ): Promise<void> {
    let metrics = this.errorMetrics.get(errorType);
    
    if (!metrics) {
      metrics = {
        errorType,
        count: 0,
        firstOccurrence: context.timestamp,
        lastOccurrence: context.timestamp,
        averageFrequency: 0,
        trend: 'stable',
        impactScore: 0,
        affectedSessions: new Set(),
        affectedUsers: new Set(),
        relatedErrors: []
      };
      this.errorMetrics.set(errorType, metrics);
    }

    // Update metrics
    metrics.count++;
    metrics.lastOccurrence = context.timestamp;
    
    if (context.sessionId) {
      metrics.affectedSessions.add(context.sessionId);
    }
    if (context.userId) {
      metrics.affectedUsers.add(context.userId);
    }

    // Calculate frequency (errors per minute over last hour)
    const hourAgo = Date.now() - 3600000;
    const recentErrors = this.recentErrors.filter(
      e => e.timestamp.getTime() > hourAgo &&
           this.classifyError(e.error) === errorType
    );
    metrics.averageFrequency = recentErrors.length / 60;

    // Calculate trend
    const thirtyMinAgo = Date.now() - 1800000;
    const recentCount = recentErrors.filter(
      e => e.timestamp.getTime() > thirtyMinAgo
    ).length;
    const olderCount = recentErrors.length - recentCount;
    
    if (recentCount > olderCount * 1.2) {
      metrics.trend = 'increasing';
    } else if (recentCount < olderCount * 0.8) {
      metrics.trend = 'decreasing';
    } else {
      metrics.trend = 'stable';
    }

    // Calculate impact score
    metrics.impactScore = Math.min(100, 
      (metrics.affectedSessions.size * 10) +
      (metrics.affectedUsers.size * 20) +
      (metrics.averageFrequency * 5)
    );
  }

  private async checkAlertRules(
    errorType: ErrorType,
    context: ErrorContext
  ): Promise<void> {
    if (!this.config.alertingEnabled) return;

    for (const rule of this.alertRules.values()) {
      if (!rule.enabled || !rule.errorTypes.includes(errorType)) {
        continue;
      }

      const metrics = this.errorMetrics.get(errorType);
      if (!metrics) continue;

      // Check conditions
      const { threshold, timeWindow, operator } = rule.conditions;
      const windowStart = Date.now() - timeWindow;
      
      const recentErrors = this.recentErrors.filter(
        e => e.timestamp.getTime() > windowStart &&
             this.classifyError(e.error) === errorType
      );

      const value = recentErrors.length;
      let conditionMet = false;

      switch (operator) {
        case 'gt': conditionMet = value > threshold; break;
        case 'gte': conditionMet = value >= threshold; break;
        case 'lt': conditionMet = value < threshold; break;
        case 'lte': conditionMet = value <= threshold; break;
        case 'eq': conditionMet = value === threshold; break;
      }

      if (conditionMet) {
        await this.createAlert(rule, errorType, context, metrics);
      }
    }
  }

  private async createAlert(
    rule: AlertRule,
    errorType: ErrorType,
    context: ErrorContext,
    metrics: ErrorMetrics
  ): Promise<void> {
    // Check for duplicate suppression
    const now = Date.now();
    const existingAlert = Array.from(this.activeAlerts.values()).find(
      alert => alert.alertRuleId === rule.id &&
               alert.errorType === errorType &&
               (now - alert.timestamp.getTime()) < this.config.alerting.duplicateSuppressionWindow
    );

    if (existingAlert) return;

    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const alert: ErrorAlert = {
      id: alertId,
      alertRuleId: rule.id,
      alertLevel: rule.alertLevel,
      errorType,
      title: `${rule.name}: ${errorType}`,
      description: `${rule.description}. ${metrics.count} occurrences, affecting ${metrics.affectedSessions.size} sessions.`,
      context,
      metrics,
      suggestedActions: rule.recoveryActions,
      timestamp: new Date(),
      acknowledged: false,
      resolved: false
    };

    this.activeAlerts.set(alertId, alert);
    
    // Emit alert event
    this.emit('alert_created', alert);

    // Auto-recovery if enabled
    if (this.config.autoRecoveryEnabled && rule.recoveryActions.length > 0) {
      await this.attemptAutoRecovery(alert);
    }

    // Log alert
    await this.auditLogger.logEvent(AuditEventType.SUSPICIOUS_ACTIVITY, {
      sessionId: context.sessionId,
      description: `Alert created: ${alert.title}`,
      outcome: 'failure',
      eventDetails: {
        alertId,
        alertLevel: alert.alertLevel,
        errorType,
        metrics: {
          count: metrics.count,
          affectedSessions: metrics.affectedSessions.size,
          impactScore: metrics.impactScore
        }
      }
    });
  }

  private async attemptAutoRecovery(alert: ErrorAlert): Promise<void> {
    for (const action of alert.suggestedActions) {
      try {
        await this.executeRecoveryAction(action, alert);
        
        // If successful, mark alert as auto-resolved
        alert.resolved = true;
        alert.resolvedAt = new Date();
        alert.resolvedBy = 'auto-recovery';
        
        this.alertHistory.push(alert);
        this.activeAlerts.delete(alert.id);
        
        this.emit('alert_auto_resolved', { alert, action });
        
        await this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
          description: `Alert auto-resolved: ${alert.title}`,
          outcome: 'success',
          eventDetails: {
            alertId: alert.id,
            recoveryAction: action,
            duration: alert.resolvedAt!.getTime() - alert.timestamp.getTime()
          }
        });
        
        break; // Stop after first successful recovery
      } catch (error) {
        // Log recovery failure but continue with next action
        await this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
          description: `Auto-recovery failed for alert: ${alert.title}`,
          outcome: 'failure',
          eventDetails: {
            alertId: alert.id,
            recoveryAction: action,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
    }
  }

  private async executeRecoveryAction(
    action: RecoveryAction,
    alert: ErrorAlert
  ): Promise<void> {
    // Use prompt-based workflow to leverage existing MCP ecosystem for recovery
    const recoveryPrompt = this.buildRecoveryPrompt(action, alert);
    
    switch (action) {
      case RecoveryAction.RETRY:
        // Emit retry event with MCP workflow prompt
        this.emit('recovery_retry', { alert, mcpWorkflow: recoveryPrompt });
        break;
        
      case RecoveryAction.CIRCUIT_BREAKER_RESET:
        this.emit('recovery_circuit_breaker_reset', { alert, mcpWorkflow: recoveryPrompt });
        break;
        
      case RecoveryAction.CONNECTION_POOL_RESET:
        this.emit('recovery_connection_pool_reset', { alert, mcpWorkflow: recoveryPrompt });
        break;
        
      case RecoveryAction.SERVICE_RESTART:
        this.emit('recovery_service_restart', { alert, mcpWorkflow: recoveryPrompt });
        break;
        
      case RecoveryAction.FAILOVER:
        this.emit('recovery_failover', { alert, mcpWorkflow: recoveryPrompt });
        break;
        
      case RecoveryAction.NONE:
      default:
        // No action required
        break;
    }
  }

  private initializeDefaultAlertRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        description: 'Error rate exceeds threshold',
        errorTypes: Object.values(ErrorType),
        conditions: {
          threshold: 10,
          timeWindow: 300000, // 5 minutes
          operator: 'gte'
        },
        alertLevel: AlertLevel.WARNING,
        recoveryActions: [RecoveryAction.RETRY],
        cooldownPeriod: 600000, // 10 minutes
        enabled: true
      },
      {
        id: 'connection_failures',
        name: 'SSH Connection Failures',
        description: 'Multiple SSH connection failures detected',
        errorTypes: [ErrorType.SSH_CONNECTION_ERROR],
        conditions: {
          threshold: 5,
          timeWindow: 300000, // 5 minutes
          operator: 'gte'
        },
        alertLevel: AlertLevel.ERROR,
        recoveryActions: [RecoveryAction.CONNECTION_POOL_RESET, RecoveryAction.CIRCUIT_BREAKER_RESET],
        cooldownPeriod: 900000, // 15 minutes
        enabled: true
      },
      {
        id: 'circuit_breaker_open',
        name: 'Circuit Breaker Open',
        description: 'Circuit breaker has opened due to failures',
        errorTypes: [ErrorType.CIRCUIT_BREAKER_ERROR],
        conditions: {
          threshold: 1,
          timeWindow: 60000, // 1 minute
          operator: 'gte'
        },
        alertLevel: AlertLevel.WARNING,
        recoveryActions: [RecoveryAction.CIRCUIT_BREAKER_RESET],
        cooldownPeriod: 300000, // 5 minutes
        enabled: true
      },
      {
        id: 'security_errors',
        name: 'Security Errors',
        description: 'Security-related errors detected',
        errorTypes: [ErrorType.SECURITY_ERROR, ErrorType.SSH_AUTHENTICATION_ERROR],
        conditions: {
          threshold: 3,
          timeWindow: 300000, // 5 minutes
          operator: 'gte'
        },
        alertLevel: AlertLevel.CRITICAL,
        recoveryActions: [RecoveryAction.NONE], // Manual intervention required
        cooldownPeriod: 1800000, // 30 minutes
        enabled: true
      }
    ];

    for (const rule of defaultRules) {
      this.alertRules.set(rule.id, rule);
    }
  }

  private startMonitoring(): void {
    if (!this.config.enabled) return;

    // Cleanup old data periodically
    setInterval(() => {
      this.cleanupOldData();
    }, 3600000); // Every hour
  }

  private cleanupOldData(): void {
    const now = Date.now();
    
    // Clean old errors
    const errorRetentionTime = this.config.metricsRetentionDays * 24 * 60 * 60 * 1000;
    this.recentErrors = this.recentErrors.filter(
      e => (now - e.timestamp.getTime()) < errorRetentionTime
    );

    // Clean old alerts
    const alertRetentionTime = this.config.alertRetentionDays * 24 * 60 * 60 * 1000;
    this.alertHistory = this.alertHistory.filter(
      alert => (now - alert.timestamp.getTime()) < alertRetentionTime
    );

    this.lastCleanup = now;
  }

  /**
   * Get comprehensive error analysis using MCP workflow
   */
  async getErrorAnalysis(
    errorType: ErrorType,
    context: ErrorContext
  ): Promise<{
    analysis: string;
    mcpWorkflow: string;
    suggestedActions: string[];
  }> {
    const analysisPrompt = this.buildErrorAnalysisPrompt(errorType, context);
    
    return {
      analysis: `Use MCP ecosystem for comprehensive error analysis`,
      mcpWorkflow: analysisPrompt,
      suggestedActions: [
        'Execute the MCP workflow prompt for detailed error analysis',
        'Use websearch MCP to find similar error patterns and solutions',
        'Use github MCP to find community solutions and best practices'
      ]
    };
  }

  /**
   * Get intelligent monitoring insights using MCP workflow
   */
  async getMonitoringInsights(): Promise<{
    insights: string;
    mcpWorkflow: string;
    recommendations: string[];
  }> {
    const stats = this.getMonitoringStatistics();
    const insightsPrompt = this.buildMonitoringInsightsPrompt(stats);
    
    return {
      insights: 'Use MCP ecosystem for intelligent monitoring insights',
      mcpWorkflow: insightsPrompt,
      recommendations: [
        'Execute the MCP workflow prompt for monitoring insights',
        'Use websearch MCP to research industry monitoring best practices',
        'Use github MCP to find monitoring patterns from successful projects'
      ]
    };
  }

  // Private helper methods for MCP workflow prompts

  private buildRecoveryPrompt(action: RecoveryAction, alert: ErrorAlert): string {
    return `
🔧 **Error Recovery Workflow Request**

**Alert**: ${alert.title}
**Error Type**: ${alert.errorType}
**Recovery Action**: ${action}
**Impact Score**: ${alert.metrics.impactScore}
**Affected Sessions**: ${alert.metrics.affectedSessions.size}

**MCP Workflow for Recovery Analysis**:
1. **Use websearch MCP** to research recovery strategies:
   - Search: "${alert.errorType} recovery best practices"
   - Look for industry solutions and case studies
   - Find proven recovery patterns

2. **Use github MCP** to find recovery implementations:
   - Search repositories for ${action} implementations
   - Look for error handling patterns
   - Find automated recovery scripts

3. **Use fetch MCP** for official documentation:
   - Get documentation for relevant services/tools
   - Check for official recovery procedures
   - Verify best practices

**Expected Recovery Output**:
- Step-by-step recovery procedure
- Preventive measures to avoid recurrence
- Monitoring improvements
- Risk assessment of recovery actions

Please execute this workflow using available MCPs for comprehensive recovery guidance.
    `.trim();
  }

  private buildErrorAnalysisPrompt(errorType: ErrorType, context: ErrorContext): string {
    return `
🔍 **Error Analysis Request**

**Error Type**: ${errorType}
**Timestamp**: ${context.timestamp.toISOString()}
**Session ID**: ${context.sessionId || 'N/A'}
**Host**: ${context.host || 'N/A'}
**Command**: ${context.command || 'N/A'}
**Service**: ${context.service || 'N/A'}
**Metadata**: ${JSON.stringify(context.metadata, null, 2)}

**MCP Workflow for Error Analysis**:
1. **Use websearch MCP** for error pattern research:
   - Search: "${errorType} common causes solutions"
   - Look for Stack Overflow discussions
   - Find troubleshooting guides

2. **Use github MCP** for code pattern analysis:
   - Search repositories with similar error handling
   - Look for issue discussions and solutions
   - Find error prevention patterns

3. **Use fetch MCP** for official documentation:
   - Get official error documentation
   - Check for known issues and workarounds
   - Verify error classification

4. **Use memory MCP** to store insights:
   - Store analysis results for future reference
   - Build knowledge base of error patterns
   - Track resolution effectiveness

**Expected Analysis Output**:
- Root cause analysis
- Contributing factors
- Resolution strategies
- Prevention recommendations
- Related error patterns

Please analyze this error using the available MCPs.
    `.trim();
  }

  private buildMonitoringInsightsPrompt(stats: any): string {
    return `
📊 **Monitoring Insights Request**

**Current Statistics**:
- Total Errors: ${stats.totalErrors}
- Active Alerts: ${stats.activeAlertsCount}
- System Health: ${stats.systemHealth.overallStatus}
- Error Rate: ${stats.systemHealth.errorRate.toFixed(2)} errors/min
- Top Errors: ${JSON.stringify(stats.systemHealth.topErrors, null, 2)}

**MCP Workflow for Monitoring Insights**:
1. **Use websearch MCP** for monitoring benchmarks:
   - Search: "SSH server monitoring best practices industry standards"
   - Look for performance benchmarks
   - Find industry monitoring patterns

2. **Use github MCP** for monitoring solutions:
   - Search repositories for monitoring implementations
   - Look for alerting strategies
   - Find dashboard and visualization patterns

3. **Use fetch MCP** for monitoring documentation:
   - Get official monitoring guides
   - Check for recommended metrics
   - Verify alerting best practices

4. **Use sqlite MCP** for trend analysis:
   - Store historical monitoring data
   - Analyze error trends over time
   - Track system performance metrics

**Expected Insights Output**:
- Performance trend analysis
- Optimization recommendations
- Alerting strategy improvements
- Capacity planning insights
- Industry benchmark comparisons

Please generate monitoring insights using the available MCPs.
    `.trim();
  }
}