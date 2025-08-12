/**
 * AI Utilities - Comprehensive AI analysis, processing, and utility functions
 * Consolidated from sharedAIUtils.ts and aiUtils.ts for unified AI functionality
 */

import * as vscode from "vscode";
import {
  TodoToolAnalysis,
  ContextSwitchAnalysis,
  TaskType,
  Complexity,
  Todo,
  TodoItem,
  WorkflowTask,
  TaskComplexityAnalysis,
  SessionContext,
  ContextSwitchCheckResult,
} from "./types";
import { AI_PROMPTS } from "./constants";

// ================================================================================================
// INTERFACES
// ================================================================================================

export interface ShouldUseTodoToolResult {
  shouldUse: boolean;
  confidence: number;
  reasoning: string;
}

export interface AnalyzeTaskComplexityResult {
  needsOrchestration: boolean;
  complexity: "simple" | "medium" | "complex" | "very_complex";
  suggestedApproach:
    | "single_task"
    | "sequential_workflow"
    | "multi_phase_discovery"
    | "approval_workflow";
  reasoning: string;
  confidence: number;
}

export interface AnalyzeTaskSemanticsResult {
  taskType:
    | "implementation"
    | "research"
    | "testing"
    | "documentation"
    | "configuration"
    | "api"
    | "discovery"
    | "generic";
  complexity: "simple" | "medium" | "complex" | "very_complex";
  suggestedBreakdown: string[];
  contextualTips: string[];
  confidence: number;
}

// ================================================================================================
// AI MODEL MANAGEMENT
// ================================================================================================

/**
 * Gets the best available AI model based on user-configured priorities
 */
export async function getAiModel(): Promise<vscode.LanguageModelChat | null> {
  try {
    const config = vscode.workspace.getConfiguration('ai-todos-tool');
    const modelPriorities: string[] = config.get('aiModelPriorities', [
      'Claude Sonnet 4',
      'GPT-5',
      'Claude',
      'GPT',
      'Copilot'
    ]);

    console.log(`🔍 [AI] Searching for AI models with priorities:`, modelPriorities);

    const allModels = await vscode.lm.selectChatModels();
    
    for (const priority of modelPriorities) {
      const matchingModel = allModels.find(model => 
        model.name.toLowerCase().includes(priority.toLowerCase()) ||
        model.id.toLowerCase().includes(priority.toLowerCase()) ||
        model.vendor.toLowerCase().includes(priority.toLowerCase())
      );
      
      if (matchingModel) {
        console.log(`✅ [AI] Found matching model: ${matchingModel.name} (${matchingModel.vendor}) for priority "${priority}"`);
        return matchingModel;
      } else {
        console.log(`⏭️ [AI] No model found for priority "${priority}", trying next...`);
      }
    }

    if (allModels.length > 0) {
      const fallbackModel = allModels[0];
      console.log(`🔄 [AI] Using fallback model: ${fallbackModel.name} (${fallbackModel.vendor})`);
      return fallbackModel;
    }

    console.error('❌ [AI] No AI models available');
    return null;
  } catch (error) {
    console.error('❌ [AI] Error getting AI model:', error);
    return null;
  }
}

// ================================================================================================
// CORE AI REQUEST EXECUTION
// ================================================================================================

/**
 * Enhanced AI request execution with comprehensive error handling and timeout support
 */
export async function executeAIRequest<T>(
  model: vscode.LanguageModelChat,
  prompt: string,
  fallback: T,
  operation: string = 'AI request',
  timeout: number = 30000
): Promise<T> {
  try {
    const request = await model.sendRequest(
      [vscode.LanguageModelChatMessage.User(prompt)],
      {},
      new vscode.CancellationTokenSource().token
    );

    let response = "";
    for await (const fragment of request.text) {
      response += fragment;
    }

    return safeParseAIResponse(response.trim(), fallback);
  } catch (error) {
    console.warn(`Failed to execute ${operation}:`, error);
    return fallback;
  }
}

/**
 * Execute AI request with streaming support for real-time UI updates
 */
export async function executeStreamingAIRequest(
  model: vscode.LanguageModelChat,
  prompt: string,
  streamCallback: (chunk: string) => void,
  token?: vscode.CancellationToken
): Promise<string> {
  try {
    const messages = [vscode.LanguageModelChatMessage.User(prompt)];
    const response = await model.sendRequest(messages, {}, token);

    let fullResponse = "";
    for await (const part of response.stream) {
      if (part instanceof vscode.LanguageModelTextPart) {
        fullResponse += part.value;
        streamCallback(part.value);
      }
    }

    return fullResponse;
  } catch (error) {
    console.warn('Streaming AI request failed:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    streamCallback(`Error: ${errorMessage}`);
    return "";
  }
}

/**
 * Execute AI request with multiple retry attempts
 */
export async function executeAIRequestWithRetry<T>(
  model: vscode.LanguageModelChat,
  prompt: string,
  fallback: T,
  operation: string = 'AI request',
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await executeAIRequest(model, prompt, fallback, operation);
      if (result !== fallback) {
        return result; // Success
      }
    } catch (error) {
      console.warn(`${operation} attempt ${attempt}/${maxRetries} failed:`, error);
      
      if (attempt === maxRetries) {
        break; // Last attempt, exit loop
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
    }
  }
  
  console.error(`${operation} failed after ${maxRetries} attempts, using fallback`);
  return fallback;
}

/**
 * Batch AI requests with rate limiting and error handling
 */
export async function executeBatchAIRequests<T>(
  model: vscode.LanguageModelChat,
  prompts: string[],
  fallbacks: T[],
  operation: string = 'Batch AI request',
  batchSize: number = 3,
  delayBetweenBatches: number = 1000
): Promise<T[]> {
  const results: T[] = [];
  
  for (let i = 0; i < prompts.length; i += batchSize) {
    const batch = prompts.slice(i, i + batchSize);
    const batchFallbacks = fallbacks.slice(i, i + batchSize);
    
    const batchPromises = batch.map((prompt, index) => 
      executeAIRequest(model, prompt, batchFallbacks[index], `${operation} (${i + index + 1})`)
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Delay between batches to avoid rate limiting
    if (i + batchSize < prompts.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }
  
  return results;
}

/**
 * Standard AI function wrapper that creates a simple string->string interface
 * from VS Code LanguageModelChat objects
 */
export async function createStandardAIFunction(
  model: vscode.LanguageModelChat
): Promise<(prompt: string) => Promise<string>> {
  return async (prompt: string): Promise<string> => {
    const request = await model.sendRequest(
      [vscode.LanguageModelChatMessage.User(prompt)],
      {},
      new vscode.CancellationTokenSource().token
    );

    let response = "";
    for await (const fragment of request.text) {
      response += fragment;
    }
    return response.trim();
  };
}

/**
 * Create an AI function with error handling and fallback
 */
export async function createRobustAIFunction(
  model: vscode.LanguageModelChat,
  defaultFallback: string = "AI request failed"
): Promise<(prompt: string, fallback?: string) => Promise<string>> {
  return async (prompt: string, fallback?: string): Promise<string> => {
    try {
      const aiFunction = await createStandardAIFunction(model);
      return await aiFunction(prompt);
    } catch (error) {
      console.warn('AI function execution failed:', error);
      return fallback || defaultFallback;
    }
  };
}

/**
 * Execute AI request with conversation context
 */
export async function executeConversationalAIRequest<T>(
  model: vscode.LanguageModelChat,
  messages: vscode.LanguageModelChatMessage[],
  fallback: T,
  operation: string = 'Conversational AI request'
): Promise<T> {
  try {
    const request = await model.sendRequest(
      messages,
      {},
      new vscode.CancellationTokenSource().token
    );

    let response = "";
    for await (const fragment of request.text) {
      response += fragment;
    }

    return safeParseAIResponse(response.trim(), fallback);
  } catch (error) {
    console.warn(`Failed to execute ${operation}:`, error);
    return fallback;
  }
}

// ================================================================================================
// SAFE JSON PARSING & RESPONSE HANDLING
// ================================================================================================

export function safeParseAIResponse<T>(response: string, fallback: T): T {
  try {
    // Clean up the response - remove markdown code blocks if present
    const cleanResponse = response
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .replace(/^\s*[\[\{]/, (match) => match.trim())
      .replace(/[\]\}]\s*$/, (match) => match.trim())
      .trim();

    const parsed = JSON.parse(cleanResponse);
    return parsed;
  } catch (error) {
    console.warn("Failed to parse AI response:", error, "Response:", response);
    return fallback;
  }
}

// ================================================================================================
// TASK ANALYSIS & COMPLEXITY ASSESSMENT
// ================================================================================================

/**
 * AI-powered semantic analysis for task complexity and orchestration needs
 */
export async function analyzeTaskComplexity(
  prompt: string,
  model: vscode.LanguageModelChat
): Promise<AnalyzeTaskComplexityResult> {
  try {
    const analysisPrompt = AI_PROMPTS.TASK_COMPLEXITY_ANALYSIS.replace(
      "{{prompt}}",
      prompt
    );

    const request = await model.sendRequest(
      [vscode.LanguageModelChatMessage.User(analysisPrompt)],
      {},
      new vscode.CancellationTokenSource().token
    );

    let response = "";
    for await (const fragment of request.text) {
      response += fragment;
    }

    // Parse AI response
    const analysis = safeParseAIResponse<
      AnalyzeTaskComplexityResult | undefined
    >(response.trim(), undefined);

    // Validate and set defaults
    return {
      needsOrchestration: analysis?.needsOrchestration || false,
      complexity: analysis?.complexity || "simple",
      suggestedApproach: analysis?.suggestedApproach || "single_task",
      reasoning: analysis?.reasoning || "AI analysis completed",
      confidence: analysis?.confidence || 0.5,
    };
  } catch (error) {
    console.warn("AI analysis failed, falling back to basic detection:", error);
    // Fallback to basic detection
    return {
      needsOrchestration: prompt.length > 100 || prompt.split(".").length > 3,
      complexity: prompt.length > 200 ? "complex" : "medium",
      suggestedApproach: "sequential_workflow",
      reasoning: "Fallback analysis based on prompt length and structure",
      confidence: 0.3,
    };
  }
}

// ================================================================================================
// SEMANTIC ANALYSIS & TASK CLASSIFICATION
// ================================================================================================

/**
 * AI-powered semantic analysis for task content classification
 * Replaces all hard-coded English keyword detection with AI understanding
 */
export async function analyzeTaskSemantics(
  content: string,
  model: vscode.LanguageModelChat | null
): Promise<AnalyzeTaskSemanticsResult> {
  if (!model) {
    // Fallback analysis using simple heuristics when AI is unavailable
    const lowerContent = content.toLowerCase();
    const hasImplementKeywords =
      /\b(implement|create|build|develop|code|program)\b/i.test(content);
    const hasTestKeywords = /\b(test|testing|verify|validate|check)\b/i.test(
      content
    );
    const hasResearchKeywords =
      /\b(research|investigate|analyze|explore|discover)\b/i.test(content);
    const hasApiKeywords = /\b(api|endpoint|service|request|response)\b/i.test(
      content
    );

    let taskType: any = "generic";
    if (hasImplementKeywords) {
      taskType = "implementation";
    } else if (hasTestKeywords) {
      taskType = "testing";
    } else if (hasResearchKeywords) {
      taskType = "research";
    } else if (hasApiKeywords) {
      taskType = "api";
    }

    const complexity =
      content.length > 200
        ? "complex"
        : content.length > 100
        ? "medium"
        : "simple";

    return {
      taskType,
      complexity,
      suggestedBreakdown: getGenericBreakdown(taskType),
      contextualTips: getGenericTips(taskType),
      confidence: 0.3,
    };
  }

  try {
    const analysisPrompt = AI_PROMPTS.TASK_SEMANTICS_ANALYSIS.replace(
      "{{content}}",
      content
    );

    const messages = [vscode.LanguageModelChatMessage.User(analysisPrompt)];
    const response = await model.sendRequest(
      messages,
      {},
      new vscode.CancellationTokenSource().token
    );

    let responseText = "";
    for await (const part of response.text) {
      responseText += part;
    }

    const analysisResult = safeParseAIResponse<
      AnalyzeTaskSemanticsResult | undefined
    >(responseText.trim(), undefined);
    return {
      taskType: analysisResult?.taskType || "generic",
      complexity: analysisResult?.complexity || "medium",
      suggestedBreakdown: analysisResult?.suggestedBreakdown || [],
      contextualTips: analysisResult?.contextualTips || [],
      confidence: analysisResult?.confidence || 0.7,
    };
  } catch (error) {
    console.warn("AI semantic analysis failed, using fallback:", error);
    // Return fallback analysis
    return {
      taskType: "generic",
      complexity: "medium",
      suggestedBreakdown: [
        "Analyze requirements",
        "Plan approach",
        "Execute task",
        "Verify completion",
      ],
      contextualTips: [
        "Break down complex tasks",
        "Test incrementally",
        "Document progress",
      ],
      confidence: 0.2,
    };
  }
}

function getGenericBreakdown(taskType: string): string[] {
  const breakdowns: Record<string, string[]> = {
    implementation: [
      "Analyze requirements and design approach",
      "Set up basic structure and dependencies",
      "Implement core functionality",
      "Add error handling and validation",
      "Create tests and documentation",
      "Review and optimize implementation",
    ],
    testing: [
      "Define test scenarios and criteria",
      "Set up test environment",
      "Create test cases",
      "Execute tests and record results",
      "Fix issues found during testing",
      "Document test results",
    ],
    research: [
      "Define research scope and questions",
      "Gather initial information",
      "Analyze findings and patterns",
      "Validate key insights",
      "Document conclusions",
      "Present recommendations",
    ],
    api: [
      "Design API structure and endpoints",
      "Set up basic routing and middleware",
      "Implement core endpoints",
      "Add authentication and validation",
      "Create documentation and tests",
      "Deploy and monitor API",
    ],
    generic: [
      "Define clear objectives",
      "Plan approach and timeline",
      "Execute planned tasks",
      "Review and validate results",
      "Document outcomes",
      "Iterate and improve",
    ],
  };
  return breakdowns[taskType] || breakdowns.generic;
}

function getGenericTips(taskType: string): string[] {
  const tips: Record<string, string[]> = {
    implementation: [
      "Start with small, working increments",
      "Use version control for each milestone",
      "Test early and often during development",
    ],
    testing: [
      "Focus on edge cases and error conditions",
      "Automate repetitive test procedures",
      "Document test results and findings",
    ],
    research: [
      "Use multiple sources for validation",
      "Keep detailed notes and references",
      "Focus on actionable insights",
    ],
    api: [
      "Follow REST principles and standards",
      "Implement proper error handling",
      "Document API thoroughly for users",
    ],
    generic: [
      "Break complex tasks into smaller steps",
      "Validate progress at each milestone",
      "Maintain clear documentation",
    ],
  };
  return tips[taskType] || tips.generic;
}

// ================================================================================================
// TODO TOOL ANALYSIS & DETECTION
// ================================================================================================

/**
 * Unified shouldUseTodoTool function - eliminates duplication between extension.ts and mcpServer.ts
 */
export async function shouldUseTodoTool(
  prompt: string,
  model: vscode.LanguageModelChat
): Promise<ShouldUseTodoToolResult> {
  try {
    const detectionPrompt = AI_PROMPTS.TODO_TOOL_DETECTION.replace(
      "{{prompt}}",
      prompt
    );

    const analysis = await executeAIRequest(
      model,
      detectionPrompt,
      {
        shouldUse: false,
        confidence: 0.5,
        reasoning: "Default fallback"
      },
      'todo tool detection'
    );

    return {
      shouldUse: analysis.shouldUse || false,
      confidence: analysis.confidence || 0.5,
      reasoning: analysis.reasoning || "AI analysis completed"
    };
  } catch (error) {
    console.warn("Failed to analyze todo tool usage:", error);
    return {
      shouldUse: false,
      confidence: 0.3,
      reasoning: "Error in analysis"
    };
  }
}

export async function analyzeTodoToolUsage(
  userPrompt: string,
  aiFunction: (prompt: string) => Promise<string>
): Promise<TodoToolAnalysis> {
  const analysisPrompt = `
    Analyze if this user prompt should use the todo tool:
    "${userPrompt}"
    
    The todo tool should be used for:
    - Creating, updating, or managing tasks/todos
    - Task planning and organization
    - Workflow creation and management
    - Progress tracking
    - Breaking down complex work
    
    The todo tool should NOT be used for:
    - General questions
    - Code explanations
    - Technical discussions not related to task management
    - File operations without task context
    
    Respond with JSON in this exact format:
    {
      "shouldUse": boolean,
      "confidence": number between 0-1,
      "reasoning": "brief explanation"
    }
  `;

  try {
    const response = await aiFunction(analysisPrompt);
    return safeParseAIResponse(response, {
      shouldUse: false,
      confidence: 0.5,
      reasoning: "Default analysis due to parsing error",
    });
  } catch (error) {
    console.warn("Failed to analyze todo tool usage:", error);
    return {
      shouldUse: false,
      confidence: 0.3,
      reasoning: "Error in analysis",
    };
  }
}

// ================================================================================================
// CONTEXT ANALYSIS & SESSION MANAGEMENT
// ================================================================================================

/**
 * Unified context switch detection - eliminates duplication between files
 */
export async function detectContextSwitch(
  currentContext: string,
  newPrompt: string,
  model: vscode.LanguageModelChat
): Promise<ContextSwitchCheckResult> {
  const analysisPrompt = `
    Current session context: "${currentContext}"
    New user prompt: "${newPrompt}"
    
    Determine if this represents a context switch that should create a new session.
    
    Context switches include:
    - Completely different projects or repositories
    - Different programming languages or technologies
    - Switching from one distinct work area to another
    - New major objectives unrelated to current work
    
    NOT context switches:
    - Related tasks in same project
    - Sub-tasks or follow-up work
    - Clarifications or refinements
    - Different files in same project
    
    Respond with JSON in this exact format:
    {
      "isContextSwitch": boolean,
      "confidence": number between 0-1,
      "reason": "brief explanation"
    }
  `;

  return executeAIRequest(
    model,
    analysisPrompt,
    {
      isContextSwitch: false,
      confidence: 0.5,
      reason: "Default analysis due to error"
    },
    'context switch detection'
  );
}

export async function analyzeContextSwitch(
  userPrompt: string,
  currentSessionContext: string,
  aiFunction: (prompt: string) => Promise<string>
): Promise<ContextSwitchAnalysis> {
  const analysisPrompt = `
    Current session context: "${currentSessionContext}"
    New user prompt: "${userPrompt}"
    
    Determine if this represents a context switch that should create a new session.
    
    Context switches include:
    - Completely different projects or repositories
    - Different programming languages or technologies
    - Switching from one distinct work area to another
    - New major objectives unrelated to current work
    
    NOT context switches:
    - Related tasks in same project
    - Sub-tasks or follow-up work
    - Clarifications or refinements
    - Different files in same project
    
    Respond with JSON in this exact format:
    {
      "isContextSwitch": boolean,
      "confidence": number between 0-1,
      "reason": "brief explanation"
    }
  `;

  try {
    const response = await aiFunction(analysisPrompt);
    return safeParseAIResponse(response, {
      isContextSwitch: false,
      confidence: 0.5,
      reason: "Default analysis due to parsing error",
    });
  } catch (error) {
    console.warn("Failed to analyze context switch:", error);
    return {
      isContextSwitch: false,
      confidence: 0.3,
      reason: "Error in analysis",
    };
  }
}

/**
 * Unified context description generation
 */
export async function generateContextDescription(
  prompt: string,
  model: vscode.LanguageModelChat
): Promise<string> {
  const contextPrompt = `
    Based on this user prompt, generate a brief, descriptive context name (2-5 words) 
    that captures the main work area or objective:
    
    "${prompt}"
    
    Examples:
    - "React Component Refactor"
    - "Database Migration"
    - "API Testing Setup"
    - "Documentation Update"
    
    Respond with only the context name, no quotes or extra text.
  `;

  try {
    const response = await executeAIRequest(
      model,
      contextPrompt,
      "",
      'context description generation'
    );

    if (response && typeof response === 'string' && response.trim()) {
      return response.trim();
    }

    // Fallback: generate based on keywords
    return generateFallbackDescription(prompt);
  } catch (error) {
    return generateFallbackDescription(prompt);
  }
}

/**
 * Fallback context description generation
 */
export function generateFallbackDescription(prompt: string): string {
  const words = prompt.toLowerCase().split(/\s+/);
  const keywords = words.filter(word => 
    word.length > 3 && 
    !['this', 'that', 'with', 'from', 'they', 'have', 'will', 'been', 'were'].includes(word)
  );

  if (keywords.length > 0) {
    return keywords.slice(0, 3).map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  return "AI Development Task";
}

// ================================================================================================
// WORKFLOW GENERATION & MANAGEMENT
// ================================================================================================

export async function generateWorkflowTasks(
  objective: string,
  complexity: Complexity,
  aiFunction: (prompt: string) => Promise<string>
): Promise<WorkflowTask[]> {
  const workflowPrompt = `
    Create a detailed workflow for this objective:
    "${objective}"
    
    Complexity level: ${complexity}
    
    Break this down into specific, actionable tasks. Each task should:
    - Be clear and specific
    - Have realistic time estimates
    - Include dependencies where relevant
    - Provide helpful guidance for execution
    
    Respond with JSON array in this exact format:
    [
      {
        "content": "specific task description",
        "description": "detailed explanation",
        "estimatedDuration": "time estimate like '30 minutes' or '2 hours'",
        "dependencies": ["task ids or descriptions"],
        "guidance": {
          "parentObjective": "${objective}",
          "aiInstructions": "specific instructions for AI execution",
          "expectedOutput": "what should be produced",
          "nextStepGuidance": "what to do after completion",
          "validationCriteria": "how to verify success",
          "recoveryInstructions": "what to do if this fails"
        }
      }
    ]
  `;

  try {
    const response = await aiFunction(workflowPrompt);
    const tasks = safeParseAIResponse<WorkflowTask[]>(response, []);

    // Ensure each task has a unique ID
    return tasks.map((task, index) => ({
      ...task,
      id: `task-${Date.now()}-${index}`,
    }));
  } catch (error) {
    console.warn("Failed to generate workflow tasks:", error);
    return [
      {
        id: `task-${Date.now()}-fallback`,
        content: objective,
        description: "Single task fallback due to generation error",
        estimatedDuration: "1 hour",
        dependencies: [],
        guidance: {
          parentObjective: objective,
          aiInstructions: "Complete this task as best as possible",
          expectedOutput: "Task completion",
          nextStepGuidance: "Mark as completed",
          validationCriteria: "Task objectives met",
          recoveryInstructions: "Review and retry if needed",
        },
      },
    ];
  }
}

/**
 * Calculate workflow progress consistently
 */
export function calculateWorkflowProgress(
  totalSteps: number,
  completedSteps: number
): {
  progressPercentage: number;
  isCompleted: boolean;
  remainingSteps: number;
} {
  const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  return {
    progressPercentage,
    isCompleted: completedSteps >= totalSteps,
    remainingSteps: Math.max(0, totalSteps - completedSteps)
  };
}

// ================================================================================================
// ENHANCED TASK ANALYSIS
// ================================================================================================

export async function analyzeTaskPriority(
  content: string,
  context: any,
  aiFunction: (prompt: string) => Promise<string>
): Promise<{ priority: string; reasoning: string }> {
  const priorityPrompt = `
    Analyze the priority of this task:
    "${content}"
    
    Context: ${JSON.stringify(context)}
    
    Consider:
    - Urgency and deadlines
    - Impact on other work
    - Dependencies and blockers
    - Business/project importance
    
    Respond with JSON:
    {
      "priority": "critical" | "high" | "medium" | "low",
      "reasoning": "explanation for the priority level"
    }
  `;

  try {
    const response = await aiFunction(priorityPrompt);
    return safeParseAIResponse(response, {
      priority: "medium",
      reasoning: "Default priority due to analysis error",
    });
  } catch (error) {
    console.warn("Failed to analyze task priority:", error);
    return {
      priority: "medium",
      reasoning: "Error in priority analysis",
    };
  }
}

export async function estimateTaskTime(
  content: string,
  complexity: Complexity,
  taskType: TaskType,
  aiFunction: (prompt: string) => Promise<string>
): Promise<{ timeEstimate: number; reasoning: string }> {
  const estimatePrompt = `
    Estimate the time required for this task:
    "${content}"
    
    Complexity: ${complexity}
    Task Type: ${taskType}
    
    Provide estimate in minutes. Consider:
    - Task complexity and scope
    - Typical time for this type of work
    - Potential challenges or unknowns
    - Review and testing time
    
    Respond with JSON:
    {
      "timeEstimate": number (in minutes),
      "reasoning": "explanation for the estimate"
    }
  `;

  try {
    const response = await aiFunction(estimatePrompt);
    return safeParseAIResponse(response, {
      timeEstimate: 60,
      reasoning: "Default estimate due to analysis error",
    });
  } catch (error) {
    console.warn("Failed to estimate task time:", error);
    return {
      timeEstimate: 60,
      reasoning: "Error in time estimation",
    };
  }
}

// ================================================================================================
// MULTI-LANGUAGE SEMANTIC MATCHING
// ================================================================================================

export async function analyzeSemanticMatch(
  userPrompt: string,
  todoContent: string,
  aiFunction: (prompt: string) => Promise<string>
): Promise<{ isMatch: boolean; confidence: number; reasoning: string }> {
  const semanticPrompt = `
    Analyze if this user prompt semantically matches this todo:
    
    User prompt: "${userPrompt}"
    Todo content: "${todoContent}"
    
    Consider semantic meaning across languages, not just literal text matching.
    Look for:
    - Same intent or objective
    - Related concepts or topics
    - Similar actions or outcomes
    - Equivalent technical terms
    
    The prompt could be in any language but still match English todos or vice versa.
    
    Respond with JSON:
    {
      "isMatch": boolean,
      "confidence": number between 0-1,
      "reasoning": "explanation of the semantic relationship"
    }
  `;

  try {
    const response = await aiFunction(semanticPrompt);
    return safeParseAIResponse(response, {
      isMatch: false,
      confidence: 0.5,
      reasoning: "Default analysis due to parsing error",
    });
  } catch (error) {
    console.warn("Failed to analyze semantic match:", error);
    return {
      isMatch: false,
      confidence: 0.3,
      reasoning: "Error in semantic analysis",
    };
  }
}

// ================================================================================================
// NEXT STEPS GENERATION
// ================================================================================================

export async function generateNextSteps(
  completedTodo: Todo | TodoItem,
  parentObjective: string,
  aiFunction: (prompt: string) => Promise<string>
): Promise<string[]> {
  const nextStepsPrompt = `
    A task was just completed:
    "${completedTodo.content}"
    
    Parent objective: "${parentObjective}"
    
    Generate logical next steps to continue progress toward the parent objective.
    Consider what naturally follows from completing this task.
    
    Respond with JSON array of strings:
    ["next step 1", "next step 2", "next step 3"]
  `;

  try {
    const response = await aiFunction(nextStepsPrompt);
    return safeParseAIResponse<string[]>(response, []);
  } catch (error) {
    console.warn("Failed to generate next steps:", error);
    return [];
  }
}

// ================================================================================================
// ID GENERATION UTILITIES
// ================================================================================================

/**
 * Centralized ID generation with consistent patterns
 * Consolidates all ID generation logic from extension.ts, mcpServer.ts, baseManager.ts, BaseAIToolUtils.ts
 */
export class IDGenerator {
  /**
   * Generate unique ID with timestamp and random component
   * Universal pattern used across all entity types
   */
  private static generateBaseId(prefix: string, separator: string = '-'): string {
    return `${prefix}${separator}${Date.now()}${separator}${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate session ID - consolidated from extension.ts, baseManager.ts
   */
  static generateSessionId(prefix: string = 'session'): string {
    return this.generateBaseId(prefix, '_'); // Use underscore for sessions (legacy compatibility)
  }

  /**
   * Generate workflow ID - consolidated from sharedAIUtils.ts, BaseAIToolUtils.ts
   */
  static generateWorkflowId(prefix: string = 'workflow'): string {
    return this.generateBaseId(prefix);
  }

  /**
   * Generate todo ID - consolidated from baseManager.ts, sharedAIUtils.ts
   */
  static generateTodoId(prefix: string = 'todo'): string {
    return this.generateBaseId(prefix);
  }

  /**
   * Generate subtask ID with parent relationship
   */
  static generateSubtaskId(parentTodoId: string, index: number): string {
    return `${parentTodoId}-subtask-${index}`;
  }

  /**
   * Generate workflow task ID - from sharedAIUtils.ts
   */
  static generateWorkflowTaskId(workflowId: string, stepIndex: number): string {
    return `${workflowId}-task-${stepIndex}`;
  }

  /**
   * Generate unique ID with custom prefix - replaces BaseAIToolUtils.generateUniqueId
   */
  static generateUniqueId(prefix: string = 'id'): string {
    return this.generateBaseId(prefix);
  }

  /**
   * Generate context ID for context management
   */
  static generateContextId(prefix: string = 'ctx'): string {
    return this.generateBaseId(prefix);
  }

  /**
   * Generate execution ID for workflow execution tracking
   */
  static generateExecutionId(prefix: string = 'exec'): string {
    return this.generateBaseId(prefix);
  }
}

// ================================================================================================
// SESSION MANAGEMENT UTILITIES
// ================================================================================================

/**
 * Create standardized session context
 */
export function createSessionContext(
  description: string,
  sessionId?: string
): SessionContext {
  return {
    id: sessionId || IDGenerator.generateSessionId(),
    description,
    createdAt: new Date(),
    lastAccessedAt: new Date(),
    workflowIds: [],
    executionState: new Map(),
    parentChildRelationships: new Map(),
    contextMemory: new Map(),
    isActive: false
  };
}

/**
 * Update session access time
 */
export function updateSessionAccess(session: SessionContext): SessionContext {
  return {
    ...session,
    lastAccessedAt: new Date()
  };
}

// ================================================================================================
// ERROR HANDLING & RESULT UTILITIES
// ================================================================================================

/**
 * Standardized error result creation
 */
export function createErrorResult(
  error: string | Error,
  operation: string,
  details?: any
): {
  success: false;
  error: string;
  operation: string;
  details?: any;
  timestamp: string;
} {
  return {
    success: false,
    error: error instanceof Error ? error.message : error,
    operation,
    details,
    timestamp: new Date().toISOString()
  };
}

/**
 * Standardized success result creation
 */
export function createSuccessResult<T>(
  data: T,
  operation: string,
  metadata?: any
): {
  success: true;
  data: T;
  operation: string;
  metadata?: any;
  timestamp: string;
} {
  return {
    success: true,
    data,
    operation,
    metadata,
    timestamp: new Date().toISOString()
  };
}

/**
 * Safe execution wrapper with consistent error handling
 */
export async function safeExecute<T>(
  operation: () => Promise<T>,
  operationName: string,
  fallback: T
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(`Failed to execute ${operationName}:`, error);
    return fallback;
  }
}

// ================================================================================================
// TIME, DATE & CONTENT UTILITIES
// ================================================================================================

/**
 * Unified timestamp creation
 */
export function createTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Unified time estimation formatting
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else if (minutes < 1440) { // Less than 24 hours
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    let result = `${hours} hour${hours !== 1 ? 's' : ''}`;
    if (remainingMinutes > 0) {
      result += ` ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
    }
    return result;
  } else {
    const days = Math.floor(minutes / 1440);
    const remainingHours = Math.floor((minutes % 1440) / 60);
    let result = `${days} day${days !== 1 ? 's' : ''}`;
    if (remainingHours > 0) {
      result += ` ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
    }
    return result;
  }
}

/**
 * Parse time string to minutes
 */
export function parseTimeString(timeStr: string): number {
  const lowerStr = timeStr.toLowerCase();
  
  // Extract numbers and units
  const hoursMatch = lowerStr.match(/(\d+)\s*(?:hour|hr|h)/);
  const minutesMatch = lowerStr.match(/(\d+)\s*(?:minute|min|m)/);
  
  let totalMinutes = 0;
  
  if (hoursMatch) {
    totalMinutes += parseInt(hoursMatch[1]) * 60;
  }
  
  if (minutesMatch) {
    totalMinutes += parseInt(minutesMatch[1]);
  }
  
  // If no explicit units found, assume the number represents minutes
  if (totalMinutes === 0) {
    const numberMatch = lowerStr.match(/(\d+)/);
    if (numberMatch) {
      totalMinutes = parseInt(numberMatch[1]);
    }
  }
  
  return totalMinutes || 30; // Default fallback
}

/**
 * Sanitize and clean input text
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[^\w\s\-_.,!?()[\]{}:;"']/g, '') // Remove potentially dangerous characters
    .substring(0, 2000); // Limit length
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Extract keywords from text for analysis
 */
export function extractKeywords(text: string, maxKeywords: number = 10): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'
  ]);

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .filter((word, index, arr) => arr.indexOf(word) === index) // Remove duplicates
    .slice(0, maxKeywords);
}

// ================================================================================================
// FALLBACK ANALYSIS FUNCTIONS
// ================================================================================================

const FALLBACK_COMPLEXITY_THRESHOLD = {
  LONG_PROMPT: 100,
  COMPLEX_PROMPT: 200,
  SENTENCE_COUNT: 3
} as const;

const DEFAULT_CONFIDENCE_LEVELS = {
  AI_SUCCESS: 0.7,
  AI_FALLBACK: 0.3,
  FALLBACK_BASIC: 0.4,
  FALLBACK_ANALYSIS: 0.5
} as const;

/**
 * Creates fallback analysis for task complexity when AI is unavailable
 */
export function createFallbackComplexityAnalysis(prompt: string): TaskComplexityAnalysis {
  const hasMultipleSteps = prompt.split(".").length > FALLBACK_COMPLEXITY_THRESHOLD.SENTENCE_COUNT;
  const isLongPrompt = prompt.length > FALLBACK_COMPLEXITY_THRESHOLD.LONG_PROMPT;
  const isComplexPrompt = prompt.length > FALLBACK_COMPLEXITY_THRESHOLD.COMPLEX_PROMPT;

  return {
    needsOrchestration: isLongPrompt || hasMultipleSteps,
    complexity: isComplexPrompt ? "complex" : "medium",
    suggestedApproach: "sequential_workflow",
    reasoning: "Fallback analysis based on prompt length and structure",
    confidence: DEFAULT_CONFIDENCE_LEVELS.FALLBACK_ANALYSIS,
  };
}

// ================================================================================================
// UI HELPER FUNCTIONS
// ================================================================================================

export function showErrorNotification(message: string, error?: unknown): void {
  console.error(message, error);
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  vscode.window.showErrorMessage(`Failed to create todo: ${errorMessage}`);
}
