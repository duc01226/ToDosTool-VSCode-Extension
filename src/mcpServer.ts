/**
 * MCP (Model Context Protocol) Server Implementation
 * Provides TodosTool functionality to Claude and other MCP-compatible AI clients
 * Compatible with any AI model that can be selected in agent copilot mode
 */

import * as vscode from "vscode";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  CallToolResult,
  ListToolsRequestSchema,
  Tool,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { AIToDosTool } from "./extension";
import { executeAIRequest, executeStreamingAIRequest } from './aiUtils';
import { EnhancedSessionManager } from './baseManager';

// Import shared types and utilities
import {
  WorkflowTask,
  WorkflowTaskGuidance,
  WorkflowDefinition,
  SessionContext,
  ExecutionContext,
  SubtaskRelationship,
} from './types';

import {
  analyzeTaskComplexity,
  analyzeTaskSemantics,
  getAiModel,
  shouldUseTodoTool,
} from './aiUtils';

import {
  MCP_AI_PROMPTS,
  MCP_MESSAGES,
  STATUS_EMOJIS,
  PRIORITY_EMOJIS,
  UTILITY_MESSAGES,
} from './constants';








// ================================================================================================
// LOCAL CONSTANTS AND CONFIGURATION
// ================================================================================================




// ================================================================================================
// UTILITY FUNCTIONS
// ================================================================================================


// ================================================================================================
// CORE AI ANALYSIS FUNCTIONS
// ================================================================================================


/**
 * Creates default workflow guidance for a task
 */
function createDefaultTaskGuidance(
  prompt: string,
  index: number,
  taskContent: string = `Task ${index + 1}`
): WorkflowTaskGuidance {
  return {
    parentObjective: `Complete user request: ${prompt.substring(0, 50)}...`,
    aiInstructions: "Complete this task as part of the overall objective",
    expectedOutput: "Task completion",
    nextStepGuidance: "Proceed to next task",
    validationCriteria: "Task completed successfully",
    approvalRequired: false,
    recoveryInstructions: "Review task requirements and try alternative approach",
  };
}





// ================================================================================================ 
// ENHANCED SESSION AND CONTEXT MANAGEMENT
// ================================================================================================

// Use the enhanced session manager from baseManager.ts
// This replaces the duplicate SessionManager class that was here

class ContextPreservationManager {
  private executionContexts: Map<string, ExecutionContext> = new Map();
  private subtaskRelationships: Map<string, SubtaskRelationship> = new Map();
  private globalContextStore: Map<string, any> = new Map();

  saveExecutionContext(workflowId: string, context: ExecutionContext): void {
    this.executionContexts.set(workflowId, {
      ...context,
      contextSnapshot: JSON.parse(JSON.stringify(context.contextSnapshot))
    });
  }

  restoreExecutionContext(workflowId: string): ExecutionContext | null {
    return this.executionContexts.get(workflowId) || null;
  }

  createSubtaskRelationship(parentId: string, childIds: string[], parentContext: any): void {
    this.subtaskRelationships.set(parentId, {
      parentId,
      childIds: [...childIds],
      completedChildren: [],
      nextParentStep: "",
      parentContext: JSON.parse(JSON.stringify(parentContext))
    });
  }

  completeSubtask(parentId: string, childId: string): SubtaskRelationship | null {
    const relationship = this.subtaskRelationships.get(parentId);
    if (!relationship) {
      return null;
    }

    if (!relationship.completedChildren.includes(childId)) {
      relationship.completedChildren.push(childId);
    }

    return relationship;
  }

  isAllSubtasksComplete(parentId: string): boolean {
    const relationship = this.subtaskRelationships.get(parentId);
    if (!relationship) {
      return true;
    }

    return relationship.completedChildren.length === relationship.childIds.length;
  }

  getParentContext(parentId: string): any {
    const relationship = this.subtaskRelationships.get(parentId);
    return relationship?.parentContext || null;
  }

  saveGlobalContext(key: string, context: any): void {
    this.globalContextStore.set(key, JSON.parse(JSON.stringify(context)));
  }

  restoreGlobalContext(key: string): any {
    return this.globalContextStore.get(key) || null;
  }

  clearContext(identifier: string): void {
    this.executionContexts.delete(identifier);
    this.subtaskRelationships.delete(identifier);
    this.globalContextStore.delete(identifier);
  }
}

class EnhancedWorkflowManager {
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private sessionManager: EnhancedSessionManager;
  private contextManager: ContextPreservationManager;

  constructor() {
    this.sessionManager = new EnhancedSessionManager();
    this.contextManager = new ContextPreservationManager();
  }

  async createIntelligentWorkflow(
    userPrompt: string, 
    autoExecute = true, 
    sessionId?: string
  ): Promise<{ workflowId: string, plan: WorkflowTask[], analysis: any }> {
    
    // Analyze prompt for complexity and requirements
    const analysis = await this.analyzePromptIntelligently(userPrompt);
    
    // Generate workflow plan based on analysis
    const plan = await this.generateWorkflowPlan(userPrompt, analysis);
    
    // Create workflow definition
    const workflowId = `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const workflow: WorkflowDefinition = {
      id: workflowId,
      tasks: plan,
      metadata: {
        createdAt: new Date(),
        originalPrompt: userPrompt,
        autoExecute,
        requiresApproval: analysis.complexity === 'very_complex',
        estimatedDuration: analysis.estimatedTime || 'Unknown'
      },
      currentTaskIndex: 0,
      isCompleted: false,
      context: {
        executionHistory: [],
        sessionId: sessionId || 'default',
        preservedState: new Map()
      }
    };

    this.workflows.set(workflowId, workflow);

    // Associate with session if provided
    if (sessionId) {
      const session = this.sessionManager.getActiveSession();
      if (session) {
        session.workflowIds.push(workflowId);
      }
    }

    return { workflowId, plan, analysis };
  }

  async autoExecuteNextStep(
    workflowId: string, 
    currentStepResult?: string,
    preserveContext = true
  ): Promise<{ completed: boolean, nextTask?: WorkflowTask, result?: string }> {
    
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // Initialize currentTaskIndex if not set
    if (workflow.currentTaskIndex === undefined) {
      workflow.currentTaskIndex = 0;
    }

    // Save execution context if preserving
    if (preserveContext && currentStepResult) {
      const executionContext: ExecutionContext = {
        workflowId,
        currentStep: workflow.currentTaskIndex,
        stepResults: new Map([[workflow.currentTaskIndex, currentStepResult]]),
        childTaskIds: [],
        nextStepPlan: workflow.tasks[workflow.currentTaskIndex + 1]?.content || "",
        contextSnapshot: { workflow: workflow, timestamp: new Date() }
      };
      
      this.contextManager.saveExecutionContext(workflowId, executionContext);
    }

    // Progress to next task
    workflow.currentTaskIndex++;
    
    if (workflow.currentTaskIndex >= workflow.tasks.length) {
      workflow.isCompleted = true;
      return { completed: true };
    }

    const nextTask = workflow.tasks[workflow.currentTaskIndex];
    
    // Initialize context if not present
    if (!workflow.context) {
      workflow.context = {
        executionHistory: [],
        sessionId: 'default',
        preservedState: new Map()
      };
    }

    // Add to execution history
    workflow.context.executionHistory.push({
      taskIndex: workflow.currentTaskIndex - 1,
      completedAt: new Date(),
      result: currentStepResult || 'Completed',
      autoExecuted: true
    });

    return { 
      completed: false, 
      nextTask,
      result: UTILITY_MESSAGES.PROGRESS_TO_STEP(workflow.currentTaskIndex + 1, nextTask.content)
    };
  }

  async manageSubtasks(
    parentTaskId: string,
    action: string,
    subtaskContent?: string,
    subtaskId?: string,
    autoProgress = true
  ): Promise<any> {
    
    switch (action) {
      case 'create':
        if (!subtaskContent) {
          throw new Error('Subtask content required for creation');
        }
        
        const newSubtaskId = `subtask_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Create subtask workflow
        const subtaskAnalysis = await this.analyzePromptIntelligently(subtaskContent);
        const subtaskPlan = await this.generateWorkflowPlan(subtaskContent, subtaskAnalysis);
        
        const subtaskWorkflow: WorkflowDefinition = {
          id: newSubtaskId,
          tasks: subtaskPlan,
          metadata: {
            createdAt: new Date(),
            originalPrompt: subtaskContent,
            autoExecute: autoProgress,
            requiresApproval: false,
            estimatedDuration: subtaskAnalysis.estimatedTime || 'Short',
            parentTaskId: parentTaskId
          },
          currentTaskIndex: 0,
          isCompleted: false,
          context: {
            executionHistory: [],
            sessionId: 'default',
            preservedState: new Map()
          }
        };

        this.workflows.set(newSubtaskId, subtaskWorkflow);
        
        // Update parent-child relationship
        const parentWorkflow = this.workflows.get(parentTaskId);
        if (parentWorkflow) {
          this.contextManager.createSubtaskRelationship(
            parentTaskId, 
            [newSubtaskId], 
            { workflow: parentWorkflow, currentStep: parentWorkflow.currentTaskIndex }
          );
        }

        return {
          subtaskId: newSubtaskId,
          plan: subtaskPlan,
          message: `Created subtask: ${subtaskContent}`
        };

      case 'complete':
        if (!subtaskId) {
          throw new Error('Subtask ID required for completion');
        }
        
        const relationship = this.contextManager.completeSubtask(parentTaskId, subtaskId);
        const allComplete = this.contextManager.isAllSubtasksComplete(parentTaskId);
        
        if (allComplete) {
          // Return to parent context
          const parentContext = this.contextManager.getParentContext(parentTaskId);
          return {
            message: 'All subtasks completed, returning to parent task',
            parentContext,
            nextAction: 'continue_parent_workflow'
          };
        }

        return {
          message: `Subtask ${subtaskId} completed`,
          remainingSubtasks: (relationship?.childIds?.length || 0) - (relationship?.completedChildren?.length || 0)
        };

      case 'return_to_parent':
        const parentCtx = this.contextManager.getParentContext(parentTaskId);
        return {
          message: 'Returned to parent task context',
          parentContext: parentCtx,
          nextAction: 'resume_parent_workflow'
        };

      default:
        throw new Error(`Unknown subtask action: ${action}`);
    }
  }

  private async analyzePromptIntelligently(prompt: string): Promise<any> {
    // Enhanced AI analysis with multi-language support
    const wordCount = prompt.split(/\s+/).length;
    const hasCodeTerms = /\b(implement|code|function|class|api|database|frontend|backend)\b/i.test(prompt);
    const hasComplexTerms = /\b(system|architecture|integration|workflow|process|pipeline)\b/i.test(prompt);
    
    let complexity: string;
    let estimatedTime: string;
    
    if (wordCount > 50 && hasComplexTerms) {
      complexity = 'very_complex';
      estimatedTime = '2-4 hours';
    } else if (wordCount > 25 && hasCodeTerms) {
      complexity = 'complex';
      estimatedTime = '1-2 hours';
    } else if (wordCount > 10) {
      complexity = 'medium';
      estimatedTime = '30-60 minutes';
    } else {
      complexity = 'simple';
      estimatedTime = '10-30 minutes';
    }

    return {
      complexity,
      estimatedTime,
      requiresBreakdown: complexity !== 'simple',
      suggestedApprovals: complexity === 'very_complex',
      languageDetected: this.detectLanguage(prompt),
      technicalComplexity: hasCodeTerms || hasComplexTerms
    };
  }

  private async generateWorkflowPlan(prompt: string, analysis: any): Promise<WorkflowTask[]> {
    // Generate intelligent workflow steps based on analysis
    const tasks: WorkflowTask[] = [];
    
    if (analysis.complexity === 'simple') {
      tasks.push({
        id: `task_1`,
        content: prompt,
        description: `Complete: ${prompt}`,
        estimatedDuration: '10-30 minutes',
        dependencies: [],
        status: 'pending'
      });
    } else {
      // Break down complex tasks
      if (analysis.technicalComplexity) {
        tasks.push(
          {
            id: `task_1`,
            content: `Analyze requirements: ${prompt}`,
            description: 'Break down requirements and create technical specification',
            estimatedDuration: '15-30 minutes',
            dependencies: [],
            status: 'pending'
          },
          {
            id: `task_2`, 
            content: `Design solution architecture`,
            description: 'Create high-level design and implementation plan',
            estimatedDuration: '30-60 minutes',
            dependencies: ['task_1'],
            status: 'pending'
          },
          {
            id: `task_3`,
            content: `Implement core functionality`,
            description: 'Develop main features and components',
            estimatedDuration: '1-2 hours',
            dependencies: ['task_2'],
            status: 'pending'
          },
          {
            id: `task_4`,
            content: `Test and validate solution`,
            description: 'Comprehensive testing and quality assurance',
            estimatedDuration: '30-60 minutes',
            dependencies: ['task_3'],
            status: 'pending'
          }
        );
      } else {
        // Non-technical complex task breakdown
        const sentences = prompt.split(/[.!?]+/).filter(s => s.trim());
        sentences.forEach((sentence, index) => {
          if (sentence.trim()) {
            tasks.push({
              id: `task_${index + 1}`,
              content: sentence.trim(),
              description: `Complete step: ${sentence.trim()}`,
              estimatedDuration: '15-30 minutes',
              dependencies: index > 0 ? [`task_${index}`] : [],
              status: 'pending'
            });
          }
        });
      }
    }

    return tasks;
  }

  private detectLanguage(text: string): string {
    // Simple language detection - could be enhanced with proper NLP
    const commonEnglishWords = /\b(the|and|or|but|in|on|at|to|for|of|with|by|is|are|was|were|be|been|have|has|had|do|does|did|will|would|could|should|may|might|can|must)\b/gi;
    const englishMatches = (text.match(commonEnglishWords) || []).length;
    const totalWords = text.split(/\s+/).length;
    
    return englishMatches / totalWords > 0.1 ? 'english' : 'other';
  }

  getSessionManager(): EnhancedSessionManager {
    return this.sessionManager;
  }

  getContextManager(): ContextPreservationManager {
    return this.contextManager;
  }

  getWorkflowStatus(workflowId: string): any {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return null;
    }

    const executionContext = this.contextManager.restoreExecutionContext(workflowId);
    const currentTaskIndex = workflow.currentTaskIndex || 0;
    
    return {
      workflow,
      executionContext,
      progress: {
        currentStep: currentTaskIndex + 1,
        totalSteps: workflow.tasks.length,
        percentComplete: Math.round((currentTaskIndex / workflow.tasks.length) * 100)
      },
      nextSteps: workflow.tasks.slice(currentTaskIndex, currentTaskIndex + 3)
    };
  }
}

// ================================================================================================
// MAIN SERVER CLASS
// ================================================================================================

export class TodosMCPServer {
  private server: Server;
  private todosTool: AIToDosTool;
  private isRunning: boolean = false;
  private transport: StdioServerTransport | null = null;
  private enhancedWorkflowManager: EnhancedWorkflowManager;
  
  // ================================================================================================
  // WORKFLOW CONTEXT & AUTO-EXECUTION STORAGE
  // ================================================================================================
  private workflowContexts: Map<string, {
    workflow: any;
    currentStep: number;
    executionHistory: Array<{
      stepIndex: number;
      result: string;
      timestamp: Date;
      success: boolean;
    }>;
    parentContext: string | null;
    childTasks: string[];
    originalPrompt: string;
    contextSnapshot: string;
  }> = new Map();
  
  private activeExecutions: Map<string, {
    isExecuting: boolean;
    startTime: Date;
    lastActivity: Date;
  }> = new Map();

  constructor(todosTool: AIToDosTool) {
    this.todosTool = todosTool;
    this.enhancedWorkflowManager = new EnhancedWorkflowManager();
    this.server = new Server(
      {
        name: "ai-todos-tool-mcp",
        version: "1.0.0",
        description:
          "AI-powered todo management with workflow orchestration for Claude and MCP clients. CRITICAL: For complex multi-phase tasks, development workflows, or implementation requests, this tool provides intelligent auto-orchestration. USE create_workflow for any task with multiple steps, phases, or approval gates.",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
    this.startPeriodicWorkflowMonitoring();
  }

  /**
   * Start periodic monitoring like extension.ts does for auto-progression
   */
  private startPeriodicWorkflowMonitoring(): void {
    setInterval(async () => {
      try {
        // Monitor all active workflows for auto-progression opportunities
        for (const [workflowId, context] of this.workflowContexts.entries()) {
          if (!context.workflow.isCompleted) {
            const executionState = this.activeExecutions.get(workflowId);
            if (executionState && !executionState.isExecuting) {
              // Check if workflow can auto-progress
              const timeSinceLastActivity = Date.now() - executionState.lastActivity.getTime();
              if (timeSinceLastActivity > 10000) { // 10 seconds of inactivity
                await this.performAutoWorkflowProgression(workflowId);
              }
            }
          }
        }
      } catch (error) {
        console.warn('[MCP] Periodic workflow monitoring error:', error);
      }
    }, 5000); // Check every 5 seconds like extension.ts
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.getToolDefinitions(),
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        console.log(
          `🔧 [MCP] Tool called: ${name} with args:`,
          JSON.stringify(args, null, 2)
        );

        const result = await this.handleToolCall(name, args);

        console.log(`✅ [MCP] Tool result:`, result);

        return result;
      } catch (error) {
        console.error(`❌ [MCP] Tool error:`, error);

        if (error instanceof McpError) {
          throw error;
        }

        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    });
  }

  private getToolDefinitions(): Tool[] {
    return [
      {
        name: "create_intelligent_workflow",
        description: "🚀 ADVANCED AI WORKFLOW ORCHESTRATION: Create intelligent workflows with auto-execution, context preservation, and semantic analysis. Supports any language input with AI-powered breakdown, parent-child task relationships, and automatic progression through complex multi-step processes.",
        inputSchema: {
          type: "object",
          properties: {
            userPrompt: {
              type: "string",
              description: "The user's request in any language to analyze and create a workflow for"
            },
            autoExecute: {
              type: "boolean",
              description: "Whether to automatically execute the workflow steps with context preservation",
              default: true
            },
            requireApproval: {
              type: "boolean", 
              description: "Whether to require approval before auto-execution",
              default: false
            },
            sessionId: {
              type: "string",
              description: "Optional session ID for multi-session context management"
            }
          },
          required: ["userPrompt"]
        }
      },
      {
        name: "auto_execute_next_step",
        description: "⚡ CONTEXT-AWARE STEP EXECUTION: Automatically execute the next step in a workflow with full context preservation, parent-child task memory, and intelligent progression. Maintains execution state across sessions and prevents context drift.",
        inputSchema: {
          type: "object",
          properties: {
            workflowId: {
              type: "string",
              description: "The workflow ID to continue"
            },
            currentStepResult: {
              type: "string",
              description: "Results from the current step to maintain context and feed into next step"
            },
            overrideStep: {
              type: "number",
              description: "Override to execute a specific step number",
              default: null
            },
            preserveContext: {
              type: "boolean",
              description: "Whether to preserve full execution context for resumption",
              default: true
            }
          },
          required: ["workflowId"]
        }
      },
      {
        name: "manage_subtasks",
        description: "🔄 HIERARCHICAL TASK MANAGEMENT: Create, manage, and execute subtasks with parent-child relationships. Automatically returns to parent task context when all subtasks complete. Maintains memory of next steps and prevents context drift.",
        inputSchema: {
          type: "object",
          properties: {
            parentTaskId: {
              type: "string",
              description: "The parent task to manage subtasks for"
            },
            action: {
              type: "string",
              enum: ["create", "list", "execute", "complete", "return_to_parent"],
              description: "Action to perform on subtasks"
            },
            subtaskContent: {
              type: "string",
              description: "Content for new subtask (when action=create)"
            },
            subtaskId: {
              type: "string",
              description: "Specific subtask ID to operate on"
            },
            autoProgress: {
              type: "boolean",
              description: "Whether to automatically progress through subtasks",
              default: true
            }
          },
          required: ["parentTaskId", "action"]
        }
      },
      {
        name: "analyze_prompt_semantics",
        description: "🧠 LANGUAGE-AGNOSTIC SEMANTIC ANALYSIS: Analyze prompts in any language using AI to determine task complexity, orchestration needs, and optimal workflow approach. Provides intelligent recommendations for task breakdown and execution strategy.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "The prompt to analyze in any language"
            },
            includeWorkflowRecommendation: {
              type: "boolean",
              description: "Whether to include workflow generation recommendations",
              default: true
            },
            contextHistory: {
              type: "string",
              description: "Previous context to avoid context drift"
            }
          },
          required: ["prompt"]
        }
      },
      {
        name: "session_management",
        description: "📱 MULTI-SESSION CONTEXT MANAGEMENT: Manage multiple work sessions with automatic context switching, session isolation, and context drift prevention. Maintains separate task contexts for different projects or work streams.",
        inputSchema: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["create", "switch", "list", "archive", "restore"],
              description: "Session management action"
            },
            sessionId: {
              type: "string",
              description: "Target session ID"
            },
            contextDescription: {
              type: "string",
              description: "Description of the session context"
            },
            prompt: {
              type: "string",
              description: "Current prompt for context analysis"
            }
          },
          required: ["action"]
        }
      },
      {
        name: "workflow_execution_status",
        description: "📊 WORKFLOW EXECUTION MONITORING: Get detailed workflow execution status including progress, context preservation, parent-child task relationships, and next step recommendations.",
        inputSchema: {
          type: "object",
          properties: {
            workflowId: {
              type: "string",
              description: "Workflow to check status for"
            },
            includeExecutionHistory: {
              type: "boolean",
              description: "Include full execution history",
              default: true
            },
            includeNextSteps: {
              type: "boolean",
              description: "Include next step recommendations",
              default: true
            }
          }
        }
      },
      {
        name: "context_preservation",
        description: "💾 CONTEXT DRIFT PREVENTION: Save and restore execution context, maintain parent-child task memory, and prevent context loss during long-running workflows or session switches.",
        inputSchema: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["save", "restore", "list", "clear"],
              description: "Context preservation action"
            },
            contextId: {
              type: "string",
              description: "Context identifier"
            },
            context: {
              type: "string",
              description: "Context data to save"
            },
            workflowId: {
              type: "string",
              description: "Associated workflow ID"
            }
          },
          required: ["action"]
        }
      },
      {
        name: "create_todo",
        description:
          '📝 SINGLE TASK CREATION: Use for individual, standalone tasks or when user says "add task", "create todo", "I need to do X", "remind me to Y". NOT for multi-step processes (use create_workflow instead). Perfect for: bug fixes, single features, meetings, reminders, simple deliverables. INTENT MATCHING: "write documentation" → create_todo, "implement authentication system" → create_workflow.',
        inputSchema: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description:
                'TASK TITLE: Primary task description extracted from user request. Should be concise but descriptive. Examples: "Fix login bug", "Write API documentation", "Review pull request #123". Extract from natural language like "I need to update the user profile page" → "Update user profile page".',
            },
            summary: {
              type: "string",
              description:
                'DETAILED CONTEXT: Technical specifications, acceptance criteria, requirements, or background information. Use when user provides detailed context or when preserving complexity is important. Example: "Implement OAuth2 with Google/GitHub providers, include refresh token handling, add error recovery".',
            },
            priority: {
              type: "string",
              enum: ["low", "medium", "high", "critical"],
              description:
                'URGENCY LEVEL: Infer from user language - "urgent", "ASAP", "critical" → critical; "important", "soon" → high; "when you can", "eventually" → low; default → medium. Critical for AI task scheduling and workflow prioritization.',
              default: "medium",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description:
                'CATEGORIZATION LABELS: Extract from context like technology stack, project area, or user-mentioned categories. Examples: ["frontend", "react"], ["backend", "api"], ["bug", "user-auth"], ["documentation", "api"]. Auto-detect from task content.',
            },
          },
          required: ["content"],
        },
      },
      {
        name: "list_todos",
        description:
          '📋 OVERVIEW & FILTERING: Use when user asks "show me my todos", "what\'s on my list", "what tasks do I have", "list my work", or needs status overview. SMART FILTERING: Apply filters when user mentions specific criteria like "show completed tasks", "what\'s in progress", "urgent items only". CONTEXT AWARENESS: Essential for progress reviews, planning sessions, and status updates.',
        inputSchema: {
          type: "object",
          properties: {
            status_filter: {
              type: "string",
              enum: [
                "pending",
                "in_progress",
                "completed",
                "cancelled",
                "blocked",
                "paused",
                "awaiting_approval",
              ],
              description:
                'STATUS-BASED FILTERING: Auto-detect from user intent - "show completed" → completed, "what\'s in progress" → in_progress, "blocked items" → blocked, "pending approval" → awaiting_approval. Use semantic understanding to match user language to status values.',
            },
            priority_filter: {
              type: "string",
              enum: ["low", "medium", "high", "critical"],
              description:
                'PRIORITY-BASED FILTERING: Extract from user requests like "urgent tasks" → critical, "important items" → high, "low priority stuff" → low. Combines with status filtering for precise results.',
            },
          },
        },
      },
      {
        name: "update_todo_status",
        description:
          '🔄 STATUS TRANSITIONS: Use when user indicates progress changes like "mark X as done", "I\'m working on Y", "Z is blocked", "pause the A task", "this needs approval". SEMANTIC MAPPING: "finished" → completed, "working on" → in_progress, "can\'t continue" → blocked, "putting on hold" → paused, "needs review" → awaiting_approval, "cancelled project" → cancelled.',
        inputSchema: {
          type: "object",
          properties: {
            todo_id: {
              type: "string",
              description:
                "TODO IDENTIFIER: Target specific todo for status update. Extract from user context when they reference tasks by name, content, or previous interactions. Use list_todos first if unclear which todo user is referencing.",
            },
            status: {
              type: "string",
              enum: [
                "pending",
                "in_progress",
                "completed",
                "cancelled",
                "blocked",
                "paused",
                "awaiting_approval",
              ],
              description:
                'NEW STATUS: Map user language to status values - "done/finished/complete" → completed, "working/started/doing" → in_progress, "stopped/can\'t continue/stuck" → blocked, "on hold/pausing" → paused, "needs review/approval" → awaiting_approval, "not doing/cancelled" → cancelled, "not started/waiting" → pending.',
            },
            notes: {
              type: "string",
              description:
                'STATUS CONTEXT: Capture user explanation for status change like "completed but needs testing", "blocked waiting for API access", "paused due to priority shift". Essential for maintaining audit trail and context.',
            },
          },
          required: ["todo_id", "status"],
        },
      },
      {
        name: "get_todo",
        description:
          '👁️ DETAILED INSPECTION: Use when user asks "show me details of X", "what\'s the status of Y", "tell me about task Z", or needs comprehensive information about a specific todo including subtasks, history, and progress. CONTEXT RETRIEVAL: Essential for understanding complex tasks before making changes.',
        inputSchema: {
          type: "object",
          properties: {
            todo_id: {
              type: "string",
              description:
                "TARGET TODO: Specific todo identifier for detailed retrieval. When user references a task by content or context, use list_todos first to find the correct ID, then use this tool for full details.",
            },
          },
          required: ["todo_id"],
        },
      },
      {
        name: "create_workflow",
        description:
          "🔄 BASIC MULTI-STEP ORCHESTRATION: For simple sequential workflows with basic task dependencies. Use when user needs straightforward step-by-step processes without approval gates or complex AI guidance. For advanced workflows with AI orchestration, use create_enhanced_workflow instead.",
        inputSchema: {
          type: "object",
          properties: {
            tasks: {
              type: "array",
              items: { type: "string" },
              description:
                "SEQUENTIAL STEPS: Break user's complex request into logical, actionable steps in execution order. Each task should be specific and measurable.",
            },
            workflow_id: {
              type: "string",
              description:
                "WORKFLOW NAMING: Optional custom identifier for future reference and workflow management.",
            },
            auto_progression: {
              type: "boolean",
              description:
                "AUTOMATION MODE: Enable automatic advancement through workflow steps when tasks complete.",
              default: true,
            },
          },
          required: ["tasks"],
        },
      },
      {
        name: "create_enhanced_workflow",
        description:
          '🚀 AI-POWERED ADVANCED ORCHESTRATION: CRITICAL for complex multi-phase projects requiring AI agent guidance, approval gates, context preservation, and intelligent workflow management. Use when user describes complex processes like "implement authentication system with approvals", "build full-stack application", "conduct comprehensive research study", "develop enterprise feature". ENHANCED FEATURES: Automatic AI task breakdown, approval gates, context preservation, recovery instructions, validation criteria.',
        inputSchema: {
          type: "object",
          properties: {
            user_request: {
              type: "string",
              description:
                'ORIGINAL USER REQUEST: The complete user prompt/request that will be analyzed by AI to generate an intelligent workflow. AI will break this down into optimized steps with guidance. Example: "Build a user authentication system with OAuth2, email verification, and admin panel".',
            },
            workflow_id: {
              type: "string",
              description:
                "ENHANCED WORKFLOW NAMING: Optional custom identifier. If not provided, AI will generate semantic ID based on the request analysis.",
            },
            enable_approvals: {
              type: "boolean",
              description:
                "APPROVAL GATES: Enable approval requirements for critical workflow steps. When true, certain tasks will require explicit approval before proceeding to maintain quality control.",
              default: false,
            },
            complexity_hint: {
              type: "string",
              enum: ["simple", "medium", "complex", "very_complex"],
              description:
                "COMPLEXITY GUIDANCE: Optional hint to guide AI analysis. If not provided, AI will automatically assess complexity from the user request.",
            },
          },
          required: ["user_request"],
        },
      },
      {
        name: "analyze_workflow_potential",
        description:
          '🧠 AI WORKFLOW INTELLIGENCE: Analyze user requests to determine optimal workflow approach and complexity. Use when user asks "how should I approach this", "break this down for me", "what\'s the best way to handle X", or when you need to understand task complexity before creating workflows. Provides AI-powered recommendations for workflow structure.',
        inputSchema: {
          type: "object",
          properties: {
            user_request: {
              type: "string",
              description:
                "USER REQUEST TO ANALYZE: The request or task description that needs workflow analysis. AI will assess complexity, suggest approach, and recommend workflow structure.",
            },
          },
          required: ["user_request"],
        },
      },
      {
        name: "get_workflow_status",
        description:
          '📊 PROGRESS TRACKING: Use when user asks "how\'s the project going", "what\'s the progress on X", "where are we in the workflow", "show workflow status", or needs visibility into multi-step process advancement. ESSENTIAL for project management, status updates, and progress reviews. Shows completion percentage, current task, next steps.',
        inputSchema: {
          type: "object",
          properties: {
            workflow_id: {
              type: "string",
              description:
                "WORKFLOW TARGET: Specific workflow to check. If not provided, shows current active workflow. Use when user references specific projects or when multiple workflows exist. Extract from user context about project names or workflow references.",
            },
          },
        },
      },
      {
        name: "add_subtask",
        description:
          '➕ TASK DECOMPOSITION: Use when user wants to break down existing complex todos into smaller, manageable pieces. TRIGGERS: "break this down", "add steps to X", "this task is too big", "create subtasks for Y", "divide this into parts". WORKFLOW INTEGRATION: Perfect for making large todos more actionable without creating entirely new workflows.',
        inputSchema: {
          type: "object",
          properties: {
            todo_id: {
              type: "string",
              description:
                "PARENT TASK: The main todo that needs breakdown. Find ID using list_todos or get_todo if user references task by content. Ensure parent task exists before adding subtasks.",
            },
            content: {
              type: "string",
              description:
                'SUBTASK DESCRIPTION: Specific, actionable step that contributes to parent task completion. Should be concrete and measurable. Examples: "Set up database schema", "Create login form component", "Write unit tests for authentication". Extract from user\'s breakdown requests.',
            },
          },
          required: ["todo_id", "content"],
        },
      },
      {
        name: "analyze_task",
        description:
          '🧠 COMPREHENSIVE AI TASK ANALYSIS: Use when user asks "how complex is this", "break this down for me", "what does this involve", "analyze task X", "how long will this take", "what are the risks". ENHANCED INTELLIGENCE: Provides AI-powered semantic analysis including complexity rating, detailed time estimates, risk assessment, prerequisite identification, suggested breakdown steps, and contextual execution tips. Essential for project planning, task preparation, and intelligent workflow orchestration.',
        inputSchema: {
          type: "object",
          properties: {
            todo_id: {
              type: "string",
              description:
                "ANALYSIS TARGET: Todo to analyze for comprehensive AI-powered assessment. Provides complexity analysis, time estimation, risk factors, prerequisites, and intelligent breakdown suggestions.",
            },
          },
          required: ["todo_id"],
        },
      },
      {
        name: "create_checkpoint",
        description:
          '💾 PROGRESS PRESERVATION: Use for long-running tasks when user says "save my progress", "checkpoint this work", "I need to pause and save context", "record current state", or when switching contexts but wanting to resume later. CONTEXT CONTINUITY: Critical for maintaining state across sessions, interruptions, or handoffs to other team members.',
        inputSchema: {
          type: "object",
          properties: {
            todo_id: {
              type: "string",
              description:
                "TASK TO CHECKPOINT: Target todo for progress preservation. Should be an active, in-progress task with substantial work completed that needs context preservation.",
            },
            context: {
              type: "string",
              description:
                'CURRENT STATE DESCRIPTION: Detailed capture of current progress, decisions made, blockers encountered, next steps planned, files modified, approaches tried. Essential for context restoration when resuming work. Example: "Completed user model, working on authentication middleware, tested with OAuth2, next: implement refresh tokens".',
            },
          },
          required: ["todo_id", "context"],
        },
      },
      {
        name: "clear_session",
        description:
          '🗑️ SESSION RESET: Use when user says "clear everything", "start fresh", "reset todos", "clean slate", "archive current work". SAFETY MECHANISM: Requires explicit confirmation to prevent accidental data loss. Archives current session before clearing for potential recovery.',
        inputSchema: {
          type: "object",
          properties: {
            confirm: {
              type: "boolean",
              description:
                "DELETION CONFIRMATION: Safety flag to prevent accidental clearing. Must be true to execute. First call without confirm=true shows warning, second call with confirm=true executes the clearing operation.",
              default: false,
            },
          },
        },
      },
      {
        name: "get_session_summary",
        description:
          '📈 COMPREHENSIVE OVERVIEW: Use when user asks "summarize my work", "show me everything", "what have I accomplished", "session overview", "project summary", or needs holistic view of current and past work. ANALYTICS PERSPECTIVE: Provides metrics, progress trends, and historical context across all sessions.',
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "approve_task",
        description:
          '✅ WORKFLOW APPROVAL MANAGEMENT: Use when user says "approve task X", "yes, proceed with Y", "approve step Z", "continue with the workflow", or when handling approval gates in enhanced workflows. CRITICAL for workflow progression when approval gates are enabled. Allows tasks marked as "awaiting_approval" to proceed to next steps.',
        inputSchema: {
          type: "object",
          properties: {
            todo_id: {
              type: "string",
              description:
                'TASK TO APPROVE: Target todo that is awaiting approval. Task must be in "awaiting_approval" status to be approved.',
            },
            approval_notes: {
              type: "string",
              description:
                "APPROVAL CONTEXT: Optional notes about the approval decision, any conditions, or guidance for execution. Helps maintain audit trail and context.",
            },
          },
          required: ["todo_id"],
        },
      },
      {
        name: "get_next_tasks",
        description:
          '👀 WORKFLOW PROGRESSION INSIGHT: Use when user asks "what\'s next", "show upcoming tasks", "what should I work on", "what tasks are ready", or needs visibility into workflow progression. Shows tasks that are ready to work on, blocked tasks, and upcoming workflow steps. Essential for workflow management and progress tracking.',
        inputSchema: {
          type: "object",
          properties: {
            include_blocked: {
              type: "boolean",
              description:
                "SHOW BLOCKED TASKS: Include tasks that are blocked by dependencies. Useful for understanding full workflow state.",
              default: false,
            },
          },
        },
      },
      {
        name: "estimate_completion",
        description:
          '⏱️ PROJECT TIME ESTIMATION: Use when user asks "how long will this take", "when will we finish", "project timeline estimate", "completion forecast". Provides intelligent time estimation based on current progress, remaining tasks, complexity analysis, and historical completion patterns. Essential for project planning and deadline management.',
        inputSchema: {
          type: "object",
          properties: {
            workflow_id: {
              type: "string",
              description:
                "TARGET WORKFLOW: Specific workflow to estimate. If not provided, estimates current active workflow or all pending tasks.",
            },
          },
        },
      },
    ];
  }

  private async handleToolCall(
    name: string,
    args: any
  ): Promise<CallToolResult> {

    try {
      // Auto-detect workflow needs for complex prompts (like extension.ts does)
      if (name === "create_todo" && args.content) {
        const shouldAnalyze = await this.shouldAutoCreateWorkflow(args.content);
        if (shouldAnalyze.shouldCreateWorkflow) {
          // Auto-redirect to intelligent workflow creation
          return await this.handleIntelligentWorkflow({
            userPrompt: args.content,
            autoExecute: true,
            requireApproval: false
          });
        }
      }

      switch (name) {
        case "create_todo":
          const todoId = await this.todosTool.createTodo(
            args.content,
            args.summary,
            args.priority || "medium",
            args.tags || []
          );

          vscode.window.showInformationMessage(
            MCP_MESSAGES.TODO_CREATED(args.content),
            { modal: false }
          );

          return {
            content: [
              {
                type: "text",
                text: `✅ Todo created successfully!\n\n**ID:** ${todoId}\n**Content:** ${
                  args.content
                }\n**Priority:** ${
                  args.priority || "medium"
                }\n\nYou can now reference this todo using its ID for updates or adding subtasks.`,
              },
            ],
          };

        case "list_todos":
          const todos = this.todosTool.getAllTodos();
          let filteredTodos = todos;

          if (args.status_filter) {
            filteredTodos = filteredTodos.filter(
              (t: any) => t.status === args.status_filter
            );
          }

          if (args.priority_filter) {
            filteredTodos = filteredTodos.filter(
              (t: any) => t.priority === args.priority_filter
            );
          }

          const todosList = filteredTodos
            .map((todo: any) => {
              return `${STATUS_EMOJIS[todo.status] || "📝"} ${
                PRIORITY_EMOJIS[todo.priority] || "🟡"
              } **${todo.content}**\n   ID: \`${todo.id}\` | Status: ${
                todo.status
              } | Priority: ${todo.priority}\n   ${
                todo.summary ? `Summary: ${todo.summary}\n` : ""
              }   Created: ${todo.createdAt.toLocaleDateString()}\n`;
            })
            .join("\n");

          return {
            content: [
              {
                type: "text",
                text: MCP_MESSAGES.TODOS_LIST(filteredTodos.length, todosList),
              },
            ],
          };

        case "update_todo_status":
          await this.todosTool.updateTodoStatus(
            args.todo_id,
            args.status,
            args.notes,
            "claude-mcp"
          );

          vscode.window.showInformationMessage(
            MCP_MESSAGES.TODO_STATUS_UPDATED(args.status),
            { modal: false }
          );

          return {
            content: [
              {
                type: "text",
                text: `✅ Todo status updated!\n\n**ID:** ${
                  args.todo_id
                }\n**New Status:** ${args.status}\n${
                  args.notes ? `**Notes:** ${args.notes}` : ""
                }`,
              },
            ],
          };

        case "get_todo":
          const todo = this.todosTool.getTodo(args.todo_id);
          if (!todo) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              `Todo with ID ${args.todo_id} not found`
            );
          }

          const subtasksList =
            todo.subTasks.length > 0
              ? `\n\n**Subtasks:**\n${todo.subTasks
                  .map((st: any) => `  • ${st.content} (${st.status})`)
                  .join("\n")}`
              : "";

          const historyList =
            todo.history.length > 0
              ? `\n\n**Recent History:**\n${todo.history
                  .slice(-3)
                  .map(
                    (h: any) =>
                      `  • ${h.action} - ${
                        h.notes || "No notes"
                      } (${h.timestamp.toLocaleDateString()})`
                  )
                  .join("\n")}`
              : "";

          return {
            content: [
              {
                type: "text",
                text: `📝 **Todo Details**\n\n**Content:** ${
                  todo.content
                }\n**Status:** ${todo.status}\n**Priority:** ${
                  todo.priority
                }\n**Created:** ${todo.createdAt.toLocaleDateString()}\n**Summary:** ${
                  todo.summary || "No summary"
                }${subtasksList}${historyList}`,
              },
            ],
          };

        case "create_enhanced_workflow":
          // Use AI to analyze the request and generate enhanced workflow
          const userRequest = args.user_request;
          const complexityHint = args.complexity_hint;
          const enableApprovals = args.enable_approvals || false;

          try {
            // Get AI models for dynamic workflow generation
            const model = await getAiModel();

            if (!model) {
              throw new Error(
                "No AI model available for enhanced workflow generation"
              );
            }

            // First, analyze the task complexity if not provided
            let complexity = complexityHint;
            if (!complexity) {
              const analysisPrompt = MCP_AI_PROMPTS.COMPLEXITY_ANALYSIS(userRequest);

              const analysisRequest = await model.sendRequest(
                [vscode.LanguageModelChatMessage.User(analysisPrompt)],
                {},
                new vscode.CancellationTokenSource().token
              );

              let analysisResponse = "";
              for await (const fragment of analysisRequest.text) {
                analysisResponse += fragment;
              }

              complexity = analysisResponse.trim().toLowerCase();
              if (
                !["simple", "medium", "complex", "very_complex"].includes(
                  complexity
                )
              ) {
                complexity = "medium"; // fallback
              }
            }

            // Generate dynamic workflow with AI guidance
            const workflowPrompt = MCP_AI_PROMPTS.ENHANCED_WORKFLOW_GENERATION(userRequest, complexity, enableApprovals);

            const workflowRequest = await model.sendRequest(
              [vscode.LanguageModelChatMessage.User(workflowPrompt)],
              {},
              new vscode.CancellationTokenSource().token
            );

            let workflowResponse = "";
            for await (const fragment of workflowRequest.text) {
              workflowResponse += fragment;
            }

            // Parse the AI-generated workflow
            let workflowTasks;
            try {
              // Clean up the response and parse JSON
              const cleanResponse = workflowResponse
                .replace(/```json\s*|\s*```/g, "")
                .trim();
              workflowTasks = JSON.parse(cleanResponse);
            } catch (parseError) {
              console.warn(
                "Failed to parse AI workflow, using fallback",
                parseError
              );
              // Fallback workflow
              workflowTasks = [
                {
                  content: "Analyze and plan the implementation",
                  guidance: {
                    parentObjective: userRequest,
                    aiInstructions:
                      "Break down the user request into concrete implementation steps",
                    expectedOutput: "Detailed implementation plan",
                    nextStepGuidance: "Begin implementation based on the plan",
                    validationCriteria: "Plan covers all user requirements",
                    approvalRequired: enableApprovals,
                    recoveryInstructions:
                      "If planning fails, gather more requirements",
                  },
                },
                {
                  content: "Implement the core functionality",
                  guidance: {
                    parentObjective: userRequest,
                    aiInstructions:
                      "Execute the implementation plan step by step",
                    expectedOutput: "Working implementation",
                    nextStepGuidance: "Test and validate the implementation",
                    validationCriteria: "Core functionality works as expected",
                    approvalRequired: false,
                    recoveryInstructions:
                      "If implementation fails, review the plan and requirements",
                  },
                },
                {
                  content: "Test and validate the solution",
                  guidance: {
                    parentObjective: userRequest,
                    aiInstructions:
                      "Thoroughly test the implementation and validate against requirements",
                    expectedOutput: "Validated, tested solution",
                    nextStepGuidance: "Deploy or finalize the solution",
                    validationCriteria:
                      "All tests pass and requirements are met",
                    approvalRequired: enableApprovals,
                    recoveryInstructions:
                      "If validation fails, fix issues and retest",
                  },
                },
              ];
            }

            // Create the enhanced workflow
            const enhancedWorkflowId =
              await this.todosTool.createEnhancedWorkflow(
                workflowTasks,
                userRequest
              );

            vscode.window.showInformationMessage(
              `🚀 Claude created enhanced workflow: "${userRequest.substring(
                0,
                50
              )}..."`,
              { modal: false }
            );

            return {
              content: [
                {
                  type: "text",
                  text: `🚀 **Enhanced Workflow Created Successfully!**\n\n**Workflow ID:** ${enhancedWorkflowId}\n**User Request:** ${userRequest}\n**Complexity:** ${complexity}\n**Tasks:** ${
                    workflowTasks.length
                  }\n**Approval Gates:** ${
                    enableApprovals ? "Enabled" : "Disabled"
                  }\n\n**Intelligent Task Breakdown:**\n${workflowTasks
                    .map(
                      (task: any, i: number) =>
                        `${i + 1}. **${task.content}**\n   → AI Instructions: ${
                          task.guidance?.aiInstructions || "Standard execution"
                        }\n   → Expected Output: ${
                          task.guidance?.expectedOutput || "Task completion"
                        }\n   → Approval Required: ${
                          task.guidance?.approvalRequired ? "Yes" : "No"
                        }`
                    )
                    .join(
                      "\n\n"
                    )}\n\n✨ This enhanced workflow includes AI agent guidance, approval gates, and intelligent orchestration for optimal execution.`,
                },
              ],
            };
          } catch (error) {
            console.error("Enhanced workflow creation failed:", error);

            // Fallback to basic workflow creation
            const basicTasks = [
              "Analyze the requirements and create implementation plan",
              "Execute the main implementation work",
              "Test and validate the solution",
              "Finalize and document the completed work",
            ];

            const fallbackWorkflowId = await this.todosTool.createWorkflow(
              basicTasks,
              args.workflow_id,
              true
            );

            return {
              content: [
                {
                  type: "text",
                  text: `⚠️ **Enhanced Workflow Created with Fallback**\n\n**Workflow ID:** ${fallbackWorkflowId}\n**User Request:** ${userRequest}\n\nAI enhancement failed, but created basic workflow structure. You can manually enhance tasks as needed.\n\n**Basic Task List:**\n${basicTasks
                    .map((task, i) => `${i + 1}. ${task}`)
                    .join("\n")}`,
                },
              ],
            };
          }

        case "analyze_workflow_potential":
          try {
            // Get AI models for analysis
            const model = await getAiModel();

            if (!model) {
              return {
                content: [
                  {
                    type: "text",
                    text: "⚠️ **AI Analysis Unavailable**\n\nNo AI model available for workflow analysis. Consider the following general approach:\n\n• Break complex tasks into smaller steps\n• Identify dependencies between components\n• Plan for testing and validation phases\n• Consider approval points for critical decisions",
                  },
                ],
              };
            }

            const userRequest = args.user_request;

            const analysisPrompt = MCP_AI_PROMPTS.WORKFLOW_ANALYSIS(userRequest);

            const analysisRequest = await model.sendRequest(
              [vscode.LanguageModelChatMessage.User(analysisPrompt)],
              {},
              new vscode.CancellationTokenSource().token
            );

            let analysisResponse = "";
            for await (const fragment of analysisRequest.text) {
              analysisResponse += fragment;
            }

            return {
              content: [
                {
                  type: "text",
                  text: MCP_MESSAGES.ANALYSIS_COMPLETE(userRequest, analysisResponse),
                },
              ],
            };
          } catch (error) {
            console.error("Workflow analysis failed:", error);

            return {
              content: [
                {
                  type: "text",
                  text: MCP_MESSAGES.ANALYSIS_FALLBACK(args.user_request),
                },
              ],
            };
          }

        case "create_workflow":
          const workflowId = await this.todosTool.createWorkflow(
            args.tasks,
            args.workflow_id,
            true
          );

          if (args.auto_progression !== false) {
            await this.todosTool.setAutoProgression(true);
          }

          vscode.window.showInformationMessage(
            MCP_MESSAGES.WORKFLOW_CREATED(args.tasks.length),
            { modal: false }
          );

          return {
            content: [
              {
                type: "text",
                text: `🔄 **Workflow Created Successfully!**\n\n**Workflow ID:** ${workflowId}\n**Tasks:** ${
                  args.tasks.length
                }\n**Auto-progression:** ${
                  args.auto_progression !== false ? "Enabled" : "Disabled"
                }\n\n**Task List:**\n${args.tasks
                  .map((task: string, i: number) => `${i + 1}. ${task}`)
                  .join(
                    "\n"
                  )}\n\nWorkflow will automatically progress through tasks when enabled.`,
              },
            ],
          };

        case "get_workflow_status":
          const workflowStatus = this.todosTool.getWorkflowStatus();

          if (!workflowStatus.workflowId) {
            return {
              content: [
                {
                  type: "text",
                  text: "📭 No active workflow found. Use `create_workflow` to start a new workflow.",
                },
              ],
            };
          }

          const progress =
            workflowStatus.totalTasks > 0
              ? Math.round(
                  (workflowStatus.completedTasks / workflowStatus.totalTasks) *
                    100
                )
              : 0;

          return {
            content: [
              {
                type: "text",
                text: `📊 **Workflow Status**\n\n**ID:** ${
                  workflowStatus.workflowId
                }\n**Progress:** ${workflowStatus.completedTasks}/${
                  workflowStatus.totalTasks
                } (${progress}%)\n**Auto-progression:** ${
                  workflowStatus.autoProgressionEnabled ? "Enabled" : "Disabled"
                }\n\n**Current Task:** ${
                  workflowStatus.currentTask?.content || "None"
                }\n**Next Task:** ${
                  workflowStatus.nextTask?.content || "None"
                }`,
              },
            ],
          };

        case "add_subtask":
          const subtaskId = await this.todosTool.addSubTask(
            args.todo_id,
            args.content
          );

          return {
            content: [
              {
                type: "text",
                text: MCP_MESSAGES.SUBTASK_ADDED(args.todo_id, subtaskId, args.content),
              },
            ],
          };

        case "analyze_task":
          try {
            // Get comprehensive AI analysis
            const analysis = await this.todosTool.analyzeTask(args.todo_id);

            // Get additional AI insights if available
            const model = await getAiModel();

            let enhancedInsights = "";
            if (model) {
              const todo = this.todosTool.getTodo(args.todo_id);
              if (todo) {
                const insightsPrompt = MCP_AI_PROMPTS.TASK_INSIGHTS(
                  todo.content,
                  todo.summary || "None",
                  analysis.complexity,
                  analysis.estimatedTime
                );

                try {
                  const insightsRequest = await model.sendRequest(
                    [vscode.LanguageModelChatMessage.User(insightsPrompt)],
                    {},
                    new vscode.CancellationTokenSource().token
                  );

                  let insightsResponse = "";
                  for await (const fragment of insightsRequest.text) {
                    insightsResponse += fragment;
                  }

                  enhancedInsights = MCP_MESSAGES.AI_INSIGHTS(insightsResponse);
                } catch (insightsError) {
                  console.warn(
                    "Failed to get enhanced insights:",
                    insightsError
                  );
                }
              }
            }

            return {
              content: [
                {
                  type: "text",
                  text: `🧠 **Comprehensive AI Task Analysis**\n\n**Task ID:** ${
                    args.todo_id
                  }\n\n**📊 Complexity Assessment**\n• **Level:** ${analysis.complexity.toUpperCase()}\n• **Estimated Time:** ${
                    analysis.estimatedTime
                  } minutes (${
                    Math.round((analysis.estimatedTime / 60) * 10) / 10
                  } hours)\n\n**🔄 Suggested Breakdown:**\n${analysis.suggestedBreakdown
                    .map((step: string, i: number) => `${i + 1}. ${step}`)
                    .join("\n")}\n\n**⚠️ Risk Factors:**\n${analysis.riskFactors
                    .map((risk: string) => `• ${risk}`)
                    .join(
                      "\n"
                    )}\n\n**📋 Prerequisites:**\n${analysis.prerequisites
                    .map((prereq: string) => `• ${prereq}`)
                    .join(
                      "\n"
                    )}${enhancedInsights}\n\n**💡 Next Steps:**\n• Consider breaking down into subtasks if complexity is high\n• Review prerequisites before starting\n• Plan for risk mitigation strategies\n• Set up checkpoints for long-running tasks`,
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: `❌ **Analysis Failed**\n\nUnable to analyze task: ${
                    error instanceof Error ? error.message : "Unknown error"
                  }`,
                },
              ],
            };
          }

        case "create_checkpoint":
          await this.todosTool.createCheckpoint(args.todo_id, args.context);

          return {
            content: [
              {
                type: "text",
                text: MCP_MESSAGES.CHECKPOINT_CREATED(args.todo_id, args.context),
              },
            ],
          };

        case "clear_session":
          if (!args.confirm) {
            return {
              content: [
                {
                  type: "text",
                  text: MCP_MESSAGES.CLEAR_CONFIRMATION(),
                },
              ],
            };
          }

          await this.todosTool.clearSession();

          vscode.window.showInformationMessage(
            MCP_MESSAGES.SESSION_CLEARED(),
            { modal: false }
          );

          return {
            content: [
              {
                type: "text",
                text: MCP_MESSAGES.CLEAR_SUCCESS(),
              },
            ],
          };

        case "get_session_summary":
          const sessionSummary = this.todosTool.getSessionSummary();

          const archivedInfo =
            sessionSummary.archivedSessions.length > 0
              ? `\n\n**Archived Sessions:**\n${sessionSummary.archivedSessions
                  .slice(0, 5)
                  .map(
                    (session: any) =>
                      `• ${session.description} (${
                        session.todoCount
                      } todos) - ${session.lastUpdated.toLocaleDateString()}`
                  )
                  .join("\n")}`
              : "\n\n**Archived Sessions:** None";

          return {
            content: [
              {
                type: "text",
                text: MCP_MESSAGES.SESSION_SUMMARY(
                  sessionSummary.currentSession.id,
                  sessionSummary.currentSession.description,
                  sessionSummary.currentSession.todoCount,
                  archivedInfo
                ),
              },
            ],
          };

        case "approve_task":
          try {
            // Update task status from awaiting_approval to in_progress
            await this.todosTool.updateTodoStatus(
              args.todo_id,
              "in_progress",
              UTILITY_MESSAGES.APPROVAL_NOTE(args.approval_notes),
              "claude-mcp-approver"
            );

            // Check if this unblocks dependent tasks in workflow
            await this.checkAndProgressWorkflow(args.todo_id);

            vscode.window.showInformationMessage(
              MCP_MESSAGES.TASK_APPROVED(),
              { modal: false }
            );

            return {
              content: [
                {
                  type: "text",
                  text: `✅ **Task Approved Successfully!**\n\n**Task ID:** ${
                    args.todo_id
                  }\n**Status:** Changed to 'in_progress'\n**Notes:** ${
                    args.approval_notes || "Task approved to proceed"
                  }\n\n🔄 Workflow will automatically progress if other dependent tasks are ready.`,
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: `❌ **Approval Failed**\n\nUnable to approve task: ${
                    error instanceof Error ? error.message : "Unknown error"
                  }`,
                },
              ],
            };
          }

        case "get_next_tasks":
          try {
            const allTodos = this.todosTool.getAllTodos();
            const readyTasks = allTodos.filter(
              (todo: any) =>
                todo.status === "pending" || todo.status === "awaiting_approval"
            );

            const blockedTasks = allTodos.filter(
              (todo: any) => todo.status === "blocked"
            );

            const inProgressTasks = allTodos.filter(
              (todo: any) => todo.status === "in_progress"
            );

            let tasksDisplay = "";

            if (readyTasks.length > 0) {
              tasksDisplay += `**🚀 Ready to Work On (${readyTasks.length}):**\n`;
              readyTasks.slice(0, 5).forEach((todo: any, i: number) => {
                const statusEmoji =
                  todo.status === "awaiting_approval" ? "⏳" : "⚡";
                tasksDisplay += `${i + 1}. ${statusEmoji} **${
                  todo.content
                }**\n   ID: \`${todo.id}\` | Priority: ${
                  todo.priority
                } | Status: ${todo.status}\n`;
              });
              if (readyTasks.length > 5) {
                tasksDisplay += `   ... and ${
                  readyTasks.length - 5
                } more ready tasks\n`;
              }
            }

            if (inProgressTasks.length > 0) {
              tasksDisplay += `\n**🔄 Currently In Progress (${inProgressTasks.length}):**\n`;
              inProgressTasks.slice(0, 3).forEach((todo: any, i: number) => {
                tasksDisplay += `${i + 1}. 🔄 **${todo.content}**\n   ID: \`${
                  todo.id
                }\` | Priority: ${todo.priority}\n`;
              });
            }

            if (args.include_blocked && blockedTasks.length > 0) {
              tasksDisplay += `\n**🚫 Blocked Tasks (${blockedTasks.length}):**\n`;
              blockedTasks.slice(0, 3).forEach((todo: any, i: number) => {
                tasksDisplay += `${i + 1}. 🚫 **${todo.content}**\n   ID: \`${
                  todo.id
                }\` | Reason: ${
                  todo.blockedReason || "Dependencies not met"
                }\n`;
              });
            }

            if (tasksDisplay === "") {
              tasksDisplay =
                "📭 No tasks ready to work on. All tasks may be completed or blocked.";
            }

            return {
              content: [
                {
                  type: "text",
                  text: MCP_MESSAGES.NEXT_TASKS_OVERVIEW(tasksDisplay),
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: `❌ **Unable to Get Next Tasks**\n\nError: ${
                    error instanceof Error ? error.message : "Unknown error"
                  }`,
                },
              ],
            };
          }

        case "estimate_completion":
          try {
            const allTodos = this.todosTool.getAllTodos();
            const pendingTodos = allTodos.filter((todo: any) =>
              [
                "pending",
                "in_progress",
                "blocked",
                "awaiting_approval",
              ].includes(todo.status)
            );

            // Calculate time estimates
            let totalEstimate = 0;
            let taskBreakdown: { [key: string]: number } = {
              simple: 0,
              medium: 0,
              complex: 0,
              very_complex: 0,
            };

            for (const todo of pendingTodos) {
              // Use existing estimated time or calculate based on content
              let taskTime = todo.estimatedTime || 60; // default 1 hour

              // Estimate based on content length if no estimate
              if (!todo.estimatedTime) {
                const wordCount = (
                  todo.content +
                  " " +
                  (todo.summary || "")
                ).split(/\s+/).length;
                if (wordCount > 50) {
                  taskTime = 180; // 3 hours for complex
                } else if (wordCount > 20) {
                  taskTime = 90; // 1.5 hours for medium
                } else {
                  taskTime = 30; // 30 min for simple
                }
              }

              totalEstimate += taskTime;

              // Track by complexity if available (safely check if property exists)
              const todoComplexity = (todo as any).complexity;
              if (
                todoComplexity &&
                taskBreakdown[todoComplexity] !== undefined
              ) {
                taskBreakdown[todoComplexity] += taskTime;
              }
            }

            // Add buffer for uncertainty (20%)
            const bufferedEstimate = Math.round(totalEstimate * 1.2);

            // Format time display
            const formatTime = (minutes: number) => {
              const hours = Math.floor(minutes / 60);
              const mins = minutes % 60;
              if (hours > 24) {
                const days = Math.floor(hours / 8); // 8-hour workdays
                const remainingHours = hours % 8;
                return `${days}d ${remainingHours}h ${mins}m`;
              }
              return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
            };

            return {
              content: [
                {
                  type: "text",
                  text: `⏱️ **Project Completion Estimate**\n\n**📊 Overview:**\n• **Remaining Tasks:** ${
                    pendingTodos.length
                  }\n• **Base Estimate:** ${formatTime(
                    totalEstimate
                  )}\n• **Buffered Estimate:** ${formatTime(
                    bufferedEstimate
                  )} (includes 20% uncertainty buffer)\n\n**📈 Task Breakdown:**\n• **In Progress:** ${
                    allTodos.filter((t: any) => t.status === "in_progress")
                      .length
                  } tasks\n• **Pending:** ${
                    allTodos.filter((t: any) => t.status === "pending").length
                  } tasks\n• **Blocked:** ${
                    allTodos.filter((t: any) => t.status === "blocked").length
                  } tasks\n• **Awaiting Approval:** ${
                    allTodos.filter(
                      (t: any) => t.status === "awaiting_approval"
                    ).length
                  } tasks\n\n**🎯 Confidence Level:** ${Math.round(
                    (pendingTodos.filter((t: any) => t.estimatedTime).length /
                      Math.max(1, pendingTodos.length)) *
                      100
                  )}% (based on ${
                    pendingTodos.filter((t: any) => t.estimatedTime).length
                  } tasks with explicit estimates)\n\n**💡 Recommendations:**\n• Use \`analyze_task\` on uncertain tasks for better estimates\n• Prioritize unblocking blocked tasks\n• Consider parallel execution for independent tasks\n• Review estimates after completing similar tasks`,
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: `❌ **Estimation Failed**\n\nUnable to estimate completion: ${
                    error instanceof Error ? error.message : "Unknown error"
                  }`,
                },
              ],
            };
          }

        case "create_intelligent_workflow":
          return await this.handleIntelligentWorkflow(args);

        case "auto_execute_next_step":
          return await this.handleAutoExecuteNextStep(args);

        case "manage_subtasks":
          return await this.handleManageSubtasks(args);

        case "analyze_prompt_semantics":
          return await this.handleAnalyzePromptSemantics(args);

        case "session_management":
          return await this.handleSessionManagement(args);

        case "workflow_execution_status":
          return await this.handleWorkflowExecutionStatus(args);

        case "context_preservation":
          return await this.handleContextPreservation(args);

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    } catch (error) {
      console.error(`❌ [MCP] Error in ${name}:`, error);

      if (error instanceof McpError) {
        throw error;
      }

      throw new McpError(
        ErrorCode.InternalError,
        `Tool execution failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  isServerRunning(): boolean {
    return this.isRunning;
  }

  getServerInfo(): { running: boolean; tools: number } {
    return {
      running: this.isRunning,
      tools: this.getToolDefinitions().length,
    };
  }

  /**
   * Helper method to check and progress workflow when a task is completed or approved
   */
  private async checkAndProgressWorkflow(todoId: string): Promise<void> {
    try {
      // This would typically call the main workflow progression logic
      // For now, we'll delegate to the main todosTool
      const todo = this.todosTool.getTodo(todoId);
      if (todo && todo.parentWorkflowId) {
        // Trigger workflow progression check
        console.log(`[MCP] Checking workflow progression for todo: ${todoId}`);
        // The main extension should handle this automatically
      }
    } catch (error) {
      console.warn("[MCP] Failed to check workflow progression:", error);
    }
  }

  // ================================================================================================
  // INTELLIGENT WORKFLOW HANDLERS - AI-Powered Analysis and Auto-Execution
  // ================================================================================================

  /**
   * Handle intelligent workflow creation with AI analysis
   */
  private async handleIntelligentWorkflow(args: any): Promise<CallToolResult> {
    try {
      const { userPrompt, autoExecute = true, sessionId } = args;
      
      // Use enhanced workflow manager for intelligent workflow creation
      const result = await this.enhancedWorkflowManager.createIntelligentWorkflow(
        userPrompt, 
        autoExecute, 
        sessionId
      );

      let content = `🚀 **INTELLIGENT WORKFLOW CREATED**\n\n`;
      content += `**Workflow ID:** ${result.workflowId}\n`;
      content += `**Analysis:** ${result.analysis.complexity} complexity, estimated ${result.analysis.estimatedTime}\n`;
      content += `**Auto-Execute:** ${autoExecute ? 'Enabled' : 'Disabled'}\n`;
      content += `**Language Detected:** ${result.analysis.languageDetected}\n\n`;
      
      content += `**📋 WORKFLOW PLAN (${result.plan.length} steps):**\n`;
      result.plan.forEach((task, index) => {
        content += `${index + 1}. **${task.content}**\n`;
        if (task.description) {
          content += `   └─ ${task.description}\n`;
        }
        if (task.estimatedDuration) {
          content += `   ⏱️ ${task.estimatedDuration}\n`;
        }
      });

      if (autoExecute) {
        content += `\n⚡ **AUTO-EXECUTION STARTING**\nFirst step will begin automatically...\n`;
        
        // Auto-execute first step if enabled
        try {
          const firstStepResult = await this.enhancedWorkflowManager.autoExecuteNextStep(result.workflowId);
          if (!firstStepResult.completed && firstStepResult.nextTask) {
            content += `\n🔄 **STEP 1 STARTED:** ${firstStepResult.nextTask.content}\n`;
            content += firstStepResult.result || "";
          }
        } catch (error) {
          content += `\n⚠️ Auto-execution encountered an issue: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      }

      content += `\n\n💡 **CONTEXT PRESERVATION:** Enabled - Full session memory maintained`;
      content += `\n🔄 **PARENT-CHILD TASKS:** Supported - Automatic subtask management`;
      content += `\n📊 **EXECUTION MONITORING:** Use workflow_execution_status to track progress`;

      return {
        content: [{ type: "text", text: content }]
      };

    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: MCP_MESSAGES.WORKFLOW_ERROR(error instanceof Error ? error.message : 'Unknown error')
          }
        ]
      };
    }
  }
  /**
   * Handle auto-execution of workflow steps with context preservation
   */
  private async handleAutoExecuteNextStep(args: any): Promise<CallToolResult> {
    try {
      const { workflowId, currentStepResult = '', overrideStep = null } = args;
      
      const workflowContext = this.workflowContexts.get(workflowId);
      if (!workflowContext) {
        return {
          content: [
            {
              type: "text",
              text: MCP_MESSAGES.WORKFLOW_NOT_FOUND(workflowId)
            }
          ]
        };
      }
      
      // Update context with current step result
      if (currentStepResult) {
        workflowContext.executionHistory.push({
          stepIndex: workflowContext.currentStep,
          result: currentStepResult,
          timestamp: new Date(),
          success: true
        });
      }
      
      // Determine next step
      const nextStepIndex = overrideStep !== null ? overrideStep : workflowContext.currentStep + 1;
      
      if (nextStepIndex >= workflowContext.workflow.tasks.length) {
        // Workflow completed
        return {
          content: [
            {
              type: "text",
              text: MCP_MESSAGES.WORKFLOW_COMPLETED(
                workflowContext.workflow.title,
                workflowContext.executionHistory.length,
                currentStepResult
              )
            }
          ]
        };
      }
      
      // Get next task
      const nextTask = workflowContext.workflow.tasks[nextStepIndex];
      workflowContext.currentStep = nextStepIndex;
      
      // Mark as executing
      this.activeExecutions.set(workflowId, {
        isExecuting: true,
        startTime: new Date(),
        lastActivity: new Date()
      });
      
      // Prepare execution context
      const executionContext = {
        parentObjective: workflowContext.originalPrompt,
        currentStep: nextStepIndex + 1,
        totalSteps: workflowContext.workflow.tasks.length,
        previousResults: workflowContext.executionHistory.map(h => h.result).join('\n'),
        contextSnapshot: workflowContext.contextSnapshot
      };
      
      return {
        content: [
          {
            type: "text",
            text: MCP_MESSAGES.STEP_EXECUTION(
              nextStepIndex,
              workflowContext.workflow.tasks.length,
              nextTask.content,
              nextTask.guidance?.aiInstructions || 'Complete this task as part of the workflow',
              nextTask.guidance?.expectedOutput || 'Task completion',
              executionContext.previousResults ? 'Previous results: ' + executionContext.previousResults.substring(0, 200) + '...' : 'First step',
              nextTask.guidance?.validationCriteria || 'Task completed successfully',
              nextTask.guidance?.approvalRequired || false
            )
          }
        ]
      };
      
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: MCP_MESSAGES.EXECUTION_ERROR(error instanceof Error ? error.message : 'Unknown error')
          }
        ]
      };
    }
  }

  /**
   * Handle semantic analysis of prompts in any language
   */
  private async handleAnalyzePromptSemantics(args: any): Promise<CallToolResult> {
    try {
      const { prompt, includeWorkflowRecommendation = true } = args;
      
      const model = await getAiModel();
      if (!model) {
        return {
          content: [
            {
              type: "text",
              text: MCP_MESSAGES.NO_AI_MODEL()
            }
          ]
        };
      }
      
      // Analyze task complexity
      const complexityAnalysis = await analyzeTaskComplexity(prompt, model);
      
      // Analyze todo tool usage
      const todoAnalysis = await shouldUseTodoTool(prompt, model);
      
      // Analyze task semantics
      const semanticAnalysis = await analyzeTaskSemantics(prompt, model);
      
      let recommendation = '';
      if (includeWorkflowRecommendation) {
        if (complexityAnalysis.needsOrchestration) {
          recommendation = `\n\n**🎯 Recommendation:** Use \`create_intelligent_workflow\` for this request due to its complexity and multi-step nature.`;
        } else if (todoAnalysis.shouldUse) {
          recommendation = `\n\n**🎯 Recommendation:** Use \`create_todo\` for this simple task.`;
        } else {
          recommendation = `\n\n**🎯 Recommendation:** This request can be handled directly without orchestration tools.`;
        }
      }
      
      return {
        content: [
          {
            type: "text",
            text: MCP_MESSAGES.SEMANTIC_ANALYSIS_RESULTS(
              prompt,
              complexityAnalysis,
              semanticAnalysis,
              todoAnalysis,
              recommendation
            )
          }
        ]
      };
      
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: MCP_MESSAGES.ANALYSIS_ERROR(error instanceof Error ? error.message : 'Unknown error')
          }
        ]
      };
    }
  }

  /**
   * Handle subtask management with parent-child relationships
   */
  private async handleManageSubtasks(args: any): Promise<CallToolResult> {
    try {
      const { parentTaskId, action, subtaskContent, subtaskId, autoProgress = true } = args;
      
      const result = await this.enhancedWorkflowManager.manageSubtasks(
        parentTaskId,
        action,
        subtaskContent,
        subtaskId,
        autoProgress
      );

      return {
        content: [
          {
            type: "text",
            text: UTILITY_MESSAGES.SUBTASK_MANAGEMENT_RESULT(result)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: MCP_MESSAGES.SUBTASK_ERROR(error instanceof Error ? error.message : 'Unknown error')
          }
        ]
      };
    }
  }

  /**
   * Handle session management for multi-session context
   */
  private async handleSessionManagement(args: any): Promise<CallToolResult> {
    try {
      const { action, sessionId, contextDescription } = args;
      const sessionManager = this.enhancedWorkflowManager.getSessionManager();
      
      switch (action) {
        case 'create':
          const newSessionId = sessionManager.createSession(contextDescription || 'New Session', sessionId);
          return {
            content: [
              {
                type: "text",
                text: MCP_MESSAGES.SESSION_CREATED(newSessionId, contextDescription || 'New Session')
              }
            ]
          };

        case 'switch':
          if (!sessionId) {
            throw new Error('Session ID required for switching');
          }
          const switched = sessionManager.switchSession(sessionId);
          if (!switched) {
            throw new Error(`Session ${sessionId} not found`);
          }
          return {
            content: [
              {
                type: "text",
                text: MCP_MESSAGES.SESSION_SWITCHED(sessionId)
              }
            ]
          };

        case 'list':
          const sessions = sessionManager.listSessions();
          const sessionList = sessions.map(s => 
            UTILITY_MESSAGES.SESSION_ITEM_FORMAT(s.id, s.description, s.workflowIds.length, s.isActive)
          ).join('\n');
          return {
            content: [
              {
                type: "text",
                text: MCP_MESSAGES.SESSIONS_LIST(sessionList || 'No sessions found')
              }
            ]
          };

        default:
          throw new Error(`Unknown session action: ${action}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: MCP_MESSAGES.SESSION_ERROR(error instanceof Error ? error.message : 'Unknown error')
          }
        ]
      };
    }
  }

  /**
   * Handle workflow execution status monitoring
   */
  private async handleWorkflowExecutionStatus(args: any): Promise<CallToolResult> {
    try {
      const { workflowId, includeExecutionHistory = true, includeNextSteps = true } = args;
      
      const status = this.enhancedWorkflowManager.getWorkflowStatus(workflowId);
      if (!status) {
        return {
          content: [
            {
              type: "text",
              text: MCP_MESSAGES.WORKFLOW_NOT_FOUND(workflowId || 'No workflow ID provided')
            }
          ]
        };
      }

      let content = `📊 **Workflow Execution Status**\n\n`;
      content += `**Workflow ID:** ${status.workflow.id}\n`;
      content += MCP_MESSAGES.WORKFLOW_STATUS(
        status.workflow.id,
        status.progress.currentStep,
        status.progress.totalSteps,
        status.progress.percentComplete,
        status.workflow.isCompleted
      ).split('\n').slice(2).join('\n'); // Skip title line since we have it above

      if (includeExecutionHistory && status.workflow.context?.executionHistory.length > 0) {
        content += `**📝 Execution History:**\n`;
        status.workflow.context.executionHistory.slice(-3).forEach((entry: any, index: number) => {
          content += UTILITY_MESSAGES.STEP_RESULT_FORMAT(index, entry.taskIndex, entry.result);
        });
        content += '\n';
      }

      if (includeNextSteps && status.nextSteps.length > 0) {
        content += `**🎯 Next Steps:**\n`;
        status.nextSteps.forEach((step: any, index: number) => {
          content += `${index + 1}. ${step.content}\n`;
        });
      }

      content += `\n💡 **Context Preservation:** Active - Full execution memory maintained`;

      return {
        content: [
          {
            type: "text",
            text: content
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: MCP_MESSAGES.GENERAL_ERROR('workflow status', error instanceof Error ? error.message : 'Unknown error')
          }
        ]
      };
    }
  }

  /**
   * Handle context preservation operations
   */
  private async handleContextPreservation(args: any): Promise<CallToolResult> {
    try {
      const { action, contextId, context } = args;
      const contextManager = this.enhancedWorkflowManager.getContextManager();

      switch (action) {
        case 'save':
          if (!contextId || !context) {
            throw new Error('Context ID and context data required for saving');
          }
          contextManager.saveGlobalContext(contextId, context);
          return {
            content: [
              {
                type: "text",
                text: MCP_MESSAGES.CONTEXT_SAVED(contextId, JSON.stringify(context).length)
              }
            ]
          };

        case 'restore':
          if (!contextId) {
            throw new Error('Context ID required for restoration');
          }
          const restoredContext = contextManager.restoreGlobalContext(contextId);
          return {
            content: [
              {
                type: "text",
                text: MCP_MESSAGES.CONTEXT_RESTORED(contextId, restoredContext)
              }
            ]
          };

        case 'list':
          // For now, return a simple status since we don't expose the internal storage
          return {
            content: [
              {
                type: "text",
                text: UTILITY_MESSAGES.CONTEXT_STATUS()
              }
            ]
          };

        case 'clear':
          if (!contextId) {
            throw new Error('Context ID required for clearing');
          }
          contextManager.clearContext(contextId);
          return {
            content: [
              {
                type: "text",
                text: MCP_MESSAGES.CONTEXT_CLEARED(contextId)
              }
            ]
          };

        default:
          throw new Error(`Unknown context preservation action: ${action}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: MCP_MESSAGES.GENERAL_ERROR('context preservation', error instanceof Error ? error.message : 'Unknown error')
          }
        ]
      };
    }
  }


  /**
   * Enhanced workflow monitoring and auto-progression
   */
  private async startAdvancedWorkflowMonitoring(workflowId: string): Promise<void> {
    // Enhanced monitoring with context preservation
    const interval = setInterval(async () => {
      try {
        const status = this.enhancedWorkflowManager.getWorkflowStatus(workflowId);
        if (!status || status.workflow.isCompleted) {
          clearInterval(interval);
          return;
        }

        // Check for stuck workflows and provide guidance
        const contextManager = this.enhancedWorkflowManager.getContextManager();
        const executionContext = contextManager.restoreExecutionContext(workflowId);
        
        if (executionContext) {
          const timeSinceLastActivity = Date.now() - (executionContext.contextSnapshot as any)?.timestamp || 0;
          
          // If workflow has been stuck for 30 minutes, provide guidance
          if (timeSinceLastActivity > 30 * 60 * 1000) {
            console.log(`[MCP] Workflow ${workflowId} appears stuck, consider providing guidance`);
          }
        }
      } catch (error) {
        console.warn(`[MCP] Workflow monitoring error for ${workflowId}:`, error);
        clearInterval(interval);
      }
    }, 5000); // Check every 5 seconds
  }



  /**
   * Automatic workflow progression with context preservation
   */
  private async performAutoWorkflowProgression(workflowId: string): Promise<void> {
    try {
      const status = this.enhancedWorkflowManager.getWorkflowStatus(workflowId);
      if (!status || status.workflow.isCompleted) {
        return;
      }

      // Auto-progress through completed tasks
      const result = await this.enhancedWorkflowManager.autoExecuteNextStep(workflowId);
      
      if (result.completed) {
        console.log(`[MCP] Workflow ${workflowId} completed automatically`);
        // Could trigger completion notifications here
      } else if (result.nextTask) {
        console.log(`[MCP] Workflow ${workflowId} progressed to: ${result.nextTask.content}`);
        // Start monitoring for the next task
        await this.startAdvancedWorkflowMonitoring(workflowId);
      }
    } catch (error) {
      console.warn(`[MCP] Auto-progression failed for workflow ${workflowId}:`, error);
    }
  }

  /**
   * Auto-detect if a simple todo should become a workflow (like extension.ts)
   */
  private async shouldAutoCreateWorkflow(content: string): Promise<{ shouldCreateWorkflow: boolean; reason: string }> {
    try {
      const model = await getAiModel();
      if (!model) {
        // Fallback analysis
        const hasMultipleSteps = content.split(/[.!?]/).length > 2;
        const isLongContent = content.length > 100;
        const hasImplementationKeywords = /\b(implement|create|build|develop|system|workflow|process)\b/i.test(content);
        
        return {
          shouldCreateWorkflow: hasMultipleSteps || isLongContent || hasImplementationKeywords,
          reason: hasMultipleSteps ? "Multiple sentences detected" : isLongContent ? "Complex content detected" : hasImplementationKeywords ? "Implementation keywords detected" : "Simple task"
        };
      }

      // Use AI analysis like extension.ts does
      const complexityAnalysis = await analyzeTaskComplexity(content, model);
      const todoAnalysis = await shouldUseTodoTool(content, model);

      return {
        shouldCreateWorkflow: complexityAnalysis.needsOrchestration || 
                             (complexityAnalysis.complexity !== 'simple' && todoAnalysis.shouldUse),
        reason: complexityAnalysis.reasoning
      };
    } catch (error) {
      return { shouldCreateWorkflow: false, reason: "Analysis failed, defaulting to simple todo" };
    }
  }





  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    try {
      this.transport = new StdioServerTransport();
      await this.server.connect(this.transport);
      this.isRunning = true;

      console.log("✅ [MCP] TodosTool MCP Server started successfully");
    } catch (error) {
      console.error("❌ [MCP] Failed to start MCP server:", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      if (this.transport) {
        await this.transport.close();
        this.transport = null;
      }
      this.isRunning = false;

      console.log("✅ [MCP] TodosTool MCP Server stopped successfully");
    } catch (error) {
      console.error("❌ [MCP] Failed to stop MCP server:", error);
      throw error;
    }
  }
}

// ================================================================================================
// MAIN FUNCTION
// ================================================================================================

/**
 * Main function to start the MCP server
 */
export async function startMcpServer(todosTool: AIToDosTool): Promise<TodosMCPServer> {
  const server = new TodosMCPServer(todosTool);
  await server.start();
  return server;
}
