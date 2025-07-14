/**
 * Memory Orchestration System for SSH MCP Server
 * Provides persistent learning across sessions with intelligent context management
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { join } from 'path';
import { AuditLogger, AuditEventType } from '../audit/audit-logger.js';
import { TechnologyStack } from '../ai/context7-integration.js';

export enum MemoryEventType {
  PATTERN_LEARNED = 'pattern_learned',
  CONTEXT_UPDATED = 'context_updated',
  PREFERENCE_SAVED = 'preference_saved',
  MEMORY_CONSOLIDATED = 'memory_consolidated',
  LEARNING_INSIGHT = 'learning_insight'
}

export enum CommandCategory {
  NAVIGATION = 'navigation',
  FILE_OPERATIONS = 'file_operations',
  DEVELOPMENT = 'development',
  DEPLOYMENT = 'deployment',
  MONITORING = 'monitoring',
  SECURITY = 'security',
  SYSTEM = 'system',
  GIT = 'git',
  DOCKER = 'docker',
  DATABASE = 'database'
}

export interface MemoryConfig {
  persistenceEnabled: boolean;
  dataDirectory: string;
  learningEnabled: boolean;
  patternDetectionEnabled: boolean;
  contextAwarenessEnabled: boolean;
  maxMemoryEntries: number;
  consolidationInterval: number; // milliseconds
  learningDecayRate: number; // 0-1, how quickly unused patterns decay
  confidenceThreshold: number; // 0-1, minimum confidence for suggestions
  maxContextAge: number; // milliseconds, how long context remains valid
  enablePersonalization: boolean;
  enableProjectContext: boolean;
  enableCrossSessionLearning: boolean;
}

export interface CommandMemory {
  id: string;
  sessionId: string;
  userId: string;
  command: string;
  category: CommandCategory;
  timestamp: Date;
  context: {
    directory: string;
    projectType?: string;
    technology?: TechnologyStack;
    previousCommand?: string;
    outcome: 'success' | 'failure' | 'partial';
    executionTime: number;
    errorMessage?: string;
  };
  metadata: {
    frequency: number;
    lastUsed: Date;
    confidence: number;
    effectiveness: number; // 0-1, how effective this command was
    userRating?: number; // 0-5, user feedback
  };
}

export interface CommandPattern {
  id: string;
  pattern: string;
  category: CommandCategory;
  technology?: TechnologyStack;
  frequency: number;
  confidence: number;
  effectiveness: number;
  conditions: {
    directory?: string;
    projectType?: string;
    previousCommands?: string[];
    timeOfDay?: string;
    dayOfWeek?: string;
  };
  suggestions: string[];
  examples: string[];
  warnings?: string[];
  relatedPatterns: string[];
  createdAt: Date;
  lastUsed: Date;
  usageCount: number;
}

export interface UserPreference {
  userId: string;
  category: string;
  preference: string;
  value: any;
  confidence: number;
  learnedAt: Date;
  lastConfirmed: Date;
  frequency: number;
}

export interface ProjectContext {
  id: string;
  sessionId: string;
  projectPath: string;
  technology: TechnologyStack;
  frameworks: string[];
  dependencies: string[];
  commonCommands: string[];
  workflowPatterns: string[];
  lastAnalyzed: Date;
  confidence: number;
  metadata: {
    files: string[];
    directories: string[];
    configFiles: string[];
    buildTools: string[];
    testing: string[];
    deployment: string[];
  };
}

export interface LearningInsight {
  id: string;
  type: 'pattern' | 'efficiency' | 'error' | 'suggestion';
  insight: string;
  confidence: number;
  actionable: boolean;
  suggestion?: string;
  impact: 'low' | 'medium' | 'high';
  category: CommandCategory;
  evidence: {
    frequency: number;
    successRate: number;
    timesSeen: number;
    contexts: string[];
  };
  createdAt: Date;
}

export interface MemoryStatistics {
  totalMemories: number;
  activePatterns: number;
  userPreferences: number;
  projectContexts: number;
  learningInsights: number;
  averageCommandFrequency: number;
  mostUsedCommands: string[];
  topPatterns: CommandPattern[];
  recentInsights: LearningInsight[];
  memoryEfficiency: number;
  consolidationLastRun: Date;
  learningAccuracy: number;
}

/**
 * Memory Orchestration system for intelligent context management and learning
 */
export class MemoryOrchestrator extends EventEmitter {
  private config: MemoryConfig;
  private auditLogger: AuditLogger;
  private commandMemories = new Map<string, CommandMemory>();
  private commandPatterns = new Map<string, CommandPattern>();
  private userPreferences = new Map<string, UserPreference>();
  private projectContexts = new Map<string, ProjectContext>();
  private learningInsights = new Map<string, LearningInsight>();
  private consolidationTimer?: NodeJS.Timeout;
  private learningTimer?: NodeJS.Timeout;

  constructor(config: Partial<MemoryConfig> = {}, auditLogger?: AuditLogger) {
    super();
    
    this.config = {
      persistenceEnabled: process.env.SSH_MEMORY_PERSISTENCE !== 'false',
      dataDirectory: process.env.SSH_MEMORY_DATA_DIR || './data/memory',
      learningEnabled: process.env.SSH_MEMORY_LEARNING !== 'false',
      patternDetectionEnabled: process.env.SSH_MEMORY_PATTERN_DETECTION !== 'false',
      contextAwarenessEnabled: process.env.SSH_MEMORY_CONTEXT_AWARENESS !== 'false',
      maxMemoryEntries: parseInt(process.env.SSH_MEMORY_MAX_ENTRIES || '10000'),
      consolidationInterval: parseInt(process.env.SSH_MEMORY_CONSOLIDATION_INTERVAL || '3600000'), // 1 hour
      learningDecayRate: parseFloat(process.env.SSH_MEMORY_DECAY_RATE || '0.1'),
      confidenceThreshold: parseFloat(process.env.SSH_MEMORY_CONFIDENCE_THRESHOLD || '0.7'),
      maxContextAge: parseInt(process.env.SSH_MEMORY_MAX_CONTEXT_AGE || '86400000'), // 24 hours
      enablePersonalization: process.env.SSH_MEMORY_PERSONALIZATION !== 'false',
      enableProjectContext: process.env.SSH_MEMORY_PROJECT_CONTEXT !== 'false',
      enableCrossSessionLearning: process.env.SSH_MEMORY_CROSS_SESSION_LEARNING !== 'false',
      ...config
    };

    this.auditLogger = auditLogger || new AuditLogger();
    
    // Initialize memory system
    this.initialize();
  }

  /**
   * Record a command execution in memory
   */
  async recordCommand(
    sessionId: string,
    userId: string,
    command: string,
    context: {
      directory: string;
      projectType?: string;
      technology?: TechnologyStack;
      previousCommand?: string;
      outcome: 'success' | 'failure' | 'partial';
      executionTime: number;
      errorMessage?: string;
    }
  ): Promise<void> {
    const commandMemory: CommandMemory = {
      id: this.generateId(),
      sessionId,
      userId,
      command,
      category: this.categorizeCommand(command),
      timestamp: new Date(),
      context,
      metadata: {
        frequency: 1,
        lastUsed: new Date(),
        confidence: 0.5,
        effectiveness: context.outcome === 'success' ? 1.0 : 0.0,
      }
    };

    // Check if similar command exists
    const existingMemory = this.findSimilarCommand(command, userId);
    if (existingMemory) {
      existingMemory.metadata.frequency++;
      existingMemory.metadata.lastUsed = new Date();
      existingMemory.metadata.effectiveness = this.calculateEffectiveness(
        existingMemory.metadata.effectiveness,
        commandMemory.metadata.effectiveness
      );
    } else {
      this.commandMemories.set(commandMemory.id, commandMemory);
    }

    // Update patterns if learning is enabled
    if (this.config.learningEnabled) {
      await this.updatePatterns(commandMemory);
    }

    // Update project context if enabled
    if (this.config.enableProjectContext) {
      await this.updateProjectContext(sessionId, context);
    }

    // Emit event
    this.emit(MemoryEventType.CONTEXT_UPDATED, { commandMemory });

    // Log to audit
    await this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
      sessionId,
      userId,
      description: `Command recorded in memory: ${command}`,
      outcome: 'success',
      eventDetails: {
        command,
        category: commandMemory.category,
        outcome: context.outcome,
        executionTime: context.executionTime
      }
    });
  }

  /**
   * Get intelligent command suggestions based on context
   */
  async getCommandSuggestions(
    userId: string,
    currentContext: {
      directory: string;
      projectType?: string;
      technology?: TechnologyStack;
      previousCommand?: string;
    }
  ): Promise<{
    suggestions: string[];
    patterns: CommandPattern[];
    insights: LearningInsight[];
    confidence: number;
  }> {
    const suggestions: string[] = [];
    const relevantPatterns: CommandPattern[] = [];
    const relevantInsights: LearningInsight[] = [];

    // Get pattern-based suggestions
    for (const pattern of this.commandPatterns.values()) {
      if (this.isPatternRelevant(pattern, currentContext, userId)) {
        relevantPatterns.push(pattern);
        suggestions.push(...pattern.suggestions);
      }
    }

    // Get memory-based suggestions
    const userCommands = Array.from(this.commandMemories.values())
      .filter(memory => memory.userId === userId)
      .sort((a, b) => b.metadata.frequency - a.metadata.frequency);

    for (const memory of userCommands.slice(0, 5)) {
      if (this.isMemoryRelevant(memory, currentContext)) {
        suggestions.push(memory.command);
      }
    }

    // Get relevant insights
    for (const insight of this.learningInsights.values()) {
      if (insight.actionable && insight.confidence >= this.config.confidenceThreshold) {
        relevantInsights.push(insight);
      }
    }

    // Calculate overall confidence
    const confidence = this.calculateSuggestionConfidence(relevantPatterns, userCommands);

    return {
      suggestions: [...new Set(suggestions)].slice(0, 10), // Remove duplicates, limit to 10
      patterns: relevantPatterns.slice(0, 5),
      insights: relevantInsights.slice(0, 3),
      confidence
    };
  }

  /**
   * Update user preferences based on behavior
   */
  async updateUserPreference(
    userId: string,
    category: string,
    preference: string,
    value: any,
    confidence: number = 0.8
  ): Promise<void> {
    const key = `${userId}:${category}:${preference}`;
    const existing = this.userPreferences.get(key);

    if (existing) {
      existing.value = value;
      existing.confidence = Math.max(existing.confidence, confidence);
      existing.lastConfirmed = new Date();
      existing.frequency++;
    } else {
      const newPreference: UserPreference = {
        userId,
        category,
        preference,
        value,
        confidence,
        learnedAt: new Date(),
        lastConfirmed: new Date(),
        frequency: 1
      };
      this.userPreferences.set(key, newPreference);
    }

    this.emit(MemoryEventType.PREFERENCE_SAVED, { userId, category, preference, value });
  }

  /**
   * Get project context for intelligent assistance
   */
  async getProjectContext(sessionId: string): Promise<ProjectContext | null> {
    return this.projectContexts.get(sessionId) || null;
  }

  /**
   * Generate learning insights from accumulated data
   */
  async generateLearningInsights(userId?: string): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = [];
    const userCommands = userId ? 
      Array.from(this.commandMemories.values()).filter(m => m.userId === userId) :
      Array.from(this.commandMemories.values());

    // Analyze command patterns
    const commandFrequency = new Map<string, number>();
    const commandSuccess = new Map<string, { total: number; success: number }>();

    for (const memory of userCommands) {
      const cmd = memory.command;
      commandFrequency.set(cmd, (commandFrequency.get(cmd) || 0) + 1);
      
      const stats = commandSuccess.get(cmd) || { total: 0, success: 0 };
      stats.total++;
      if (memory.context.outcome === 'success') stats.success++;
      commandSuccess.set(cmd, stats);
    }

    // Generate efficiency insights
    for (const [command, stats] of commandSuccess) {
      const successRate = stats.success / stats.total;
      const frequency = commandFrequency.get(command) || 0;
      
      if (frequency > 5 && successRate < 0.7) {
        insights.push({
          id: this.generateId(),
          type: 'efficiency',
          insight: `Command "${command}" has a low success rate (${(successRate * 100).toFixed(1)}%) but is used frequently`,
          confidence: 0.8,
          actionable: true,
          suggestion: `Consider reviewing the usage of "${command}" or checking for common errors`,
          impact: 'medium',
          category: this.categorizeCommand(command),
          evidence: {
            frequency,
            successRate,
            timesSeen: stats.total,
            contexts: []
          },
          createdAt: new Date()
        });
      }
    }

    // Generate pattern insights
    for (const pattern of this.commandPatterns.values()) {
      if (pattern.confidence > 0.8 && pattern.frequency > 10) {
        insights.push({
          id: this.generateId(),
          type: 'pattern',
          insight: `Detected strong pattern: ${pattern.pattern}`,
          confidence: pattern.confidence,
          actionable: true,
          suggestion: `Consider creating a shortcut or alias for this pattern`,
          impact: 'high',
          category: pattern.category,
          evidence: {
            frequency: pattern.frequency,
            successRate: pattern.effectiveness,
            timesSeen: pattern.usageCount,
            contexts: []
          },
          createdAt: new Date()
        });
      }
    }

    // Store insights
    insights.forEach(insight => {
      this.learningInsights.set(insight.id, insight);
    });

    this.emit(MemoryEventType.LEARNING_INSIGHT, { insights, userId });

    return insights;
  }

  /**
   * Get comprehensive memory statistics
   */
  getStatistics(): MemoryStatistics {
    const totalMemories = this.commandMemories.size;
    const activePatterns = Array.from(this.commandPatterns.values())
      .filter(p => p.confidence >= this.config.confidenceThreshold).length;
    
    const commandFrequencies = new Map<string, number>();
    let totalFrequency = 0;
    
    for (const memory of this.commandMemories.values()) {
      const freq = memory.metadata.frequency;
      commandFrequencies.set(memory.command, 
        (commandFrequencies.get(memory.command) || 0) + freq);
      totalFrequency += freq;
    }

    const mostUsedCommands = Array.from(commandFrequencies.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([cmd]) => cmd);

    const topPatterns = Array.from(this.commandPatterns.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);

    const recentInsights = Array.from(this.learningInsights.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5);

    return {
      totalMemories,
      activePatterns,
      userPreferences: this.userPreferences.size,
      projectContexts: this.projectContexts.size,
      learningInsights: this.learningInsights.size,
      averageCommandFrequency: totalFrequency / totalMemories || 0,
      mostUsedCommands,
      topPatterns,
      recentInsights,
      memoryEfficiency: this.calculateMemoryEfficiency(),
      consolidationLastRun: new Date(), // Would track actual consolidation
      learningAccuracy: this.calculateLearningAccuracy()
    };
  }

  /**
   * Consolidate memory data (cleanup, optimize, persist)
   */
  async consolidateMemory(): Promise<void> {
    const startTime = Date.now();
    
    // Clean up old memories
    await this.cleanupOldMemories();
    
    // Decay unused patterns
    await this.decayUnusedPatterns();
    
    // Optimize memory usage
    await this.optimizeMemory();
    
    // Persist to disk if enabled
    if (this.config.persistenceEnabled) {
      await this.persistMemory();
    }
    
    this.emit(MemoryEventType.MEMORY_CONSOLIDATED, {
      duration: Date.now() - startTime,
      memoriesProcessed: this.commandMemories.size,
      patternsProcessed: this.commandPatterns.size
    });

    await this.auditLogger.logEvent(AuditEventType.SSH_COMMAND_EXECUTED, {
      description: 'Memory consolidation completed',
      outcome: 'success',
      eventDetails: {
        duration: Date.now() - startTime,
        memoriesProcessed: this.commandMemories.size,
        patternsProcessed: this.commandPatterns.size
      }
    });
  }

  /**
   * Store workflow pattern for learning
   */
  async storeWorkflowPattern(
    sessionId: string,
    workflowType: string,
    data: any
  ): Promise<void> {
    // Store the workflow pattern as a special type of command memory
    await this.recordCommand(
      sessionId,
      data.userId || 'system', // default user for workflow patterns
      `workflow:${workflowType}`,
      {
        directory: data.projectPath || data.applicationSpec?.projectPath || '/',
        projectType: workflowType,
        technology: data.technology || data.applicationSpec?.technology || 'unknown',
        outcome: 'success',
        executionTime: data.executionTime || 0
      }
    );
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    // Clear timers
    if (this.consolidationTimer) {
      clearInterval(this.consolidationTimer);
    }
    if (this.learningTimer) {
      clearInterval(this.learningTimer);
    }
    
    // Final consolidation
    await this.consolidateMemory();
    
    console.log('Memory orchestrator shutdown complete');
  }

  // Private methods

  private async initialize(): Promise<void> {
    // Create data directory if needed
    if (this.config.persistenceEnabled) {
      await this.ensureDataDirectory();
      await this.loadPersistedMemory();
    }

    // Start consolidation timer
    this.consolidationTimer = setInterval(
      () => this.consolidateMemory(),
      this.config.consolidationInterval
    );

    // Start learning timer
    if (this.config.learningEnabled) {
      this.learningTimer = setInterval(
        () => this.generateLearningInsights(),
        this.config.consolidationInterval * 2
      );
    }
  }

  private categorizeCommand(command: string): CommandCategory {
    const cmd = command.toLowerCase().trim();
    
    if (cmd.match(/^(cd|ls|pwd|find|locate)/)) return CommandCategory.NAVIGATION;
    if (cmd.match(/^(cp|mv|rm|mkdir|touch|chmod|chown)/)) return CommandCategory.FILE_OPERATIONS;
    if (cmd.match(/^(npm|yarn|pip|composer|mvn|gradle|make)/)) return CommandCategory.DEVELOPMENT;
    if (cmd.match(/^(docker|kubectl|helm|terraform)/)) return CommandCategory.DEPLOYMENT;
    if (cmd.match(/^(ps|top|htop|netstat|ss|lsof)/)) return CommandCategory.MONITORING;
    if (cmd.match(/^(sudo|su|passwd|ssh|scp|rsync)/)) return CommandCategory.SECURITY;
    if (cmd.match(/^(git|svn|hg)/)) return CommandCategory.GIT;
    if (cmd.match(/^(mysql|psql|mongo|redis)/)) return CommandCategory.DATABASE;
    if (cmd.match(/^(systemctl|service|crontab|kill)/)) return CommandCategory.SYSTEM;
    
    return CommandCategory.SYSTEM;
  }

  private findSimilarCommand(command: string, userId: string): CommandMemory | null {
    for (const memory of this.commandMemories.values()) {
      if (memory.userId === userId && memory.command === command) {
        return memory;
      }
    }
    return null;
  }

  private calculateEffectiveness(current: number, new_value: number): number {
    return (current * 0.8) + (new_value * 0.2); // Weighted average
  }

  private async updatePatterns(memory: CommandMemory): Promise<void> {
    if (!this.config.patternDetectionEnabled) return;

    // Simple pattern detection - in reality this would be more sophisticated
    const pattern = this.extractPattern(memory.command);
    if (pattern) {
      const existingPattern = this.commandPatterns.get(pattern);
      if (existingPattern) {
        existingPattern.frequency++;
        existingPattern.lastUsed = new Date();
        existingPattern.confidence = Math.min(existingPattern.confidence + 0.1, 1.0);
      } else {
        const newPattern: CommandPattern = {
          id: this.generateId(),
          pattern,
          category: memory.category,
          technology: memory.context.technology,
          frequency: 1,
          confidence: 0.5,
          effectiveness: memory.metadata.effectiveness,
          conditions: {
            directory: memory.context.directory,
            projectType: memory.context.projectType
          },
          suggestions: [memory.command],
          examples: [memory.command],
          relatedPatterns: [],
          createdAt: new Date(),
          lastUsed: new Date(),
          usageCount: 1
        };
        this.commandPatterns.set(pattern, newPattern);
      }
    }
  }

  private extractPattern(command: string): string | null {
    // Simple pattern extraction - could be enhanced with ML
    const patterns = [
      /^(npm|yarn)\s+install/,
      /^git\s+(add|commit|push|pull)/,
      /^docker\s+(build|run|ps)/,
      /^(ls|ll)\s+(-[a-zA-Z]+)?/,
      /^cd\s+/,
      /^mkdir\s+/,
      /^rm\s+(-[a-zA-Z]+)?\s+/
    ];

    for (const pattern of patterns) {
      const match = command.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  private async updateProjectContext(sessionId: string, context: any): Promise<void> {
    const existing = this.projectContexts.get(sessionId);
    if (existing) {
      existing.lastAnalyzed = new Date();
      if (context.technology) {
        existing.technology = context.technology;
      }
    } else if (context.technology) {
      const newContext: ProjectContext = {
        id: this.generateId(),
        sessionId,
        projectPath: context.directory,
        technology: context.technology,
        frameworks: [],
        dependencies: [],
        commonCommands: [],
        workflowPatterns: [],
        lastAnalyzed: new Date(),
        confidence: 0.7,
        metadata: {
          files: [],
          directories: [],
          configFiles: [],
          buildTools: [],
          testing: [],
          deployment: []
        }
      };
      this.projectContexts.set(sessionId, newContext);
    }
  }

  private isPatternRelevant(pattern: CommandPattern, context: any, userId: string): boolean {
    if (pattern.confidence < this.config.confidenceThreshold) return false;
    
    // Check technology match
    if (pattern.technology && context.technology && pattern.technology !== context.technology) {
      return false;
    }
    
    // Check directory context
    if (pattern.conditions.directory && context.directory) {
      if (!context.directory.includes(pattern.conditions.directory)) {
        return false;
      }
    }
    
    return true;
  }

  private isMemoryRelevant(memory: CommandMemory, context: any): boolean {
    // Check if context is similar
    if (memory.context.technology && context.technology) {
      return memory.context.technology === context.technology;
    }
    
    if (memory.context.directory && context.directory) {
      return context.directory.includes(memory.context.directory) || 
             memory.context.directory.includes(context.directory);
    }
    
    return true;
  }

  private calculateSuggestionConfidence(patterns: CommandPattern[], memories: CommandMemory[]): number {
    if (patterns.length === 0 && memories.length === 0) return 0;
    
    const patternConfidence = patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length || 0;
    const memoryConfidence = memories.reduce((sum, m) => sum + m.metadata.confidence, 0) / memories.length || 0;
    
    return (patternConfidence + memoryConfidence) / 2;
  }

  private calculateMemoryEfficiency(): number {
    const activeMemories = Array.from(this.commandMemories.values())
      .filter(m => {
        const age = Date.now() - m.metadata.lastUsed.getTime();
        return age < this.config.maxContextAge;
      }).length;
    
    return activeMemories / this.commandMemories.size || 0;
  }

  private calculateLearningAccuracy(): number {
    // Simple accuracy calculation - in reality would track prediction success
    const highConfidencePatterns = Array.from(this.commandPatterns.values())
      .filter(p => p.confidence > 0.8).length;
    
    return highConfidencePatterns / this.commandPatterns.size || 0;
  }

  private async cleanupOldMemories(): Promise<void> {
    const cutoff = Date.now() - this.config.maxContextAge;
    const toRemove: string[] = [];
    
    for (const [id, memory] of this.commandMemories) {
      if (memory.metadata.lastUsed.getTime() < cutoff && memory.metadata.frequency < 3) {
        toRemove.push(id);
      }
    }
    
    toRemove.forEach(id => this.commandMemories.delete(id));
  }

  private async decayUnusedPatterns(): Promise<void> {
    const cutoff = Date.now() - this.config.maxContextAge;
    
    for (const pattern of this.commandPatterns.values()) {
      if (pattern.lastUsed.getTime() < cutoff) {
        pattern.confidence = Math.max(0, pattern.confidence - this.config.learningDecayRate);
      }
    }
  }

  private async optimizeMemory(): Promise<void> {
    // Keep only top memories if we exceed the limit
    if (this.commandMemories.size > this.config.maxMemoryEntries) {
      const sorted = Array.from(this.commandMemories.entries())
        .sort(([, a], [, b]) => b.metadata.frequency - a.metadata.frequency);
      
      const toKeep = sorted.slice(0, this.config.maxMemoryEntries);
      this.commandMemories.clear();
      
      toKeep.forEach(([id, memory]) => {
        this.commandMemories.set(id, memory);
      });
    }
  }

  private async ensureDataDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.config.dataDirectory, { recursive: true });
    } catch (error) {
      console.warn('Failed to create memory data directory:', error);
    }
  }

  private async persistMemory(): Promise<void> {
    try {
      const data = {
        memories: Array.from(this.commandMemories.entries()),
        patterns: Array.from(this.commandPatterns.entries()),
        preferences: Array.from(this.userPreferences.entries()),
        contexts: Array.from(this.projectContexts.entries()),
        insights: Array.from(this.learningInsights.entries())
      };
      
      await fs.writeFile(
        join(this.config.dataDirectory, 'memory.json'),
        JSON.stringify(data, null, 2)
      );
    } catch (error) {
      console.warn('Failed to persist memory:', error);
    }
  }

  private async loadPersistedMemory(): Promise<void> {
    try {
      const data = await fs.readFile(join(this.config.dataDirectory, 'memory.json'), 'utf8');
      const parsed = JSON.parse(data);
      
      this.commandMemories = new Map(parsed.memories || []);
      this.commandPatterns = new Map(parsed.patterns || []);
      this.userPreferences = new Map(parsed.preferences || []);
      this.projectContexts = new Map(parsed.contexts || []);
      this.learningInsights = new Map(parsed.insights || []);
    } catch (error) {
      // File doesn't exist or is invalid - start fresh
      console.log('No persisted memory found, starting fresh');
    }
  }

  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}