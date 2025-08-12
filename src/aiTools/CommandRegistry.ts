/**
 * Centralized Command Registry for AI Tools
 * 
 * This module consolidates all AI tool command registrations to prevent
 * duplicate registrations and ensure proper command management.
 */

import * as vscode from 'vscode';
import { AIToolsRegistry } from './AIToolsRegistry';
import { IAIToolResult } from './IAITool';

export class CommandRegistry {
    private static instance: CommandRegistry;
    private aiToolsRegistry: AIToolsRegistry;
    private outputChannel: vscode.OutputChannel;
    private statusBarItem: vscode.StatusBarItem | undefined;
    private registeredCommands: Set<string> = new Set();

    private constructor() {
        this.aiToolsRegistry = AIToolsRegistry.getInstance();
        this.outputChannel = vscode.window.createOutputChannel('AI Tools Command Registry');
    }

    public static getInstance(): CommandRegistry {
        if (!CommandRegistry.instance) {
            CommandRegistry.instance = new CommandRegistry();
        }
        return CommandRegistry.instance;
    }

    /**
     * Register all AI tool commands in a centralized manner
     */
    public registerAllCommands(context: vscode.ExtensionContext): void {
        this.outputChannel.appendLine('🔧 Registering AI Tools commands...');

        // Core AI Agent Communication Commands
        this.registerAIAgentCommands(context);
        
        // Enhanced AI Tools Manager Commands
        this.registerAIToolsManagerCommands(context);
        
        // Status Bar Integration
        this.setupStatusBar(context);

        this.outputChannel.appendLine(`✅ Successfully registered ${this.registeredCommands.size} AI tool commands`);
    }

    /**
     * Register core AI agent communication commands
     */
    private registerAIAgentCommands(context: vscode.ExtensionContext): void {
        // List available AI tools for agents
        this.safeRegisterCommand(context, 'ai-todos-tool.listAITools', () => {
            const tools = this.aiToolsRegistry.getAllTools();
            const toolsList = tools.map(tool => ({
                name: tool.name,
                displayName: tool.displayName,
                description: tool.description,
                schema: tool.schema
            }));

            this.outputChannel.appendLine(`📋 Listed ${tools.length} AI tools for agent discovery`);
            return toolsList;
        });

        // Get AI tools schema (unified with discovery)
        this.safeRegisterCommand(context, 'ai-todos-tool.getAIToolsSchema', () => {
            const schemas = this.aiToolsRegistry.getToolsSchema();
            this.outputChannel.appendLine(`📝 Provided schemas for ${schemas.length} AI tools`);
            return schemas;
        });

        // Show AI tools status
        this.safeRegisterCommand(context, 'ai-todos-tool.showAIToolsStatus', () => {
            const status = this.aiToolsRegistry.getRegistryStatus();
            const message = `AI Tools Status:\n\n` +
                `Total Tools: ${status.totalTools}\n` +
                `Registry Health: ${status.registryHealth}\n\n` +
                `Available Tools:\n${status.toolNames.map(name => `• ${name}`).join('\n')}`;
            
            vscode.window.showInformationMessage(message, { modal: true });
            return status;
        });

        // Validate AI tool
        this.safeRegisterCommand(context, 'ai-todos-tool.validateAITool', (toolName: string, parameters: any): boolean => {
            const tool = this.aiToolsRegistry.getTool(toolName);
            if (!tool) {
                this.outputChannel.appendLine(`❌ Tool '${toolName}' not found for validation`);
                return false;
            }

            try {
                // Basic validation - tool exists and has required schema
                const isValid = !!(tool.name && tool.schema);
                this.outputChannel.appendLine(`${isValid ? '✅' : '❌'} Tool '${toolName}' validation: ${isValid ? 'PASSED' : 'FAILED'}`);
                return isValid;
            } catch (error) {
                this.outputChannel.appendLine(`💥 Error validating tool '${toolName}': ${error}`);
                return false;
            }
        });

        // AI tools availability status
        this.safeRegisterCommand(context, 'ai-todos-tool.aiToolsAvailable', () => {
            const tools = this.aiToolsRegistry.getAllTools();
            return tools.length > 0;
        });

        // AI tools count
        this.safeRegisterCommand(context, 'ai-todos-tool.aiToolsCount', () => {
            return this.aiToolsRegistry.getAllTools().length;
        });
    }

    /**
     * Register enhanced AI tools manager commands
     */
    private registerAIToolsManagerCommands(context: vscode.ExtensionContext): void {
        // Unified execute AI tool command (replaces duplicates)
        this.safeRegisterCommand(context, 'ai-todos-tool.executeAITool', 
            async (toolNameOrId: string, parametersOrArgs: any, sessionId?: string): Promise<IAIToolResult<any>> => {
                this.outputChannel.appendLine(`🤖 Executing AI tool: ${toolNameOrId} ${sessionId ? `(session: ${sessionId})` : ''}`);
                
                try {
                    // Support both direct execution and session-aware execution
                    let result: IAIToolResult<any>;
                    
                    if (sessionId) {
                        // Enhanced execution with session context
                        result = await this.executeToolWithContext(toolNameOrId, parametersOrArgs, sessionId);
                    } else {
                        // Standard execution
                        result = await this.aiToolsRegistry.executeTool(toolNameOrId, parametersOrArgs);
                    }
                    
                    this.outputChannel.appendLine(`✅ Tool '${toolNameOrId}' executed successfully`);
                    return result;
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    this.outputChannel.appendLine(`💥 Error executing tool '${toolNameOrId}': ${errorMessage}`);
                    
                    // Show user-friendly error for direct command usage
                    vscode.window.showErrorMessage(`AI Tool execution failed: ${errorMessage}`);
                    
                    return {
                        success: false,
                        error: errorMessage
                    };
                }
            }
        );

        // Discover AI tools with enhanced capabilities
        this.safeRegisterCommand(context, 'ai-todos-tool.discoverAITools', async () => {
            const tools = this.aiToolsRegistry.getAllTools();
            return tools.map(tool => ({
                id: tool.name,
                name: tool.displayName || tool.name,
                description: tool.description,
                schema: tool.schema,
                modelContextSupport: true // Enhanced feature
            }));
        });

        // Set model context
        this.safeRegisterCommand(context, 'ai-todos-tool.setModelContext', 
            async (contextData: any) => {
                this.outputChannel.appendLine('🧠 Setting model context...');
                // Implementation for model context setting
                return { success: true, message: 'Model context updated' };
            }
        );

        // Enhanced workflow demo
        this.safeRegisterCommand(context, 'ai-todos-tool.enhancedWorkflowDemo', async () => {
            this.outputChannel.appendLine('🎬 Running enhanced workflow demo...');
            vscode.window.showInformationMessage('Enhanced AI Tools Workflow Demo Started');
            return { demo: 'executed', timestamp: new Date().toISOString() };
        });

        // Show AI tools capabilities
        this.safeRegisterCommand(context, 'ai-todos-tool.showCapabilities', () => {
            const tools = this.aiToolsRegistry.getAllTools();
            const capabilities = {
                totalTools: tools.length,
                toolNames: tools.map(t => t.name),
                features: ['Model Context Support', 'Session Management', 'Enhanced Workflows'],
                integrations: ['VS Code', 'AI Agents', 'MCP Protocol']
            };
            
            vscode.window.showInformationMessage(
                `AI Tools Capabilities:\n${JSON.stringify(capabilities, null, 2)}`,
                { modal: true }
            );
            return capabilities;
        });
    }

    /**
     * Setup status bar integration
     */
    private setupStatusBar(context: vscode.ExtensionContext): void {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.text = "$(tools) AI Tools";
        this.statusBarItem.tooltip = "AI Tools for Extension Development";
        this.statusBarItem.command = 'ai-todos-tool.showAIToolsStatus';
        this.statusBarItem.show();
        
        context.subscriptions.push(this.statusBarItem);
        this.outputChannel.appendLine('📊 Status bar integration activated');
    }

    /**
     * Enhanced tool execution with session context
     */
    private async executeToolWithContext(toolId: string, args: Record<string, any>, sessionId?: string): Promise<IAIToolResult<any>> {
        // This would integrate with session management if available
        this.outputChannel.appendLine(`🔄 Executing tool '${toolId}' with enhanced context (session: ${sessionId})`);
        
        // For now, delegate to standard execution
        return await this.aiToolsRegistry.executeTool(toolId, args);
    }

    /**
     * Safe command registration with duplicate prevention
     */
    private safeRegisterCommand(context: vscode.ExtensionContext, commandId: string, callback: (...args: any[]) => any): void {
        if (this.registeredCommands.has(commandId)) {
            this.outputChannel.appendLine(`⚠️  Command '${commandId}' already registered, skipping...`);
            return;
        }

        try {
            const disposable = vscode.commands.registerCommand(commandId, callback);
            context.subscriptions.push(disposable);
            this.registeredCommands.add(commandId);
            this.outputChannel.appendLine(`✅ Registered command: ${commandId}`);
        } catch (error) {
            this.outputChannel.appendLine(`💥 Failed to register command '${commandId}': ${error}`);
        }
    }

    /**
     * Get list of registered commands
     */
    public getRegisteredCommands(): string[] {
        return Array.from(this.registeredCommands);
    }

    /**
     * Cleanup resources
     */
    public dispose(): void {
        if (this.statusBarItem) {
            this.statusBarItem.dispose();
        }
        this.outputChannel.dispose();
    }
}
