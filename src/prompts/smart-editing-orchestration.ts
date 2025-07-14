/**
 * Smart File Editing Orchestration Prompts
 * Based on research of optimal algorithms and production best practices
 */

export const SmartEditingOrchestration = {
  /**
   * Master orchestration prompt for complex editing operations
   */
  masterEditingWorkflow: (request: {
    filePath: string;
    operations: any[];
    context: any;
    constraints?: any;
  }) => `
🚀 **SMART FILE EDITING ORCHESTRATION WORKFLOW**

Target File: $FILE_PATH
Operations Count: $OPERATIONS_COUNT
Context: $CONTEXT_JSON

## 📊 **PHASE 1: INTELLIGENT ANALYSIS & STRATEGY SELECTION**

### File Analysis:
Use the following MCPs to analyze the file:
1. **websearch** - Research optimal editing strategies for this file type
2. **github** - Find proven patterns for similar editing operations
3. **memory** - Retrieve previous successful editing patterns
4. **ml_code_intelligence** - Analyze file complexity and risk factors

### Strategy Selection Algorithm:
\`\`\`javascript
// Based on research findings:
if (fileSize > 50MB) {
  strategy = "streaming";  // Memory-mapped or chunk-based
} else if (operations.length > 100) {
  strategy = "operational_transform";  // Google Docs approach
} else if (isCriticalFile || hasComplexOperations) {
  strategy = "two_phase_commit";  // Maximum safety
} else if (operations.length > 10) {
  strategy = "patch_based";  // Git-style diff/patch
} else {
  strategy = "atomic_write";  // VSCode approach
}
\`\`\`

### Risk Assessment:
- File type: $FILE_EXTENSION
- Binary content risk: [AUTO-DETECT]
- Concurrent access probability: [ANALYZE]
- Rollback complexity: [EVALUATE]

## 🔒 **PHASE 2: SAFETY PREPARATION**

### Atomic Safety Setup:
1. **File Locking Strategy**:
   \`\`\`bash
   # Use flock for atomic operations
   exec 200>"$FILE_PATH.lock"
   flock -x 200 || { echo "Failed to acquire lock"; exit 1; }
   \`\`\`

2. **Backup Creation** (Research-based):
   \`\`\`bash
   # Create atomic backup with timestamp
   backup_file="$FILE_PATH.backup.$(date +%s)"
   cp "$FILE_PATH" "$backup_file"
   
   # Store metadata for recovery
   echo "{\\"original\\": \\"$FILE_PATH\\", \\"backup\\": \\"$backup_file\\", \\"timestamp\\": $(date +%s), \\"checksum\\": \\"$(sha256sum "$FILE_PATH" | cut -d' ' -f1)\\"}" > "$backup_file.meta"
   \`\`\`

3. **Integrity Verification**:
   \`\`\`bash
   # Use xxHash for speed (research recommendation)
   original_hash=$(xxhsum "$FILE_PATH" 2>/dev/null || sha256sum "$FILE_PATH" | cut -d' ' -f1)
   echo "Original hash: $original_hash"
   \`\`\`

## ⚡ **PHASE 3: OPTIMIZED EXECUTION**

### Execute Using Selected Strategy:

**For Atomic Write (small files, few operations):**
\`\`\`bash
# Git-style atomic operations
temp_file="/tmp/edit_$(uuidgen)"
cp "$FILE_PATH" "$temp_file"

# Apply operations to temp file
# Process each operation sequentially
for operation in operations; do
  case $operation_type in
    "replace") sed -i 's/old_content/new_content/g' "$temp_file" ;;
    "insert") sed -i 'line_number i\\new_content' "$temp_file" ;;
    "delete") sed -i 'line_number d' "$temp_file" ;;
    *) echo "Complex operation - implement manually" ;;
  esac
done

# Atomic move (POSIX guarantee)
mv "$temp_file" "$FILE_PATH"
\`\`\`

**For Patch-Based (medium complexity):**
\`\`\`bash
# Create unified diff patch
diff -u "$FILE_PATH" "$temp_file" > changes.patch

# Apply with validation
patch --dry-run "$FILE_PATH" < changes.patch && \\
patch "$FILE_PATH" < changes.patch
\`\`\`

**For Streaming (large files):**
\`\`\`bash
# Use sed for streaming operations (memory efficient)
# Process operations sequentially to avoid conflicts
for operation in operations; do
  case $operation_type in
    "replace") sed -i 's/old_content/new_content/g' "$FILE_PATH" ;;
    "insert") sed -i 'line_number i\\new_content' "$FILE_PATH" ;;
    "delete") sed -i 'line_number d' "$FILE_PATH" ;;
  esac
done
\`\`\`

## 🔍 **PHASE 4: COMPREHENSIVE VALIDATION**

### Multi-Level Validation:
1. **Checksum Verification**:
   \`\`\`bash
   new_hash=$(xxhsum "$FILE_PATH" 2>/dev/null || sha256sum "$FILE_PATH" | cut -d' ' -f1)
   echo "New hash: $new_hash"
   
   # Verify change was intentional (not corruption)
   if [ "$new_hash" = "$original_hash" ]; then
     echo "WARNING: File unchanged - verify operations were applied"
   fi
   \`\`\`

2. **Syntax Validation** (file-type specific):
   \`\`\`bash
   case "$FILE_PATH##*." in
     "js"|"ts") node -c "$FILE_PATH" ;;
     "py") python -m py_compile "$FILE_PATH" ;;
     "php") php -l "$FILE_PATH" ;;
     "json") python -m json.tool "$FILE_PATH" > /dev/null ;;
     "yaml"|"yml") python -c "import yaml; yaml.safe_load(open('$FILE_PATH'))" ;;
   esac
   \`\`\`

3. **Performance Verification**:
   \`\`\`bash
   # Check file size changes
   old_size=$(stat -c%s "$backup_file")
   new_size=$(stat -c%s "$FILE_PATH")
   size_diff=$((new_size - old_size))
   echo "Size change: $size_diff bytes"
   
   # Verify permissions preserved
   old_perms=$(stat -c%a "$backup_file")
   new_perms=$(stat -c%a "$FILE_PATH")
   [ "$old_perms" = "$new_perms" ] || echo "WARNING: Permissions changed"
   \`\`\`

## 🔄 **PHASE 5: INTELLIGENT CLEANUP & REPORTING**

### Success Path:
\`\`\`bash
# Release lock
flock -u 200

# Schedule backup cleanup (keep for 24h)
echo "rm -f '$backup_file' '$backup_file.meta'" | at now + 24 hours

# Log successful operation
echo "$(date): Successful edit of $FILE_PATH" >> /tmp/edit_log.txt
\`\`\`

### Failure Recovery:
\`\`\`bash
# On any failure, atomic rollback
if [ $? -ne 0 ]; then
  echo "Operation failed, rolling back..."
  cp "$backup_file" "$FILE_PATH"
  echo "Rollback completed"
  exit 1
fi
\`\`\`

## 📈 **PHASE 6: LEARNING & OPTIMIZATION**

### Performance Metrics Collection:
\`\`\`bash
end_time=$(date +%s.%N)
duration=$(echo "$end_time - $start_time" | bc)
echo "Operation completed in $duration seconds"

# Store metrics for future optimization
echo "{\\"file\\": \\"$FILE_PATH\\", \\"strategy\\": \\"$strategy\\", \\"duration\\": $duration, \\"operations\\": $OPERATIONS_COUNT, \\"success\\": true}" >> /tmp/edit_metrics.jsonl
\`\`\`

### Memory Storage for Future Use:
Use **memory** MCP to store:
- Successful operation patterns
- File-type specific optimizations  
- Performance benchmarks
- Error recovery strategies

## 🎯 **EXECUTION SUMMARY**

Strategy Selected: [AUTO-SELECTED BASED ON ANALYSIS]
Safety Level: MAXIMUM (atomic operations + rollback)
Performance: OPTIMIZED (based on file characteristics)
Validation: COMPREHENSIVE (syntax + integrity + performance)

Execute this workflow step-by-step, adapting the specific commands based on:
- File type and size
- Operation complexity
- System capabilities
- Performance requirements

**Remember**: If any step fails, immediately execute rollback procedure!
`,

  /**
   * Fallback strategy orchestration when primary method fails
   */
  fallbackStrategies: (primaryStrategy: string, error: string) => `
🔄 **FALLBACK STRATEGY ORCHESTRATION**

Primary Strategy Failed: ${primaryStrategy}
Error: ${error}

## 🚨 **IMMEDIATE ASSESSMENT**

1. **Error Classification**:
   \`\`\`bash
   case "${error}" in
     *"permission denied"*) fallback="sudo_operation" ;;
     *"file locked"*) fallback="wait_and_retry" ;;
     *"no space left"*) fallback="disk_cleanup" ;;
     *"syntax error"*) fallback="manual_validation" ;;
     *) fallback="safe_manual_edit" ;;
   esac
   \`\`\`

## 🔧 **FALLBACK EXECUTION HIERARCHY**

### Level 1: Automated Recovery
\`\`\`bash
# Try alternative editing method
if [ "$primary_strategy" = "atomic_write" ]; then
  echo "Falling back to patch-based editing..."
  # Use diff/patch approach
elif [ "$primary_strategy" = "patch_based" ]; then
  echo "Falling back to streaming edit..."
  # Use sed/awk streaming
elif [ "$primary_strategy" = "streaming" ]; then
  echo "Falling back to manual line-by-line..."
  # Process one operation at a time
fi
\`\`\`

### Level 2: System-Level Recovery
\`\`\`bash
# Check system resources
df -h . | grep -E '[0-9]+%' | awk '{print $5}' | sed 's/%//'
free -m | awk 'NR==2{printf "Memory: %.1f%%\\n", $3*100/$2}'

# Attempt system-level fixes
sudo sysctl -w vm.drop_caches=1  # Clear page cache if needed
\`\`\`

### Level 3: Safe Manual Mode
\`\`\`bash
# Interactive verification before each operation
echo "Manual editing mode - verifying each operation:"
for operation in "$OPERATIONS_ARRAY"; do
  echo "About to apply: $operation"
  echo "Continue? (y/n)"
  # Process with user confirmation
done
\`\`\`

Use **websearch** to research specific error patterns and recovery strategies.
Use **memory** to check if this error has been encountered before.
`,

  /**
   * Real-time coordination prompt for complex operations
   */
  realTimeCoordination: (activeOperations: any[]) => `
⚡ **REAL-TIME OPERATION COORDINATION**

Active Operations: ${activeOperations.length}

## 🔄 **OPERATIONAL TRANSFORM ALGORITHM**

Based on Google Docs OT research:

\`\`\`javascript
// Transform operations for concurrent editing
function transformOperations(localOps, remoteOps) {
  let transformedOps = [];
  let positionOffset = 0;
  
  for (let localOp of localOps) {
    for (let remoteOp of remoteOps) {
      if (remoteOp.position <= localOp.position) {
        if (remoteOp.type === 'insert') {
          localOp.position += remoteOp.content.length;
        } else if (remoteOp.type === 'delete') {
          localOp.position -= remoteOp.length;
        }
      }
    }
    transformedOps.push(localOp);
  }
  
  return transformedOps;
}
\`\`\`

## 📊 **CONFLICT RESOLUTION MATRIX**

# Analyze each operation for conflicts
for operation in active_operations; do
  echo "Operation: $operation_type at position $operation_position"
  echo "- Conflicts with: [AUTO-DETECT]"
  echo "- Resolution: [AUTO-RESOLVE]"
  echo "- Priority: $operation_priority"
done

## 🎯 **EXECUTION ORDER OPTIMIZATION**

\`\`\`bash
# Sort operations by position (reverse for deletes, forward for inserts)
# This prevents position shifting issues
operations_sorted=$(echo '$OPERATIONS_JSON' | jq -r 'sort_by(.position)')

# Execute in optimal order
for op in $operations_sorted; do
  echo "Executing: $(echo $op | jq -r '.type') at $(echo $op | jq -r '.position')"
  # Apply operation with position adjustment
done
\`\`\`

Use **ml_code_intelligence** to analyze operation dependencies.
Use **memory** to learn optimal execution patterns.
`,

  /**
   * Performance optimization based on file characteristics
   */
  performanceOptimization: (fileMetrics: any) => `
🚀 **PERFORMANCE-OPTIMIZED EDITING STRATEGY**

File Metrics:
- Size: ${fileMetrics.size} bytes
- Type: ${fileMetrics.type}
- Line Count: ${fileMetrics.lines}
- Complexity: ${fileMetrics.complexity}

## ⚡ **OPTIMIZATION SELECTION**

\`\`\`bash
# Memory-mapped files for large files (research-based)
if [ $FILE_SIZE -gt 52428800 ]; then  # 50MB
  echo "Using memory-mapped file editing"
  # Use mmap() approach for large files
fi

# Rope data structure for text editing (VSCode approach)
if [ "$FILE_TYPE" = "text" ] && [ $LINE_COUNT -gt 10000 ]; then
  echo "Using rope data structure for efficient text editing"
  # Implement rope-based editing
fi

# Streaming for sequential operations
if [ "$operation_pattern" = "sequential" ]; then
  echo "Using streaming operations"
  # Use sed/awk for streaming
fi
\`\`\`

## 🔧 **ALGORITHM OPTIMIZATION**

Based on industry research:
- **Files < 1MB**: Direct manipulation (fastest)
- **Files 1-50MB**: Atomic write with temp files
- **Files > 50MB**: Streaming operations
- **Text files**: Use rope data structure
- **Binary files**: Byte-level operations only

## 📈 **PERFORMANCE MONITORING**

\`\`\`bash
# Real-time performance tracking
start_time=$(date +%s.%N)
memory_before=$(free -m | awk 'NR==2{print $3}')

# Execute optimized operations here

end_time=$(date +%s.%N)
memory_after=$(free -m | awk 'NR==2{print $3}')
duration=$(echo "$end_time - $start_time" | bc)
memory_used=$(echo "$memory_after - $memory_before" | bc)

echo "Performance: $duration s, Memory: $memory_used MB"
\`\`\`

Use **github** to research performance optimizations for this file type.
Use **websearch** for latest performance benchmarking data.
`
};

/**
 * Create dynamic orchestration based on context
 */
export function createDynamicEditingWorkflow(
  filePath: string,
  operations: any[],
  context: any,
  capabilities: string[]
) {
  const hasWebSearch = capabilities.includes('websearch');
  const hasGitHub = capabilities.includes('github');
  const hasMemory = capabilities.includes('memory');
  const hasMLCode = capabilities.includes('ml_code_intelligence');

  return `
🧠 **DYNAMIC SMART EDITING WORKFLOW**

File: ${filePath}
Operations: ${operations.length}
Available MCPs: ${capabilities.join(', ')}

## 🔍 **INTELLIGENT PREPARATION**

${hasWebSearch ? `
1. **Research Optimal Strategies**:
   Use websearch MCP to find:
   - "optimal file editing algorithms ${filePath.split('.').pop()}"
   - "atomic file operations best practices"
   - "file locking strategies production systems"
` : ''}

${hasGitHub ? `
2. **Pattern Discovery**:
   Use github MCP to find:
   - Proven editing patterns for ${filePath.split('.').pop()} files
   - Error handling strategies from popular repositories
   - Performance optimizations used in production
` : ''}

${hasMemory ? `
3. **Historical Analysis**:
   Use memory MCP to:
   - Retrieve previous successful editing operations
   - Learn from past failures and recoveries
   - Apply proven optimization patterns
` : ''}

${hasMLCode ? `
4. **ML-Powered Analysis**:
   Use ml_code_intelligence MCP to:
   - Analyze file complexity and risk factors
   - Predict optimal editing strategy
   - Identify potential conflicts or issues
` : ''}

## ⚡ **ADAPTIVE EXECUTION**

Based on available capabilities, execute the most sophisticated approach:

${capabilities.length > 3 ? 
  'ADVANCED MODE: Use full ML-enhanced workflow with all available intelligence' :
  'STANDARD MODE: Use proven algorithms with available tools'
}

## 🎯 **COORDINATED WORKFLOW**

Execute operations in parallel where possible:
# Analyze operations for parallelization
for i, operation in enumerate(operations):
  parallel_status = "PARALLEL" if operation.parallel else "SEQUENTIAL"
  echo "- Operation $((i + 1)): $operation_type ($parallel_status)"

Remember: Always prioritize safety over speed, but optimize within safety constraints!
`;
}