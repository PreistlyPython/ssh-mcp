/**
 * Go Development Workflows for SSH MCP Server
 * Provides intelligent Go development workflows with MCP orchestration
 */

export enum GoWorkflowType {
  // Project Management
  MODULE_INIT = 'module_init',
  DEPENDENCY_MANAGEMENT = 'dependency_management',
  VENDOR_MANAGEMENT = 'vendor_management',
  
  // Development
  CODE_GENERATION = 'code_generation',
  INTERFACE_IMPLEMENTATION = 'interface_implementation',
  TEST_GENERATION = 'test_generation',
  BENCHMARK_CREATION = 'benchmark_creation',
  
  // Building & Testing
  BUILD_OPTIMIZATION = 'build_optimization',
  TEST_COVERAGE = 'test_coverage',
  RACE_DETECTION = 'race_detection',
  MEMORY_PROFILING = 'memory_profiling',
  
  // Production
  CROSS_COMPILATION = 'cross_compilation',
  DOCKER_MULTISTAGE = 'docker_multistage',
  BINARY_OPTIMIZATION = 'binary_optimization',
  DEPLOYMENT_PREPARATION = 'deployment_preparation',
  
  // Code Quality
  LINTING_SETUP = 'linting_setup',
  STATIC_ANALYSIS = 'static_analysis',
  SECURITY_SCANNING = 'security_scanning',
  DOCUMENTATION = 'documentation'
}

export interface GoWorkflowRequest {
  sessionId: string;
  workflowType: GoWorkflowType;
  projectPath: string;
  specifications?: {
    moduleName?: string;
    goVersion?: string;
    targetPlatforms?: string[];
    dependencies?: string[];
    testStrategy?: 'unit' | 'integration' | 'e2e' | 'all';
    buildTags?: string[];
    optimizationLevel?: 'size' | 'speed' | 'balanced';
  };
}

export const GoWorkflowPrompts = {
  moduleInit: (moduleName: string, goVersion: string) => `
Initialize a new Go module with production-ready structure.

Using available MCPs:
1. Use Context7 MCP to get latest Go module best practices
2. Use GitHub MCP to find popular Go project structures and layouts
3. Search for Go project templates that follow standard layout

Create:
- go.mod with specified Go version (${goVersion})
- Standard project layout (cmd/, pkg/, internal/, etc.)
- Makefile with common tasks
- .gitignore for Go projects
- CI/CD configuration templates
- Docker and docker-compose files
- Pre-commit hooks configuration

Module name: ${moduleName}
`,

  dependencyManagement: (dependencies: string[]) => `
Manage Go module dependencies with security and performance considerations.

Dependencies to analyze: ${dependencies.join(', ')}

Using MCPs:
1. Use Context7 to check Go module documentation
2. Use GitHub to find security advisories for these dependencies
3. Search for alternative packages if security issues found

Provide:
- Dependency security analysis
- Version pinning recommendations
- go.mod and go.sum best practices
- Vendor vs module proxy decision
- Update strategy and automation
`,

  testGeneration: (projectPath: string, testStrategy: string) => `
Generate comprehensive Go tests following best practices.

Project: ${projectPath}
Test Strategy: ${testStrategy}

Using MCPs:
1. Use Context7 for Go testing best practices and patterns
2. Use GitHub to find testing examples for similar projects
3. Search for table-driven test patterns and fixtures

Generate:
- Table-driven tests for pure functions
- Interface mocking strategies
- Integration test setup
- Benchmark tests for critical paths
- Fuzzing tests for input validation
- Test fixtures and golden files
- Coverage reporting setup
`,

  buildOptimization: (optimizationLevel: string, targetPlatforms: string[]) => `
Optimize Go build process for production deployment.

Optimization Level: ${optimizationLevel}
Target Platforms: ${targetPlatforms.join(', ')}

Using MCPs:
1. Use Context7 for Go build optimization techniques
2. Use GitHub to find build scripts for cross-platform Go projects
3. Search for binary size reduction techniques

Provide:
- Build flags for optimization (-ldflags, -trimpath, etc.)
- Cross-compilation matrix
- CGO considerations and alternatives
- Binary stripping and compression
- Build caching strategies
- Reproducible builds setup
`,

  dockerMultistage: (projectPath: string) => `
Create optimized multi-stage Docker build for Go application.

Project: ${projectPath}

Using MCPs:
1. Use Context7 for Docker multi-stage build patterns
2. Use GitHub to find minimal Go Docker images
3. Search for security-hardened container practices

Create:
- Multi-stage Dockerfile with:
  - Build stage with full Go toolchain
  - Minimal runtime stage (scratch/alpine)
  - Non-root user setup
  - Health checks
- Docker Compose for local development
- Container security scanning setup
- Kubernetes deployment manifests
`,

  securityScanning: (projectPath: string) => `
Implement comprehensive security scanning for Go project.

Project: ${projectPath}

Using MCPs:
1. Use Context7 for Go security best practices
2. Use GitHub to find Go security tools and configurations
3. Search for SAST/DAST tools for Go

Setup:
- gosec for static security analysis
- nancy for dependency vulnerability scanning
- Container scanning with trivy
- License compliance checking
- Secrets detection
- CI/CD integration for all scanners
- Security policy templates
`
};

export function createGoWorkflowPrompt(
  workflow: GoWorkflowType,
  context: any
): string {
  const basePrompt = `
Execute Go development workflow: ${workflow}

Context: ${JSON.stringify(context, null, 2)}

Please orchestrate the following:
1. Use Context7 MCP for Go-specific documentation and patterns
2. Use GitHub MCP to find production-ready examples
3. Use filesystem MCP to analyze current project structure
4. Provide step-by-step implementation

Focus on:
- Production readiness
- Performance optimization
- Security best practices
- Maintainability
- Testing coverage
`;

  return basePrompt;
}