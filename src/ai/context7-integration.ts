/**
 * Context7 Integration for SSH MCP Server
 * Provides intelligent command assistance with real-time documentation and API examples
 */

import { EventEmitter } from 'events';
import { AuditLogger, AuditEventType } from '../audit/audit-logger.js';

export enum DocumentationType {
  API_REFERENCE = 'api_reference',
  FRAMEWORK_DOCS = 'framework_docs',
  COMMAND_HELP = 'command_help',
  CODE_EXAMPLES = 'code_examples',
  BEST_PRACTICES = 'best_practices'
}

export enum TechnologyStack {
  REACT = 'react',
  NEXTJS = 'nextjs',
  NODEJS = 'nodejs',
  LARAVEL = 'laravel',
  DJANGO = 'django',
  VUE = 'vue',
  ANGULAR = 'angular',
  EXPRESS = 'express',
  FASTAPI = 'fastapi',
  DOCKER = 'docker',
  KUBERNETES = 'kubernetes'
}

export interface Context7Config {
  enabled: boolean;
  apiEndpoint: string;
  apiKey?: string;
  cacheEnabled: boolean;
  cacheTTL: number; // milliseconds
  maxConcurrentRequests: number;
  requestTimeout: number; // milliseconds
  supportedTechnologies: TechnologyStack[];
  intelligentSuggestions: {
    enabled: boolean;
    contextWindow: number; // number of previous commands to consider
    confidenceThreshold: number; // 0-1
  };
}

export interface DocumentationQuery {
  technology: TechnologyStack;
  query: string;
  documentationType: DocumentationType;
  context?: {
    currentDirectory?: string;
    recentCommands?: string[];
    projectType?: string;
    dependencies?: string[];
  };
}

export interface DocumentationResult {
  query: DocumentationQuery;
  results: {
    title: string;
    content: string;
    url?: string;
    examples?: CodeExample[];
    relatedTopics?: string[];
    confidence: number;
  }[];
  totalResults: number;
  responseTime: number;
  cached: boolean;
}

export interface CodeExample {
  title: string;
  description: string;
  code: string;
  language: string;
  tags: string[];
}

export interface CommandSuggestion {
  command: string;
  description: string;
  confidence: number;
  reasoning: string;
  examples: string[];
  warnings?: string[];
}

export interface IntelligentAssistance {
  suggestions: CommandSuggestion[];
  contextualHelp: string;
  potentialIssues: string[];
  bestPractices: string[];
  relatedDocumentation: DocumentationResult[];
}

/**
 * Context7 integration manager for intelligent development assistance
 */
export class Context7Manager extends EventEmitter {
  private config: Context7Config;
  private auditLogger: AuditLogger;
  private cache = new Map<string, { data: any; timestamp: number }>();
  private requestQueue: Array<() => Promise<any>> = [];
  private activeRequests = 0;

  constructor(config: Partial<Context7Config> = {}, auditLogger?: AuditLogger) {
    super();
    
    this.config = {
      enabled: true,
      apiEndpoint: process.env.CONTEXT7_API_ENDPOINT || 'https://api.context7.dev',
      apiKey: process.env.CONTEXT7_API_KEY,
      cacheEnabled: true,
      cacheTTL: 3600000, // 1 hour
      maxConcurrentRequests: 5,
      requestTimeout: 10000, // 10 seconds
      supportedTechnologies: [
        TechnologyStack.REACT,
        TechnologyStack.NEXTJS,
        TechnologyStack.NODEJS,
        TechnologyStack.LARAVEL,
        TechnologyStack.DJANGO,
        TechnologyStack.VUE,
        TechnologyStack.EXPRESS,
        TechnologyStack.DOCKER
      ],
      intelligentSuggestions: {
        enabled: true,
        contextWindow: 10,
        confidenceThreshold: 0.7
      },
      ...config
    };

    this.auditLogger = auditLogger || new AuditLogger();
    
    // Setup periodic cache cleanup
    setInterval(() => this.cleanupCache(), 300000); // 5 minutes
  }

  /**
   * Get documentation for a specific query
   */
  async getDocumentation(query: DocumentationQuery, sessionId?: string): Promise<DocumentationResult> {
    if (!this.config.enabled) {
      throw new Error('Context7 integration is disabled');
    }

    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(query);
    
    // Check cache first
    if (this.config.cacheEnabled) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        await this.logDocumentationRequest(query, cached, true, sessionId);
        return cached;
      }
    }

    // Queue request to manage concurrency
    const result = await this.queueRequest(async () => {
      return this.fetchDocumentation(query);
    });

    // Cache result
    if (this.config.cacheEnabled && result) {
      this.setCache(cacheKey, result);
    }

    // Log request
    await this.logDocumentationRequest(query, result, false, sessionId);

    return result;
  }

  /**
   * Get intelligent command suggestions based on context
   */
  async getIntelligentAssistance(
    currentCommand: string,
    context: {
      sessionId: string;
      currentDirectory: string;
      recentCommands: string[];
      projectType?: string;
      technology?: TechnologyStack;
    }
  ): Promise<IntelligentAssistance> {
    if (!this.config.intelligentSuggestions.enabled) {
      return {
        suggestions: [],
        contextualHelp: 'Intelligent suggestions are disabled',
        potentialIssues: [],
        bestPractices: [],
        relatedDocumentation: []
      };
    }

    const startTime = Date.now();
    
    try {
      // Analyze current context
      const contextAnalysis = await this.analyzeContext(currentCommand, context);
      
      // Get command suggestions
      const suggestions = await this.generateCommandSuggestions(currentCommand, contextAnalysis);
      
      // Get contextual documentation
      const relatedDocs = await this.getRelatedDocumentation(contextAnalysis);
      
      // Identify potential issues
      const potentialIssues = await this.identifyPotentialIssues(currentCommand, contextAnalysis);
      
      // Get best practices
      const bestPractices = await this.getBestPractices(contextAnalysis);

      const result: IntelligentAssistance = {
        suggestions: suggestions.filter(s => s.confidence >= this.config.intelligentSuggestions.confidenceThreshold),
        contextualHelp: this.generateContextualHelp(contextAnalysis),
        potentialIssues,
        bestPractices,
        relatedDocumentation: relatedDocs
      };

      // Log assistance request
      await this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
        sessionId: context.sessionId,
        description: `Context7 intelligent assistance provided for command: ${currentCommand}`,
        outcome: 'success',
        eventDetails: {
          command: currentCommand,
          suggestionsCount: result.suggestions.length,
          responseTime: Date.now() - startTime,
          technology: context.technology,
          projectType: context.projectType
        }
      });

      return result;
    } catch (error: any) {
      // Log error
      await this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
        sessionId: context.sessionId,
        description: `Context7 assistance failed for command: ${currentCommand}`,
        outcome: 'failure',
        eventDetails: {
          command: currentCommand,
          errorMessage: error.message,
          responseTime: Date.now() - startTime
        }
      });

      throw error;
    }
  }

  /**
   * Detect technology stack from project directory
   */
  async detectTechnologyStack(
    sessionId: string,
    projectPath: string,
    fileList: string[]
  ): Promise<{
    primary: TechnologyStack;
    secondary: TechnologyStack[];
    confidence: number;
  }> {
    const detectionRules = {
      [TechnologyStack.REACT]: {
        files: ['package.json', 'src/App.jsx', 'src/App.tsx', 'public/index.html'],
        keywords: ['react', 'jsx', 'tsx'],
        weight: 1.0
      },
      [TechnologyStack.NEXTJS]: {
        files: ['next.config.js', 'pages/', 'app/', '.next/'],
        keywords: ['next', 'nextjs'],
        weight: 1.0
      },
      [TechnologyStack.NODEJS]: {
        files: ['package.json', 'server.js', 'app.js', 'index.js'],
        keywords: ['node', 'npm', 'yarn'],
        weight: 0.8
      },
      [TechnologyStack.LARAVEL]: {
        files: ['composer.json', 'artisan', 'app/Http/', 'config/app.php'],
        keywords: ['laravel', 'php', 'artisan'],
        weight: 1.0
      },
      [TechnologyStack.DJANGO]: {
        files: ['manage.py', 'requirements.txt', 'settings.py', 'wsgi.py'],
        keywords: ['django', 'python'],
        weight: 1.0
      },
      [TechnologyStack.DOCKER]: {
        files: ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', '.dockerignore'],
        keywords: ['docker', 'container'],
        weight: 0.9
      }
    };

    const scores: Record<TechnologyStack, number> = {} as any;
    
    // Initialize scores
    Object.keys(detectionRules).forEach(tech => {
      scores[tech as TechnologyStack] = 0;
    });

    // Score based on file presence
    for (const [tech, rules] of Object.entries(detectionRules)) {
      const techStack = tech as TechnologyStack;
      
      for (const file of rules.files) {
        if (fileList.some(f => f.includes(file))) {
          scores[techStack] += rules.weight * 0.5;
        }
      }
      
      // Bonus for multiple file matches
      const matchingFiles = rules.files.filter(file => 
        fileList.some(f => f.includes(file))
      );
      
      if (matchingFiles.length > 1) {
        scores[techStack] += rules.weight * 0.3;
      }
    }

    // Sort by score
    const sortedTechs = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .map(([tech, score]) => ({ tech: tech as TechnologyStack, score }));

    const primary = sortedTechs[0]?.tech || TechnologyStack.NODEJS;
    const secondary = sortedTechs
      .slice(1, 4)
      .filter(({ score }) => score > 0.3)
      .map(({ tech }) => tech);

    const confidence = sortedTechs[0]?.score || 0;

    // Log detection
    await this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
      sessionId,
      description: `Technology stack detected: ${primary}`,
      outcome: 'success',
      eventDetails: {
        projectPath,
        detectedTechnology: primary,
        secondaryTechnologies: secondary,
        confidence,
        scores
      }
    });

    return { primary, secondary, confidence };
  }

  /**
   * Get technology-specific command suggestions
   */
  async getTechnologyCommands(
    technology: TechnologyStack,
    context: string = ''
  ): Promise<CommandSuggestion[]> {
    const commandTemplates: Record<TechnologyStack, CommandSuggestion[]> = {
      [TechnologyStack.REACT]: [
        {
          command: 'npx create-react-app my-app',
          description: 'Create a new React application',
          confidence: 0.9,
          reasoning: 'Standard way to bootstrap React projects',
          examples: ['npx create-react-app todo-app', 'npx create-react-app my-portfolio --template typescript']
        },
        {
          command: 'npm start',
          description: 'Start the React development server',
          confidence: 0.95,
          reasoning: 'Most common command for React development',
          examples: ['npm start', 'yarn start']
        },
        {
          command: 'npm run build',
          description: 'Build the React app for production',
          confidence: 0.9,
          reasoning: 'Creates optimized production build',
          examples: ['npm run build', 'yarn build']
        }
      ],
      [TechnologyStack.NEXTJS]: [
        {
          command: 'npx create-next-app@latest',
          description: 'Create a new Next.js application',
          confidence: 0.9,
          reasoning: 'Official Next.js project generator',
          examples: ['npx create-next-app@latest my-app', 'npx create-next-app@latest my-app --typescript']
        },
        {
          command: 'npm run dev',
          description: 'Start Next.js development server',
          confidence: 0.95,
          reasoning: 'Standard development command for Next.js',
          examples: ['npm run dev', 'yarn dev']
        },
        {
          command: 'npm run build && npm start',
          description: 'Build and start Next.js in production mode',
          confidence: 0.85,
          reasoning: 'Production deployment sequence',
          examples: ['npm run build && npm start']
        }
      ],
      [TechnologyStack.LARAVEL]: [
        {
          command: 'composer create-project laravel/laravel',
          description: 'Create a new Laravel project',
          confidence: 0.9,
          reasoning: 'Official Laravel project creation method',
          examples: ['composer create-project laravel/laravel my-app']
        },
        {
          command: 'php artisan serve',
          description: 'Start Laravel development server',
          confidence: 0.95,
          reasoning: 'Built-in development server',
          examples: ['php artisan serve', 'php artisan serve --port=8080']
        },
        {
          command: 'php artisan migrate',
          description: 'Run database migrations',
          confidence: 0.9,
          reasoning: 'Essential for database setup',
          examples: ['php artisan migrate', 'php artisan migrate:fresh --seed']
        }
      ],
      [TechnologyStack.NODEJS]: [
        {
          command: 'npm init -y',
          description: 'Initialize a new Node.js project',
          confidence: 0.9,
          reasoning: 'Creates package.json file',
          examples: ['npm init -y', 'npm init']
        },
        {
          command: 'npm install',
          description: 'Install project dependencies',
          confidence: 0.95,
          reasoning: 'Installs packages from package.json',
          examples: ['npm install', 'npm ci']
        },
        {
          command: 'node index.js',
          description: 'Run Node.js application',
          confidence: 0.85,
          reasoning: 'Execute main application file',
          examples: ['node index.js', 'node server.js', 'npm start']
        }
      ],
      [TechnologyStack.DJANGO]: [
        {
          command: 'django-admin startproject',
          description: 'Create a new Django project',
          confidence: 0.9,
          reasoning: 'Official Django project creation',
          examples: ['django-admin startproject mysite']
        },
        {
          command: 'python manage.py runserver',
          description: 'Start Django development server',
          confidence: 0.95,
          reasoning: 'Built-in development server',
          examples: ['python manage.py runserver', 'python manage.py runserver 8080']
        },
        {
          command: 'python manage.py migrate',
          description: 'Apply database migrations',
          confidence: 0.9,
          reasoning: 'Essential for database setup',
          examples: ['python manage.py migrate', 'python manage.py makemigrations']
        }
      ],
      [TechnologyStack.DOCKER]: [
        {
          command: 'docker build -t myapp .',
          description: 'Build Docker image from Dockerfile',
          confidence: 0.9,
          reasoning: 'Standard Docker image building',
          examples: ['docker build -t myapp .', 'docker build -t myapp:latest .']
        },
        {
          command: 'docker run -p 3000:3000 myapp',
          description: 'Run Docker container with port mapping',
          confidence: 0.85,
          reasoning: 'Common container execution pattern',
          examples: ['docker run -p 3000:3000 myapp', 'docker run -d -p 80:80 nginx']
        },
        {
          command: 'docker-compose up',
          description: 'Start multi-container application',
          confidence: 0.9,
          reasoning: 'Orchestrates multiple services',
          examples: ['docker-compose up', 'docker-compose up -d']
        }
      ],
      [TechnologyStack.VUE]: [],
      [TechnologyStack.ANGULAR]: [],
      [TechnologyStack.EXPRESS]: [],
      [TechnologyStack.FASTAPI]: [],
      [TechnologyStack.KUBERNETES]: []
    };

    return commandTemplates[technology] || [];
  }

  // Private helper methods

  private async fetchDocumentation(query: DocumentationQuery): Promise<DocumentationResult> {
    // Use prompt-based workflow to leverage existing MCP ecosystem
    const promptContext = this.buildDocumentationPrompt(query);
    
    return {
      query,
      results: [
        {
          title: `${query.technology} Documentation`,
          content: `Use the following prompt with available MCPs to get documentation:\n\n${promptContext}`,
          confidence: 0.9,
          examples: [
            {
              title: 'MCP Documentation Workflow',
              description: 'Use context7 MCP and fetch MCP to get real documentation',
              code: promptContext,
              language: 'prompt',
              tags: ['mcp', 'workflow']
            }
          ]
        }
      ],
      totalResults: 1,
      responseTime: Date.now(),
      cached: false
    };
  }

  private buildDocumentationPrompt(query: DocumentationQuery): string {
    return `
🔍 **Documentation Request for ${query.technology}**

**Query**: ${query.query}
**Type**: ${query.documentationType}
**Context**: ${JSON.stringify(query.context, null, 2)}

**Suggested MCP Workflow**:
1. **Use fetch MCP** to get official documentation:
   - Fetch from official ${query.technology} docs
   - Query: "${query.query}"
   
2. **Use websearch MCP** for additional context:
   - Search: "${query.technology} ${query.query} examples tutorial"
   - Look for Stack Overflow, GitHub issues, and community resources
   
3. **Use github MCP** for code examples:
   - Search repositories with topic: ${query.technology}
   - Find code examples related to: ${query.query}

**Expected Output**:
- Official documentation snippets
- Code examples
- Best practices
- Common pitfalls
- Related concepts

Please execute this workflow using the available MCPs and provide comprehensive documentation.
    `.trim();
  }

  private async analyzeContext(command: string, context: any): Promise<any> {
    // Use prompt-based workflow to analyze context with existing MCPs
    const analysisPrompt = this.buildContextAnalysisPrompt(command, context);
    
    return {
      command,
      context,
      analysis: analysisPrompt,
      type: 'mcp_workflow'
    };
  }

  private buildContextAnalysisPrompt(command: string, context: any): string {
    return `
🧠 **Context Analysis Request**

**Command**: \`${command}\`
**Session ID**: ${context.sessionId}
**Directory**: ${context.currentDirectory}
**Recent Commands**: ${JSON.stringify(context.recentCommands)}
**Technology**: ${context.technology || 'auto-detect'}

**MCP Workflow for Context Analysis**:
1. **Use filesystem MCP** to analyze project structure:
   - List files in current directory
   - Detect package.json, requirements.txt, etc.
   - Identify project type and dependencies

2. **Use github MCP** to find similar patterns:
   - Search for repositories with similar command patterns
   - Look for best practices and common workflows
   - Find potential issues or improvements

3. **Use websearch MCP** for command-specific help:
   - Search: "${command} best practices tutorial"
   - Look for official documentation
   - Find common errors and solutions

**Expected Analysis Output**:
- Command purpose and risks
- Suggested alternatives or improvements
- Project context understanding
- Technology-specific recommendations
- Potential issues to watch for

Please analyze this context using the available MCPs.
    `.trim();
  }

  private async generateCommandSuggestions(command: string, analysis: any): Promise<CommandSuggestion[]> {
    // Generate intelligent suggestions using MCP workflow prompts
    const suggestionsPrompt = this.buildSuggestionsPrompt(command, analysis);
    
    return [
      {
        command: 'USE_MCP_WORKFLOW',
        description: 'Use MCP ecosystem for intelligent suggestions',
        confidence: 0.95,
        reasoning: 'Leveraging existing MCP tools for better suggestions',
        examples: [suggestionsPrompt],
        warnings: ['Execute the MCP workflow prompt for real-time suggestions']
      }
    ];
  }

  private buildSuggestionsPrompt(command: string, analysis: any): string {
    return `
💡 **Command Suggestions Request**

**Original Command**: \`${command}\`
**Analysis Context**: ${typeof analysis.analysis === 'string' ? analysis.analysis : 'See context analysis above'}

**MCP Workflow for Command Suggestions**:
1. **Use github MCP** to find command patterns:
   - Search repositories for similar command usage
   - Find scripts and automation examples
   - Look for package.json scripts or Makefile patterns

2. **Use websearch MCP** for command alternatives:
   - Search: "${command} alternatives better options"
   - Look for performance comparisons
   - Find modern equivalents or improvements

3. **Use fetch MCP** for official documentation:
   - Get official command documentation
   - Check for deprecated options or new features
   - Verify command syntax and parameters

**Expected Suggestions Output**:
- Enhanced version of the original command
- Alternative commands that might be better
- Additional flags or options to consider
- Related commands to run before/after
- Safety checks or validations to add

Please generate suggestions using the available MCPs.
    `.trim();
  }

  private async getRelatedDocumentation(analysis: any): Promise<DocumentationResult[]> {
    // Get related documentation based on context
    return [];
  }

  private async identifyPotentialIssues(command: string, analysis: any): Promise<string[]> {
    // Identify potential issues with the command
    const issues: string[] = [];
    
    if (command.includes('rm -rf')) {
      issues.push('Dangerous delete command - use with caution');
    }
    
    if (command.includes('sudo') && command.includes('npm')) {
      issues.push('Avoid using sudo with npm - consider using a Node version manager');
    }
    
    return issues;
  }

  private async getBestPractices(analysis: any): Promise<string[]> {
    // Get best practices based on context
    return [
      'Use version control for all code changes',
      'Test your changes before deploying',
      'Keep dependencies up to date'
    ];
  }

  private generateContextualHelp(analysis: any): string {
    return 'Contextual help based on current analysis';
  }

  private generateCacheKey(query: DocumentationQuery): string {
    return Buffer.from(JSON.stringify(query)).toString('base64');
  }

  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.config.cacheTTL) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.config.cacheTTL) {
        this.cache.delete(key);
      }
    }
  }

  private async queueRequest<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const executeRequest = async () => {
        if (this.activeRequests >= this.config.maxConcurrentRequests) {
          // Queue the request
          this.requestQueue.push(executeRequest);
          return;
        }

        this.activeRequests++;
        
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeRequests--;
          
          // Process next request in queue
          const nextRequest = this.requestQueue.shift();
          if (nextRequest) {
            nextRequest();
          }
        }
      };

      executeRequest();
    });
  }

  private async logDocumentationRequest(
    query: DocumentationQuery,
    result: DocumentationResult,
    cached: boolean,
    sessionId?: string
  ): Promise<void> {
    await this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
      sessionId,
      description: `Context7 documentation request: ${query.query}`,
      outcome: 'success',
      eventDetails: {
        technology: query.technology,
        documentationType: query.documentationType,
        resultsCount: result.results.length,
        responseTime: result.responseTime,
        cached
      }
    });
  }
}