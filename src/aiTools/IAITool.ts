/**
 * AI Tools Interface - Base interface for all AI agent discoverable tools
 * Provides a standardized way for AI agents to discover and invoke tools
 */

export interface IAIToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  enum?: string[];
  properties?: { [key: string]: IAIToolParameter };
  items?: IAIToolParameter;
}

export interface IAIToolResult<TData = any> {
  success: boolean;
  data?: TData;
  error?: string;
  metadata?: { [key: string]: any };
}

export interface IAIToolSchema {
  name: string;
  displayName: string;
  description: string;
  parameters: {
    type: 'object';
    properties: { [key: string]: any };
    required: string[];
  };
}

export interface IAITool<TData = any> {
  readonly name: string;
  readonly displayName: string;
  readonly description: string;
  readonly schema: IAIToolSchema;
  
  execute(parameters: { [key: string]: any }): Promise<IAIToolResult<TData>>;
  validate(parameters: { [key: string]: any }): boolean;
}

export interface AIToolsManager {
  registerTool(tool: IAITool<any>): void;
  getTool(name: string): IAITool<any> | undefined;
  getAllTools(): IAITool<any>[];
  executeTool(name: string, parameters: any): Promise<IAIToolResult<any>>;
  getToolsSchema(): IAIToolSchema[];
}
