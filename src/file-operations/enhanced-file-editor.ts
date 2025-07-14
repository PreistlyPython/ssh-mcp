/**
 * Enhanced File Editor with Testing and Fallback Methods
 * Provides robust file editing capabilities with multiple fallback strategies
 */

import { Client } from 'ssh2';

export enum FileEditStrategy {
  DIRECT_EDIT = 'direct_edit',
  ATOMIC_WRITE = 'atomic_write',
  BACKUP_AND_EDIT = 'backup_and_edit',
  PATCH_APPLICATION = 'patch_application',
  STREAM_EDIT = 'stream_edit',
  MEMORY_MAPPED = 'memory_mapped'
}

export enum TestingFramework {
  JEST = 'jest',
  MOCHA = 'mocha',
  VITEST = 'vitest',
  PYTEST = 'pytest',
  GO_TEST = 'go_test',
  CARGO_TEST = 'cargo_test',
  JUNIT = 'junit',
  RSPEC = 'rspec',
  PHPUNIT = 'phpunit'
}

export interface FileEditRequest {
  sessionId: string;
  filePath: string;
  editType: 'replace' | 'append' | 'prepend' | 'insert' | 'delete';
  content?: string;
  searchPattern?: string;
  lineNumber?: number;
  strategy?: FileEditStrategy;
  validation?: {
    syntaxCheck?: boolean;
    testExecution?: boolean;
    lintCheck?: boolean;
  };
}

export interface TestSetupRequest {
  sessionId: string;
  projectPath: string;
  framework: TestingFramework;
  testType: 'unit' | 'integration' | 'e2e' | 'all';
  coverage?: boolean;
  watch?: boolean;
}

export const FileEditPrompts = {
  safeFileEdit: (filePath: string, editType: string, content: string, strategy: FileEditStrategy) => `
Perform a safe file edit with fallback strategies.

File: ${filePath}
Edit Type: ${editType}
Strategy: ${strategy}
Content: ${content}

Using available MCPs, implement this edit safely:

1. Create backup of original file
2. Implement edit using ${strategy} strategy:
   ${getStrategySteps(strategy)}
3. Validate the edit:
   - Syntax checking if applicable
   - Ensure file permissions are preserved
   - Verify content integrity
4. Test the changes if test files exist
5. Provide rollback command if needed

Include error handling for:
- File not found
- Permission denied
- Disk space issues
- Network interruptions
- Concurrent edit conflicts
`,

  setupTestingSuite: (projectPath: string, framework: TestingFramework, options: any) => `
Setup comprehensive testing suite for project.

Project: ${projectPath}
Framework: ${framework}
Options: ${JSON.stringify(options, null, 2)}

Using MCPs:
1. Use Context7 to get ${framework} setup documentation
2. Use GitHub to find testing configurations for similar projects
3. Search for best practices and common patterns

Setup:
${getTestingSetupSteps(framework, options)}

Include:
- Test runner configuration
- Coverage reporting setup
- CI/CD integration
- Pre-commit hooks
- Watch mode configuration
- Test data fixtures
- Mocking strategies
`,

  atomicFileReplace: (filePath: string, content: string) => `
Implement atomic file replacement for zero-downtime updates.

File: ${filePath}

Steps for atomic replacement:
1. Write new content to temporary file in same directory
2. Set permissions to match original file
3. Use atomic rename operation (mv -f or equivalent)
4. Verify successful replacement
5. Clean up any temporary files

This ensures:
- No partial writes visible to readers
- Automatic rollback on failure
- Preservation of file attributes
- Safe for concurrent access
`,

  patchBasedEdit: (filePath: string, changes: any) => `
Apply changes using patch/diff format for precise edits.

File: ${filePath}
Changes: ${JSON.stringify(changes, null, 2)}

Using patch-based approach:
1. Generate unified diff from changes
2. Validate patch can be applied cleanly
3. Create backup before application
4. Apply patch with fallback to manual edit
5. Verify patch application succeeded

Benefits:
- Precise line-level changes
- Automatic conflict detection
- Easy rollback capability
- Version control friendly
`,

  streamingLargeFileEdit: (filePath: string, searchReplace: any) => `
Edit large files using streaming to avoid memory issues.

File: ${filePath}
Search/Replace: ${JSON.stringify(searchReplace, null, 2)}

Streaming approach:
1. Open file with read stream
2. Create write stream to temporary file
3. Process file line by line or in chunks
4. Apply transformations during streaming
5. Atomic replace when complete
6. Progress reporting for large files

Memory efficient for:
- Log files
- Database dumps
- CSV/JSON data files
- Source code repositories
`
};

function getStrategySteps(strategy: FileEditStrategy): string {
  const strategies = {
    [FileEditStrategy.DIRECT_EDIT]: `
   - Open file in write mode
   - Apply changes directly
   - Flush and sync to disk`,
    
    [FileEditStrategy.ATOMIC_WRITE]: `
   - Write to temporary file
   - Set permissions
   - Atomic rename to target`,
    
    [FileEditStrategy.BACKUP_AND_EDIT]: `
   - Create timestamped backup
   - Edit original file
   - Keep backup for rollback`,
    
    [FileEditStrategy.PATCH_APPLICATION]: `
   - Generate diff/patch
   - Validate patch
   - Apply with patch command`,
    
    [FileEditStrategy.STREAM_EDIT]: `
   - Read file as stream
   - Transform in memory
   - Write to new file`,
    
    [FileEditStrategy.MEMORY_MAPPED]: `
   - Memory map the file
   - Edit mapped region
   - Sync changes to disk`
  };
  
  return strategies[strategy] || strategies[FileEditStrategy.DIRECT_EDIT];
}

function getTestingSetupSteps(framework: TestingFramework, options: any): string {
  const setups: Record<TestingFramework, string> = {
    [TestingFramework.JEST]: `
- Install Jest and TypeScript support
- Create jest.config.js with:
  - Coverage thresholds
  - Test patterns
  - Module mappings
- Setup test scripts in package.json
- Create __tests__ directories
- Configure VS Code debugging`,
    
    [TestingFramework.VITEST]: `
- Install Vitest and plugins
- Create vitest.config.ts
- Configure:
  - UI mode
  - Coverage (c8/istanbul)
  - Inline test support
- Integration with IDE
- Snapshot testing setup`,
    
    [TestingFramework.GO_TEST]: `
- Setup go test structure
- Create testify assertions
- Configure:
  - Table-driven tests
  - Benchmarks
  - Race detection
  - Coverage reporting
- Makefile targets`,
    
    [TestingFramework.CARGO_TEST]: `
- Configure Cargo.toml for tests
- Setup:
  - Unit test modules
  - Integration tests directory
  - Benchmark setup
  - Property testing
- CI/CD integration
- Code coverage with tarpaulin`,
    
    [TestingFramework.MOCHA]: `
- Install Mocha and Chai
- Create .mocharc.json configuration
- Setup test structure
- Configure reporters
- Add TypeScript support`,
    
    [TestingFramework.PYTEST]: `
- Install pytest and plugins
- Create pytest.ini
- Setup fixtures
- Configure coverage
- Add markers and custom assertions`,
    
    [TestingFramework.JUNIT]: `
- Configure JUnit 5
- Setup Maven/Gradle integration
- Create test suites
- Configure test runners
- Add mockito support`,
    
    [TestingFramework.RSPEC]: `
- Install RSpec gems
- Configure .rspec file
- Setup spec helper
- Add factory_bot
- Configure simplecov`,
    
    [TestingFramework.PHPUNIT]: `
- Install PHPUnit via Composer
- Create phpunit.xml
- Setup bootstrap file
- Configure code coverage
- Add database testing support`
  };
  
  return setups[framework] || 'Generic test setup';
}

export function createFileOperationPrompt(
  operation: string,
  context: any
): string {
  return `
Perform file operation: ${operation}

Context: ${JSON.stringify(context, null, 2)}

Safety requirements:
1. Always create backups before destructive operations
2. Validate syntax/format when applicable
3. Preserve file permissions and attributes
4. Handle concurrent access gracefully
5. Provide clear rollback procedures

Use MCPs to:
- Get language-specific validation rules
- Find safe file handling patterns
- Implement platform-specific optimizations
`;
}