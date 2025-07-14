/**
 * Enhanced Node.js Real-time Development Workflows for SSH MCP Server
 * Provides intelligent Node.js process management and real-time development automation
 * Leverages MCP ecosystem for framework-specific development workflows
 */

import { EventEmitter } from 'events';
import { AuditLogger, AuditEventType } from '../audit/audit-logger.js';
import { TechnologyStack } from '../ai/context7-integration.js';
import { MemoryOrchestrator } from '../memory/memory-orchestrator.js';

export enum NodeJSWorkflowType {
  PROCESS_MANAGEMENT = 'process_management',
  NPM_PACKAGE_MANAGEMENT = 'npm_package_management',
  REALTIME_FEATURES = 'realtime_features',
  API_DEVELOPMENT = 'api_development',
  MIDDLEWARE_SETUP = 'middleware_setup',
  DATABASE_INTEGRATION = 'database_integration',
  TESTING_AUTOMATION = 'testing_automation',
  PERFORMANCE_OPTIMIZATION = 'performance_optimization',
  SECURITY_HARDENING = 'security_hardening',
  DEPLOYMENT_AUTOMATION = 'deployment_automation',
  MONITORING_SETUP = 'monitoring_setup',
  MICROSERVICE_ARCHITECTURE = 'microservice_architecture',
  CONTAINERIZATION = 'containerization'
}

export enum NodeJSFramework {
  EXPRESS = 'express',
  FASTIFY = 'fastify',
  KOFJS = 'koa',
  NESTJS = 'nestjs',
  NEXTJS = 'nextjs',
  NUXTJS = 'nuxtjs',
  SVELTEKIT = 'sveltekit',
  HAPI = 'hapi',
  SOCKET_IO = 'socket_io',
  VANILLA = 'vanilla'
}

export enum NodeJSEnvironment {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
  TESTING = 'testing',
  LOCAL = 'local'
}

export enum ProcessManager {
  PM2 = 'pm2',
  FOREVER = 'forever',
  NODEMON = 'nodemon',
  SYSTEMD = 'systemd',
  DOCKER = 'docker',
  KUBERNETES = 'kubernetes'
}

export interface NodeJSProject {
  sessionId: string;
  projectPath: string;
  nodeVersion: string;
  framework: NodeJSFramework;
  environment: NodeJSEnvironment;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
  processManager: ProcessManager;
  database: {
    type: 'mongodb' | 'postgresql' | 'mysql' | 'redis' | 'sqlite' | 'none';
    orm?: 'mongoose' | 'prisma' | 'typeorm' | 'sequelize' | 'none';
    connectionPooling: boolean;
  };
  realtime: {
    enabled: boolean;
    technology: 'socket_io' | 'ws' | 'sse' | 'webrtc' | 'none';
    clustering: boolean;
    redis: boolean;
  };
  structure: {
    srcDir: string;
    distDir: string;
    testsDir: string;
    configDir: string;
    middlewareDir: string;
    routesDir: string;
    controllersDir: string;
    modelsDir: string;
    servicesDir: string;
  };
  features: {
    hasAPI: boolean;
    hasAuth: boolean;
    hasRealtime: boolean;
    hasCaching: boolean;
    hasLogging: boolean;
    hasMetrics: boolean;
    hasSecurity: boolean;
    hasDocumentation: boolean;
  };
  deployment: {
    containerized: boolean;
    clustered: boolean;
    loadBalanced: boolean;
    autoScaling: boolean;
    healthChecks: boolean;
  };
}

export interface NodeJSWorkflowRequest {
  sessionId: string;
  userId: string;
  workflowType: NodeJSWorkflowType;
  projectInfo: NodeJSProject;
  parameters: {
    command?: string;
    packageName?: string;
    scriptName?: string;
    processName?: string;
    port?: number;
    instances?: number;
    environment?: NodeJSEnvironment;
    memoryLimit?: string;
    cpuLimit?: string;
    healthCheck?: boolean;
    autoRestart?: boolean;
    logLevel?: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
    [key: string]: any;
  };
  mcpOptions?: {
    includePerformanceOptimization: boolean;
    includeSecurityHardening: boolean;
    includeMonitoring: boolean;
    includeDocumentation: boolean;
  };
}

export interface NodeJSWorkflowResult {
  workflowId: string;
  sessionId: string;
  workflowType: NodeJSWorkflowType;
  mcpWorkflow: string;
  npmCommands: string[];
  nodeCommands: string[];
  systemCommands: string[];
  processManagerCommands: string[];
  files: Array<{
    path: string;
    content: string;
    action: 'create' | 'update' | 'delete';
    permissions?: string;
  }>;
  configChanges: Array<{
    file: string;
    changes: Record<string, any>;
    backup: boolean;
  }>;
  environmentVariables: Array<{
    name: string;
    value: string;
    required: boolean;
    description: string;
  }>;
  deploymentSteps: string[];
  monitoringSetup: Array<{
    metric: string;
    endpoint: string;
    alertThreshold: number;
  }>;
  healthChecks: Array<{
    name: string;
    endpoint: string;
    expectedStatus: number;
    timeout: number;
  }>;
  performanceOptimizations: string[];
  securityMeasures: string[];
  recommendations: string[];
  estimatedTime: string;
  resourceRequirements: {
    cpu: string;
    memory: string;
    disk: string;
    network: string;
  };
  rollbackPlan: string[];
}

/**
 * Node.js Workflow Manager
 * Provides intelligent, MCP-powered Node.js development workflows
 */
export class NodeJSWorkflowManager extends EventEmitter {
  private auditLogger: AuditLogger;
  private memoryOrchestrator: MemoryOrchestrator;
  private activeWorkflows: Map<string, NodeJSWorkflowResult> = new Map();

  constructor(
    auditLogger: AuditLogger,
    memoryOrchestrator: MemoryOrchestrator
  ) {
    super();
    this.auditLogger = auditLogger;
    this.memoryOrchestrator = memoryOrchestrator;
  }

  /**
   * Execute Node.js workflow with MCP intelligence
   */
  async executeWorkflow(request: NodeJSWorkflowRequest): Promise<NodeJSWorkflowResult> {
    const workflowId = this.generateWorkflowId();
    
    try {
      // Log workflow initiation
      await this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
        userId: request.userId,
        sessionId: request.sessionId,
        description: `Node.js workflow initiated: ${request.workflowType}`,
        outcome: 'success',
        eventDetails: {
          workflowType: request.workflowType,
          projectPath: request.projectInfo.projectPath,
          framework: request.projectInfo.framework,
          environment: request.projectInfo.environment
        }
      });

      // Generate workflow based on type
      const result = await this.generateWorkflow(workflowId, request);
      
      // Store for tracking
      this.activeWorkflows.set(workflowId, result);
      
      // Learn from workflow patterns
      await this.memoryOrchestrator.storeWorkflowPattern(
        request.sessionId,
        'nodejs_workflow',
        {
          type: request.workflowType,
          framework: request.projectInfo.framework,
          projectInfo: request.projectInfo,
          result: result
        }
      );

      this.emit('workflow_completed', { workflowId, result });
      
      return result;
    } catch (error) {
      await this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
        userId: request.userId,
        sessionId: request.sessionId,
        description: `Node.js workflow failed: ${request.workflowType}`,
        outcome: 'failure',
        eventDetails: { error: error instanceof Error ? error.message : String(error) }
      });
      
      throw error;
    }
  }

  /**
   * Analyze Node.js project structure and capabilities
   */
  async analyzeProject(sessionId: string, projectPath: string): Promise<NodeJSProject> {
    const mcpWorkflow = this.buildProjectAnalysisPrompt(projectPath);
    
    // Return analyzed project structure (would be enhanced with actual analysis)
    const project: NodeJSProject = {
      sessionId,
      projectPath,
      nodeVersion: '20.x',
      framework: NodeJSFramework.EXPRESS,
      environment: NodeJSEnvironment.DEVELOPMENT,
      packageManager: 'npm',
      processManager: ProcessManager.PM2,
      database: {
        type: 'mongodb',
        orm: 'mongoose',
        connectionPooling: true
      },
      realtime: {
        enabled: false,
        technology: 'socket_io',
        clustering: false,
        redis: false
      },
      structure: {
        srcDir: 'src',
        distDir: 'dist',
        testsDir: 'tests',
        configDir: 'config',
        middlewareDir: 'src/middleware',
        routesDir: 'src/routes',
        controllersDir: 'src/controllers',
        modelsDir: 'src/models',
        servicesDir: 'src/services'
      },
      features: {
        hasAPI: true,
        hasAuth: false,
        hasRealtime: false,
        hasCaching: false,
        hasLogging: false,
        hasMetrics: false,
        hasSecurity: false,
        hasDocumentation: false
      },
      deployment: {
        containerized: false,
        clustered: false,
        loadBalanced: false,
        autoScaling: false,
        healthChecks: false
      }
    };

    return project;
  }

  /**
   * Get real-time development recommendations
   */
  async getRealtimeRecommendations(
    project: NodeJSProject
  ): Promise<string[]> {
    return [
      'Set up Socket.io for WebSocket communication',
      'Implement Redis for session sharing across instances',
      'Configure cluster mode for horizontal scaling',
      'Set up event-driven architecture with EventEmitter',
      'Implement real-time monitoring and metrics',
      'Configure load balancing with sticky sessions',
      'Set up real-time logging and debugging',
      'Implement graceful shutdown handling',
      'Configure health checks and auto-recovery',
      'Set up real-time performance monitoring'
    ];
  }

  /**
   * Generate workflow based on type
   */
  private async generateWorkflow(
    workflowId: string,
    request: NodeJSWorkflowRequest
  ): Promise<NodeJSWorkflowResult> {
    switch (request.workflowType) {
      case NodeJSWorkflowType.PROCESS_MANAGEMENT:
        return this.generateProcessManagementWorkflow(workflowId, request);
      
      case NodeJSWorkflowType.NPM_PACKAGE_MANAGEMENT:
        return this.generateNPMWorkflow(workflowId, request);
      
      case NodeJSWorkflowType.REALTIME_FEATURES:
        return this.generateRealtimeWorkflow(workflowId, request);
      
      case NodeJSWorkflowType.API_DEVELOPMENT:
        return this.generateAPIWorkflow(workflowId, request);
      
      case NodeJSWorkflowType.DEPLOYMENT_AUTOMATION:
        return this.generateDeploymentWorkflow(workflowId, request);
      
      case NodeJSWorkflowType.TESTING_AUTOMATION:
        return this.generateTestingWorkflow(workflowId, request);
      
      case NodeJSWorkflowType.PERFORMANCE_OPTIMIZATION:
        return this.generatePerformanceWorkflow(workflowId, request);
      
      case NodeJSWorkflowType.SECURITY_HARDENING:
        return this.generateSecurityWorkflow(workflowId, request);
      
      case NodeJSWorkflowType.MONITORING_SETUP:
        return this.generateMonitoringWorkflow(workflowId, request);
      
      default:
        return this.generateGenericWorkflow(workflowId, request);
    }
  }

  /**
   * Generate process management workflow
   */
  private async generateProcessManagementWorkflow(
    workflowId: string,
    request: NodeJSWorkflowRequest
  ): Promise<NodeJSWorkflowResult> {
    const mcpWorkflow = this.buildProcessManagementPrompt(request);
    const processName = request.parameters.processName || 'node-app';
    const instances = request.parameters.instances || 'max';
    
    return {
      workflowId,
      sessionId: request.sessionId,
      workflowType: request.workflowType,
      mcpWorkflow,
      npmCommands: [],
      nodeCommands: [],
      systemCommands: [],
      processManagerCommands: [
        `pm2 start ecosystem.config.js`,
        `pm2 save`,
        `pm2 startup`,
        `pm2 status`,
        `pm2 logs ${processName}`
      ],
      files: [
        {
          path: 'ecosystem.config.js',
          content: this.generatePM2Config(processName, instances, request.projectInfo),
          action: 'create'
        }
      ],
      configChanges: [],
      environmentVariables: [
        {
          name: 'NODE_ENV',
          value: request.projectInfo.environment,
          required: true,
          description: 'Node.js environment mode'
        },
        {
          name: 'PORT',
          value: String(request.parameters.port || 3000),
          required: true,
          description: 'Application port'
        }
      ],
      deploymentSteps: [
        'Install PM2 globally',
        'Create ecosystem configuration',
        'Start application with PM2',
        'Configure PM2 auto-startup',
        'Set up log rotation',
        'Configure monitoring and alerts'
      ],
      monitoringSetup: [
        {
          metric: 'CPU Usage',
          endpoint: '/metrics/cpu',
          alertThreshold: 80
        },
        {
          metric: 'Memory Usage',
          endpoint: '/metrics/memory',
          alertThreshold: 85
        }
      ],
      healthChecks: [
        {
          name: 'Application Health',
          endpoint: '/health',
          expectedStatus: 200,
          timeout: 5000
        },
        {
          name: 'Process Status',
          endpoint: '/status',
          expectedStatus: 200,
          timeout: 3000
        }
      ],
      performanceOptimizations: [
        'Enable cluster mode for CPU utilization',
        'Configure memory limits to prevent leaks',
        'Set up graceful shutdown handling',
        'Implement connection pooling'
      ],
      securityMeasures: [
        'Run processes with non-root user',
        'Configure firewall rules',
        'Set up process isolation',
        'Enable security monitoring'
      ],
      recommendations: [
        'Monitor process health and restart automatically',
        'Set up log aggregation and analysis',
        'Configure alerts for process failures',
        'Implement graceful deployment strategies'
      ],
      estimatedTime: '5-10 minutes',
      resourceRequirements: {
        cpu: '1-2 cores',
        memory: '512MB-2GB',
        disk: '1GB',
        network: '10Mbps'
      },
      rollbackPlan: [
        'pm2 stop all',
        'pm2 delete all',
        'Restart previous version'
      ]
    };
  }

  /**
   * Generate NPM package management workflow
   */
  private async generateNPMWorkflow(
    workflowId: string,
    request: NodeJSWorkflowRequest
  ): Promise<NodeJSWorkflowResult> {
    const mcpWorkflow = this.buildNPMManagementPrompt(request);
    const packageName = request.parameters.packageName;
    
    return {
      workflowId,
      sessionId: request.sessionId,
      workflowType: request.workflowType,
      mcpWorkflow,
      npmCommands: [
        'npm audit',
        'npm audit fix',
        'npm outdated',
        'npm update',
        packageName ? `npm install ${packageName}` : 'npm install',
        'npm run build',
        'npm test'
      ],
      nodeCommands: [],
      systemCommands: [],
      processManagerCommands: [],
      files: [],
      configChanges: [
        {
          file: 'package.json',
          changes: {
            scripts: {
              security: 'npm audit && npm audit fix',
              update: 'npm outdated && npm update'
            }
          },
          backup: true
        }
      ],
      environmentVariables: [],
      deploymentSteps: [
        'Check for security vulnerabilities',
        'Update outdated packages',
        'Install new dependencies',
        'Run security audit',
        'Test application functionality',
        'Update lockfile'
      ],
      monitoringSetup: [],
      healthChecks: [
        {
          name: 'Package Dependencies',
          endpoint: '/dependencies',
          expectedStatus: 200,
          timeout: 3000
        }
      ],
      performanceOptimizations: [
        'Use npm ci for faster CI builds',
        'Configure package-lock.json properly',
        'Remove unused dependencies',
        'Use production-only installs in production'
      ],
      securityMeasures: [
        'Run npm audit regularly',
        'Keep dependencies updated',
        'Use .npmrc for security settings',
        'Verify package integrity'
      ],
      recommendations: [
        'Set up automated dependency updates',
        'Monitor package vulnerabilities',
        'Use semantic versioning properly',
        'Maintain clean package.json'
      ],
      estimatedTime: '3-5 minutes',
      resourceRequirements: {
        cpu: '1 core',
        memory: '256MB',
        disk: '500MB',
        network: '5Mbps'
      },
      rollbackPlan: [
        'Restore package.json from backup',
        'npm install from lockfile',
        'Revert to previous versions'
      ]
    };
  }

  /**
   * Generate real-time features workflow
   */
  private async generateRealtimeWorkflow(
    workflowId: string,
    request: NodeJSWorkflowRequest
  ): Promise<NodeJSWorkflowResult> {
    const mcpWorkflow = this.buildRealtimeFeaturesPrompt(request);
    
    return {
      workflowId,
      sessionId: request.sessionId,
      workflowType: request.workflowType,
      mcpWorkflow,
      npmCommands: [
        'npm install socket.io',
        'npm install redis',
        'npm install @socket.io/redis-adapter',
        'npm install cluster'
      ],
      nodeCommands: [],
      systemCommands: [],
      processManagerCommands: [],
      files: [
        {
          path: 'src/realtime/socket-server.js',
          content: this.generateSocketIOServer(request.projectInfo),
          action: 'create'
        },
        {
          path: 'src/realtime/redis-adapter.js',
          content: this.generateRedisAdapter(),
          action: 'create'
        }
      ],
      configChanges: [],
      environmentVariables: [
        {
          name: 'REDIS_URL',
          value: 'redis://localhost:6379',
          required: true,
          description: 'Redis connection URL for real-time scaling'
        },
        {
          name: 'SOCKET_PORT',
          value: '3001',
          required: false,
          description: 'Socket.io server port'
        }
      ],
      deploymentSteps: [
        'Install Socket.io and Redis dependencies',
        'Set up Socket.io server configuration',
        'Configure Redis adapter for clustering',
        'Implement real-time event handlers',
        'Set up client-side Socket.io integration',
        'Test real-time functionality'
      ],
      monitoringSetup: [
        {
          metric: 'WebSocket Connections',
          endpoint: '/metrics/websockets',
          alertThreshold: 1000
        },
        {
          metric: 'Real-time Events/sec',
          endpoint: '/metrics/events',
          alertThreshold: 500
        }
      ],
      healthChecks: [
        {
          name: 'Socket.io Server',
          endpoint: '/socket.io/',
          expectedStatus: 200,
          timeout: 5000
        },
        {
          name: 'Redis Connection',
          endpoint: '/health/redis',
          expectedStatus: 200,
          timeout: 3000
        }
      ],
      performanceOptimizations: [
        'Use Redis for session sharing',
        'Implement connection pooling',
        'Configure sticky sessions',
        'Optimize event payload sizes'
      ],
      securityMeasures: [
        'Implement WebSocket authentication',
        'Configure CORS for Socket.io',
        'Rate limit connections',
        'Validate all real-time events'
      ],
      recommendations: [
        'Monitor connection counts and performance',
        'Implement graceful degradation',
        'Set up horizontal scaling with Redis',
        'Add real-time monitoring and alerting'
      ],
      estimatedTime: '10-15 minutes',
      resourceRequirements: {
        cpu: '2 cores',
        memory: '1GB',
        disk: '2GB',
        network: '50Mbps'
      },
      rollbackPlan: [
        'Disable Socket.io server',
        'Revert to HTTP-only communication',
        'Remove real-time dependencies'
      ]
    };
  }

  /**
   * Generate API development workflow
   */
  private async generateAPIWorkflow(
    workflowId: string,
    request: NodeJSWorkflowRequest
  ): Promise<NodeJSWorkflowResult> {
    const mcpWorkflow = this.buildAPIDesignPrompt(request);
    
    return {
      workflowId,
      sessionId: request.sessionId,
      workflowType: request.workflowType,
      mcpWorkflow,
      npmCommands: [
        'npm install express',
        'npm install helmet',
        'npm install cors',
        'npm install express-rate-limit',
        'npm install compression',
        'npm install swagger-ui-express'
      ],
      nodeCommands: [],
      systemCommands: [],
      processManagerCommands: [],
      files: [
        {
          path: 'src/api/server.js',
          content: this.generateAPIServer(request.projectInfo),
          action: 'create'
        },
        {
          path: 'src/api/middleware/security.js',
          content: this.generateSecurityMiddleware(),
          action: 'create'
        }
      ],
      configChanges: [],
      environmentVariables: [
        {
          name: 'API_PORT',
          value: '3000',
          required: true,
          description: 'API server port'
        },
        {
          name: 'API_VERSION',
          value: 'v1',
          required: false,
          description: 'API version'
        }
      ],
      deploymentSteps: [
        'Install Express and security middleware',
        'Set up API server structure',
        'Implement security middleware',
        'Create API routes and controllers',
        'Set up API documentation',
        'Implement error handling'
      ],
      monitoringSetup: [
        {
          metric: 'API Response Time',
          endpoint: '/metrics/response-time',
          alertThreshold: 500
        },
        {
          metric: 'API Error Rate',
          endpoint: '/metrics/errors',
          alertThreshold: 5
        }
      ],
      healthChecks: [
        {
          name: 'API Health',
          endpoint: '/api/health',
          expectedStatus: 200,
          timeout: 3000
        },
        {
          name: 'API Documentation',
          endpoint: '/api/docs',
          expectedStatus: 200,
          timeout: 5000
        }
      ],
      performanceOptimizations: [
        'Enable response compression',
        'Implement API caching',
        'Use connection pooling',
        'Optimize database queries'
      ],
      securityMeasures: [
        'Implement rate limiting',
        'Use Helmet for security headers',
        'Configure CORS properly',
        'Add input validation'
      ],
      recommendations: [
        'Follow RESTful API design principles',
        'Implement comprehensive error handling',
        'Add API versioning strategy',
        'Set up automated API testing'
      ],
      estimatedTime: '8-12 minutes',
      resourceRequirements: {
        cpu: '1-2 cores',
        memory: '512MB',
        disk: '1GB',
        network: '20Mbps'
      },
      rollbackPlan: [
        'Revert to previous API version',
        'Disable new endpoints',
        'Restore previous middleware'
      ]
    };
  }

  /**
   * Generate deployment automation workflow
   */
  private async generateDeploymentWorkflow(
    workflowId: string,
    request: NodeJSWorkflowRequest
  ): Promise<NodeJSWorkflowResult> {
    const mcpWorkflow = this.buildDeploymentAutomationPrompt(request);
    const environment = request.parameters.environment || NodeJSEnvironment.PRODUCTION;
    
    return {
      workflowId,
      sessionId: request.sessionId,
      workflowType: request.workflowType,
      mcpWorkflow,
      npmCommands: [
        'npm ci',
        'npm run build',
        'npm run test',
        'npm prune --production'
      ],
      nodeCommands: [],
      systemCommands: [
        'git pull origin main',
        'docker build -t node-app .',
        'docker run -d --name node-app-container node-app'
      ],
      processManagerCommands: [
        'pm2 reload ecosystem.config.js',
        'pm2 save'
      ],
      files: [
        {
          path: 'Dockerfile',
          content: this.generateDockerfile(request.projectInfo),
          action: 'create'
        },
        {
          path: '.dockerignore',
          content: 'node_modules\n.git\n.env\n*.log',
          action: 'create'
        }
      ],
      configChanges: [],
      environmentVariables: [
        {
          name: 'NODE_ENV',
          value: environment,
          required: true,
          description: 'Node.js environment'
        }
      ],
      deploymentSteps: [
        'Pull latest code from repository',
        'Install production dependencies',
        'Run build process',
        'Execute test suite',
        'Create Docker image',
        'Deploy to target environment',
        'Run health checks',
        'Update load balancer'
      ],
      monitoringSetup: [
        {
          metric: 'Deployment Success Rate',
          endpoint: '/metrics/deployment',
          alertThreshold: 95
        }
      ],
      healthChecks: [
        {
          name: 'Application Health',
          endpoint: '/health',
          expectedStatus: 200,
          timeout: 10000
        }
      ],
      performanceOptimizations: [
        'Use multi-stage Docker builds',
        'Implement zero-downtime deployment',
        'Configure auto-scaling',
        'Optimize image size'
      ],
      securityMeasures: [
        'Scan Docker images for vulnerabilities',
        'Use non-root containers',
        'Configure security policies',
        'Implement secret management'
      ],
      recommendations: [
        'Implement blue-green deployments',
        'Set up automated rollback',
        'Monitor deployment metrics',
        'Use infrastructure as code'
      ],
      estimatedTime: '10-20 minutes',
      resourceRequirements: {
        cpu: '2-4 cores',
        memory: '2GB',
        disk: '5GB',
        network: '100Mbps'
      },
      rollbackPlan: [
        'Revert to previous Docker image',
        'Update load balancer routing',
        'Verify application health'
      ]
    };
  }

  /**
   * Generate testing automation workflow
   */
  private async generateTestingWorkflow(
    workflowId: string,
    request: NodeJSWorkflowRequest
  ): Promise<NodeJSWorkflowResult> {
    const mcpWorkflow = this.buildTestingAutomationPrompt(request);
    
    return {
      workflowId,
      sessionId: request.sessionId,
      workflowType: request.workflowType,
      mcpWorkflow,
      npmCommands: [
        'npm install --save-dev jest',
        'npm install --save-dev supertest',
        'npm install --save-dev nyc',
        'npm test',
        'npm run test:coverage'
      ],
      nodeCommands: [],
      systemCommands: [],
      processManagerCommands: [],
      files: [
        {
          path: 'jest.config.js',
          content: this.generateJestConfig(),
          action: 'create'
        }
      ],
      configChanges: [
        {
          file: 'package.json',
          changes: {
            scripts: {
              test: 'jest',
              'test:watch': 'jest --watch',
              'test:coverage': 'jest --coverage'
            }
          },
          backup: true
        }
      ],
      environmentVariables: [
        {
          name: 'NODE_ENV',
          value: 'testing',
          required: true,
          description: 'Testing environment'
        }
      ],
      deploymentSteps: [
        'Install testing dependencies',
        'Configure Jest testing framework',
        'Create test suites',
        'Run unit tests',
        'Run integration tests',
        'Generate coverage reports'
      ],
      monitoringSetup: [
        {
          metric: 'Test Coverage',
          endpoint: '/metrics/coverage',
          alertThreshold: 80
        }
      ],
      healthChecks: [
        {
          name: 'Test Suite',
          endpoint: '/test/health',
          expectedStatus: 200,
          timeout: 30000
        }
      ],
      performanceOptimizations: [
        'Use parallel test execution',
        'Implement test mocking',
        'Optimize test database setup',
        'Cache test dependencies'
      ],
      securityMeasures: [
        'Test authentication flows',
        'Validate input sanitization',
        'Test authorization checks',
        'Security integration tests'
      ],
      recommendations: [
        'Maintain high test coverage (>80%)',
        'Implement CI/CD testing pipeline',
        'Use test-driven development',
        'Add performance testing'
      ],
      estimatedTime: '5-10 minutes',
      resourceRequirements: {
        cpu: '2 cores',
        memory: '1GB',
        disk: '2GB',
        network: '10Mbps'
      },
      rollbackPlan: []
    };
  }

  /**
   * Generate performance optimization workflow
   */
  private async generatePerformanceWorkflow(
    workflowId: string,
    request: NodeJSWorkflowRequest
  ): Promise<NodeJSWorkflowResult> {
    const mcpWorkflow = this.buildPerformanceOptimizationPrompt(request);
    
    return {
      workflowId,
      sessionId: request.sessionId,
      workflowType: request.workflowType,
      mcpWorkflow,
      npmCommands: [
        'npm install --save-dev clinic',
        'npm install compression',
        'npm install redis',
        'npm install newrelic'
      ],
      nodeCommands: [
        'node --inspect=9229 app.js',
        'clinic doctor -- node app.js'
      ],
      systemCommands: [],
      processManagerCommands: [],
      files: [
        {
          path: 'src/performance/profiler.js',
          content: this.generatePerformanceProfiler(),
          action: 'create'
        }
      ],
      configChanges: [],
      environmentVariables: [
        {
          name: 'NEW_RELIC_LICENSE_KEY',
          value: 'your-license-key',
          required: false,
          description: 'New Relic monitoring license key'
        }
      ],
      deploymentSteps: [
        'Install performance monitoring tools',
        'Set up application profiling',
        'Configure caching strategies',
        'Implement connection pooling',
        'Optimize database queries',
        'Monitor performance metrics'
      ],
      monitoringSetup: [
        {
          metric: 'Response Time',
          endpoint: '/metrics/response-time',
          alertThreshold: 200
        },
        {
          metric: 'Memory Usage',
          endpoint: '/metrics/memory',
          alertThreshold: 85
        }
      ],
      healthChecks: [
        {
          name: 'Performance Health',
          endpoint: '/performance/health',
          expectedStatus: 200,
          timeout: 5000
        }
      ],
      performanceOptimizations: [
        'Enable HTTP/2 and compression',
        'Implement Redis caching',
        'Use cluster mode for CPU utilization',
        'Optimize JSON parsing and serialization',
        'Implement connection pooling',
        'Use CDN for static assets'
      ],
      securityMeasures: [
        'Secure performance monitoring endpoints',
        'Implement rate limiting',
        'Monitor for performance attacks'
      ],
      recommendations: [
        'Regular performance testing',
        'Monitor key performance indicators',
        'Implement performance budgets',
        'Use performance profiling tools'
      ],
      estimatedTime: '10-15 minutes',
      resourceRequirements: {
        cpu: '2-4 cores',
        memory: '2GB',
        disk: '3GB',
        network: '50Mbps'
      },
      rollbackPlan: [
        'Disable performance monitoring',
        'Remove profiling overhead',
        'Revert optimization changes'
      ]
    };
  }

  /**
   * Generate security hardening workflow
   */
  private async generateSecurityWorkflow(
    workflowId: string,
    request: NodeJSWorkflowRequest
  ): Promise<NodeJSWorkflowResult> {
    const mcpWorkflow = this.buildSecurityHardeningPrompt(request);
    
    return {
      workflowId,
      sessionId: request.sessionId,
      workflowType: request.workflowType,
      mcpWorkflow,
      npmCommands: [
        'npm install helmet',
        'npm install express-rate-limit',
        'npm install bcrypt',
        'npm install jsonwebtoken',
        'npm audit'
      ],
      nodeCommands: [],
      systemCommands: [],
      processManagerCommands: [],
      files: [
        {
          path: 'src/security/middleware.js',
          content: this.generateSecurityMiddleware(),
          action: 'create'
        }
      ],
      configChanges: [],
      environmentVariables: [
        {
          name: 'JWT_SECRET',
          value: 'your-jwt-secret',
          required: true,
          description: 'JWT signing secret'
        }
      ],
      deploymentSteps: [
        'Install security packages',
        'Configure Helmet security headers',
        'Implement rate limiting',
        'Set up authentication middleware',
        'Configure CORS policies',
        'Run security audit'
      ],
      monitoringSetup: [
        {
          metric: 'Failed Login Attempts',
          endpoint: '/metrics/auth-failures',
          alertThreshold: 10
        }
      ],
      healthChecks: [
        {
          name: 'Security Health',
          endpoint: '/security/health',
          expectedStatus: 200,
          timeout: 3000
        }
      ],
      performanceOptimizations: [],
      securityMeasures: [
        'Use Helmet for security headers',
        'Implement rate limiting',
        'Secure session management',
        'Input validation and sanitization',
        'HTTPS enforcement',
        'Security audit automation'
      ],
      recommendations: [
        'Regular security audits',
        'Keep dependencies updated',
        'Implement security monitoring',
        'Use security linting tools'
      ],
      estimatedTime: '8-12 minutes',
      resourceRequirements: {
        cpu: '1 core',
        memory: '512MB',
        disk: '1GB',
        network: '10Mbps'
      },
      rollbackPlan: [
        'Disable security middleware',
        'Revert to previous configuration'
      ]
    };
  }

  /**
   * Generate monitoring setup workflow
   */
  private async generateMonitoringWorkflow(
    workflowId: string,
    request: NodeJSWorkflowRequest
  ): Promise<NodeJSWorkflowResult> {
    const mcpWorkflow = this.buildMonitoringSetupPrompt(request);
    
    return {
      workflowId,
      sessionId: request.sessionId,
      workflowType: request.workflowType,
      mcpWorkflow,
      npmCommands: [
        'npm install prometheus-api-metrics',
        'npm install winston',
        'npm install express-status-monitor'
      ],
      nodeCommands: [],
      systemCommands: [],
      processManagerCommands: [],
      files: [
        {
          path: 'src/monitoring/metrics.js',
          content: this.generateMetricsCollector(),
          action: 'create'
        }
      ],
      configChanges: [],
      environmentVariables: [
        {
          name: 'LOG_LEVEL',
          value: 'info',
          required: false,
          description: 'Application log level'
        }
      ],
      deploymentSteps: [
        'Install monitoring packages',
        'Set up metrics collection',
        'Configure logging system',
        'Implement health checks',
        'Set up alerting rules',
        'Create monitoring dashboard'
      ],
      monitoringSetup: [
        {
          metric: 'Application Uptime',
          endpoint: '/metrics/uptime',
          alertThreshold: 99
        },
        {
          metric: 'Error Rate',
          endpoint: '/metrics/errors',
          alertThreshold: 1
        }
      ],
      healthChecks: [
        {
          name: 'Monitoring Health',
          endpoint: '/monitoring/health',
          expectedStatus: 200,
          timeout: 3000
        }
      ],
      performanceOptimizations: [
        'Efficient metrics collection',
        'Log rotation and compression',
        'Sampling for high-volume metrics'
      ],
      securityMeasures: [
        'Secure metrics endpoints',
        'Log sensitive data filtering',
        'Access control for monitoring'
      ],
      recommendations: [
        'Set up comprehensive alerting',
        'Monitor business metrics',
        'Implement log aggregation',
        'Create operational dashboards'
      ],
      estimatedTime: '6-10 minutes',
      resourceRequirements: {
        cpu: '1 core',
        memory: '256MB',
        disk: '2GB',
        network: '10Mbps'
      },
      rollbackPlan: [
        'Disable metrics collection',
        'Remove monitoring middleware'
      ]
    };
  }

  /**
   * Generate generic workflow
   */
  private async generateGenericWorkflow(
    workflowId: string,
    request: NodeJSWorkflowRequest
  ): Promise<NodeJSWorkflowResult> {
    const mcpWorkflow = this.buildGenericWorkflowPrompt(request);
    
    return {
      workflowId,
      sessionId: request.sessionId,
      workflowType: request.workflowType,
      mcpWorkflow,
      npmCommands: ['npm list'],
      nodeCommands: ['node --version'],
      systemCommands: [],
      processManagerCommands: [],
      files: [],
      configChanges: [],
      environmentVariables: [],
      deploymentSteps: [],
      monitoringSetup: [],
      healthChecks: [],
      performanceOptimizations: [],
      securityMeasures: [],
      recommendations: [
        'Review Node.js best practices',
        'Consider using appropriate tools and frameworks'
      ],
      estimatedTime: '2-5 minutes',
      resourceRequirements: {
        cpu: '1 core',
        memory: '256MB',
        disk: '500MB',
        network: '5Mbps'
      },
      rollbackPlan: []
    };
  }

  // Helper Methods for generating file contents

  private generatePM2Config(processName: string, instances: string | number, project: NodeJSProject): string {
    return `module.exports = {
  apps: [{
    name: '${processName}',
    script: './app.js',
    instances: ${instances === 'max' ? 'max' : `'${instances}'`},
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max_old_space_size=1024',
    watch: false,
    ignore_watch: ['node_modules', 'logs'],
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};`;
  }

  private generateSocketIOServer(project: NodeJSProject): string {
    return `const io = require('socket.io');
const redis = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');

class RealtimeServer {
  constructor(server) {
    this.io = io(server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST']
      }
    });
    
    this.setupRedisAdapter();
    this.setupEventHandlers();
  }

  async setupRedisAdapter() {
    if (process.env.REDIS_URL) {
      const pubClient = redis.createClient({ url: process.env.REDIS_URL });
      const subClient = pubClient.duplicate();
      
      await Promise.all([pubClient.connect(), subClient.connect()]);
      
      this.io.adapter(createAdapter(pubClient, subClient));
      console.log('Redis adapter configured for Socket.io');
    }
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);
      
      socket.on('join_room', (room) => {
        socket.join(room);
        socket.to(room).emit('user_joined', { userId: socket.id });
      });
      
      socket.on('leave_room', (room) => {
        socket.leave(room);
        socket.to(room).emit('user_left', { userId: socket.id });
      });
      
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
  }

  broadcastToRoom(room, event, data) {
    this.io.to(room).emit(event, data);
  }

  getConnectionCount() {
    return this.io.engine.clientsCount;
  }
}

module.exports = RealtimeServer;`;
  }

  private generateRedisAdapter(): string {
    return `const redis = require('redis');

class RedisAdapter {
  constructor() {
    this.client = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });
    
    this.connect();
  }

  async connect() {
    try {
      await this.client.connect();
      console.log('Connected to Redis');
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
    }
  }

  async set(key, value, ttl = 3600) {
    try {
      await this.client.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('Redis SET error:', error);
    }
  }

  async get(key) {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis GET error:', error);
      return null;
    }
  }

  async del(key) {
    try {
      await this.client.del(key);
    } catch (error) {
      console.error('Redis DEL error:', error);
    }
  }

  async disconnect() {
    await this.client.disconnect();
  }
}

module.exports = RedisAdapter;`;
  }

  private generateAPIServer(project: NodeJSProject): string {
    return `const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

class APIServer {
  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet());
    
    // CORS configuration
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }));
    
    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP'
    });
    this.app.use('/api/', limiter);
    
    // Compression
    this.app.use(compression());
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });
    
    // API routes
    this.app.use('/api/v1', require('./routes'));
    
    // Error handling
    this.app.use((err, req, res, next) => {
      console.error(err.stack);
      res.status(500).json({ error: 'Something went wrong!' });
    });
  }

  start(port = 3000) {
    this.server = this.app.listen(port, () => {
      console.log(\`API server running on port \${port}\`);
    });
    return this.server;
  }

  stop() {
    if (this.server) {
      this.server.close();
    }
  }
}

module.exports = APIServer;`;
  }

  private generateSecurityMiddleware(): string {
    return `const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Rate limiting middleware
const createRateLimiter = (windowMs = 15 * 60 * 1000, max = 100) => {
  return rateLimit({
    windowMs,
    max,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Input validation middleware
const validateInput = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    next();
  };
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
};

module.exports = {
  createRateLimiter,
  authenticateToken,
  validateInput,
  securityHeaders
};`;
  }

  private generateDockerfile(project: NodeJSProject): string {
    return `# Multi-stage build for optimized production image
FROM node:${project.nodeVersion}-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build application (if build step exists)
RUN npm run build 2>/dev/null || echo "No build step found"

# Production stage
FROM node:${project.nodeVersion}-alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \\
    adduser -S nodeuser -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=nodeuser:nodejs /app .

# Switch to non-root user
USER nodeuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node healthcheck.js

# Start application
CMD ["node", "app.js"]`;
  }

  private generateJestConfig(): string {
    return `module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.js',
    '<rootDir>/src/**/*.test.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  verbose: true,
  collectCoverage: true,
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};`;
  }

  private generatePerformanceProfiler(): string {
    return `const performanceProfiler = {
  startTime: process.hrtime(),
  
  measureExecutionTime(fn, name) {
    const start = process.hrtime();
    const result = fn();
    const end = process.hrtime(start);
    const executionTime = end[0] * 1000 + end[1] / 1000000; // Convert to ms
    
    console.log(\`[\${name}] Execution time: \${executionTime.toFixed(2)}ms\`);
    return result;
  },

  memoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100,
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100,
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
      external: Math.round(usage.external / 1024 / 1024 * 100) / 100
    };
  },

  cpuUsage(previousUsage) {
    return process.cpuUsage(previousUsage);
  },

  uptime() {
    return process.uptime();
  }
};

module.exports = performanceProfiler;`;
  }

  private generateMetricsCollector(): string {
    return `const promClient = require('prom-client');

class MetricsCollector {
  constructor() {
    // Create a Registry
    this.register = new promClient.Registry();

    // Add default metrics
    promClient.collectDefaultMetrics({ register: this.register });

    // Custom metrics
    this.httpRequestDuration = new promClient.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5]
    });

    this.httpRequestTotal = new promClient.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code']
    });

    this.activeConnections = new promClient.Gauge({
      name: 'active_connections',
      help: 'Number of active connections'
    });

    // Register custom metrics
    this.register.registerMetric(this.httpRequestDuration);
    this.register.registerMetric(this.httpRequestTotal);
    this.register.registerMetric(this.activeConnections);
  }

  recordHttpRequest(method, route, statusCode, duration) {
    this.httpRequestDuration
      .labels(method, route, statusCode)
      .observe(duration);
    
    this.httpRequestTotal
      .labels(method, route, statusCode)
      .inc();
  }

  setActiveConnections(count) {
    this.activeConnections.set(count);
  }

  getMetrics() {
    return this.register.metrics();
  }
}

module.exports = MetricsCollector;`;
  }

  // MCP Workflow Prompt Builders

  private buildProjectAnalysisPrompt(projectPath: string): string {
    return `
Analyze Node.js project structure and generate comprehensive project intelligence:

**Node.js Project Analysis Workflow:**
1. **Package Analysis**: Examine package.json and dependencies
   - Detect Node.js version and framework
   - Analyze installed packages and their purposes
   - Check for security vulnerabilities in dependencies
   - Identify outdated packages requiring updates

2. **Framework Detection**: Identify Node.js framework and architecture
   - Detect Express, Fastify, NestJS, or other frameworks
   - Analyze project structure and design patterns
   - Identify middleware and routing configuration
   - Check for real-time features (Socket.io, WebRTC)

3. **Performance Analysis**: Assess performance characteristics
   - Analyze process management setup (PM2, cluster)
   - Check caching strategies and implementation
   - Identify database connection pooling
   - Assess memory and CPU optimization opportunities

4. **Security Assessment**: Evaluate security implementation
   - Check for security middleware (Helmet, CORS)
   - Analyze authentication and authorization patterns
   - Identify input validation and sanitization
   - Check for rate limiting and security headers

5. **Deployment Readiness**: Assess production readiness
   - Check containerization setup (Docker)
   - Analyze monitoring and logging configuration
   - Identify health check implementations
   - Assess scalability and load balancing setup

Please provide detailed Node.js project analysis for optimization and development enhancement.
    `.trim();
  }

  private buildProcessManagementPrompt(request: NodeJSWorkflowRequest): string {
    return `
Implement Node.js process management with intelligent orchestration:

**Process Management Workflow:**
1. **Process Architecture**: Design optimal process structure
   - Configure cluster mode for CPU utilization
   - Set up process monitoring and auto-restart
   - Implement graceful shutdown handling
   - Plan memory and CPU resource allocation

2. **PM2 Configuration**: Set up production-grade process management
   - Configure ecosystem.config.js for environment-specific settings
   - Set up log management and rotation
   - Implement process scaling and load balancing
   - Configure health checks and monitoring

3. **Performance Optimization**: Optimize process performance
   - Configure memory limits and garbage collection
   - Set up connection pooling and resource sharing
   - Implement efficient inter-process communication
   - Plan horizontal and vertical scaling strategies

4. **Monitoring and Alerting**: Set up comprehensive monitoring
   - Monitor process health and resource usage
   - Set up alerts for process failures and performance issues
   - Implement logging and error tracking
   - Configure metrics collection and dashboards

5. **Deployment Integration**: Integrate with deployment pipeline
   - Set up zero-downtime deployment strategies
   - Configure automated rollback procedures
   - Implement blue-green deployment patterns
   - Plan disaster recovery and backup procedures

Please provide comprehensive process management guidance with production-grade configuration.
    `.trim();
  }

  private buildNPMManagementPrompt(request: NodeJSWorkflowRequest): string {
    const packageName = request.parameters.packageName || 'dependencies';

    return `
Manage Node.js packages with intelligent dependency optimization:

**NPM Package Management Workflow for ${packageName}:**
1. **Dependency Analysis**: Comprehensive package analysis
   - Audit current dependencies for security vulnerabilities
   - Identify outdated packages and available updates
   - Analyze dependency tree for conflicts and duplication
   - Check for unused or redundant dependencies

2. **Security Management**: Implement package security best practices
   - Run automated security audits
   - Fix known vulnerabilities automatically
   - Implement package verification and integrity checks
   - Set up automated security monitoring

3. **Performance Optimization**: Optimize package performance
   - Analyze bundle size and optimize dependencies
   - Configure production vs development dependencies
   - Implement package caching strategies
   - Optimize npm/yarn/pnpm configuration

4. **Version Management**: Implement intelligent versioning
   - Configure semantic versioning strategies
   - Set up automated dependency updates
   - Implement lockfile management best practices
   - Plan dependency upgrade strategies

5. **CI/CD Integration**: Integrate with development workflow
   - Configure package installation for CI/CD
   - Set up automated testing for dependency changes
   - Implement dependency change monitoring
   - Plan rollback strategies for problematic updates

Please provide comprehensive NPM management guidance with security and performance optimization.
    `.trim();
  }

  private buildRealtimeFeaturesPrompt(request: NodeJSWorkflowRequest): string {
    return `
Implement Node.js real-time features with scalable architecture:

**Real-time Features Implementation Workflow:**
1. **Real-time Architecture**: Design scalable real-time system
   - Set up Socket.io for WebSocket communication
   - Configure Redis adapter for horizontal scaling
   - Implement event-driven architecture patterns
   - Plan real-time data synchronization strategies

2. **Connection Management**: Optimize connection handling
   - Implement connection pooling and load balancing
   - Set up sticky sessions for clustering
   - Configure connection authentication and authorization
   - Plan connection recovery and reconnection strategies

3. **Performance Scaling**: Scale real-time performance
   - Configure Redis for session sharing
   - Implement message queuing for event processing
   - Set up horizontal scaling with multiple instances
   - Optimize event payload sizes and frequency

4. **Monitoring and Debugging**: Monitor real-time performance
   - Track connection counts and performance metrics
   - Implement real-time error tracking and logging
   - Set up alerts for connection issues
   - Configure debugging tools for real-time events

5. **Security Implementation**: Secure real-time communications
   - Implement WebSocket authentication
   - Configure CORS and security headers
   - Set up rate limiting for real-time events
   - Implement input validation for real-time data

Please provide comprehensive real-time features implementation with scalability and security considerations.
    `.trim();
  }

  private buildAPIDesignPrompt(request: NodeJSWorkflowRequest): string {
    return `
Design Node.js API with comprehensive functionality and security:

**API Development Workflow:**
1. **API Architecture**: Design RESTful API structure
   - Plan resource endpoints and HTTP methods
   - Design request/response schemas and validation
   - Implement API versioning strategies
   - Plan pagination and filtering mechanisms

2. **Security Implementation**: Secure API endpoints
   - Configure Helmet for security headers
   - Implement rate limiting and throttling
   - Set up CORS policies and authentication
   - Plan input validation and sanitization

3. **Performance Optimization**: Optimize API performance
   - Implement response compression and caching
   - Configure connection pooling and database optimization
   - Set up API response time monitoring
   - Plan horizontal scaling and load balancing

4. **Documentation and Testing**: Create comprehensive API docs
   - Generate OpenAPI/Swagger documentation
   - Implement automated API testing
   - Create request/response examples
   - Set up API integration testing

5. **Monitoring and Analytics**: Monitor API performance
   - Track API usage metrics and performance
   - Implement error tracking and logging
   - Set up alerts for API issues
   - Configure business metrics tracking

Please provide comprehensive API development guidance with security, performance, and documentation best practices.
    `.trim();
  }

  private buildDeploymentAutomationPrompt(request: NodeJSWorkflowRequest): string {
    const environment = request.parameters.environment || 'production';

    return `
Automate Node.js deployment with zero-downtime strategies:

**Deployment Automation Workflow for ${environment}:**
1. **Deployment Pipeline**: Design automated deployment pipeline
   - Set up CI/CD pipeline with testing and validation
   - Configure automated testing and quality gates
   - Implement code quality checks and security scans
   - Plan deployment approval and rollback procedures

2. **Containerization**: Implement Docker-based deployment
   - Create optimized Dockerfile with multi-stage builds
   - Configure container orchestration (Docker Compose/Kubernetes)
   - Implement container health checks and monitoring
   - Plan container scaling and resource management

3. **Zero-downtime Deployment**: Implement seamless deployment
   - Configure blue-green deployment strategies
   - Set up rolling updates with health checks
   - Implement automatic rollback on failure
   - Plan traffic routing and load balancing

4. **Environment Management**: Manage deployment environments
   - Configure environment-specific settings
   - Implement secret management and security
   - Set up monitoring and logging for each environment
   - Plan disaster recovery and backup procedures

5. **Post-deployment Validation**: Validate deployment success
   - Run comprehensive health checks
   - Verify application functionality and performance
   - Monitor error rates and user experience
   - Implement automated alerting and notifications

Please provide comprehensive deployment automation guidance with zero-downtime and security considerations.
    `.trim();
  }

  private buildTestingAutomationPrompt(request: NodeJSWorkflowRequest): string {
    return `
Implement comprehensive Node.js testing automation:

**Testing Automation Workflow:**
1. **Test Strategy**: Design comprehensive testing approach
   - Plan unit testing for business logic
   - Implement integration testing for APIs
   - Set up end-to-end testing for user workflows
   - Plan performance and load testing

2. **Testing Framework**: Configure Jest testing framework
   - Set up test environment and configuration
   - Implement test data factories and mocking
   - Configure code coverage reporting
   - Plan parallel test execution

3. **API Testing**: Implement comprehensive API testing
   - Use Supertest for HTTP endpoint testing
   - Test authentication and authorization flows
   - Validate request/response schemas
   - Test error handling and edge cases

4. **Performance Testing**: Test application performance
   - Implement load testing for APIs
   - Test database performance and optimization
   - Monitor memory usage and memory leaks
   - Test concurrent user scenarios

5. **CI/CD Integration**: Integrate testing with pipeline
   - Configure automated test execution
   - Set up test reporting and notifications
   - Implement quality gates based on test results
   - Plan test environment management

Please provide comprehensive testing automation guidance with coverage, performance, and CI/CD integration.
    `.trim();
  }

  private buildPerformanceOptimizationPrompt(request: NodeJSWorkflowRequest): string {
    return `
Optimize Node.js application performance with comprehensive monitoring:

**Performance Optimization Workflow:**
1. **Performance Profiling**: Analyze application performance
   - Use Node.js profiling tools (Clinic.js, --inspect)
   - Identify performance bottlenecks and optimization opportunities
   - Analyze memory usage and garbage collection
   - Monitor CPU usage and event loop performance

2. **Code Optimization**: Optimize application code
   - Implement efficient algorithms and data structures
   - Optimize database queries and connection pooling
   - Configure caching strategies (Redis, in-memory)
   - Implement efficient JSON parsing and serialization

3. **Infrastructure Optimization**: Optimize server infrastructure
   - Configure HTTP/2 and response compression
   - Implement CDN for static asset delivery
   - Set up load balancing and horizontal scaling
   - Optimize network configuration and protocols

4. **Monitoring Implementation**: Set up performance monitoring
   - Implement APM (Application Performance Monitoring)
   - Track key performance indicators and metrics
   - Set up alerts for performance degradation
   - Monitor business metrics and user experience

5. **Continuous Optimization**: Implement ongoing optimization
   - Set up performance budgets and quality gates
   - Implement automated performance testing
   - Plan regular performance reviews and optimization
   - Monitor and optimize third-party service integrations

Please provide comprehensive performance optimization guidance with monitoring and continuous improvement strategies.
    `.trim();
  }

  private buildSecurityHardeningPrompt(request: NodeJSWorkflowRequest): string {
    return `
Implement comprehensive Node.js security hardening:

**Security Hardening Workflow:**
1. **Application Security**: Secure application code
   - Configure Helmet for security headers
   - Implement rate limiting and DDoS protection
   - Set up input validation and sanitization
   - Configure secure session management

2. **Authentication and Authorization**: Implement secure auth
   - Set up JWT or session-based authentication
   - Implement role-based access control (RBAC)
   - Configure multi-factor authentication
   - Plan password security and encryption

3. **Data Protection**: Protect sensitive data
   - Implement encryption for data at rest and in transit
   - Configure secure database connections
   - Set up secret management and key rotation
   - Implement data anonymization and privacy controls

4. **Security Monitoring**: Monitor security threats
   - Implement security event logging
   - Set up intrusion detection and prevention
   - Configure automated security scanning
   - Plan incident response procedures

5. **Compliance and Auditing**: Ensure security compliance
   - Implement audit logging and compliance reporting
   - Configure security testing and vulnerability scanning
   - Plan security training and awareness programs
   - Set up regular security assessments

Please provide comprehensive security hardening guidance with monitoring, compliance, and threat protection.
    `.trim();
  }

  private buildMonitoringSetupPrompt(request: NodeJSWorkflowRequest): string {
    return `
Set up comprehensive Node.js application monitoring:

**Monitoring Setup Workflow:**
1. **Metrics Collection**: Implement comprehensive metrics
   - Set up Prometheus metrics collection
   - Configure custom application metrics
   - Monitor system and infrastructure metrics
   - Track business and user experience metrics

2. **Logging Strategy**: Implement structured logging
   - Configure Winston for application logging
   - Set up log aggregation and centralization
   - Implement log rotation and retention policies
   - Plan security and error logging

3. **Health Monitoring**: Monitor application health
   - Implement health check endpoints
   - Configure uptime monitoring and alerting
   - Monitor database and external service health
   - Set up dependency health tracking

4. **Performance Monitoring**: Track performance metrics
   - Monitor response times and throughput
   - Track memory usage and garbage collection
   - Monitor CPU usage and event loop performance
   - Implement user experience monitoring

5. **Alerting and Notification**: Set up intelligent alerting
   - Configure alert rules and thresholds
   - Set up notification channels (email, Slack, SMS)
   - Implement escalation procedures
   - Plan on-call and incident response

Please provide comprehensive monitoring setup guidance with metrics, logging, and alerting best practices.
    `.trim();
  }

  private buildGenericWorkflowPrompt(request: NodeJSWorkflowRequest): string {
    return `
Execute Node.js workflow with intelligent assistance:

**Generic Node.js Workflow:**
1. **Workflow Analysis**: Understand workflow requirements
   - Analyze workflow type: ${request.workflowType}
   - Identify Node.js components and frameworks involved
   - Plan execution strategy and dependencies
   - Assess performance and security implications

2. **Environment Preparation**: Prepare Node.js environment
   - Verify Node.js version and package manager
   - Check required dependencies and packages
   - Validate configuration and environment variables
   - Ensure proper file permissions and access

3. **Execution Planning**: Plan workflow execution
   - Identify required npm commands and scripts
   - Plan process management operations
   - Consider caching and performance implications
   - Plan error handling and rollback procedures

4. **Intelligent Execution**: Execute with monitoring
   - Run workflow steps with proper error handling
   - Monitor execution progress and performance
   - Capture and analyze output and logs
   - Verify successful completion and health checks

5. **Optimization Recommendations**: Provide improvement suggestions
   - Identify performance optimization opportunities
   - Suggest security best practices
   - Recommend Node.js feature utilization
   - Plan future workflow improvements

Please provide comprehensive workflow guidance with Node.js best practices and optimization recommendations.
    `.trim();
  }

  private generateWorkflowId(): string {
    return `nodejs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get workflow status
   */
  getWorkflowStatus(workflowId: string): NodeJSWorkflowResult | undefined {
    return this.activeWorkflows.get(workflowId);
  }

  /**
   * Get all active workflows for session
   */
  getSessionWorkflows(sessionId: string): NodeJSWorkflowResult[] {
    return Array.from(this.activeWorkflows.values())
      .filter(workflow => workflow.sessionId === sessionId);
  }

  /**
   * Clean up completed workflows
   */
  cleanupWorkflows(maxAge: number = 3600000): void { // 1 hour default
    const cutoff = Date.now() - maxAge;
    for (const [workflowId, workflow] of this.activeWorkflows.entries()) {
      if (parseInt(workflowId.split('_')[1]) < cutoff) {
        this.activeWorkflows.delete(workflowId);
      }
    }
  }
}