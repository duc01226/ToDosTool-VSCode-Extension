import * as vscode from 'vscode';
import { AIToolsRegistry } from './AIToolsRegistry';
import { getAiModel } from '../aiUtils';
import { EnhancedWorkflowDemo } from './EnhancedWorkflowDemo';
import { BaseAIToolUtils, AIModelInfo } from './BaseAIToolUtils';
import { IAIToolResult } from './IAITool';

/**
 * Enhanced AI Tools Manager that provides a bridge between AI agents and tools
 * Includes support for user-selected models and tool execution with context
 */
export class AIToolsManager {
    private static instance: AIToolsManager;
    private registry: AIToolsRegistry;
    private userModelContext: { [sessionId: string]: vscode.LanguageModelChat } = {};

    private constructor() {
        this.registry = AIToolsRegistry.getInstance();
    }

    public static getInstance(): AIToolsManager {
        if (!AIToolsManager.instance) {
            AIToolsManager.instance = new AIToolsManager();
        }
        return AIToolsManager.instance;
    }

    /**
     * Set user model context for a session (when available from AI agent request)
     */
    public setUserModelContext(sessionId: string, model: vscode.LanguageModelChat): void {
        if (!sessionId || !BaseAIToolUtils.isValidLanguageModel(model)) {
            throw new Error('Invalid session ID or language model provided');
        }
        this.userModelContext[sessionId] = model;
    }

    /**
     * Get user model context for a session
     */
    public getUserModelContext(sessionId: string): vscode.LanguageModelChat | undefined {
        return sessionId ? this.userModelContext[sessionId] : undefined;
    }

    /**
     * Clear session context
     */
    public clearSession(sessionId: string): void {
        if (sessionId && this.userModelContext[sessionId]) {
            delete this.userModelContext[sessionId];
        }
    }

    /**
     * Execute a tool with enhanced model context
     */
    public async executeToolWithContext(
        toolId: string, 
        args: Record<string, any>, 
        sessionId?: string
    ): Promise<IAIToolResult<any>> {
        const tool = this.registry.getTool(toolId);
        if (!tool) {
            return BaseAIToolUtils.createErrorResult(
                `Tool '${toolId}' not found`,
                'AIToolsManager'
            );
        }

        // Enhance args with user model context if available
        const enhancedArgs = { ...args };
        if (sessionId) {
            const userModel = this.getUserModelContext(sessionId);
            if (userModel) {
                enhancedArgs._userModel = userModel;
            }
        }

        try {
            return await tool.execute(enhancedArgs);
        } catch (error) {
            return BaseAIToolUtils.createErrorResult(
                error instanceof Error ? error : new Error(String(error)),
                `AIToolsManager.${toolId}`
            );
        }
    }

    /**
     * Get available model with user preference priority
     */
    public async getAvailableModelWithContext(sessionId?: string): Promise<AIModelInfo> {
        // Use utility function for standardized model resolution
        const userModel = sessionId ? this.getUserModelContext(sessionId) : undefined;
        return await BaseAIToolUtils.getAvailableLanguageModel(userModel, 'AIToolsManager');
    }

    /**
     * Register AI Tools activation with VS Code commands
     */
    public registerCommands(context: vscode.ExtensionContext): void {
        const commands = [
            // Enhanced discover command that includes session support
            vscode.commands.registerCommand(
                'ai-todos-tool.discoverAITools',
                async (sessionId?: string) => {
                    try {
                        const tools = this.registry.getAvailableTools();
                        return tools.map((tool: any) => ({
                            ...tool,
                            sessionSupport: true,
                            modelContextSupport: true
                        }));
                    } catch (error) {
                        console.error('Failed to discover AI tools:', error);
                        return [];
                    }
                }
            ),

            // Enhanced execute command with session context
            vscode.commands.registerCommand(
                'ai-todos-tool.executeAITool',
                async (toolId: string, args: Record<string, any>, sessionId?: string) => {
                    try {
                        return await this.executeToolWithContext(toolId, args, sessionId);
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        vscode.window.showErrorMessage(`AI Tool execution failed: ${errorMessage}`);
                        throw error;
                    }
                }
            ),

            // Model context management command
            vscode.commands.registerCommand(
                'ai-todos-tool.setModelContext',
                (sessionId: string, model: vscode.LanguageModelChat) => {
                    try {
                        this.setUserModelContext(sessionId, model);
                        return BaseAIToolUtils.createSuccessResult(
                            { sessionId }, 
                            'AIToolsManager.setModelContext'
                        );
                    } catch (error) {
                        return BaseAIToolUtils.createErrorResult(
                            error instanceof Error ? error : new Error(String(error)),
                            'AIToolsManager.setModelContext'
                        );
                    }
                }
            ),

            // Enhanced demo command for complex workflow demonstration
            vscode.commands.registerCommand(
                'ai-todos-tool.enhancedWorkflowDemo',
                async () => {
                    try {
                        const demo = new EnhancedWorkflowDemo();
                        await demo.demonstrateComplexWorkflow();
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        vscode.window.showErrorMessage(`Enhanced workflow demo failed: ${errorMessage}`);
                    }
                }
            ),

            // Capabilities summary command
            vscode.commands.registerCommand(
                'ai-todos-tool.showCapabilities',
                async () => {
                    try {
                        const demo = new EnhancedWorkflowDemo();
                        await demo.showCapabilitiesSummary();
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        vscode.window.showErrorMessage(`Show capabilities failed: ${errorMessage}`);
                    }
                }
            )
        ];

        context.subscriptions.push(...commands);
    }

    /**
     * Safely extract nested property with fallback
     */
    private static extractProperty<T>(
        obj: any, 
        path: string, 
        fallback: T
    ): T {
        try {
            const keys = path.split('.');
            let current = obj;
            for (const key of keys) {
                if (current && typeof current === 'object' && key in current) {
                    current = current[key];
                } else {
                    return fallback;
                }
            }
            return current !== undefined ? current : fallback;
        } catch {
            return fallback;
        }
    }

    /**
     * Demo function to show AI Tools working
     */
    public async demoAITools(): Promise<void> {
        return BaseAIToolUtils.safeExecute(async () => {
            vscode.window.showInformationMessage('Running AI Tools Demo...');

            // Demo 1: Semantic Analysis
            const semanticResult = await this.executeToolWithContext(
                'ai_semantic_analyzer',
                {
                    prompt: 'function calculateTotal(items) { return items.reduce((sum, item) => sum + item.price, 0); }',
                    analysisType: 'complexity',
                    context: 'E-commerce application checkout system'
                }
            );

            console.log('Semantic Analysis Result:', JSON.stringify(semanticResult, null, 2));
            
            const complexity = AIToolsManager.extractProperty(semanticResult, 'data.result.complexity', 'unknown');
            vscode.window.showInformationMessage(
                `Semantic Analysis: ${complexity} complexity`
            );

            // Demo 2: Todo Management
            const todoResult = await this.executeToolWithContext(
                'ai_todos_manager',
                {
                    action: 'create',
                    content: 'TODO: Implement user authentication system with OAuth2 support'
                }
            );

            console.log('Todo Management Result:', JSON.stringify(todoResult, null, 2));
            
            const todoId = AIToolsManager.extractProperty(todoResult, 'data.todo.id', null) || 
                          AIToolsManager.extractProperty(todoResult, 'data.id', 'Success');
            vscode.window.showInformationMessage(
                `Todo Created: ${todoId}`
            );

            // Demo 3: Workflow Orchestration
            const workflowResult = await this.executeToolWithContext(
                'ai_workflow_orchestrator',
                {
                    objective: 'Building a new feature for user profile management',
                    complexity: 'medium',
                    approach: 'sequential_workflow'
                }
            );

            console.log('Workflow Orchestration Result:', JSON.stringify(workflowResult, null, 2));
            
            const taskCount = AIToolsManager.extractProperty(workflowResult, 'data.tasks.length', null) ||
                             AIToolsManager.extractProperty(workflowResult, 'data.workflow.tasks.length', 'several');
            vscode.window.showInformationMessage(
                `Workflow Plan: ${taskCount} tasks planned`
            );

            vscode.window.showInformationMessage('AI Tools Demo completed successfully!');

            return {
                completed: true,
                demos: ['semantic_analysis', 'todo_management', 'workflow_orchestration'],
                timestamp: new Date().toISOString()
            };

        }, 'AIToolsManager.demoAITools', {
            operation: 'demo_ai_tools',
            demos: 3
        }).then(result => {
            if (!result.success && result.error) {
                console.error('AI Tools Demo error:', result.error);
                vscode.window.showErrorMessage(`AI Tools Demo failed: ${result.error}`);
            }
        }).catch(error => {
            console.error('Unexpected AI Tools Demo error:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`AI Tools Demo failed: ${errorMessage}`);
        });
    }
}
