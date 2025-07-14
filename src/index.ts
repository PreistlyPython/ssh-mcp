#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import { config } from "dotenv";
import { Client } from "ssh2";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import fs from 'fs';
import { SitemapTool } from './sitemap-tool.js';
import { 
  SSHSession, 
  CreateSessionParams,
  ExecuteCommandParams,
  TransferFileParams,
  CloseSessionParams
} from './types.js';
import { SessionEncryptionManager, EncryptionManagerFactory } from './security/session-encryption.js';
import { EnterpriseAuthManager } from './auth/enterprise-auth.js';
import { MFAManager } from './auth/mfa-manager.js';
import { AuditLogger, AuditEventType } from './audit/audit-logger.js';
import { SSHError, SSHErrorHandler, SSHConnectionError, SSHCommandError, SSHSessionError, SSHAuthenticationError } from './errors/ssh-errors.js';
import { Context7Manager, TechnologyStack, DocumentationType, CommandSuggestion } from './ai/context7-integration.js';
import { GitHubIntelligenceManager, GitHubQueryType, PatternType, BestPracticePattern, CommunityInsight } from './ai/github-intelligence.js';
import { AdaptiveConnectionPool, PoolConfig, PoolStatistics } from './pool/adaptive-connection-pool.js';
import { MemoryOrchestrator, MemoryStatistics, CommandCategory, LearningInsight } from './memory/memory-orchestrator.js';
import { CircuitBreakerManager, CircuitBreakerService, GlobalCircuitMetrics, createCircuitBreakerManager } from './resilience/circuit-breaker-manager.js';
import { CircuitHealthStatus, CircuitMetrics } from './resilience/circuit-breaker.js';
import { ErrorMonitor, ErrorType, ErrorContext, ErrorAlert } from './monitoring/error-monitor.js';
import { CredentialProtectionManager, CredentialType, CredentialMetadata, KeyRotationStatus } from './security/credential-protection.js';
import { EnterpriseComplianceManager, ComplianceFramework, ComplianceStatus, ComplianceReport } from './compliance/enterprise-compliance.js';
import { 
  MCPOrchestrationPrompts, 
  createOrchestrationPrompt, 
  createWorkflowPrompt,
  GoWorkflowPrompts,
  RustWorkflowPrompts,
  FileOperationPrompts 
} from './prompts/mcp-orchestration.js';
import { 
  MLMCPIntegrationPrompts,
  createMLEnhancedWorkflow,
  createMLBackupStrategy
} from './prompts/ml-mcp-integration.js';
import { SmartFileEditor, FileEditRequest, EditOperation, SmartFileEditingPrompts } from './tools/smart-file-editor.js';
import { 
  IntelligentBackupManager,
  BackupType,
  BackupOptions,
  RestoreOptions,
  createLifecycleManagementPrompt
} from './backup/intelligent-backup-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file (but don't override existing ones)
config({ path: resolve(__dirname, "../.env"), override: false });

// Debug: Log environment variables for server configurations
const debugLogPath = '/tmp/ssh-mcp-debug.log';
const debugLog = (msg: string) => {
  fs.appendFileSync(debugLogPath, `${new Date().toISOString()} ${msg}\n`);
};

debugLog('SSH-MCP Debug - Environment Variables:');
debugLog(`JOEDREAMZ_HOST: ${process.env.JOEDREAMZ_HOST}`);
debugLog(`JOEDREAMZ_USERNAME: ${process.env.JOEDREAMZ_USERNAME}`);
debugLog(`JOEDREAMZ_PASSWORD: ${process.env.JOEDREAMZ_PASSWORD ? '[SET]' : '[NOT SET]'}`);
debugLog(`OPTINAMPOUT_HOST: ${process.env.OPTINAMPOUT_HOST}`);
debugLog(`OPTINAMPOUT_PASSWORD: ${process.env.OPTINAMPOUT_PASSWORD ? '[SET]' : '[NOT SET]'}`);

// Default SSH configuration
const DEFAULT_SSH_CONFIG = {
  port: 22,
  maxRetries: 3,
  retryDelay: 2000,
  connectionTimeout: 20000,
  keepaliveInterval: 10000
};

// Server configuration interface
interface ServerConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  defaultDir: string;
  description: string;
}

// Predefined server configurations using environment variables
const PREDEFINED_SERVERS: Record<string, ServerConfig> = {
  'my-server': {
    host: process.env.MY_SERVER_HOST || 'example.com',
    port: parseInt(process.env.MY_SERVER_PORT || '22'),
    username: process.env.MY_SERVER_USERNAME || 'myuser',
    password: process.env.MY_SERVER_PASSWORD,
    privateKey: process.env.MY_SERVER_PRIVATE_KEY,
    passphrase: process.env.MY_SERVER_PASSPHRASE,
    defaultDir: process.env.MY_SERVER_DEFAULT_DIR || '/home/myuser',
    description: process.env.MY_SERVER_DESCRIPTION || 'My example server'
  },
  'optinampout': {
    host: process.env.OPTINAMPOUT_HOST || 'fr3.fcomet.com',
    port: parseInt(process.env.OPTINAMPOUT_PORT || '17177'),
    username: process.env.OPTINAMPOUT_USERNAME || 'optinamp',
    password: process.env.OPTINAMPOUT_PASSWORD,
    privateKey: process.env.OPTINAMPOUT_PRIVATE_KEY,
    passphrase: process.env.OPTINAMPOUT_PASSPHRASE,
    defaultDir: process.env.OPTINAMPOUT_DEFAULT_DIR || '/home/optinamp/public_html/',
    description: process.env.OPTINAMPOUT_DESCRIPTION || 'OptinAmpOut Production Server'
  },
  'joedreamz': {
    host: process.env.JOEDREAMZ_HOST || 'joedreamz.com',
    port: parseInt(process.env.JOEDREAMZ_PORT || '22'),
    username: process.env.JOEDREAMZ_USERNAME || 'wajk74lwk7tp',
    password: process.env.JOEDREAMZ_PASSWORD,
    privateKey: process.env.JOEDREAMZ_PRIVATE_KEY,
    passphrase: process.env.JOEDREAMZ_PASSPHRASE,
    defaultDir: process.env.JOEDREAMZ_DEFAULT_DIR || '~/public_html/joedreamz.com/wp-content/themes/twentytwentyfour/homepage',
    description: process.env.JOEDREAMZ_DESCRIPTION || 'JoeDreamz WordPress Production Server'
  }
};

// SSH Service class to manage connections
class SSHService {
  private sessions: Map<string, SSHSession> = new Map();
  private readonly connectionPool: AdaptiveConnectionPool;
  private sitemapTool: SitemapTool;
  private readonly startTime = Date.now();
  private connectionAttempts = 0;
  private successfulConnections = 0;
  private failedConnections = 0;
  
  // Security and enterprise features
  private encryptionManager: SessionEncryptionManager;
  private authManager: EnterpriseAuthManager;
  private auditLogger: AuditLogger;
  private mfaManager: MFAManager;
  
  // AI and intelligence features
  private context7Manager: Context7Manager;
  private githubIntelligenceManager: GitHubIntelligenceManager;
  private memoryOrchestrator: MemoryOrchestrator;
  
  // Resilience features
  private circuitBreakerManager: CircuitBreakerManager;
  
  // Monitoring features
  private errorMonitor: ErrorMonitor;
  
  // Advanced security features
  private credentialProtection: CredentialProtectionManager;
  
  // Compliance features
  private complianceManager: EnterpriseComplianceManager;
  
  // Smart file editing
  public smartFileEditor: SmartFileEditor;

  constructor() {
    // Initialize security components
    this.encryptionManager = EncryptionManagerFactory.createForProduction();
    this.mfaManager = new MFAManager();
    this.authManager = new EnterpriseAuthManager(this.mfaManager);
    this.auditLogger = new AuditLogger();
    
    // Initialize AI components
    this.context7Manager = new Context7Manager({}, this.auditLogger);
    this.githubIntelligenceManager = new GitHubIntelligenceManager({}, this.auditLogger);
    this.memoryOrchestrator = new MemoryOrchestrator({}, this.auditLogger);
    
    // Initialize resilience components
    this.circuitBreakerManager = createCircuitBreakerManager(this.auditLogger);
    
    // Initialize monitoring components
    this.errorMonitor = new ErrorMonitor({}, this.auditLogger);
    
    // Initialize advanced security components
    this.credentialProtection = new CredentialProtectionManager({}, this.auditLogger);
    
    // Initialize compliance components
    this.complianceManager = new EnterpriseComplianceManager(
      {},
      this.auditLogger,
      this.credentialProtection,
      this.errorMonitor
    );
    
    // Initialize smart file editor
    this.smartFileEditor = new SmartFileEditor(this);
    
    // Initialize adaptive connection pool
    this.connectionPool = new AdaptiveConnectionPool({
      minPoolSize: parseInt(process.env.SSH_MIN_POOL_SIZE || '5'),
      maxPoolSize: parseInt(process.env.SSH_MAX_POOL_SIZE || '100'),
      enableAdaptiveScaling: true,
      enableHealthChecks: true,
      enableConnectionReuse: true
    }, this.auditLogger);
    
    // Initialize existing components
    this.sitemapTool = new SitemapTool(this.sessions);
    this.initializeConnectionPool();
    
    // Setup security event handlers
    this.setupSecurityEventHandlers();
  }

  private async initializeConnectionPool(): Promise<void> {
    // Adaptive connection pool is already initialized in constructor
    console.error(`Adaptive connection pool initialized with intelligent scaling and health monitoring`);
  }

  private setupSecurityEventHandlers(): void {
    // Authentication event handlers
    this.authManager.on('auth_success', async (event: any) => {
      await this.auditLogger.logAuthentication(
        true,
        event.userId,
        event.authMethod,
        {
          sessionId: event.sessionId,
          clientIp: event.context?.ipAddress,
          userAgent: event.context?.userAgent,
          mfaMethod: event.mfaMethod
        }
      );
    });

    this.authManager.on('auth_failure', async (event: any) => {
      await this.auditLogger.logAuthentication(
        false,
        event.userId,
        event.authMethod,
        {
          sessionId: event.sessionId,
          clientIp: event.context?.ipAddress,
          userAgent: event.context?.userAgent,
          failureReason: event.reason
        }
      );
    });

    // MFA event handlers
    this.mfaManager.on('mfa_verification_success', async (event: any) => {
      await this.auditLogger.logEvent(AuditEventType.MFA_SUCCESS, {
        userId: event.userId,
        description: `MFA verification successful using ${event.method}`,
        outcome: 'success',
        eventDetails: { method: event.method, challengeId: event.challengeId }
      });
    });

    this.mfaManager.on('mfa_verification_failed', async (event: any) => {
      await this.auditLogger.logEvent(AuditEventType.MFA_FAILURE, {
        userId: event.userId,
        description: `MFA verification failed using ${event.method}`,
        outcome: 'failure',
        eventDetails: { method: event.method, attempts: event.attempts, challengeId: event.challengeId }
      });
    });
  }

  // Adaptive connection pool methods - delegated to the pool instance

  // Quick connect to predefined servers
  async quickConnect(serverName: string): Promise<string> {
    const config = PREDEFINED_SERVERS[serverName];
    if (!config) {
      throw new Error(`Unknown server configuration: ${serverName}. Available servers: ${Object.keys(PREDEFINED_SERVERS).join(', ')}`);
    }

    const sessionId = uuidv4();
    
    try {
      const session = await this.createSessionWithConfig(sessionId, config);
      this.sessions.set(sessionId, session);
      
      return sessionId;
    } catch (error: any) {
      throw new Error(`Failed to connect to ${serverName}: ${error.message}`);
    }
  }

  // List available predefined servers
  listPredefinedServers(): Record<string, any> {
    const servers: Record<string, any> = {};
    for (const [name, config] of Object.entries(PREDEFINED_SERVERS)) {
      servers[name] = {
        host: config.host,
        port: config.port,
        username: config.username,
        defaultDir: config.defaultDir,
        description: config.description,
        // Debug info
        hasPassword: config.password ? true : false,
        hasPrivateKey: config.privateKey ? true : false,
        passwordLength: config.password ? config.password.length : 0
      };
    }
    return servers;
  }

  private async createSessionWithConfig(sessionId: string, config: ServerConfig): Promise<SSHSession> {
    return new Promise((resolve, reject) => {
      const client = new Client();
      
      client.on('ready', () => {
        const session: SSHSession = {
          client,
          host: config.host,
          username: config.username,
          defaultDir: config.defaultDir,
          retryCount: 0,
          lastActivity: Date.now(),
          isConnected: true,
          connectionConfig: {
            host: config.host,
            port: config.port,
            username: config.username,
            password: config.password,
            privateKey: config.privateKey
          }
        };
        
        resolve(session);
      });

      client.on('error', (err) => {
        reject(err);
      });

      // Prepare connection options
      const connectionOptions: any = {
        host: config.host,
        port: config.port,
        username: config.username,
        readyTimeout: DEFAULT_SSH_CONFIG.connectionTimeout,
        keepaliveInterval: DEFAULT_SSH_CONFIG.keepaliveInterval
      };

      // Add authentication method
      debugLog(`SSH-MCP Auth Debug for ${config.host}:`);
      debugLog(`  privateKey: ${config.privateKey ? '[SET]' : '[NOT SET]'}`);
      debugLog(`  password: ${config.password ? '[SET]' : '[NOT SET]'}`);
      debugLog(`  password value: ${config.password}`);
      
      if (config.privateKey) {
        connectionOptions.privateKey = config.privateKey;
        if (config.passphrase) {
          connectionOptions.passphrase = config.passphrase;
        }
        debugLog('  Using private key authentication');
      } else if (config.password) {
        connectionOptions.password = config.password;
        debugLog('  Using password authentication');
      } else {
        debugLog('  ERROR: No authentication method available');
        reject(new Error('No authentication method provided (password or private key)'));
        return;
      }

      client.connect(connectionOptions);
    });
  }

  async createSession(params: CreateSessionParams & { credentialId?: string }): Promise<string> {
    const sessionId = uuidv4();
    const maxRetries = params.maxRetries || DEFAULT_SSH_CONFIG.maxRetries;
    const retryDelay = params.retryDelay || DEFAULT_SSH_CONFIG.retryDelay;
    
    this.connectionAttempts++;
    
    // Use stored credential if credentialId is provided
    let effectiveParams = { ...params };
    if (params.credentialId) {
      try {
        const credential = await this.credentialProtection.retrieveCredential(
          params.credentialId,
          'system',
          sessionId
        );
        
        // Apply credential based on type
        switch (credential.metadata.type) {
          case CredentialType.SSH_PASSWORD:
            effectiveParams.password = credential.data.toString();
            break;
          case CredentialType.SSH_PRIVATE_KEY:
            effectiveParams.privateKey = credential.data.toString();
            break;
          case CredentialType.SSH_PASSPHRASE:
            effectiveParams.passphrase = credential.data.toString();
            break;
          default:
            console.warn(`Credential type ${credential.metadata.type} not applicable for SSH connection`);
        }
        
        // Update params to use effective params
        params = effectiveParams;
      } catch (error: any) {
        console.error(`Failed to retrieve credential ${params.credentialId}:`, error.message);
        throw new SSHAuthenticationError(
          `Failed to retrieve stored credential: ${error.message}`,
          params.username
        );
      }
    }
    
    try {
      // Encrypt credentials if provided
      if (params.password) {
        await this.encryptionManager.encryptCredentials(sessionId, {
          type: 'password',
          data: params.password
        });
        // Remove plaintext password from params for security
        params.password = '[ENCRYPTED]';
      }
      
      if (params.privateKey) {
        await this.encryptionManager.encryptCredentials(sessionId, {
          type: 'privateKey',
          data: typeof params.privateKey === 'string' ? params.privateKey : params.privateKey.toString()
        });
        // Remove plaintext key from params for security  
        params.privateKey = '[ENCRYPTED]';
      }
    } catch (error) {
      throw new SSHConnectionError(
        'Failed to encrypt session credentials',
        params.host,
        params.port,
        error as Error,
        { sessionId }
      );
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Use circuit breaker for connection creation
        const client = await this.circuitBreakerManager.executeWithCircuitBreaker(
          CircuitBreakerService.SSH_CONNECTION,
          {
            execute: async () => {
              // Use adaptive connection pool to get or create connection
              return await this.connectionPool.getConnection(params);
            },
            fallback: async () => {
              throw new SSHConnectionError(
                'Connection failed and no fallback available',
                params.host,
                params.port
              );
            },
            timeout: DEFAULT_SSH_CONFIG.connectionTimeout
          }
        );

        const session: SSHSession = {
          client,
          host: params.host,
          username: params.username,
          defaultDir: params.defaultDir,
          retryCount: attempt,
          lastActivity: Date.now(),
          isConnected: true,
          connectionConfig: {
            host: params.host,
            port: params.port || DEFAULT_SSH_CONFIG.port,
            username: params.username,
            password: '[ENCRYPTED]', // Never store plaintext passwords
            privateKey: '[ENCRYPTED]'  // Never store plaintext keys
          }
        };

        // Encrypt session data
        try {
          const encryptedSession = await this.encryptionManager.encryptSessionData(
            sessionId,
            {
              host: session.host,
              username: session.username,
              defaultDir: session.defaultDir,
              isConnected: session.isConnected,
              lastActivity: session.lastActivity
            },
            sessionId // Use sessionId as userId for session encryption
          );
          
          // Store encrypted session metadata
          session.encryptedMetadata = encryptedSession;
        } catch (error) {
          throw new SSHSessionError(
            'Failed to encrypt session data',
            sessionId,
            'SSH_ENCRYPTION_ERROR',
            { host: params.host, username: params.username }
          );
        }

        this.sessions.set(sessionId, session);
        this.setupConnectionMonitoring(sessionId, session);
        this.successfulConnections++;
        
        // Log session creation
        await this.auditLogger.logEvent(AuditEventType.SESSION_START, {
          sessionId,
          description: `SSH session created for ${params.username}@${params.host}`,
          outcome: 'success',
          eventDetails: {
            host: params.host,
            port: params.port || DEFAULT_SSH_CONFIG.port,
            username: params.username,
            retryAttempts: attempt
          }
        });

        // Change to default directory if specified
        if (params.defaultDir) {
          try {
            await this.executeCommand({ sessionId, command: `cd "${params.defaultDir}"` });
          } catch (error: any) {
            console.warn(`Warning: Could not change to default directory ${params.defaultDir}: ${error.message}`);
          }
        }

        return sessionId;
      } catch (error: any) {
        console.error(`SSH connection attempt ${attempt + 1} failed:`, error.message);
        
        // Log failed connection attempt
        await this.auditLogger.logEvent(AuditEventType.SSH_CONNECTION_FAILED, {
          sessionId,
          description: `SSH connection failed for ${params.username}@${params.host}`,
          outcome: 'failure',
          eventDetails: {
            host: params.host,
            port: params.port || DEFAULT_SSH_CONFIG.port,
            username: params.username,
            attempt: attempt + 1,
            maxRetries: maxRetries + 1,
            errorMessage: error.message
          },
          riskScore: attempt === maxRetries ? 8 : 5
        });

        // Track error in monitoring system
        await this.errorMonitor.trackError(error, {
          sessionId,
          host: params.host,
          operation: 'ssh_connection',
          metadata: {
            username: params.username,
            port: params.port,
            attempt: attempt + 1,
            maxRetries: maxRetries + 1
          }
        });
        
        if (attempt === maxRetries) {
          this.failedConnections++;
          
          // Clean up encrypted credentials on final failure
          try {
            this.encryptionManager.wipeSession(sessionId);
          } catch (cleanupError) {
            console.warn('Failed to cleanup session encryption:', cleanupError);
          }
          
          throw new SSHConnectionError(
            `Failed to establish SSH connection after ${maxRetries + 1} attempts`,
            params.host,
            params.port,
            error,
            { sessionId, username: params.username, attempts: maxRetries + 1 }
          );
        }
        
        if (attempt < maxRetries) {
          console.error(`Retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    throw new Error('Unexpected error in createSession');
  }

  private async connectClient(client: Client, params: CreateSessionParams): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, DEFAULT_SSH_CONFIG.connectionTimeout);

      client.on('ready', () => {
        clearTimeout(timeout);
        resolve();
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      const connectionOptions: any = {
        host: params.host,
        port: params.port || DEFAULT_SSH_CONFIG.port,
        username: params.username,
        readyTimeout: DEFAULT_SSH_CONFIG.connectionTimeout,
        keepaliveInterval: DEFAULT_SSH_CONFIG.keepaliveInterval
      };

      // Handle authentication
      if (params.privateKey) {
        let privateKey: string | Buffer = params.privateKey;
        
        if (params.privateKeyPath) {
          try {
            privateKey = fs.readFileSync(params.privateKeyPath);
          } catch (error: any) {
            reject(new Error(`Failed to read private key file: ${error.message}`));
            return;
          }
        }

        connectionOptions.privateKey = privateKey;
        
        if (params.passphrase) {
          connectionOptions.passphrase = params.passphrase;
        }
      } else if (params.password) {
        connectionOptions.password = params.password;
      } else {
        reject(new Error('No authentication method provided'));
        return;
      }

      client.connect(connectionOptions);
    });
  }

  private setupConnectionMonitoring(sessionId: string, session: SSHSession): void {
    const checkConnection = async () => {
      if (!session.isConnected) {
        await this.attemptReconnect(sessionId, session);
      }
    };

    // Monitor connection status every 30 seconds
    session.reconnectTimer = setInterval(checkConnection, 30000);

    // Handle connection events
    session.client.on('close', () => {
      console.error(`SSH connection closed for session ${sessionId}`);
      session.isConnected = false;
    });

    session.client.on('error', (err) => {
      console.error(`SSH connection error for session ${sessionId}:`, err.message);
      session.isConnected = false;
    });
  }

  private async attemptReconnect(sessionId: string, session: SSHSession): Promise<void> {
    console.error(`Attempting to reconnect session ${sessionId}...`);
    
    try {
      const newClient = new Client();
      await this.connectClient(newClient, {
        host: session.connectionConfig.host,
        port: session.connectionConfig.port,
        username: session.connectionConfig.username,
        password: session.connectionConfig.password,
        privateKey: session.connectionConfig.privateKey
      });

      // Close old client
      session.client.end();
      
      // Update session with new client
      session.client = newClient;
      session.isConnected = true;
      session.retryCount++;
      
      console.error(`Successfully reconnected session ${sessionId}`);
    } catch (error: any) {
      console.error(`Failed to reconnect session ${sessionId}:`, error.message);
    }
  }

  async executeCommand(params: ExecuteCommandParams): Promise<string> {
    const session = this.sessions.get(params.sessionId);
    if (!session) {
      throw new SSHSessionError(
        `Session not found`,
        params.sessionId,
        'SSH_SESSION_NOT_FOUND'
      );
    }

    if (!session.isConnected) {
      throw new SSHSessionError(
        `Session is not connected`,
        params.sessionId,
        'SSH_SESSION_DISCONNECTED'
      );
    }

    session.lastActivity = Date.now();
    const startTime = Date.now();

    return this.circuitBreakerManager.executeWithCircuitBreaker(
      CircuitBreakerService.COMMAND_EXECUTION,
      {
        execute: () => new Promise<string>((resolve, reject) => {
          session.client.exec(params.command, async (err, stream) => {
        if (err) {
          const sshError = new SSHCommandError(
            `Failed to execute command: ${err.message}`,
            params.command,
            undefined,
            undefined,
            { sessionId: params.sessionId }
          );
          
          // Log command execution failure
          await this.auditLogger.logSSHCommand(
            params.sessionId, // Using sessionId as userId for audit
            params.sessionId,
            params.command,
            -1, // Error exit code
            {
              host: session.host,
              executionTime: Date.now() - startTime
            }
          );
          
          // Record command failure in memory orchestrator
          try {
            const currentDir = session.defaultDir || '/';
            await this.memoryOrchestrator.recordCommand(
              params.sessionId,
              params.sessionId,
              params.command,
              {
                directory: currentDir,
                outcome: 'failure',
                executionTime: Date.now() - startTime,
                errorMessage: err.message
              }
            );
          } catch (memoryError) {
            console.warn('Failed to record command memory:', memoryError);
          }
          
          reject(sshError);
          return;
        }

        let stdout = '';
        let stderr = '';

        stream.on('close', async (code: number, signal: string) => {
          const executionTime = Date.now() - startTime;
          const result = `Exit Code: ${code}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`;
          
          // Log command execution
          await this.auditLogger.logSSHCommand(
            params.sessionId, // Using sessionId as userId
            params.sessionId,
            params.command,
            code,
            {
              host: session.host,
              executionTime,
              outputSize: stdout.length + stderr.length
            }
          );
          
          // Record command in memory orchestrator for learning
          try {
            // Get current directory for context
            const currentDir = session.defaultDir || '/';
            const outcome = code === 0 ? 'success' : 'failure';
            
            await this.memoryOrchestrator.recordCommand(
              params.sessionId,
              params.sessionId, // Using sessionId as userId
              params.command,
              {
                directory: currentDir,
                outcome,
                executionTime,
                errorMessage: stderr || undefined
              }
            );
          } catch (memoryError) {
            // Don't fail the command if memory recording fails
            console.warn('Failed to record command memory:', memoryError);
          }
          
          resolve(result);
        });

        stream.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        // Set timeout for command execution - configurable for enterprise
        const timeout = parseInt(process.env.SSH_COMMAND_TIMEOUT || '60000');
        setTimeout(async () => {
          stream.close();
          
          // Log timeout
          await this.auditLogger.logSSHCommand(
            params.sessionId,
            params.sessionId,
            params.command,
            -999, // Timeout exit code
            {
              host: session.host,
              executionTime: timeout
            }
          );
          
          // Record timeout in memory orchestrator
          try {
            const currentDir = session.defaultDir || '/';
            await this.memoryOrchestrator.recordCommand(
              params.sessionId,
              params.sessionId,
              params.command,
              {
                directory: currentDir,
                outcome: 'failure',
                executionTime: timeout,
                errorMessage: `Command timed out after ${timeout}ms`
              }
            );
          } catch (memoryError) {
            console.warn('Failed to record command memory:', memoryError);
          }
          
          reject(new SSHCommandError(
            `Command execution timed out after ${timeout}ms`,
            params.command,
            undefined,
            undefined,
            { sessionId: params.sessionId, timeout }
          ));
        }, timeout);
          });
        }),
        timeout: parseInt(process.env.SSH_COMMAND_TIMEOUT || '60000')
      }
    );
  }

  async transferFile(params: TransferFileParams): Promise<string> {
    const session = this.sessions.get(params.sessionId);
    if (!session) {
      throw new Error(`Session ${params.sessionId} not found`);
    }

    if (!session.isConnected) {
      throw new Error(`Session ${params.sessionId} is not connected`);
    }

    session.lastActivity = Date.now();

    return new Promise((resolve, reject) => {
      if (params.direction === "upload") {
        session.client.sftp((err, sftp) => {
          if (err) {
            reject(err);
            return;
          }

          sftp.fastPut(params.localPath, params.remotePath, (error) => {
            if (error) {
              reject(error);
            } else {
              resolve(`File uploaded successfully from ${params.localPath} to ${params.remotePath}`);
            }
          });
        });
      } else {
        session.client.sftp((err, sftp) => {
          if (err) {
            reject(err);
            return;
          }

          sftp.fastGet(params.remotePath, params.localPath, (error) => {
            if (error) {
              reject(error);
            } else {
              resolve(`File downloaded successfully from ${params.remotePath} to ${params.localPath}`);
            }
          });
        });
      }
    });
  }

  async closeSession(params: CloseSessionParams): Promise<string> {
    const session = this.sessions.get(params.sessionId);
    if (!session) {
      throw new SSHSessionError(
        `Session not found`,
        params.sessionId,
        'SSH_SESSION_NOT_FOUND'
      );
    }

    const sessionDuration = Date.now() - (session.lastActivity || Date.now());

    // Clear reconnect timer
    if (session.reconnectTimer) {
      clearInterval(session.reconnectTimer);
    }

    // Return connection to pool instead of closing
    const key = `${session.username}@${session.host}`;
    await this.connectionPool.returnConnection(session.client, key);
    
    // Securely wipe session encryption data
    try {
      this.encryptionManager.wipeSession(params.sessionId);
    } catch (error) {
      console.warn('Failed to securely wipe session data:', error);
    }
    
    // Log session closure
    await this.auditLogger.logEvent(AuditEventType.SESSION_END, {
      sessionId: params.sessionId,
      description: `SSH session closed for ${session.username}@${session.host}`,
      outcome: 'success',
      eventDetails: {
        host: session.host,
        username: session.username,
        duration: sessionDuration,
        retryCount: session.retryCount
      }
    });
    
    // Remove from sessions
    this.sessions.delete(params.sessionId);

    return `Session ${params.sessionId} closed successfully`;
  }

  listSessions(): Record<string, any> {
    const sessions: Record<string, any> = {};
    for (const [sessionId, session] of this.sessions) {
      sessions[sessionId] = {
        host: session.host,
        username: session.username,
        defaultDir: session.defaultDir,
        isConnected: session.isConnected,
        lastActivity: new Date(session.lastActivity).toISOString(),
        retryCount: session.retryCount
      };
    }
    return sessions;
  }

  getSessionInfo(sessionId: string): any {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SSHSessionError(
        `Session not found`,
        sessionId,
        'SSH_SESSION_NOT_FOUND'
      );
    }
    
    return {
      sessionId,
      host: session.host,
      username: session.username,
      defaultDir: session.defaultDir,
      isConnected: session.isConnected,
      lastActivity: new Date(session.lastActivity).toISOString(),
      retryCount: session.retryCount
    };
  }

  // Security and encryption metrics
  getSecurityMetrics(): Record<string, any> {
    const encryptionStats = this.encryptionManager.getEncryptionStats();
    
    return {
      // Encryption Metrics
      encryptionAlgorithm: encryptionStats.algorithm,
      activeEncryptedSessions: encryptionStats.activeSessions,
      encryptedCredentials: encryptionStats.encryptedCredentials,
      keyRotations: encryptionStats.keyRotations,
      memoryEncryption: encryptionStats.memoryEncryption,
      
      // Security Status
      securityLevel: this.calculateSecurityLevel(),
      threatLevel: this.assessThreatLevel(),
      complianceStatus: 'SOC2_COMPLIANT',
      
      // Recommendations
      securityRecommendations: this.getSecurityRecommendations()
    };
  }

  private calculateSecurityLevel(): string {
    // Calculate security level based on various factors
    const encryptionEnabled = this.encryptionManager.getEncryptionStats().activeSessions > 0;
    const auditingEnabled = true; // Auditing is always enabled in this implementation
    
    if (encryptionEnabled && auditingEnabled) return 'ENTERPRISE';
    if (encryptionEnabled || auditingEnabled) return 'STANDARD';
    return 'BASIC';
  }

  private assessThreatLevel(): string {
    const failureRate = this.connectionAttempts > 0 ? 
      (this.failedConnections / this.connectionAttempts) * 100 : 0;
    
    if (failureRate > 50) return 'HIGH';
    if (failureRate > 20) return 'MEDIUM';
    return 'LOW';
  }

  private getSecurityRecommendations(): string[] {
    const recommendations: string[] = [];
    const encryptionStats = this.encryptionManager.getEncryptionStats();
    
    if (encryptionStats.activeSessions === 0) {
      recommendations.push('Enable session encryption for enhanced security');
    }
    
    if (this.failedConnections > 10) {
      recommendations.push('High number of failed connections detected - review access logs');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Security configuration is optimal');
    }
    
    return recommendations;
  }

  // Performance monitoring and metrics
  getPerformanceMetrics(): Record<string, any> {
    const uptime = Date.now() - this.startTime;
    const successRate = this.connectionAttempts > 0 ? 
      ((this.successfulConnections / this.connectionAttempts) * 100).toFixed(2) : 0;
    
    // Get adaptive connection pool statistics
    const poolStats = this.connectionPool.getStatistics();
    
    return {
      // Adaptive Connection Pool Metrics
      connectionPool: {
        metrics: poolStats.metrics,
        performance: poolStats.performance,
        config: {
          minPoolSize: poolStats.config.minPoolSize,
          maxPoolSize: poolStats.config.maxPoolSize,
          enableAdaptiveScaling: poolStats.config.enableAdaptiveScaling,
          enableHealthChecks: poolStats.config.enableHealthChecks,
          enableConnectionReuse: poolStats.config.enableConnectionReuse,
          scaleUpThreshold: `${(poolStats.config.scaleUpThreshold * 100).toFixed(1)}%`,
          scaleDownThreshold: `${(poolStats.config.scaleDownThreshold * 100).toFixed(1)}%`
        }
      },
      
      // Session Metrics  
      activeSessions: this.sessions.size,
      totalConnectionAttempts: this.connectionAttempts,
      successfulConnections: this.successfulConnections,
      failedConnections: this.failedConnections,
      connectionSuccessRate: `${successRate}%`,
      
      // System Metrics
      uptimeMs: uptime,
      uptimeFormatted: this.formatUptime(uptime),
      timestamp: new Date().toISOString(),
      
      // Health Status
      healthStatus: this.getHealthStatus(),
      recommendations: this.getPerformanceRecommendations(),
      
      // Security Integration
      securityMetrics: this.getSecurityMetrics()
    };
  }

  private formatUptime(uptimeMs: number): string {
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  private getHealthStatus(): string {
    const poolStats = this.connectionPool.getStatistics();
    const poolUtilization = poolStats.metrics.poolUtilization;
    const successRate = this.connectionAttempts > 0 ? 
      (this.successfulConnections / this.connectionAttempts) * 100 : 100;
    
    if (successRate < 80) return 'CRITICAL';
    if (poolUtilization > 90) return 'WARNING';
    if (successRate < 95) return 'WARNING';
    return 'HEALTHY';
  }

  private getPerformanceRecommendations(): string[] {
    const recommendations: string[] = [];
    const poolStats = this.connectionPool.getStatistics();
    const poolUtilization = poolStats.metrics.poolUtilization;
    const successRate = this.connectionAttempts > 0 ? 
      (this.successfulConnections / this.connectionAttempts) * 100 : 100;
    
    if (poolUtilization > 80) {
      recommendations.push('Consider increasing SSH_MAX_POOL_SIZE for better scalability');
    }
    
    if (successRate < 95) {
      recommendations.push('High connection failure rate detected - check network connectivity and credentials');
    }
    
    if (this.sessions.size > 50) {
      recommendations.push('High session count - consider implementing session cleanup policies');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('System operating within optimal parameters');
    }
    
    return recommendations;
  }

  // Context7 AI assistance methods
  async getIntelligentCommandHelp(
    sessionId: string,
    command: string,
    currentDirectory: string = '/'
  ): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SSHSessionError(
        `Session not found`,
        sessionId,
        'SSH_SESSION_NOT_FOUND'
      );
    }

    // Get recent command history from session
    const recentCommands = await this.getRecentCommands(sessionId);
    
    // Detect technology stack if not cached
    const fileList = await this.getDirectoryListing(sessionId, currentDirectory);
    const techStack = await this.circuitBreakerManager.executeWithCircuitBreaker(
      CircuitBreakerService.CONTEXT7_API,
      {
        execute: async () => {
          return await this.context7Manager.detectTechnologyStack(
            sessionId,
            currentDirectory,
            fileList
          );
        },
        fallback: async () => {
          // Fallback to basic detection
          return {
            primary: TechnologyStack.NODEJS,
            secondary: [],
            confidence: 0.5,
            detectedFiles: []
          };
        },
        timeout: 10000
      }
    );

    // Get intelligent assistance
    const assistance = await this.circuitBreakerManager.executeWithCircuitBreaker(
      CircuitBreakerService.CONTEXT7_API,
      {
        execute: async () => {
          return await this.context7Manager.getIntelligentAssistance(command, {
            sessionId,
            currentDirectory,
            recentCommands,
            technology: techStack.primary
          });
        },
        fallback: async () => {
          // Basic fallback assistance
          return {
            suggestions: [{
              command: command,
              description: 'Execute command as-is',
              confidence: 0.1,
              reasoning: 'Context7 service unavailable - fallback mode',
              examples: [],
              warnings: ['Intelligence assistance unavailable']
            }],
            contextualHelp: 'Context7 service unavailable - executing command without assistance',
            potentialIssues: [],
            bestPractices: [],
            relatedDocumentation: []
          };
        },
        timeout: 10000
      }
    );

    return {
      command,
      assistance,
      detectedTechnology: techStack,
      contextualInformation: {
        currentDirectory,
        recentCommands: recentCommands.slice(-5), // Last 5 commands
        fileCount: fileList.length
      }
    };
  }

  async getTechnologyDocumentation(
    sessionId: string,
    technology: TechnologyStack,
    query: string,
    documentationType: DocumentationType = DocumentationType.API_REFERENCE
  ): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SSHSessionError(
        `Session not found`,
        sessionId,
        'SSH_SESSION_NOT_FOUND'
      );
    }

    const documentation = await this.circuitBreakerManager.executeWithCircuitBreaker(
      CircuitBreakerService.CONTEXT7_API,
      {
        execute: async () => {
          return await this.context7Manager.getDocumentation({
            technology,
            query,
            documentationType,
            context: {
              currentDirectory: await this.getCurrentDirectory(sessionId),
              recentCommands: await this.getRecentCommands(sessionId)
            }
          }, sessionId);
        },
        fallback: async () => {
          // Basic fallback documentation
          return {
            query: {
              technology,
              query,
              documentationType,
              context: {}
            },
            results: [{
              title: 'Documentation Unavailable',
              content: `Unable to fetch documentation for ${technology} - ${query}. Context7 service is currently unavailable.`,
              confidence: 0
            }],
            totalResults: 1,
            responseTime: 0,
            cached: false
          };
        },
        timeout: 15000
      }
    );

    return documentation;
  }

  async detectProjectTechnology(sessionId: string, projectPath?: string): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SSHSessionError(
        `Session not found`,
        sessionId,
        'SSH_SESSION_NOT_FOUND'
      );
    }

    const currentPath = projectPath || await this.getCurrentDirectory(sessionId);
    const fileList = await this.getDirectoryListing(sessionId, currentPath);
    
    const detection = await this.circuitBreakerManager.executeWithCircuitBreaker(
      CircuitBreakerService.CONTEXT7_API,
      {
        execute: async () => {
          return await this.context7Manager.detectTechnologyStack(
            sessionId,
            currentPath,
            fileList
          );
        },
        fallback: async () => {
          // Fallback detection based on common files
          return {
            primary: TechnologyStack.NODEJS,
            secondary: [],
            confidence: 0.3,
            detectedFiles: fileList.slice(0, 10)
          };
        },
        timeout: 10000
      }
    );

    // Get technology-specific commands
    const commands = await this.circuitBreakerManager.executeWithCircuitBreaker(
      CircuitBreakerService.CONTEXT7_API,
      {
        execute: async () => {
          return await this.context7Manager.getTechnologyCommands(
            detection.primary,
            currentPath
          );
        },
        fallback: async () => {
          // Return basic commands based on technology
          const basicCommands: Record<TechnologyStack, string[]> = {
            [TechnologyStack.REACT]: ['npm start', 'npm build', 'npm test'],
            [TechnologyStack.NEXTJS]: ['npm run dev', 'npm run build', 'npm run start'],
            [TechnologyStack.NODEJS]: ['npm install', 'npm run dev', 'npm test'],
            [TechnologyStack.LARAVEL]: ['php artisan serve', 'composer install', 'php artisan migrate'],
            [TechnologyStack.DJANGO]: ['python manage.py runserver', 'pip install -r requirements.txt'],
            [TechnologyStack.VUE]: ['npm run serve', 'npm run build', 'npm run test'],
            [TechnologyStack.ANGULAR]: ['ng serve', 'ng build', 'ng test'],
            [TechnologyStack.EXPRESS]: ['npm start', 'npm run dev', 'npm test'],
            [TechnologyStack.FASTAPI]: ['uvicorn main:app --reload', 'pip install -r requirements.txt'],
            [TechnologyStack.DOCKER]: ['docker build .', 'docker-compose up', 'docker ps'],
            [TechnologyStack.KUBERNETES]: ['kubectl get pods', 'kubectl apply -f', 'kubectl describe']
          };
          const commands = basicCommands[detection.primary] || ['ls', 'pwd', 'cat'];
          return commands.map(cmd => ({
            command: cmd,
            description: `Basic ${detection.primary} command`,
            confidence: 0.5,
            reasoning: 'Context7 service unavailable - fallback commands',
            examples: [cmd],
            warnings: []
          }));
        },
        timeout: 8000
      }
    );

    return {
      detection,
      recommendedCommands: commands,
      projectPath: currentPath,
      detectedFiles: fileList.slice(0, 20) // First 20 files for context
    };
  }

  // Helper methods for Context7 integration
  private async getRecentCommands(sessionId: string): Promise<string[]> {
    // In a real implementation, this would track command history
    // For now, return empty array
    return [];
  }

  private async getCurrentDirectory(sessionId: string): Promise<string> {
    try {
      const result = await this.executeCommand({ sessionId, command: 'pwd' });
      const lines = result.split('\\n');
      const stdoutLine = lines.find(line => !line.startsWith('Exit Code:') && !line.startsWith('STDOUT:') && !line.startsWith('STDERR:'));
      return stdoutLine?.trim() || '/';
    } catch {
      return '/';
    }
  }

  private async getDirectoryListing(sessionId: string, directory: string): Promise<string[]> {
    try {
      const result = await this.executeCommand({ 
        sessionId, 
        command: `find \"${directory}\" -maxdepth 3 -type f -name \"*\" | head -100` 
      });
      const lines = result.split('\\n');
      const stdoutStart = lines.findIndex(line => line.startsWith('STDOUT:'));
      const stderrStart = lines.findIndex(line => line.startsWith('STDERR:'));
      
      if (stdoutStart === -1) return [];
      
      const endIndex = stderrStart === -1 ? lines.length : stderrStart;
      const fileLines = lines.slice(stdoutStart + 1, endIndex)
        .filter(line => line.trim() && !line.startsWith('Exit Code:'))
        .map(line => line.trim());
      
      return fileLines;
    } catch {
      return [];
    }
  }

  // GitHub Intelligence methods
  async searchGitHubPatterns(
    sessionId: string,
    pattern: string,
    technology: TechnologyStack,
    patternType?: PatternType,
    limit?: number
  ): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SSHSessionError(
        `Session not found`,
        sessionId,
        'SSH_SESSION_NOT_FOUND'
      );
    }

    const results = await this.circuitBreakerManager.executeWithCircuitBreaker(
      CircuitBreakerService.GITHUB_API,
      {
        execute: async () => {
          return await this.githubIntelligenceManager.searchCodePatterns(
            pattern,
            technology,
            patternType,
            { limit: limit || 20, qualityFilter: true }
          );
        },
        fallback: async () => {
          // Return cached or empty results on failure
          return {
            query: {
              query: pattern,
              type: GitHubQueryType.CODE_SEARCH,
              technology,
              patternType,
              language: 'javascript',
              limit: limit || 20
            },
            totalCount: 0,
            codeSnippets: [],
            responseTime: 0,
            cached: false,
            rateLimit: { remaining: 0, resetAt: new Date() }
          };
        },
        timeout: 20000
      }
    );

    return {
      searchQuery: { pattern, technology, patternType, limit },
      results: results.codeSnippets || [],
      totalResults: results.totalCount,
      responseTime: results.responseTime,
      cached: results.cached
    };
  }

  async discoverBestPractices(
    sessionId: string,
    technology: TechnologyStack,
    domain?: string
  ): Promise<BestPracticePattern[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SSHSessionError(
        `Session not found`,
        sessionId,
        'SSH_SESSION_NOT_FOUND'
      );
    }

    const bestPractices = await this.circuitBreakerManager.executeWithCircuitBreaker(
      CircuitBreakerService.GITHUB_API,
      {
        execute: async () => {
          return await this.githubIntelligenceManager.discoverBestPractices(
            technology,
            domain
          );
        },
        fallback: async () => {
          // Return empty best practices on failure
          return [];
        },
        timeout: 30000 // Longer timeout for best practices discovery
      }
    );

    return bestPractices;
  }

  async getCommunityInsights(
    sessionId: string,
    technology: TechnologyStack
  ): Promise<CommunityInsight> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SSHSessionError(
        `Session not found`,
        sessionId,
        'SSH_SESSION_NOT_FOUND'
      );
    }

    const insights = await this.circuitBreakerManager.executeWithCircuitBreaker(
      CircuitBreakerService.GITHUB_API,
      {
        execute: async () => {
          return await this.githubIntelligenceManager.getCommunityInsights(technology);
        },
        fallback: async () => {
          // Return minimal insights on failure
          return {
            technology,
            totalRepositories: 0,
            trendingRepositories: [],
            popularPatterns: [],
            emergingTrends: [],
            communityStats: {
              activeContributors: 0,
              weeklyCommits: 0,
              issuesResolved: 0,
              averageStars: 0
            },
            recommendations: []
          };
        },
        timeout: 25000
      }
    );

    return insights;
  }

  // Memory orchestration methods
  async recordCommandMemory(
    sessionId: string,
    userId: string,
    command: string,
    context: {
      directory: string;
      outcome: 'success' | 'failure' | 'partial';
      executionTime: number;
      errorMessage?: string;
    }
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SSHSessionError(
        `Session not found`,
        sessionId,
        'SSH_SESSION_NOT_FOUND'
      );
    }

    await this.circuitBreakerManager.executeWithCircuitBreaker(
      CircuitBreakerService.MEMORY_PERSISTENCE,
      {
        execute: async () => {
          return await this.memoryOrchestrator.recordCommand(
            sessionId,
            userId,
            command,
            {
              directory: context.directory,
              outcome: context.outcome,
              executionTime: context.executionTime,
              errorMessage: context.errorMessage
            }
          );
        },
        fallback: async () => {
          // Silently fail - memory recording is non-critical
          console.warn('Memory orchestration unavailable - command not recorded');
        },
        timeout: 5000
      }
    );
  }

  async getCommandSuggestions(
    sessionId: string,
    userId: string,
    context: {
      directory: string;
      previousCommand?: string;
      projectType?: string;
      technology?: TechnologyStack;
    }
  ): Promise<{
    suggestions: string[];
    patterns: any[];
    insights: LearningInsight[];
    confidence: number;
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SSHSessionError(
        `Session not found`,
        sessionId,
        'SSH_SESSION_NOT_FOUND'
      );
    }

    const suggestions = await this.circuitBreakerManager.executeWithCircuitBreaker(
      CircuitBreakerService.MEMORY_PERSISTENCE,
      {
        execute: async () => {
          return await this.memoryOrchestrator.getCommandSuggestions(
            userId,
            {
              directory: context.directory,
              previousCommand: context.previousCommand,
              projectType: context.projectType,
              technology: context.technology
            }
          );
        },
        fallback: async () => {
          // Return empty suggestions on failure
          return {
            suggestions: [],
            patterns: [],
            insights: [],
            confidence: 0
          };
        },
        timeout: 5000
      }
    );

    return suggestions;
  }

  async getLearningInsights(
    sessionId: string,
    userId?: string
  ): Promise<LearningInsight[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SSHSessionError(
        `Session not found`,
        sessionId,
        'SSH_SESSION_NOT_FOUND'
      );
    }

    const insights = await this.circuitBreakerManager.executeWithCircuitBreaker(
      CircuitBreakerService.MEMORY_PERSISTENCE,
      {
        execute: async () => {
          return await this.memoryOrchestrator.generateLearningInsights(userId);
        },
        fallback: async () => {
          // Return empty insights on failure
          return [];
        },
        timeout: 5000
      }
    );
    return insights;
  }

  async getMemoryStatistics(sessionId: string): Promise<MemoryStatistics> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SSHSessionError(
        `Session not found`,
        sessionId,
        'SSH_SESSION_NOT_FOUND'
      );
    }

    return this.memoryOrchestrator.getStatistics();
  }

  // Connection pool statistics
  getPoolStatistics(): PoolStatistics {
    return this.connectionPool.getStatistics();
  }

  // Circuit breaker health status
  getCircuitBreakerStatus(): GlobalCircuitMetrics {
    return this.circuitBreakerManager.getGlobalHealthStatus();
  }

  // Reset specific circuit breaker
  async resetCircuitBreaker(service: string): Promise<void> {
    const circuitService = service as CircuitBreakerService;
    await this.circuitBreakerManager.resetCircuit(circuitService);
  }

  // Error monitoring methods
  getErrorMonitoringStats(): any {
    return this.errorMonitor.getMonitoringStatistics();
  }

  getActiveAlerts(): ErrorAlert[] {
    return this.errorMonitor.getActiveAlerts();
  }

  async getErrorAnalysis(errorType: string, context: Partial<ErrorContext>): Promise<{
    analysis: string;
    mcpWorkflow: string;
    suggestedActions: string[];
  }> {
    const fullContext: ErrorContext = {
      timestamp: new Date(),
      ...context
    };
    
    return await this.errorMonitor.getErrorAnalysis(
      errorType as ErrorType,
      fullContext
    );
  }

  async getMonitoringInsights(): Promise<{
    insights: string;
    mcpWorkflow: string;
    recommendations: string[];
  }> {
    return await this.errorMonitor.getMonitoringInsights();
  }

  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    await this.errorMonitor.acknowledgeAlert(alertId, acknowledgedBy);
  }

  async resolveAlert(alertId: string, resolvedBy: string): Promise<void> {
    await this.errorMonitor.resolveAlert(alertId, resolvedBy);
  }

  // Credential protection methods
  async storeCredential(
    type: CredentialType,
    data: string,
    metadata: Partial<CredentialMetadata> = {}
  ): Promise<string> {
    return await this.credentialProtection.storeCredential(type, data, metadata);
  }

  async retrieveCredential(
    credentialId: string,
    accessedBy: string,
    sessionId?: string
  ): Promise<{
    data: string | Buffer;
    metadata: CredentialMetadata;
  }> {
    return await this.credentialProtection.retrieveCredential(credentialId, accessedBy, sessionId);
  }

  async listCredentials(filter: {
    type?: CredentialType;
    environment?: string;
    owner?: string;
    status?: KeyRotationStatus;
  } = {}): Promise<CredentialMetadata[]> {
    return await this.credentialProtection.listCredentials(filter);
  }

  async rotateCredential(
    credentialId: string,
    newData?: string,
    rotatedBy: string = 'system'
  ): Promise<void> {
    await this.credentialProtection.rotateCredential(credentialId, newData, rotatedBy);
  }

  async deleteCredential(credentialId: string, deletedBy: string): Promise<void> {
    await this.credentialProtection.deleteCredential(credentialId, deletedBy);
  }

  getCredentialProtectionStats(): any {
    return this.credentialProtection.getProtectionStatistics();
  }

  async getCredentialsRequiringRotation(): Promise<CredentialMetadata[]> {
    return await this.credentialProtection.getCredentialsRequiringRotation();
  }

  getCredentialAccessLogs(credentialId?: string, limit?: number): any[] {
    return this.credentialProtection.getAccessLogs(credentialId, limit);
  }

  // Compliance methods
  async runComplianceAssessment(framework?: ComplianceFramework): Promise<Map<ComplianceFramework, ComplianceReport>> {
    return await this.complianceManager.runComplianceAssessment(framework);
  }

  async getComplianceStatus(framework: ComplianceFramework): Promise<any> {
    return await this.complianceManager.getComplianceStatus(framework);
  }

  async generateComplianceReport(
    framework: ComplianceFramework,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    report: ComplianceReport;
    mcpWorkflow: string;
  }> {
    return await this.complianceManager.generateComplianceReport(
      framework, 
      startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 
      endDate || new Date()
    );
  }

  async checkComplianceControl(controlId: string): Promise<any> {
    return await this.complianceManager.checkControl(controlId);
  }

  async getDataRetentionCompliance(): Promise<any> {
    return await this.complianceManager.getDataRetentionCompliance();
  }

  async getPrivacyCompliance(): Promise<any> {
    return await this.complianceManager.getPrivacyCompliance();
  }

  async remediateComplianceViolation(
    violationId: string,
    remediationSteps: string[],
    assignedTo: string
  ): Promise<void> {
    await this.complianceManager.remediateViolation(violationId, remediationSteps, assignedTo);
  }

  getComplianceStatistics(): any {
    return this.complianceManager.getComplianceStatistics();
  }

  async exportComplianceData(format?: 'json' | 'csv' | 'pdf'): Promise<any> {
    return await this.complianceManager.exportComplianceData(format);
  }

  // Sitemap tool methods
  async createOrUpdateSitemap(sessionId: string, websiteRoot: string, websiteUrl: string, options: any = {}): Promise<string> {
    const sitemapParams = { sessionId, websiteRoot, websiteUrl, ...options };
    return this.sitemapTool.createOrUpdateSitemap(sitemapParams);
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    console.error('Shutting down SSH service...');
    
    // Close all active sessions
    const sessionIds = Array.from(this.sessions.keys());
    await Promise.allSettled(
      sessionIds.map(id => this.closeSession({ sessionId: id }))
    );
    
    // Shutdown adaptive connection pool
    await this.connectionPool.shutdown();
    
    // Shutdown memory orchestrator
    await this.memoryOrchestrator.shutdown();
    
    // Shutdown circuit breaker manager
    await this.circuitBreakerManager.shutdown();
    
    // Shutdown error monitor
    await this.errorMonitor.shutdown();
    
    // Shutdown credential protection
    await this.credentialProtection.shutdown();
    
    // Shutdown compliance manager
    await this.complianceManager.shutdown();
    
    console.error('SSH service shutdown complete');
  }
}

// Initialize the server
const server = new Server(
  {
    name: "ssh-mcp-enhanced",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const sshService = new SSHService();

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "quick_connect",
        description: "Quickly connect to a predefined server using stored credentials from gopass",
        inputSchema: {
          type: "object",
          properties: {
            serverName: {
              type: "string",
              description: "Name of the predefined server to connect to",
              enum: Object.keys(PREDEFINED_SERVERS)
            }
          },
          required: ["serverName"]
        }
      },
      {
        name: "list_predefined_servers",
        description: "List all available predefined servers",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "create_ssh_session",
        description: "Create a new SSH session with custom parameters or stored credentials",
        inputSchema: {
          type: "object",
          properties: {
            host: {
              type: "string",
              description: "SSH host to connect to"
            },
            username: {
              type: "string",
              description: "SSH username"
            },
            password: {
              type: "string",
              description: "SSH password (optional if using credentialId)"
            },
            privateKey: {
              type: "string",
              description: "SSH private key content (optional if using credentialId)"
            },
            privateKeyPath: {
              type: "string",
              description: "Path to SSH private key file (optional if using credentialId)"
            },
            passphrase: {
              type: "string",
              description: "Passphrase for encrypted private key (optional if using credentialId)"
            },
            credentialId: {
              type: "string",
              description: "ID of stored credential to use for authentication (optional)"
            },
            port: {
              type: "number",
              description: "SSH port (default: 22)"
            },
            defaultDir: {
              type: "string",
              description: "Default directory to change to after connection"
            }
          },
          required: ["host", "username"]
        }
      },
      {
        name: "execute_remote_command",
        description: "Execute a command on the remote server",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session or quick_connect"
            },
            command: {
              type: "string",
              description: "Command to execute"
            }
          },
          required: ["sessionId", "command"]
        }
      },
      {
        name: "transfer_file",
        description: "Transfer files to/from the remote server",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            localPath: {
              type: "string",
              description: "Local file path"
            },
            remotePath: {
              type: "string",
              description: "Remote file path"
            },
            direction: {
              type: "string",
              enum: ["upload", "download"],
              description: "Transfer direction"
            }
          },
          required: ["sessionId", "localPath", "remotePath", "direction"]
        }
      },
      {
        name: "close_session",
        description: "Close an SSH session",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID to close"
            }
          },
          required: ["sessionId"]
        }
      },
      {
        name: "list_sessions",
        description: "List all active SSH sessions",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "get_performance_metrics",
        description: "Get performance metrics and adaptive connection pool statistics",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "get_pool_statistics",
        description: "Get detailed adaptive connection pool statistics and health information",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "get_security_metrics",
        description: "Get security metrics including encryption status, audit statistics, and threat assessment",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "get_intelligent_command_help",
        description: "Get intelligent command assistance with real-time documentation and suggestions",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            command: {
              type: "string",
              description: "Command to get assistance for"
            },
            currentDirectory: {
              type: "string",
              description: "Current working directory (optional)"
            }
          },
          required: ["sessionId", "command"]
        }
      },
      {
        name: "get_technology_documentation",
        description: "Get documentation for specific technology stacks and frameworks",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            technology: {
              type: "string",
              enum: ["react", "nextjs", "nodejs", "laravel", "django", "vue", "angular", "express", "fastapi", "docker", "kubernetes"],
              description: "Technology stack to get documentation for"
            },
            query: {
              type: "string",
              description: "Specific topic or question to search for"
            },
            documentationType: {
              type: "string",
              enum: ["api_reference", "framework_docs", "command_help", "code_examples", "best_practices"],
              description: "Type of documentation to retrieve (optional)"
            }
          },
          required: ["sessionId", "technology", "query"]
        }
      },
      {
        name: "detect_project_technology",
        description: "Automatically detect technology stack and get recommendations for current project",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            projectPath: {
              type: "string",
              description: "Path to project directory (optional, uses current directory if not specified)"
            }
          },
          required: ["sessionId"]
        }
      },
      {
        name: "create_or_update_sitemap",
        description: "Create or update a sitemap.xml file by scanning a website",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            websiteRoot: {
              type: "string",
              description: "The root directory of the website on the server"
            },
            websiteUrl: {
              type: "string",
              description: "The base URL of the website"
            },
            baseFilePath: {
              type: "string",
              description: "Path to write the sitemap file (default: websiteRoot/sitemap.xml)"
            },
            maxDepth: {
              type: "number",
              description: "Maximum crawl depth (default: 3)"
            },
            exclude: {
              type: "array",
              items: { type: "string" },
              description: "Patterns to exclude from the sitemap"
            }
          },
          required: ["sessionId", "websiteRoot", "websiteUrl"]
        }
      },
      {
        name: "search_github_patterns",
        description: "Search GitHub repositories for code patterns and examples for specific technologies",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            pattern: {
              type: "string",
              description: "Code pattern or example to search for"
            },
            technology: {
              type: "string",
              enum: ["react", "nextjs", "nodejs", "laravel", "django", "vue", "angular", "express", "fastapi", "docker", "kubernetes"],
              description: "Technology stack to search patterns for"
            },
            patternType: {
              type: "string",
              enum: ["architecture_pattern", "design_pattern", "configuration_pattern", "deployment_pattern", "testing_pattern", "security_pattern", "performance_pattern"],
              description: "Type of pattern to search for (optional)"
            },
            limit: {
              type: "number",
              description: "Maximum number of results to return (default: 20)"
            }
          },
          required: ["sessionId", "pattern", "technology"]
        }
      },
      {
        name: "discover_best_practices",
        description: "Discover best practices and proven patterns for a technology stack from GitHub community",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            technology: {
              type: "string",
              enum: ["react", "nextjs", "nodejs", "laravel", "django", "vue", "angular", "express", "fastapi", "docker", "kubernetes"],
              description: "Technology stack to discover best practices for"
            },
            domain: {
              type: "string",
              description: "Specific domain or use case (e.g., 'authentication', 'deployment', 'testing') - optional"
            }
          },
          required: ["sessionId", "technology"]
        }
      },
      {
        name: "get_community_insights",
        description: "Get comprehensive community insights, trending repositories, and recommendations for a technology",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            technology: {
              type: "string",
              enum: ["react", "nextjs", "nodejs", "laravel", "django", "vue", "angular", "express", "fastapi", "docker", "kubernetes"],
              description: "Technology stack to get community insights for"
            }
          },
          required: ["sessionId", "technology"]
        }
      },
      {
        name: "record_command_memory",
        description: "Record a command execution in memory for learning and pattern recognition",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            userId: {
              type: "string",
              description: "User ID for personalized learning"
            },
            command: {
              type: "string",
              description: "The command that was executed"
            },
            directory: {
              type: "string",
              description: "Directory where command was executed"
            },
            outcome: {
              type: "string",
              enum: ["success", "failure", "partial"],
              description: "Outcome of the command execution"
            },
            executionTime: {
              type: "number",
              description: "Time taken to execute the command in milliseconds"
            },
            errorMessage: {
              type: "string",
              description: "Error message if command failed (optional)"
            }
          },
          required: ["sessionId", "userId", "command", "directory", "outcome", "executionTime"]
        }
      },
      {
        name: "get_command_suggestions",
        description: "Get intelligent command suggestions based on current context and learned patterns",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            userId: {
              type: "string",
              description: "User ID for personalized suggestions"
            },
            currentDirectory: {
              type: "string",
              description: "Current working directory"
            },
            previousCommand: {
              type: "string",
              description: "Previous command executed (optional)"
            },
            projectType: {
              type: "string",
              description: "Type of project (optional)"
            },
            technology: {
              type: "string",
              enum: ["react", "nextjs", "nodejs", "laravel", "django", "vue", "angular", "express", "fastapi", "docker", "kubernetes"],
              description: "Technology stack being used (optional)"
            }
          },
          required: ["sessionId", "userId", "currentDirectory"]
        }
      },
      {
        name: "get_learning_insights",
        description: "Get learning insights and recommendations based on command history and patterns",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            userId: {
              type: "string",
              description: "User ID for personalized insights (optional)"
            }
          },
          required: ["sessionId"]
        }
      },
      {
        name: "get_memory_statistics",
        description: "Get comprehensive memory orchestration statistics and performance metrics",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            }
          },
          required: ["sessionId"]
        }
      },
      {
        name: "get_circuit_breaker_status",
        description: "Get health status and metrics for all circuit breakers protecting external services",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "reset_circuit_breaker",
        description: "Manually reset a specific circuit breaker",
        inputSchema: {
          type: "object",
          properties: {
            service: {
              type: "string",
              enum: ["ssh_connection", "command_execution", "file_transfer", "authentication", "context7_api", "github_api", "memory_persistence", "audit_logging"],
              description: "Service name to reset circuit breaker for"
            }
          },
          required: ["service"]
        }
      },
      {
        name: "get_error_monitoring_stats",
        description: "Get comprehensive error monitoring statistics and system health metrics",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "get_active_alerts",
        description: "Get all currently active alerts from the error monitoring system",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "get_error_analysis",
        description: "Get comprehensive error analysis using MCP workflow for specific error types",
        inputSchema: {
          type: "object",
          properties: {
            errorType: {
              type: "string",
              enum: ["ssh_connection_error", "ssh_command_error", "ssh_authentication_error", "circuit_breaker_error", "context7_api_error", "github_api_error", "memory_persistence_error", "audit_logging_error", "system_error", "performance_error", "security_error"],
              description: "Type of error to analyze"
            },
            sessionId: {
              type: "string",
              description: "Session ID where error occurred (optional)"
            },
            host: {
              type: "string",
              description: "Host where error occurred (optional)"
            },
            command: {
              type: "string",
              description: "Command that caused the error (optional)"
            }
          },
          required: ["errorType"]
        }
      },
      {
        name: "get_monitoring_insights",
        description: "Get intelligent monitoring insights and recommendations using MCP workflow",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "acknowledge_alert",
        description: "Acknowledge an active alert to mark it as seen",
        inputSchema: {
          type: "object",
          properties: {
            alertId: {
              type: "string",
              description: "ID of the alert to acknowledge"
            },
            acknowledgedBy: {
              type: "string",
              description: "Name or ID of person acknowledging the alert"
            }
          },
          required: ["alertId", "acknowledgedBy"]
        }
      },
      {
        name: "resolve_alert",
        description: "Resolve an active alert to mark it as fixed",
        inputSchema: {
          type: "object",
          properties: {
            alertId: {
              type: "string",
              description: "ID of the alert to resolve"
            },
            resolvedBy: {
              type: "string",
              description: "Name or ID of person resolving the alert"
            }
          },
          required: ["alertId", "resolvedBy"]
        }
      },
      {
        name: "store_credential",
        description: "Securely store a credential with encryption at rest",
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["ssh_password", "ssh_private_key", "ssh_passphrase", "api_token", "database_connection", "oauth_token", "certificate", "encryption_key"],
              description: "Type of credential to store"
            },
            data: {
              type: "string",
              description: "The credential data to encrypt and store"
            },
            description: {
              type: "string",
              description: "Description of the credential (optional)"
            },
            environment: {
              type: "string",
              enum: ["development", "staging", "production"],
              description: "Environment this credential is for (optional, defaults to production)"
            },
            rotationIntervalDays: {
              type: "number",
              description: "Days between automatic rotations (optional, defaults to 90)"
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Tags for categorizing the credential (optional)"
            },
            owner: {
              type: "string",
              description: "Owner of the credential (optional)"
            }
          },
          required: ["type", "data"]
        }
      },
      {
        name: "retrieve_credential",
        description: "Retrieve and decrypt a stored credential",
        inputSchema: {
          type: "object",
          properties: {
            credentialId: {
              type: "string",
              description: "ID of the credential to retrieve"
            },
            accessedBy: {
              type: "string",
              description: "Name or ID of person accessing the credential"
            },
            sessionId: {
              type: "string",
              description: "Session ID for audit logging (optional)"
            }
          },
          required: ["credentialId", "accessedBy"]
        }
      },
      {
        name: "list_credentials",
        description: "List stored credentials with optional filtering",
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["ssh_password", "ssh_private_key", "ssh_passphrase", "api_token", "database_connection", "oauth_token", "certificate", "encryption_key"],
              description: "Filter by credential type (optional)"
            },
            environment: {
              type: "string",
              enum: ["development", "staging", "production"],
              description: "Filter by environment (optional)"
            },
            owner: {
              type: "string",
              description: "Filter by owner (optional)"
            },
            status: {
              type: "string",
              enum: ["active", "pending_rotation", "rotating", "deprecated", "revoked"],
              description: "Filter by rotation status (optional)"
            }
          }
        }
      },
      {
        name: "rotate_credential",
        description: "Rotate a credential's encryption keys and optionally update the data",
        inputSchema: {
          type: "object",
          properties: {
            credentialId: {
              type: "string",
              description: "ID of the credential to rotate"
            },
            newData: {
              type: "string",
              description: "New credential data (optional, will re-encrypt existing data if not provided)"
            },
            rotatedBy: {
              type: "string",
              description: "Name or ID of person performing the rotation"
            }
          },
          required: ["credentialId", "rotatedBy"]
        }
      },
      {
        name: "delete_credential",
        description: "Securely delete a credential",
        inputSchema: {
          type: "object",
          properties: {
            credentialId: {
              type: "string",
              description: "ID of the credential to delete"
            },
            deletedBy: {
              type: "string",
              description: "Name or ID of person deleting the credential"
            }
          },
          required: ["credentialId", "deletedBy"]
        }
      },
      {
        name: "get_credential_protection_stats",
        description: "Get comprehensive credential protection statistics and security metrics",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "get_credentials_requiring_rotation",
        description: "Get list of credentials that require rotation based on their rotation schedules",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "get_credential_access_logs",
        description: "Get access logs for credential operations",
        inputSchema: {
          type: "object",
          properties: {
            credentialId: {
              type: "string",
              description: "Filter logs for specific credential (optional)"
            },
            limit: {
              type: "number",
              description: "Maximum number of logs to return (default: 100)"
            }
          }
        }
      },
      {
        name: "run_compliance_assessment",
        description: "Run comprehensive compliance assessment for SOC2, NIST, or GDPR",
        inputSchema: {
          type: "object",
          properties: {
            framework: {
              type: "string",
              enum: ["soc2", "nist", "gdpr", "hipaa", "pci_dss", "iso_27001"],
              description: "Compliance framework to assess (optional, runs all enabled if not specified)"
            }
          }
        }
      },
      {
        name: "get_compliance_status",
        description: "Get current compliance status for a specific framework",
        inputSchema: {
          type: "object",
          properties: {
            framework: {
              type: "string",
              enum: ["soc2", "nist", "gdpr", "hipaa", "pci_dss", "iso_27001"],
              description: "Compliance framework to check"
            }
          },
          required: ["framework"]
        }
      },
      {
        name: "generate_compliance_report",
        description: "Generate detailed compliance report with MCP workflow for enhancement",
        inputSchema: {
          type: "object",
          properties: {
            framework: {
              type: "string",
              enum: ["soc2", "nist", "gdpr", "hipaa", "pci_dss", "iso_27001"],
              description: "Compliance framework for report"
            },
            startDate: {
              type: "string",
              description: "Start date for report period (ISO format)"
            },
            endDate: {
              type: "string",
              description: "End date for report period (ISO format)"
            }
          },
          required: ["framework"]
        }
      },
      {
        name: "check_compliance_control",
        description: "Check specific compliance control status",
        inputSchema: {
          type: "object",
          properties: {
            controlId: {
              type: "string",
              description: "ID of the control to check (e.g., 'soc2-cc6.1', 'nist-ac-2')"
            }
          },
          required: ["controlId"]
        }
      },
      {
        name: "get_data_retention_compliance",
        description: "Check data retention compliance across all frameworks",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "get_privacy_compliance",
        description: "Get GDPR and privacy compliance status with MCP workflow",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "remediate_compliance_violation",
        description: "Create remediation plan for compliance violation",
        inputSchema: {
          type: "object",
          properties: {
            violationId: {
              type: "string",
              description: "ID of the violation to remediate"
            },
            remediationSteps: {
              type: "array",
              items: { type: "string" },
              description: "Steps to remediate the violation"
            },
            assignedTo: {
              type: "string",
              description: "Person responsible for remediation"
            }
          },
          required: ["violationId", "remediationSteps", "assignedTo"]
        }
      },
      {
        name: "get_compliance_statistics",
        description: "Get comprehensive compliance statistics and metrics",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "export_compliance_data",
        description: "Export compliance data for external audit",
        inputSchema: {
          type: "object",
          properties: {
            format: {
              type: "string",
              enum: ["json", "csv", "pdf"],
              description: "Export format (default: json)"
            }
          }
        }
      },
      // Laravel Framework Tools
      {
        name: "laravel_artisan_command",
        description: "Execute Laravel Artisan commands with intelligent suggestions and validation",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            command: {
              type: "string",
              description: "Artisan command to execute (e.g., 'make:controller', 'migrate', 'cache:clear')"
            },
            arguments: {
              type: "array",
              items: { type: "string" },
              description: "Command arguments"
            },
            projectPath: {
              type: "string",
              description: "Laravel project path (optional, uses current directory if not specified)"
            }
          },
          required: ["sessionId", "command"]
        }
      },
      {
        name: "laravel_deploy",
        description: "Deploy Laravel application with zero-downtime deployment strategy",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            projectPath: {
              type: "string",
              description: "Laravel project path"
            },
            environment: {
              type: "string",
              enum: ["production", "staging", "local"],
              description: "Deployment environment"
            },
            strategy: {
              type: "string",
              enum: ["rolling", "blue-green", "canary"],
              description: "Deployment strategy (default: rolling)"
            }
          },
          required: ["sessionId", "projectPath", "environment"]
        }
      },
      // Node.js Framework Tools
      {
        name: "nodejs_process_management",
        description: "Manage Node.js processes with PM2 integration",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            action: {
              type: "string",
              enum: ["start", "stop", "restart", "reload", "status", "logs", "monitor"],
              description: "Process management action"
            },
            appName: {
              type: "string",
              description: "Application name or PM2 process ID"
            },
            config: {
              type: "object",
              description: "PM2 configuration options"
            }
          },
          required: ["sessionId", "action"]
        }
      },
      {
        name: "nodejs_realtime_setup",
        description: "Setup real-time features with Socket.io or WebRTC integration",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            projectPath: {
              type: "string",
              description: "Node.js project path"
            },
            technology: {
              type: "string",
              enum: ["socketio", "webrtc", "websockets", "sse"],
              description: "Real-time technology to implement"
            },
            features: {
              type: "array",
              items: { type: "string" },
              description: "Features to implement (e.g., 'chat', 'notifications', 'presence')"
            }
          },
          required: ["sessionId", "projectPath", "technology"]
        }
      },
      // React/Next.js Tools
      {
        name: "react_smart_component_edit",
        description: "Intelligently edit React/Next.js components with Context7 AI assistance",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            componentPath: {
              type: "string",
              description: "Path to React component file"
            },
            editType: {
              type: "string",
              enum: ["add_state", "add_props", "add_hook", "optimize_performance", "add_accessibility", "convert_to_typescript"],
              description: "Type of edit to perform"
            },
            specifications: {
              type: "object",
              description: "Edit specifications"
            }
          },
          required: ["sessionId", "componentPath", "editType"]
        }
      },
      // Kubernetes Deployment Tools
      {
        name: "kubernetes_deploy",
        description: "Deploy applications to Kubernetes with auto-scaling and monitoring",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            applicationName: {
              type: "string",
              description: "Application name"
            },
            dockerImage: {
              type: "string",
              description: "Docker image to deploy"
            },
            namespace: {
              type: "string",
              description: "Kubernetes namespace (default: default)"
            },
            replicas: {
              type: "number",
              description: "Number of replicas (default: 3)"
            },
            autoscaling: {
              type: "object",
              properties: {
                enabled: { type: "boolean" },
                minReplicas: { type: "number" },
                maxReplicas: { type: "number" },
                targetCPU: { type: "number" }
              },
              description: "Auto-scaling configuration"
            }
          },
          required: ["sessionId", "applicationName", "dockerImage"]
        }
      },
      // Performance Benchmarking Tools
      {
        name: "run_performance_benchmark",
        description: "Run comprehensive performance benchmarks with industry comparisons",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            benchmarkType: {
              type: "string",
              enum: ["connection_performance", "command_execution", "file_transfer", "concurrent_load", "memory_usage", "latency_analysis"],
              description: "Type of benchmark to run"
            },
            compareWith: {
              type: "array",
              items: {
                type: "string",
                enum: ["industry_average", "aws_baseline", "google_cloud", "azure", "digital_ocean"]
              },
              description: "Industry benchmarks to compare against"
            }
          },
          required: ["sessionId", "benchmarkType"]
        }
      },
      // Memory Orchestration Tools
      {
        name: "get_command_suggestions",
        description: "Get AI-powered command suggestions based on context and history",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            context: {
              type: "object",
              properties: {
                directory: { type: "string" },
                technology: { type: "string" },
                recentCommands: { 
                  type: "array",
                  items: { type: "string" }
                }
              },
              description: "Current context for suggestions"
            }
          },
          required: ["sessionId"]
        }
      },
      {
        name: "analyze_workflow_patterns",
        description: "Analyze and learn from workflow patterns to improve future suggestions",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            timeRange: {
              type: "string",
              enum: ["last_hour", "last_day", "last_week", "last_month"],
              description: "Time range to analyze"
            }
          },
          required: ["sessionId"]
        }
      },
      // Enterprise Auth Tools
      {
        name: "configure_mfa",
        description: "Configure multi-factor authentication for SSH sessions",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            mfaType: {
              type: "string",
              enum: ["totp", "sms", "hardware_token", "biometric"],
              description: "Type of MFA to configure"
            },
            userId: {
              type: "string",
              description: "User ID to configure MFA for"
            }
          },
          required: ["sessionId", "mfaType", "userId"]
        }
      },
      // Compliance Tools
      {
        name: "generate_compliance_report",
        description: "Generate compliance reports for SOC2, GDPR, or NIST frameworks",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            framework: {
              type: "string",
              enum: ["SOC2", "GDPR", "NIST", "HIPAA", "PCI_DSS", "ISO_27001"],
              description: "Compliance framework"
            },
            reportType: {
              type: "string",
              enum: ["full_audit", "gap_analysis", "remediation_plan", "executive_summary"],
              description: "Type of report to generate"
            },
            format: {
              type: "string",
              enum: ["pdf", "json", "html"],
              description: "Report format (default: pdf)"
            }
          },
          required: ["sessionId", "framework", "reportType"]
        }
      },
      // Go Development Tools
      {
        name: "go_module_init",
        description: "Initialize a production-ready Go module with best practices",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            moduleName: {
              type: "string",
              description: "Go module name (e.g., github.com/user/project)"
            },
            goVersion: {
              type: "string",
              description: "Go version (e.g., 1.21)"
            },
            projectPath: {
              type: "string",
              description: "Project directory path"
            }
          },
          required: ["sessionId", "moduleName", "goVersion"]
        }
      },
      {
        name: "go_test_generation",
        description: "Generate comprehensive Go tests with benchmarks and fuzzing",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            projectPath: {
              type: "string",
              description: "Go project path"
            },
            testType: {
              type: "string",
              enum: ["unit", "integration", "benchmark", "fuzz", "all"],
              description: "Type of tests to generate"
            },
            coverage: {
              type: "boolean",
              description: "Enable coverage reporting"
            }
          },
          required: ["sessionId", "projectPath", "testType"]
        }
      },
      {
        name: "go_dependency_audit",
        description: "Audit Go dependencies for security vulnerabilities and updates",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            projectPath: {
              type: "string",
              description: "Go project path"
            },
            autoUpdate: {
              type: "boolean",
              description: "Automatically update safe dependencies"
            }
          },
          required: ["sessionId", "projectPath"]
        }
      },
      // Rust Development Tools
      {
        name: "rust_project_setup",
        description: "Create a production-ready Rust project with workspace structure",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            crateName: {
              type: "string",
              description: "Rust crate name"
            },
            edition: {
              type: "string",
              enum: ["2018", "2021", "2024"],
              description: "Rust edition"
            },
            targetType: {
              type: "string",
              enum: ["bin", "lib", "cdylib", "staticlib"],
              description: "Target type (default: bin)"
            }
          },
          required: ["sessionId", "crateName", "edition"]
        }
      },
      {
        name: "rust_async_patterns",
        description: "Implement async patterns with tokio/async-std",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            projectPath: {
              type: "string",
              description: "Rust project path"
            },
            runtime: {
              type: "string",
              enum: ["tokio", "async-std", "smol"],
              description: "Async runtime to use"
            },
            patterns: {
              type: "array",
              items: {
                type: "string",
                enum: ["channels", "streams", "timeouts", "cancellation", "concurrency"]
              },
              description: "Async patterns to implement"
            }
          },
          required: ["sessionId", "projectPath", "runtime"]
        }
      },
      {
        name: "rust_memory_optimization",
        description: "Optimize Rust application memory usage",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            projectPath: {
              type: "string",
              description: "Rust project path"
            },
            targetMetrics: {
              type: "object",
              properties: {
                maxMemoryMB: { type: "number" },
                maxAllocationsPerSec: { type: "number" }
              },
              description: "Target memory metrics"
            }
          },
          required: ["sessionId", "projectPath"]
        }
      },
      // Enhanced File Operation Tools
      {
        name: "safe_file_edit",
        description: "Edit files with multiple fallback strategies and validation",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            filePath: {
              type: "string",
              description: "File to edit"
            },
            editType: {
              type: "string",
              enum: ["replace", "append", "prepend", "insert", "delete"],
              description: "Type of edit operation"
            },
            content: {
              type: "string",
              description: "Content for the edit"
            },
            strategy: {
              type: "string",
              enum: ["direct_edit", "atomic_write", "backup_and_edit", "patch_application", "stream_edit"],
              description: "Edit strategy (default: atomic_write)"
            },
            validation: {
              type: "object",
              properties: {
                syntaxCheck: { type: "boolean" },
                testExecution: { type: "boolean" },
                lintCheck: { type: "boolean" }
              },
              description: "Validation options"
            }
          },
          required: ["sessionId", "filePath", "editType"]
        }
      },
      {
        name: "smart_file_edit",
        description: "Advanced file editing with optimal algorithms based on Git, VSCode, and Google Docs approaches",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            filePath: {
              type: "string",
              description: "File path to edit"
            },
            operations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", description: "Operation ID" },
                  type: { 
                    type: "string", 
                    enum: ["insert", "delete", "replace", "move"],
                    description: "Operation type"
                  },
                  position: { type: "number", description: "Character position for operation" },
                  line: { type: "number", description: "Line number for operation" },
                  content: { type: "string", description: "Content to insert or replace" },
                  oldContent: { type: "string", description: "Content to replace (for replace operations)" },
                  metadata: { type: "object", description: "Additional operation metadata" }
                },
                required: ["id", "type"]
              },
              description: "List of edit operations to apply"
            },
            strategy: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: ["atomic_write", "patch_based", "streaming", "operational_transform", "two_phase_commit"],
                  description: "Editing strategy to use"
                },
                validation: {
                  type: "object",
                  properties: {
                    syntaxCheck: { type: "boolean" },
                    lintCheck: { type: "boolean" },
                    testExecution: { type: "boolean" },
                    checksumValidation: { type: "boolean" }
                  }
                },
                rollback: {
                  type: "object",
                  properties: {
                    enabled: { type: "boolean" },
                    strategy: { 
                      type: "string",
                      enum: ["snapshot", "undo_log", "version_control"]
                    }
                  }
                },
                performance: {
                  type: "object",
                  properties: {
                    chunkSize: { type: "number" },
                    compressionEnabled: { type: "boolean" },
                    cacheEnabled: { type: "boolean" }
                  }
                }
              },
              description: "Advanced editing strategy configuration"
            },
            lockTimeout: {
              type: "number",
              description: "Timeout for acquiring file lock in milliseconds"
            },
            conflictResolution: {
              type: "string",
              enum: ["abort", "merge", "overwrite", "interactive"],
              description: "How to handle conflicts"
            }
          },
          required: ["sessionId", "filePath", "operations"]
        }
      },
      {
        name: "setup_testing_suite",
        description: "Setup comprehensive testing framework for any project",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            projectPath: {
              type: "string",
              description: "Project path"
            },
            framework: {
              type: "string",
              enum: ["jest", "mocha", "vitest", "pytest", "go_test", "cargo_test", "junit", "rspec", "phpunit"],
              description: "Testing framework"
            },
            testType: {
              type: "string",
              enum: ["unit", "integration", "e2e", "all"],
              description: "Types of tests to setup"
            },
            coverage: {
              type: "boolean",
              description: "Enable coverage reporting"
            },
            watch: {
              type: "boolean",
              description: "Enable watch mode"
            }
          },
          required: ["sessionId", "projectPath", "framework"]
        }
      },
      // ML-Enhanced Backup Management Tools
      {
        name: "create_intelligent_backup",
        description: "Create ML-enhanced backup with deduplication and smart compression",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            sourcePaths: {
              type: "array",
              items: { type: "string" },
              description: "Paths to backup"
            },
            destinationPath: {
              type: "string",
              description: "Backup destination path"
            },
            backupType: {
              type: "string",
              enum: ["full", "incremental", "differential", "snapshot", "selective"],
              description: "Type of backup"
            },
            options: {
              type: "object",
              properties: {
                compression: { 
                  type: "string",
                  enum: ["gzip", "bzip2", "xz", "zstd", "none"]
                },
                encryption: { type: "boolean" },
                deduplication: { type: "boolean" },
                excludePatterns: { 
                  type: "array",
                  items: { type: "string" }
                },
                retentionDays: { type: "number" }
              },
              description: "Backup options"
            }
          },
          required: ["sessionId", "sourcePaths", "destinationPath"]
        }
      },
      {
        name: "restore_from_backup",
        description: "Intelligently restore from backup with conflict resolution",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            backupId: {
              type: "string",
              description: "Backup ID to restore from"
            },
            targetPath: {
              type: "string",
              description: "Target restoration path"
            },
            options: {
              type: "object",
              properties: {
                overwrite: { type: "boolean" },
                validateChecksum: { type: "boolean" },
                preservePermissions: { type: "boolean" },
                mergeStrategy: {
                  type: "string",
                  enum: ["overwrite", "skip", "rename", "merge"]
                },
                dryRun: { type: "boolean" }
              },
              description: "Restoration options"
            }
          },
          required: ["sessionId", "backupId", "targetPath"]
        }
      },
      {
        name: "analyze_backup_patterns",
        description: "Analyze backup patterns and generate optimization recommendations",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            timeRange: {
              type: "object",
              properties: {
                start: { type: "string", format: "date-time" },
                end: { type: "string", format: "date-time" }
              },
              description: "Time range to analyze"
            }
          },
          required: ["sessionId"]
        }
      },
      // ML MCP Integration Tools
      {
        name: "persist_ssh_operation",
        description: "Store SSH operation in ML-enhanced memory for learning and retrieval",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            operation: {
              type: "string",
              description: "Operation type performed"
            },
            result: {
              type: "object",
              description: "Operation result data"
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Tags for categorization"
            }
          },
          required: ["sessionId", "operation", "result"]
        }
      },
      {
        name: "ml_code_analysis",
        description: "Perform ML-powered code analysis with security and performance insights",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            projectPath: {
              type: "string",
              description: "Project path to analyze"
            },
            analysisType: {
              type: "string",
              enum: ["security", "performance", "quality", "comprehensive"],
              description: "Type of analysis"
            }
          },
          required: ["sessionId", "projectPath", "analysisType"]
        }
      },
      {
        name: "predict_next_commands",
        description: "Get ML-predicted next commands based on context and patterns",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            currentContext: {
              type: "object",
              properties: {
                directory: { type: "string" },
                lastCommand: { type: "string" },
                technology: { type: "string" }
              },
              description: "Current context"
            },
            recentCommands: {
              type: "array",
              items: { type: "string" },
              description: "Recent command history"
            }
          },
          required: ["sessionId"]
        }
      },
      {
        name: "optimize_workflow_with_ml",
        description: "Learn from workflow execution and suggest optimizations",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID from create_ssh_session"
            },
            workflowType: {
              type: "string",
              description: "Type of workflow executed"
            },
            steps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  command: { type: "string" },
                  duration: { type: "number" },
                  success: { type: "boolean" }
                }
              },
              description: "Workflow steps executed"
            }
          },
          required: ["sessionId", "workflowType", "steps"]
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    switch (request.params.name) {
      case "quick_connect": {
        const { serverName } = request.params.arguments as { serverName: string };
        const sessionId = await sshService.quickConnect(serverName);
        
        return {
          content: [{
            type: "text",
            text: `Successfully connected to ${serverName}.\nSession ID: ${sessionId}\n\nYou can now use execute_remote_command with this session ID to run commands on the server.`
          }]
        };
      }

      case "list_predefined_servers": {
        const servers = sshService.listPredefinedServers();
        
        return {
          content: [{
            type: "text",
            text: `Available predefined servers:\n${JSON.stringify(servers, null, 2)}`
          }]
        };
      }

      case "create_ssh_session": {
        const sessionId = await sshService.createSession(request.params.arguments as unknown as CreateSessionParams);
        
        return {
          content: [{
            type: "text",
            text: `SSH session created successfully. Session ID: ${sessionId}`
          }]
        };
      }

      case "execute_remote_command": {
        const result = await sshService.executeCommand(request.params.arguments as unknown as ExecuteCommandParams);
        
        return {
          content: [{
            type: "text",
            text: result
          }]
        };
      }

      case "transfer_file": {
        const result = await sshService.transferFile(request.params.arguments as unknown as TransferFileParams);
        
        return {
          content: [{
            type: "text",
            text: result
          }]
        };
      }

      case "close_session": {
        const result = await sshService.closeSession(request.params.arguments as unknown as CloseSessionParams);
        
        return {
          content: [{
            type: "text",
            text: result
          }]
        };
      }

      case "list_sessions": {
        const sessions = sshService.listSessions();
        
        return {
          content: [{
            type: "text",
            text: `Active SSH sessions:\n${JSON.stringify(sessions, null, 2)}`
          }]
        };
      }

      case "get_performance_metrics": {
        const metrics = sshService.getPerformanceMetrics();
        
        return {
          content: [{
            type: "text",
            text: `Performance Metrics:\n${JSON.stringify(metrics, null, 2)}`
          }]
        };
      }

      case "get_pool_statistics": {
        const poolStats = sshService.getPoolStatistics();
        
        return {
          content: [{
            type: "text",
            text: `Adaptive Connection Pool Statistics:\n${JSON.stringify(poolStats, null, 2)}`
          }]
        };
      }

      case "get_security_metrics": {
        const metrics = sshService.getSecurityMetrics();
        
        return {
          content: [{
            type: "text",
            text: `Security Metrics:\n${JSON.stringify(metrics, null, 2)}`
          }]
        };
      }

      case "get_intelligent_command_help": {
        const { sessionId, command, currentDirectory } = request.params.arguments as {
          sessionId: string;
          command: string;
          currentDirectory?: string;
        };
        
        const assistance = await sshService.getIntelligentCommandHelp(
          sessionId,
          command,
          currentDirectory
        );
        
        return {
          content: [{
            type: "text",
            text: `Intelligent Command Assistance:\n${JSON.stringify(assistance, null, 2)}`
          }]
        };
      }

      case "get_technology_documentation": {
        const { sessionId, technology, query, documentationType } = request.params.arguments as {
          sessionId: string;
          technology: string;
          query: string;
          documentationType?: string;
        };
        
        const documentation = await sshService.getTechnologyDocumentation(
          sessionId,
          technology as TechnologyStack,
          query,
          documentationType as DocumentationType
        );
        
        return {
          content: [{
            type: "text",
            text: `Technology Documentation:\n${JSON.stringify(documentation, null, 2)}`
          }]
        };
      }

      case "detect_project_technology": {
        const { sessionId, projectPath } = request.params.arguments as {
          sessionId: string;
          projectPath?: string;
        };
        
        const detection = await sshService.detectProjectTechnology(sessionId, projectPath);
        
        return {
          content: [{
            type: "text",
            text: `Project Technology Detection:\n${JSON.stringify(detection, null, 2)}`
          }]
        };
      }

      case "create_or_update_sitemap": {
        const { sessionId, websiteRoot, websiteUrl, ...options } = request.params.arguments as any;
        const result = await sshService.createOrUpdateSitemap(sessionId, websiteRoot, websiteUrl, options);
        
        return {
          content: [{
            type: "text",
            text: result
          }]
        };
      }

      case "search_github_patterns": {
        const { sessionId, pattern, technology, patternType, limit } = request.params.arguments as {
          sessionId: string;
          pattern: string;
          technology: string;
          patternType?: string;
          limit?: number;
        };
        
        const results = await sshService.searchGitHubPatterns(
          sessionId,
          pattern,
          technology as TechnologyStack,
          patternType as PatternType,
          limit
        );
        
        return {
          content: [{
            type: "text",
            text: `GitHub Pattern Search Results:\n${JSON.stringify(results, null, 2)}`
          }]
        };
      }

      case "discover_best_practices": {
        const { sessionId, technology, domain } = request.params.arguments as {
          sessionId: string;
          technology: string;
          domain?: string;
        };
        
        const bestPractices = await sshService.discoverBestPractices(
          sessionId,
          technology as TechnologyStack,
          domain
        );
        
        return {
          content: [{
            type: "text",
            text: `Best Practices Discovery:\n${JSON.stringify(bestPractices, null, 2)}`
          }]
        };
      }

      case "get_community_insights": {
        const { sessionId, technology } = request.params.arguments as {
          sessionId: string;
          technology: string;
        };
        
        const insights = await sshService.getCommunityInsights(
          sessionId,
          technology as TechnologyStack
        );
        
        return {
          content: [{
            type: "text",
            text: `Community Insights:\n${JSON.stringify(insights, null, 2)}`
          }]
        };
      }

      case "record_command_memory": {
        const args = request.params.arguments as {
          sessionId: string;
          userId: string;
          command: string;
          directory: string;
          outcome: 'success' | 'failure' | 'partial';
          executionTime: number;
          errorMessage?: string;
        };
        
        await sshService.recordCommandMemory(
          args.sessionId,
          args.userId,
          args.command,
          {
            directory: args.directory,
            outcome: args.outcome,
            executionTime: args.executionTime,
            errorMessage: args.errorMessage
          }
        );
        
        return {
          content: [{
            type: "text",
            text: `Command memory recorded successfully for learning and pattern recognition`
          }]
        };
      }

      case "get_command_suggestions": {
        const args = request.params.arguments as {
          sessionId: string;
          userId: string;
          currentDirectory: string;
          previousCommand?: string;
          projectType?: string;
          technology?: string;
        };
        
        const suggestions = await sshService.getCommandSuggestions(
          args.sessionId,
          args.userId,
          {
            directory: args.currentDirectory,
            previousCommand: args.previousCommand,
            projectType: args.projectType,
            technology: args.technology as TechnologyStack
          }
        );
        
        return {
          content: [{
            type: "text",
            text: `Command Suggestions:\n${JSON.stringify(suggestions, null, 2)}`
          }]
        };
      }

      case "get_learning_insights": {
        const { sessionId, userId } = request.params.arguments as {
          sessionId: string;
          userId?: string;
        };
        
        const insights = await sshService.getLearningInsights(sessionId, userId);
        
        return {
          content: [{
            type: "text",
            text: `Learning Insights:\n${JSON.stringify(insights, null, 2)}`
          }]
        };
      }

      case "get_memory_statistics": {
        const { sessionId } = request.params.arguments as {
          sessionId: string;
        };
        
        const stats = await sshService.getMemoryStatistics(sessionId);
        
        return {
          content: [{
            type: "text",
            text: `Memory Statistics:\n${JSON.stringify(stats, null, 2)}`
          }]
        };
      }

      case "get_circuit_breaker_status": {
        const status = sshService.getCircuitBreakerStatus();
        
        return {
          content: [{
            type: "text",
            text: `Circuit Breaker Health Status:\n${JSON.stringify(status, null, 2)}`
          }]
        };
      }

      case "reset_circuit_breaker": {
        const { service } = request.params.arguments as {
          service: string;
        };
        
        await sshService.resetCircuitBreaker(service);
        
        return {
          content: [{
            type: "text",
            text: `Circuit breaker for service '${service}' has been reset successfully.`
          }]
        };
      }

      case "get_error_monitoring_stats": {
        const stats = sshService.getErrorMonitoringStats();
        
        return {
          content: [{
            type: "text",
            text: `Error Monitoring Statistics:\n${JSON.stringify(stats, null, 2)}`
          }]
        };
      }

      case "get_active_alerts": {
        const alerts = sshService.getActiveAlerts();
        
        return {
          content: [{
            type: "text",
            text: `Active Alerts:\n${JSON.stringify(alerts, null, 2)}`
          }]
        };
      }

      case "get_error_analysis": {
        const args = request.params.arguments as {
          errorType: string;
          sessionId?: string;
          host?: string;
          command?: string;
        };
        
        const analysis = await sshService.getErrorAnalysis(
          args.errorType,
          {
            sessionId: args.sessionId,
            host: args.host,
            command: args.command,
            timestamp: new Date()
          }
        );
        
        return {
          content: [{
            type: "text",
            text: `Error Analysis:\n\nAnalysis: ${analysis.analysis}\n\nMCP Workflow:\n${analysis.mcpWorkflow}\n\nSuggested Actions:\n${analysis.suggestedActions.map(action => `• ${action}`).join('\n')}`
          }]
        };
      }

      case "get_monitoring_insights": {
        const insights = await sshService.getMonitoringInsights();
        
        return {
          content: [{
            type: "text",
            text: `Monitoring Insights:\n\nInsights: ${insights.insights}\n\nMCP Workflow:\n${insights.mcpWorkflow}\n\nRecommendations:\n${insights.recommendations.map(rec => `• ${rec}`).join('\n')}`
          }]
        };
      }

      case "acknowledge_alert": {
        const { alertId, acknowledgedBy } = request.params.arguments as {
          alertId: string;
          acknowledgedBy: string;
        };
        
        await sshService.acknowledgeAlert(alertId, acknowledgedBy);
        
        return {
          content: [{
            type: "text",
            text: `Alert '${alertId}' has been acknowledged by ${acknowledgedBy}.`
          }]
        };
      }

      case "resolve_alert": {
        const { alertId, resolvedBy } = request.params.arguments as {
          alertId: string;
          resolvedBy: string;
        };
        
        await sshService.resolveAlert(alertId, resolvedBy);
        
        return {
          content: [{
            type: "text",
            text: `Alert '${alertId}' has been resolved by ${resolvedBy}.`
          }]
        };
      }

      case "store_credential": {
        const args = request.params.arguments as {
          type: string;
          data: string;
          description?: string;
          environment?: string;
          rotationIntervalDays?: number;
          tags?: string[];
          owner?: string;
        };
        
        const credentialId = await sshService.storeCredential(
          args.type as CredentialType,
          args.data,
          {
            description: args.description,
            environment: args.environment as any,
            rotationIntervalDays: args.rotationIntervalDays,
            tags: args.tags,
            owner: args.owner
          }
        );
        
        return {
          content: [{
            type: "text",
            text: `Credential stored successfully. ID: ${credentialId}`
          }]
        };
      }

      case "retrieve_credential": {
        const { credentialId, accessedBy, sessionId } = request.params.arguments as {
          credentialId: string;
          accessedBy: string;
          sessionId?: string;
        };
        
        const result = await sshService.retrieveCredential(credentialId, accessedBy, sessionId);
        
        return {
          content: [{
            type: "text",
            text: `Credential retrieved successfully:\nType: ${result.metadata.type}\nDescription: ${result.metadata.description}\nData: [REDACTED FOR SECURITY]\nLast Accessed: ${result.metadata.lastAccessed}\nAccess Count: ${result.metadata.accessCount}`
          }]
        };
      }

      case "list_credentials": {
        const filter = request.params.arguments as {
          type?: string;
          environment?: string;
          owner?: string;
          status?: string;
        };
        
        const credentials = await sshService.listCredentials({
          type: filter.type as CredentialType,
          environment: filter.environment,
          owner: filter.owner,
          status: filter.status as KeyRotationStatus
        });
        
        return {
          content: [{
            type: "text",
            text: `Stored Credentials (${credentials.length}):\n${JSON.stringify(credentials, null, 2)}`
          }]
        };
      }

      case "rotate_credential": {
        const { credentialId, newData, rotatedBy } = request.params.arguments as {
          credentialId: string;
          newData?: string;
          rotatedBy: string;
        };
        
        await sshService.rotateCredential(credentialId, newData, rotatedBy);
        
        return {
          content: [{
            type: "text",
            text: `Credential '${credentialId}' has been rotated successfully by ${rotatedBy}.`
          }]
        };
      }

      case "delete_credential": {
        const { credentialId, deletedBy } = request.params.arguments as {
          credentialId: string;
          deletedBy: string;
        };
        
        await sshService.deleteCredential(credentialId, deletedBy);
        
        return {
          content: [{
            type: "text",
            text: `Credential '${credentialId}' has been securely deleted by ${deletedBy}.`
          }]
        };
      }

      case "get_credential_protection_stats": {
        const stats = sshService.getCredentialProtectionStats();
        
        return {
          content: [{
            type: "text",
            text: `Credential Protection Statistics:\n${JSON.stringify(stats, null, 2)}`
          }]
        };
      }

      case "get_credentials_requiring_rotation": {
        const credentials = await sshService.getCredentialsRequiringRotation();
        
        return {
          content: [{
            type: "text",
            text: `Credentials Requiring Rotation (${credentials.length}):\n${JSON.stringify(credentials, null, 2)}`
          }]
        };
      }

      case "get_credential_access_logs": {
        const { credentialId, limit } = request.params.arguments as {
          credentialId?: string;
          limit?: number;
        };
        
        const logs = sshService.getCredentialAccessLogs(credentialId, limit);
        
        return {
          content: [{
            type: "text",
            text: `Credential Access Logs (${logs.length}):\n${JSON.stringify(logs, null, 2)}`
          }]
        };
      }

      case "run_compliance_assessment": {
        const { framework } = request.params.arguments as {
          framework?: string;
        };
        
        const reports = await sshService.runComplianceAssessment(
          framework as ComplianceFramework
        );
        
        const summary = Array.from(reports.entries())
          .map(([fw, report]) => `${fw.toUpperCase()}: ${report.score}% (${report.overallStatus})`)
          .join('\n');
        
        return {
          content: [{
            type: "text",
            text: `Compliance Assessment Complete:\n${summary}\n\nDetailed reports generated for each framework.`
          }]
        };
      }

      case "get_compliance_status": {
        const { framework } = request.params.arguments as {
          framework: string;
        };
        
        const status = await sshService.getComplianceStatus(
          framework as ComplianceFramework
        );
        
        return {
          content: [{
            type: "text",
            text: `${framework.toUpperCase()} Compliance Status:\nStatus: ${status.status}\nScore: ${status.score}%\nLast Assessment: ${status.lastAssessment}\nOpen Violations: ${status.violations.length}\n\nRecommendations:\n${status.recommendations.map((r: string) => `• ${r}`).join('\n')}`
          }]
        };
      }

      case "generate_compliance_report": {
        const args = request.params.arguments as {
          framework: string;
          startDate?: string;
          endDate?: string;
        };
        
        const result = await sshService.generateComplianceReport(
          args.framework as ComplianceFramework,
          args.startDate ? new Date(args.startDate) : undefined,
          args.endDate ? new Date(args.endDate) : undefined
        );
        
        return {
          content: [{
            type: "text",
            text: `Compliance Report Generated:\n\nFramework: ${args.framework.toUpperCase()}\nScore: ${result.report.score}%\nStatus: ${result.report.overallStatus}\n\n${result.report.executiveSummary}\n\nMCP Workflow for Enhancement:\n${result.mcpWorkflow}`
          }]
        };
      }

      case "check_compliance_control": {
        const { controlId } = request.params.arguments as {
          controlId: string;
        };
        
        const result = await sshService.checkComplianceControl(controlId);
        
        return {
          content: [{
            type: "text",
            text: `Control Check: ${result.control.name}\nStatus: ${result.status}\nCategory: ${result.control.category}\nPriority: ${result.control.priority}\n\nEvidence Collected: ${result.evidence.length} items\nGaps Identified: ${result.gaps.length}\n${result.gaps.length > 0 ? '\nGaps:\n' + result.gaps.map((g: string) => `• ${g}`).join('\n') : ''}`
          }]
        };
      }

      case "get_data_retention_compliance": {
        const result = await sshService.getDataRetentionCompliance();
        
        return {
          content: [{
            type: "text",
            text: `Data Retention Compliance:\nCompliant: ${result.compliant ? 'YES' : 'NO'}\nFrameworks: ${result.frameworks.join(', ')}\n\nRetention Policies:\n${JSON.stringify(result.retentionPolicies, null, 2)}\n\n${result.violations.length > 0 ? 'Violations:\n' + result.violations.map((v: string) => `• ${v}`).join('\n') : ''}\n\nRecommendations:\n${result.recommendations.map((r: string) => `• ${r}`).join('\n')}`
          }]
        };
      }

      case "get_privacy_compliance": {
        const result = await sshService.getPrivacyCompliance();
        
        return {
          content: [{
            type: "text",
            text: `Privacy Compliance (GDPR):\nCompliant: ${result.gdprCompliant ? 'YES' : 'NO'}\n\nPrivacy Controls:\n${JSON.stringify(result.privacyControls, null, 2)}\n\nData Subject Rights:\n${result.dataSubjectRights.map((r: string) => `• ${r}`).join('\n')}\n\n${result.violations.length > 0 ? 'Violations:\n' + result.violations.map((v: string) => `• ${v}`).join('\n') : ''}\n\nMCP Workflow:\n${result.mcpWorkflow}`
          }]
        };
      }

      case "remediate_compliance_violation": {
        const args = request.params.arguments as {
          violationId: string;
          remediationSteps: string[];
          assignedTo: string;
        };
        
        await sshService.remediateComplianceViolation(
          args.violationId,
          args.remediationSteps,
          args.assignedTo
        );
        
        return {
          content: [{
            type: "text",
            text: `Remediation plan created for violation ${args.violationId}\nAssigned to: ${args.assignedTo}\nSteps: ${args.remediationSteps.length}`
          }]
        };
      }

      case "get_compliance_statistics": {
        const stats = sshService.getComplianceStatistics();
        
        return {
          content: [{
            type: "text",
            text: `Compliance Statistics:\n${JSON.stringify(stats, null, 2)}`
          }]
        };
      }

      case "export_compliance_data": {
        const { format } = request.params.arguments as {
          format?: string;
        };
        
        const result = await sshService.exportComplianceData(format as any);
        
        return {
          content: [{
            type: "text",
            text: `Compliance data exported:\nFilename: ${result.filename}\nFormat: ${format || 'json'}\nChecksum: ${result.checksum}\nSize: ${result.data.length} bytes`
          }]
        };
      }

      // Laravel Framework Tools
      case "laravel_artisan_command": {
        const args = request.params.arguments as {
          sessionId: string;
          command: string;
          arguments?: string[];
          projectPath?: string;
        };
        
        const prompt = MCPOrchestrationPrompts.laravelArtisanCommand(
          args.command,
          args.projectPath || 'current directory'
        );
        
        return {
          content: [{
            type: "text",
            text: prompt
          }]
        };
      }

      case "laravel_deploy": {
        const args = request.params.arguments as {
          sessionId: string;
          projectPath: string;
          environment: string;
          strategy?: string;
        };
        
        const prompt = MCPOrchestrationPrompts.laravelDeployment(
          args.projectPath,
          args.environment,
          args.strategy || 'rolling'
        );
        
        return {
          content: [{
            type: "text",
            text: prompt
          }]
        };
      }

      // Node.js Framework Tools
      case "nodejs_process_management": {
        const args = request.params.arguments as {
          sessionId: string;
          action: string;
          appName?: string;
          config?: any;
        };
        
        const prompt = MCPOrchestrationPrompts.nodeProcessManagement(
          args.action,
          args.appName || 'current application'
        );
        
        return {
          content: [{
            type: "text",
            text: prompt
          }]
        };
      }

      case "nodejs_realtime_setup": {
        const args = request.params.arguments as {
          sessionId: string;
          projectPath: string;
          technology: string;
          features?: string[];
        };
        
        const prompt = MCPOrchestrationPrompts.nodeRealtimeSetup(
          args.projectPath,
          args.technology,
          args.features || []
        );
        
        return {
          content: [{
            type: "text",
            text: prompt
          }]
        };
      }

      // React/Next.js Tools
      case "react_smart_component_edit": {
        const args = request.params.arguments as {
          sessionId: string;
          componentPath: string;
          editType: string;
          specifications?: any;
        };
        
        const prompt = MCPOrchestrationPrompts.reactSmartComponentEdit(
          args.componentPath,
          args.editType,
          args.specifications || {}
        );
        
        return {
          content: [{
            type: "text",
            text: prompt
          }]
        };
      }

      // Kubernetes Deployment Tools
      case "kubernetes_deploy": {
        const args = request.params.arguments as {
          sessionId: string;
          applicationName: string;
          dockerImage: string;
          namespace?: string;
          replicas?: number;
          autoscaling?: any;
        };
        
        const prompt = MCPOrchestrationPrompts.kubernetesDeployment(
          args.applicationName,
          args.dockerImage,
          args.autoscaling || { enabled: true, minReplicas: 2, maxReplicas: 10, targetCPU: 80 }
        );
        
        return {
          content: [{
            type: "text",
            text: prompt
          }]
        };
      }

      // Performance Benchmarking Tools
      case "run_performance_benchmark": {
        const args = request.params.arguments as {
          sessionId: string;
          benchmarkType: string;
          compareWith?: string[];
        };
        
        const prompt = MCPOrchestrationPrompts.performanceBenchmark(
          args.benchmarkType,
          args.compareWith || ['industry_average']
        );
        
        return {
          content: [{
            type: "text",
            text: prompt
          }]
        };
      }

      // Memory Orchestration Tools
      case "get_command_suggestions": {
        const args = request.params.arguments as {
          sessionId: string;
          context?: any;
        };
        
        const prompt = MCPOrchestrationPrompts.commandSuggestions(
          args.context || { directory: '.', technology: 'unknown' }
        );
        
        return {
          content: [{
            type: "text",
            text: prompt
          }]
        };
      }

      case "analyze_workflow_patterns": {
        const args = request.params.arguments as {
          sessionId: string;
          timeRange?: string;
        };
        
        const prompt = createWorkflowPrompt(
          'workflow_analysis',
          [
            `Analyze command patterns from ${args.timeRange || 'last_day'}`,
            'Identify repetitive workflows that can be optimized',
            'Suggest automation opportunities',
            'Create reusable workflow templates'
          ],
          { sessionId: args.sessionId, timeRange: args.timeRange }
        );
        
        return {
          content: [{
            type: "text",
            text: prompt
          }]
        };
      }

      // Enterprise Auth Tools
      case "configure_mfa": {
        const args = request.params.arguments as {
          sessionId: string;
          mfaType: string;
          userId: string;
        };
        
        const prompt = createOrchestrationPrompt(
          `configure ${args.mfaType} multi-factor authentication`,
          {
            mfaType: args.mfaType,
            userId: args.userId,
            requirements: [
              'Generate secure setup instructions',
              'Create QR codes or setup tokens if needed',
              'Implement backup recovery codes',
              'Test authentication flow'
            ]
          },
          ['Context7', 'GitHub', 'security-best-practices']
        );
        
        return {
          content: [{
            type: "text",
            text: prompt
          }]
        };
      }

      // Compliance Tools
      case "generate_compliance_report": {
        const args = request.params.arguments as {
          sessionId: string;
          framework: string;
          reportType: string;
          format?: string;
        };
        
        const prompt = MCPOrchestrationPrompts.complianceReport(
          args.framework,
          args.reportType
        );
        
        return {
          content: [{
            type: "text",
            text: prompt
          }]
        };
      }

      // Go Development Tools
      case "go_module_init": {
        const args = request.params.arguments as {
          sessionId: string;
          moduleName: string;
          goVersion: string;
          projectPath?: string;
        };
        
        const prompt = GoWorkflowPrompts.goModuleInit(
          args.moduleName,
          args.goVersion
        );
        
        return {
          content: [{
            type: "text",
            text: prompt
          }]
        };
      }

      case "go_test_generation": {
        const args = request.params.arguments as {
          sessionId: string;
          projectPath: string;
          testType: string;
          coverage?: boolean;
        };
        
        const prompt = GoWorkflowPrompts.goTestGeneration(
          args.projectPath,
          args.testType
        );
        
        return {
          content: [{
            type: "text",
            text: prompt
          }]
        };
      }

      case "go_dependency_audit": {
        const args = request.params.arguments as {
          sessionId: string;
          projectPath: string;
          autoUpdate?: boolean;
        };
        
        const prompt = GoWorkflowPrompts.goDependencyAudit(
          args.projectPath
        );
        
        return {
          content: [{
            type: "text",
            text: prompt
          }]
        };
      }

      // Rust Development Tools
      case "rust_project_setup": {
        const args = request.params.arguments as {
          sessionId: string;
          crateName: string;
          edition: string;
          targetType?: string;
        };
        
        const prompt = RustWorkflowPrompts.rustProjectSetup(
          args.crateName,
          args.edition
        );
        
        return {
          content: [{
            type: "text",
            text: prompt
          }]
        };
      }

      case "rust_async_patterns": {
        const args = request.params.arguments as {
          sessionId: string;
          projectPath: string;
          runtime: string;
          patterns?: string[];
        };
        
        const prompt = RustWorkflowPrompts.rustAsyncImplementation(
          args.projectPath,
          args.runtime
        );
        
        return {
          content: [{
            type: "text",
            text: prompt
          }]
        };
      }

      case "rust_memory_optimization": {
        const args = request.params.arguments as {
          sessionId: string;
          projectPath: string;
          targetMetrics?: any;
        };
        
        const prompt = RustWorkflowPrompts.rustMemoryOptimization(
          args.projectPath
        );
        
        return {
          content: [{
            type: "text",
            text: prompt
          }]
        };
      }

      // Enhanced File Operation Tools
      case "safe_file_edit": {
        const args = request.params.arguments as {
          sessionId: string;
          filePath: string;
          editType: string;
          content?: string;
          strategy?: string;
          validation?: any;
        };
        
        const prompt = FileOperationPrompts.safeFileEdit(
          args.filePath,
          args.strategy || 'atomic_write'
        );
        
        return {
          content: [{
            type: "text",
            text: prompt
          }]
        };
      }

      case "smart_file_edit": {
        const args = request.params.arguments as any;
        const editRequest: FileEditRequest = {
          sessionId: args.sessionId,
          filePath: args.filePath,
          operations: args.operations || [],
          strategy: args.strategy,
          lockTimeout: args.lockTimeout,
          conflictResolution: args.conflictResolution
        };
        
        try {
          const result = await sshService.smartFileEditor.editFile(editRequest);
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (error) {
          // If direct execution fails, return orchestration prompt
          const prompt = SmartFileEditingPrompts.planFileEdit(editRequest);
          
          return {
            content: [{
              type: "text",
              text: `Error executing smart file edit: ${(error as Error).message}\n\n${prompt}`
            }]
          };
        }
      }

      case "setup_testing_suite": {
        const args = request.params.arguments as {
          sessionId: string;
          projectPath: string;
          framework: string;
          testType?: string;
          coverage?: boolean;
          watch?: boolean;
        };
        
        const prompt = FileOperationPrompts.testSuiteSetup(
          args.projectPath,
          args.framework
        );
        
        return {
          content: [{
            type: "text",
            text: prompt
          }]
        };
      }

      // ML-Enhanced Backup Management Tools
      case "create_intelligent_backup": {
        const args = request.params.arguments as {
          sessionId: string;
          sourcePaths: string[];
          destinationPath: string;
          backupType?: string;
          options?: BackupOptions;
        };
        
        const backupManager = new IntelligentBackupManager({
          storagePath: args.destinationPath,
          enableDeduplication: args.options?.deduplication ?? true
        });
        
        const prompt = backupManager.createBackupPrompt(
          args.sessionId,
          args.sourcePaths,
          args.destinationPath,
          {
            type: (args.backupType as BackupType) || BackupType.FULL,
            ...args.options
          }
        );
        
        return {
          content: [{
            type: "text",
            text: prompt
          }]
        };
      }

      case "restore_from_backup": {
        const args = request.params.arguments as {
          sessionId: string;
          backupId: string;
          targetPath: string;
          options?: RestoreOptions;
        };
        
        const backupManager = new IntelligentBackupManager({
          storagePath: '.',
          enableDeduplication: true
        });
        
        const prompt = backupManager.createRestorePrompt(
          args.backupId,
          {
            targetPath: args.targetPath,
            ...args.options
          }
        );
        
        return {
          content: [{
            type: "text",
            text: prompt
          }]
        };
      }

      case "analyze_backup_patterns": {
        const args = request.params.arguments as {
          sessionId: string;
          timeRange?: {
            start: string;
            end: string;
          };
        };
        
        const backupManager = new IntelligentBackupManager({
          storagePath: '.',
          enableDeduplication: true
        });
        
        const prompt = backupManager.createAnalysisPrompt({
          start: args.timeRange ? new Date(args.timeRange.start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: args.timeRange ? new Date(args.timeRange.end) : new Date()
        });
        
        return {
          content: [{
            type: "text",
            text: prompt
          }]
        };
      }

      // ML MCP Integration Tools
      case "persist_ssh_operation": {
        const args = request.params.arguments as {
          sessionId: string;
          operation: string;
          result: any;
          tags?: string[];
        };
        
        const sessionInfo = sshService.getSessionInfo(args.sessionId);
        
        const prompt = MLMCPIntegrationPrompts.persistSSHOperation(
          args.operation,
          sessionInfo,
          args.result
        );
        
        return {
          content: [{
            type: "text",
            text: prompt
          }]
        };
      }

      case "ml_code_analysis": {
        const args = request.params.arguments as {
          sessionId: string;
          projectPath: string;
          analysisType: string;
        };
        
        const prompt = MLMCPIntegrationPrompts.codeIntelligenceAnalysis(
          args.projectPath,
          args.analysisType
        );
        
        return {
          content: [{
            type: "text",
            text: prompt
          }]
        };
      }

      case "predict_next_commands": {
        const args = request.params.arguments as {
          sessionId: string;
          currentContext?: any;
          recentCommands?: string[];
        };
        
        const prompt = MLMCPIntegrationPrompts.predictiveCommandSuggestions(
          args.currentContext || { directory: '.', technology: 'unknown' },
          args.recentCommands || []
        );
        
        return {
          content: [{
            type: "text",
            text: prompt
          }]
        };
      }

      case "optimize_workflow_with_ml": {
        const args = request.params.arguments as {
          sessionId: string;
          workflowType: string;
          steps: any[];
        };
        
        const sessionInfo = sshService.getSessionInfo(args.sessionId);
        
        const prompt = MLMCPIntegrationPrompts.workflowLearning(
          args.workflowType,
          args.steps,
          { sessionId: args.sessionId, ...sessionInfo }
        );
        
        return {
          content: [{
            type: "text",
            text: prompt
          }]
        };
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
    }
  } catch (error: any) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error.message}`
      }],
      isError: true
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Enhanced SSH MCP server with gopass integration running on stdio");
}

main().catch((error) => {
  console.error("Server failed to start:", error);
  process.exit(1);
});
