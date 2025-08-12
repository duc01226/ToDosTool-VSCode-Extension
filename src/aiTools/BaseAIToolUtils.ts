/**
 * Base AI Tool Utilities - Common patterns and utilities for AI Tools
 * Reduces code duplication and provides consistent behavior across tools
 */

import * as vscode from 'vscode';
import { IAIToolResult } from './IAITool';
import { getAiModel } from '../aiUtils';

export interface AIModelInfo {
  model: vscode.LanguageModelChat | null;
  modelType: 'user_selected' | 'ai_utils' | 'none';
  modelName?: string;
  vendor?: string;
}

export interface BaseToolMetadata {
  executedAt: string;
  toolUsed: string;
  aiEnhanced?: boolean;
  modelType?: string;
  [key: string]: any;
}

/**
 * Base utility class for AI Tools with common patterns
 */
export class BaseAIToolUtils {
  
  /**
   * Get available language model with standardized fallback hierarchy
   * @param userModel Optional user-provided model
   * @param toolName Name of the tool for logging
   * @returns Model info with the best available model
   */
  public static async getAvailableLanguageModel(
    userModel?: any,
    toolName: string = 'AI Tool'
  ): Promise<AIModelInfo> {
    try {
      // First priority: User-selected model
      if (userModel && this.isValidLanguageModel(userModel)) {
        console.log(`🎯 Using user-selected model for ${toolName}`);
        return {
          model: userModel as vscode.LanguageModelChat,
          modelType: 'user_selected',
          modelName: userModel.name,
          vendor: userModel.vendor
        };
      }

      // Second priority: getAiModel() from aiUtils
      console.log(`🔄 Falling back to getAiModel() for ${toolName}`);
      const model = await getAiModel();
      if (model) {
        console.log(`✅ Using AI model for ${toolName}: ${model.name} (${model.vendor})`);
        return {
          model,
          modelType: 'ai_utils',
          modelName: model.name,
          vendor: model.vendor
        };
      }

      console.warn(`⚠️ No language model available for ${toolName}`);
      return {
        model: null,
        modelType: 'none'
      };

    } catch (error) {
      console.error(`❌ Error getting language model for ${toolName}:`, error);
      return {
        model: null,
        modelType: 'none'
      };
    }
  }

  /**
   * Check if an object is a valid VS Code LanguageModelChat
   */
  public static isValidLanguageModel(obj: any): boolean {
    return obj && 
           typeof obj === 'object' && 
           obj.sendRequest && 
           typeof obj.sendRequest === 'function';
  }

  /**
   * Create a standardized AI function wrapper for VS Code LanguageModelChat
   * @param model The VS Code language model
   * @returns Simple string-to-string AI function
   */
  public static createAIFunctionWrapper(
    model: vscode.LanguageModelChat
  ): (prompt: string) => Promise<string> {
    return async (prompt: string): Promise<string> => {
      const messages = [vscode.LanguageModelChatMessage.User(prompt)];
      const response = await model.sendRequest(messages, {});
      let fullResponse = '';
      for await (const fragment of response.text) {
        fullResponse += fragment;
      }
      return fullResponse;
    };
  }

  /**
   * Create a standardized success result
   */
  public static createSuccessResult<TData = any>(
    data: TData,
    toolName: string,
    additionalMetadata: Partial<BaseToolMetadata> = {}
  ): IAIToolResult<TData> {
    return {
      success: true,
      data,
      metadata: {
        executedAt: new Date().toISOString(),
        toolUsed: toolName,
        ...additionalMetadata
      }
    };
  }

  /**
   * Create a standardized error result
   */
  public static createErrorResult(
    error: string | Error,
    toolName: string,
    additionalMetadata: Partial<BaseToolMetadata> = {}
  ): IAIToolResult<never> {
    const errorMessage = error instanceof Error ? error.message : error;
    return {
      success: false,
      error: errorMessage,
      metadata: {
        executedAt: new Date().toISOString(),
        toolUsed: toolName,
        ...additionalMetadata
      }
    };
  }

  /**
   * Safe execution wrapper with standardized error handling
   */
  public static async safeExecute<T>(
    operation: () => Promise<T>,
    toolName: string,
    operationContext: any = {}
  ): Promise<IAIToolResult<T>> {
    try {
      const result = await operation();
      return this.createSuccessResult(result, toolName, {
        aiEnhanced: true,
        operationContext: this.sanitizeContext(operationContext)
      });
    } catch (error) {
      const errorToReport = error instanceof Error ? error : new Error(String(error));
      return this.createErrorResult(errorToReport, toolName, {
        operationContext: this.sanitizeContext(operationContext)
      });
    }
  }

  /**
   * Sanitize context for metadata (remove sensitive/large data)
   */
  private static sanitizeContext(context: any): any {
    if (!context || typeof context !== 'object') {
      return context;
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(context)) {
      if (typeof value === 'string' && value.length > 100) {
        sanitized[key] = value.substring(0, 100) + '...';
      } else if (key === 'userModel') {
        sanitized[key] = value ? 'provided' : 'not_provided';
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  /**
   * Validate required parameters with descriptive error messages
   */
  public static validateRequiredParams(
    parameters: { [key: string]: any },
    requiredParams: string[],
    toolName: string
  ): { isValid: boolean; error?: string } {
    for (const param of requiredParams) {
      if (!parameters[param]) {
        return {
          isValid: false,
          error: `Missing required parameter '${param}' for ${toolName}`
        };
      }
    }
    return { isValid: true };
  }

  /**
   * Validate parameter against enum values
   */
  public static validateEnum(
    value: any,
    allowedValues: string[],
    paramName: string,
    toolName: string
  ): { isValid: boolean; error?: string } {
    if (!allowedValues.includes(value)) {
      return {
        isValid: false,
        error: `Invalid value '${value}' for parameter '${paramName}' in ${toolName}. Allowed values: ${allowedValues.join(', ')}`
      };
    }
    return { isValid: true };
  }

  /**
   * Estimate token count (rough approximation: 4 chars ≈ 1 token)
   */
  public static estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Create keyword-based analysis fallback
   */
  public static createKeywordAnalysis(
    text: string,
    keywordGroups: { [category: string]: string[] }
  ): { [category: string]: { matches: string[]; score: number } } {
    const lowerText = text.toLowerCase();
    const analysis: { [category: string]: { matches: string[]; score: number } } = {};

    for (const [category, keywords] of Object.entries(keywordGroups)) {
      const matches = keywords.filter(keyword => lowerText.includes(keyword.toLowerCase()));
      analysis[category] = {
        matches,
        score: matches.length / keywords.length
      };
    }

    return analysis;
  }

  /**
   * Standard configuration loader for VS Code settings
   */
  public static loadConfiguration<T>(
    configSection: string,
    defaults: T,
    override?: Partial<T>
  ): T {
    const vscodeConfig = vscode.workspace.getConfiguration(configSection);
    const config: any = { ...defaults };

    // Load each default key from VS Code settings
    for (const key of Object.keys(defaults as any)) {
      config[key] = vscodeConfig.get(key, (defaults as any)[key]);
    }

    // Apply any overrides
    return { ...config, ...override };
  }
}

/**
 * Common keyword groups for analysis
 */
export const COMMON_KEYWORD_GROUPS = {
  complexity: ['implement', 'create', 'build', 'develop', 'design', 'architecture', 'system'],
  simplicity: ['fix', 'update', 'change', 'modify', 'check', 'view', 'show'],
  urgency: ['urgent', 'asap', 'critical', 'emergency', 'now', 'immediately'],
  priority: ['important', 'priority', 'high', 'soon', 'needed'],
  lowPriority: ['when possible', 'someday', 'later', 'low priority', 'nice to have'],
  implementation: ['implement', 'code', 'develop', 'build', 'program', 'write'],
  testing: ['test', 'verify', 'validate', 'check', 'ensure', 'confirm'],
  research: ['research', 'investigate', 'analyze', 'study', 'explore', 'discover'],
  maintenance: ['fix', 'bug', 'issue', 'error', 'problem', 'debug'],
  enhancement: ['improve', 'optimize', 'enhance', 'upgrade', 'refactor']
};
