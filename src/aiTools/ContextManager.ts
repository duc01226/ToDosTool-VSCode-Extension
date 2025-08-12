/**
 * AI-Powered Context Management System
 * Handles context accumulation, compression, and intelligent summarization
 */

import * as vscode from 'vscode';
import { getAiModel } from '../aiUtils';

export interface ContextConfig {
  maxTokensBeforeCompression: number;  // ~100000 tokens
  compressionRatio: number;            // 0.7 = compress to 50% of original size
  maxHistoryItems: number;             // Keep last N context items
  enableIntelligentSummarization: boolean;
}

export interface ContextSnapshot {
  timestamp: Date;
  type: 'user_prompt' | 'task_result' | 'ai_guidance' | 'workflow_progress' | 'checkpoint';
  content: string;
  metadata?: {
    taskId?: string;
    workflowId?: string;
    stepNumber?: number;
    priority?: 'high' | 'medium' | 'low';
  };
  tokenCount?: number;
}

export interface CompressedContext {
  originalTokenCount: number;
  compressedTokenCount: number;
  compressionRatio: number;
  summary: string;
  keyPoints: string[];
  retainedDetails: ContextSnapshot[];
  compressionTimestamp: Date;
}

export class ContextManager {
  private config: ContextConfig;
  private contextHistory: Map<string, ContextSnapshot[]> = new Map();
  private compressedSummaries: Map<string, CompressedContext> = new Map();

  constructor(config?: Partial<ContextConfig>) {
    // Load configuration from VS Code settings
    this.config = this.loadConfigFromSettings(config);
  }

  /**
   * Load configuration from VS Code settings with fallback defaults
   */
  private loadConfigFromSettings(override?: Partial<ContextConfig>): ContextConfig {
    const vscodeConfig = vscode.workspace.getConfiguration('ai-todos-tool.contextManagement');
    
    const defaults: ContextConfig = {
      maxTokensBeforeCompression: vscodeConfig.get('maxTokensBeforeCompression', 100000),
      compressionRatio: vscodeConfig.get('compressionRatio', 0.7),
      maxHistoryItems: vscodeConfig.get('maxHistoryItems', 100),
      enableIntelligentSummarization: vscodeConfig.get('enableIntelligentSummarization', true)
    };

    // Apply any constructor overrides
    return { ...defaults, ...override };
  }

  /**
   * Reload configuration from VS Code settings (useful when settings change)
   */
  public reloadConfig(): void {
    this.config = this.loadConfigFromSettings();
    console.log(`🔧 Context manager config reloaded:`, this.config);
  }

  /**
   * Add context snapshot to history
   */
  public addContext(workflowId: string, snapshot: ContextSnapshot): void {
    if (!this.contextHistory.has(workflowId)) {
      this.contextHistory.set(workflowId, []);
    }

    const history = this.contextHistory.get(workflowId)!;
    
    // Estimate token count (rough approximation: 4 chars = 1 token)
    snapshot.tokenCount = Math.ceil(snapshot.content.length / 4);
    
    history.push(snapshot);

    // Limit history size
    if (history.length > this.config.maxHistoryItems) {
      history.splice(0, history.length - this.config.maxHistoryItems);
    }

    console.log(`📝 Added context: ${snapshot.type} (${snapshot.tokenCount} tokens)`);
  }

  /**
   * Get context for AI model with intelligent compression
   */
  public async getContextForAI(
    workflowId: string, 
    currentPrompt: string,
    userModel?: any
  ): Promise<string> {
    const history = this.contextHistory.get(workflowId) || [];
    const totalTokens = this.calculateTotalTokens(history);
    
    console.log(`🧠 Context check: ${totalTokens} tokens (limit: ${this.config.maxTokensBeforeCompression})`);

    if (totalTokens <= this.config.maxTokensBeforeCompression) {
      // Context is small enough - send as-is
      console.log("✅ Context within limits - sending full context");
      return this.buildFullContext(history, currentPrompt);
    }

    // Context is too large - apply compression
    console.log("🗜️ Context too large - applying AI-powered compression");
    return await this.compressContextForAI(workflowId, history, currentPrompt, userModel);
  }

  /**
   * AI-powered context compression using the AI model itself
   */
  private async compressContextForAI(
    workflowId: string,
    history: ContextSnapshot[],
    currentPrompt: string,
    userModel?: any
  ): Promise<string> {
    try {
      // Check if we have a recent compression
      const existing = this.compressedSummaries.get(workflowId);
      if (existing && this.isCompressionStillValid(existing, history)) {
        console.log("📋 Using existing compression");
        return this.buildCompressedContext(existing, history.slice(-5), currentPrompt);
      }

      // Get AI model for compression
      const model = userModel || await getAiModel();
      if (!model) {
        console.warn("⚠️ No AI model available - using fallback compression");
        return this.fallbackCompression(history, currentPrompt);
      }

      // Build compression prompt
      const fullContext = this.buildFullContext(history, "");
      const targetTokens = Math.floor(this.calculateTotalTokens(history) * this.config.compressionRatio);
      
      const compressionPrompt = `
You are a context compression specialist. Your task is to compress the following workflow context while preserving ALL critical information.

COMPRESSION TARGET: Reduce to approximately ${targetTokens} tokens (50% of original)

ORIGINAL CONTEXT (${this.calculateTotalTokens(history)} tokens):
${fullContext}

CURRENT USER PROMPT:
${currentPrompt}

Please provide a comprehensive summary that:
1. Preserves the main objective and workflow goals
2. Maintains key technical decisions and progress
3. Keeps important failure/recovery information
4. Retains context links and dependencies
5. Summarizes repetitive information
6. Focuses on information relevant to the current prompt

Format your response as:
SUMMARY: [Comprehensive summary preserving critical details]
KEY_POINTS: [Bullet points of essential information]
TECHNICAL_CONTEXT: [Important technical decisions and constraints]
PROGRESS_STATUS: [Current workflow state and completed steps]
`;

      console.log("🤖 Requesting AI compression...");
      
      const messages = [vscode.LanguageModelChatMessage.User(compressionPrompt)];
      const response = await model.sendRequest(messages, {});
      
      let compressionResult = '';
      for await (const fragment of response.text) {
        compressionResult += fragment;
      }

      // Parse and store compression
      const compressed: CompressedContext = {
        originalTokenCount: this.calculateTotalTokens(history),
        compressedTokenCount: Math.ceil(compressionResult.length / 4),
        compressionRatio: Math.ceil(compressionResult.length / 4) / this.calculateTotalTokens(history),
        summary: compressionResult,
        keyPoints: this.extractKeyPoints(compressionResult),
        retainedDetails: history.slice(-3), // Keep last 3 items as detailed context
        compressionTimestamp: new Date()
      };

      this.compressedSummaries.set(workflowId, compressed);
      
      console.log(`✅ AI compression complete: ${compressed.originalTokenCount} → ${compressed.compressedTokenCount} tokens (${Math.round(compressed.compressionRatio * 100)}%)`);

      return this.buildCompressedContext(compressed, history.slice(-3), currentPrompt);

    } catch (error) {
      console.error("❌ AI compression failed:", error);
      return this.fallbackCompression(history, currentPrompt);
    }
  }

  /**
   * Build full context string
   */
  private buildFullContext(history: ContextSnapshot[], currentPrompt: string): string {
    let context = "";
    
    // Group by type for better organization
    const grouped = this.groupContextByType(history);
    
    if (grouped.user_prompt.length > 0) {
      context += "USER PROMPTS:\n";
      grouped.user_prompt.forEach(item => {
        context += `- ${item.content}\n`;
      });
      context += "\n";
    }

    if (grouped.workflow_progress.length > 0) {
      context += "WORKFLOW PROGRESS:\n";
      grouped.workflow_progress.forEach(item => {
        context += `- ${item.content}\n`;
      });
      context += "\n";
    }

    if (grouped.task_result.length > 0) {
      context += "COMPLETED TASKS:\n";
      grouped.task_result.forEach(item => {
        context += `- ${item.content}\n`;
      });
      context += "\n";
    }

    if (grouped.ai_guidance.length > 0) {
      context += "AI GUIDANCE:\n";
      grouped.ai_guidance.forEach(item => {
        context += `- ${item.content}\n`;
      });
      context += "\n";
    }

    if (currentPrompt) {
      context += `CURRENT REQUEST:\n${currentPrompt}\n\n`;
    }

    return context;
  }

  /**
   * Build compressed context with summary + recent details
   */
  private buildCompressedContext(
    compressed: CompressedContext,
    recentHistory: ContextSnapshot[],
    currentPrompt: string
  ): string {
    let context = "WORKFLOW SUMMARY (AI-Compressed):\n";
    context += compressed.summary + "\n\n";
    
    if (recentHistory.length > 0) {
      context += "RECENT ACTIVITY:\n";
      recentHistory.forEach(item => {
        context += `- [${item.type}] ${item.content}\n`;
      });
      context += "\n";
    }

    if (currentPrompt) {
      context += `CURRENT REQUEST:\n${currentPrompt}\n`;
    }

    return context;
  }

  /**
   * Fallback compression when AI is unavailable
   */
  private fallbackCompression(history: ContextSnapshot[], currentPrompt: string): string {
    const targetLength = Math.floor(this.calculateTotalTokens(history) * this.config.compressionRatio * 4);
    
    // Prioritize recent items and high-priority items
    const prioritized = history
      .filter(item => item.metadata?.priority === 'high')
      .concat(history.slice(-10)) // Last 10 items
      .slice(0, 20); // Limit to 20 items

    let context = "COMPRESSED CONTEXT (Fallback):\n";
    let currentLength = 0;

    for (const item of prioritized) {
      if (currentLength + item.content.length > targetLength) {
        break;
      }
      context += `- [${item.type}] ${item.content.substring(0, 200)}...\n`;
      currentLength += item.content.length;
    }

    if (currentPrompt) {
      context += `\nCURRENT REQUEST:\n${currentPrompt}\n`;
    }

    return context;
  }

  /**
   * Helper methods
   */
  private calculateTotalTokens(history: ContextSnapshot[]): number {
    return history.reduce((total, item) => total + (item.tokenCount || 0), 0);
  }

  private groupContextByType(history: ContextSnapshot[]): Record<string, ContextSnapshot[]> {
    return history.reduce((groups, item) => {
      if (!groups[item.type]) {
        groups[item.type] = [];
      }
      groups[item.type].push(item);
      return groups;
    }, {} as Record<string, ContextSnapshot[]>);
  }

  private isCompressionStillValid(compressed: CompressedContext, currentHistory: ContextSnapshot[]): boolean {
    const age = Date.now() - compressed.compressionTimestamp.getTime();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    
    return age < maxAge && currentHistory.length <= compressed.retainedDetails.length + 5;
  }

  private extractKeyPoints(compressionResult: string): string[] {
    const keyPointsMatch = compressionResult.match(/KEY_POINTS:\s*(.*?)(?:\n\n|\n[A-Z_]+:|$)/s);
    if (keyPointsMatch) {
      return keyPointsMatch[1].split('\n').map(point => point.trim()).filter(Boolean);
    }
    return [];
  }

  /**
   * Clear old context to prevent memory leaks
   */
  public cleanupOldContext(): void {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();

    for (const [workflowId, history] of this.contextHistory.entries()) {
      const filteredHistory = history.filter(item => 
        now - item.timestamp.getTime() < maxAge
      );
      
      if (filteredHistory.length === 0) {
        this.contextHistory.delete(workflowId);
      } else {
        this.contextHistory.set(workflowId, filteredHistory);
      }
    }

    // Clean compressed summaries
    for (const [workflowId, compressed] of this.compressedSummaries.entries()) {
      if (now - compressed.compressionTimestamp.getTime() > maxAge) {
        this.compressedSummaries.delete(workflowId);
      }
    }

    console.log("🧹 Context cleanup completed");
  }
}

// Global context manager instance
export const globalContextManager = new ContextManager();
