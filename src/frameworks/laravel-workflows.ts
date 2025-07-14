/**
 * Enhanced Laravel Workflows for SSH MCP Server
 * Provides intelligent Laravel Artisan command integration and deployment automation
 * Leverages MCP ecosystem for framework-specific development workflows
 */

import { EventEmitter } from 'events';
import { AuditLogger, AuditEventType } from '../audit/audit-logger.js';
import { TechnologyStack } from '../ai/context7-integration.js';
import { MemoryOrchestrator } from '../memory/memory-orchestrator.js';

export enum LaravelWorkflowType {
  ARTISAN_COMMAND = 'artisan_command',
  MIGRATION_MANAGEMENT = 'migration_management',
  MODEL_GENERATION = 'model_generation',
  CONTROLLER_CREATION = 'controller_creation',
  MIDDLEWARE_SETUP = 'middleware_setup',
  SEEDER_EXECUTION = 'seeder_execution',
  QUEUE_MANAGEMENT = 'queue_management',
  CACHE_OPTIMIZATION = 'cache_optimization',
  ROUTE_ANALYSIS = 'route_analysis',
  COMPOSER_MANAGEMENT = 'composer_management',
  TESTING_AUTOMATION = 'testing_automation',
  DEPLOYMENT_AUTOMATION = 'deployment_automation',
  ENVIRONMENT_SETUP = 'environment_setup'
}

export enum LaravelEnvironment {
  LOCAL = 'local',
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
  TESTING = 'testing'
}

export enum LaravelVersion {
  LARAVEL_8 = '8.x',
  LARAVEL_9 = '9.x',
  LARAVEL_10 = '10.x',
  LARAVEL_11 = '11.x'
}

export interface LaravelProject {
  sessionId: string;
  projectPath: string;
  laravelVersion: LaravelVersion;
  phpVersion: string;
  environment: LaravelEnvironment;
  technology: TechnologyStack;
  packageManager: 'composer' | 'npm' | 'yarn' | 'pnpm';
  database: {
    driver: 'mysql' | 'postgresql' | 'sqlite' | 'sqlserver';
    host?: string;
    database?: string;
    migrationStatus: 'up-to-date' | 'pending' | 'unknown';
  };
  cache: {
    driver: 'file' | 'redis' | 'memcached' | 'array';
    config?: Record<string, any>;
  };
  queue: {
    driver: 'sync' | 'database' | 'redis' | 'sqs' | 'beanstalkd';
    workers: number;
  };
  structure: {
    appDir: string;
    configDir: string;
    databaseDir: string;
    publicDir: string;
    resourcesDir: string;
    routesDir: string;
    storageDir: string;
    testsDir: string;
    vendorDir: string;
  };
  features: {
    hasApi: boolean;
    hasAuth: boolean;
    hasQueue: boolean;
    hasWebsockets: boolean;
    hasScheduler: boolean;
    hasBroadcasting: boolean;
  };
}

export interface LaravelWorkflowRequest {
  sessionId: string;
  userId: string;
  workflowType: LaravelWorkflowType;
  projectInfo: LaravelProject;
  parameters: {
    artisanCommand?: string;
    modelName?: string;
    controllerName?: string;
    migrationName?: string;
    middlewareName?: string;
    environment?: LaravelEnvironment;
    deploymentTarget?: string;
    testSuite?: 'unit' | 'feature' | 'browser' | 'all';
    cacheStrategy?: 'clear' | 'optimize' | 'warmup';
    queueJob?: string;
    [key: string]: any;
  };
  mcpOptions?: {
    includeDocumentation: boolean;
    includeOptimization: boolean;
    includeSecurity: boolean;
    includePerformance: boolean;
  };
}

export interface LaravelWorkflowResult {
  workflowId: string;
  sessionId: string;
  workflowType: LaravelWorkflowType;
  mcpWorkflow: string;
  artisanCommands: string[];
  composerCommands: string[];
  systemCommands: string[];
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
  databaseOperations: Array<{
    type: 'migration' | 'seeder' | 'factory';
    command: string;
    rollback?: string;
  }>;
  deploymentSteps: string[];
  healthChecks: Array<{
    name: string;
    command: string;
    expectedResult: string;
  }>;
  recommendations: string[];
  securityNotes: string[];
  performanceImpact: 'low' | 'medium' | 'high';
  estimatedTime: string;
  rollbackPlan: string[];
}

/**
 * Laravel Workflow Manager
 * Provides intelligent, MCP-powered Laravel development workflows
 */
export class LaravelWorkflowManager extends EventEmitter {
  private auditLogger: AuditLogger;
  private memoryOrchestrator: MemoryOrchestrator;
  private activeWorkflows: Map<string, LaravelWorkflowResult> = new Map();

  constructor(
    auditLogger: AuditLogger,
    memoryOrchestrator: MemoryOrchestrator
  ) {
    super();
    this.auditLogger = auditLogger;
    this.memoryOrchestrator = memoryOrchestrator;
  }

  /**
   * Execute Laravel workflow with MCP intelligence
   */
  async executeWorkflow(request: LaravelWorkflowRequest): Promise<LaravelWorkflowResult> {
    const workflowId = this.generateWorkflowId();
    
    try {
      // Log workflow initiation
      await this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
        userId: request.userId,
        sessionId: request.sessionId,
        description: `Laravel workflow initiated: ${request.workflowType}`,
        outcome: 'success',
        eventDetails: {
          workflowType: request.workflowType,
          projectPath: request.projectInfo.projectPath,
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
        'laravel_workflow',
        {
          type: request.workflowType,
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
        description: `Laravel workflow failed: ${request.workflowType}`,
        outcome: 'failure',
        eventDetails: { error: error instanceof Error ? error.message : String(error) }
      });
      
      throw error;
    }
  }

  /**
   * Analyze Laravel project structure and capabilities
   */
  async analyzeProject(sessionId: string, projectPath: string): Promise<LaravelProject> {
    const mcpWorkflow = this.buildProjectAnalysisPrompt(projectPath);
    
    // Return analyzed project structure (would be enhanced with actual analysis)
    const project: LaravelProject = {
      sessionId,
      projectPath,
      laravelVersion: LaravelVersion.LARAVEL_11,
      phpVersion: '8.2',
      environment: LaravelEnvironment.LOCAL,
      technology: TechnologyStack.LARAVEL,
      packageManager: 'composer',
      database: {
        driver: 'mysql',
        migrationStatus: 'unknown'
      },
      cache: {
        driver: 'file'
      },
      queue: {
        driver: 'sync',
        workers: 1
      },
      structure: {
        appDir: 'app',
        configDir: 'config',
        databaseDir: 'database',
        publicDir: 'public',
        resourcesDir: 'resources',
        routesDir: 'routes',
        storageDir: 'storage',
        testsDir: 'tests',
        vendorDir: 'vendor'
      },
      features: {
        hasApi: false,
        hasAuth: false,
        hasQueue: false,
        hasWebsockets: false,
        hasScheduler: false,
        hasBroadcasting: false
      }
    };

    return project;
  }

  /**
   * Get deployment recommendations for Laravel project
   */
  async getDeploymentRecommendations(
    project: LaravelProject,
    targetEnvironment: LaravelEnvironment
  ): Promise<string[]> {
    return [
      'Run composer install --optimize-autoloader --no-dev',
      'Execute php artisan config:cache',
      'Run php artisan route:cache',
      'Execute php artisan view:cache',
      'Set proper file permissions for storage and bootstrap/cache',
      'Configure environment variables for production',
      'Set up database migration strategy',
      'Configure queue workers for background jobs',
      'Set up monitoring and logging',
      'Configure SSL certificates and HTTPS'
    ];
  }

  /**
   * Generate workflow based on type
   */
  private async generateWorkflow(
    workflowId: string,
    request: LaravelWorkflowRequest
  ): Promise<LaravelWorkflowResult> {
    switch (request.workflowType) {
      case LaravelWorkflowType.ARTISAN_COMMAND:
        return this.generateArtisanWorkflow(workflowId, request);
      
      case LaravelWorkflowType.MIGRATION_MANAGEMENT:
        return this.generateMigrationWorkflow(workflowId, request);
      
      case LaravelWorkflowType.MODEL_GENERATION:
        return this.generateModelWorkflow(workflowId, request);
      
      case LaravelWorkflowType.CONTROLLER_CREATION:
        return this.generateControllerWorkflow(workflowId, request);
      
      case LaravelWorkflowType.DEPLOYMENT_AUTOMATION:
        return this.generateDeploymentWorkflow(workflowId, request);
      
      case LaravelWorkflowType.TESTING_AUTOMATION:
        return this.generateTestingWorkflow(workflowId, request);
      
      case LaravelWorkflowType.QUEUE_MANAGEMENT:
        return this.generateQueueWorkflow(workflowId, request);
      
      case LaravelWorkflowType.CACHE_OPTIMIZATION:
        return this.generateCacheWorkflow(workflowId, request);
      
      default:
        return this.generateGenericWorkflow(workflowId, request);
    }
  }

  /**
   * Generate Artisan command workflow
   */
  private async generateArtisanWorkflow(
    workflowId: string,
    request: LaravelWorkflowRequest
  ): Promise<LaravelWorkflowResult> {
    const mcpWorkflow = this.buildArtisanCommandPrompt(request);
    
    return {
      workflowId,
      sessionId: request.sessionId,
      workflowType: request.workflowType,
      mcpWorkflow,
      artisanCommands: [
        request.parameters.artisanCommand || 'php artisan list'
      ],
      composerCommands: [],
      systemCommands: [],
      files: [],
      configChanges: [],
      databaseOperations: [],
      deploymentSteps: [],
      healthChecks: [
        {
          name: 'Artisan Command Status',
          command: 'php artisan --version',
          expectedResult: 'Laravel Framework'
        }
      ],
      recommendations: [
        'Review command output for any warnings or errors',
        'Check logs for any issues during command execution'
      ],
      securityNotes: [
        'Ensure Artisan commands are run with appropriate permissions'
      ],
      performanceImpact: 'low',
      estimatedTime: '1-2 minutes',
      rollbackPlan: []
    };
  }

  /**
   * Generate migration management workflow
   */
  private async generateMigrationWorkflow(
    workflowId: string,
    request: LaravelWorkflowRequest
  ): Promise<LaravelWorkflowResult> {
    const mcpWorkflow = this.buildMigrationManagementPrompt(request);
    
    return {
      workflowId,
      sessionId: request.sessionId,
      workflowType: request.workflowType,
      mcpWorkflow,
      artisanCommands: [
        'php artisan migrate:status',
        'php artisan migrate --force'
      ],
      composerCommands: [],
      systemCommands: [],
      files: [],
      configChanges: [],
      databaseOperations: [
        {
          type: 'migration',
          command: 'php artisan migrate',
          rollback: 'php artisan migrate:rollback'
        }
      ],
      deploymentSteps: [
        'Backup current database',
        'Run migration status check',
        'Execute pending migrations',
        'Verify migration completion'
      ],
      healthChecks: [
        {
          name: 'Database Connection',
          command: 'php artisan tinker --execute="DB::connection()->getPdo();"',
          expectedResult: 'PDO connection object'
        },
        {
          name: 'Migration Status',
          command: 'php artisan migrate:status',
          expectedResult: 'All migrations should show as [Yes]'
        }
      ],
      recommendations: [
        'Always backup database before running migrations',
        'Test migrations in development environment first',
        'Review migration files for any potential data loss operations'
      ],
      securityNotes: [
        'Ensure database credentials are properly secured',
        'Review migration files for sensitive data exposure'
      ],
      performanceImpact: 'medium',
      estimatedTime: '2-5 minutes',
      rollbackPlan: [
        'php artisan migrate:rollback',
        'Restore database from backup if needed'
      ]
    };
  }

  /**
   * Generate model creation workflow
   */
  private async generateModelWorkflow(
    workflowId: string,
    request: LaravelWorkflowRequest
  ): Promise<LaravelWorkflowResult> {
    const modelName = request.parameters.modelName || 'ExampleModel';
    const mcpWorkflow = this.buildModelGenerationPrompt(request);
    
    return {
      workflowId,
      sessionId: request.sessionId,
      workflowType: request.workflowType,
      mcpWorkflow,
      artisanCommands: [
        `php artisan make:model ${modelName} -mcr`,
        `php artisan make:factory ${modelName}Factory`,
        `php artisan make:seeder ${modelName}Seeder`
      ],
      composerCommands: [],
      systemCommands: [],
      files: [
        {
          path: `app/Models/${modelName}.php`,
          content: `<?php\n\nnamespace App\\Models;\n\nuse Illuminate\\Database\\Eloquent\\Model;\n\nclass ${modelName} extends Model\n{\n    protected $fillable = [];\n}`,
          action: 'create'
        }
      ],
      configChanges: [],
      databaseOperations: [
        {
          type: 'migration',
          command: `php artisan make:migration create_${modelName.toLowerCase()}s_table`,
          rollback: 'php artisan migrate:rollback'
        }
      ],
      deploymentSteps: [
        'Generate model and related files',
        'Create and run migration',
        'Set up relationships and business logic',
        'Create factory and seeder for testing'
      ],
      healthChecks: [
        {
          name: 'Model File Creation',
          command: `ls -la app/Models/${modelName}.php`,
          expectedResult: 'File should exist'
        }
      ],
      recommendations: [
        'Define fillable fields in the model',
        'Set up appropriate relationships',
        'Add model validation rules',
        'Create comprehensive factory definitions'
      ],
      securityNotes: [
        'Use fillable or guarded properties to prevent mass assignment',
        'Implement proper authorization policies'
      ],
      performanceImpact: 'low',
      estimatedTime: '3-5 minutes',
      rollbackPlan: [
        'Delete generated files if needed',
        'Rollback migration if run'
      ]
    };
  }

  /**
   * Generate controller creation workflow
   */
  private async generateControllerWorkflow(
    workflowId: string,
    request: LaravelWorkflowRequest
  ): Promise<LaravelWorkflowResult> {
    const controllerName = request.parameters.controllerName || 'ExampleController';
    const mcpWorkflow = this.buildControllerCreationPrompt(request);
    
    return {
      workflowId,
      sessionId: request.sessionId,
      workflowType: request.workflowType,
      mcpWorkflow,
      artisanCommands: [
        `php artisan make:controller ${controllerName} --resource`,
        `php artisan make:request Store${controllerName.replace('Controller', '')}Request`,
        `php artisan make:request Update${controllerName.replace('Controller', '')}Request`
      ],
      composerCommands: [],
      systemCommands: [],
      files: [],
      configChanges: [],
      databaseOperations: [],
      deploymentSteps: [
        'Generate controller with resource methods',
        'Create form request classes for validation',
        'Set up routes in web.php or api.php',
        'Implement controller logic and validation'
      ],
      healthChecks: [
        {
          name: 'Controller File Creation',
          command: `ls -la app/Http/Controllers/${controllerName}.php`,
          expectedResult: 'File should exist'
        },
        {
          name: 'Route Registration',
          command: 'php artisan route:list',
          expectedResult: 'Routes should be listed'
        }
      ],
      recommendations: [
        'Implement proper validation in form requests',
        'Add authorization middleware where needed',
        'Follow RESTful conventions for resource controllers',
        'Add comprehensive error handling'
      ],
      securityNotes: [
        'Implement proper authorization checks',
        'Validate all user inputs',
        'Use CSRF protection for forms'
      ],
      performanceImpact: 'low',
      estimatedTime: '3-5 minutes',
      rollbackPlan: [
        'Delete generated controller and request files',
        'Remove routes if added'
      ]
    };
  }

  /**
   * Generate deployment automation workflow
   */
  private async generateDeploymentWorkflow(
    workflowId: string,
    request: LaravelWorkflowRequest
  ): Promise<LaravelWorkflowResult> {
    const environment = request.parameters.environment || LaravelEnvironment.PRODUCTION;
    const mcpWorkflow = this.buildDeploymentAutomationPrompt(request);
    
    return {
      workflowId,
      sessionId: request.sessionId,
      workflowType: request.workflowType,
      mcpWorkflow,
      artisanCommands: [
        'php artisan down --retry=60',
        'php artisan config:cache',
        'php artisan route:cache',
        'php artisan view:cache',
        'php artisan migrate --force',
        'php artisan queue:restart',
        'php artisan up'
      ],
      composerCommands: [
        'composer install --optimize-autoloader --no-dev'
      ],
      systemCommands: [
        'git pull origin main',
        'sudo systemctl restart php8.2-fpm',
        'sudo systemctl reload nginx'
      ],
      files: [],
      configChanges: [
        {
          file: '.env',
          changes: {
            APP_ENV: environment,
            APP_DEBUG: environment === LaravelEnvironment.PRODUCTION ? 'false' : 'true'
          },
          backup: true
        }
      ],
      databaseOperations: [
        {
          type: 'migration',
          command: 'php artisan migrate --force',
          rollback: 'php artisan migrate:rollback'
        }
      ],
      deploymentSteps: [
        'Put application in maintenance mode',
        'Pull latest code from repository',
        'Install/update Composer dependencies',
        'Clear and rebuild application caches',
        'Run database migrations',
        'Restart queue workers',
        'Restart web server processes',
        'Take application out of maintenance mode',
        'Verify deployment health'
      ],
      healthChecks: [
        {
          name: 'Application Health',
          command: 'curl -f http://localhost/health',
          expectedResult: 'HTTP 200 OK'
        },
        {
          name: 'Database Connection',
          command: 'php artisan tinker --execute="DB::connection()->getPdo();"',
          expectedResult: 'Successful connection'
        },
        {
          name: 'Queue Workers',
          command: 'supervisorctl status',
          expectedResult: 'All processes running'
        }
      ],
      recommendations: [
        'Test deployment process in staging environment first',
        'Monitor application logs during deployment',
        'Have rollback plan ready',
        'Notify team of deployment status'
      ],
      securityNotes: [
        'Ensure environment variables are properly set',
        'Verify file permissions are correct',
        'Check that debug mode is disabled in production'
      ],
      performanceImpact: 'high',
      estimatedTime: '5-10 minutes',
      rollbackPlan: [
        'git checkout previous-commit-hash',
        'composer install --optimize-autoloader --no-dev',
        'php artisan migrate:rollback',
        'php artisan config:cache',
        'php artisan up'
      ]
    };
  }

  /**
   * Generate testing automation workflow
   */
  private async generateTestingWorkflow(
    workflowId: string,
    request: LaravelWorkflowRequest
  ): Promise<LaravelWorkflowResult> {
    const testSuite = request.parameters.testSuite || 'all';
    const mcpWorkflow = this.buildTestingAutomationPrompt(request);
    
    const testCommands = {
      unit: ['./vendor/bin/phpunit --testsuite=Unit'],
      feature: ['./vendor/bin/phpunit --testsuite=Feature'],
      browser: ['php artisan dusk'],
      all: [
        './vendor/bin/phpunit',
        'php artisan dusk'
      ]
    };

    return {
      workflowId,
      sessionId: request.sessionId,
      workflowType: request.workflowType,
      mcpWorkflow,
      artisanCommands: [
        'php artisan config:clear',
        'php artisan test --parallel'
      ],
      composerCommands: [
        'composer install --dev'
      ],
      systemCommands: testCommands[testSuite as keyof typeof testCommands] || testCommands.all,
      files: [],
      configChanges: [],
      databaseOperations: [],
      deploymentSteps: [
        'Set up testing environment',
        'Install development dependencies',
        'Run database migrations for testing',
        'Execute test suites',
        'Generate test coverage reports'
      ],
      healthChecks: [
        {
          name: 'PHPUnit Installation',
          command: './vendor/bin/phpunit --version',
          expectedResult: 'PHPUnit version info'
        },
        {
          name: 'Test Database',
          command: 'php artisan migrate --env=testing',
          expectedResult: 'Migrations completed'
        }
      ],
      recommendations: [
        'Maintain high test coverage (>80%)',
        'Run tests before every deployment',
        'Use database transactions for faster tests',
        'Mock external services in tests'
      ],
      securityNotes: [
        'Use separate testing database',
        'Ensure test data doesn\'t contain real user information'
      ],
      performanceImpact: 'medium',
      estimatedTime: '3-10 minutes',
      rollbackPlan: []
    };
  }

  /**
   * Generate queue management workflow
   */
  private async generateQueueWorkflow(
    workflowId: string,
    request: LaravelWorkflowRequest
  ): Promise<LaravelWorkflowResult> {
    const mcpWorkflow = this.buildQueueManagementPrompt(request);
    
    return {
      workflowId,
      sessionId: request.sessionId,
      workflowType: request.workflowType,
      mcpWorkflow,
      artisanCommands: [
        'php artisan queue:work --daemon',
        'php artisan queue:listen',
        'php artisan queue:restart',
        'php artisan queue:failed'
      ],
      composerCommands: [],
      systemCommands: [
        'supervisorctl restart laravel-worker:*'
      ],
      files: [],
      configChanges: [],
      databaseOperations: [],
      deploymentSteps: [
        'Configure queue driver',
        'Set up queue workers',
        'Configure supervisor for worker management',
        'Monitor queue performance'
      ],
      healthChecks: [
        {
          name: 'Queue Worker Status',
          command: 'supervisorctl status laravel-worker:*',
          expectedResult: 'Workers running'
        },
        {
          name: 'Queue Connection',
          command: 'php artisan queue:monitor redis:default',
          expectedResult: 'Queue accessible'
        }
      ],
      recommendations: [
        'Use Redis or database for persistent queues',
        'Set up proper worker monitoring',
        'Implement job failure handling',
        'Monitor queue performance metrics'
      ],
      securityNotes: [
        'Secure queue connection credentials',
        'Implement job authorization checks'
      ],
      performanceImpact: 'medium',
      estimatedTime: '5-15 minutes',
      rollbackPlan: [
        'Stop queue workers',
        'Revert queue configuration'
      ]
    };
  }

  /**
   * Generate cache optimization workflow
   */
  private async generateCacheWorkflow(
    workflowId: string,
    request: LaravelWorkflowRequest
  ): Promise<LaravelWorkflowResult> {
    const strategy = request.parameters.cacheStrategy || 'optimize';
    const mcpWorkflow = this.buildCacheOptimizationPrompt(request);
    
    const cacheCommands = {
      clear: [
        'php artisan cache:clear',
        'php artisan config:clear',
        'php artisan route:clear',
        'php artisan view:clear'
      ],
      optimize: [
        'php artisan config:cache',
        'php artisan route:cache',
        'php artisan view:cache',
        'php artisan optimize'
      ],
      warmup: [
        'php artisan cache:clear',
        'php artisan config:cache',
        'php artisan route:cache',
        'php artisan view:cache'
      ]
    };

    return {
      workflowId,
      sessionId: request.sessionId,
      workflowType: request.workflowType,
      mcpWorkflow,
      artisanCommands: cacheCommands[strategy as keyof typeof cacheCommands] || cacheCommands.optimize,
      composerCommands: [],
      systemCommands: [],
      files: [],
      configChanges: [],
      databaseOperations: [],
      deploymentSteps: [
        'Analyze current cache configuration',
        'Clear existing caches if needed',
        'Rebuild optimized caches',
        'Verify cache performance'
      ],
      healthChecks: [
        {
          name: 'Config Cache',
          command: 'ls -la bootstrap/cache/config.php',
          expectedResult: 'Cache file exists'
        },
        {
          name: 'Route Cache',
          command: 'ls -la bootstrap/cache/routes-v7.php',
          expectedResult: 'Cache file exists'
        }
      ],
      recommendations: [
        'Use file cache for single-server setups',
        'Use Redis for multi-server environments',
        'Monitor cache hit rates',
        'Clear caches after configuration changes'
      ],
      securityNotes: [
        'Ensure cache directory permissions are secure',
        'Don\'t cache sensitive configuration in production'
      ],
      performanceImpact: 'low',
      estimatedTime: '1-3 minutes',
      rollbackPlan: [
        'php artisan cache:clear',
        'php artisan config:clear'
      ]
    };
  }

  /**
   * Generate generic workflow
   */
  private async generateGenericWorkflow(
    workflowId: string,
    request: LaravelWorkflowRequest
  ): Promise<LaravelWorkflowResult> {
    const mcpWorkflow = this.buildGenericWorkflowPrompt(request);
    
    return {
      workflowId,
      sessionId: request.sessionId,
      workflowType: request.workflowType,
      mcpWorkflow,
      artisanCommands: ['php artisan list'],
      composerCommands: [],
      systemCommands: [],
      files: [],
      configChanges: [],
      databaseOperations: [],
      deploymentSteps: [],
      healthChecks: [],
      recommendations: [
        'Review Laravel documentation for best practices',
        'Consider using appropriate Artisan commands for this workflow'
      ],
      securityNotes: [],
      performanceImpact: 'low',
      estimatedTime: '2-5 minutes',
      rollbackPlan: []
    };
  }

  // MCP Workflow Prompt Builders

  private buildProjectAnalysisPrompt(projectPath: string): string {
    return `
Analyze Laravel project structure and generate comprehensive project intelligence:

**Project Analysis Workflow:**
1. **File System Analysis**: Scan project directory structure at ${projectPath}
   - Detect Laravel version from composer.json
   - Identify installed packages and dependencies  
   - Check environment configuration files
   - Analyze directory structure and naming conventions

2. **Database Analysis**: Examine database configuration and state
   - Check database driver and connection settings
   - Scan migration files and current migration status
   - Identify models and relationships
   - Check for seeders and factories

3. **Feature Detection**: Identify enabled Laravel features
   - API routes and controllers
   - Authentication system (Laravel Breeze, Jetstream, Sanctum)
   - Queue configuration and jobs
   - WebSocket/Broadcasting setup
   - Scheduled tasks and commands

4. **Code Quality Assessment**: Analyze code structure and patterns
   - PSR compliance checking
   - Code organization and architecture patterns
   - Test coverage and test structure
   - Security best practices implementation

5. **Performance Analysis**: Identify performance optimization opportunities
   - Cache configuration and usage
   - Database query optimization opportunities
   - Asset optimization setup
   - CDN and static file serving

Please provide detailed analysis results for Laravel development optimization.
    `.trim();
  }

  private buildArtisanCommandPrompt(request: LaravelWorkflowRequest): string {
    const command = request.parameters.artisanCommand || 'list';
    
    return `
Execute Laravel Artisan command with intelligent assistance:

**Artisan Command Execution Workflow:**
1. **Command Analysis**: Analyze the Artisan command: ${command}
   - Validate command syntax and parameters
   - Check command availability in current Laravel version
   - Identify potential risks or side effects
   - Suggest command optimizations or alternatives

2. **Pre-execution Checks**: Verify system readiness
   - Check Laravel installation and version compatibility
   - Verify database connectivity if command requires it
   - Check file permissions for write operations
   - Validate environment configuration

3. **Intelligent Execution**: Execute with monitoring
   - Run command with appropriate error handling
   - Monitor execution time and resource usage
   - Capture and analyze command output
   - Detect and report any warnings or errors

4. **Post-execution Analysis**: Analyze results and impact
   - Verify command completed successfully
   - Check for any generated files or database changes
   - Identify any follow-up actions needed
   - Provide optimization recommendations

5. **Documentation Generation**: Create execution record
   - Document command purpose and outcome
   - Generate rollback instructions if applicable
   - Create learning notes for future reference

Please provide comprehensive Artisan command execution guidance.
    `.trim();
  }

  private buildMigrationManagementPrompt(request: LaravelWorkflowRequest): string {
    return `
Manage Laravel database migrations with intelligent workflow:

**Migration Management Workflow:**
1. **Migration Analysis**: Analyze current migration state
   - Check migration status and pending migrations
   - Identify potential conflicts or dependencies
   - Analyze migration file contents for risks
   - Check database schema consistency

2. **Backup Strategy**: Implement database protection
   - Create automated database backup before changes
   - Document current schema state
   - Identify critical data that needs protection
   - Plan rollback procedures

3. **Migration Execution**: Execute with monitoring
   - Run migrations in correct dependency order
   - Monitor execution progress and performance
   - Handle migration failures gracefully
   - Verify schema changes are applied correctly

4. **Data Integrity Validation**: Ensure data consistency
   - Verify foreign key constraints
   - Check data type conversions
   - Validate data migration results
   - Test application functionality post-migration

5. **Performance Optimization**: Optimize database performance
   - Add appropriate indexes
   - Analyze query performance impact
   - Suggest schema optimizations
   - Monitor database performance metrics

Please provide comprehensive migration management guidance.
    `.trim();
  }

  private buildModelGenerationPrompt(request: LaravelWorkflowRequest): string {
    const modelName = request.parameters.modelName || 'Model';
    
    return `
Generate Laravel Eloquent model with comprehensive setup:

**Model Generation Workflow for ${modelName}:**
1. **Model Architecture**: Design optimal model structure
   - Define model relationships and associations
   - Plan attribute casting and mutators/accessors
   - Design fillable/guarded field security
   - Plan validation rules and business logic

2. **Database Schema**: Create comprehensive database design
   - Generate migration with appropriate field types
   - Define indexes for performance optimization
   - Set up foreign key constraints
   - Plan soft deletes and timestamps

3. **Factory and Seeding**: Create test data infrastructure
   - Generate factory with realistic fake data
   - Create seeder for development/testing
   - Plan data relationships for testing
   - Consider edge cases in test data

4. **Relationships Setup**: Configure Eloquent relationships
   - Define hasMany, belongsTo, belongsToMany relationships
   - Set up polymorphic relationships if needed
   - Configure eager loading strategies
   - Plan relationship constraints and cascading

5. **Security Implementation**: Implement security best practices
   - Configure mass assignment protection
   - Set up attribute casting for security
   - Plan authorization policies
   - Implement data validation rules

6. **Performance Optimization**: Optimize model performance
   - Configure eager loading relationships
   - Set up model caching strategies
   - Plan query optimization
   - Configure database indexes

Please provide comprehensive model generation guidance with security and performance considerations.
    `.trim();
  }

  private buildControllerCreationPrompt(request: LaravelWorkflowRequest): string {
    const controllerName = request.parameters.controllerName || 'Controller';
    
    return `
Create Laravel controller with comprehensive functionality:

**Controller Creation Workflow for ${controllerName}:**
1. **Controller Architecture**: Design RESTful controller structure
   - Plan resource methods (index, create, store, show, edit, update, destroy)
   - Design API vs Web controller patterns
   - Plan middleware integration (auth, throttle, CORS)
   - Structure dependency injection and service layer

2. **Validation Strategy**: Implement comprehensive input validation
   - Create Form Request classes for validation rules
   - Design validation error handling
   - Implement authorization checks
   - Plan file upload validation if needed

3. **Business Logic**: Implement core functionality
   - Design service layer integration
   - Plan database operations and transactions
   - Implement error handling and logging
   - Design response formatting (JSON API, web responses)

4. **Security Implementation**: Secure controller actions
   - Implement CSRF protection
   - Set up authorization policies
   - Plan rate limiting and throttling
   - Implement input sanitization

5. **API Documentation**: Generate comprehensive API docs
   - Document all endpoints and parameters
   - Provide request/response examples
   - Document authentication requirements
   - Create Postman/OpenAPI specifications

6. **Testing Strategy**: Plan comprehensive testing
   - Create unit tests for business logic
   - Design feature tests for endpoints
   - Plan integration testing scenarios
   - Implement test data factories

Please provide comprehensive controller creation guidance with security, validation, and testing considerations.
    `.trim();
  }

  private buildDeploymentAutomationPrompt(request: LaravelWorkflowRequest): string {
    const environment = request.parameters.environment || 'production';
    
    return `
Execute Laravel deployment automation with zero-downtime strategy:

**Deployment Automation Workflow for ${environment}:**
1. **Pre-deployment Validation**: Ensure deployment readiness
   - Run comprehensive test suite
   - Check code quality and security scans
   - Validate environment configuration
   - Verify database migration safety

2. **Backup and Safety**: Implement comprehensive backup strategy
   - Create database backup with versioning
   - Backup application files and configuration
   - Document current deployment state
   - Plan emergency rollback procedures

3. **Zero-downtime Deployment**: Execute seamless deployment
   - Use maintenance mode with custom page
   - Deploy to staging slot first
   - Execute database migrations safely
   - Switch traffic atomically

4. **Cache and Optimization**: Optimize application performance
   - Clear and rebuild all caches
   - Optimize Composer autoloader
   - Generate optimized configuration
   - Warm up application caches

5. **Health Monitoring**: Comprehensive deployment verification
   - Check application health endpoints
   - Verify database connectivity
   - Test critical user journeys
   - Monitor error rates and performance

6. **Post-deployment Tasks**: Complete deployment workflow
   - Restart queue workers and schedulers
   - Update monitoring and alerting
   - Notify team of deployment status
   - Update deployment documentation

7. **Rollback Planning**: Prepare for emergency rollback
   - Document exact rollback procedures
   - Test rollback process in staging
   - Monitor deployment for issues
   - Plan communication strategy

Please provide comprehensive deployment automation guidance with zero-downtime and safety considerations.
    `.trim();
  }

  private buildTestingAutomationPrompt(request: LaravelWorkflowRequest): string {
    const testSuite = request.parameters.testSuite || 'all';
    
    return `
Execute comprehensive Laravel testing automation:

**Testing Automation Workflow for ${testSuite} tests:**
1. **Test Environment Setup**: Prepare optimal testing environment
   - Configure dedicated testing database
   - Set up test-specific environment variables
   - Install development dependencies
   - Configure test data factories and seeders

2. **Test Execution Strategy**: Run comprehensive test suites
   - Execute unit tests for business logic
   - Run feature tests for application workflows
   - Perform browser tests for user interactions
   - Execute API integration tests

3. **Code Coverage Analysis**: Measure test coverage
   - Generate comprehensive coverage reports
   - Identify untested code paths
   - Analyze critical path coverage
   - Set coverage quality gates

4. **Performance Testing**: Validate application performance
   - Run database query performance tests
   - Execute API response time testing
   - Test memory usage and optimization
   - Validate concurrent user scenarios

5. **Security Testing**: Automated security validation
   - Test authentication and authorization
   - Validate input sanitization
   - Check for SQL injection vulnerabilities
   - Test CSRF and XSS protection

6. **Test Reporting**: Generate comprehensive test reports
   - Create detailed test execution reports
   - Generate coverage and quality metrics
   - Document test failures and remediation
   - Integrate with CI/CD pipeline reporting

Please provide comprehensive testing automation guidance with coverage, performance, and security considerations.
    `.trim();
  }

  private buildQueueManagementPrompt(request: LaravelWorkflowRequest): string {
    return `
Manage Laravel queue system with intelligent monitoring:

**Queue Management Workflow:**
1. **Queue Configuration**: Optimize queue setup
   - Configure appropriate queue driver (Redis, Database, SQS)
   - Set up queue worker processes
   - Configure job batching and retries
   - Plan queue prioritization strategy

2. **Worker Management**: Manage queue workers efficiently
   - Set up Supervisor for worker process management
   - Configure worker scaling based on load
   - Implement graceful worker restarts
   - Monitor worker memory usage and restart policies

3. **Job Processing**: Optimize job execution
   - Implement job middleware for logging and monitoring
   - Set up job chaining and batching
   - Configure job timeouts and failure handling
   - Plan job data serialization and security

4. **Monitoring and Alerting**: Comprehensive queue monitoring
   - Monitor queue depth and processing rates
   - Set up alerts for failed jobs and worker issues
   - Track job execution times and performance
   - Monitor memory usage and system resources

5. **Failure Handling**: Robust error management
   - Configure failed job handling and retries
   - Implement job failure notifications
   - Plan manual intervention procedures
   - Set up job replay capabilities

6. **Performance Optimization**: Scale queue performance
   - Optimize job payload size and processing
   - Configure connection pooling and batching
   - Plan horizontal scaling strategies
   - Monitor and optimize database queue performance

Please provide comprehensive queue management guidance with monitoring, scaling, and reliability considerations.
    `.trim();
  }

  private buildCacheOptimizationPrompt(request: LaravelWorkflowRequest): string {
    const strategy = request.parameters.cacheStrategy || 'optimize';
    
    return `
Optimize Laravel caching system for maximum performance:

**Cache Optimization Workflow - ${strategy} strategy:**
1. **Cache Analysis**: Analyze current caching configuration
   - Audit current cache drivers and configuration
   - Identify cache hit/miss ratios
   - Analyze cache key distribution and expiration
   - Review application cache usage patterns

2. **Configuration Optimization**: Optimize cache settings
   - Configure appropriate cache drivers for environment
   - Set up Redis clustering for high availability
   - Optimize cache key naming and namespacing
   - Configure cache serialization and compression

3. **Application Cache**: Optimize application-level caching
   - Implement view caching and optimization
   - Set up configuration and route caching
   - Optimize database query caching
   - Configure session and authentication caching

4. **Performance Monitoring**: Monitor cache performance
   - Track cache hit rates and performance metrics
   - Monitor cache memory usage and eviction
   - Analyze cache invalidation patterns
   - Set up cache performance alerting

5. **Cache Warming**: Implement intelligent cache warming
   - Pre-populate critical cache entries
   - Set up automated cache warming procedures
   - Configure cache warming for deployments
   - Plan cache warming for high-traffic scenarios

6. **Cache Invalidation**: Optimize cache invalidation strategy
   - Implement intelligent cache tagging
   - Set up event-driven cache invalidation
   - Configure cache versioning strategies
   - Plan cache invalidation for data updates

Please provide comprehensive cache optimization guidance with performance monitoring and invalidation strategies.
    `.trim();
  }

  private buildGenericWorkflowPrompt(request: LaravelWorkflowRequest): string {
    return `
Execute Laravel workflow with intelligent assistance:

**Generic Laravel Workflow:**
1. **Workflow Analysis**: Understand workflow requirements
   - Analyze workflow type: ${request.workflowType}
   - Identify Laravel components involved
   - Plan execution strategy and dependencies
   - Assess security and performance impact

2. **Environment Preparation**: Prepare Laravel environment
   - Verify Laravel installation and version
   - Check required dependencies and extensions
   - Validate configuration and environment variables
   - Ensure proper file permissions

3. **Execution Planning**: Plan workflow execution
   - Identify required Artisan commands
   - Plan database operations if needed
   - Consider caching and performance implications
   - Plan error handling and rollback procedures

4. **Intelligent Execution**: Execute with monitoring
   - Run workflow steps with proper error handling
   - Monitor execution progress and performance
   - Capture and analyze output and logs
   - Verify successful completion

5. **Optimization Recommendations**: Provide improvement suggestions
   - Identify performance optimization opportunities
   - Suggest security best practices
   - Recommend Laravel feature utilization
   - Plan future workflow improvements

Please provide comprehensive workflow guidance with Laravel best practices and optimization recommendations.
    `.trim();
  }

  private generateWorkflowId(): string {
    return `laravel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get workflow status
   */
  getWorkflowStatus(workflowId: string): LaravelWorkflowResult | undefined {
    return this.activeWorkflows.get(workflowId);
  }

  /**
   * Get all active workflows for session
   */
  getSessionWorkflows(sessionId: string): LaravelWorkflowResult[] {
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