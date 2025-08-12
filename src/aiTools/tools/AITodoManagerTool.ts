/**
 * AI Todo Management Tool - Exposes todo management capabilities to AI agents
 * Provides comprehensive todo and workflow management through the AI Tools interface
 */

import * as vscode from 'vscode';
import { IAITool, IAIToolResult, IAIToolSchema } from '../IAITool';
import { AIToDosTool } from '../../extension';
import { TodoToolInput, TodoToolResult, AITodoManagerData } from '../../types';
import { BaseAIToolUtils } from '../BaseAIToolUtils';

export class AITodoManagerTool implements IAITool<AITodoManagerData> {
  public readonly name = 'ai_todos_manager';
  public readonly displayName = 'AI Todo Management System';
  public readonly description = '🤖 Advanced AI-powered todo management with intelligent workflow orchestration, semantic task analysis, and context preservation across sessions. Provides comprehensive task breakdown, progress tracking, and automated workflow execution for complex development processes.';

  public readonly schema: IAIToolSchema = {
    name: this.name,
    displayName: this.displayName,
    description: this.description,
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: '🎯 Action to perform: create, update, complete, delete, list, get, summary, createWorkflow, getWorkflowStatus, addSubTask, updateSubTask, analyze, prioritize, checkpoint, toggleAutoProgression, approve, requestGuidance, getNextSteps, clear',
          enum: [
            'create', 'update', 'complete', 'delete', 'list', 'get', 'summary',
            'createWorkflow', 'getWorkflowStatus', 'addSubTask', 'updateSubTask',
            'analyze', 'prioritize', 'checkpoint', 'toggleAutoProgression',
            'approve', 'requestGuidance', 'getNextSteps', 'clear'
          ]
        },
        content: {
          type: 'string',
          description: '📝 Task content or description for create/update operations'
        },
        todoId: {
          type: 'string',
          description: '🆔 Unique identifier for targeting specific todos'
        },
        status: {
          type: 'string',
          description: '🚦 Task status for workflow tracking',
          enum: ['pending', 'in_progress', 'completed', 'cancelled', 'blocked', 'paused', 'awaiting_approval']
        },
        workflowTasks: {
          type: 'array',
          items: { type: 'string' },
          description: '🔄 Array of task descriptions for workflow creation'
        },
        priority: {
          type: 'string',
          description: '⭐ Task priority level',
          enum: ['low', 'medium', 'high', 'critical']
        },
        summary: {
          type: 'string',
          description: '📄 Detailed task description with context and requirements'
        },
        notes: {
          type: 'string',
          description: '📋 Additional notes or comments for the task'
        },
        subTaskContent: {
          type: 'string',
          description: '📝 Content for new subtasks when breaking down complex todos'
        },
        subTaskId: {
          type: 'string',
          description: '🔗 Identifier for targeting specific subtasks'
        },
        workflowId: {
          type: 'string',
          description: '🔄 Identifier for targeting specific workflows'
        },
        autoProgression: {
          type: 'boolean',
          description: '⚡ Enable/disable automatic workflow progression'
        },
        userModel: {
          type: 'object',
          description: '🤖 User-selected language model to use for AI operations (if available)'
        }
      },
      required: ['action']
    }
  };

  constructor(private todosTool: AIToDosTool) {}

  public validate(parameters: { [key: string]: any }): boolean {
    // Use base utilities for validation
    const basicValidation = BaseAIToolUtils.validateRequiredParams(
      parameters, 
      ['action'], 
      'AI Todo Manager'
    );
    
    if (!basicValidation.isValid) {
      console.error(basicValidation.error);
      return false;
    }

    // Validate action enum
    const actionValidation = BaseAIToolUtils.validateEnum(
      parameters.action,
      this.schema.parameters.properties.action.enum as string[],
      'action',
      'AI Todo Manager'
    );
    
    if (!actionValidation.isValid) {
      console.error(actionValidation.error);
      return false;
    }

    // Action-specific validation
    const { action } = parameters;
    switch (action) {
      case 'create':
      case 'createWorkflow':
        return !!(parameters.content && typeof parameters.content === 'string');
      
      case 'update':
      case 'complete':
      case 'delete':
      case 'get':
        return !!(parameters.todoId && typeof parameters.todoId === 'string');
      
      case 'addSubTask':
        return !!(
          parameters.todoId && typeof parameters.todoId === 'string' &&
          parameters.subTaskContent && typeof parameters.subTaskContent === 'string'
        );
      
      case 'updateSubTask':
        return !!(
          parameters.todoId && typeof parameters.todoId === 'string' &&
          parameters.subTaskId && typeof parameters.subTaskId === 'string'
        );
      
      case 'getWorkflowStatus':
        return !!(parameters.workflowId && typeof parameters.workflowId === 'string');
      
      default:
        return true; // Actions like 'list', 'summary', 'clear' don't require additional params
    }
  }

  public async execute(parameters: { [key: string]: any }): Promise<IAIToolResult<AITodoManagerData>> {
    return BaseAIToolUtils.safeExecute(async () => {
      // Convert parameters to TodoToolInput format
      const toolInput: TodoToolInput = {
        action: parameters.action,
        content: parameters.content,
        todoId: parameters.todoId,
        status: parameters.status,
        workflowTasks: parameters.workflowTasks,
        priority: parameters.priority,
        summary: parameters.summary,
        notes: parameters.notes,
        subTaskContent: parameters.subTaskContent,
        subTaskId: parameters.subTaskId,
        workflowId: parameters.workflowId,
        autoProgression: parameters.autoProgression
      };

      // Execute the action through the existing language model tool with proper typing
      const result = await vscode.commands.executeCommand(
        'ai-todos-tool.executeTodoTool', 
        toolInput
      ) as TodoToolResult;

      // Check if result indicates success
      if (!result.success) {
        throw new Error(result.error || 'Todo operation failed');
      }

      // Return the typed data
      return result.data;

    }, 'ai_todos_manager', {
      action: parameters.action,
      hasContent: !!parameters.content,
      hasTodoId: !!parameters.todoId,
      hasWorkflowId: !!parameters.workflowId
    });
  }
}
