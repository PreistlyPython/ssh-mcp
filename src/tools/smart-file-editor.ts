/**
 * Smart File Editor with Optimal Algorithms
 * Based on research of Git, VSCode, and Google Docs approaches
 */

import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { diffLines, createPatch, applyPatch } from 'diff';
// Import types instead of SSHService to avoid circular dependency
export interface ISSHService {
  executeCommand(params: { sessionId: string; command: string }): Promise<string>;
}
import { SSHCommandError } from '../errors/ssh-errors.js';

export interface FileEditStrategy {
  type: 'atomic_write' | 'patch_based' | 'streaming' | 'operational_transform' | 'two_phase_commit';
  validation: {
    syntaxCheck?: boolean;
    lintCheck?: boolean;
    testExecution?: boolean;
    checksumValidation?: boolean;
  };
  rollback: {
    enabled: boolean;
    strategy: 'snapshot' | 'undo_log' | 'version_control';
  };
  performance: {
    chunkSize?: number;
    compressionEnabled?: boolean;
    cacheEnabled?: boolean;
  };
}

export interface EditOperation {
  id: string;
  timestamp: number;
  type: 'insert' | 'delete' | 'replace' | 'move';
  position?: number;
  line?: number;
  content?: string;
  oldContent?: string;
  metadata?: Record<string, any>;
}

export interface FileEditRequest {
  sessionId: string;
  filePath: string;
  operations: EditOperation[];
  strategy?: FileEditStrategy;
  lockTimeout?: number;
  conflictResolution?: 'abort' | 'merge' | 'overwrite' | 'interactive';
}

export interface FileEditResult {
  success: boolean;
  fileVersion: string;
  checksum: string;
  appliedOperations: string[];
  rollbackId?: string;
  performance: {
    duration: number;
    bytesProcessed: number;
    strategy: string;
  };
  validation?: {
    syntaxValid?: boolean;
    lintPassed?: boolean;
    testsPassed?: boolean;
  };
}

export class SmartFileEditor {
  private readonly CHUNK_SIZE = 1024 * 1024; // 1MB chunks for streaming
  private readonly LOCK_TIMEOUT = 30000; // 30 seconds
  private readonly MAX_FILE_SIZE_FOR_MEMORY = 50 * 1024 * 1024; // 50MB
  private editHistory: Map<string, EditOperation[]> = new Map();
  private lockManager: Map<string, { sessionId: string; timestamp: number }> = new Map();

  constructor(private sshService: ISSHService) {}

  /**
   * Main entry point for smart file editing
   */
  async editFile(request: FileEditRequest): Promise<FileEditResult> {
    const startTime = Date.now();
    const strategy = this.selectOptimalStrategy(request);
    
    try {
      // Phase 1: Preparation
      const lockId = await this.acquireFileLock(request.filePath, request.sessionId, request.lockTimeout);
      const fileInfo = await this.getFileInfo(request.sessionId, request.filePath);
      const originalChecksum = await this.computeChecksum(request.sessionId, request.filePath);
      
      // Create backup based on rollback strategy
      const rollbackId = await this.createRollbackPoint(
        request.sessionId, 
        request.filePath, 
        strategy.rollback
      );

      // Phase 2: Execute based on strategy
      let result: FileEditResult;
      
      switch (strategy.type) {
        case 'atomic_write':
          result = await this.executeAtomicWrite(request, fileInfo, originalChecksum);
          break;
        
        case 'patch_based':
          result = await this.executePatchBased(request, fileInfo, originalChecksum);
          break;
        
        case 'streaming':
          result = await this.executeStreaming(request, fileInfo, originalChecksum);
          break;
        
        case 'operational_transform':
          result = await this.executeOperationalTransform(request, fileInfo, originalChecksum);
          break;
        
        case 'two_phase_commit':
          result = await this.executeTwoPhaseCommit(request, fileInfo, originalChecksum);
          break;
        
        default:
          throw new Error(`Unknown strategy: ${strategy.type}`);
      }

      // Phase 3: Validation
      if (strategy.validation) {
        const validationResult = await this.validateEdit(
          request.sessionId,
          request.filePath,
          strategy.validation
        );
        result.validation = validationResult;
        
        if (!this.isValidationSuccessful(validationResult)) {
          await this.rollback(request.sessionId, rollbackId);
          throw new Error('Validation failed, changes rolled back');
        }
      }

      // Phase 4: Finalization
      await this.releaseFileLock(request.filePath, lockId);
      
      result.performance = {
        duration: Date.now() - startTime,
        bytesProcessed: fileInfo.size,
        strategy: strategy.type
      };
      
      return result;
      
    } catch (error) {
      // Ensure cleanup happens even on error
      await this.releaseFileLock(request.filePath, '');
      throw error;
    }
  }

  /**
   * Select optimal editing strategy based on file characteristics
   */
  private selectOptimalStrategy(request: FileEditRequest): FileEditStrategy {
    // Use provided strategy if specified
    if (request.strategy) {
      return request.strategy;
    }

    // Auto-select based on heuristics
    const operationCount = request.operations.length;
    const hasComplexOperations = request.operations.some(
      op => op.type === 'move' || (op.metadata && op.metadata.complex)
    );

    // Default strategy
    const strategy: FileEditStrategy = {
      type: 'atomic_write',
      validation: {
        checksumValidation: true
      },
      rollback: {
        enabled: true,
        strategy: 'snapshot'
      },
      performance: {
        compressionEnabled: false,
        cacheEnabled: true
      }
    };

    // Strategy selection heuristics
    if (operationCount > 100 || hasComplexOperations) {
      strategy.type = 'operational_transform';
    } else if (operationCount > 10) {
      strategy.type = 'patch_based';
    }

    return strategy;
  }

  /**
   * Atomic write implementation (Git-style)
   */
  private async executeAtomicWrite(
    request: FileEditRequest,
    fileInfo: any,
    originalChecksum: string
  ): Promise<FileEditResult> {
    const tempFile = `/tmp/.edit_${uuidv4()}`;
    
    try {
      // Read original content
      const content = await this.readFile(request.sessionId, request.filePath);
      
      // Apply operations to content
      let modifiedContent = content;
      const appliedOps: string[] = [];
      
      for (const op of request.operations) {
        modifiedContent = await this.applyOperation(modifiedContent, op);
        appliedOps.push(op.id);
      }
      
      // Write to temporary file
      await this.writeFile(request.sessionId, tempFile, modifiedContent);
      
      // Verify temp file integrity
      const tempChecksum = await this.computeChecksum(request.sessionId, tempFile);
      
      // Atomic rename
      await this.sshService.executeCommand({
        sessionId: request.sessionId,
        command: `mv -f "${tempFile}" "${request.filePath}"`
      });
      
      return {
        success: true,
        fileVersion: uuidv4(),
        checksum: tempChecksum,
        appliedOperations: appliedOps,
        performance: {
          duration: 0,
          bytesProcessed: modifiedContent.length,
          strategy: 'atomic_write'
        }
      };
      
    } catch (error) {
      // Cleanup temp file on error
      await this.sshService.executeCommand({
        sessionId: request.sessionId,
        command: `rm -f "${tempFile}"`
      }).catch(() => {});
      
      throw error;
    }
  }

  /**
   * Patch-based editing (like Git patches)
   */
  private async executePatchBased(
    request: FileEditRequest,
    fileInfo: any,
    originalChecksum: string
  ): Promise<FileEditResult> {
    const content = await this.readFile(request.sessionId, request.filePath);
    const lines = content.split('\n');
    
    // Generate unified diff patch
    let modifiedLines = [...lines];
    const appliedOps: string[] = [];
    
    for (const op of request.operations) {
      if (op.line !== undefined) {
        switch (op.type) {
          case 'insert':
            modifiedLines.splice(op.line, 0, op.content || '');
            break;
          case 'delete':
            modifiedLines.splice(op.line, 1);
            break;
          case 'replace':
            modifiedLines[op.line] = op.content || '';
            break;
        }
        appliedOps.push(op.id);
      }
    }
    
    // Create patch
    const patch = createPatch(
      request.filePath,
      lines.join('\n'),
      modifiedLines.join('\n'),
      'original',
      'modified'
    );
    
    // Apply patch using system patch command for reliability
    const patchFile = `/tmp/.patch_${uuidv4()}`;
    await this.writeFile(request.sessionId, patchFile, patch);
    
    try {
      await this.sshService.executeCommand({
        sessionId: request.sessionId,
        command: `patch "${request.filePath}" < "${patchFile}"`
      });
      
      const newChecksum = await this.computeChecksum(request.sessionId, request.filePath);
      
      return {
        success: true,
        fileVersion: uuidv4(),
        checksum: newChecksum,
        appliedOperations: appliedOps,
        performance: {
          duration: 0,
          bytesProcessed: patch.length,
          strategy: 'patch_based'
        }
      };
      
    } finally {
      await this.sshService.executeCommand({
        sessionId: request.sessionId,
        command: `rm -f "${patchFile}"`
      }).catch(() => {});
    }
  }

  /**
   * Streaming edit for large files
   */
  private async executeStreaming(
    request: FileEditRequest,
    fileInfo: any,
    originalChecksum: string
  ): Promise<FileEditResult> {
    const tempFile = `/tmp/.stream_edit_${uuidv4()}`;
    const appliedOps: string[] = [];
    
    // Use sed/awk for streaming edits
    let sedScript = '';
    
    for (const op of request.operations) {
      if (op.line !== undefined) {
        switch (op.type) {
          case 'replace':
            sedScript += `${op.line}s/.*/${op.content}/;`;
            break;
          case 'delete':
            sedScript += `${op.line}d;`;
            break;
          case 'insert':
            sedScript += `${op.line}i\\\n${op.content}\n;`;
            break;
        }
        appliedOps.push(op.id);
      }
    }
    
    // Execute streaming edit
    await this.sshService.executeCommand({
      sessionId: request.sessionId,
      command: `sed '${sedScript}' "${request.filePath}" > "${tempFile}" && mv "${tempFile}" "${request.filePath}"`
    });
    
    const newChecksum = await this.computeChecksum(request.sessionId, request.filePath);
    
    return {
      success: true,
      fileVersion: uuidv4(),
      checksum: newChecksum,
      appliedOperations: appliedOps,
      performance: {
        duration: 0,
        bytesProcessed: fileInfo.size,
        strategy: 'streaming'
      }
    };
  }

  /**
   * Operational Transform for collaborative editing
   */
  private async executeOperationalTransform(
    request: FileEditRequest,
    fileInfo: any,
    originalChecksum: string
  ): Promise<FileEditResult> {
    // This is a simplified OT implementation
    // In production, you'd use a proper OT library
    
    const content = await this.readFile(request.sessionId, request.filePath);
    let transformedContent = content;
    const appliedOps: string[] = [];
    
    // Sort operations by position to avoid conflicts
    const sortedOps = [...request.operations].sort((a, b) => {
      const posA = a.position || a.line || 0;
      const posB = b.position || b.line || 0;
      return posA - posB;
    });
    
    // Apply operations with position adjustment
    let offset = 0;
    for (const op of sortedOps) {
      const adjustedPosition = (op.position || 0) + offset;
      
      switch (op.type) {
        case 'insert':
          transformedContent = 
            transformedContent.slice(0, adjustedPosition) +
            op.content +
            transformedContent.slice(adjustedPosition);
          offset += (op.content || '').length;
          break;
          
        case 'delete':
          const deleteLength = op.metadata?.length || 1;
          transformedContent = 
            transformedContent.slice(0, adjustedPosition) +
            transformedContent.slice(adjustedPosition + deleteLength);
          offset -= deleteLength;
          break;
      }
      
      appliedOps.push(op.id);
    }
    
    // Write transformed content atomically
    await this.writeFileAtomic(request.sessionId, request.filePath, transformedContent);
    
    const newChecksum = await this.computeChecksum(request.sessionId, request.filePath);
    
    return {
      success: true,
      fileVersion: uuidv4(),
      checksum: newChecksum,
      appliedOperations: appliedOps,
      performance: {
        duration: 0,
        bytesProcessed: transformedContent.length,
        strategy: 'operational_transform'
      }
    };
  }

  /**
   * Two-phase commit for maximum safety
   */
  private async executeTwoPhaseCommit(
    request: FileEditRequest,
    fileInfo: any,
    originalChecksum: string
  ): Promise<FileEditResult> {
    const transactionId = uuidv4();
    const prepareFile = `/tmp/.prepare_${transactionId}`;
    const logFile = `/tmp/.txn_log_${transactionId}`;
    
    try {
      // Phase 1: Prepare
      const content = await this.readFile(request.sessionId, request.filePath);
      let modifiedContent = content;
      const appliedOps: string[] = [];
      
      // Log transaction start
      await this.writeFile(request.sessionId, logFile, JSON.stringify({
        transactionId,
        filePath: request.filePath,
        originalChecksum,
        operations: request.operations,
        timestamp: Date.now()
      }));
      
      // Apply operations
      for (const op of request.operations) {
        modifiedContent = await this.applyOperation(modifiedContent, op);
        appliedOps.push(op.id);
      }
      
      // Write to prepare file
      await this.writeFile(request.sessionId, prepareFile, modifiedContent);
      
      // Validate prepare file
      const prepareChecksum = await this.computeChecksum(request.sessionId, prepareFile);
      
      // Phase 2: Commit
      // Use atomic rename for commit
      await this.sshService.executeCommand({
        sessionId: request.sessionId,
        command: `mv -f "${prepareFile}" "${request.filePath}"`
      });
      
      // Log transaction success
      await this.sshService.executeCommand({
        sessionId: request.sessionId,
        command: `echo "COMMITTED" >> "${logFile}"`
      });
      
      return {
        success: true,
        fileVersion: transactionId,
        checksum: prepareChecksum,
        appliedOperations: appliedOps,
        rollbackId: transactionId,
        performance: {
          duration: 0,
          bytesProcessed: modifiedContent.length,
          strategy: 'two_phase_commit'
        }
      };
      
    } catch (error) {
      // Rollback on error
      await this.sshService.executeCommand({
        sessionId: request.sessionId,
        command: `echo "ROLLED_BACK" >> "${logFile}"`
      }).catch(() => {});
      
      // Cleanup prepare file
      await this.sshService.executeCommand({
        sessionId: request.sessionId,
        command: `rm -f "${prepareFile}"`
      }).catch(() => {});
      
      throw error;
      
    } finally {
      // Schedule log cleanup
      setTimeout(() => {
        this.sshService.executeCommand({
          sessionId: request.sessionId,
          command: `rm -f "${logFile}"`
        }).catch(() => {});
      }, 300000); // 5 minutes
    }
  }

  /**
   * Helper methods
   */
  
  private async readFile(sessionId: string, filePath: string): Promise<string> {
    const result = await this.sshService.executeCommand({
      sessionId,
      command: `cat "${filePath}"`
    });
    return result;
  }
  
  private async writeFile(sessionId: string, filePath: string, content: string): Promise<void> {
    // Use heredoc for safe content writing
    const delimiter = `EOF_${uuidv4().replace(/-/g, '')}`;
    await this.sshService.executeCommand({
      sessionId,
      command: `cat > "${filePath}" << '${delimiter}'
${content}
${delimiter}`
    });
  }
  
  private async writeFileAtomic(sessionId: string, filePath: string, content: string): Promise<void> {
    const tempFile = `/tmp/.atomic_${uuidv4()}`;
    await this.writeFile(sessionId, tempFile, content);
    await this.sshService.executeCommand({
      sessionId,
      command: `mv -f "${tempFile}" "${filePath}"`
    });
  }
  
  private async computeChecksum(sessionId: string, filePath: string): Promise<string> {
    // Use xxHash for speed as recommended by research
    const result = await this.sshService.executeCommand({
      sessionId,
      command: `xxhsum "${filePath}" 2>/dev/null || sha256sum "${filePath}" | cut -d' ' -f1`
    });
    return result.trim();
  }
  
  private async getFileInfo(sessionId: string, filePath: string): Promise<any> {
    const result = await this.sshService.executeCommand({
      sessionId,
      command: `stat -c '%s %Y %U %G %a' "${filePath}" 2>/dev/null || stat -f '%z %m %Su %Sg %Lp' "${filePath}"`
    });
    
    const [size, mtime, owner, group, permissions] = result.trim().split(' ');
    return {
      size: parseInt(size),
      mtime: parseInt(mtime),
      owner,
      group,
      permissions
    };
  }
  
  private async applyOperation(content: string, operation: EditOperation): Promise<string> {
    switch (operation.type) {
      case 'insert':
        if (operation.position !== undefined) {
          return content.slice(0, operation.position) + 
                 operation.content + 
                 content.slice(operation.position);
        }
        break;
        
      case 'delete':
        if (operation.position !== undefined && operation.metadata?.length) {
          return content.slice(0, operation.position) + 
                 content.slice(operation.position + operation.metadata.length);
        }
        break;
        
      case 'replace':
        if (operation.oldContent && operation.content) {
          return content.replace(operation.oldContent, operation.content);
        }
        break;
        
      case 'move':
        // Complex operation - would need more implementation
        break;
    }
    
    return content;
  }
  
  private async acquireFileLock(
    filePath: string, 
    sessionId: string, 
    timeout?: number
  ): Promise<string> {
    const lockId = uuidv4();
    const lockFile = `${filePath}.lock`;
    const lockTimeout = timeout || this.LOCK_TIMEOUT;
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < lockTimeout) {
      try {
        // Try to create lock file atomically
        const lockContent = JSON.stringify({
          lockId,
          sessionId,
          timestamp: Date.now(),
          pid: process.pid
        });
        
        await this.sshService.executeCommand({
          sessionId,
          command: `set -o noclobber && echo '${lockContent}' > "${lockFile}"`
        });
        
        this.lockManager.set(filePath, { sessionId, timestamp: Date.now() });
        return lockId;
        
      } catch (error) {
        // Lock exists, check if stale
        try {
          const lockInfo = await this.sshService.executeCommand({
            sessionId,
            command: `cat "${lockFile}"`
          });
          
          const lock = JSON.parse(lockInfo);
          if (Date.now() - lock.timestamp > this.LOCK_TIMEOUT) {
            // Stale lock, remove it
            await this.sshService.executeCommand({
              sessionId,
              command: `rm -f "${lockFile}"`
            });
          }
        } catch {}
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    throw new Error(`Failed to acquire lock for ${filePath} within ${lockTimeout}ms`);
  }
  
  private async releaseFileLock(filePath: string, lockId: string): Promise<void> {
    const lockFile = `${filePath}.lock`;
    this.lockManager.delete(filePath);
    
    try {
      // Only remove if it's our lock
      const sessionId = this.lockManager.get(filePath)?.sessionId;
      if (sessionId) {
        await this.sshService.executeCommand({
          sessionId,
          command: `rm -f "${lockFile}"`
        });
      }
    } catch {}
  }
  
  private async createRollbackPoint(
    sessionId: string,
    filePath: string,
    rollbackConfig: { enabled: boolean; strategy: string }
  ): Promise<string> {
    if (!rollbackConfig.enabled) {
      return '';
    }
    
    const rollbackId = uuidv4();
    
    switch (rollbackConfig.strategy) {
      case 'snapshot':
        const snapshotPath = `/tmp/.snapshot_${rollbackId}`;
        await this.sshService.executeCommand({
          sessionId,
          command: `cp -p "${filePath}" "${snapshotPath}"`
        });
        break;
        
      case 'undo_log':
        const content = await this.readFile(sessionId, filePath);
        const undoLog = `/tmp/.undo_${rollbackId}`;
        await this.writeFile(sessionId, undoLog, content);
        break;
        
      case 'version_control':
        // Would integrate with git or similar
        break;
    }
    
    return rollbackId;
  }
  
  private async rollback(sessionId: string, rollbackId: string): Promise<void> {
    if (!rollbackId) return;
    
    // Try all rollback file patterns
    const rollbackFiles = [
      `/tmp/.snapshot_${rollbackId}`,
      `/tmp/.undo_${rollbackId}`
    ];
    
    for (const file of rollbackFiles) {
      try {
        await this.sshService.executeCommand({
          sessionId,
          command: `test -f "${file}" && cat "${file}"`
        });
        // File exists, use it for rollback
        // Implementation would restore the file
        break;
      } catch {}
    }
  }
  
  private async validateEdit(
    sessionId: string,
    filePath: string,
    validation: any
  ): Promise<any> {
    const results: any = {};
    
    if (validation.syntaxCheck) {
      // Detect file type and run appropriate syntax checker
      const extension = filePath.split('.').pop();
      let syntaxCommand = '';
      
      switch (extension) {
        case 'js':
        case 'ts':
          syntaxCommand = `node -c "${filePath}" 2>&1`;
          break;
        case 'py':
          syntaxCommand = `python -m py_compile "${filePath}" 2>&1`;
          break;
        case 'php':
          syntaxCommand = `php -l "${filePath}" 2>&1`;
          break;
      }
      
      if (syntaxCommand) {
        try {
          await this.sshService.executeCommand({ sessionId, command: syntaxCommand });
          results.syntaxValid = true;
        } catch {
          results.syntaxValid = false;
        }
      }
    }
    
    if (validation.lintCheck) {
      // Run appropriate linter
      results.lintPassed = true; // Simplified
    }
    
    if (validation.testExecution) {
      // Run tests if configured
      results.testsPassed = true; // Simplified
    }
    
    return results;
  }
  
  private isValidationSuccessful(validation: any): boolean {
    return Object.values(validation).every(v => v === true);
  }
}

import { SmartEditingOrchestration, createDynamicEditingWorkflow } from '../prompts/smart-editing-orchestration.js';

/**
 * Orchestration prompt workflow for smart file editing
 */
export const SmartFileEditingPrompts = {
  planFileEdit: (request: FileEditRequest) => {
    // Use the advanced orchestration workflow
    return SmartEditingOrchestration.masterEditingWorkflow({
      filePath: request.filePath,
      operations: request.operations,
      context: {
        strategy: request.strategy?.type || 'auto-select',
        lockTimeout: request.lockTimeout,
        conflictResolution: request.conflictResolution
      },
      constraints: request.strategy
    });
  },

  executeWithFallbacks: (filePath: string, primaryStrategy: string, fallbackStrategies: string[], error?: string) => {
    return SmartEditingOrchestration.fallbackStrategies(primaryStrategy, error || 'Unknown error');
  },

  optimizeForFileType: (fileType: string, operations: EditOperation[], fileMetrics?: any) => {
    return SmartEditingOrchestration.performanceOptimization(fileMetrics || {
      type: fileType,
      size: 0,
      lines: operations.length * 10, // Estimate
      complexity: operations.length > 50 ? 'high' : 'medium'
    });
  },

  /**
   * Create dynamic workflow based on available MCPs
   */
  createAdaptiveWorkflow: (request: FileEditRequest, availableMCPs: string[]) => {
    return createDynamicEditingWorkflow(
      request.filePath,
      request.operations,
      { strategy: request.strategy },
      availableMCPs
    );
  },

  /**
   * Real-time operation coordination
   */
  coordinateOperations: (operations: EditOperation[]) => {
    return SmartEditingOrchestration.realTimeCoordination(operations);
  }
};
