/**
 * MCP Orchestration Prompts for SSH-MCP
 * These prompts leverage existing MCPs (Context7, GitHub, etc.) installed in Claude Desktop
 */

export const MCPOrchestrationPrompts = {
  // Laravel Workflows using Context7 and GitHub MCPs
  laravelArtisanCommand: (command: string, projectPath: string) => `
I need to execute a Laravel Artisan command on a remote server. Please help me:

1. First, use the Context7 MCP to get the latest Laravel documentation for the "${command}" command
2. Use the GitHub MCP to search for best practices and examples of using "${command}" in production
3. Based on the documentation and examples, provide the optimal command with all recommended flags and options
4. Include any pre-requisites or post-execution steps that should be performed

Project path: ${projectPath}
Command requested: php artisan ${command}

Please provide:
- The complete command with recommended options
- Any environment-specific considerations
- Common pitfalls to avoid
- Post-execution verification steps
`,

  laravelDeployment: (projectPath: string, environment: string, strategy: string) => `
I need to deploy a Laravel application using a ${strategy} deployment strategy to ${environment}. 

Please orchestrate the following using available MCPs:

1. Use Context7 MCP to get Laravel deployment best practices for ${environment} environment
2. Use GitHub MCP to find proven ${strategy} deployment scripts and workflows for Laravel
3. Use the memory MCP to recall any previous successful deployments for similar projects

Create a comprehensive deployment plan that includes:
- Pre-deployment checks (tests, build, migrations)
- Zero-downtime deployment steps for ${strategy} strategy
- Rollback procedures
- Post-deployment verification
- Monitoring and alerting setup

Project: ${projectPath}
Environment: ${environment}
Strategy: ${strategy}
`,

  // Node.js Workflows
  nodeProcessManagement: (action: string, appName: string) => `
I need to ${action} a Node.js application using PM2 process management.

Please use available MCPs to:

1. Use Context7 MCP to get the latest PM2 documentation for "${action}" operations
2. Use GitHub MCP to find production-ready PM2 configurations and best practices
3. If action is "start", search for optimal PM2 ecosystem configurations

Provide a complete solution including:
- The exact PM2 command with recommended flags
- Cluster mode configuration if applicable
- Memory limits and restart policies
- Log rotation setup
- Monitoring integration

Application: ${appName}
Action: ${action}
`,

  nodeRealtimeSetup: (projectPath: string, technology: string, features: string[]) => `
I need to implement real-time features using ${technology} in a Node.js application.

Using available MCPs, please:

1. Use Context7 MCP to get implementation guides for ${technology}
2. Use GitHub MCP to find production-ready ${technology} implementations with these features: ${features.join(', ')}
3. Search for scaling patterns and best practices for ${technology} in production

Create a complete implementation plan including:
- Server setup and configuration
- Client integration code
- Authentication and security measures
- Scaling considerations (Redis adapter, sticky sessions, etc.)
- Error handling and reconnection logic
- Performance optimization tips

Project: ${projectPath}
Technology: ${technology}
Features: ${features.join(', ')}
`,

  // React/Next.js Smart Editing
  reactSmartComponentEdit: (componentPath: string, editType: string, specifications: any) => `
I need to intelligently edit a React/Next.js component with the following requirements:

Component: ${componentPath}
Edit Type: ${editType}
Specifications: ${JSON.stringify(specifications, null, 2)}

Please use available MCPs to:

1. Use Context7 MCP to get the latest React/Next.js patterns for ${editType}
2. Use GitHub MCP to find examples of similar ${editType} implementations
3. Analyze the component using typescript/flow types if available

Provide:
- The exact code changes needed
- Any new dependencies required
- Performance implications
- Accessibility considerations
- TypeScript types if applicable
- Unit test examples for the changes
`,

  // Kubernetes Deployment
  kubernetesDeployment: (appName: string, image: string, scaling: any) => `
I need to deploy an application to Kubernetes with auto-scaling and monitoring.

Application: ${appName}
Docker Image: ${image}
Scaling Config: ${JSON.stringify(scaling, null, 2)}

Using available MCPs:

1. Use Context7 MCP to get Kubernetes deployment best practices
2. Use GitHub MCP to find production-ready Kubernetes manifests for similar applications
3. Search for Horizontal Pod Autoscaler (HPA) configurations that match our scaling requirements

Generate:
- Deployment manifest with best practices (resource limits, health checks, etc.)
- Service manifest with appropriate type
- HPA configuration based on provided scaling parameters
- ConfigMap for environment variables
- Ingress configuration if needed
- Prometheus ServiceMonitor for monitoring
- Network policies for security
`,

  // Performance Benchmarking
  performanceBenchmark: (benchmarkType: string, compareWith: string[]) => `
I need to run performance benchmarks and compare with industry standards.

Benchmark Type: ${benchmarkType}
Compare With: ${compareWith.join(', ')}

Please orchestrate:

1. Use Context7 MCP to find performance benchmarking methodologies for ${benchmarkType}
2. Use GitHub MCP to find benchmark results from ${compareWith.join(', ')} for similar workloads
3. Search for performance optimization techniques specific to ${benchmarkType}

Provide:
- Benchmark test plan with specific metrics to measure
- Expected performance ranges based on industry standards
- Performance optimization recommendations
- Monitoring and alerting thresholds
- Capacity planning insights
`,

  // AI-Powered Command Suggestions
  commandSuggestions: (context: any) => `
Based on the current context, suggest the most relevant commands:

Context:
- Directory: ${context.directory}
- Technology: ${context.technology}
- Recent Commands: ${context.recentCommands?.join(', ') || 'none'}

Using available MCPs:

1. Use Context7 MCP to get common commands for ${context.technology} projects
2. Use GitHub MCP to analyze similar projects and their common command patterns
3. Use memory MCP to recall successful command sequences from similar contexts

Provide:
- Top 5 most relevant commands with explanations
- Command shortcuts or aliases if applicable
- Context-aware flags and options
- Potential command chains for common workflows
`,

  // Enterprise Security & Compliance
  complianceReport: (framework: string, reportType: string) => `
Generate a ${reportType} compliance report for ${framework} framework.

Using available MCPs:

1. Use Context7 MCP to get the latest ${framework} compliance requirements
2. Use GitHub MCP to find ${framework} compliance checklist templates and automation tools
3. Search for industry-specific ${framework} implementation examples

Create a comprehensive report including:
- Current compliance status assessment
- Gap analysis with specific remediation steps
- Implementation timeline and priorities
- Automated compliance checking scripts
- Continuous compliance monitoring setup
- Documentation templates
`,

  // MCP Integration Patterns
  contextAnalysis: (sessionInfo: any) => `
Analyze the current SSH session context and provide intelligent assistance.

Session Info: ${JSON.stringify(sessionInfo, null, 2)}

Orchestrate the following:

1. Use Context7 MCP to identify the technology stack and get relevant documentation
2. Use GitHub MCP to find similar project structures and patterns
3. Use memory MCP to recall successful patterns from similar projects
4. Use filesystem MCP to analyze project structure if needed

Provide:
- Technology stack detection results
- Recommended project structure improvements
- Common patterns for this type of project
- Potential issues or anti-patterns detected
- Next steps recommendations
`
};

/**
 * Helper function to create a prompt that orchestrates multiple MCPs
 */
export function createOrchestrationPrompt(
  taskType: string,
  requirements: any,
  mcpsToUse: string[] = ['Context7', 'GitHub', 'memory']
): string {
  return `
I need to ${taskType} with the following requirements:
${JSON.stringify(requirements, null, 2)}

Please orchestrate the following MCPs to complete this task:
${mcpsToUse.map((mcp, index) => `${index + 1}. Use ${mcp} MCP for relevant information and patterns`).join('\n')}

Provide a comprehensive solution that:
- Leverages best practices from documentation and community
- Includes production-ready code/configurations
- Considers security and performance implications
- Includes testing and validation steps
- Provides rollback procedures if applicable
`;
}

/**
 * Workflow orchestration prompt generator
 */
export function createWorkflowPrompt(
  workflow: string,
  steps: string[],
  context: any
): string {
  return `
Execute the "${workflow}" workflow with the following steps:

${steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}

Context: ${JSON.stringify(context, null, 2)}

For each step:
- Use Context7 MCP to get relevant documentation
- Use GitHub MCP to find implementation examples
- Use memory MCP to apply learned patterns
- Provide specific commands/code for execution
- Include validation steps
- Handle potential errors gracefully

Deliver a step-by-step execution plan with all necessary details.
`;
}

// Go Development Prompts
export const GoWorkflowPrompts = {
  goModuleInit: (moduleName: string, goVersion: string) => `
Initialize a production-ready Go module using best practices.

Module: ${moduleName}
Go Version: ${goVersion}

Using available MCPs:
1. Use Context7 to get latest Go module patterns
2. Use GitHub to find popular Go project templates  
3. Use filesystem MCP to create proper structure

Create complete Go project with:
- Standard layout (cmd/, pkg/, internal/)
- Comprehensive Makefile
- Docker multi-stage builds
- CI/CD pipelines
- Pre-commit hooks
- Security scanning setup
`,

  goDependencyAudit: (projectPath: string) => `
Audit Go dependencies for security and performance.

Project: ${projectPath}

Orchestrate:
1. Use Context7 for Go security tools documentation
2. Use GitHub to check CVE databases for dependencies
3. Use memory MCP for known vulnerability patterns

Perform:
- Dependency vulnerability scanning
- License compliance checking  
- Update recommendations
- Alternative package suggestions
- Automated update strategies
`,

  goTestGeneration: (projectPath: string, testType: string) => `
Generate comprehensive Go tests.

Project: ${projectPath}
Test Type: ${testType}

Using MCPs:
1. Context7 for Go testing best practices
2. GitHub for table-driven test examples
3. Memory for successful test patterns

Generate:
- Table-driven tests
- Benchmark tests
- Fuzzing tests
- Mock generation
- Test fixtures
- Coverage setup
`
};

// Rust Development Prompts  
export const RustWorkflowPrompts = {
  rustProjectSetup: (crateName: string, edition: string) => `
Create production-ready Rust project.

Crate: ${crateName}
Edition: ${edition}

Orchestrate:
1. Context7 for Rust ${edition} features
2. GitHub for Rust project templates
3. Filesystem for project creation

Setup:
- Cargo workspace structure
- GitHub Actions CI/CD
- Cross-compilation support
- Documentation generation
- Security audit automation
- Performance benchmarks
`,

  rustMemoryOptimization: (projectPath: string) => `
Optimize Rust memory usage.

Project: ${projectPath}

Using MCPs:
1. Context7 for Rust memory patterns
2. GitHub for profiling examples
3. Memory for optimization patterns

Analyze:
- Heap allocations
- Collection usage
- String handling
- Zero-copy patterns
- Arena allocators
- Stack optimization
`,

  rustAsyncImplementation: (projectPath: string, runtime: string) => `
Implement async patterns in Rust.

Project: ${projectPath}  
Runtime: ${runtime}

Orchestrate:
1. Context7 for async/await patterns
2. GitHub for ${runtime} examples
3. Memory for common pitfalls

Implement:
- Runtime setup
- Error handling
- Cancellation
- Concurrency patterns
- Stream processing
- Testing strategies
`
};

// Enhanced File Operations Prompts
export const FileOperationPrompts = {
  safeFileEdit: (filePath: string, strategy: string) => `
Perform safe file editing with fallback strategies.

File: ${filePath}
Strategy: ${strategy}

Using MCPs:
1. Filesystem MCP for file operations
2. Memory MCP for successful edit patterns
3. Context7 for language-specific validation

Implement:
- Backup creation
- Atomic writes
- Syntax validation
- Permission preservation
- Rollback capability
- Concurrent access handling
`,

  testSuiteSetup: (projectPath: string, framework: string) => `
Setup comprehensive testing framework.

Project: ${projectPath}
Framework: ${framework}

Orchestrate:
1. Context7 for ${framework} documentation
2. GitHub for testing configurations
3. Filesystem for setup automation

Configure:
- Test runner setup
- Coverage reporting
- CI/CD integration
- Watch mode
- Mocking strategies
- Performance benchmarks
`
}