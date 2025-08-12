/**
 * Common type definitions shared between extension.ts and mcpServer.ts
 * Centralizes all interfaces, types, and data structures to avoid duplication
 */

// ================================================================================================
// BASIC TYPES
// ================================================================================================

export type Priority = "critical" | "high" | "medium" | "low";
export type Status = "pending" | "in_progress" | "completed" | "archived" | "stuck" | "waiting" | "cancelled" | "blocked" | "paused" | "awaiting_approval";
export type Complexity = "simple" | "medium" | "complex" | "very_complex";
export type TaskType = "implementation" | "testing" | "research" | "api" | "generic" | "documentation" | "configuration" | "discovery";
export type WorkflowApproach = "single_task" | "sequential_workflow" | "multi_phase_discovery" | "approval_workflow";

// ================================================================================================
// CORE INTERFACES
// ================================================================================================

export interface SubTask {
  id: string;
  content: string;
  status: Status;
  createdAt: Date;
  updatedAt: Date;
  priority?: Priority;
  estimatedTime?: number;
  actualTime?: number;
  assignee?: string;
}

export interface WorkflowStep {
  name: string;
  description: string;
  status: "pending" | "in-progress" | "completed" | "blocked";
  timeEstimate: number;
  dependencies: string[];
  taskType: TaskType;
  order: number;
  subtasks?: WorkflowStep[];
  details?: {
    files?: string[];
    commands?: string[];
    apis?: string[];
    notes?: string;
  };
}

export interface WorkflowTaskGuidance {
  parentObjective: string;
  aiInstructions: string;
  expectedOutput: string;
  nextStepGuidance: string;
  validationCriteria: string;
  approvalRequired?: boolean;
  recoveryInstructions: string;
}

export interface WorkflowTask {
  id?: string;
  content: string;
  description?: string;
  estimatedDuration?: string;
  dependencies?: string[];
  status?: string;
  guidance?: WorkflowTaskGuidance;
}

export interface Workflow {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  complexity: Complexity;
  status: Status;
  totalTimeEstimate: number;
  steps: WorkflowStep[];
  sessionId: string;
  createdAt: number;
  updatedAt: number;
  parentTodo?: string;
  dependencies: string[];
  context?: {
    repository?: string;
    branch?: string;
    projectType?: string;
    files?: string[];
  };
}

export interface Todo {
  id: string;
  content: string;
  status: Status;
  createdAt: Date;
  updatedAt: Date;
  summary?: string;
  subTasks: SubTask[];
  history: Array<{
    timestamp: Date;
    action: string;
    previousStatus?: string;
    newStatus?: string;
    notes?: string;
    agentId?: string;
    duration?: number;
  }>;
  priority: Priority;
  estimatedTime?: number;
  actualTime?: number;
  dependencies: string[];
  tags: string[];
  assignee?: string;
  parentWorkflowId?: string;
  position?: number;
  blockedReason?: string;
  lastAccessedAt: Date;
  contextSnapshot?: string;
  parentObjective?: string;
  nextStepGuidance?: string;
  approvalRequired?: boolean;
  aiInstructions?: string;
  recoveryInstructions?: string;
  contextLinks?: string[];
  expectedOutput?: string;
  validationCriteria?: string;
  failureRecoveryHints?: string[];
}

export interface TodoItem {
  id: string;
  content: string;
  description?: string;
  priority: Priority;
  status: Status;
  createdAt: number;
  updatedAt: number;
  sessionId: string;
  timeEstimate: number;
  complexity: Complexity;
  taskType: TaskType;
  dependencies: string[];
  workflow?: Workflow;
  context?: {
    file?: string;
    line?: number;
    function?: string;
    class?: string;
    repository?: string;
    branch?: string;
    commitHash?: string;
    projectType?: string;
  };
  metadata?: {
    tags?: string[];
    assignee?: string;
    dueDate?: number;
    blockedBy?: string[];
    relatedIssues?: string[];
    estimatedEffort?: string;
    actualEffort?: number;
    notes?: string;
  };
}

export interface TodoState {
  todos: Todo[];
  sessionId: string;
  createdAt: Date;
  lastUpdated: Date;
  autoProgressionEnabled: boolean;
  currentWorkflowId?: string;
  chatSessionId?: string;
  contextDescription?: string;
  isArchived?: boolean;
  version?: string;
  metadata?: {
    totalTodos: number;
    completedTodos: number;
    timeEstimates: Record<Complexity, Record<TaskType, number>>;
    sessionStats: {
      createdAt: number;
      lastActivity: number;
      todoCount: number;
      completedCount: number;
    };
  };
}

export interface SessionInfo {
  sessionId: string;
  timeEstimate: number;
  complexity: Complexity;
  currentTodoCount: number;
  taskCounts: Record<TaskType, number>;
  lastActivity: number;
}

export interface SessionMetadata {
  sessionId: string;
  chatSessionId: string;
  contextDescription: string;
  createdAt: Date;
  lastAccessed: Date;
  todoCount: number;
  isActive: boolean;
}

export interface MultiSessionState {
  sessions: Record<string, TodoState>;
  activeSessions: Record<string, string>;
  sessionMetadata: Record<string, SessionMetadata>;
  globalSettings: {
    autoSessionDetection: boolean;
    sessionTimeoutMinutes: number;
    maxActiveSessions: number;
  };
  version?: string;
  lastUpdated?: number;
  currentSession?: string;
  archivedSessions?: string[];
  globalStats?: {
    totalSessions: number;
    totalTodos: number;
    totalCompleted: number;
    averageSessionTime: number;
  };
}

export interface WorkflowExecutionContext {
  todoId: string;
  sessionId: string;
  startTime: number;
  currentStep: number;
  executionHistory: Array<{
    stepName: string;
    status: "completed" | "failed" | "skipped";
    timestamp: number;
    output?: any;
    error?: string;
  }>;
}

export interface TodoToolInput {
  action: "create" | "update" | "get" | "complete" | "delete" | "list" | "summary" | "clear" | 
          "addSubTask" | "updateSubTask" | "createWorkflow" | "getWorkflowStatus" | 
          "toggleAutoProgression" | "checkpoint" | "rollback" | "analyze" | "prioritize" | 
          "estimate" | "getNextSteps" | "approve" | "requestGuidance" | "workflow" | "search" | "stats";
  todoId?: string;
  content?: string;
  summary?: string;
  status?: Status;
  notes?: string;
  subTaskId?: string;
  subTaskContent?: string;
  workflowTasks?: string[];
  workflowId?: string;
  autoProgression?: boolean;
  priority?: Priority;
  estimatedTime?: number;
  dependencies?: string[];
  tags?: string[];
  checkpoint?: string;
  parentObjective?: string;
  approvalRequired?: boolean;
  aiInstructions?: string;
  expectedOutput?: string;
  validationCriteria?: string;
  nextStepGuidance?: string;
  recoveryInstructions?: string;
  contextLinks?: string[];
  id?: string;
  sessionId?: string;
  searchQuery?: string;
  description?: string;
  metadata?: any;
  complexity?: Complexity;
  workflowSteps?: WorkflowStep[];
  context?: any;
  filters?: {
    status?: Status[];
    priority?: Priority[];
    complexity?: Complexity[];
    taskType?: TaskType[];
    sessionId?: string;
    timeRange?: { start: number; end: number };
  };
}

// ================================================================================================
// AI ANALYSIS INTERFACES
// ================================================================================================

export interface TaskComplexityAnalysis {
  needsOrchestration: boolean;
  complexity: Complexity;
  suggestedApproach: WorkflowApproach;
  reasoning: string;
  confidence: number;
}

export interface TaskSemanticsAnalysis {
  taskType: TaskType;
  complexity: Complexity;
  suggestedBreakdown: string[];
  contextualTips: string[];
  confidence: number;
}

export interface TodoToolAnalysis {
  shouldUse: boolean;
  confidence: number;
  reasoning: string;
}

export interface ContextSwitchAnalysis {
  isContextSwitch: boolean;
  confidence: number;
  reason: string;
}

// ================================================================================================
// WORKFLOW INTERFACES
// ================================================================================================

export interface WorkflowMetadata {
  complexity?: string;
  approach?: string;
  originalPrompt: string;
  autoExecute?: boolean;
  requireApproval?: boolean;
  requiresApproval?: boolean;
  confidence?: number;
  createdAt?: Date;
  estimatedDuration?: string;
  parentTaskId?: string;
}

export interface WorkflowDefinition {
  id: string;
  title?: string;
  tasks: WorkflowTask[];
  metadata: WorkflowMetadata;
  createdAt?: string;
  status?: string;
  currentTaskIndex?: number;
  isCompleted?: boolean;
  context?: WorkflowContext;
}

export interface ExecutionHistoryEntry {
  stepIndex?: number;
  taskIndex?: number;
  result: string;
  timestamp?: Date;
  completedAt?: Date;
  success?: boolean;
  autoExecuted?: boolean;
}

export interface WorkflowContext {
  workflow?: WorkflowDefinition;
  currentStep?: number;
  executionHistory: ExecutionHistoryEntry[];
  parentContext?: string | null;
  childTasks?: string[];
  originalPrompt?: string;
  contextSnapshot?: string;
  sessionId?: string;
  preservedState?: Map<string, any>;
}

export interface ExecutionState {
  isExecuting: boolean;
  startTime: Date;
  lastActivity: Date;
}

// ================================================================================================
// ENHANCED SESSION AND CONTEXT MANAGEMENT INTERFACES
// ================================================================================================

export interface SessionContext {
  id: string;
  description: string;
  createdAt: Date;
  lastAccessedAt: Date;
  workflowIds: string[];
  executionState: Map<string, any>;
  parentChildRelationships: Map<string, string[]>;
  contextMemory: Map<string, any>;
  isActive: boolean;
}

export interface ExecutionContext {
  workflowId: string;
  currentStep: number;
  stepResults: Map<number, any>;
  parentTaskId?: string;
  childTaskIds: string[];
  nextStepPlan: string;
  contextSnapshot: any;
}

export interface SubtaskRelationship {
  parentId: string;
  childIds: string[];
  completedChildren: string[];
  nextParentStep: string;
  parentContext: any;
}

// ================================================================================================
// PARSED ACTION INTERFACES
// ================================================================================================

export interface ParsedTodoAction {
  action: string;
  todoId?: string;
  content?: string;
  summary?: string;
  status?: string;
  notes?: string;
  workflowTasks?: string[];
  subAction?: string; // For session management
}

export interface ContextSwitchCheckResult {
  isContextSwitch: boolean;
  confidence: number;
  reason: string;
}

// Todo Tool Command Result Types
export interface TodoToolSuccessResult<TData = any> {
  success: true;
  data: TData;
}

export interface TodoToolErrorResult {
  success: false;
  error: string;
}

export type TodoToolResult<TData = any> = TodoToolSuccessResult<TData> | TodoToolErrorResult;

// Specific data types for different todo tool actions
export interface CreateTodoData {
  todoId: string;
  content: string;
}

export interface UpdateTodoData {
  todoId: string;
  status: string;
}

export interface GetTodoData {
  todo: Todo;
}

export interface ListTodosData {
  todos: Todo[];
  count: number;
}

export interface SummaryData {
  allTodos: Todo[];
  summary: any; // Session summary type
}

export interface AddSubTaskData {
  todoId: string;
  subTaskId: string;
}

export interface ClearSessionData {
  message: string;
}

export interface CreateWorkflowData {
  workflowId: string;
  tasksCount: number;
}

export interface GetWorkflowStatusData {
  workflowId?: string;
  currentTask?: Todo;
  nextTask?: Todo;
  totalTasks: number;
  completedTasks: number;
  autoProgressionEnabled: boolean;
}

export interface AnalyzeTaskData {
  complexity: "simple" | "medium" | "complex" | "very_complex";
  suggestedBreakdown: string[];
  estimatedTime: number;
  riskFactors: string[];
  prerequisites: string[];
}

export interface GenericActionData {
  message: string;
  success: boolean;
  [key: string]: any;
}

// AI Semantic Analyzer Tool Result Data
export interface AISemanticAnalysisResult<TResult = any> {
  analysisType: string;
  prompt: string;
  context?: string;
  result: TResult;
  modelInfo: {
    hasModel: boolean;
    modelType: string;
    modelName?: string;
  };
}

// Specific semantic analysis result types
export interface ComplexityAnalysisResult {
  needsOrchestration: boolean;
  complexity: Complexity;
  suggestedApproach: WorkflowApproach;
  reasoning: string;
  confidence: number;
  keywordAnalysis?: any;
  recommendations?: string[];
  detailedBreakdown?: DetailedAnalysisBreakdown;
}

export interface SemanticAnalysisResult {
  taskType: TaskType;
  complexity: Complexity;
  confidence: number;
  suggestedBreakdown: string[];
  keywordAnalysis?: any;
  recommendations?: string[];
  detailedBreakdown?: DetailedAnalysisBreakdown;
}

export interface WorkflowNeedsAnalysisResult {
  needsWorkflow: boolean;
  suggestedApproach: WorkflowApproach;
  complexity: Complexity;
  reasoning: string;
  confidence: number;
  recommendations?: string[];
  detailedBreakdown?: DetailedAnalysisBreakdown;
}

export interface TodoRelevanceAnalysisResult {
  shouldUse: boolean;
  confidence: number;
  reasoning: string;
  keywordAnalysis?: any;
  recommendations?: string[];
  detailedBreakdown?: DetailedAnalysisBreakdown;
}

export interface PriorityAnalysisResult {
  priority: Priority;
  confidence: number;
  reasoning: string;
  analysis?: any;
  recommendations?: string[];
  detailedBreakdown?: DetailedAnalysisBreakdown;
}

// Additional analysis enhancement types
export interface AnalysisRecommendations {
  recommendations: string[];
}

export interface DetailedAnalysisBreakdown {
  analysisSteps: string[];
  keyFactors: string[];
}

// Additional analysis interfaces
export interface TimeEstimationResult {
  timeEstimate: number;
  reasoning: string;
}

export interface SemanticMatchingResult {
  isMatch: boolean;
  confidence: number;
  reasoning: string;
}

// AI Todo Manager Tool Result Data
export type AITodoManagerData = 
  | CreateTodoData
  | UpdateTodoData
  | GetTodoData
  | ListTodosData
  | SummaryData
  | AddSubTaskData
  | ClearSessionData
  | CreateWorkflowData
  | GetWorkflowStatusData
  | AnalyzeTaskData
  | GenericActionData
  | AISemanticAnalysisResult<any>
  | any; // For complex operations that return varied data

// ================================================================================================
// LANGUAGE MODEL TOOL INPUT INTERFACES
// ================================================================================================

// TodosTool input interface (matching package.json inputSchema)
export interface TodosToolInput {
  action: "addSubTask" | "analyze" | "approve" | "checkpoint" | "clear" | "complete" | 
          "create" | "createWorkflow" | "delete" | "get" | "getNextSteps" | 
          "getWorkflowStatus" | "list" | "prioritize" | "requestGuidance" | 
          "summary" | "toggleAutoProgression" | "update" | "updateSubTask";
  autoProgression?: boolean;
  content?: string;
  notes?: string;
  status?: "awaiting_approval" | "blocked" | "cancelled" | "completed" | 
           "in_progress" | "paused" | "pending";
  subTaskContent?: string;
  subTaskId?: string;
  summary?: string;
  todoId?: string;
  workflowId?: string;
  workflowTasks?: string[];
}

// AI Semantic Analyzer input interface (matching package.json inputSchema)
export interface AISemanticAnalyzerInput {
  prompt: string;
  analysisType: "complexity" | "semantic" | "workflow_needs" | "todo_relevance" | "priority";
  context?: string;
  options?: {
    includeRecommendations?: boolean;
    detailedBreakdown?: boolean;
  };
}

// AI Todo Manager input interface (matching package.json inputSchema)
export interface AITodoManagerInput {
  action: "create" | "update" | "complete" | "delete" | "list" | "get" | "summary" |
          "createWorkflow" | "getWorkflowStatus" | "addSubTask" | "updateSubTask" |
          "analyze" | "prioritize" | "checkpoint" | "toggleAutoProgression" |
          "approve" | "requestGuidance" | "getNextSteps" | "clear";
  content?: string;
  todoId?: string;
  status?: "pending" | "in_progress" | "completed" | "cancelled" | 
           "blocked" | "paused" | "awaiting_approval";
  workflowTasks?: string[];
  priority?: "low" | "medium" | "high" | "critical";
  summary?: string;
  notes?: string;
  subTaskContent?: string;
  subTaskId?: string;
  workflowId?: string;
  autoProgression?: boolean;
}

// AI Workflow Orchestrator input interface (matching package.json inputSchema)
export interface AIWorkflowOrchestratorInput {
  objective: string;
  complexity?: "simple" | "medium" | "complex" | "very_complex";
  approach?: "single_task" | "sequential_workflow" | "multi_phase_discovery" | "approval_workflow";
  autoExecute?: boolean;
  requireApproval?: boolean;
  context?: {
    projectType?: string;
    technology?: string;
    timeframe?: string;
    resources?: string[];
  };
  constraints?: {
    maxSteps?: number;
    timeLimit?: string;
    dependencies?: string[];
  };
}