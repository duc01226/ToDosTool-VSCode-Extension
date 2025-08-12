/**
 * AI Semantic Analyzer Tool - Provides intelligent semantic analysis capabilities
 * Analyzes prompts, tasks, and requirements with AI-powered insights
 */

import * as vscode from 'vscode';
import { IAITool, IAIToolResult, IAIToolSchema } from '../IAITool';
import { analyzeTaskComplexity, analyzeTaskSemantics, analyzeTodoToolUsage, getAiModel } from '../../aiUtils';
import { BaseAIToolUtils, COMMON_KEYWORD_GROUPS } from '../BaseAIToolUtils';
import { 
  AISemanticAnalysisResult,
  ComplexityAnalysisResult,
  SemanticAnalysisResult,
  WorkflowNeedsAnalysisResult,
  TodoRelevanceAnalysisResult,
  PriorityAnalysisResult,
  Priority,
  TaskType,
  Complexity,
  AnalysisRecommendations,
  DetailedAnalysisBreakdown
} from '../../types';

// Union type for all possible semantic analysis results
export type SemanticAnalysisResultUnion = 
  | ComplexityAnalysisResult
  | SemanticAnalysisResult
  | WorkflowNeedsAnalysisResult
  | TodoRelevanceAnalysisResult
  | PriorityAnalysisResult;

export class AISemanticAnalyzerTool implements IAITool<AISemanticAnalysisResult<SemanticAnalysisResultUnion>> {
  public readonly name = 'ai_semantic_analyzer';
  public readonly displayName = 'AI Semantic Task Analyzer';
  public readonly description = '🧠 Intelligent semantic analysis of tasks and prompts with complexity assessment, task type classification, and workflow orchestration recommendations. Provides AI-powered insights for optimal task management strategies.';

  public readonly schema: IAIToolSchema = {
    name: this.name,
    displayName: this.displayName,
    description: this.description,
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: '📋 User prompt or task description to analyze'
        },
        analysisType: {
          type: 'string',
          description: '🔍 Type of analysis to perform',
          enum: ['complexity', 'semantic', 'workflow_needs', 'todo_relevance', 'priority']
        },
        context: {
          type: 'string',
          description: '🌐 Additional context for analysis (optional)'
        },
        options: {
          type: 'object',
          description: '⚙️ Additional analysis options',
          properties: {
            includeRecommendations: {
              type: 'boolean',
              description: 'Include AI recommendations in the analysis'
            },
            detailedBreakdown: {
              type: 'boolean', 
              description: 'Provide detailed step-by-step breakdown'
            },
            userModel: {
              type: 'object',
              description: '🤖 User-selected language model to use for analysis (if available)'
            }
          }
        }
      },
      required: ['prompt', 'analysisType']
    }
  };

  public validate(parameters: { [key: string]: any }): boolean {
    const { prompt, analysisType } = parameters;
    
    // Validate required parameters
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return false;
    }
    
    if (!analysisType || typeof analysisType !== 'string') {
      return false;
    }
    
    // Validate analysis type is in allowed enum
    const allowedTypes = this.schema.parameters.properties.analysisType.enum;
    if (!allowedTypes.includes(analysisType)) {
      return false;
    }
    
    return true;
  }

  public async execute(parameters: { [key: string]: any }): Promise<IAIToolResult<AISemanticAnalysisResult<SemanticAnalysisResultUnion>>> {
    const { prompt, analysisType, context, options = {} } = parameters;
    
    return BaseAIToolUtils.safeExecute(async () => {
      // Get available language model using base utilities
      const modelInfo = await BaseAIToolUtils.getAvailableLanguageModel(
        options.userModel, 
        'AI Semantic Analyzer'
      );
      
      let analysisResult: SemanticAnalysisResultUnion;

      switch (analysisType) {
        case 'complexity':
          analysisResult = await this.analyzeComplexity(prompt, modelInfo.model, context);
          break;
          
        case 'semantic':
          analysisResult = await this.analyzeSemantics(prompt, modelInfo.model, context);
          break;
          
        case 'workflow_needs':
          analysisResult = await this.analyzeWorkflowNeeds(prompt, modelInfo.model, context);
          break;
          
        case 'todo_relevance':
          analysisResult = await this.analyzeTodoRelevance(prompt, modelInfo.model, context);
          break;
          
        case 'priority':
          analysisResult = await this.analyzePriority(prompt, modelInfo.model, context);
          break;
          
        default:
          throw new Error(`Unsupported analysis type: ${analysisType}`);
      }

      // Create enhanced result with optional properties
      const enhancedResult: SemanticAnalysisResultUnion = { ...analysisResult };

      // Add recommendations if requested
      if (options.includeRecommendations) {
        enhancedResult.recommendations = await this.generateRecommendations(
          analysisResult,
          analysisType,
          prompt,
          modelInfo.model
        );
      }

      // Add detailed breakdown if requested
      if (options.detailedBreakdown) {
        enhancedResult.detailedBreakdown = await this.generateDetailedBreakdown(
          analysisResult,
          analysisType,
          prompt,
          modelInfo.model
        );
      }

      return {
        analysisType,
        prompt,
        context,
        result: enhancedResult,
        modelInfo: {
          hasModel: !!modelInfo.model,
          modelType: modelInfo.modelType,
          modelName: modelInfo.modelName
        }
      };

    }, 'ai_semantic_analyzer', {
      analysisType,
      prompt: prompt ? prompt.substring(0, 100) + (prompt.length > 100 ? '...' : '') : '',
      context: context ? context.substring(0, 50) + (context.length > 50 ? '...' : '') : undefined
    });
  }

  private async analyzeComplexity(
    prompt: string,
    model: vscode.LanguageModelChat | null,
    context?: string
  ): Promise<ComplexityAnalysisResult> {
    if (model) {
      return await analyzeTaskComplexity(prompt, model);
    } else {
      // Use base utilities for fallback analysis
      return this.createComplexityFallback(prompt);
    }
  }

  private async analyzeSemantics(
    prompt: string,
    model: vscode.LanguageModelChat | null,
    context?: string
  ): Promise<SemanticAnalysisResult> {
    if (model) {
      return await analyzeTaskSemantics(prompt, model);
    } else {
      // Use base utilities for fallback analysis
      return this.createSemanticFallback(prompt);
    }
  }

  private async analyzeWorkflowNeeds(
    prompt: string,
    model: vscode.LanguageModelChat | null,
    context?: string
  ): Promise<WorkflowNeedsAnalysisResult> {
    if (model) {
      const complexityAnalysis = await analyzeTaskComplexity(prompt, model);
      return {
        needsWorkflow: complexityAnalysis.needsOrchestration,
        suggestedApproach: complexityAnalysis.suggestedApproach,
        complexity: complexityAnalysis.complexity,
        reasoning: complexityAnalysis.reasoning,
        confidence: complexityAnalysis.confidence
      };
    } else {
      return this.createWorkflowFallback(prompt);
    }
  }

  private async analyzeTodoRelevance(
    prompt: string,
    model: vscode.LanguageModelChat | null,
    context?: string
  ): Promise<TodoRelevanceAnalysisResult> {
    if (model) {
      try {
        const aiFunction = BaseAIToolUtils.createAIFunctionWrapper(model);
        const result = await analyzeTodoToolUsage(prompt, aiFunction);
        return result;
      } catch (error) {
        return this.createTodoRelevanceFallback(prompt);
      }
    } else {
      return this.createTodoRelevanceFallback(prompt);
    }
  }

  private async analyzePriority(
    prompt: string,
    model: vscode.LanguageModelChat | null,
    context?: string
  ): Promise<PriorityAnalysisResult> {
    // Use keyword-based analysis from base utilities
    const keywordAnalysis = BaseAIToolUtils.createKeywordAnalysis(prompt, {
      urgent: COMMON_KEYWORD_GROUPS.urgency,
      high: COMMON_KEYWORD_GROUPS.priority,
      low: COMMON_KEYWORD_GROUPS.lowPriority
    });
    
    let priority: Priority = 'medium';
    let confidence = 0.5;
    let reasoning = 'Default priority assigned';
    
    if (keywordAnalysis.urgent.score > 0) {
      priority = 'critical';
      confidence = 0.8;
      reasoning = 'Contains urgent language indicators';
    } else if (keywordAnalysis.high.score > 0) {
      priority = 'high';
      confidence = 0.7;
      reasoning = 'Contains high priority language indicators';
    } else if (keywordAnalysis.low.score > 0) {
      priority = 'low';
      confidence = 0.7;
      reasoning = 'Contains low priority language indicators';
    }
    
    return {
      priority,
      confidence,
      reasoning,
      analysis: keywordAnalysis
    };
  }

  private async generateRecommendations(
    analysisResult: SemanticAnalysisResultUnion,
    analysisType: string,
    prompt: string,
    model: vscode.LanguageModelChat | null
  ): Promise<string[]> {
    const recommendations = [];
    
    switch (analysisType) {
      case 'complexity':
        const complexityResult = analysisResult as ComplexityAnalysisResult;
        if (complexityResult.needsOrchestration) {
          recommendations.push('Consider using createWorkflow action for this complex task');
          recommendations.push('Break down into smaller, manageable subtasks');
        } else {
          recommendations.push('Can be handled as a single todo item');
        }
        break;
        
      case 'workflow_needs':
        const workflowResult = analysisResult as WorkflowNeedsAnalysisResult;
        if (workflowResult.needsWorkflow) {
          recommendations.push(`Use ${workflowResult.suggestedApproach} approach`);
          recommendations.push('Enable context preservation for multi-step tracking');
        }
        break;
        
      case 'priority':
        const priorityResult = analysisResult as PriorityAnalysisResult;
        recommendations.push(`Set task priority to: ${priorityResult.priority}`);
        if (priorityResult.priority === 'critical') {
          recommendations.push('Consider immediate action and resource allocation');
        }
        break;
    }
    
    return recommendations;
  }

  private async generateDetailedBreakdown(
    analysisResult: SemanticAnalysisResultUnion,
    analysisType: string,
    prompt: string,
    model: vscode.LanguageModelChat | null
  ): Promise<DetailedAnalysisBreakdown> {
    return {
      analysisSteps: [
        'Input validation and preprocessing',
        'Keyword and semantic analysis',
        'Pattern recognition and classification',
        'Confidence scoring and validation',
        'Result compilation and formatting'
      ],
      keyFactors: analysisType === 'complexity' ? [
        'Task scope and requirements',
        'Technical complexity indicators',
        'Dependencies and prerequisites',
        'Time and resource estimates'
      ] : [
        'Language patterns and indicators',
        'Context and domain specificity',
        'Intent and goal alignment',
        'Confidence and reliability metrics'
      ]
    };
  }

  // Simplified fallback analysis methods using base utilities
  private createComplexityFallback(prompt: string): ComplexityAnalysisResult {
    const keywordAnalysis = BaseAIToolUtils.createKeywordAnalysis(prompt, {
      complex: COMMON_KEYWORD_GROUPS.complexity,
      simple: COMMON_KEYWORD_GROUPS.simplicity
    });
    
    const hasComplexity = keywordAnalysis.complex.score > 0;
    const hasSimple = keywordAnalysis.simple.score > 0;
    
    return {
      needsOrchestration: hasComplexity && prompt.length > 50,
      complexity: hasComplexity ? 'complex' : hasSimple ? 'simple' : 'medium',
      suggestedApproach: hasComplexity ? 'sequential_workflow' : 'single_task',
      confidence: 0.6,
      reasoning: 'Fallback analysis based on keyword patterns',
      keywordAnalysis
    };
  }

  private createSemanticFallback(prompt: string): SemanticAnalysisResult {
    const keywordAnalysis = BaseAIToolUtils.createKeywordAnalysis(prompt, {
      implementation: COMMON_KEYWORD_GROUPS.implementation,
      testing: COMMON_KEYWORD_GROUPS.testing,
      research: COMMON_KEYWORD_GROUPS.research
    });
    
    let taskType: TaskType = 'generic';
    if (keywordAnalysis.implementation.score > 0) {
      taskType = 'implementation';
    } else if (keywordAnalysis.testing.score > 0) {
      taskType = 'testing';
    } else if (keywordAnalysis.research.score > 0) {
      taskType = 'research';
    }
    
    return {
      taskType,
      complexity: prompt.length > 100 ? 'complex' : 'simple',
      confidence: 0.5,
      suggestedBreakdown: ['Analyze requirements', 'Plan approach', 'Execute task', 'Verify results'],
      keywordAnalysis
    };
  }

  private createWorkflowFallback(prompt: string): WorkflowNeedsAnalysisResult {
    return {
      needsWorkflow: prompt.length > 100 || prompt.split(' ').length > 20,
      suggestedApproach: 'sequential_workflow',
      complexity: 'medium',
      reasoning: 'Fallback analysis based on prompt length and complexity indicators',
      confidence: 0.4
    };
  }

  private createTodoRelevanceFallback(prompt: string): TodoRelevanceAnalysisResult {
    const keywordAnalysis = BaseAIToolUtils.createKeywordAnalysis(prompt, {
      todoKeywords: ['task', 'todo', 'create', 'add', 'manage', 'track', 'complete']
    });
    
    const relevanceScore = keywordAnalysis.todoKeywords.score;
    
    return {
      shouldUse: relevanceScore > 0 || prompt.includes('?') === false,
      confidence: Math.min(relevanceScore, 0.8),
      reasoning: `Found ${keywordAnalysis.todoKeywords.matches.length} todo-related keywords in prompt`,
      keywordAnalysis
    };
  }
}
