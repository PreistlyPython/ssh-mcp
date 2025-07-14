/**
 * Rust Development Workflows for SSH MCP Server
 * Provides intelligent Rust development workflows with MCP orchestration
 */

export enum RustWorkflowType {
  // Project Management
  CARGO_NEW = 'cargo_new',
  WORKSPACE_SETUP = 'workspace_setup',
  DEPENDENCY_AUDIT = 'dependency_audit',
  
  // Development
  TRAIT_IMPLEMENTATION = 'trait_implementation',
  MACRO_DEVELOPMENT = 'macro_development',
  ASYNC_PATTERNS = 'async_patterns',
  ERROR_HANDLING = 'error_handling',
  
  // Testing & Quality
  TEST_HARNESS = 'test_harness',
  PROPERTY_TESTING = 'property_testing',
  FUZZING_SETUP = 'fuzzing_setup',
  BENCHMARK_SUITE = 'benchmark_suite',
  
  // Memory & Performance
  MEMORY_OPTIMIZATION = 'memory_optimization',
  UNSAFE_AUDIT = 'unsafe_audit',
  PERFORMANCE_PROFILING = 'performance_profiling',
  WASM_COMPILATION = 'wasm_compilation',
  
  // Production
  RELEASE_OPTIMIZATION = 'release_optimization',
  CROSS_COMPILATION = 'cross_compilation',
  STATIC_LINKING = 'static_linking',
  DEPLOYMENT_PACKAGING = 'deployment_packaging',
  
  // Code Quality
  CLIPPY_CONFIGURATION = 'clippy_configuration',
  RUSTFMT_SETUP = 'rustfmt_setup',
  DOCUMENTATION_GENERATION = 'documentation_generation',
  LICENSE_COMPLIANCE = 'license_compliance'
}

export interface RustWorkflowRequest {
  sessionId: string;
  workflowType: RustWorkflowType;
  projectPath: string;
  specifications?: {
    crateName?: string;
    rustEdition?: '2018' | '2021' | '2024';
    targetPlatforms?: string[];
    features?: string[];
    dependencies?: string[];
    optimizationProfile?: 'dev' | 'release' | 'bench';
    targetType?: 'bin' | 'lib' | 'cdylib' | 'staticlib';
  };
}

export const RustWorkflowPrompts = {
  cargoNew: (crateName: string, targetType: string, edition: string) => `
Create a new Rust project with production-ready structure.

Using available MCPs:
1. Use Context7 MCP for latest Rust project patterns
2. Use GitHub MCP to find popular Rust project templates
3. Search for Rust 2024 edition features and patterns

Create:
- Cargo.toml with:
  - Edition: ${edition}
  - Target type: ${targetType}
  - Common dependencies pre-configured
  - Feature flags setup
- Project structure following Rust conventions
- GitHub Actions for CI/CD
- Cross-platform build configuration
- README with badges and documentation

Crate name: ${crateName}
`,

  workspaceSetup: (projects: string[]) => `
Setup Rust workspace for multiple related crates.

Projects: ${projects.join(', ')}

Using MCPs:
1. Use Context7 for Rust workspace best practices
2. Use GitHub to find monorepo examples in Rust
3. Search for workspace dependency management patterns

Configure:
- Root Cargo.toml with workspace members
- Shared dependencies and features
- Common build scripts
- Unified testing strategy
- Documentation generation
- Release management tools
`,

  asyncPatterns: (projectPath: string, runtime: string) => `
Implement async patterns and best practices in Rust.

Project: ${projectPath}
Runtime preference: ${runtime || 'tokio'}

Using MCPs:
1. Use Context7 for Rust async/await patterns
2. Use GitHub to find async Rust examples
3. Search for common async pitfalls and solutions

Implement:
- Async runtime setup (tokio/async-std)
- Proper error handling with async
- Cancellation and timeout patterns
- Concurrent task management
- Stream processing patterns
- Async trait implementations
- Testing async code
`,

  errorHandling: (projectPath: string) => `
Implement comprehensive error handling strategy for Rust project.

Project: ${projectPath}

Using MCPs:
1. Use Context7 for Rust error handling best practices
2. Use GitHub to find error handling libraries (thiserror, anyhow, etc.)
3. Search for domain-specific error patterns

Design:
- Custom error types with thiserror
- Error propagation strategies
- Result type usage patterns
- Error context and tracing
- User-friendly error messages
- Error recovery strategies
- Testing error paths
`,

  memoryOptimization: (projectPath: string, targetMetrics: any) => `
Optimize memory usage in Rust application.

Project: ${projectPath}
Target metrics: ${JSON.stringify(targetMetrics, null, 2)}

Using MCPs:
1. Use Context7 for Rust memory optimization techniques
2. Use GitHub to find memory profiling tools and examples
3. Search for zero-copy patterns and arena allocators

Analyze and optimize:
- Memory allocation patterns
- Data structure selection
- String handling optimization
- Collection capacity management
- Memory pooling strategies
- Stack vs heap allocation
- Memory leak detection
`,

  releaseOptimization: (optimizationProfile: string, targetSize?: number) => `
Optimize Rust binary for production release.

Profile: ${optimizationProfile}
${targetSize ? `Target size: ${targetSize} bytes` : ''}

Using MCPs:
1. Use Context7 for Rust release optimization
2. Use GitHub to find Cargo.toml optimization examples
3. Search for binary size reduction techniques

Configure:
- Cargo.toml [profile.release] settings
- Link-time optimization (LTO)
- Code generation units
- Strip symbols and debug info
- Panic behavior (abort vs unwind)
- Target CPU features
- Compression techniques
`,

  wasmCompilation: (projectPath: string, targetEnvironment: string) => `
Setup WebAssembly compilation for Rust project.

Project: ${projectPath}
Target environment: ${targetEnvironment || 'web'}

Using MCPs:
1. Use Context7 for Rust WASM best practices
2. Use GitHub to find wasm-bindgen examples
3. Search for WASM optimization techniques

Setup:
- wasm-bindgen configuration
- wasm-pack integration
- JavaScript/TypeScript bindings
- WASM binary optimization
- Testing in WASM environment
- Deployment strategies
- Performance considerations
`,

  propertyTesting: (projectPath: string) => `
Implement property-based testing for Rust project.

Project: ${projectPath}

Using MCPs:
1. Use Context7 for property testing patterns in Rust
2. Use GitHub to find proptest/quickcheck examples
3. Search for domain-specific property strategies

Implement:
- Property test setup with proptest
- Custom strategy implementations
- Shrinking strategies
- Stateful property tests
- Integration with regular tests
- CI/CD integration
- Coverage tracking
`
};

export function createRustWorkflowPrompt(
  workflow: RustWorkflowType,
  context: any
): string {
  const basePrompt = `
Execute Rust development workflow: ${workflow}

Context: ${JSON.stringify(context, null, 2)}

Please orchestrate the following:
1. Use Context7 MCP for Rust-specific documentation and patterns
2. Use GitHub MCP to find production-ready examples
3. Use filesystem MCP to analyze current project structure
4. Provide step-by-step implementation with code examples

Focus on:
- Memory safety and performance
- Error handling robustness
- Idiomatic Rust patterns
- Zero-cost abstractions
- Comprehensive testing
- Documentation
`;

  return basePrompt;
}