/**
 * ML MCP Integration Prompts for SSH-MCP
 * Leverages ML-enhanced MCPs for intelligent operations, persistence, and backup management
 */

export const MLMCPIntegrationPrompts = {
  // Context-Aware Memory Integration
  persistSSHOperation: (operation: string, sessionInfo: any, result: any) => `
Store SSH operation in context-aware memory for future reference and learning.

Using the context_aware_memory MCP:
1. Use the "store_memory" tool to persist this SSH operation:
   - Content: ${JSON.stringify({ operation, result }, null, 2)}
   - Context: ${JSON.stringify(sessionInfo, null, 2)}
   - Tags: ['ssh-operation', operation.split('_')[0], sessionInfo.host]
   - Importance: Calculate based on operation type and success

2. Analyze patterns for similar operations using "retrieve_memories":
   - Query for similar operations on the same host
   - Look for success/failure patterns
   - Extract optimization opportunities

3. Use "predict_workflow" to anticipate next steps:
   - Based on this operation type
   - Historical patterns from similar contexts
   - User behavior learning

This creates a persistent, searchable history of all SSH operations.
`,

  intelligentBackupManager: (backupType: string, targets: string[], options: any) => `
Create intelligent backup with ML-enhanced deduplication and versioning.

Orchestrate multiple ML MCPs:

1. Use ml_code_intelligence MCP to analyze files:
   - Identify critical files vs generated/temporary files
   - Detect file types and appropriate compression
   - Find duplicate content across targets

2. Use context_aware_memory MCP to:
   - Retrieve previous backup patterns
   - Store backup metadata for quick restoration
   - Learn optimal backup schedules

3. Use command_analytics MCP to:
   - Track backup performance metrics
   - Predict optimal backup windows
   - Suggest incremental vs full backup

Backup Strategy:
- Type: ${backupType}
- Targets: ${targets.join(', ')}
- Options: ${JSON.stringify(options, null, 2)}

Implement intelligent features:
- Content-aware deduplication
- Smart compression based on file types
- Version control integration
- Automated retention policies
`,

  workflowLearning: (workflowType: string, steps: any[], context: any) => `
Learn from workflow execution to optimize future operations.

Using workflow_optimizer MCP:

1. Analyze workflow execution:
   - Workflow: ${workflowType}
   - Steps executed: ${JSON.stringify(steps, null, 2)}
   - Context: ${JSON.stringify(context, null, 2)}

2. Use pattern learning to:
   - Identify redundant steps
   - Find optimization opportunities
   - Detect automation candidates

3. Store learnings in context_aware_memory:
   - Successful patterns
   - Common error scenarios
   - Performance benchmarks

4. Generate optimized workflow template:
   - Remove redundant operations
   - Parallelize independent steps
   - Add error handling based on patterns
   - Include rollback procedures

Return optimized workflow for future use.
`,

  codeIntelligenceAnalysis: (projectPath: string, analysisType: string) => `
Perform ML-powered code analysis on SSH-accessed project.

Using ml_code_intelligence MCP:

1. Index the codebase:
   - Path: ${projectPath}
   - Generate semantic embeddings
   - Build dependency graph
   - Extract patterns and anti-patterns

2. Perform ${analysisType} analysis:
   - Security vulnerabilities
   - Performance bottlenecks
   - Code quality metrics
   - Technical debt assessment

3. Generate actionable insights:
   - Prioritized issue list
   - Refactoring suggestions
   - Security remediation steps
   - Performance optimization opportunities

4. Store analysis in memory:
   - Use context_aware_memory for historical tracking
   - Enable trend analysis over time
   - Track improvement metrics

Provide comprehensive report with specific recommendations.
`,

  predictiveCommandSuggestions: (currentContext: any, recentCommands: string[]) => `
Generate intelligent command suggestions using ML pattern recognition.

Orchestrate ML MCPs:

1. Use command_analytics MCP to:
   - Analyze command usage patterns
   - Calculate success rates
   - Identify command sequences

2. Use context_aware_memory MCP to:
   - Retrieve similar contexts
   - Find successful command patterns
   - Learn user preferences

3. Use workflow_optimizer MCP to:
   - Suggest command optimizations
   - Recommend automation opportunities
   - Predict next likely commands

Context: ${JSON.stringify(currentContext, null, 2)}
Recent Commands: ${recentCommands.join(', ')}

Generate:
- Top 5 command predictions with confidence scores
- Explanation of why each command is suggested
- Potential command chains for workflows
- Warnings about risky operations
`,

  knowledgeGraphNavigation: (concept: string, relationshipType: string) => `
Navigate knowledge graph to discover related concepts and patterns.

Using knowledge_graph MCP:

1. Query for concept: "${concept}"
   - Find direct relationships
   - Explore ${relationshipType} connections
   - Calculate relationship strengths

2. Build knowledge path:
   - From current concept to related technologies
   - Include best practices and patterns
   - Add security considerations

3. Extract actionable insights:
   - Related tools and commands
   - Common workflows
   - Integration patterns
   - Potential issues and solutions

4. Visualize relationships:
   - Generate graph representation
   - Highlight strong connections
   - Show learning paths

Return structured knowledge with practical applications.
`,

  performanceMetricsTracking: (operation: string, metrics: any) => `
Track and analyze performance metrics with ML predictions.

Using predictive_analytics MCP:

1. Store performance metrics:
   - Operation: ${operation}
   - Metrics: ${JSON.stringify(metrics, null, 2)}
   - Timestamp and context

2. Analyze trends:
   - Performance over time
   - Anomaly detection
   - Capacity predictions

3. Generate insights:
   - Performance bottlenecks
   - Optimization opportunities
   - Scaling recommendations
   - Predictive alerts

4. Create optimization plan:
   - Short-term improvements
   - Long-term architecture changes
   - Resource allocation suggestions

Provide actionable performance optimization roadmap.
`,

  restoreFromBackup: (backupId: string, targetPath: string, options: any) => `
Intelligently restore from backup with validation and rollback capability.

Orchestrate restoration process:

1. Use context_aware_memory MCP to:
   - Retrieve backup metadata
   - Find related backups and versions
   - Check restoration history

2. Use ml_code_intelligence MCP to:
   - Validate backup integrity
   - Check for conflicts with current state
   - Suggest merge strategies if needed

3. Implement smart restoration:
   - Create restoration checkpoint
   - Restore with progress tracking
   - Validate restored content
   - Test functionality if applicable

4. Store restoration record:
   - Success/failure status
   - Any conflicts resolved
   - Performance metrics
   - Rollback information

Backup ID: ${backupId}
Target: ${targetPath}
Options: ${JSON.stringify(options, null, 2)}
`
};

/**
 * Helper to create ML-enhanced workflow
 */
export function createMLEnhancedWorkflow(
  workflowName: string,
  steps: string[],
  mlCapabilities: string[]
): string {
  return `
Execute ML-enhanced workflow: ${workflowName}

Steps to execute:
${steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

ML Enhancements to apply:
${mlCapabilities.map(cap => `- ${cap}`).join('\n')}

For each step:
1. Use context_aware_memory to check for similar executions
2. Apply ml_code_intelligence for intelligent analysis
3. Use workflow_optimizer to find improvements
4. Track with command_analytics for learning
5. Store results for future predictions

Provide:
- Optimized execution plan
- Risk assessment for each step
- Rollback procedures
- Performance predictions
- Learning insights for future runs
`;
}

/**
 * Create backup strategy using ML insights
 */
export function createMLBackupStrategy(
  projectType: string,
  dataVolume: string,
  changeFrequency: string
): string {
  return `
Design optimal backup strategy using ML analysis.

Project Type: ${projectType}
Data Volume: ${dataVolume}
Change Frequency: ${changeFrequency}

Using ML MCPs:

1. Analyze with ml_code_intelligence:
   - Identify critical vs non-critical files
   - Detect generated/temporary content
   - Find optimal compression ratios

2. Learn from context_aware_memory:
   - Previous backup patterns
   - Restoration frequency
   - Common failure scenarios

3. Predict with predictive_analytics:
   - Optimal backup windows
   - Storage growth trends
   - Recovery time objectives

4. Optimize with workflow_optimizer:
   - Incremental vs full backup schedule
   - Deduplication opportunities
   - Parallel backup strategies

Generate comprehensive backup plan with:
- Automated scheduling
- Intelligent retention policies
- Quick recovery procedures
- Cost optimization strategies
`;
}