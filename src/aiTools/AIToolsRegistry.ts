/**
 * AI Tools Registry - Central registry for all AI agent discoverable tools
 * Manages tool registration, discovery, and execution
 */

import * as vscode from 'vscode';
import { IAITool, IAIToolResult, IAIToolSchema, AIToolsManager } from './IAITool';

export class AIToolsRegistry implements AIToolsManager {
  private static instance: AIToolsRegistry;
  private tools: Map<string, IAITool<any>> = new Map();
  private outputChannel: vscode.OutputChannel;

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel('AI Tools Registry');
  }

  public static getInstance(): AIToolsRegistry {
    if (!AIToolsRegistry.instance) {
      AIToolsRegistry.instance = new AIToolsRegistry();
    }
    return AIToolsRegistry.instance;
  }

  public registerTool(tool: IAITool<any>): void {
    this.tools.set(tool.name, tool);
    this.outputChannel.appendLine(`🔧 Registered AI tool: ${tool.name} (${tool.displayName})`);
    console.log(`AI Tools Registry: Registered tool '${tool.name}'`);
  }

  public getTool(name: string): IAITool<any> | undefined {
    return this.tools.get(name);
  }

  public getAllTools(): IAITool<any>[] {
    return Array.from(this.tools.values());
  }

  public getToolsSchema(): IAIToolSchema[] {
    return this.getAllTools().map(tool => tool.schema);
  }

  public getAvailableTools(): IAIToolSchema[] {
    return this.getToolsSchema();
  }

  public async executeTool(name: string, parameters: any): Promise<IAIToolResult<any>> {
    const startTime = Date.now();
    this.outputChannel.appendLine(`⚡ Executing AI tool: ${name} with parameters: ${JSON.stringify(parameters, null, 2)}`);
    
    const tool = this.getTool(name);
    if (!tool) {
      const error = `Tool '${name}' not found`;
      this.outputChannel.appendLine(`❌ ${error}`);
      return {
        success: false,
        error
      };
    }

    try {
      // Validate parameters
      if (!tool.validate(parameters)) {
        const error = `Invalid parameters for tool '${name}'`;
        this.outputChannel.appendLine(`❌ ${error}`);
        return {
          success: false,
          error
        };
      }

      // Execute tool
      const result = await tool.execute(parameters);
      const executionTime = Date.now() - startTime;
      
      if (result.success) {
        this.outputChannel.appendLine(`✅ Tool '${name}' executed successfully in ${executionTime}ms`);
      } else {
        this.outputChannel.appendLine(`❌ Tool '${name}' execution failed: ${result.error}`);
      }

      return {
        ...result,
        metadata: {
          ...result.metadata,
          executionTime,
          toolName: name,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.outputChannel.appendLine(`💥 Tool '${name}' threw exception: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
        metadata: {
          executionTime: Date.now() - startTime,
          toolName: name,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  public getRegistryStatus(): {
    totalTools: number;
    toolNames: string[];
    registryHealth: 'healthy' | 'degraded' | 'error';
  } {
    const tools = this.getAllTools();
    return {
      totalTools: tools.length,
      toolNames: tools.map(t => t.name),
      registryHealth: tools.length > 0 ? 'healthy' : 'degraded'
    };
  }

  public dispose(): void {
    this.outputChannel.dispose();
    this.tools.clear();
  }
}
