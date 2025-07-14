import { createHash } from 'crypto';
import { EventEmitter } from 'events';
import { writeFile, appendFile, mkdir } from 'fs/promises';
import { join } from 'path';

export enum AuditEventType {
  // Authentication Events
  AUTH_SUCCESS = 'auth_success',
  AUTH_FAILURE = 'auth_failure',
  AUTH_LOCKOUT = 'auth_lockout',
  MFA_SUCCESS = 'mfa_success',
  MFA_FAILURE = 'mfa_failure',
  PASSWORD_CHANGE = 'password_change',
  
  // Session Events
  SESSION_START = 'session_start',
  SESSION_END = 'session_end',
  SESSION_TIMEOUT = 'session_timeout',
  SESSION_HIJACK_ATTEMPT = 'session_hijack_attempt',
  
  // SSH Events
  SSH_CONNECTION_ESTABLISHED = 'ssh_connection_established',
  SSH_CONNECTION_FAILED = 'ssh_connection_failed',
  SSH_CONNECTION_CLOSED = 'ssh_connection_closed',
  SSH_COMMAND_EXECUTED = 'ssh_command_executed',
  SSH_FILE_TRANSFER = 'ssh_file_transfer',
  SSH_TUNNEL_CREATED = 'ssh_tunnel_created',
  
  // System Events
  SERVER_START = 'server_start',
  SERVER_STOP = 'server_stop',
  CONFIG_CHANGE = 'config_change',
  SECURITY_POLICY_CHANGE = 'security_policy_change',
  
  // Security Events
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  UNAUTHORIZED_ACCESS_ATTEMPT = 'unauthorized_access_attempt',
  DATA_BREACH_ATTEMPT = 'data_breach_attempt',
  COMPLIANCE_VIOLATION = 'compliance_violation',
  
  // Administrative Events
  USER_CREATED = 'user_created',
  USER_DELETED = 'user_deleted',
  USER_MODIFIED = 'user_modified',
  ROLE_ASSIGNED = 'role_assigned',
  PERMISSION_GRANTED = 'permission_granted',
  PERMISSION_REVOKED = 'permission_revoked',
  
  // Credential Events
  CREDENTIAL_STORED = 'credential_stored',
  CREDENTIAL_ACCESS_FAILED = 'credential_access_failed',
  CREDENTIAL_ROTATED = 'credential_rotated',
  CREDENTIAL_ROTATION_FAILED = 'credential_rotation_failed',
  CREDENTIAL_DELETED = 'credential_deleted'
}

export enum AuditSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ComplianceStandard {
  SOC2 = 'soc2',
  GDPR = 'gdpr',
  HIPAA = 'hipaa',
  PCI_DSS = 'pci_dss',
  NIST = 'nist',
  ISO27001 = 'iso27001'
}

export interface AuditEvent {
  // Core Event Data
  eventId: string;
  timestamp: Date;
  eventType: AuditEventType;
  severity: AuditSeverity;
  
  // Actor Information
  userId?: string;
  sessionId?: string;
  clientIp?: string;
  userAgent?: string;
  
  // Target Information
  targetUserId?: string;
  targetResource?: string;
  targetHost?: string;
  
  // Event Details
  description: string;
  outcome: 'success' | 'failure' | 'unknown';
  details: Record<string, any>;
  
  // Security Context
  riskScore?: number;
  threatVector?: string;
  mitigationAction?: string;
  
  // Compliance Tracking
  complianceStandards: ComplianceStandard[];
  retentionPeriod: number; // days
  
  // Integrity
  checksum: string;
  previousEventHash?: string;
}

export interface AuditConfig {
  enabled: boolean;
  logLevel: AuditSeverity;
  outputFormat: 'json' | 'syslog' | 'csv';
  storage: {
    local: {
      enabled: boolean;
      directory: string;
      maxFileSize: number; // bytes
      maxFiles: number;
      compression: boolean;
    };
    remote: {
      enabled: boolean;
      endpoint?: string;
      apiKey?: string;
      batchSize: number;
      flushInterval: number; // ms
    };
    database: {
      enabled: boolean;
      connectionString?: string;
      tableName: string;
    };
  };
  compliance: {
    standards: ComplianceStandard[];
    retentionPeriod: number; // days
    encryption: boolean;
    digitalSigning: boolean;
  };
  alerting: {
    enabled: boolean;
    criticalEventsOnly: boolean;
    webhookUrl?: string;
    emailEndpoint?: string;
    slackWebhook?: string;
  };
}

export class AuditLogger extends EventEmitter {
  private config: AuditConfig;
  private eventChain: string[] = []; // For integrity chain
  private pendingEvents: AuditEvent[] = []; // For batch processing
  private flushTimer?: NodeJS.Timeout;

  constructor(config: Partial<AuditConfig> = {}) {
    super();
    
    this.config = {
      enabled: true,
      logLevel: AuditSeverity.MEDIUM,
      outputFormat: 'json',
      storage: {
        local: {
          enabled: true,
          directory: './logs/audit',
          maxFileSize: 100 * 1024 * 1024, // 100MB
          maxFiles: 10,
          compression: true
        },
        remote: {
          enabled: false,
          batchSize: 100,
          flushInterval: 30000 // 30 seconds
        },
        database: {
          enabled: false,
          tableName: 'audit_events'
        }
      },
      compliance: {
        standards: [ComplianceStandard.SOC2, ComplianceStandard.GDPR],
        retentionPeriod: 2555, // 7 years for SOC2
        encryption: true,
        digitalSigning: true
      },
      alerting: {
        enabled: true,
        criticalEventsOnly: true
      },
      ...config
    };

    // Setup batch processing
    if (this.config.storage.remote.enabled) {
      this.setupBatchProcessing();
    }

    // Setup local storage
    if (this.config.storage.local.enabled) {
      this.ensureLogDirectory();
    }
  }

  /**
   * Log an audit event
   */
  async logEvent(
    eventType: AuditEventType,
    details: {
      userId?: string;
      sessionId?: string;
      clientIp?: string;
      userAgent?: string;
      targetUserId?: string;
      targetResource?: string;
      targetHost?: string;
      description: string;
      outcome: 'success' | 'failure' | 'unknown';
      eventDetails?: Record<string, any>;
      riskScore?: number;
      threatVector?: string;
      customStandards?: ComplianceStandard[];
    }
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const severity = this.determineSeverity(eventType, details.riskScore);
    
    // Skip if below configured log level
    if (this.severityToNumber(severity) < this.severityToNumber(this.config.logLevel)) {
      return;
    }

    const event = this.createAuditEvent(eventType, severity, details);
    
    // Add to event chain for integrity
    this.addToEventChain(event);
    
    // Store the event
    await this.storeEvent(event);
    
    // Send alerts if needed
    if (this.shouldAlert(event)) {
      await this.sendAlert(event);
    }

    // Emit event for real-time processing
    this.emit('audit_event', event);
  }

  /**
   * Log authentication events
   */
  async logAuthentication(
    success: boolean,
    userId: string,
    authMethod: string,
    context: {
      sessionId?: string;
      clientIp?: string;
      userAgent?: string;
      mfaMethod?: string;
      failureReason?: string;
    }
  ): Promise<void> {
    const eventType = success ? AuditEventType.AUTH_SUCCESS : AuditEventType.AUTH_FAILURE;
    const outcome = success ? 'success' : 'failure';
    
    await this.logEvent(eventType, {
      userId,
      sessionId: context.sessionId,
      clientIp: context.clientIp,
      userAgent: context.userAgent,
      description: `User authentication ${success ? 'succeeded' : 'failed'} using ${authMethod}`,
      outcome,
      eventDetails: {
        authMethod,
        mfaMethod: context.mfaMethod,
        failureReason: context.failureReason
      },
      riskScore: success ? 1 : 7
    });
  }

  /**
   * Log SSH command execution
   */
  async logSSHCommand(
    userId: string,
    sessionId: string,
    command: string,
    exitCode: number,
    context: {
      host: string;
      workingDirectory?: string;
      executionTime?: number;
      outputSize?: number;
    }
  ): Promise<void> {
    const isPrivileged = this.isPrivilegedCommand(command);
    const riskScore = this.calculateCommandRiskScore(command, exitCode, isPrivileged);
    
    await this.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
      userId,
      sessionId,
      targetHost: context.host,
      description: `SSH command executed: ${command.substring(0, 100)}${command.length > 100 ? '...' : ''}`,
      outcome: exitCode === 0 ? 'success' : 'failure',
      eventDetails: {
        command: this.shouldRedactCommand(command) ? '[REDACTED]' : command,
        exitCode,
        workingDirectory: context.workingDirectory,
        executionTime: context.executionTime,
        outputSize: context.outputSize,
        isPrivileged
      },
      riskScore
    });
  }

  /**
   * Log file transfer operations
   */
  async logFileTransfer(
    userId: string,
    sessionId: string,
    operation: 'upload' | 'download',
    localPath: string,
    remotePath: string,
    context: {
      host: string;
      fileSize?: number;
      transferTime?: number;
      success: boolean;
      errorMessage?: string;
    }
  ): Promise<void> {
    const riskScore = this.calculateFileTransferRiskScore(operation, remotePath, context.fileSize);
    
    await this.logEvent(AuditEventType.SSH_FILE_TRANSFER, {
      userId,
      sessionId,
      targetHost: context.host,
      description: `File ${operation}: ${localPath} ${operation === 'upload' ? 'to' : 'from'} ${remotePath}`,
      outcome: context.success ? 'success' : 'failure',
      eventDetails: {
        operation,
        localPath: this.sanitizePath(localPath),
        remotePath: this.sanitizePath(remotePath),
        fileSize: context.fileSize,
        transferTime: context.transferTime,
        errorMessage: context.errorMessage
      },
      riskScore
    });
  }

  /**
   * Log session lifecycle events
   */
  async logSessionEvent(
    eventType: AuditEventType.SESSION_START | AuditEventType.SESSION_END | AuditEventType.SESSION_TIMEOUT,
    userId: string,
    sessionId: string,
    context: {
      clientIp?: string;
      userAgent?: string;
      duration?: number;
      commandCount?: number;
      dataTransferred?: number;
    }
  ): Promise<void> {
    await this.logEvent(eventType, {
      userId,
      sessionId,
      clientIp: context.clientIp,
      userAgent: context.userAgent,
      description: `User session ${eventType.replace('session_', '')}`,
      outcome: 'success',
      eventDetails: {
        duration: context.duration,
        commandCount: context.commandCount,
        dataTransferred: context.dataTransferred
      },
      riskScore: 1
    });
  }

  /**
   * Log security events
   */
  async logSecurityEvent(
    eventType: AuditEventType,
    description: string,
    context: {
      userId?: string;
      sessionId?: string;
      clientIp?: string;
      threatVector?: string;
      mitigationAction?: string;
      riskScore: number;
      details?: Record<string, any>;
    }
  ): Promise<void> {
    await this.logEvent(eventType, {
      userId: context.userId,
      sessionId: context.sessionId,
      clientIp: context.clientIp,
      description,
      outcome: 'unknown',
      eventDetails: context.details || {},
      riskScore: context.riskScore,
      threatVector: context.threatVector
    });
  }

  /**
   * Query audit events with filtering
   */
  async queryEvents(filter: {
    startDate?: Date;
    endDate?: Date;
    userId?: string;
    eventType?: AuditEventType;
    severity?: AuditSeverity;
    outcome?: 'success' | 'failure' | 'unknown';
    limit?: number;
    offset?: number;
  }): Promise<AuditEvent[]> {
    // This would typically query from database or search through log files
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    standard: ComplianceStandard,
    startDate: Date,
    endDate: Date
  ): Promise<{
    standard: ComplianceStandard;
    period: { start: Date; end: Date };
    totalEvents: number;
    eventsByType: Record<string, number>;
    securityIncidents: number;
    complianceViolations: number;
    summary: string;
  }> {
    const events = await this.queryEvents({ startDate, endDate });
    
    // Filter events relevant to compliance standard
    const relevantEvents = events.filter(event => 
      event.complianceStandards.includes(standard)
    );

    const eventsByType = relevantEvents.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const securityIncidents = relevantEvents.filter(event => 
      event.severity === AuditSeverity.HIGH || event.severity === AuditSeverity.CRITICAL
    ).length;

    const complianceViolations = relevantEvents.filter(event => 
      event.eventType === AuditEventType.COMPLIANCE_VIOLATION
    ).length;

    return {
      standard,
      period: { start: startDate, end: endDate },
      totalEvents: relevantEvents.length,
      eventsByType,
      securityIncidents,
      complianceViolations,
      summary: `Compliance report for ${standard} covering ${relevantEvents.length} events with ${securityIncidents} security incidents`
    };
  }

  // Private helper methods

  private createAuditEvent(
    eventType: AuditEventType,
    severity: AuditSeverity,
    details: any
  ): AuditEvent {
    const eventId = this.generateEventId();
    const timestamp = new Date();
    
    const event: AuditEvent = {
      eventId,
      timestamp,
      eventType,
      severity,
      userId: details.userId,
      sessionId: details.sessionId,
      clientIp: details.clientIp,
      userAgent: details.userAgent,
      targetUserId: details.targetUserId,
      targetResource: details.targetResource,
      targetHost: details.targetHost,
      description: details.description,
      outcome: details.outcome,
      details: details.eventDetails || {},
      riskScore: details.riskScore,
      threatVector: details.threatVector,
      mitigationAction: details.mitigationAction,
      complianceStandards: details.customStandards || this.config.compliance.standards,
      retentionPeriod: this.config.compliance.retentionPeriod,
      checksum: '',
      previousEventHash: this.eventChain[this.eventChain.length - 1]
    };

    // Calculate checksum
    event.checksum = this.calculateEventChecksum(event);
    
    return event;
  }

  private determineSeverity(eventType: AuditEventType, riskScore?: number): AuditSeverity {
    // Use risk score if provided
    if (riskScore !== undefined) {
      if (riskScore >= 9) return AuditSeverity.CRITICAL;
      if (riskScore >= 7) return AuditSeverity.HIGH;
      if (riskScore >= 4) return AuditSeverity.MEDIUM;
      return AuditSeverity.LOW;
    }

    // Default severity based on event type
    const criticalEvents = [
      AuditEventType.DATA_BREACH_ATTEMPT,
      AuditEventType.PRIVILEGE_ESCALATION,
      AuditEventType.SESSION_HIJACK_ATTEMPT
    ];
    
    const highEvents = [
      AuditEventType.AUTH_LOCKOUT,
      AuditEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
      AuditEventType.SUSPICIOUS_ACTIVITY
    ];

    if (criticalEvents.includes(eventType)) return AuditSeverity.CRITICAL;
    if (highEvents.includes(eventType)) return AuditSeverity.HIGH;
    
    return AuditSeverity.MEDIUM;
  }

  private severityToNumber(severity: AuditSeverity): number {
    switch (severity) {
      case AuditSeverity.LOW: return 1;
      case AuditSeverity.MEDIUM: return 2;
      case AuditSeverity.HIGH: return 3;
      case AuditSeverity.CRITICAL: return 4;
    }
  }

  private addToEventChain(event: AuditEvent): void {
    this.eventChain.push(event.checksum);
    
    // Keep only recent events in memory (last 1000)
    if (this.eventChain.length > 1000) {
      this.eventChain = this.eventChain.slice(-1000);
    }
  }

  private async storeEvent(event: AuditEvent): Promise<void> {
    const promises: Promise<void>[] = [];

    // Local storage
    if (this.config.storage.local.enabled) {
      promises.push(this.storeEventLocal(event));
    }

    // Remote storage (batched)
    if (this.config.storage.remote.enabled) {
      this.pendingEvents.push(event);
    }

    // Database storage
    if (this.config.storage.database.enabled) {
      promises.push(this.storeEventDatabase(event));
    }

    await Promise.all(promises);
  }

  private async storeEventLocal(event: AuditEvent): Promise<void> {
    const logDir = this.config.storage.local.directory;
    const logFile = join(logDir, `audit-${new Date().toISOString().split('T')[0]}.log`);
    
    const logEntry = this.formatEventForStorage(event) + '\n';
    
    try {
      await appendFile(logFile, logEntry, 'utf8');
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }

  private async storeEventDatabase(event: AuditEvent): Promise<void> {
    // Database storage implementation would go here
    // This is a placeholder for actual database integration
    console.log('Storing event to database:', event.eventId);
  }

  private formatEventForStorage(event: AuditEvent): string {
    switch (this.config.outputFormat) {
      case 'json':
        return JSON.stringify(event);
      case 'syslog':
        return this.formatSyslog(event);
      case 'csv':
        return this.formatCSV(event);
      default:
        return JSON.stringify(event);
    }
  }

  private formatSyslog(event: AuditEvent): string {
    const timestamp = event.timestamp.toISOString();
    const facility = 16; // local0
    const severityMap = { low: 7, medium: 6, high: 4, critical: 2 };
    const priority = facility * 8 + severityMap[event.severity];
    
    return `<${priority}>${timestamp} ssh-mcp audit[${process.pid}]: ${event.eventType} - ${event.description}`;
  }

  private formatCSV(event: AuditEvent): string {
    const fields = [
      event.timestamp.toISOString(),
      event.eventType,
      event.severity,
      event.userId || '',
      event.outcome,
      `"${event.description.replace(/"/g, '""')}"`,
      event.riskScore || 0
    ];
    
    return fields.join(',');
  }

  private setupBatchProcessing(): void {
    this.flushTimer = setInterval(() => {
      this.flushPendingEvents();
    }, this.config.storage.remote.flushInterval);
  }

  private async flushPendingEvents(): Promise<void> {
    if (this.pendingEvents.length === 0) {
      return;
    }

    const eventsToFlush = this.pendingEvents.splice(0, this.config.storage.remote.batchSize);
    
    try {
      // Send to remote endpoint
      if (this.config.storage.remote.endpoint) {
        await this.sendToRemoteEndpoint(eventsToFlush);
      }
    } catch (error) {
      console.error('Failed to flush events to remote storage:', error);
      // Re-add failed events to pending queue
      this.pendingEvents.unshift(...eventsToFlush);
    }
  }

  private async sendToRemoteEndpoint(events: AuditEvent[]): Promise<void> {
    // Remote endpoint integration would go here
    console.log(`Sending ${events.length} events to remote endpoint`);
  }

  private shouldAlert(event: AuditEvent): boolean {
    if (!this.config.alerting.enabled) {
      return false;
    }

    if (this.config.alerting.criticalEventsOnly) {
      return event.severity === AuditSeverity.CRITICAL;
    }

    return event.severity === AuditSeverity.HIGH || event.severity === AuditSeverity.CRITICAL;
  }

  private async sendAlert(event: AuditEvent): Promise<void> {
    const alertMessage = `Security Alert: ${event.eventType} - ${event.description}`;
    
    // Send webhook alert
    if (this.config.alerting.webhookUrl) {
      // Webhook implementation
    }

    // Send email alert
    if (this.config.alerting.emailEndpoint) {
      // Email implementation
    }

    // Send Slack alert
    if (this.config.alerting.slackWebhook) {
      // Slack implementation
    }

    console.log(`Alert sent: ${alertMessage}`);
  }

  private async ensureLogDirectory(): Promise<void> {
    try {
      await mkdir(this.config.storage.local.directory, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateEventChecksum(event: AuditEvent): string {
    const data = JSON.stringify({
      ...event,
      checksum: undefined // Exclude checksum from checksum calculation
    });
    
    return createHash('sha256').update(data).digest('hex');
  }

  private isPrivilegedCommand(command: string): boolean {
    const privilegedCommands = ['sudo', 'su', 'passwd', 'chmod', 'chown', 'mount', 'umount'];
    return privilegedCommands.some(cmd => command.toLowerCase().includes(cmd));
  }

  private shouldRedactCommand(command: string): boolean {
    const sensitivePatterns = [
      /password\s*=\s*[^\s]+/i,
      /api[_-]?key\s*=\s*[^\s]+/i,
      /token\s*=\s*[^\s]+/i,
      /secret\s*=\s*[^\s]+/i
    ];
    
    return sensitivePatterns.some(pattern => pattern.test(command));
  }

  private calculateCommandRiskScore(command: string, exitCode: number, isPrivileged: boolean): number {
    let score = 1;
    
    if (isPrivileged) score += 3;
    if (exitCode !== 0) score += 2;
    if (command.includes('rm') || command.includes('delete')) score += 2;
    if (command.includes('curl') || command.includes('wget')) score += 1;
    
    return Math.min(score, 10);
  }

  private calculateFileTransferRiskScore(operation: string, path: string, fileSize?: number): number {
    let score = 1;
    
    if (operation === 'download') score += 1;
    if (path.includes('/etc/') || path.includes('/root/')) score += 3;
    if (fileSize && fileSize > 100 * 1024 * 1024) score += 2; // > 100MB
    if (path.includes('.ssh/') || path.includes('private')) score += 3;
    
    return Math.min(score, 10);
  }

  private sanitizePath(path: string): string {
    // Remove sensitive information from paths while keeping useful context
    return path.replace(/\/home\/[^\/]+/, '/home/[USER]')
               .replace(/\/Users\/[^\/]+/, '/Users/[USER]');
  }
}