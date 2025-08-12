# 🚀 AI-ToDos-Tool: Universal AI Agent Orchestration

> **Advanced todo management with comprehensive AI integration: VSCode Language Model Tools + MCP (Model Context Protocol) + Extensible AI Tools Framework**

Transform complex development processes into structured, manageable workflows with AI-guided task breakdown, context preservation, and intelligent automation. Now compatible with **any AI model** that supports VS Code Language Models or MCP!

## 🌟 Universal AI Compatibility

### 🤖 Multi-Platform AI Support
- **GitHub Copilot** - Built-in VSCode Language Model Tools integration
- **Claude (Anthropic)** - Native MCP support  
- **GPT-4** - Via MCP-compatible clients or VS Code Language Models
- **Any AI Model** - With MCP capability or VS Code compatibility
- **Custom AI Agents** - Extensible AI tools framework

### 🔧 Triple Integration Architecture
- **VSCode Language Model Tools**: Automatic GitHub Copilot integration
- **MCP Server**: Manual connection for external AI models (Claude, GPT-4, etc.)
- **AI Tools Framework**: Specialized tools for semantic analysis and workflow orchestration
- **Shared State**: All AI models work with the same todo data
- **Seamless Switching**: Use different AI models for different tasks

## 🌟 Key Features Overview

### 🧠 AI Agent Orchestration
- **Context Loss Prevention**: Maintains parent objectives and context across complex workflows
- **Next-Step Guidance**: AI agents always know what to do next after completing tasks
- **Approval Workflow Support**: Built-in approval gates for controlled progression
- **Failure Recovery**: Automatic retry logic with detailed recovery instructions
- **Multi-Phase Project Management**: Handle complex workflows systematically

### 🎯 Core Todo Management
- **Enhanced Todo Creation**: Rich task creation with summaries, priorities, and tags
- **Smart Status Tracking**: Track todos through pending, in_progress, completed, cancelled
- **Intelligent SubTask Support**: Break down complex todos into manageable subtasks
- **Complete History Tracking**: Maintain full audit trail with timestamped changes
- **Session Management**: Organize work by sessions with auto-cleanup capabilities

### 🔗 Multi-Platform AI Integration

- **VS Code Language Model Tools**: Native GitHub Copilot integration with 4 specialized tools
- **MCP (Model Context Protocol)**: Connect with Claude, GPT-4, and any MCP-compatible AI
- **Chat Participants**: Interactive `@todos` chat interface
- **Specialized AI Tools**: 4 advanced tools (todosTool, aiSemanticAnalyzer, aiTodoManager, aiWorkflowOrchestrator)

### 📊 Advanced Visualization & Management
- **Interactive Dashboard**: Rich webview with real-time progress tracking
- **Status Bar Integration**: Live todo counts and workflow status
- **Workflow Orchestration**: Visual workflow progress with approval gates
- **Performance Analytics**: Task completion metrics and productivity insights

## �️ Quick Start

### Installation & Activation

1. Install the extension in VS Code
2. Press `F5` to launch Extension Development Host (for development)
3. The AI-ToDos-Tool automatically activates and shows in the status bar

### Option 1: GitHub Copilot (Built-in)

1. Install extension
2. Open GitHub Copilot Chat
3. Try: `@copilot I need to implement a user authentication system. Help me break this down into tasks.`
4. Copilot automatically uses the 4 registered Language Model Tools (todosTool, aiSemanticAnalyzer, aiTodoManager, aiWorkflowOrchestrator)

### Option 2: Claude/Other MCP Models

1. Install extension
2. Command Palette → `AI-ToDos: Start MCP Server`
3. Configure your AI client (see MCP Setup below)
4. Try: `"Create a workflow for building a REST API"`

### Create Your First Intelligent Workflow

```typescript
// Method 1: Keyboard Shortcut
// Press Ctrl+Shift+T (Cmd+Shift+T on Mac)

// Method 2: Chat Interface
@todos create "Implement user authentication system" "Full JWT-based auth with password reset"

// Method 3: AI Agent Auto-Detection
// Just describe a complex task - AI automatically creates enhanced workflows
"Build a real-time chat application with React and Socket.io"
```

### View Your Progress

- **Click status bar** showing todo counts
- **Press `Ctrl+Shift+D`** (Cmd+Shift+D on Mac) for dashboard
- **Use Command Palette**: "AI-ToDos-Tool: Show Dashboard"

## 🧠 Intelligent Features

### AI-Powered Task Analysis

- **Semantic Understanding**: Language-agnostic task classification
- **Complexity Assessment**: Automatic difficulty estimation
- **Smart Breakdown**: AI-generated subtask suggestions
- **Risk Analysis**: Proactive problem identification

### Dynamic Workflow Orchestration

- **Multi-Step Processes**: Automated task dependencies
- **Progress Tracking**: Real-time workflow monitoring
- **Auto-Progression**: Intelligent task advancement
- **Context Preservation**: Maintain state across sessions

### Cross-Session Intelligence

- **Memory Management**: Automatic cleanup of old todos
- **Session Archiving**: Preserve complex project states
- **Context Switching**: Smart session management
- **Progress Checkpoints**: Save and restore work states

## 🤖 AI Agent Workflow Orchestration

### Solving Critical AI Agent Problems

#### 1. **Context Loss Prevention**
```typescript
// Every todo maintains parent objective awareness
{
  content: "Phase 1: Initialize knowledge model",
  parentObjective: "Full-Stack Workflow Discovery Protocol",
  contextSnapshot: "Discovery phase - analyzing existing patterns",
  aiInstructions: "Use semantic_search extensively for pattern discovery"
}
```

#### 2. **Next-Step Guidance**
```typescript
// AI agents always know what to do next
{
  nextStepGuidance: "After completion, proceed to Phase 2 implementation planning",
  expectedOutput: "Knowledge model with prerequisite context",
  validationCriteria: "Model contains baseline understanding"
}
```

#### 3. **Approval Workflow Support**
```typescript
// Built-in approval gates for controlled workflows
{
  content: "Phase 3: Present plan for approval",
  status: "awaiting_approval",
  approvalRequired: true,
  aiInstructions: "Present plan clearly and wait for approval. DO NOT proceed without approval."
}
```

#### 4. **Failure Recovery System**
```typescript
// Intelligent failure recovery with retry logic
{
  recoveryInstructions: "If semantic_search fails, try different keyword combinations",
  failureRecoveryHints: ["Use specific file patterns", "Try alternative search terms"],
  maxRetries: 3
}
```

### Enhanced Workflow Features

#### Intelligent Workflow Creation
```typescript
// Auto-detects complex workflows and creates enhanced guidance
const workflow = await todosTool.createEnhancedWorkflow([
    {
        content: "Phase 1: Initialize knowledge model",
        guidance: {
            parentObjective: "Full-Stack Workflow Discovery Protocol",
            aiInstructions: "Use semantic_search and grep_search extensively",
            expectedOutput: "Knowledge model with prerequisite context",
            nextStepGuidance: "Proceed to keyword extraction",
            validationCriteria: "Model contains baseline understanding"
        }
    }
    // ... more phases with rich AI guidance
]);
```

#### AI Agent Orchestration Methods
```typescript
// Get intelligent next steps
@todos getNextSteps todo_id
// Returns: parentObjective, nextStepGuidance, recommendedAction, nextTask

// Request AI guidance for complex tasks
@todos requestGuidance todo_id  
// Returns: aiInstructions, recoveryInstructions, troubleshootingTips

// Approval workflow management
@todos approve todo_id "Plan looks good, proceed with implementation"
// Automatically moves from 'awaiting_approval' to active status
```

## 🔗 Multi-Platform AI Integration

### VS Code Language Model Tools (GitHub Copilot)
```typescript
// Native integration with GitHub Copilot
// AI automatically uses TodosTool for complex tasks
// No additional setup required - works out of the box
```

### MCP (Model Context Protocol) - Claude & External AI
```typescript
// Connect any MCP-compatible AI model
// Quick Setup:
1. Enable: Command Palette → "AI-ToDos: Start MCP Server"
2. Configure your AI client to connect to the MCP server
3. Start using: AI automatically discovers and uses TodosTool
```

#### Claude Configuration Example
```json
{
  "mcpServers": {
    "ai-todos-tool": {
      "command": "node",
      "args": ["path/to/ai-todos-tool-mcp-server.js"],
      "autoTriggerPatterns": [
        "implement.*system", "build.*application", "create.*workflow",
        "phase.*1.*phase.*2", "discovery.*protocol", "approval.*gate"
      ]
    }
  }
}
```

### Chat Participants (@todos)
```typescript
// Interactive chat interface for direct todo management
@todos create "Fix memory leak in data processing" "Systematic debugging approach"
@todos list
@todos complete todo_123
@todos workflow "Build microservices architecture" --phases=5 --approval-gates
```

## 🤖 VS Code Language Model Tools Integration

### 🎯 Registered AI Tools

This extension registers **4 specialized Language Model Tools** that AI agents (GitHub Copilot, Claude, etc.) can directly invoke:

#### 1. `todosTool` - Primary Todo Management
- **Description**: AI WORKFLOW ORCHESTRATION  
- **Purpose**: Main interface for todo and workflow operations
- **Capabilities**: Complete todo lifecycle management with intelligent workflows
- **Actions**: create, update, complete, delete, list, createWorkflow, analyze, approve
- **Use Case**: Primary tool for AI agents managing complex development tasks

#### 2. `aiSemanticAnalyzer` - Intelligent Analysis
- **Description**: INTELLIGENT SEMANTIC ANALYSIS
- **Purpose**: AI-powered task and prompt analysis with complexity assessment
- **Capabilities**: Task classification, complexity analysis, workflow recommendations
- **Analysis Types**: complexity, semantic, workflow_needs, todo_relevance, priority
- **Use Case**: Helping AI agents understand task complexity and choose optimal strategies

#### 3. `aiTodoManager` - Advanced Todo Operations
- **Description**: ADVANCED TODO MANAGEMENT
- **Purpose**: Comprehensive todo management with enhanced workflow capabilities
- **Capabilities**: Context preservation, semantic analysis integration, workflow orchestration
- **Features**: All todo operations plus advanced workflow management and analytics
- **Use Case**: When AI agents need sophisticated todo management beyond basic operations

#### 4. `aiWorkflowOrchestrator` - Workflow Generation
- **Description**: WORKFLOW GENERATION & MANAGEMENT
- **Purpose**: Creates intelligent workflows from natural language requirements
- **Capabilities**: AI-powered task breakdown, dependency analysis, execution guidance
- **Approaches**: single_task, sequential_workflow, multi_phase_discovery, approval_workflow
- **Use Case**: Transforming complex objectives into structured, manageable workflows

### 🔧 How AI Agents Use These Tools

#### Automatic Tool Selection
```typescript
// AI agents automatically choose the right tool for the task:

// Simple todo creation → todosTool
"Add a task to fix the login bug" → todosTool.invoke({action: "create", content: "Fix login bug"})

// Complex project → aiWorkflowOrchestrator  
"Build a user authentication system" → aiWorkflowOrchestrator.invoke({
  objective: "Build user authentication system",
  complexity: "complex",
  approach: "sequential_workflow"
})

// Task analysis → aiSemanticAnalyzer
"How complex is implementing OAuth2?" → aiSemanticAnalyzer.invoke({
  prompt: "Implement OAuth2 authentication",
  analysisType: "complexity" 
})

// Advanced operations → aiTodoManager
"Create a workflow with approval gates" → aiTodoManager.invoke({
  action: "createWorkflow", 
  workflowTasks: [...],
  autoProgression: false
})
```

#### Tool Integration Benefits
- **Seamless Discovery**: AI agents automatically discover and use tools
- **Intelligent Selection**: Right tool for the right task based on complexity
- **Rich Responses**: Detailed, structured responses optimized for AI consumption
- **Error Recovery**: Robust error handling with helpful guidance
- **Context Preservation**: All tools share the same todo state and context

### 📋 Tool Registration Details

#### Package.json Declaration
All tools are properly declared in the VS Code extension manifest:
```json
{
  "languageModelTools": [
    {
      "name": "todosTool",
      "displayName": "Todos Management Tool",
      "inputSchema": { /* Complete schema */ }
    },
    {
      "name": "aiSemanticAnalyzer", 
      "displayName": "AI Semantic Analyzer",
      "inputSchema": { /* Complete schema */ }
    },
    {
      "name": "aiTodoManager",
      "displayName": "AI Todo Manager",
      "inputSchema": { /* Complete schema */ }
    },
    {
      "name": "aiWorkflowOrchestrator",
      "displayName": "AI Workflow Orchestrator", 
      "inputSchema": { /* Complete schema */ }
    }
  ]
}
```

#### Runtime Registration
Tools are registered during extension activation:
```typescript
// Extension automatically registers all tools with VS Code
vscode.lm.registerTool("todosTool", todoToolHandler);
vscode.lm.registerTool("aiSemanticAnalyzer", analyzerHandler);
vscode.lm.registerTool("aiTodoManager", managerHandler);
vscode.lm.registerTool("aiWorkflowOrchestrator", orchestratorHandler);
```

#### Verification
Check successful registration in VS Code Output Panel:
```
✅ TodosTool Language Model Tool registered successfully!
✅ AI Semantic Analyzer Language Model Tool registered successfully!
✅ AI Todo Manager Language Model Tool registered successfully!
✅ AI Workflow Orchestrator Language Model Tool registered successfully!
🔧 Language Model Tools registration complete!
```

### Custom AI Tools Framework
```typescript
// Four specialized AI tools for advanced workflows:
// 1. todosTool - Primary todo and workflow management interface
// 2. aiSemanticAnalyzer - Intelligent task and complexity analysis  
// 3. aiTodoManager - Advanced todo operations with context preservation
// 4. aiWorkflowOrchestrator - AI-powered workflow generation and management
```

## 📋 Complete Command Reference

### Core Commands (Keyboard Shortcuts)
| Command | Shortcut | Description |
|---------|----------|-------------|
| Create Todo | `Ctrl+Shift+T` | Create new todo with AI guidance |
| Show Dashboard | `Ctrl+Shift+D` | Open interactive progress dashboard |
| Update Status | - | Change todo status with context preservation |
| Add SubTask | - | Break down complex tasks intelligently |
| Clear Session | - | Reset session and start fresh |

### AI Agent Commands
| Command | Usage | Purpose |
|---------|-------|---------|
| `@todos create` | `@todos create "task" "summary"` | Create enhanced todo |
| `@todos workflow` | `@todos workflow "project" --phases=3` | Create multi-phase workflow |
| `@todos approve` | `@todos approve todo_id "message"` | Approve pending tasks |
| `@todos getNextSteps` | `@todos getNextSteps todo_id` | Get AI guidance for next actions |
| `@todos analyze` | `@todos analyze todo_id` | AI-powered task complexity analysis |

### VS Code Language Model Tools (for AI Agents)
| Tool | Purpose | Example Usage |
|------|---------|---------------|
| `todosTool` | Primary todo management | `{action: "create", content: "...", priority: "high"}` |
| `aiSemanticAnalyzer` | Task complexity analysis | `{prompt: "...", analysisType: "complexity"}` |
| `aiTodoManager` | Advanced todo operations | `{action: "createWorkflow", workflowTasks: [...]}` |
| `aiWorkflowOrchestrator` | Workflow generation | `{objective: "...", complexity: "complex"}` |

### MCP Tools (for External AI)
| Tool | Purpose | Example Usage |
|------|---------|---------------|
| `create_todo` | Create new tasks | `{action: "create", content: "...", priority: "high"}` |
| `create_workflow` | Multi-step workflows | `{steps: [...], approvalGates: [2, 4]}` |
| `analyze_task` | Complexity analysis | `{todoId: "123", analysisType: "complexity"}` |
| `get_workflow_status` | Progress tracking | `{workflowId: "456"}` |

## 🎯 Usage Examples & Workflows

### Example 1: Complex Feature Implementation
```typescript
// User Input:
"Build a real-time chat application with React and Socket.io"

// AI Response:
🔧 COMPLEX DISCOVERY TASK DETECTED 🔧
✅ ENHANCED WORKFLOW CREATED: chat_app_workflow_1234
🎯 READY FOR AI AGENT EXECUTION

📝 Created Workflow: Real-time Chat Application (12 tasks)
  Phase 1: 🟡 Set up React project structure
  Phase 2: 🟡 Implement Socket.io integration  
  Phase 3: 🔒 Architecture review [APPROVAL REQUIRED]
  Phase 4: 🟡 Build chat interface components
  Phase 5: 🟡 Deploy and configure hosting

🔄 Auto-progression enabled - tasks automatically flow with context preservation
📊 Status: 12 total • 0% complete • 12 pending • 0 in progress • 0 done
```

### Example 2: AI Agent Workflow Orchestration
```typescript
// Your Original Complex Prompt:
"PHASE 1: Agent executes Discovery Protocol, builds YAML knowledge model
PHASE 2: Agent generates implementation plan based on YAML only  
PHASE 3: Agent presents plan for approval 🔒 [APPROVAL REQUIRED]
PHASE 4: Agent executes plan, halts/revises on failure
PHASE 5: Agent analyzes performance and logs improvements"

// Enhanced Implementation with AI Orchestration:
✅ Multi-phase workflow with intelligent guidance
🧠 Context preservation across all phases
🔒 Built-in approval gates at Phase 3
🚨 Failure recovery with retry logic
📊 Performance analysis and improvement logging
🎯 Parent objective awareness throughout
```

### Example 3: Chat Interface Usage
```typescript
@todos create "Review database schema" "Analyze current schema for optimization opportunities"
✅ Created: Review database schema
   📝 Analyze current schema for optimization opportunities
   🆔 ID: todo_def456

@todos workflow "API refactoring project" --phases=4 --approval-gate=3
✅ Created Enhanced Workflow: API Refactoring Project
   🔒 Approval gate configured for Phase 3
   📋 4 phases with intelligent progression
   🎯 Parent objective: API refactoring project

@todos list
📋 Todo List (3 items):
**PENDING** (2):
  • 🟡 Review database schema `todo_def456`
  • 🟡 Phase 1: Analyze current API structure `todo_abc123`

**AWAITING APPROVAL** (1):
  • 🔒 Phase 3: Present refactoring plan `todo_xyz789`

@todos approve todo_xyz789 "Plan approved, proceed with implementation"
✅ Approved: Phase 3: Present refactoring plan
   📊 Status: pending → in_progress
   🔄 Auto-progression: Phase 4 ready for execution
```

## 🛠️ Advanced Configuration

### VS Code Settings
```json
{
  "ai-todos-tool.contextManagement.enabled": true,
  "ai-todos-tool.contextManagement.maxItems": 1000,
  "ai-todos-tool.autoProgression.enabled": true,
  "ai-todos-tool.autoProgression.requireApproval": true,
  "ai-todos-tool.mcp.enabled": true,
  "ai-todos-tool.mcp.autoStart": true,
  "ai-todos-tool.workflows.maxPhases": 10,
  "ai-todos-tool.ai.complexityThreshold": 3
}
```

### MCP Server Configuration
```typescript
// Auto-start MCP server for external AI connections
{
  "ai-todos-tool.mcp.enabled": true,
  "ai-todos-tool.mcp.port": 3000,
  "ai-todos-tool.mcp.autoStart": true,
  "ai-todos-tool.mcp.stdio": true  // STDIO transport for broad compatibility
}
```

### AI Tools Configuration
```typescript
// Enable specialized AI tools for advanced workflows
{
  "ai-todos-tool.aiTools.enabled": true,
  "ai-todos-tool.aiTools.semanticAnalysis": true,
  "ai-todos-tool.aiTools.workflowOrchestration": true,
  "ai-todos-tool.aiTools.autoDetection": true
}
```

## 🔧 Status Icons & States

### Todo Status Indicators
- ⏳ **Pending** - Ready to start
- 🔄 **In Progress** - Currently active
- ✅ **Completed** - Successfully finished
- ❌ **Cancelled** - No longer needed
- 🔒 **Awaiting Approval** - Needs user approval to proceed
- 🚨 **Failed** - Requires attention or retry
- 📋 **Planned** - Future task in workflow

### Workflow Status
- 🟢 **Active** - Workflow progressing normally
- 🟡 **Paused** - Waiting for approval or input
- 🔴 **Failed** - Requires intervention
- ✅ **Complete** - All phases finished successfully

### AI Agent Status
- 🤖 **Ready** - AI tools available and operational
- 🔧 **Working** - AI actively executing tasks
- 💤 **Idle** - AI waiting for next task
- ⚠️ **Attention** - AI needs guidance or approval

## 🗂️ Data Storage & Session Management

### Storage Locations
- **Windows**: `%APPDATA%/Code/User/globalStorage/ai-todos-tool/`
- **macOS**: `~/Library/Application Support/Code/User/globalStorage/ai-todos-tool/`
- **Linux**: `~/.config/Code/User/globalStorage/ai-todos-tool/`

### Session Features
- **Unique Session IDs**: Each work period gets a unique identifier
- **Session Archives**: Previous sessions preserved for reference
- **Context Preservation**: Full workflow context maintained across sessions
- **Auto-cleanup**: Configurable cleanup of old sessions
- **Session Switching**: Resume previous work sessions seamlessly

## 🧪 Comprehensive Testing & Validation

### Test Coverage Overview

The AI-ToDos-Tool extension includes comprehensive test coverage across all major functionality:

#### ✅ Extension Lifecycle Tests

- **Extension Activation**: Validates proper extension startup without errors
- **Command Registration**: Ensures all commands are properly registered
- **Context Initialization**: Verifies proper context setup and configuration
- **Extension Deactivation**: Tests clean deactivation and resource cleanup

#### ✅ Core Functionality Tests

- **Todo Creation**: Create todos with valid content, handle empty content gracefully
- **Status Management**: Update todo status with validation and history tracking
- **SubTask Management**: Add subtasks, handle status updates, validate operations
- **Dashboard Functionality**: Show dashboard states, webview creation, data display
- **Session Management**: Clear sessions with confirmation, handle cancellation

#### ✅ Data Integrity Tests

- **Data Validation**: Validate todo ID patterns, subtask IDs, status values
- **Storage Operations**: File system operations, directory creation, persistence
- **JSON Serialization**: Test serialization/deserialization of complex objects
- **Error Handling**: File system errors, invalid JSON, unexpected conditions

#### ✅ AI Integration Tests

- **AI Tools Discovery**: Test AI tools registration and execution
- **MCP Server Testing**: Validate MCP server functionality and client connections
- **Workflow Orchestration**: Test complex workflow creation and management
- **Language Model Tools**: Verify VS Code Language Model Tools integration

### Running Tests

```bash
# Compile test files
npm run compile-tests

# Run all tests
npm test

# Run with watch mode
npm run watch-tests

# Run with coverage (if configured)
npm run test:coverage
```

### Test Strategy

The tests use a comprehensive mocking strategy:

- **VS Code API Mocking**: Mock VS Code window functions for UI testing
- **Context Mocking**: Simplified extension context for isolated testing
- **File System Mocking**: Safe storage operations for test environments
- **Input Mocking**: Simulate user interactions and inputs

### Mock Interfaces

```typescript
// Mock Todo Object Structure
interface MockTodo {
  id: string;
  content: string;
  summary?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  history: HistoryEntry[];
  subTasks: SubTask[];
}

// Mock SubTask Structure
interface MockSubTask {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: Date;
}
```

## ⚙️ Configuration & Setup

### VS Code Settings

```json
{
  "ai-todos-tool.contextManagement.enabled": true,
  "ai-todos-tool.contextManagement.maxItems": 1000,
  "ai-todos-tool.contextManagement.maxTokensBeforeCompression": 100000,
  "ai-todos-tool.contextManagement.compressionRatio": 0.7,
  "ai-todos-tool.contextManagement.enableIntelligentSummarization": true,
  "ai-todos-tool.autoProgression.enabled": true,
  "ai-todos-tool.autoProgression.requireApproval": true,
  "ai-todos-tool.mcp.enabled": true,
  "ai-todos-tool.mcp.autoStart": true,
  "ai-todos-tool.mcp.port": 3000,
  "ai-todos-tool.workflows.maxPhases": 10,
  "ai-todos-tool.ai.complexityThreshold": 3,
  "ai-todos-tool.aiModelPriorities": [
    "Claude Sonnet 4",
    "GPT-5",
    "Claude",
    "GPT",
    "Copilot"
  ]
}
```

### MCP Server Setup

#### Quick MCP Setup for Claude

1. **Start MCP Server**
   ```bash
   # In VS Code Command Palette
   AI-ToDos: Start MCP Server
   ```

2. **Configure Claude Desktop**
   ```json
   {
     "mcpServers": {
       "ai-todos-tool": {
         "command": "node",
         "args": ["path/to/ai-todos-tool-mcp-server.js"],
         "env": { "VSCODE_EXTENSION": "true" }
       }
     }
   }
   ```

3. **Test Connection**
   - Open Claude
   - Try: "List my current todos"
   - Verify tool discovery and execution

#### MCP Server Configuration Options

```typescript
// Server Transport Options
{
  "transport": "stdio",  // Standard input/output (recommended)
  "port": 3000,         // TCP port (alternative)
  "autoStart": true,    // Start with extension activation
  "timeout": 30000      // Connection timeout (ms)
}
```

## 🚨 Troubleshooting

### Common Issues & Solutions

#### Extension Not Activating
- Check VS Code version (requires 1.103.0+)
- Verify extension is enabled in Extensions panel
- Check VS Code developer console for errors
- Try reloading window (`Ctrl+Shift+P` → "Developer: Reload Window")

#### AI Tools Not Available
- Ensure AI tools are enabled in settings
- Check output channel "AI Tools" for errors
- Verify package.json aiTools configuration
- Try restarting VS Code

#### MCP Server Connection Issues
- Verify MCP server is running: "AI-ToDos: Show MCP Server Status"
- Check port availability (default: 3000)
- Ensure firewall isn't blocking connections
- Verify MCP client configuration

#### Dashboard Not Opening
- Check if webview is enabled in VS Code settings
- Verify no conflicting extensions
- Try opening in new VS Code window
- Check browser console in developer tools

#### Performance Issues
- Reduce `maxItems` in context management settings
- Clear old sessions: "AI-ToDos: Clear Session"
- Disable auto-progression for very large workflows
- Check VS Code memory usage

### Debug Commands
```typescript
// Built-in diagnostic tools
"AI-ToDos: Debug Tool Registration"     // Check tool registration status
"AI-ToDos: Show AI Activity"           // View AI agent activity logs
"AI-ToDos: Show MCP Server Status"     // Check MCP server health
"AI-ToDos: Cleanup Memory"             // Clean up memory usage
"AI-ToDos: Show Configuration"         // Display current settings
```

## 🏗️ Development & Extension

### Building from Source
```bash
git clone <repository-url>
cd ai-todos-tool
npm install
npm run compile     # Compile TypeScript
npm run watch       # Watch mode for development
npm run test        # Run extension tests
npm run package     # Create .vsix package
```

### Development Setup
```bash
# Launch Extension Development Host
1. Open project in VS Code
2. Press F5
3. New VS Code window opens with extension loaded
4. Test functionality in development environment
```

### Creating Custom AI Tools
```typescript
// Example: Custom AI tool implementation
import { IAITool, IAIToolResult, IAIToolSchema } from './IAITool';

export class CustomAITool implements IAITool {
  readonly name = 'custom_tool';
  readonly displayName = 'Custom AI Tool';
  readonly description = 'Custom functionality for specific workflows';
  
  readonly schema: IAIToolSchema = {
    name: this.name,
    displayName: this.displayName,
    description: this.description,
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Action to perform' },
        data: { type: 'object', description: 'Tool-specific data' }
      },
      required: ['action']
    }
  };

  async execute(parameters: any): Promise<IAIToolResult> {
    // Custom tool logic
    return { success: true, data: result };
  }

  validate(parameters: any): boolean {
    return !!(parameters.action);
  }
}
```

## 📈 Performance & Analytics

### Workflow Analytics
- **Completion Rates**: Track workflow success rates
- **Phase Duration**: Time spent in each workflow phase
- **Approval Delays**: Time between approval requests and responses
- **Failure Patterns**: Common failure points and recovery success

### AI Agent Performance
- **Tool Usage**: Frequency of AI tool invocations
- **Success Rates**: AI task completion percentages
- **Context Preservation**: Effectiveness of parent objective tracking
- **Recovery Success**: Failure recovery and retry statistics

### System Health Monitoring
- **Memory Usage**: Extension memory consumption tracking
- **Storage Growth**: Todo database size monitoring
- **Response Times**: Tool execution performance metrics
- **Error Rates**: System error frequency and types

## 🔮 Future Roadmap

### Enhanced AI Integration
- **Multi-Agent Orchestration**: Coordinate multiple AI agents
- **Cross-Platform Sync**: Sync todos across different AI platforms
- **Learning Algorithms**: AI learns from workflow patterns
- **Predictive Planning**: AI suggests optimal workflow structures

### Advanced Workflow Features
- **Template Library**: Pre-built workflow templates
- **Dependency Management**: Complex task dependency handling
- **Resource Allocation**: Team member assignment and tracking
- **Time Estimation**: AI-powered task duration prediction

### Enterprise Features
- **Team Collaboration**: Multi-user workflow management
- **Integration APIs**: Connect with external project management tools
- **Compliance Tracking**: Audit trails and compliance reporting
- **Advanced Security**: Enhanced security for sensitive workflows

## 📄 Requirements

- **VS Code**: Version 1.103.0 or later
- **Node.js**: For development and MCP server functionality
- **AI Platform**: Any MCP-compatible AI (Claude, GPT-4, etc.) or VS Code Language Models

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please see the contributing guidelines for details on:
- Reporting bugs and feature requests
- Submitting pull requests
- Development setup and testing
- Code style and conventions

## 🏗️ Architecture Overview

### System Architecture

```
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────┐
│   GitHub        │    │   AI-ToDos-Tool      │    │   Claude        │
│   Copilot       │◄──►│   Extension          │◄──►│   (MCP)         │
│   (VS Code LM)  │    │                      │    └─────────────────┘
└─────────────────┘    │  ┌─────────────────┐ │
                       │  │ Shared Todo     │ │    ┌─────────────────┐
┌─────────────────┐    │  │ State &         │ │◄──►│   Custom AI     │
│   Chat          │◄──►│  │ Context         │ │    │   (MCP)         │
│   Participants  │    │  │ Management      │ │    └─────────────────┘
│   (@todos)      │    │  └─────────────────┘ │
└─────────────────┘    │                      │    ┌─────────────────┐
                       │  ┌─────────────────┐ │◄──►│   AI Tools      │
┌─────────────────┐    │  │ AI Tools        │ │    │   Framework     │
│   Dashboard     │◄──►│  │ Registry        │ │    └─────────────────┘
│   (WebView)     │    │  └─────────────────┘ │
└─────────────────┘    └──────────────────────┘
```

### Data Flow

1. **User Input** → Extension receives todo requests
2. **AI Detection** → Semantic analysis determines workflow complexity
3. **Workflow Creation** → Enhanced workflows with context preservation
4. **AI Orchestration** → AI agents execute tasks with guidance
5. **Progress Tracking** → Real-time status updates and approvals
6. **Context Management** → Intelligent context compression and preservation

## 📊 Performance & Analytics

### Workflow Analytics

- **Completion Rates**: Track workflow success rates across different complexity levels
- **Phase Duration**: Measure time spent in each workflow phase for optimization
- **Approval Delays**: Monitor time between approval requests and responses
- **Failure Patterns**: Identify common failure points and recovery success rates

### AI Agent Performance

- **Tool Usage Statistics**: Frequency and success rates of AI tool invocations
- **Context Preservation Effectiveness**: Measure how well parent objectives are maintained
- **Recovery Success Rates**: Track failure recovery and retry statistics
- **Semantic Analysis Accuracy**: Validate AI task classification performance

### System Health Monitoring

```typescript
// Built-in performance monitoring
{
  "memoryUsage": "Extension memory consumption tracking",
  "storageGrowth": "Todo database size monitoring", 
  "responseTime": "Tool execution performance metrics",
  "errorRates": "System error frequency and categorization"
}
```

## 🔮 Future Roadmap

### Enhanced AI Integration (Q2 2025)

- **Multi-Agent Orchestration**: Coordinate multiple AI agents on complex projects
- **Cross-Platform Sync**: Synchronize todos across different AI platforms and clients
- **Learning Algorithms**: AI learns from successful workflow patterns and user preferences
- **Predictive Planning**: AI suggests optimal workflow structures based on historical data

### Advanced Workflow Features (Q3 2025)

- **Template Library**: Pre-built workflow templates for common development patterns
- **Complex Dependency Management**: Handle intricate task dependencies and prerequisites
- **Resource Allocation**: Team member assignment and workload distribution
- **Time Estimation AI**: Machine learning-powered task duration prediction

### Enterprise Features (Q4 2025)

- **Team Collaboration**: Multi-user workflow management with role-based permissions
- **Integration APIs**: Connect with external project management tools (Jira, Asana, etc.)
- **Compliance Tracking**: Comprehensive audit trails and compliance reporting
- **Advanced Security**: Enhanced security features for sensitive enterprise workflows

### Innovation Pipeline

- **Natural Language Processing**: Advanced NLP for better task interpretation
- **Code Integration**: Direct integration with code changes and pull requests
- **Automated Testing**: AI-generated tests for workflow validation
- **Performance Optimization**: Continuous performance improvements and optimizations

## � Requirements & Compatibility

### System Requirements

- **VS Code**: Version 1.103.0 or later (for Language Model Tools support)
- **Node.js**: Version 16.0 or later (for MCP server functionality)
- **Operating System**: Windows 10+, macOS 10.15+, Linux (Ubuntu 18.04+)
- **Memory**: Minimum 4GB RAM, 8GB recommended for complex workflows
- **Storage**: 100MB for extension, additional space for todo databases

### AI Platform Compatibility

- **VS Code Language Models**: GitHub Copilot, VS Code native AI models
- **MCP Compatible**: Claude 3.5 Sonnet, GPT-4, GPT-4 Turbo, custom MCP implementations
- **Chat Interfaces**: VS Code Chat API, custom chat implementations
- **API Integrations**: REST APIs, WebSocket connections, custom protocols

## �📞 Support & Community

### Getting Help

- **GitHub Issues**: [Report bugs and request features](https://github.com/duc01226/ToDosTool-VSCode-Extension/issues)
- **Documentation**: Comprehensive guides available in this README and `/docs` folder
- **Community Discussions**: [Join discussions on GitHub](https://github.com/duc01226/ToDosTool-VSCode-Extension/discussions)
- **Stack Overflow**: Tag questions with `ai-todos-tool` for community support

### Contributing

We welcome contributions from the community! Areas where you can help:

- **Bug Reports**: Help us identify and fix issues
- **Feature Requests**: Suggest new functionality and improvements
- **Code Contributions**: Submit pull requests for bug fixes and features
- **Documentation**: Improve documentation and add examples
- **Testing**: Help test new features and report compatibility issues
- **AI Model Integration**: Add support for new AI models and platforms

### Development Guidelines

```bash
# Setup development environment
git clone https://github.com/duc01226/ToDosTool-VSCode-Extension.git
cd ToDosTool-VSCode-Extension
npm install

# Run tests
npm test

# Start development
npm run watch
# Press F5 in VS Code to launch Extension Development Host

# Package for distribution
npm run package
```

## 📜 License & Attribution

### License

This project is licensed under the **MIT License** - see the [LICENSE](./LICENSE) file for complete details.

### Attribution

- **VS Code API**: Microsoft Corporation
- **MCP Protocol**: Anthropic (Model Context Protocol specification)
- **TypeScript**: Microsoft Corporation
- **Node.js**: OpenJS Foundation

### Third-Party Dependencies

- `@modelcontextprotocol/sdk`: MCP protocol implementation
- `@types/vscode`: VS Code API type definitions
- `typescript`: TypeScript compiler and language support
- `esbuild`: Fast JavaScript bundler for extension packaging

---

## 🎉 Get Started Today!

Ready to transform your development workflow with intelligent AI orchestration?

### Quick Installation

1. **Install Extension**
   ```bash
   # Via VS Code Marketplace
   code --install-extension duc01226.ai-todos-tool
   
   # Or build from source
   git clone <repository> && cd ai-todos-tool && npm install && npm run package
   ```

2. **Choose Your AI Integration**
   - **GitHub Copilot**: Works automatically - just start using complex prompts
   - **Claude**: Start MCP server and configure Claude Desktop
   - **Custom AI**: Connect via MCP protocol or VS Code Language Models

3. **Create Your First Workflow**
   ```typescript
   // Try in GitHub Copilot Chat:
   @copilot I need to build a REST API with authentication, CRUD operations, 
   and comprehensive testing. Help me organize this into a structured workflow.
   
   // Or via Command Palette:
   // Ctrl+Shift+T → "Create complex user authentication system"
   ```

4. **Monitor Progress**
   - Click the status bar to see todo counts
   - Press `Ctrl+Shift+D` for the interactive dashboard
   - Watch AI agents automatically manage your workflow

### What Makes This Special?

✨ **Solves Real Problems**: Eliminates AI context loss and provides clear next-step guidance

🧠 **Universal Compatibility**: Works with any AI model supporting VS Code Language Models or MCP

🚀 **Production Ready**: Comprehensive testing, error handling, and performance optimization

🎯 **Developer Focused**: Built by developers, for developers, with real workflow understanding

---

**Perfect for AI agents, development teams, and anyone managing complex multi-phase projects! 🚀**

*The AI-ToDos-Tool: Where human creativity meets AI intelligence for unprecedented workflow orchestration.*
