/**
 * AI Workflow Orchestrator Tool - Advanced workflow generation and management
 * Creates intelligent workflows from natural language requirements
 */

import * as vscode from 'vscode';
import { IAITool, IAIToolResult, IAIToolSchema } from '../IAITool';
import { generateWorkflowTasks, getAiModel, IDGenerator } from '../../aiUtils';
import { Complexity, WorkflowTask } from '../../types';
import { BaseAIToolUtils } from '../BaseAIToolUtils';

export class AIWorkflowOrchestratorTool implements IAITool<{
  objective: string;
  complexity: string;
  approach: string;
  autoExecute: boolean;
  requireApproval: boolean;
  workflowTasks: WorkflowTask[];
  totalSteps: number;
  estimatedDuration: string;
  modelInfo: {
    hasModel: boolean;
    modelType: string;
    modelName?: string;
  };
  workflowId: string;
}> {
  public readonly name = 'ai_workflow_orchestrator';
  public readonly displayName = 'AI Workflow Orchestrator';
  public readonly description = '🚀 Advanced workflow generation and management with AI-powered task breakdown, dependency analysis, and execution guidance. Creates intelligent workflows from natural language requirements with automated progression and context preservation.';

  public readonly schema: IAIToolSchema = {
    name: this.name,
    displayName: this.displayName,
    description: this.description,
    parameters: {
      type: 'object',
      properties: {
        objective: {
          type: 'string',
          description: '🎯 Main objective or goal for workflow creation'
        },
        complexity: {
          type: 'string',
          description: '📊 Estimated complexity level',
          enum: ['simple', 'medium', 'complex', 'very_complex']
        },
        approach: {
          type: 'string',
          description: '🛠️ Workflow approach strategy',
          enum: ['single_task', 'sequential_workflow', 'multi_phase_discovery', 'approval_workflow']
        },
        autoExecute: {
          type: 'boolean',
          description: '⚡ Enable automatic progression between workflow steps'
        },
        requireApproval: {
          type: 'boolean',
          description: '✅ Require manual approval for critical steps'
        },
        context: {
          type: 'object',
          description: '🌐 Additional context for workflow creation',
          properties: {
            projectType: { type: 'string' },
            technology: { type: 'string' },
            timeframe: { type: 'string' },
            resources: { type: 'array', items: { type: 'string' } }
          }
        },
        constraints: {
          type: 'object',
          description: '⚠️ Constraints and limitations',
          properties: {
            maxSteps: { type: 'number' },
            timeLimit: { type: 'string' },
            dependencies: { type: 'array', items: { type: 'string' } }
          }
        },
        userModel: {
          type: 'object',
          description: '🤖 User-selected language model to use for workflow generation (if available)'
        }
      },
      required: ['objective']
    }
  };

  public validate(parameters: { [key: string]: any }): boolean {
    const { objective } = parameters;
    
    // Validate required objective parameter
    if (!objective || typeof objective !== 'string' || objective.trim().length === 0) {
      return false;
    }
    
    // Validate complexity if provided
    if (parameters.complexity) {
      const allowedComplexity = this.schema.parameters.properties.complexity.enum;
      if (!allowedComplexity.includes(parameters.complexity)) {
        return false;
      }
    }
    
    // Validate approach if provided
    if (parameters.approach) {
      const allowedApproaches = this.schema.parameters.properties.approach.enum;
      if (!allowedApproaches.includes(parameters.approach)) {
        return false;
      }
    }
    
    return true;
  }

  public async execute(parameters: { [key: string]: any }): Promise<IAIToolResult<{
    objective: string;
    complexity: string;
    approach: string;
    autoExecute: boolean;
    requireApproval: boolean;
    workflowTasks: WorkflowTask[];
    totalSteps: number;
    estimatedDuration: string;
    modelInfo: {
      hasModel: boolean;
      modelType: string;
      modelName?: string;
    };
    workflowId: string;
  }>> {
    const { 
      objective, 
      complexity = 'medium',
      approach = 'sequential_workflow',
      autoExecute = false,
      requireApproval = false,
      context,
      constraints,
      userModel
    } = parameters;

    return BaseAIToolUtils.safeExecute(async () => {
      // Get available language model using base utilities
      const modelInfo = await BaseAIToolUtils.getAvailableLanguageModel(
        userModel, 
        'AI Workflow Orchestrator'
      );
      
      let workflowTasks: WorkflowTask[];
      
      if (modelInfo.model) {
        // Use AI-powered workflow generation
        workflowTasks = await this.generateAIWorkflow(
          objective,
          complexity,
          approach,
          modelInfo.model,
          context,
          constraints
        );
      } else {
        // Fallback to rule-based workflow generation
        workflowTasks = this.generateFallbackWorkflow(
          objective,
          complexity,
          approach,
          context,
          constraints
        );
      }

      // Enhance workflow with metadata
      const enhancedWorkflow = this.enhanceWorkflowWithMetadata(
        workflowTasks,
        {
          objective,
          complexity,
          approach,
          autoExecute,
          requireApproval,
          context,
          constraints
        }
      );

      return {
        objective,
        complexity,
        approach,
        autoExecute,
        requireApproval,
        workflowTasks: enhancedWorkflow,
        totalSteps: enhancedWorkflow.length,
        estimatedDuration: this.calculateTotalDuration(enhancedWorkflow),
        modelInfo: {
          hasModel: !!modelInfo.model,
          modelType: modelInfo.modelType,
          modelName: modelInfo.modelName
        },
        workflowId: IDGenerator.generateUniqueId('wf')
      };

    }, 'ai_workflow_orchestrator', {
      objective: objective ? objective.substring(0, 100) + (objective.length > 100 ? '...' : '') : '',
      complexity,
      approach
    });
  }

  private async generateAIWorkflow(
    objective: string,
    complexity: Complexity,
    approach: string,
    model: vscode.LanguageModelChat,
    context?: any,
    constraints?: any
  ): Promise<WorkflowTask[]> {
    try {
      // Use base utilities to create AI function wrapper
      const aiFunction = BaseAIToolUtils.createAIFunctionWrapper(model);
      return await generateWorkflowTasks(objective, complexity, aiFunction);
    } catch (error) {
      // Fallback if AI generation fails
      return this.generateFallbackWorkflow(objective, complexity, approach, context, constraints);
    }
  }

  private generateFallbackWorkflow(
    objective: string,
    complexity: string,
    approach: string,
    context?: any,
    constraints?: any
  ): WorkflowTask[] {
    const maxSteps = constraints?.maxSteps || (complexity === 'simple' ? 3 : complexity === 'medium' ? 5 : 8);
    
    const baseSteps: WorkflowTask[] = [
      {
        content: `Analyze requirements for: ${objective}`,
        description: 'Break down the objective into specific requirements and understand the scope',
        estimatedDuration: '15-30 minutes',
        dependencies: [],
        guidance: {
          parentObjective: objective,
          aiInstructions: 'Thoroughly analyze the requirements and identify key components',
          expectedOutput: 'Detailed requirements analysis',
          nextStepGuidance: 'Use this analysis to plan the implementation approach',
          validationCriteria: 'Requirements are clear and actionable',
          recoveryInstructions: 'If requirements are unclear, gather more information from stakeholders'
        }
      },
      {
        content: `Plan implementation approach for: ${objective}`,
        description: 'Design the overall strategy and identify key milestones',
        estimatedDuration: '20-45 minutes',
        dependencies: [],
        guidance: {
          parentObjective: objective,
          aiInstructions: 'Create a structured plan with clear milestones and dependencies',
          expectedOutput: 'Implementation plan with timeline',
          nextStepGuidance: 'Begin execution according to the planned approach',
          validationCriteria: 'Plan is feasible and well-structured',
          recoveryInstructions: 'Revise plan if issues are identified during review'
        }
      }
    ];

    // Add complexity-specific steps
    if (complexity === 'complex' || complexity === 'very_complex') {
      baseSteps.push({
        content: `Set up development environment and dependencies`,
        description: 'Prepare tools, libraries, and infrastructure needed',
        estimatedDuration: '30-60 minutes',
        dependencies: [],
        guidance: {
          parentObjective: objective,
          aiInstructions: 'Ensure all necessary tools and dependencies are properly configured',
          expectedOutput: 'Fully configured development environment',
          nextStepGuidance: 'Begin core implementation with environment ready',
          validationCriteria: 'Environment is stable and all dependencies resolved',
          recoveryInstructions: 'Troubleshoot any setup issues before proceeding'
        }
      });
    }

    baseSteps.push({
      content: `Implement core functionality for: ${objective}`,
      description: 'Build the main features and functionality',
      estimatedDuration: complexity === 'simple' ? '1-2 hours' : complexity === 'medium' ? '2-4 hours' : '4-8 hours',
      dependencies: [],
      guidance: {
        parentObjective: objective,
        aiInstructions: 'Focus on core functionality first, then add supporting features',
        expectedOutput: 'Working implementation of core features',
        nextStepGuidance: 'Test the implementation and verify it meets requirements',
        validationCriteria: 'Core functionality works as expected',
        recoveryInstructions: 'Debug issues systematically and refer to documentation'
      }
    });

    if (complexity !== 'simple') {
      baseSteps.push({
        content: `Test and validate implementation`,
        description: 'Verify functionality works correctly and meets requirements',
        estimatedDuration: '30-90 minutes',
        dependencies: [],
        guidance: {
          parentObjective: objective,
          aiInstructions: 'Create comprehensive tests covering main use cases',
          expectedOutput: 'Verified working implementation',
          nextStepGuidance: 'Document and finalize the implementation',
          validationCriteria: 'All tests pass and requirements are met',
          recoveryInstructions: 'Fix any identified issues and retest'
        }
      });
    }

    baseSteps.push({
      content: `Finalize and document: ${objective}`,
      description: 'Complete final touches and create documentation',
      estimatedDuration: '20-45 minutes',
      dependencies: [],
      guidance: {
        parentObjective: objective,
        aiInstructions: 'Ensure code is clean, documented, and ready for production',
        expectedOutput: 'Complete, documented implementation',
        nextStepGuidance: 'Implementation is ready for deployment or delivery',
        validationCriteria: 'Documentation is complete and implementation is polished',
        recoveryInstructions: 'Address any remaining issues or documentation gaps'
      }
    });

    return baseSteps.slice(0, maxSteps);
  }

  private enhanceWorkflowWithMetadata(
    workflowTasks: WorkflowTask[],
    parameters: any
  ): WorkflowTask[] {
    const workflowId = IDGenerator.generateUniqueId('wf');
    return workflowTasks.map((task, index) => ({
      ...task,
      id: `${workflowId}-step-${index + 1}`,
      guidance: {
        parentObjective: parameters.objective,
        aiInstructions: task.guidance?.aiInstructions || 'Complete this workflow step',
        expectedOutput: task.guidance?.expectedOutput || 'Step completed successfully',
        nextStepGuidance: task.guidance?.nextStepGuidance || 'Proceed to next step',
        validationCriteria: task.guidance?.validationCriteria || 'Step meets requirements',
        recoveryInstructions: task.guidance?.recoveryInstructions || 'Review and retry if issues occur',
        approvalRequired: parameters.requireApproval && (index === 0 || index === workflowTasks.length - 1)
      }
    }));
  }

  private calculateTotalDuration(workflowTasks: WorkflowTask[]): string {
    // Simple duration calculation - in practice, this would be more sophisticated
    const taskCount = workflowTasks.length;
    const baseMinutes = taskCount * 30; // 30 minutes per task average
    const maxMinutes = taskCount * 120; // 2 hours per task maximum
    
    if (baseMinutes < 60) {
      return `${baseMinutes}-${Math.min(maxMinutes, 90)} minutes`;
    } else {
      const baseHours = Math.floor(baseMinutes / 60);
      const maxHours = Math.floor(maxMinutes / 60);
      return `${baseHours}-${maxHours} hours`;
    }
  }
}
