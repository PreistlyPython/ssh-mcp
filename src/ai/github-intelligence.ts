/**
 * GitHub Intelligence Integration for SSH MCP Server
 * Provides community pattern discovery and best practices mining from GitHub repositories
 */

import { EventEmitter } from 'events';
import { AuditLogger, AuditEventType } from '../audit/audit-logger.js';
import { TechnologyStack } from './context7-integration.js';

export enum GitHubQueryType {
  REPOSITORY_SEARCH = 'repository_search',
  CODE_SEARCH = 'code_search',
  ISSUE_SEARCH = 'issue_search',
  PULL_REQUEST_SEARCH = 'pull_request_search',
  USER_SEARCH = 'user_search',
  TRENDING = 'trending'
}

export enum PatternType {
  ARCHITECTURE_PATTERN = 'architecture_pattern',
  DESIGN_PATTERN = 'design_pattern',
  CONFIGURATION_PATTERN = 'configuration_pattern',
  DEPLOYMENT_PATTERN = 'deployment_pattern',
  TESTING_PATTERN = 'testing_pattern',
  SECURITY_PATTERN = 'security_pattern',
  PERFORMANCE_PATTERN = 'performance_pattern'
}

export enum RepositoryQuality {
  EXCELLENT = 'excellent',    // >10k stars, active maintenance, comprehensive docs
  GOOD = 'good',             // >1k stars, regular updates, good docs
  DECENT = 'decent',         // >100 stars, some activity
  EXPERIMENTAL = 'experimental' // <100 stars or new projects
}

export interface GitHubConfig {
  enabled: boolean;
  apiEndpoint: string;
  apiToken?: string;
  cacheEnabled: boolean;
  cacheTTL: number; // milliseconds
  rateLimitBuffer: number; // requests per hour to reserve
  maxConcurrentRequests: number;
  requestTimeout: number; // milliseconds
  qualityThresholds: {
    minStars: number;
    maxAge: number; // days since last update
    minCommits: number;
  };
}

export interface GitHubRepository {
  id: number;
  name: string;
  fullName: string;
  description: string;
  url: string;
  htmlUrl: string;
  language: string;
  stargazersCount: number;
  forksCount: number;
  openIssuesCount: number;
  size: number; // KB
  defaultBranch: string;
  createdAt: Date;
  updatedAt: Date;
  pushedAt: Date;
  topics: string[];
  license: {
    name: string;
    url?: string;
  } | null;
  owner: {
    login: string;
    type: 'User' | 'Organization';
    url: string;
  };
  quality: RepositoryQuality;
  relevanceScore: number;
}

export interface CodeSnippet {
  repository: GitHubRepository;
  filename: string;
  path: string;
  content: string;
  language: string;
  url: string;
  startLine: number;
  endLine: number;
  score: number; // GitHub search relevance score
  patternType?: PatternType;
  complexity: 'low' | 'medium' | 'high';
  quality: 'poor' | 'good' | 'excellent';
}

export interface BestPracticePattern {
  id: string;
  title: string;
  description: string;
  patternType: PatternType;
  technology: TechnologyStack;
  codeExamples: CodeSnippet[];
  repositories: GitHubRepository[];
  tags: string[];
  popularity: number; // based on stars, usage across repos
  quality: RepositoryQuality;
  implementation: {
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    timeToImplement: string;
    prerequisites: string[];
    benefits: string[];
    considerations: string[];
  };
  relatedPatterns: string[];
  lastUpdated: Date;
}

export interface CommunityInsight {
  technology: TechnologyStack;
  totalRepositories: number;
  trendingRepositories: GitHubRepository[];
  popularPatterns: BestPracticePattern[];
  emergingTrends: {
    pattern: string;
    growthRate: number; // percentage
    repositories: number;
    description: string;
  }[];
  communityStats: {
    activeContributors: number;
    weeklyCommits: number;
    issuesResolved: number;
    averageStars: number;
  };
  recommendations: {
    type: 'library' | 'pattern' | 'tool';
    name: string;
    description: string;
    reasoning: string;
    url: string;
  }[];
}

export interface GitHubSearchQuery {
  query: string;
  type: GitHubQueryType;
  technology?: TechnologyStack;
  language?: string;
  patternType?: PatternType;
  sort?: 'stars' | 'updated' | 'created' | 'best-match';
  order?: 'asc' | 'desc';
  limit?: number;
  qualityFilter?: boolean;
}

export interface GitHubSearchResult {
  query: GitHubSearchQuery;
  totalCount: number;
  repositories?: GitHubRepository[];
  codeSnippets?: CodeSnippet[];
  patterns?: BestPracticePattern[];
  responseTime: number;
  cached: boolean;
  rateLimit: {
    remaining: number;
    resetAt: Date;
  };
}

/**
 * GitHub Intelligence manager for community pattern discovery
 */
export class GitHubIntelligenceManager extends EventEmitter {
  private config: GitHubConfig;
  private auditLogger: AuditLogger;
  private cache = new Map<string, { data: any; timestamp: number }>();
  private requestQueue: Array<() => Promise<any>> = [];
  private activeRequests = 0;
  private rateLimit = { remaining: 5000, resetAt: new Date() };

  constructor(config: Partial<GitHubConfig> = {}, auditLogger?: AuditLogger) {
    super();
    
    this.config = {
      enabled: true,
      apiEndpoint: 'https://api.github.com',
      apiToken: process.env.GITHUB_TOKEN,
      cacheEnabled: true,
      cacheTTL: 3600000, // 1 hour
      rateLimitBuffer: 500, // Reserve 500 requests per hour
      maxConcurrentRequests: 3,
      requestTimeout: 15000, // 15 seconds
      qualityThresholds: {
        minStars: 10,
        maxAge: 365, // 1 year
        minCommits: 5
      },
      ...config
    };

    this.auditLogger = auditLogger || new AuditLogger();
    
    // Setup periodic cache cleanup
    setInterval(() => this.cleanupCache(), 300000); // 5 minutes
  }

  /**
   * Search for repositories with intelligent filtering
   */
  async searchRepositories(
    query: string,
    technology?: TechnologyStack,
    options: {
      qualityFilter?: boolean;
      limit?: number;
      sort?: 'stars' | 'updated' | 'created';
    } = {}
  ): Promise<GitHubSearchResult> {
    const searchQuery: GitHubSearchQuery = {
      query,
      type: GitHubQueryType.REPOSITORY_SEARCH,
      technology,
      language: this.technologyToLanguage(technology),
      sort: options.sort || 'stars',
      order: 'desc',
      limit: options.limit || 30,
      qualityFilter: options.qualityFilter !== false
    };

    return this.executeSearch(searchQuery);
  }

  /**
   * Find code patterns and examples
   */
  async searchCodePatterns(
    pattern: string,
    technology: TechnologyStack,
    patternType?: PatternType,
    options: {
      limit?: number;
      qualityFilter?: boolean;
    } = {}
  ): Promise<GitHubSearchResult> {
    const enhancedQuery = this.enhanceCodeQuery(pattern, technology, patternType);
    
    const searchQuery: GitHubSearchQuery = {
      query: enhancedQuery,
      type: GitHubQueryType.CODE_SEARCH,
      technology,
      language: this.technologyToLanguage(technology),
      limit: options.limit || 20,
      qualityFilter: options.qualityFilter !== false
    };

    return this.executeSearch(searchQuery);
  }

  /**
   * Discover best practices for a technology stack
   */
  async discoverBestPractices(
    technology: TechnologyStack,
    domain?: string
  ): Promise<BestPracticePattern[]> {
    const startTime = Date.now();
    
    try {
      // Search for high-quality repositories
      const repoResults = await this.searchRepositories(
        this.buildBestPracticesQuery(technology, domain),
        technology,
        { qualityFilter: true, limit: 50 }
      );

      // Search for common patterns
      const patternQueries = this.getPatternQueries(technology, domain);
      const patternResults = await Promise.all(
        patternQueries.map(query => this.searchCodePatterns(query.pattern, technology, query.type))
      );

      // Analyze and extract patterns
      const patterns = await this.extractBestPracticePatterns(
        repoResults.repositories || [],
        patternResults.flatMap(r => r.codeSnippets || []),
        technology
      );

      // Log discovery
      await this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
        description: `GitHub best practices discovery for ${technology}`,
        outcome: 'success',
        eventDetails: {
          technology,
          domain,
          patternsFound: patterns.length,
          repositoriesAnalyzed: repoResults.repositories?.length || 0,
          responseTime: Date.now() - startTime
        }
      });

      return patterns;
    } catch (error: any) {
      await this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
        description: `GitHub best practices discovery failed for ${technology}`,
        outcome: 'failure',
        eventDetails: {
          technology,
          domain,
          errorMessage: error.message,
          responseTime: Date.now() - startTime
        }
      });
      throw error;
    }
  }

  /**
   * Get community insights for a technology
   */
  async getCommunityInsights(technology: TechnologyStack): Promise<CommunityInsight> {
    const startTime = Date.now();
    const cacheKey = `insights_${technology}`;
    
    // Check cache
    if (this.config.cacheEnabled) {
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;
    }

    try {
      // Get trending repositories
      const trendingResults = await this.searchRepositories(
        `language:${this.technologyToLanguage(technology)}`,
        technology,
        { sort: 'updated', limit: 20 }
      );

      // Get popular patterns
      const bestPractices = await this.discoverBestPractices(technology);

      // Analyze community statistics
      const communityStats = await this.analyzeCommunityStats(
        trendingResults.repositories || []
      );

      // Detect emerging trends
      const emergingTrends = await this.detectEmergingTrends(technology);

      // Generate recommendations
      const recommendations = await this.generateRecommendations(
        trendingResults.repositories || [],
        bestPractices
      );

      const insights: CommunityInsight = {
        technology,
        totalRepositories: trendingResults.totalCount,
        trendingRepositories: trendingResults.repositories || [],
        popularPatterns: bestPractices.slice(0, 10),
        emergingTrends,
        communityStats,
        recommendations
      };

      // Cache result
      if (this.config.cacheEnabled) {
        this.setCache(cacheKey, insights);
      }

      // Log insights generation
      await this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
        description: `GitHub community insights generated for ${technology}`,
        outcome: 'success',
        eventDetails: {
          technology,
          trendingRepos: insights.trendingRepositories.length,
          patterns: insights.popularPatterns.length,
          responseTime: Date.now() - startTime
        }
      });

      return insights;
    } catch (error: any) {
      await this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
        description: `GitHub community insights failed for ${technology}`,
        outcome: 'failure',
        eventDetails: {
          technology,
          errorMessage: error.message,
          responseTime: Date.now() - startTime
        }
      });
      throw error;
    }
  }

  /**
   * Find similar repositories based on patterns
   */
  async findSimilarRepositories(
    referenceRepo: GitHubRepository,
    limit: number = 10
  ): Promise<GitHubRepository[]> {
    const query = this.buildSimilarityQuery(referenceRepo);
    const results = await this.searchRepositories(query, undefined, { limit });
    
    return (results.repositories || [])
      .filter(repo => repo.id !== referenceRepo.id)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Get repository quality assessment
   */
  async assessRepositoryQuality(owner: string, repo: string): Promise<{
    quality: RepositoryQuality;
    score: number;
    factors: {
      stars: number;
      maintenance: number;
      documentation: number;
      community: number;
      security: number;
    };
    recommendations: string[];
  }> {
    // This would fetch detailed repository data and analyze quality factors
    // For now, return mock assessment
    return {
      quality: RepositoryQuality.GOOD,
      score: 7.5,
      factors: {
        stars: 8,
        maintenance: 7,
        documentation: 6,
        community: 8,
        security: 7
      },
      recommendations: [
        'Consider adding more comprehensive documentation',
        'Setup automated security scanning',
        'Add contribution guidelines'
      ]
    };
  }

  // Private helper methods

  private async executeSearch(query: GitHubSearchQuery): Promise<GitHubSearchResult> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(query);
    
    // Check cache
    if (this.config.cacheEnabled) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return {
          ...cached,
          responseTime: Date.now() - startTime,
          cached: true
        };
      }
    }

    // Queue request to manage rate limits
    const result = await this.queueRequest(async () => {
      return this.performGitHubSearch(query);
    });

    // Cache result
    if (this.config.cacheEnabled && result) {
      this.setCache(cacheKey, result);
    }

    return {
      ...result,
      responseTime: Date.now() - startTime,
      cached: false
    };
  }

  private async performGitHubSearch(query: GitHubSearchQuery): Promise<GitHubSearchResult> {
    // Use prompt-based workflow to leverage existing github MCP
    const searchPrompt = this.buildGitHubSearchPrompt(query);
    
    return {
      query,
      totalCount: 1,
      repositories: query.type === GitHubQueryType.REPOSITORY_SEARCH ? [
        {
          id: 1,
          name: 'MCP_WORKFLOW_RESULT',
          fullName: 'mcp/workflow-result',
          description: searchPrompt,
          url: 'prompt://github-mcp-workflow',
          htmlUrl: 'prompt://github-mcp-workflow',
          language: this.technologyToLanguage(query.technology),
          stargazersCount: 0,
          forksCount: 0,
          openIssuesCount: 0,
          size: 0,
          defaultBranch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
          pushedAt: new Date(),
          topics: ['mcp', 'workflow', 'prompt'],
          license: { name: 'MIT' },
          owner: {
            login: 'mcp-workflow',
            type: 'Organization',
            url: 'https://github.com/mcp-workflow'
          },
          quality: RepositoryQuality.EXCELLENT,
          relevanceScore: 0.95
        }
      ] : undefined,
      codeSnippets: query.type === GitHubQueryType.CODE_SEARCH ? [
        {
          repository: {
            id: 1,
            name: 'MCP_WORKFLOW_RESULT',
            fullName: 'mcp/workflow-result',
            description: 'MCP GitHub Search Workflow',
            url: 'prompt://github-mcp-workflow',
            htmlUrl: 'prompt://github-mcp-workflow',
            language: 'prompt',
            stargazersCount: 0,
            forksCount: 0,
            openIssuesCount: 0,
            size: 0,
            defaultBranch: 'main',
            createdAt: new Date(),
            updatedAt: new Date(),
            pushedAt: new Date(),
            topics: ['mcp'],
            license: { name: 'MIT' },
            owner: { login: 'mcp', type: 'Organization', url: 'https://github.com/mcp' },
            quality: RepositoryQuality.EXCELLENT,
            relevanceScore: 0.95
          },
          filename: 'github-workflow.prompt',
          path: 'workflows/github-search.prompt',
          content: searchPrompt,
          language: 'prompt',
          url: 'prompt://github-mcp-workflow',
          startLine: 1,
          endLine: searchPrompt.split('\n').length,
          score: 0.95,
          patternType: query.patternType,
          complexity: 'low',
          quality: 'excellent'
        }
      ] : undefined,
      responseTime: 0,
      cached: false,
      rateLimit: this.rateLimit
    };
  }

  private buildGitHubSearchPrompt(query: GitHubSearchQuery): string {
    return `
🐙 **GitHub Intelligence Search Request**

**Search Query**: "${query.query}"
**Type**: ${query.type}
**Technology**: ${query.technology || 'any'}
**Language**: ${query.language || 'any'}
**Pattern Type**: ${query.patternType || 'any'}
**Sort**: ${query.sort || 'stars'}
**Limit**: ${query.limit || 30}

**MCP Workflow for GitHub Intelligence**:
1. **Use github MCP** for repository search:
   - Search: "topic:${query.technology} ${query.query}"
   - Filter by: stars:>100, language:${query.language}
   - Sort by: ${query.sort}
   - Get top ${query.limit} results

2. **Use github MCP** for code search:
   - Search in code: "${query.query} language:${query.language}"
   - Filter by: repository patterns, file types
   - Look for: ${query.patternType} patterns
   - Analyze code quality and complexity

3. **Use websearch MCP** for community insights:
   - Search: "${query.technology} ${query.query} GitHub awesome"
   - Find curated lists and community resources
   - Look for trending repositories and discussions

**Expected Output**:
- Repository recommendations with quality scores
- Code examples and patterns
- Best practices and implementation guides
- Community insights and trends
- Quality assessments and recommendations

**Quality Filters**:
- Stars: ${query.qualityFilter ? '>100' : 'any'}
- Last update: ${query.qualityFilter ? 'within 1 year' : 'any'}
- License: Prefer open source
- Documentation: Well documented repositories

Please execute this GitHub intelligence workflow using the github MCP.
    `.trim();
  }

  private async extractBestPracticePatterns(
    repositories: GitHubRepository[],
    codeSnippets: CodeSnippet[],
    technology: TechnologyStack
  ): Promise<BestPracticePattern[]> {
    // Use prompt-based workflow to extract patterns from MCP results
    const extractionPrompt = this.buildPatternExtractionPrompt(repositories, codeSnippets, technology);
    
    // Return a single meta-pattern that contains the extraction workflow
    const metaPattern: BestPracticePattern = {
      id: `${technology}_mcp_workflow_${Date.now()}`,
      title: `${technology} Best Practices Discovery (MCP Workflow)`,
      description: extractionPrompt,
      patternType: PatternType.ARCHITECTURE_PATTERN,
      technology,
      codeExamples: [
        {
          repository: repositories[0] || {
            id: 1, name: 'mcp-workflow', fullName: 'mcp/workflow',
            description: 'MCP Workflow Result', url: '', htmlUrl: '',
            language: 'prompt', stargazersCount: 0, forksCount: 0,
            openIssuesCount: 0, size: 0, defaultBranch: 'main',
            createdAt: new Date(), updatedAt: new Date(), pushedAt: new Date(),
            topics: ['mcp'], license: { name: 'MIT' },
            owner: { login: 'mcp', type: 'Organization', url: '' },
            quality: RepositoryQuality.EXCELLENT, relevanceScore: 0.95
          },
          filename: 'pattern-extraction.prompt',
          path: 'workflows/pattern-extraction.prompt',
          content: extractionPrompt,
          language: 'prompt',
          url: 'prompt://pattern-extraction',
          startLine: 1,
          endLine: extractionPrompt.split('\n').length,
          score: 0.95,
          patternType: PatternType.ARCHITECTURE_PATTERN,
          complexity: 'medium',
          quality: 'excellent'
        }
      ],
      repositories: repositories.slice(0, 5),
      tags: this.generatePatternTags(PatternType.ARCHITECTURE_PATTERN, technology),
      popularity: 95,
      quality: RepositoryQuality.EXCELLENT,
      implementation: {
        difficulty: 'intermediate',
        timeToImplement: '1-2 hours',
        prerequisites: ['MCP ecosystem access', 'GitHub MCP', 'Analysis skills'],
        benefits: ['Real-time pattern discovery', 'Community-validated patterns', 'Up-to-date examples'],
        considerations: ['Requires MCP execution', 'Results vary by query quality']
      },
      relatedPatterns: ['design_pattern', 'configuration_pattern'],
      lastUpdated: new Date()
    };

    return [metaPattern];
  }

  private buildPatternExtractionPrompt(
    repositories: GitHubRepository[],
    codeSnippets: CodeSnippet[],
    technology: TechnologyStack
  ): string {
    return `
🔍 **Best Practice Pattern Extraction Workflow**

**Technology**: ${technology}
**Repositories Found**: ${repositories.length}
**Code Snippets**: ${codeSnippets.length}

**MCP Workflow for Pattern Discovery**:
1. **Use github MCP** to analyze top repositories:
   ${repositories.slice(0, 3).map(repo => `   - Analyze: ${repo.fullName} (${repo.stargazersCount} stars)`).join('\n')}
   - Look for: Architecture patterns, configuration files, best practices
   - Extract: Code patterns, project structure, dependencies

2. **Use github MCP** for code pattern analysis:
   - Search across repositories for common patterns
   - Identify: Design patterns, architectural decisions, conventions
   - Analyze: Code quality, testing patterns, documentation

3. **Use websearch MCP** for community validation:
   - Search: "${technology} best practices 2024"
   - Find: Industry standards, expert recommendations
   - Validate: Patterns against community consensus

4. **Use fetch MCP** for official documentation:
   - Get: Official ${technology} documentation
   - Find: Recommended patterns and practices
   - Compare: Community vs official recommendations

**Expected Pattern Categories**:
- **Architecture Patterns**: Project structure, module organization
- **Design Patterns**: Common code patterns and idioms
- **Configuration Patterns**: Setup and deployment configurations
- **Testing Patterns**: Testing strategies and frameworks
- **Security Patterns**: Authentication, authorization, data protection
- **Performance Patterns**: Optimization techniques and caching

**Analysis Framework**:
- **Popularity**: Based on GitHub stars, forks, usage
- **Quality**: Code quality, documentation, maintenance
- **Recency**: Last updated, active development
- **Community**: Issues, discussions, contributors

Please execute this pattern extraction workflow using the available MCPs.
    `.trim();
  }

  private async analyzeCommunityStats(repositories: GitHubRepository[]): Promise<CommunityInsight['communityStats']> {
    // Analyze repository statistics to understand community health
    const totalStars = repositories.reduce((sum, repo) => sum + repo.stargazersCount, 0);
    const averageStars = totalStars / repositories.length;

    return {
      activeContributors: repositories.length * 10, // Mock calculation
      weeklyCommits: repositories.length * 50, // Mock calculation
      issuesResolved: repositories.reduce((sum, repo) => sum + repo.openIssuesCount, 0),
      averageStars
    };
  }

  private async detectEmergingTrends(technology: TechnologyStack): Promise<CommunityInsight['emergingTrends']> {
    // Mock trend detection - in real implementation would analyze GitHub data over time
    const trendMapping: Record<TechnologyStack, string[]> = {
      [TechnologyStack.REACT]: ['Server Components', 'Concurrent Features', 'Suspense Patterns'],
      [TechnologyStack.NEXTJS]: ['App Router', 'Server Actions', 'Streaming'],
      [TechnologyStack.NODEJS]: ['ESM Migration', 'Worker Threads', 'Async Hooks'],
      [TechnologyStack.LARAVEL]: ['Livewire', 'Octane', 'Vapor'],
      [TechnologyStack.DJANGO]: ['Async Views', 'Channels', 'GraphQL Integration'],
      [TechnologyStack.DOCKER]: ['Multi-stage Builds', 'BuildKit', 'Distroless Images'],
      [TechnologyStack.VUE]: ['Composition API', 'Script Setup', 'Pinia'],
      [TechnologyStack.ANGULAR]: ['Standalone Components', 'Signals', 'Control Flow'],
      [TechnologyStack.EXPRESS]: ['Fastify Migration', 'TypeScript', 'GraphQL'],
      [TechnologyStack.FASTAPI]: ['Async Generators', 'Dependency Injection', 'Background Tasks'],
      [TechnologyStack.KUBERNETES]: ['GitOps', 'Service Mesh', 'Serverless']
    };

    const trends = trendMapping[technology] || ['Modern Patterns', 'Performance Optimization'];

    return trends.map((trend, index) => ({
      pattern: trend,
      growthRate: 150 - (index * 20), // Mock growth rates
      repositories: 1000 - (index * 100), // Mock repository counts
      description: `Emerging trend in ${technology}: ${trend}`
    }));
  }

  private async generateRecommendations(
    repositories: GitHubRepository[],
    patterns: BestPracticePattern[]
  ): Promise<CommunityInsight['recommendations']> {
    const recommendations: CommunityInsight['recommendations'] = [];

    // Recommend popular libraries
    const topLibraries = repositories
      .filter(repo => repo.topics.includes('library'))
      .slice(0, 3);

    topLibraries.forEach(repo => {
      recommendations.push({
        type: 'library',
        name: repo.name,
        description: repo.description,
        reasoning: `Popular library with ${repo.stargazersCount} stars`,
        url: repo.htmlUrl
      });
    });

    // Recommend patterns
    patterns.slice(0, 2).forEach(pattern => {
      recommendations.push({
        type: 'pattern',
        name: pattern.title,
        description: pattern.description,
        reasoning: `Widely adopted pattern with high community usage`,
        url: pattern.codeExamples[0]?.url || ''
      });
    });

    return recommendations;
  }

  // Utility methods

  private technologyToLanguage(technology?: TechnologyStack): string {
    const mapping: Record<TechnologyStack, string> = {
      [TechnologyStack.REACT]: 'javascript',
      [TechnologyStack.NEXTJS]: 'javascript',
      [TechnologyStack.NODEJS]: 'javascript',
      [TechnologyStack.LARAVEL]: 'php',
      [TechnologyStack.DJANGO]: 'python',
      [TechnologyStack.VUE]: 'javascript',
      [TechnologyStack.ANGULAR]: 'typescript',
      [TechnologyStack.EXPRESS]: 'javascript',
      [TechnologyStack.FASTAPI]: 'python',
      [TechnologyStack.DOCKER]: 'dockerfile',
      [TechnologyStack.KUBERNETES]: 'yaml'
    };

    return technology ? mapping[technology] || 'javascript' : 'javascript';
  }

  private enhanceCodeQuery(pattern: string, technology: TechnologyStack, patternType?: PatternType): string {
    const language = this.technologyToLanguage(technology);
    let query = `${pattern} language:${language}`;

    if (patternType) {
      const patternKeywords = {
        [PatternType.ARCHITECTURE_PATTERN]: 'architecture structure',
        [PatternType.DESIGN_PATTERN]: 'pattern design',
        [PatternType.CONFIGURATION_PATTERN]: 'config configuration',
        [PatternType.DEPLOYMENT_PATTERN]: 'deploy deployment',
        [PatternType.TESTING_PATTERN]: 'test testing',
        [PatternType.SECURITY_PATTERN]: 'security auth',
        [PatternType.PERFORMANCE_PATTERN]: 'performance optimization'
      };

      query += ` ${patternKeywords[patternType]}`;
    }

    return query;
  }

  private buildBestPracticesQuery(technology: TechnologyStack, domain?: string): string {
    const techQueries: Record<TechnologyStack, string> = {
      [TechnologyStack.REACT]: 'react best practices patterns',
      [TechnologyStack.NEXTJS]: 'nextjs best practices patterns',
      [TechnologyStack.NODEJS]: 'nodejs best practices patterns',
      [TechnologyStack.LARAVEL]: 'laravel best practices patterns',
      [TechnologyStack.DJANGO]: 'django best practices patterns',
      [TechnologyStack.VUE]: 'vue best practices patterns',
      [TechnologyStack.ANGULAR]: 'angular best practices patterns',
      [TechnologyStack.EXPRESS]: 'express best practices patterns',
      [TechnologyStack.FASTAPI]: 'fastapi best practices patterns',
      [TechnologyStack.DOCKER]: 'docker best practices patterns',
      [TechnologyStack.KUBERNETES]: 'kubernetes best practices patterns'
    };

    let query = techQueries[technology] || `${technology} best practices`;
    if (domain) {
      query += ` ${domain}`;
    }

    return query;
  }

  private getPatternQueries(technology: TechnologyStack, domain?: string): Array<{pattern: string; type: PatternType}> {
    const base = this.technologyToLanguage(technology);
    const queries: Array<{pattern: string; type: PatternType}> = [
      { pattern: `${base} architecture pattern`, type: PatternType.ARCHITECTURE_PATTERN },
      { pattern: `${base} design pattern`, type: PatternType.DESIGN_PATTERN },
      { pattern: `${base} configuration`, type: PatternType.CONFIGURATION_PATTERN },
      { pattern: `${base} deployment`, type: PatternType.DEPLOYMENT_PATTERN },
      { pattern: `${base} testing pattern`, type: PatternType.TESTING_PATTERN }
    ];

    if (domain) {
      queries.forEach(q => q.pattern += ` ${domain}`);
    }

    return queries;
  }

  private buildSimilarityQuery(repo: GitHubRepository): string {
    const topics = repo.topics.slice(0, 3).join(' ');
    const language = repo.language;
    return `${topics} language:${language} stars:>${Math.max(10, repo.stargazersCount / 10)}`;
  }

  private generatePatternTitle(patternType: PatternType, technology: TechnologyStack): string {
    const titles = {
      [PatternType.ARCHITECTURE_PATTERN]: `${technology} Architecture Patterns`,
      [PatternType.DESIGN_PATTERN]: `${technology} Design Patterns`,
      [PatternType.CONFIGURATION_PATTERN]: `${technology} Configuration Patterns`,
      [PatternType.DEPLOYMENT_PATTERN]: `${technology} Deployment Patterns`,
      [PatternType.TESTING_PATTERN]: `${technology} Testing Patterns`,
      [PatternType.SECURITY_PATTERN]: `${technology} Security Patterns`,
      [PatternType.PERFORMANCE_PATTERN]: `${technology} Performance Patterns`
    };

    return titles[patternType];
  }

  private generatePatternDescription(patternType: PatternType, technology: TechnologyStack): string {
    return `Community-discovered ${patternType.replace('_', ' ')} for ${technology} applications`;
  }

  private generatePatternTags(patternType: PatternType, technology: TechnologyStack): string[] {
    return [technology, patternType.replace('_', '-'), 'best-practices', 'community'];
  }

  private calculatePatternPopularity(snippets: CodeSnippet[], repositories: GitHubRepository[]): number {
    const avgStars = repositories.reduce((sum, repo) => sum + repo.stargazersCount, 0) / repositories.length;
    const avgScore = snippets.reduce((sum, snippet) => sum + snippet.score, 0) / snippets.length;
    return (avgStars / 1000) + (avgScore * 10); // Normalize to 0-10 scale
  }

  private assessPatternQuality(snippets: CodeSnippet[], repositories: GitHubRepository[]): RepositoryQuality {
    const avgStars = repositories.reduce((sum, repo) => sum + repo.stargazersCount, 0) / repositories.length;
    
    if (avgStars > 10000) return RepositoryQuality.EXCELLENT;
    if (avgStars > 1000) return RepositoryQuality.GOOD;
    if (avgStars > 100) return RepositoryQuality.DECENT;
    return RepositoryQuality.EXPERIMENTAL;
  }

  private assessImplementationDifficulty(patternType: PatternType): 'beginner' | 'intermediate' | 'advanced' {
    const difficultyMap = {
      [PatternType.CONFIGURATION_PATTERN]: 'beginner' as const,
      [PatternType.DESIGN_PATTERN]: 'intermediate' as const,
      [PatternType.TESTING_PATTERN]: 'intermediate' as const,
      [PatternType.ARCHITECTURE_PATTERN]: 'advanced' as const,
      [PatternType.DEPLOYMENT_PATTERN]: 'advanced' as const,
      [PatternType.SECURITY_PATTERN]: 'advanced' as const,
      [PatternType.PERFORMANCE_PATTERN]: 'advanced' as const
    };

    return difficultyMap[patternType] || 'intermediate';
  }

  private estimateImplementationTime(patternType: PatternType): string {
    const timeMap = {
      [PatternType.CONFIGURATION_PATTERN]: '1-2 hours',
      [PatternType.DESIGN_PATTERN]: '2-4 hours',
      [PatternType.TESTING_PATTERN]: '4-8 hours',
      [PatternType.ARCHITECTURE_PATTERN]: '1-2 days',
      [PatternType.DEPLOYMENT_PATTERN]: '1-3 days',
      [PatternType.SECURITY_PATTERN]: '2-5 days',
      [PatternType.PERFORMANCE_PATTERN]: '3-7 days'
    };

    return timeMap[patternType] || '1-2 days';
  }

  private getPatternPrerequisites(patternType: PatternType, technology: TechnologyStack): string[] {
    const basePrereqs = [`Basic ${technology} knowledge`];
    
    const additionalPrereqs = {
      [PatternType.ARCHITECTURE_PATTERN]: ['System design understanding', 'Software architecture principles'],
      [PatternType.SECURITY_PATTERN]: ['Security fundamentals', 'Authentication/authorization concepts'],
      [PatternType.PERFORMANCE_PATTERN]: ['Performance monitoring', 'Optimization techniques'],
      [PatternType.DEPLOYMENT_PATTERN]: ['DevOps basics', 'CI/CD understanding'],
      [PatternType.TESTING_PATTERN]: ['Testing frameworks', 'Test-driven development'],
      [PatternType.DESIGN_PATTERN]: ['Object-oriented programming', 'Design principles'],
      [PatternType.CONFIGURATION_PATTERN]: ['Environment management', 'Configuration best practices']
    };

    return [...basePrereqs, ...(additionalPrereqs[patternType] || [])];
  }

  private getPatternBenefits(patternType: PatternType): string[] {
    const benefitsMap = {
      [PatternType.ARCHITECTURE_PATTERN]: ['Improved scalability', 'Better maintainability', 'Clear separation of concerns'],
      [PatternType.DESIGN_PATTERN]: ['Code reusability', 'Improved readability', 'Standardized solutions'],
      [PatternType.CONFIGURATION_PATTERN]: ['Environment consistency', 'Easy deployment', 'Secure configuration'],
      [PatternType.DEPLOYMENT_PATTERN]: ['Reliable deployments', 'Reduced downtime', 'Automated processes'],
      [PatternType.TESTING_PATTERN]: ['Higher code quality', 'Faster bug detection', 'Confident refactoring'],
      [PatternType.SECURITY_PATTERN]: ['Enhanced security', 'Compliance adherence', 'Risk mitigation'],
      [PatternType.PERFORMANCE_PATTERN]: ['Better performance', 'Resource optimization', 'Improved user experience']
    };

    return benefitsMap[patternType] || ['Improved code quality'];
  }

  private getPatternConsiderations(patternType: PatternType): string[] {
    const considerationsMap = {
      [PatternType.ARCHITECTURE_PATTERN]: ['Increased complexity', 'Learning curve', 'Over-engineering risk'],
      [PatternType.DESIGN_PATTERN]: ['Potential over-abstraction', 'Added complexity', 'Performance overhead'],
      [PatternType.CONFIGURATION_PATTERN]: ['Security implications', 'Environment differences', 'Validation needs'],
      [PatternType.DEPLOYMENT_PATTERN]: ['Infrastructure requirements', 'Rollback strategies', 'Monitoring needs'],
      [PatternType.TESTING_PATTERN]: ['Test maintenance', 'Execution time', 'Coverage balance'],
      [PatternType.SECURITY_PATTERN]: ['Performance impact', 'User experience', 'Maintenance overhead'],
      [PatternType.PERFORMANCE_PATTERN]: ['Code complexity', 'Premature optimization', 'Monitoring requirements']
    };

    return considerationsMap[patternType] || ['Implementation complexity'];
  }

  private findRelatedPatterns(patternType: PatternType): string[] {
    const relatedMap = {
      [PatternType.ARCHITECTURE_PATTERN]: ['design_pattern', 'performance_pattern'],
      [PatternType.DESIGN_PATTERN]: ['architecture_pattern', 'testing_pattern'],
      [PatternType.CONFIGURATION_PATTERN]: ['deployment_pattern', 'security_pattern'],
      [PatternType.DEPLOYMENT_PATTERN]: ['configuration_pattern', 'security_pattern'],
      [PatternType.TESTING_PATTERN]: ['design_pattern', 'performance_pattern'],
      [PatternType.SECURITY_PATTERN]: ['configuration_pattern', 'deployment_pattern'],
      [PatternType.PERFORMANCE_PATTERN]: ['architecture_pattern', 'design_pattern']
    };

    return relatedMap[patternType] || [];
  }

  private generateCacheKey(query: GitHubSearchQuery): string {
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
          
          const nextRequest = this.requestQueue.shift();
          if (nextRequest) {
            nextRequest();
          }
        }
      };

      executeRequest();
    });
  }
}