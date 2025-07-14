/**
 * Structured Error Types for SSH MCP Server
 * Provides type-safe, categorized error handling with context and recovery guidance
 */

export enum ErrorCategory {
  CONNECTION = 'connection',
  AUTHENTICATION = 'authentication', 
  AUTHORIZATION = 'authorization',
  COMMAND_EXECUTION = 'command_execution',
  FILE_TRANSFER = 'file_transfer',
  SESSION_MANAGEMENT = 'session_management',
  NETWORK = 'network',
  SYSTEM = 'system',
  CONFIGURATION = 'configuration',
  RATE_LIMITING = 'rate_limiting',
  SECURITY = 'security'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium', 
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum RecoveryStrategy {
  RETRY = 'retry',
  RECONNECT = 'reconnect',
  REAUTHENTICATE = 'reauthenticate',
  ESCALATE = 'escalate',
  ABORT = 'abort',
  USER_ACTION_REQUIRED = 'user_action_required'
}

export interface ErrorContext {
  sessionId?: string;
  userId?: string;
  host?: string;
  command?: string;
  filePath?: string;
  timestamp: Date;
  requestId?: string;
  username?: string;
  timeout?: number;
  attempts?: number;
  additionalData?: Record<string, any>;
}

export interface RecoveryInfo {
  strategy: RecoveryStrategy;
  retryable: boolean;
  maxRetries?: number;
  retryDelay?: number;
  userMessage: string;
  technicalDetails: string;
}

/**
 * Base SSH Error class providing structured error handling
 */
export abstract class SSHError extends Error {
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly errorCode: string;
  readonly context: ErrorContext;
  readonly recovery: RecoveryInfo;
  readonly timestamp: Date;

  constructor(
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity,
    errorCode: string,
    context: Partial<ErrorContext> = {},
    recovery: Partial<RecoveryInfo> = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    
    this.category = category;
    this.severity = severity;
    this.errorCode = errorCode;
    this.timestamp = new Date();
    
    this.context = {
      timestamp: this.timestamp,
      ...context
    };

    this.recovery = {
      strategy: RecoveryStrategy.ABORT,
      retryable: false,
      userMessage: 'An error occurred. Please try again or contact support.',
      technicalDetails: message,
      ...recovery
    };

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON for logging/transmission
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      category: this.category,
      severity: this.severity,
      errorCode: this.errorCode,
      context: this.context,
      recovery: this.recovery,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    return this.recovery.userMessage;
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    return this.recovery.retryable;
  }

  /**
   * Get recommended retry delay in milliseconds
   */
  getRetryDelay(): number {
    return this.recovery.retryDelay || 1000;
  }
}

// Connection Errors
export class SSHConnectionError extends SSHError {
  constructor(
    message: string,
    host: string,
    port?: number,
    underlyingError?: Error,
    context: Partial<ErrorContext> = {}
  ) {
    super(
      message,
      ErrorCategory.CONNECTION,
      ErrorSeverity.HIGH,
      'SSH_CONNECTION_FAILED',
      { host, ...context },
      {
        strategy: RecoveryStrategy.RECONNECT,
        retryable: true,
        maxRetries: 3,
        retryDelay: 5000,
        userMessage: `Failed to connect to ${host}${port ? `:${port}` : ''}. Please check the server status and network connectivity.`,
        technicalDetails: `SSH connection failed: ${message}${underlyingError ? ` (${underlyingError.message})` : ''}`
      }
    );

    if (underlyingError) {
      this.context.additionalData = { underlyingError: underlyingError.message };
    }
  }
}

export class SSHConnectionTimeoutError extends SSHConnectionError {
  constructor(host: string, timeout: number, context: Partial<ErrorContext> = {}) {
    super(
      `Connection to ${host} timed out after ${timeout}ms`,
      host,
      undefined,
      undefined,
      context
    );
    // Use object assign to override readonly property
    Object.assign(this, { errorCode: 'SSH_CONNECTION_TIMEOUT' });
    this.recovery.userMessage = `Connection to ${host} timed out. The server may be overloaded or unreachable.`;
  }
}

export class SSHNetworkError extends SSHError {
  constructor(
    message: string,
    host: string,
    networkError?: Error,
    context: Partial<ErrorContext> = {}
  ) {
    super(
      message,
      ErrorCategory.NETWORK,
      ErrorSeverity.HIGH,
      'SSH_NETWORK_ERROR',
      { host, ...context },
      {
        strategy: RecoveryStrategy.RETRY,
        retryable: true,
        maxRetries: 2,
        retryDelay: 3000,
        userMessage: `Network error connecting to ${host}. Please check your internet connection.`,
        technicalDetails: `Network error: ${message}`
      }
    );

    if (networkError) {
      this.context.additionalData = { networkError: networkError.message };
    }
  }
}

// Authentication Errors
export class SSHAuthenticationError extends SSHError {
  constructor(
    message: string,
    authMethod: string,
    userId?: string,
    context: Partial<ErrorContext> = {}
  ) {
    super(
      message,
      ErrorCategory.AUTHENTICATION,
      ErrorSeverity.HIGH,
      'SSH_AUTH_FAILED',
      { userId, ...context },
      {
        strategy: RecoveryStrategy.REAUTHENTICATE,
        retryable: false,
        userMessage: 'Authentication failed. Please check your credentials and try again.',
        technicalDetails: `SSH authentication failed using ${authMethod}: ${message}`
      }
    );

    this.context.additionalData = { authMethod };
  }
}

export class SSHCredentialsInvalidError extends SSHAuthenticationError {
  constructor(authMethod: string, userId?: string, context: Partial<ErrorContext> = {}) {
    super('Invalid credentials provided', authMethod, userId, context);
    Object.assign(this, { errorCode: 'SSH_INVALID_CREDENTIALS' });
    this.recovery.userMessage = 'The provided credentials are invalid. Please verify your username and password/key.';
  }
}

export class SSHMFARequiredError extends SSHError {
  constructor(userId: string, availableMethods: string[], context: Partial<ErrorContext> = {}) {
    super(
      'Multi-factor authentication required',
      ErrorCategory.AUTHENTICATION,
      ErrorSeverity.MEDIUM,
      'SSH_MFA_REQUIRED',
      { userId, ...context },
      {
        strategy: RecoveryStrategy.USER_ACTION_REQUIRED,
        retryable: false,
        userMessage: `Multi-factor authentication is required. Available methods: ${availableMethods.join(', ')}`,
        technicalDetails: 'MFA challenge must be completed before proceeding'
      }
    );

    this.context.additionalData = { availableMethods };
  }
}

export class SSHAccountLockedError extends SSHError {
  constructor(userId: string, unlockTime?: Date, context: Partial<ErrorContext> = {}) {
    super(
      `Account ${userId} is locked`,
      ErrorCategory.AUTHENTICATION,
      ErrorSeverity.HIGH,
      'SSH_ACCOUNT_LOCKED',
      { userId, ...context },
      {
        strategy: RecoveryStrategy.USER_ACTION_REQUIRED,
        retryable: false,
        userMessage: unlockTime 
          ? `Account is locked until ${unlockTime.toLocaleString()}. Please try again later.`
          : 'Account is locked due to multiple failed authentication attempts. Please contact support.',
        technicalDetails: `Account locked due to security policy violation`
      }
    );

    if (unlockTime) {
      this.context.additionalData = { unlockTime: unlockTime.toISOString() };
    }
  }
}

// Session Management Errors
export class SSHSessionError extends SSHError {
  constructor(
    message: string,
    sessionId: string,
    errorCode: string = 'SSH_SESSION_ERROR',
    context: Partial<ErrorContext> = {}
  ) {
    super(
      message,
      ErrorCategory.SESSION_MANAGEMENT,
      ErrorSeverity.MEDIUM,
      errorCode,
      { sessionId, ...context },
      {
        strategy: RecoveryStrategy.RECONNECT,
        retryable: true,
        maxRetries: 1,
        userMessage: 'Session error occurred. A new session will be created.',
        technicalDetails: `Session error: ${message}`
      }
    );
  }
}

export class SSHSessionNotFoundError extends SSHSessionError {
  constructor(sessionId: string, context: Partial<ErrorContext> = {}) {
    super(
      `Session ${sessionId} not found`,
      sessionId,
      'SSH_SESSION_NOT_FOUND',
      context
    );
    this.recovery.userMessage = 'Session not found. Please create a new session.';
    this.recovery.retryable = false;
  }
}

export class SSHSessionExpiredError extends SSHSessionError {
  constructor(sessionId: string, context: Partial<ErrorContext> = {}) {
    super(
      `Session ${sessionId} has expired`,
      sessionId,
      'SSH_SESSION_EXPIRED',
      context
    );
    this.recovery.userMessage = 'Session has expired. Please authenticate again.';
    this.recovery.strategy = RecoveryStrategy.REAUTHENTICATE;
  }
}

// Command Execution Errors
export class SSHCommandError extends SSHError {
  constructor(
    message: string,
    command: string,
    exitCode?: number,
    stderr?: string,
    context: Partial<ErrorContext> = {}
  ) {
    super(
      message,
      ErrorCategory.COMMAND_EXECUTION,
      ErrorSeverity.MEDIUM,
      'SSH_COMMAND_FAILED',
      { command, ...context },
      {
        strategy: RecoveryStrategy.RETRY,
        retryable: true,
        maxRetries: 1,
        userMessage: `Command failed: ${command.length > 50 ? command.substring(0, 50) + '...' : command}`,
        technicalDetails: `Command execution failed: ${message}`
      }
    );

    this.context.additionalData = { 
      exitCode, 
      stderr: stderr?.substring(0, 1000) // Limit stderr length
    };
  }
}

export class SSHCommandTimeoutError extends SSHCommandError {
  constructor(command: string, timeout: number, context: Partial<ErrorContext> = {}) {
    super(
      `Command timed out after ${timeout}ms`,
      command,
      undefined,
      undefined,
      context
    );
    Object.assign(this, { errorCode: 'SSH_COMMAND_TIMEOUT' });
    this.recovery.userMessage = 'Command execution timed out. Try running a simpler command or increase the timeout.';
    this.recovery.retryable = false;
  }
}

export class SSHPermissionDeniedError extends SSHError {
  constructor(
    resource: string,
    operation: string,
    userId?: string,
    context: Partial<ErrorContext> = {}
  ) {
    super(
      `Permission denied for ${operation} on ${resource}`,
      ErrorCategory.AUTHORIZATION,
      ErrorSeverity.HIGH,
      'SSH_PERMISSION_DENIED',
      { userId, ...context },
      {
        strategy: RecoveryStrategy.ESCALATE,
        retryable: false,
        userMessage: `You don't have permission to ${operation} ${resource}. Please check your access rights.`,
        technicalDetails: `Permission denied: insufficient privileges for ${operation}`
      }
    );

    this.context.additionalData = { resource, operation };
  }
}

// File Transfer Errors
export class SSHFileTransferError extends SSHError {
  constructor(
    message: string,
    operation: 'upload' | 'download',
    localPath?: string,
    remotePath?: string,
    context: Partial<ErrorContext> = {}
  ) {
    super(
      message,
      ErrorCategory.FILE_TRANSFER,
      ErrorSeverity.MEDIUM,
      'SSH_FILE_TRANSFER_FAILED',
      { filePath: localPath || remotePath, ...context },
      {
        strategy: RecoveryStrategy.RETRY,
        retryable: true,
        maxRetries: 2,
        retryDelay: 2000,
        userMessage: `File ${operation} failed. Please check file permissions and disk space.`,
        technicalDetails: `File transfer failed: ${message}`
      }
    );

    this.context.additionalData = { operation, localPath, remotePath };
  }
}

export class SSHFileNotFoundError extends SSHFileTransferError {
  constructor(
    filePath: string,
    operation: 'upload' | 'download',
    context: Partial<ErrorContext> = {}
  ) {
    super(
      `File not found: ${filePath}`,
      operation,
      operation === 'upload' ? filePath : undefined,
      operation === 'download' ? filePath : undefined,
      context
    );
    Object.assign(this, { errorCode: 'SSH_FILE_NOT_FOUND' });
    this.recovery.retryable = false;
    this.recovery.userMessage = `File not found: ${filePath}. Please verify the file path.`;
  }
}

// Rate Limiting Errors
export class SSHRateLimitError extends SSHError {
  constructor(
    operation: string,
    limit: number,
    resetTime?: Date,
    context: Partial<ErrorContext> = {}
  ) {
    super(
      `Rate limit exceeded for ${operation}`,
      ErrorCategory.RATE_LIMITING,
      ErrorSeverity.MEDIUM,
      'SSH_RATE_LIMIT_EXCEEDED',
      context,
      {
        strategy: RecoveryStrategy.RETRY,
        retryable: true,
        maxRetries: 1,
        retryDelay: resetTime ? resetTime.getTime() - Date.now() : 60000,
        userMessage: resetTime 
          ? `Rate limit exceeded. Please try again after ${resetTime.toLocaleTimeString()}.`
          : 'Rate limit exceeded. Please try again in a few minutes.',
        technicalDetails: `Rate limit of ${limit} requests exceeded for ${operation}`
      }
    );

    this.context.additionalData = { operation, limit, resetTime };
  }
}

// Security Errors
export class SSHSecurityError extends SSHError {
  constructor(
    message: string,
    threatType: string,
    riskLevel: 'low' | 'medium' | 'high' | 'critical',
    context: Partial<ErrorContext> = {}
  ) {
    const severityMap = {
      low: ErrorSeverity.LOW,
      medium: ErrorSeverity.MEDIUM,
      high: ErrorSeverity.HIGH,
      critical: ErrorSeverity.CRITICAL
    };

    super(
      message,
      ErrorCategory.SECURITY,
      severityMap[riskLevel],
      'SSH_SECURITY_VIOLATION',
      context,
      {
        strategy: RecoveryStrategy.ABORT,
        retryable: false,
        userMessage: 'Security violation detected. Access has been restricted.',
        technicalDetails: `Security violation: ${message}`
      }
    );

    this.context.additionalData = { threatType, riskLevel };
  }
}

// Configuration Errors
export class SSHConfigurationError extends SSHError {
  constructor(
    message: string,
    configKey: string,
    expectedType?: string,
    context: Partial<ErrorContext> = {}
  ) {
    super(
      message,
      ErrorCategory.CONFIGURATION,
      ErrorSeverity.HIGH,
      'SSH_CONFIG_ERROR',
      context,
      {
        strategy: RecoveryStrategy.USER_ACTION_REQUIRED,
        retryable: false,
        userMessage: 'Configuration error detected. Please check your settings.',
        technicalDetails: `Configuration error: ${message}`
      }
    );

    this.context.additionalData = { configKey, expectedType };
  }
}

// System Errors
export class SSHSystemError extends SSHError {
  constructor(
    message: string,
    systemComponent: string,
    context: Partial<ErrorContext> = {}
  ) {
    super(
      message,
      ErrorCategory.SYSTEM,
      ErrorSeverity.CRITICAL,
      'SSH_SYSTEM_ERROR',
      context,
      {
        strategy: RecoveryStrategy.ESCALATE,
        retryable: false,
        userMessage: 'System error occurred. Please contact support if the problem persists.',
        technicalDetails: `System error in ${systemComponent}: ${message}`
      }
    );

    this.context.additionalData = { systemComponent };
  }
}

/**
 * Error factory for creating appropriate error types
 */
export class SSHErrorFactory {
  static createConnectionError(
    message: string, 
    host: string, 
    port?: number,
    context?: Partial<ErrorContext>
  ): SSHConnectionError {
    return new SSHConnectionError(message, host, port, undefined, context);
  }

  static createAuthenticationError(
    message: string,
    authMethod: string,
    userId?: string,
    context?: Partial<ErrorContext>
  ): SSHAuthenticationError {
    return new SSHAuthenticationError(message, authMethod, userId, context);
  }

  static createCommandError(
    message: string,
    command: string,
    exitCode?: number,
    stderr?: string,
    context?: Partial<ErrorContext>
  ): SSHCommandError {
    return new SSHCommandError(message, command, exitCode, stderr, context);
  }

  static createFileTransferError(
    message: string,
    operation: 'upload' | 'download',
    localPath?: string,
    remotePath?: string,
    context?: Partial<ErrorContext>
  ): SSHFileTransferError {
    return new SSHFileTransferError(message, operation, localPath, remotePath, context);
  }

  static createSessionError(
    message: string,
    sessionId: string,
    context?: Partial<ErrorContext>
  ): SSHSessionError {
    return new SSHSessionError(message, sessionId, undefined, context);
  }

  static createFromGenericError(
    error: Error,
    category: ErrorCategory = ErrorCategory.SYSTEM,
    context?: Partial<ErrorContext>
  ): SSHError {
    return new SSHSystemError(error.message, 'unknown', context);
  }
}

/**
 * Error handler utility for consistent error processing
 */
export class SSHErrorHandler {
  static isSSHError(error: any): error is SSHError {
    return error instanceof SSHError;
  }

  static getErrorResponse(error: any): {
    success: false;
    error: {
      code: string;
      message: string;
      category: string;
      severity: string;
      retryable: boolean;
      userMessage: string;
    };
  } {
    if (this.isSSHError(error)) {
      return {
        success: false,
        error: {
          code: error.errorCode,
          message: error.message,
          category: error.category,
          severity: error.severity,
          retryable: error.isRetryable(),
          userMessage: error.getUserMessage()
        }
      };
    }

    // Handle generic errors
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error.message || 'An unexpected error occurred',
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.HIGH,
        retryable: false,
        userMessage: 'An unexpected error occurred. Please try again or contact support.'
      }
    };
  }

  static shouldRetry(error: any): boolean {
    return this.isSSHError(error) && error.isRetryable();
  }

  static getRetryDelay(error: any): number {
    return this.isSSHError(error) ? error.getRetryDelay() : 1000;
  }
}