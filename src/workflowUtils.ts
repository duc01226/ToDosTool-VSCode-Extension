/**
 * Workflow Utilities - Shared workflow management functions
 * Centralizes workflow creation, execution, and management logic
 */

import {
  WorkflowDefinition,
  WorkflowTask,
  WorkflowContext,
  ExecutionHistoryEntry,
  SessionContext,
  ExecutionContext,
  SubtaskRelationship,
  WorkflowStep,
  Todo,
  TodoItem,
  Complexity,
  TaskType,
  Status,
  WorkflowMetadata
} from './types';
import { generateWorkflowTasks, analyzeTaskComplexity } from './aiUtils';
import { WORKFLOW_CONFIG, TIME_ESTIMATES, DEFAULTS } from './constants';

// ================================================================================================
// WORKFLOW CREATION
// ================================================================================================

export async function createWorkflowDefinition(
  objective: string,
  complexity: Complexity,
  aiFunction: (prompt: string) => Promise<string>,
  options: {
    autoExecute?: boolean;
    requireApproval?: boolean;
    parentTaskId?: string;
    sessionId?: string;
  } = {}
): Promise<WorkflowDefinition> {
  const tasks = await generateWorkflowTasks(objective, complexity, aiFunction);
  const workflowId = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    id: workflowId,
    title: objective.length > 50 ? objective.substring(0, 50) + '...' : objective,
    tasks,
    metadata: {
      complexity,
      approach: tasks.length > 1 ? 'sequential_workflow' : 'single_task',
      originalPrompt: objective,
      autoExecute: options.autoExecute || false,
      requireApproval: options.requireApproval || false,
      confidence: 0.8,
      createdAt: new Date(),
      estimatedDuration: estimateWorkflowDuration(tasks),
      parentTaskId: options.parentTaskId
    },
    createdAt: new Date().toISOString(),
    status: 'pending',
    currentTaskIndex: 0,
    isCompleted: false,
    context: {
      workflow: undefined, // Will be set after creation
      currentStep: 0,
      executionHistory: [],
      parentContext: options.parentTaskId || null,
      childTasks: [],
      originalPrompt: objective,
      sessionId: options.sessionId
    }
  };
}

// ================================================================================================
// TIME ESTIMATION
// ================================================================================================

export function estimateWorkflowDuration(tasks: WorkflowTask[]): string {
  let totalMinutes = 0;
  
  tasks.forEach(task => {
    if (task.estimatedDuration) {
      const match = task.estimatedDuration.match(/(\d+)\s*(minute|hour|day)/i);
      if (match) {
        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        
        switch (unit) {
          case 'minute':
            totalMinutes += value;
            break;
          case 'hour':
            totalMinutes += value * 60;
            break;
          case 'day':
            totalMinutes += value * 480; // 8 hour work day
            break;
        }
      }
    } else {
      // Default estimate based on complexity
      totalMinutes += DEFAULTS.TIME_ESTIMATE;
    }
  });
  
  if (totalMinutes < 60) {
    return `${totalMinutes} minutes`;
  } else if (totalMinutes < 480) {
    const hours = Math.round(totalMinutes / 60 * 10) / 10;
    return `${hours} hours`;
  } else {
    const days = Math.round(totalMinutes / 480 * 10) / 10;
    return `${days} days`;
  }
}

export function estimateTaskDuration(
  taskType: TaskType,
  complexity: Complexity
): number {
  return TIME_ESTIMATES[complexity][taskType];
}

// ================================================================================================
// WORKFLOW EXECUTION
// ================================================================================================

export function getNextExecutableTask(workflow: WorkflowDefinition): WorkflowTask | null {
  if (!workflow.tasks || workflow.currentTaskIndex === undefined) {
    return null;
  }
  
  if (workflow.currentTaskIndex >= workflow.tasks.length) {
    return null; // All tasks completed
  }
  
  const currentTask = workflow.tasks[workflow.currentTaskIndex];
  
  // Check if dependencies are met
  if (currentTask.dependencies && currentTask.dependencies.length > 0) {
    const completedTasks = workflow.context?.executionHistory
      ?.filter(entry => entry.success)
      ?.map(entry => entry.result) || [];
    
    const dependenciesMet = currentTask.dependencies.every(dep => 
      completedTasks.some(completed => completed.includes(dep))
    );
    
    if (!dependenciesMet) {
      return null; // Dependencies not met
    }
  }
  
  return currentTask;
}

export function markTaskCompleted(
  workflow: WorkflowDefinition,
  taskResult: string,
  success: boolean = true
): WorkflowDefinition {
  const updatedWorkflow = { ...workflow };
  
  // Add to execution history
  if (!updatedWorkflow.context) {
    updatedWorkflow.context = {
      currentStep: 0,
      executionHistory: [],
      parentContext: null,
      childTasks: [],
      originalPrompt: workflow.metadata.originalPrompt
    };
  }
  
  const historyEntry: ExecutionHistoryEntry = {
    taskIndex: workflow.currentTaskIndex || 0,
    result: taskResult,
    timestamp: new Date(),
    completedAt: new Date(),
    success,
    autoExecuted: workflow.metadata.autoExecute || false
  };
  
  updatedWorkflow.context.executionHistory.push(historyEntry);
  
  if (success) {
    // Move to next task
    updatedWorkflow.currentTaskIndex = (workflow.currentTaskIndex || 0) + 1;
    updatedWorkflow.context.currentStep = updatedWorkflow.currentTaskIndex;
    
    // Check if workflow is completed
    if (updatedWorkflow.currentTaskIndex >= updatedWorkflow.tasks.length) {
      updatedWorkflow.status = 'completed';
      updatedWorkflow.isCompleted = true;
    }
  }
  
  return updatedWorkflow;
}

export function calculateWorkflowProgress(workflow: WorkflowDefinition): {
  completedTasks: number;
  totalTasks: number;
  progressPercentage: number;
  currentTask: string | null;
  estimatedTimeRemaining: string;
} {
  const completedTasks = workflow.context?.executionHistory?.filter(h => h.success).length || 0;
  const totalTasks = workflow.tasks.length;
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  const currentTask = workflow.currentTaskIndex !== undefined && workflow.currentTaskIndex < totalTasks
    ? workflow.tasks[workflow.currentTaskIndex].content
    : null;
  
  // Estimate remaining time
  const remainingTasks = totalTasks - completedTasks;
  const avgTaskTime = DEFAULTS.TIME_ESTIMATE; // minutes
  const remainingMinutes = remainingTasks * avgTaskTime;
  
  let estimatedTimeRemaining: string;
  if (remainingMinutes < 60) {
    estimatedTimeRemaining = `${remainingMinutes} minutes`;
  } else if (remainingMinutes < 480) {
    const hours = Math.round(remainingMinutes / 60 * 10) / 10;
    estimatedTimeRemaining = `${hours} hours`;
  } else {
    const days = Math.round(remainingMinutes / 480 * 10) / 10;
    estimatedTimeRemaining = `${days} days`;
  }
  
  return {
    completedTasks,
    totalTasks,
    progressPercentage,
    currentTask,
    estimatedTimeRemaining
  };
}

// ================================================================================================
// WORKFLOW STEP CONVERSION
// ================================================================================================

export function convertTasksToSteps(tasks: WorkflowTask[]): WorkflowStep[] {
  return tasks.map((task, index) => ({
    name: task.content.length > 30 ? task.content.substring(0, 30) + '...' : task.content,
    description: task.description || task.content,
    status: "pending",
    timeEstimate: parseTimeEstimate(task.estimatedDuration || '1 hour'),
    dependencies: task.dependencies || [],
    taskType: determineTaskType(task.content),
    order: index,
    details: {
      notes: task.guidance?.aiInstructions
    }
  }));
}

function parseTimeEstimate(duration: string): number {
  const match = duration.match(/(\d+)\s*(minute|hour|day)/i);
  if (match) {
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    switch (unit) {
      case 'minute':
        return value;
      case 'hour':
        return value * 60;
      case 'day':
        return value * 480; // 8 hour work day
    }
  }
  return 60; // Default 1 hour
}

function determineTaskType(content: string): TaskType {
  const contentLower = content.toLowerCase();
  
  if (contentLower.includes('test') || contentLower.includes('verify')) {
    return 'testing';
  } else if (contentLower.includes('research') || contentLower.includes('investigate')) {
    return 'research';
  } else if (contentLower.includes('api') || contentLower.includes('endpoint')) {
    return 'api';
  } else if (contentLower.includes('document') || contentLower.includes('readme')) {
    return 'documentation';
  } else if (contentLower.includes('config') || contentLower.includes('setup')) {
    return 'configuration';
  } else if (contentLower.includes('implement') || contentLower.includes('code') || contentLower.includes('develop')) {
    return 'implementation';
  } else if (contentLower.includes('discover') || contentLower.includes('explore')) {
    return 'discovery';
  }
  
  return 'generic';
}

// ================================================================================================
// CONTEXT MANAGEMENT
// ================================================================================================

export function createWorkflowContext(
  workflowId: string,
  parentTaskId?: string,
  sessionId?: string
): WorkflowContext {
  return {
    currentStep: 0,
    executionHistory: [],
    parentContext: parentTaskId || null,
    childTasks: [],
    originalPrompt: '',
    sessionId,
    preservedState: new Map()
  };
}

export function preserveWorkflowContext(
  context: WorkflowContext,
  key: string,
  value: any
): WorkflowContext {
  const updatedContext = { ...context };
  if (!updatedContext.preservedState) {
    updatedContext.preservedState = new Map();
  }
  updatedContext.preservedState.set(key, value);
  return updatedContext;
}

export function restoreWorkflowContext(
  context: WorkflowContext,
  key: string
): any {
  return context.preservedState?.get(key);
}

// ================================================================================================
// PARENT-CHILD TASK RELATIONSHIPS
// ================================================================================================

export function createSubtaskRelationship(
  parentId: string,
  childIds: string[],
  nextParentStep: string,
  parentContext: any
): SubtaskRelationship {
  return {
    parentId,
    childIds,
    completedChildren: [],
    nextParentStep,
    parentContext
  };
}

export function markChildTaskCompleted(
  relationship: SubtaskRelationship,
  childId: string
): SubtaskRelationship {
  return {
    ...relationship,
    completedChildren: [...relationship.completedChildren, childId]
  };
}

export function areAllChildTasksCompleted(relationship: SubtaskRelationship): boolean {
  return relationship.childIds.length > 0 && 
         relationship.completedChildren.length === relationship.childIds.length;
}

// ================================================================================================
// WORKFLOW VALIDATION
// ================================================================================================

export function validateWorkflowDefinition(workflow: WorkflowDefinition): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!workflow.id) {
    errors.push('Workflow must have an ID');
  }
  
  if (!workflow.tasks || workflow.tasks.length === 0) {
    errors.push('Workflow must have at least one task');
  }
  
  if (workflow.tasks.length > WORKFLOW_CONFIG.MAX_AUTO_EXECUTION_STEPS) {
    errors.push(`Workflow cannot have more than ${WORKFLOW_CONFIG.MAX_AUTO_EXECUTION_STEPS} tasks`);
  }
  
  workflow.tasks.forEach((task, index) => {
    if (!task.content || task.content.trim().length === 0) {
      errors.push(`Task ${index + 1} must have content`);
    }
    
    if (task.dependencies) {
      task.dependencies.forEach(dep => {
        const dependencyExists = workflow.tasks.some((t, i) => 
          i < index && (t.content.includes(dep) || t.id === dep)
        );
        if (!dependencyExists) {
          errors.push(`Task ${index + 1} has invalid dependency: ${dep}`);
        }
      });
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// ================================================================================================
// WORKFLOW SEARCH AND FILTERING
// ================================================================================================

export function searchWorkflows(
  workflows: WorkflowDefinition[],
  query: string
): WorkflowDefinition[] {
  const queryLower = query.toLowerCase();
  
  return workflows.filter(workflow => 
    workflow.title?.toLowerCase().includes(queryLower) ||
    workflow.metadata.originalPrompt.toLowerCase().includes(queryLower) ||
    workflow.tasks.some(task => 
      task.content.toLowerCase().includes(queryLower) ||
      task.description?.toLowerCase().includes(queryLower)
    )
  );
}

export function filterWorkflowsByStatus(
  workflows: WorkflowDefinition[],
  status: string
): WorkflowDefinition[] {
  return workflows.filter(workflow => workflow.status === status);
}

export function getWorkflowsByComplexity(
  workflows: WorkflowDefinition[],
  complexity: Complexity
): WorkflowDefinition[] {
  return workflows.filter(workflow => workflow.metadata.complexity === complexity);
}

// ================================================================================================
// GENERIC WORKFLOW GENERATION
// ================================================================================================

/**
 * Fallback generic workflow generation
 */
export function generateGenericWorkflow(prompt: string, approach: string): WorkflowTask[] {
  const parentObjective = `Complete user request: ${prompt.substring(0, 100)}...`;

  switch (approach) {
    case "multi_phase_discovery":
      return [
        {
          content: "Analysis: Understand requirements and scope",
          guidance: {
            parentObjective,
            aiInstructions: "Carefully analyze the user request to understand requirements and scope",
            expectedOutput: "Clear understanding of what needs to be accomplished",
            nextStepGuidance: "Proceed to research and discovery",
            validationCriteria: "Requirements and scope are clearly understood",
            recoveryInstructions: "Review request and clarify ambiguous requirements"
          },
        },
        {
          content: "Discovery: Research relevant information and patterns",
          guidance: {
            parentObjective,
            aiInstructions: "Gather necessary information and identify relevant patterns or existing solutions",
            expectedOutput: "Research findings and pattern analysis",
            nextStepGuidance: "Create implementation plan",
            validationCriteria: "Sufficient research completed",
            recoveryInstructions: "Expand research scope or consult additional sources"
          },
        },
        {
          content: "Implementation: Execute the planned solution",
          guidance: {
            parentObjective,
            aiInstructions: "Execute the implementation based on analysis and research",
            expectedOutput: "Completed implementation",
            nextStepGuidance: "Task complete",
            validationCriteria: "Implementation meets requirements",
            recoveryInstructions: "Review implementation against requirements and iterate"
          },
        },
      ];

    case "approval_workflow":
      return [
        {
          content: "Planning: Create detailed implementation plan",
          guidance: {
            parentObjective,
            aiInstructions: "Create a comprehensive plan for the request",
            expectedOutput: "Detailed implementation plan",
            nextStepGuidance: "Submit for approval",
            validationCriteria: "Plan covers all requirements",
            approvalRequired: true,
            recoveryInstructions: "Refine plan based on feedback and resubmit"
          },
        },
        {
          content: "Execution: Implement the approved plan",
          guidance: {
            parentObjective,
            aiInstructions: "Execute the approved implementation plan",
            expectedOutput: "Completed implementation",
            nextStepGuidance: "Task complete",
            validationCriteria: "Implementation matches approved plan",
            recoveryInstructions: "Review against approved plan and make necessary adjustments"
          },
        },
      ];

    case "sequential_workflow":
    default:
      return [
        {
          content: "Planning: Break down the task into steps",
          guidance: {
            parentObjective,
            aiInstructions: "Analyze the request and break it down into manageable steps",
            expectedOutput: "Step-by-step plan",
            nextStepGuidance: "Execute the steps",
            validationCriteria: "Plan covers all aspects of the request",
            recoveryInstructions: "Revisit requirements and create more detailed breakdown"
          },
        },
        {
          content: "Execution: Complete the planned steps",
          guidance: {
            parentObjective,
            aiInstructions: "Execute each step of the plan systematically",
            expectedOutput: "Completed work",
            nextStepGuidance: "Task complete",
            validationCriteria: "All planned steps completed successfully",
            recoveryInstructions: "Review completed steps and address any gaps"
          },
        },
      ];
  }
}

// ================================================================================================
// WORKFLOW EXPORT/IMPORT
// ================================================================================================

export function exportWorkflowToJSON(workflow: WorkflowDefinition): string {
  return JSON.stringify(workflow, null, 2);
}

export function importWorkflowFromJSON(json: string): WorkflowDefinition | null {
  try {
    const workflow = JSON.parse(json);
    const validation = validateWorkflowDefinition(workflow);
    
    if (validation.isValid) {
      return workflow;
    } else {
      console.warn('Invalid workflow import:', validation.errors);
      return null;
    }
  } catch (error) {
    console.warn('Failed to import workflow:', error);
    return null;
  }
}

// ================================================================================================
// WORKFLOW METRICS
// ================================================================================================

export function calculateWorkflowMetrics(workflows: WorkflowDefinition[]): {
  totalWorkflows: number;
  completedWorkflows: number;
  pendingWorkflows: number;
  averageTasksPerWorkflow: number;
  averageCompletionTime: number;
  complexityDistribution: Record<Complexity, number>;
} {
  const totalWorkflows = workflows.length;
  const completedWorkflows = workflows.filter(w => w.isCompleted).length;
  const pendingWorkflows = workflows.filter(w => !w.isCompleted).length;
  
  const averageTasksPerWorkflow = totalWorkflows > 0 
    ? workflows.reduce((sum, w) => sum + w.tasks.length, 0) / totalWorkflows 
    : 0;
  
  const completedWithHistory = workflows.filter(w => 
    w.isCompleted && w.context?.executionHistory && w.context.executionHistory.length > 0
  );
  
  const averageCompletionTime = completedWithHistory.length > 0
    ? completedWithHistory.reduce((sum, w) => {
        const history = w.context!.executionHistory;
        const firstTask = history[0]?.timestamp;
        const lastTask = history[history.length - 1]?.completedAt;
        if (firstTask && lastTask) {
          return sum + (lastTask.getTime() - firstTask.getTime());
        }
        return sum;
      }, 0) / completedWithHistory.length
    : 0;
  
  const complexityDistribution: Record<Complexity, number> = {
    simple: 0,
    medium: 0,
    complex: 0,
    very_complex: 0
  };
  
  workflows.forEach(w => {
    const complexity = w.metadata.complexity || 'medium';
    if (complexity in complexityDistribution) {
      complexityDistribution[complexity as Complexity]++;
    }
  });
  
  return {
    totalWorkflows,
    completedWorkflows,
    pendingWorkflows,
    averageTasksPerWorkflow: Math.round(averageTasksPerWorkflow * 10) / 10,
    averageCompletionTime: Math.round(averageCompletionTime / 1000 / 60), // minutes
    complexityDistribution
  };
}
