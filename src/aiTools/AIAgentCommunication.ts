/**
 * AI Agent Communication - Handles communication between AI agents and tools
 * Provides commands and APIs for AI agents to discover and execute tools
 */

import * as vscode from 'vscode';
import { AIToolsRegistry } from './AIToolsRegistry';
import { IAIToolResult } from './IAITool';

export class AIAgentCommunication {
  private registry: AIToolsRegistry;
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.registry = AIToolsRegistry.getInstance();
    this.outputChannel = vscode.window.createOutputChannel('AI Agent Communication');
  }

  public registerCommands(context: vscode.ExtensionContext): void {
    // Command to list available AI tools
    const listToolsCmd = vscode.commands.registerCommand(
      'ai-todos-tool.listAITools',
      () => {
        const tools = this.registry.getAllTools();
        const toolsList = tools.map(tool => ({
          name: tool.name,
          displayName: tool.displayName,
          description: tool.description,
          schema: tool.schema
        }));

        this.outputChannel.appendLine(`📋 Listed ${tools.length} AI tools for agent discovery`);
        return toolsList;
      }
    );

    // Command to execute AI tools
    const executeToolCmd = vscode.commands.registerCommand(
      'ai-todos-tool.executeAITool',
      async (toolName: string, parameters: any): Promise<IAIToolResult<any>> => {
        this.outputChannel.appendLine(`🤖 AI agent requesting execution of tool: ${toolName}`);
        
        try {
          const result = await this.registry.executeTool(toolName, parameters);
          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.outputChannel.appendLine(`💥 Error executing tool for AI agent: ${errorMessage}`);
          return {
            success: false,
            error: errorMessage
          };
        }
      }
    );

    // Command to get AI tools schema (for tool discovery)
    const getSchemaCmd = vscode.commands.registerCommand(
      'ai-todos-tool.getAIToolsSchema',
      () => {
        const schemas = this.registry.getToolsSchema();
        this.outputChannel.appendLine(`📝 Provided schemas for ${schemas.length} AI tools`);
        return schemas;
      }
    );

    // Command to show AI tools status
    const showStatusCmd = vscode.commands.registerCommand(
      'ai-todos-tool.showAIToolsStatus',
      () => {
        const status = this.registry.getRegistryStatus();
        const message = `AI Tools Status:\n\n` +
          `Total Tools: ${status.totalTools}\n` +
          `Registry Health: ${status.registryHealth}\n\n` +
          `Available Tools:\n${status.toolNames.map(name => `• ${name}`).join('\n')}`;
        
        vscode.window.showInformationMessage(message, { modal: true });
        return status;
      }
    );

    // Command for AI agent tool validation
    const validateToolCmd = vscode.commands.registerCommand(
      'ai-todos-tool.validateAITool',
      (toolName: string, parameters: any): boolean => {
        const tool = this.registry.getTool(toolName);
        if (!tool) {
          this.outputChannel.appendLine(`❌ Tool '${toolName}' not found for validation`);
          return false;
        }
        
        const isValid = tool.validate(parameters);
        this.outputChannel.appendLine(`🔍 Validation for '${toolName}': ${isValid ? 'PASSED' : 'FAILED'}`);
        return isValid;
      }
    );

    context.subscriptions.push(
      listToolsCmd,
      executeToolCmd, 
      getSchemaCmd,
      showStatusCmd,
      validateToolCmd
    );
  }

  // Notify AI agents that tools are available
  public async notifyToolsAvailable(): Promise<void> {
    const tools = this.registry.getAllTools();
    
    // Set context variable for AI agents
    await vscode.commands.executeCommand(
      'setContext',
      'ai-todos-tool.aiToolsAvailable',
      tools.length > 0
    );

    // Set context with tool count
    await vscode.commands.executeCommand(
      'setContext', 
      'ai-todos-tool.aiToolsCount',
      tools.length
    );

    this.outputChannel.appendLine(`📢 Notified AI agents: ${tools.length} tools available`);
  }

  // Create status bar item for AI tools
  public createStatusBarItem(context: vscode.ExtensionContext): vscode.StatusBarItem {
    const statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      200
    );
    
    const updateStatusBar = () => {
      const status = this.registry.getRegistryStatus();
      statusBarItem.text = `$(tools) AI Tools: ${status.totalTools}`;
      statusBarItem.tooltip = `AI Tools Available: ${status.totalTools}\nRegistry Health: ${status.registryHealth}\n\nClick to view details`;
      statusBarItem.command = 'ai-todos-tool.showAIToolsStatus';
      statusBarItem.show();
    };

    updateStatusBar();
    context.subscriptions.push(statusBarItem);
    
    return statusBarItem;
  }

  // API for programmatic access by AI agents
  public async getToolsForAgent(): Promise<any[]> {
    const tools = this.registry.getAllTools();
    return tools.map(tool => ({
      id: tool.name,
      name: tool.displayName,
      description: tool.description,
      parameters: tool.schema.parameters,
      invoke: async (params: any) => {
        return await this.registry.executeTool(tool.name, params);
      }
    }));
  }

  public dispose(): void {
    this.outputChannel.dispose();
  }
}
