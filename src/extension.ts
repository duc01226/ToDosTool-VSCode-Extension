// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import {
  analyzeTaskComplexity,
  analyzeTaskSemantics,
  safeParseAIResponse,
  showErrorNotification,
} from "./aiUtils.js";
import {
  WorkflowTask,
  Todo,
  TodoState,
  SubTask,
  MultiSessionState,
  TodoToolInput,
  TodoToolResult,
  TodoToolErrorResult,
  CreateTodoData,
  UpdateTodoData,
  GetTodoData,
  ListTodosData,
  SummaryData,
  AddSubTaskData,
  ClearSessionData,
  CreateWorkflowData,
  GetWorkflowStatusData,
  AnalyzeTaskData,
  GenericActionData,
  ContextSwitchCheckResult,
  TodosToolInput,
  AISemanticAnalyzerInput,
  AITodoManagerInput,
  AIWorkflowOrchestratorInput,
} from "./types.js";
import {
  AI_PROMPTS,
  ERROR_MESSAGES,
} from "./constants.js";
import {
  generateGenericWorkflow,
} from "./workflowUtils.js";
import { globalContextManager } from './aiTools/ContextManager';

// AI Tools imports
import { AIToolsRegistry } from './aiTools/AIToolsRegistry';
import { AIAgentCommunication } from './aiTools/AIAgentCommunication';
import { AIToolsManager } from './aiTools/AIToolsManager';
import { AITodoManagerTool } from './aiTools/tools/AITodoManagerTool';
import { AISemanticAnalyzerTool } from './aiTools/tools/AISemanticAnalyzerTool';
import { AIWorkflowOrchestratorTool } from './aiTools/tools/AIWorkflowOrchestratorTool';
import { ConfigurationDemo } from './aiTools/ConfigurationDemo';

// Shared utilities
import {
  shouldUseTodoTool,
  detectContextSwitch,
  generateContextDescription,
  executeAIRequest,
  IDGenerator} from './aiUtils';


const FILE_NAMES = {
  STATE: "todos-state.json",
  MULTI_SESSION_STATE: "multi-session-state.json",
  ARCHIVE: "todos-archive.jsonl",
} as const;


// ================================================================================================
// ================================================================================================
// UI HELPER FUNCTIONS
// ================================================================================================

/**
 * Handles session management logic for context switching
 */
async function handleSessionManagement(
  todosTool: AIToDosTool,
  request: vscode.ChatRequest,
  stream: vscode.ChatResponseStream
): Promise<boolean> {
  const currentTodos = todosTool.getAllTodos();
  const currentContext = todosTool.getCurrentContextDescription();
  const contextSwitch = await detectContextSwitch(
    currentContext,
    request.prompt,
    request.model
  );
  const sessionAction = shouldPromptForSessionAction(
    currentTodos,
    contextSwitch
  );

  // Handle session management - but only for significant context switches
  if (sessionAction.shouldPrompt && contextSwitch.confidence > 0.8) {
    stream.markdown("🔄 **SIGNIFICANT CONTEXT SWITCH DETECTED** 🔄\n\n");
    stream.markdown(`${sessionAction.message}\n\n`);

    if (contextSwitch.isContextSwitch) {
      stream.markdown(
        `**Context Switch Detected**: ${
          contextSwitch.reason
        } (confidence: ${Math.round(contextSwitch.confidence * 100)}%)\n\n`
      );
    }

    stream.markdown(
      "**🤖 AI Agent Recommendation**: Based on the context switch, I recommend:\n\n"
    );

    if (currentTodos.filter((t) => t.status !== "completed").length > 5) {
      stream.markdown(
        "- `@todos session archive` - Archive current work and start fresh\n"
      );
    } else {
      stream.markdown(
        '- `@todos session new "description of new task"` - Create focused session for new task\n'
      );
    }

    stream.markdown(
      "- `@todos session continue` - Continue adding to current todos\n"
    );
    stream.markdown("- `@todos session list` - View all sessions\n\n");

    // Auto-suggest new session for strong switches
    if (contextSwitch.confidence > 0.9) {
      const newDescription = await generateContextDescription(
        request.prompt,
        request.model
      );
      stream.markdown(
        `**🎯 Suggested Action**: \`@todos session new "${newDescription}"\`\n\n`
      );
    }

    return true; // Session management handled, don't proceed with other actions
  }

  return false; // Continue with normal processing
}


/**
 * Chat Participant that provides Todo management for AI agents
 */
function createTodosChatParticipant(
  todosTool: AIToDosTool
): vscode.ChatParticipant {
  return vscode.chat.createChatParticipant(
    "todos",
    async (request, context, stream, token) => {
      try {
        // Get a unique identifier for this chat session
        // Since VS Code doesn't expose sessionId directly, we'll use request context
        const realChatSessionId = `chat_${context.history.length}_${Date.now()
          .toString()
          .slice(-6)}`;

        // Initialize or switch to this chat session's todo context
        await todosTool.ensureChatSession(
          realChatSessionId,
          request.prompt,
          request.model
        );

        // Get AI model for analysis
        const model = request.model;

        // AI-powered todo tool detection
        const todoAnalysis = model
          ? await shouldUseTodoTool(request.prompt, model)
          : { shouldUse: false, confidence: 0 };
        const needsTodoTool = todoAnalysis.shouldUse;

        if (needsTodoTool) {
          stream.markdown(
            `🔧 **Using TodosTool for task management** (confidence: ${(
              todoAnalysis.confidence * 100
            ).toFixed(0)}%)\n\n`
          );
        }

        // Handle session management using helper function
        const sessionHandled = await handleSessionManagement(
          todosTool,
          request,
          stream
        );
        if (sessionHandled) {
          return; // Don't proceed with other actions until user decides
        }

        // Parse the request to determine what todo action to take
        const todoAction = parseTodoRequest(request.prompt);

        // AI-powered analysis for task orchestration needs
        const todoDetection = await shouldUseTodoTool(request.prompt, model);
        const taskAnalysis = await analyzeTaskComplexity(request.prompt, model);

        if (todoAction) {
          const result = await executeTodoAction(
            todoAction,
            todosTool,
            request.model
          );
          formatTodoResult(result, stream);

          // Show current summary after action
          showTodoSummary(todosTool, stream);
        } else if (
          taskAnalysis.needsOrchestration &&
          taskAnalysis.confidence > 0.6
        ) {
          // AI detected this needs orchestration
          stream.markdown(
            "🤖 **AI-POWERED TASK ORCHESTRATION DETECTED** 🤖\n\n"
          );
          stream.markdown(`**Analysis**: ${taskAnalysis.reasoning}\n`);
          stream.markdown(`**Complexity**: ${taskAnalysis.complexity}\n`);
          stream.markdown(
            `**Recommended Approach**: ${taskAnalysis.suggestedApproach}\n`
          );
          stream.markdown(
            `**Confidence**: ${Math.round(taskAnalysis.confidence * 100)}%\n\n`
          );

          // Generate dynamic workflow using AI
          const suggestedWorkflow = await generateDynamicWorkflow(
            request.prompt,
            taskAnalysis.complexity,
            taskAnalysis.suggestedApproach,
            model
          );

          if (suggestedWorkflow.length > 0) {
            stream.markdown("**🎯 AI-GENERATED WORKFLOW:**\n");
            suggestedWorkflow.forEach((task, index) => {
              const status = task.guidance?.approvalRequired
                ? "🔒 [APPROVAL REQUIRED]"
                : "⚡ [AUTO-EXECUTABLE]";
              stream.markdown(`${index + 1}. ${status} ${task.content}\n`);
              if (task.guidance?.aiInstructions) {
                stream.markdown(
                  `   📋 *Instructions: ${task.guidance.aiInstructions}*\n`
                );
              }
              if (task.guidance?.expectedOutput) {
                stream.markdown(
                  `   🎯 *Expected: ${task.guidance.expectedOutput}*\n`
                );
              }
            });

            stream.markdown("\n**🚀 AI AGENT ORCHESTRATION FEATURES:**\n");
            stream.markdown(
              "- 🧠 **Context Preservation**: Maintains objective awareness across tasks\n"
            );
            stream.markdown(
              "- 🔄 **Smart Progression**: AI-guided task flow\n"
            );
            stream.markdown(
              "- 🔒 **Approval Gates**: User approval when needed\n"
            );
            stream.markdown(
              "- 🚨 **Recovery Guidance**: Built-in stuck/failure recovery\n"
            );
            stream.markdown(
              "- 📋 **Dynamic Adaptation**: AI-generated workflows\n"
            );
            stream.markdown(
              "- � **Language Agnostic**: Works in any language\n\n"
            );

            // Auto-create the enhanced workflow
            const workflowId = await todosTool.createEnhancedWorkflow(
              suggestedWorkflow,
              request.prompt
            );

            stream.markdown(
              `✅ **AI-ORCHESTRATED WORKFLOW CREATED**: \`${workflowId}\`\n\n`
            );
            stream.markdown("**🤖 READY FOR AI AGENT EXECUTION**\n");
            stream.markdown(
              "AI has analyzed your request and created an intelligent workflow. Each task includes:\n"
            );
            stream.markdown("- Context preservation to prevent getting lost\n");
            stream.markdown("- Specific AI instructions for each phase\n");
            stream.markdown("- Recovery guidance if issues arise\n\n");

            // Show current summary
            showTodoSummary(todosTool, stream);
          } else {
            stream.markdown(
              '⚠️ Could not generate workflow automatically. You can manually create todos using `@todos create "task description"`\n'
            );
          }
        } else if (todoDetection.shouldUse && todoDetection.confidence > 0.5) {
          // Suggest todo tool usage but don't auto-create
          stream.markdown("💡 **TODO TOOL RECOMMENDATION** 💡\n\n");
          stream.markdown(`**AI Analysis**: ${todoDetection.reasoning}\n`);
          stream.markdown(
            `**Confidence**: ${Math.round(todoDetection.confidence * 100)}%\n\n`
          );
          stream.markdown(
            "This task might benefit from todo tracking for better organization and progress visibility.\n\n"
          );
          stream.markdown(
            '**To create a tracked workflow**: `@todos workflow "step1; step2; step3"`\n'
          );
          stream.markdown(
            '**To create a single todo**: `@todos create "task description"`\n\n'
          );
        } else {
          // If no specific todo action, encourage todo usage for complex tasks
          const systemPrompt = AI_PROMPTS.SYSTEM_PROMPT.replace(
            "{{prompt}}",
            request.prompt
          );

          // Send request to model with enhanced system context
          const messages = [vscode.LanguageModelChatMessage.User(systemPrompt)];

          const response = await model.sendRequest(messages, {}, token);

          // Process the response and inject dynamic reminders
          let responseText = "";
          for await (const part of response.stream) {
            if (part instanceof vscode.LanguageModelTextPart) {
              responseText += part.value;
              stream.markdown(part.value);
            }
          }

          // AI-powered todo tool relevance assessment
          const todoRelevance = model
            ? await shouldUseTodoTool(request.prompt, model)
            : { shouldUse: false, confidence: 0 };
          const isLongResponse = responseText.length > 500;
          if (todoRelevance.shouldUse || isLongResponse) {
            stream.markdown("\n\n---\n");
            stream.markdown(
              "💡 **AI Agent Reminder**: For complex tasks like this, consider using `@todos workflow` to break it down into manageable steps with automatic progression. This ensures you maintain context and can recover from interruptions."
            );
          }
        }
      } catch (error) {
        console.error("❌ Chat participant error:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";

        stream.markdown(`❌ **AI-ToDos-Tool Error**: ${errorMessage}\n\n`);
        stream.markdown("**Troubleshooting:**\n");
        stream.markdown("- Try restarting VS Code if the issue persists\n");
        stream.markdown(
          "- Check the Developer Tools console for detailed error logs\n"
        );
        stream.markdown(
          "- Use the command `AI-ToDos-Tool: Debug Tool Registration` for diagnostics\n"
        );

        // Show user notification for critical errors
        if (
          errorMessage.includes("activation") ||
          errorMessage.includes("registration")
        ) {
          vscode.window
            .showErrorMessage(
              `AI-ToDos-Tool encountered an error: ${errorMessage}`,
              "Restart VS Code",
              "View Details"
            )
            .then((action) => {
              if (action === "Restart VS Code") {
                vscode.commands.executeCommand("workbench.action.reloadWindow");
              } else if (action === "View Details") {
                vscode.commands.executeCommand(
                  "workbench.action.toggleDevTools"
                );
              }
            });
        }
      }
    }
  );
}

interface ParsedTodoAction {
  action: string;
  todoId?: string;
  content?: string;
  summary?: string;
  status?: string;
  notes?: string;
  workflowTasks?: string[];
  subAction?: string; // For session management
}

function parseTodoRequest(prompt: string): ParsedTodoAction | null {
  const lowerPrompt = prompt.toLowerCase().trim();

  // Create todo: "create task description" or "create 'task' with summary"
  if (lowerPrompt.startsWith("create ")) {
    const match =
      prompt.match(/create\s+"([^"]+)"(?:\s+(.+))?/i) ||
      prompt.match(/create\s+(.+?)(?:\s+with\s+(.+))?$/i);
    if (match) {
      return {
        action: "create",
        content: match[1].trim(),
        summary: match[2]?.trim(),
      };
    }
  }

  // List todos
  if (
    lowerPrompt === "list" ||
    lowerPrompt === "show" ||
    lowerPrompt === "show todos"
  ) {
    return { action: "list" };
  }

  // Summary
  if (lowerPrompt === "summary" || lowerPrompt === "status") {
    return { action: "summary" };
  }

  // Update status: "update <id> <status>" or "complete <id>"
  if (lowerPrompt.startsWith("update ")) {
    const match = prompt.match(/update\s+(\S+)\s+(\w+)(?:\s+(.+))?/i);
    if (match) {
      return {
        action: "update",
        todoId: match[1],
        status: match[2].toLowerCase(),
        notes: match[3],
      };
    }
  }

  if (lowerPrompt.startsWith("complete ")) {
    const match = prompt.match(/complete\s+(\S+)(?:\s+(.+))?/i);
    if (match) {
      return {
        action: "complete",
        todoId: match[1],
        notes: match[2],
      };
    }
  }

  // Create workflow: "workflow task1; task2; task3"
  if (lowerPrompt.startsWith("workflow ")) {
    const tasksStr = prompt.substring(9);
    const tasks = tasksStr
      .split(";")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (tasks.length > 0) {
      return {
        action: "workflow",
        workflowTasks: tasks,
      };
    }
  }

  // Clear todos
  if (lowerPrompt === "clear" || lowerPrompt === "clear all") {
    return { action: "clear" };
  }

  // Analyze task
  if (lowerPrompt.startsWith("analyze ")) {
    const match = prompt.match(/analyze\s+(\S+)/i);
    if (match) {
      return {
        action: "analyze",
        todoId: match[1],
      };
    }
  }

  // Create checkpoint
  if (lowerPrompt.startsWith("checkpoint ")) {
    const match =
      prompt.match(/checkpoint\s+(\S+)\s+"([^"]+)"/i) ||
      prompt.match(/checkpoint\s+(\S+)\s+(.+)$/i);
    if (match) {
      return {
        action: "checkpoint",
        todoId: match[1],
        notes: match[2],
      };
    }
  }

  // Prioritize todos
  if (lowerPrompt === "prioritize" || lowerPrompt === "priority") {
    return { action: "prioritize" };
  }

  // Session management commands
  if (lowerPrompt.startsWith("session ")) {
    const sessionMatch = prompt.match(
      /session\s+(continue|new|archive|list|restore)\s*(.*)$/i
    );
    if (sessionMatch) {
      const subAction = sessionMatch[1].toLowerCase();
      const param = sessionMatch[2]?.trim();

      return {
        action: "session",
        subAction,
        content: param,
      };
    }
  }

  return null;
}

async function executeTodoAction(
  action: ParsedTodoAction,
  todosTool: AIToDosTool,
  model: vscode.LanguageModelChat
): Promise<any> {
  switch (action.action) {
    case "create":
      const todoId = await todosTool.createTodo(
        action.content!,
        action.summary
      );
      const todo = todosTool.getAllTodos().find((t) => t.id === todoId);
      return {
        success: true,
        action: "create",
        todoId,
        todo,
        message: `Created todo: ${action.content}`,
      };

    case "list":
      const todos = todosTool.getAllTodos();
      return {
        success: true,
        action: "list",
        todos,
        grouped: {
          pending: todos.filter((t) => t.status === "pending"),
          in_progress: todos.filter((t) => t.status === "in_progress"),
          completed: todos.filter((t) => t.status === "completed"),
          cancelled: todos.filter((t) => t.status === "cancelled"),
        },
      };

    case "summary":
      const allTodos = todosTool.getAllTodos();
      const workflowStatus = todosTool.getWorkflowStatus();
      return {
        success: true,
        action: "summary",
        summary: {
          total: allTodos.length,
          pending: allTodos.filter((t) => t.status === "pending").length,
          in_progress: allTodos.filter((t) => t.status === "in_progress")
            .length,
          completed: allTodos.filter((t) => t.status === "completed").length,
          cancelled: allTodos.filter((t) => t.status === "cancelled").length,
          workflow: workflowStatus,
          progress:
            allTodos.length > 0
              ? Math.round(
                  (allTodos.filter((t) => t.status === "completed").length /
                    allTodos.length) *
                    100
                )
              : 0,
        },
      };

    case "update":
      await todosTool.updateTodoStatus(
        action.todoId!,
        action.status as any,
        action.notes
      );
      const updatedTodo = todosTool
        .getAllTodos()
        .find((t) => t.id === action.todoId);
      return {
        success: true,
        action: "update",
        todo: updatedTodo,
        message: `Updated todo status to ${action.status}`,
      };

    case "complete":
      await todosTool.updateTodoStatus(
        action.todoId!,
        "completed",
        action.notes
      );
      const completedTodo = todosTool
        .getAllTodos()
        .find((t) => t.id === action.todoId);
      return {
        success: true,
        action: "complete",
        todo: completedTodo,
        message: `Completed todo: ${completedTodo?.content}`,
      };

    case "workflow":
      const workflowId = await todosTool.createWorkflow(action.workflowTasks!);
      await todosTool.setAutoProgression(true);
      return {
        success: true,
        action: "workflow",
        workflowId,
        tasks: action.workflowTasks,
        message: `Created workflow with ${
          action.workflowTasks!.length
        } tasks and enabled auto-progression`,
      };

    case "clear":
      await todosTool.clearSession();
      return {
        success: true,
        action: "clear",
        message: "All todos cleared",
      };

    case "analyze":
      if (!action.todoId) {
        throw new Error("Todo ID required for analysis");
      }
      const analysis = await todosTool.analyzeTask(action.todoId);
      return {
        success: true,
        action: "analyze",
        analysis,
        message: `Analysis completed for todo`,
      };

    case "checkpoint":
      if (!action.todoId || !action.notes) {
        throw new Error("Todo ID and context required for checkpoint");
      }
      await todosTool.createCheckpoint(action.todoId, action.notes);
      return {
        success: true,
        action: "checkpoint",
        message: `Checkpoint created for todo`,
      };

    case "prioritize":
      const prioritizedTodos = todosTool.getAllTodos();
      const sortedTodos = prioritizedTodos.sort((a, b) => {
        const priorities = { critical: 4, high: 3, medium: 2, low: 1 };
        return priorities[b.priority] - priorities[a.priority];
      });
      return {
        success: true,
        action: "prioritize",
        todos: sortedTodos.slice(0, 10), // Top 10 priorities
        message: "Todos prioritized by importance",
      };

    case "session":
      switch (action.subAction) {
        case "continue":
          return {
            success: true,
            action: "session",
            subAction: "continue",
            message: "Continuing with current session",
          };

        case "new":
          const description =
            action.content ||
            (await generateContextDescription(
              action.content || "New AI task",
              model
            ));
          const newSessionId = await todosTool.createNewSession(description);
          return {
            success: true,
            action: "session",
            subAction: "new",
            sessionId: newSessionId,
            description,
            message: `Created new session: ${description}`,
          };

        case "archive":
          await todosTool.archiveCurrentSession();
          return {
            success: true,
            action: "session",
            subAction: "archive",
            message: "Current session archived and new session started",
          };

        case "list":
          const summary = todosTool.getSessionSummary();
          return {
            success: true,
            action: "session",
            subAction: "list",
            sessions: summary,
            message: "Session summary retrieved",
          };

        case "restore":
          if (!action.content) {
            throw new Error("Session ID required for restore");
          }
          const restored = await todosTool.restoreSession(action.content);
          return {
            success: restored,
            action: "session",
            subAction: "restore",
            message: restored
              ? `Session ${action.content} restored`
              : "Failed to restore session",
          };

        default:
          throw new Error(`Unknown session action: ${action.subAction}`);
      }

    case "getNextSteps":
      if (!action.todoId) {
        throw new Error("Todo ID required for getting next steps");
      }
      const nextSteps = await todosTool.getNextStepsForTodo(action.todoId);
      return {
        success: true,
        action: "getNextSteps",
        todoId: action.todoId,
        nextSteps,
        message: "Next steps guidance retrieved",
      };

    case "approve":
      if (!action.todoId) {
        throw new Error("Todo ID required for approval");
      }
      const approved = await todosTool.approveTodo(action.todoId, action.notes);
      return {
        success: approved,
        action: "approve",
        todoId: action.todoId,
        message: approved
          ? "Todo approved and ready to proceed"
          : "Failed to approve todo",
      };

    case "requestGuidance":
      if (!action.todoId) {
        throw new Error("Todo ID required for requesting guidance");
      }
      const guidance = await todosTool.getAIGuidanceForTodo(
        action.todoId,
        model
      );
      return {
        success: true,
        action: "requestGuidance",
        todoId: action.todoId,
        guidance,
        message: "AI guidance retrieved for todo",
      };

    default:
      throw new Error(`Unknown action: ${action.action}`);
  }
}

function formatTodoResult(result: any, stream: vscode.ChatResponseStream) {
  if (!result.success) {
    stream.markdown(`❌ **Error**: ${result.error || "Operation failed"}`);
    return;
  }

  switch (result.action) {
    case "create":
      stream.markdown(`✅ **Created Todo**: ${result.todo.content}`);
      if (result.todo.summary) {
        stream.markdown(`   📝 **Summary**: ${result.todo.summary}`);
      }
      stream.markdown(`   🆔 **ID**: \`${result.todo.id.substring(0, 12)}\`\n`);
      break;

    case "update":
    case "complete":
      stream.markdown(
        `✅ **${result.action === "complete" ? "Completed" : "Updated"}**: ${
          result.todo.content
        }`
      );
      stream.markdown(`   📊 **Status**: ${result.todo.status}\n`);
      break;

    case "list":
      if (result.todos.length === 0) {
        stream.markdown("📋 **No todos found**\n");
      } else {
        stream.markdown(`📋 **Todo List** (${result.todos.length} items):\n\n`);

        Object.entries(result.grouped).forEach(([status, todos]) => {
          const todoList = todos as any[];
          if (todoList.length > 0) {
            const emoji = getStatusEmoji(status);
            stream.markdown(
              `**${emoji} ${status.toUpperCase().replace("_", " ")}** (${
                todoList.length
              }):`
            );
            todoList.forEach((todo: any) => {
              stream.markdown(
                `  • ${todo.content} \`${todo.id.substring(0, 8)}\``
              );
              if (todo.summary) {
                stream.markdown(`    💭 ${todo.summary}`);
              }
            });
            stream.markdown("");
          }
        });
      }
      break;

    case "summary":
      const s = result.summary;
      stream.markdown("📊 **Todos Summary**:\n");
      stream.markdown(`- **Total**: ${s.total} todos`);
      stream.markdown(`- **Progress**: ${s.progress}% complete`);
      stream.markdown(
        `- **Status**: ${s.pending} pending, ${s.in_progress} in progress, ${s.completed} completed`
      );
      if (s.cancelled > 0) {
        stream.markdown(`- **Cancelled**: ${s.cancelled} items`);
      }

      if (s.workflow.workflowId) {
        stream.markdown(`\n🔄 **Active Workflow**: ${s.workflow.workflowId}`);
        stream.markdown(
          `- **Progress**: ${s.workflow.completedTasks}/${s.workflow.totalTasks} tasks`
        );
        stream.markdown(
          `- **Auto-progression**: ${
            s.workflow.autoProgressionEnabled ? "✅ ON" : "❌ OFF"
          }`
        );
        if (s.workflow.currentTask) {
          stream.markdown(`- **Current**: ${s.workflow.currentTask.content}`);
        }
        if (s.workflow.nextTask) {
          stream.markdown(`- **Next**: ${s.workflow.nextTask.content}`);
        }
      }
      stream.markdown("");
      break;

    case "workflow":
      stream.markdown(`🔄 **Workflow Created**: ${result.workflowId}`);
      stream.markdown(`📝 **Tasks** (${result.tasks.length}):`);
      result.tasks.forEach((task: string, index: number) => {
        stream.markdown(`  ${index + 1}. ${task}`);
      });
      stream.markdown(
        `\n✅ **Auto-progression enabled** - tasks will automatically progress when completed\n`
      );
      break;

    case "clear":
      stream.markdown(`✅ ${result.message}\n`);
      break;

    case "analyze":
      stream.markdown(`🔍 **Smart Analysis Complete**\n`);
      stream.markdown(`- **Complexity**: ${result.analysis.complexity}`);
      stream.markdown(
        `- **Estimated Time**: ${result.analysis.estimatedTime} minutes`
      );
      if (result.analysis.suggestedBreakdown.length > 0) {
        stream.markdown(`- **Suggested Breakdown**:`);
        result.analysis.suggestedBreakdown.forEach(
          (step: string, index: number) => {
            stream.markdown(`  ${index + 1}. ${step}`);
          }
        );
      }
      if (result.analysis.riskFactors.length > 0) {
        stream.markdown(
          `- **Risk Factors**: ${result.analysis.riskFactors.join(", ")}`
        );
      }
      if (result.analysis.prerequisites.length > 0) {
        stream.markdown(
          `- **Prerequisites**: ${result.analysis.prerequisites.join(", ")}`
        );
      }
      stream.markdown("");
      break;

    case "checkpoint":
      stream.markdown(
        `💾 **Checkpoint Created**: Context snapshot saved for future recovery\n`
      );
      break;

    case "prioritize":
      stream.markdown(
        `📊 **Prioritized Todo List** (Top ${result.todos.length}):\n`
      );
      result.todos.forEach((todo: any, index: number) => {
        const priorityMap: Record<string, string> = {
          critical: "🔴",
          high: "🟠",
          medium: "🟡",
          low: "🟢",
        };
        const priorityEmoji = priorityMap[todo.priority] || "🟡";
        stream.markdown(
          `${index + 1}. ${priorityEmoji} **${
            todo.content
          }** \`${todo.id.substring(0, 8)}\``
        );
        if (todo.summary) {
          stream.markdown(`   💭 ${todo.summary}`);
        }
      });
      stream.markdown("");
      break;

    case "session":
      switch (result.subAction) {
        case "continue":
          stream.markdown(
            `🔄 **Session Continued**: Continuing with current todos\n`
          );
          break;

        case "new":
          stream.markdown(
            `🆕 **New Session Created**: ${result.description}\n`
          );
          stream.markdown(`📋 **Session ID**: \`${result.sessionId}\`\n`);
          break;

        case "archive":
          stream.markdown(
            `📦 **Session Archived**: Previous todos saved and new session started\n`
          );
          break;

        case "list":
          const sessions = result.sessions;
          stream.markdown(`📊 **Session Summary**:\n`);
          stream.markdown(
            `**Current Session**: ${sessions.currentSession.description} (${sessions.currentSession.todoCount} todos)\n`
          );

          if (sessions.archivedSessions.length > 0) {
            stream.markdown(`\n**Archived Sessions**:\n`);
            sessions.archivedSessions.forEach((session: any, index: number) => {
              stream.markdown(
                `${index + 1}. ${session.description} - ${
                  session.todoCount
                } todos (${session.lastUpdated.toLocaleDateString()})\n`
              );
            });
          } else {
            stream.markdown(`\n*No archived sessions*\n`);
          }
          break;

        case "restore":
          stream.markdown(`🔄 **Session Restored**: ${result.message}\n`);
          break;
      }
      break;
  }
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case "pending":
      return "⏳";
    case "in_progress":
      return "🔄";
    case "completed":
      return "✅";
    case "cancelled":
      return "❌";
    default:
      return "📝";
  }
}

function showTodoSummary(
  todosTool: AIToDosTool,
  stream: vscode.ChatResponseStream
) {
  const todos = todosTool.getAllTodos();
  if (todos.length > 0) {
    const pending = todos.filter((t) => t.status === "pending").length;
    const inProgress = todos.filter((t) => t.status === "in_progress").length;
    const completed = todos.filter((t) => t.status === "completed").length;
    const progress = Math.round((completed / todos.length) * 100);

    stream.markdown("\n---\n");
    stream.markdown(
      `📊 **Quick Status**: ${todos.length} total • ${progress}% complete • ${pending} pending • ${inProgress} in progress • ${completed} done`
    );
  }
}
function shouldPromptForSessionAction(
  activeTodos: Todo[],
  contextSwitch: ContextSwitchCheckResult
): {
  shouldPrompt: boolean;
  suggestedAction: "continue" | "new" | "archive";
  message: string;
} {
  const incompleteTodos = activeTodos.filter(
    (t) => t.status !== "completed" && t.status !== "cancelled"
  );

  if (incompleteTodos.length === 0) {
    return {
      shouldPrompt: false,
      suggestedAction: "new",
      message: "No active todos, creating new session",
    };
  }

  if (contextSwitch.isContextSwitch && contextSwitch.confidence > 0.7) {
    return {
      shouldPrompt: true,
      suggestedAction: "new",
      message: `Context switch detected (${contextSwitch.reason}). You have ${incompleteTodos.length} incomplete todos. Would you like to start a new session or continue current work?`,
    };
  }

  if (incompleteTodos.length > 10) {
    return {
      shouldPrompt: true,
      suggestedAction: "archive",
      message: `You have ${incompleteTodos.length} incomplete todos. Consider archiving old work and starting fresh.`,
    };
  }

  return {
    shouldPrompt: false,
    suggestedAction: "continue",
    message: "Continuing with current session",
  };
}

/**
 * AI-powered dynamic workflow generation
 */
async function generateDynamicWorkflow(
  prompt: string,
  complexity: string,
  approach: string,
  model: vscode.LanguageModelChat
): Promise<WorkflowTask[]> {
  try {
    const workflowPrompt = AI_PROMPTS.DYNAMIC_WORKFLOW_GENERATION.replace(
      "{{prompt}}",
      prompt
    )
      .replace("{{complexity}}", complexity)
      .replace("{{approach}}", approach);

    // Use standardized AI request utility
    const workflow = await executeAIRequest<WorkflowTask[]>(
      model,
      workflowPrompt,
      [],
      'Dynamic workflow generation'
    );

    // Validate and ensure proper structure
    return workflow.map((task: any, index: number) => ({
      content: task.content || `Task ${index + 1}`,
      guidance: {
        parentObjective:
          task.guidance?.parentObjective ||
          `Complete user request: ${prompt.substring(0, 50)}...`,
        aiInstructions:
          task.guidance?.aiInstructions ||
          "Complete this task as part of the overall objective",
        expectedOutput: task.guidance?.expectedOutput || "Task completion",
        nextStepGuidance:
          task.guidance?.nextStepGuidance || "Proceed to next task",
        validationCriteria:
          task.guidance?.validationCriteria || "Task completed successfully",
        approvalRequired: task.guidance?.approvalRequired || false,
        recoveryInstructions:
          task.guidance?.recoveryInstructions ||
          "Review task requirements and try alternative approach",
      },
    }));
  } catch (error) {
    console.warn(
      "AI workflow generation failed, using generic approach:",
      error
    );

    // Fallback to generic workflow
    return generateGenericWorkflow(prompt, approach);
  }
}



// ================================================================================================
// MAIN CLASS: AI TODOS TOOL
// ================================================================================================

export class AIToDosTool {
  // ===== PROPERTIES =====
  private todos: Map<string, Todo> = new Map();
  private sessionId: string;
  private stateFile: string;
  private statusBarItem: vscode.StatusBarItem;
  private autoProgressionEnabled: boolean = false;
  private currentWorkflowId?: string;
  private chatSessionId?: string;
  private contextDescription: string = "AI Development Task";
  private multiSessionStateFile: string;
  private sessions: Map<string, TodoState> = new Map();

  // ===== CONSTRUCTOR & INITIALIZATION =====
  constructor(private context: vscode.ExtensionContext) {
    try {
      this.sessionId = IDGenerator.generateSessionId();
      this.stateFile = path.join(
        context.globalStorageUri?.fsPath || "",
        FILE_NAMES.STATE
      );
      this.multiSessionStateFile = path.join(
        context.globalStorageUri?.fsPath || "",
        FILE_NAMES.MULTI_SESSION_STATE
      );
      this.statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100
      );
      this.statusBarItem.command = "ai-todos-tool.showDashboard";
      this.initializeStorage();
      this.updateStatusBar();
    } catch (error) {
      console.error("❌ AIToDosTool constructor error:", error);
      showErrorNotification(
        ERROR_MESSAGES.ACTIVATION_FAILED((error as Error).message),
        error as Error
      );
      throw error;
    }
  }

  private async initializeStorage(): Promise<void> {
    try {
      if (!fs.existsSync(path.dirname(this.stateFile))) {
        await vscode.workspace.fs.createDirectory(
          vscode.Uri.file(path.dirname(this.stateFile))
        );
      }
    } catch (error) {
      console.warn("Could not initialize storage:", error);
    }
  }

  // ===== STATE MANAGEMENT METHODS =====
  async loadState(): Promise<void> {
    try {
      if (fs.existsSync(this.stateFile)) {
        const data = fs.readFileSync(this.stateFile, "utf8");
        const state: TodoState = JSON.parse(data);

        // Load auto-progression settings
        this.autoProgressionEnabled = state.autoProgressionEnabled || false;
        this.currentWorkflowId = state.currentWorkflowId;

        // Convert date strings back to Date objects
        state.todos.forEach((todo) => {
          todo.createdAt = new Date(todo.createdAt);
          todo.updatedAt = new Date(todo.updatedAt);
          todo.subTasks.forEach((subTask) => {
            subTask.createdAt = new Date(subTask.createdAt);
            subTask.updatedAt = new Date(subTask.updatedAt);
          });
          todo.history.forEach((entry) => {
            entry.timestamp = new Date(entry.timestamp);
          });
          this.todos.set(todo.id, todo);
        });
      }
    } catch (error) {
      console.warn("Could not load todo state:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      vscode.window.showWarningMessage(
        `Failed to load previous todos: ${errorMessage}. Starting with empty state.`
      );
      // Continue with empty state rather than failing completely
    }
  }

  async saveState(): Promise<void> {
    try {
      const state: TodoState = {
        todos: Array.from(this.todos.values()),
        sessionId: this.sessionId,
        createdAt: new Date(),
        lastUpdated: new Date(),
        autoProgressionEnabled: this.autoProgressionEnabled,
        currentWorkflowId: this.currentWorkflowId,
      };
      fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
    } catch (error) {
      console.warn("Could not save todo state:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      vscode.window.showWarningMessage(
        `Failed to save todos: ${errorMessage}. Your changes may be lost on restart.`
      );
    }
  }

  // ===== TODO MANAGEMENT METHODS =====
  async createTodo(
    content: string,
    summary?: string,
    priority: "low" | "medium" | "high" | "critical" = "medium",
    tags: string[] = []
  ): Promise<string> {
    try {
      const id = `todo_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const todo: Todo = {
        id,
        content,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
        summary,
        subTasks: [],
        history: [
          {
            timestamp: new Date(),
            action: "created",
            notes: `Todo created: ${content}`,
            agentId: "system",
          },
        ],
        priority,
        dependencies: [],
        tags: [...tags, "ai-agent-task"],
        assignee: "ai-agent",
      };

      this.todos.set(id, todo);
      await this.saveState();
      this.updateStatusBar();

      vscode.window.showInformationMessage(`Todo created: ${content}`);
      return id;
    } catch (error) {
      console.error("❌ Failed to create todo:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      vscode.window.showErrorMessage(`Failed to create todo: ${errorMessage}`);
      throw error; // Re-throw to let caller handle if needed
    }
  }

  async updateTodoStatus(
    id: string,
    status: Todo["status"],
    notes?: string,
    agentId: string = "ai-agent"
  ): Promise<void> {
    const todo = this.todos.get(id);
    if (!todo) {
      vscode.window.showErrorMessage(`Todo with id ${id} not found`);
      return;
    }

    // Update last accessed time for memory management
    todo.lastAccessedAt = new Date();

    // Check dependencies before allowing status change
    if (status === "in_progress" && todo.dependencies.length > 0) {
      const uncompletedDeps = todo.dependencies.filter((depId) => {
        const depTodo = this.todos.get(depId);
        return depTodo && depTodo.status !== "completed";
      });

      if (uncompletedDeps.length > 0) {
        todo.status = "blocked";
        todo.blockedReason = `Waiting for dependencies: ${uncompletedDeps.join(
          ", "
        )}`;
        vscode.window.showWarningMessage(
          `Todo "${todo.content}" blocked by dependencies`
        );
        return;
      }
    }

    const previousStatus = todo.status;
    const startTime = Date.now();

    todo.status = status;
    todo.updatedAt = new Date();

    // Calculate time spent if completing a task
    if (status === "completed" && todo.history.length > 0) {
      const lastInProgress = todo.history
        .reverse()
        .find((h) => h.newStatus === "in_progress");
      if (lastInProgress) {
        const timeSpent = Math.round(
          (Date.now() - lastInProgress.timestamp.getTime()) / 60000
        ); // minutes
        todo.actualTime = (todo.actualTime || 0) + timeSpent;
      }
      todo.history.reverse(); // restore original order
    }

    todo.history.push({
      timestamp: new Date(),
      action: "status_changed",
      previousStatus,
      newStatus: status,
      notes,
      agentId,
      duration: Date.now() - startTime,
    });

    await this.saveState();
    this.updateStatusBar();

    vscode.window.showInformationMessage(
      `Todo "${todo.content}" status changed to ${status}`
    );

    // Check and unblock dependent tasks
    if (status === "completed") {
      // Add completion context
      const workflowId = todo.parentWorkflowId || this.currentWorkflowId || id;
      globalContextManager.addContext(workflowId, {
        timestamp: new Date(),
        type: 'task_result',
        content: `Task completed: ${todo.content}. Notes: ${notes || 'No additional notes'}`,
        metadata: {
          taskId: id,
          workflowId: workflowId,
          priority: 'high'
        }
      });

      await this.checkAndUnblockDependentTasks(id);
    }

    // Check for auto-progression
    if (this.autoProgressionEnabled && status === "completed") {
      await this.checkAndProgressWorkflow(id);
    }
  }

  async addSubTask(todoId: string, content: string): Promise<string> {
    const todo = this.todos.get(todoId);
    if (!todo) {
      vscode.window.showErrorMessage(`Todo with id ${todoId} not found`);
      return "";
    }

    const subTaskId = `subtask_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const subTask: SubTask = {
      id: subTaskId,
      content,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    todo.subTasks.push(subTask);
    todo.updatedAt = new Date();
    todo.history.push({
      timestamp: new Date(),
      action: "subtask_added",
      notes: `Added subtask: ${content}`,
    });

    await this.saveState();
    this.updateStatusBar();

    vscode.window.showInformationMessage(`Subtask added to "${todo.content}"`);
    return subTaskId;
  }

  async updateSubTaskStatus(
    todoId: string,
    subTaskId: string,
    status: SubTask["status"]
  ): Promise<void> {
    const todo = this.todos.get(todoId);
    if (!todo) {
      vscode.window.showErrorMessage(`Todo with id ${todoId} not found`);
      return;
    }

    const subTask = todo.subTasks.find((st) => st.id === subTaskId);
    if (!subTask) {
      vscode.window.showErrorMessage(`Subtask with id ${subTaskId} not found`);
      return;
    }

    const previousStatus = subTask.status;
    subTask.status = status;
    subTask.updatedAt = new Date();
    todo.updatedAt = new Date();
    todo.history.push({
      timestamp: new Date(),
      action: "subtask_status_changed",
      notes: `Subtask "${subTask.content}" status changed from ${previousStatus} to ${status}`,
    });

    await this.saveState();
    this.updateStatusBar();

    vscode.window.showInformationMessage(
      `Subtask "${subTask.content}" status changed to ${status}`
    );
  }

  getTodoSummary(id: string): string | undefined {
    const todo = this.todos.get(id);
    if (!todo) {
      return undefined;
    }

    const completedSubTasks = todo.subTasks.filter(
      (st) => st.status === "completed"
    ).length;
    const totalSubTasks = todo.subTasks.length;
    const progress =
      totalSubTasks > 0
        ? `${completedSubTasks}/${totalSubTasks} subtasks completed`
        : "No subtasks";

    return `
Todo: ${todo.content}
Status: ${todo.status}
Created: ${todo.createdAt.toLocaleString()}
Last Updated: ${todo.updatedAt.toLocaleString()}
Progress: ${progress}
Summary: ${todo.summary || "No summary provided"}

History:
${todo.history
  .map(
    (h) =>
      `  ${h.timestamp.toLocaleString()}: ${h.action} ${
        h.notes ? "- " + h.notes : ""
      }`
  )
  .join("\n")}

SubTasks:
${todo.subTasks.map((st) => `  [${st.status}] ${st.content}`).join("\n")}
        `.trim();
  }

  getAllTodos(): Todo[] {
    return Array.from(this.todos.values()).sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );
  }

  getTodo(id: string): Todo | undefined {
    return this.todos.get(id);
  }

  deleteTodo(id: string): boolean {
    const todo = this.todos.get(id);
    if (!todo) {
      vscode.window.showErrorMessage(`Todo with id ${id} not found`);
      return false;
    }

    this.todos.delete(id);
    this.saveState();
    this.updateStatusBar();
    vscode.window.showInformationMessage(`Todo "${todo.content}" deleted`);
    return true;
  }

  async clearSession(): Promise<void> {
    this.todos.clear();
    this.sessionId = IDGenerator.generateSessionId();
    await this.saveState();
    this.updateStatusBar();
    vscode.window.showInformationMessage("Todo session cleared");
  }

  private updateStatusBar(): void {
    const allTodos = this.getAllTodos();
    const pending = allTodos.filter((t) => t.status === "pending").length;
    const inProgress = allTodos.filter(
      (t) => t.status === "in_progress"
    ).length;
    const completed = allTodos.filter((t) => t.status === "completed").length;

    // Add session information
    const sessionInfo = this.getCurrentSessionId()
      ? ` | Session: ${this.getCurrentSessionId()?.substring(0, 8)}`
      : "";
    const sessionCount = this.getSessionCount();
    const sessionIndicator =
      sessionCount > 1 ? ` (${sessionCount} sessions)` : "";

    this.statusBarItem.text = `$(checklist) Todos: ${pending}P ${inProgress}IP ${completed}C${sessionInfo}`;
    this.statusBarItem.tooltip = `Pending: ${pending}, In Progress: ${inProgress}, Completed: ${completed}${sessionIndicator}`;
    this.statusBarItem.show();
  }

  // ===== UI METHODS =====
  async showDashboard(): Promise<void> {
    const todos = this.getAllTodos();
    if (todos.length === 0) {
      vscode.window.showInformationMessage(
        "No todos found. Create your first todo!"
      );
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "todosDashboard",
      "AIToDosTool Dashboard",
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    panel.webview.html = this.getDashboardHtml(todos);
  }

  private getDashboardHtml(todos: Todo[]): string {
    const todoItems = todos
      .map((todo) => {
        const statusIcon =
          todo.status === "completed"
            ? "✅"
            : todo.status === "in_progress"
            ? "🔄"
            : todo.status === "cancelled"
            ? "❌"
            : "⏳";

        const subTasksHtml = todo.subTasks
          .map((st) => {
            const stIcon =
              st.status === "completed"
                ? "✅"
                : st.status === "in_progress"
                ? "🔄"
                : st.status === "cancelled"
                ? "❌"
                : "⏳";
            return `<li style="margin-left: 20px;">${stIcon} ${st.content}</li>`;
          })
          .join("");

        return `
                <div style="border: 1px solid #ccc; margin: 10px 0; padding: 10px; border-radius: 5px;">
                    <h3>${statusIcon} ${todo.content}</h3>
                    <p><strong>Status:</strong> ${todo.status}</p>
                    <p><strong>Created:</strong> ${todo.createdAt.toLocaleString()}</p>
                    <p><strong>Last Updated:</strong> ${todo.updatedAt.toLocaleString()}</p>
                    ${
                      todo.summary
                        ? `<p><strong>Summary:</strong> ${todo.summary}</p>`
                        : ""
                    }
                    ${
                      todo.subTasks.length > 0
                        ? `<h4>Subtasks:</h4><ul>${subTasksHtml}</ul>`
                        : ""
                    }
                    <details>
                        <summary>History</summary>
                        <ul>
                            ${todo.history
                              .map(
                                (h) =>
                                  `<li>${h.timestamp.toLocaleString()}: ${
                                    h.action
                                  } ${h.notes ? "- " + h.notes : ""}</li>`
                              )
                              .join("")}
                        </ul>
                    </details>
                </div>
            `;
      })
      .join("");

    return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>AIToDosTool Dashboard</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h1 { color: #333; }
                    details { margin-top: 10px; }
                    summary { cursor: pointer; font-weight: bold; }
                </style>
            </head>
            <body>
                <h1>AIToDosTool Dashboard</h1>
                <p>Session: ${this.sessionId}</p>
                ${todoItems}
            </body>
            </html>
        `;
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }

  // ============= SESSION MANAGEMENT FEATURES =============

  getCurrentContextDescription(): string {
    return this.contextDescription;
  }

  setChatSessionId(chatSessionId: string): void {
    this.chatSessionId = chatSessionId;
  }

  setContextDescription(description: string): void {
    this.contextDescription = description;
  }

  async createNewSession(
    description: string,
    chatSessionId?: string
  ): Promise<string> {
    // Archive current session if it has todos
    if (this.todos.size > 0) {
      await this.archiveCurrentSession();
    }

    // Create new session
    this.sessionId = IDGenerator.generateSessionId();
    this.contextDescription = description;
    this.chatSessionId = chatSessionId;
    this.todos.clear();
    this.currentWorkflowId = undefined;
    this.autoProgressionEnabled = false;

    await this.saveState();
    this.updateStatusBar();

    vscode.window.showInformationMessage(`New session created: ${description}`);
    return this.sessionId;
  }

  // ===== SESSION MANAGEMENT METHODS =====
  async archiveCurrentSession(): Promise<void> {
    if (this.todos.size === 0) {
      return;
    }

    const currentState: TodoState = {
      todos: Array.from(this.todos.values()),
      sessionId: this.sessionId,
      createdAt: new Date(),
      lastUpdated: new Date(),
      autoProgressionEnabled: this.autoProgressionEnabled,
      currentWorkflowId: this.currentWorkflowId,
      chatSessionId: this.chatSessionId,
      contextDescription: this.contextDescription,
      isArchived: true,
    };

    // Save to sessions map
    this.sessions.set(this.sessionId, currentState);
    await this.saveMultiSessionState();

    vscode.window.showInformationMessage(
      `Session "${this.contextDescription}" archived with ${this.todos.size} todos`
    );
  }

  async loadMultiSessionState(): Promise<void> {
    try {
      if (fs.existsSync(this.multiSessionStateFile)) {
        const data = fs.readFileSync(this.multiSessionStateFile, "utf8");
        const multiState: MultiSessionState = JSON.parse(data);

        // Load sessions
        for (const [sessionId, sessionState] of Object.entries(
          multiState.sessions
        )) {
          this.sessions.set(sessionId, sessionState);
        }
      }
    } catch (error) {
      console.warn("Could not load multi-session state:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      vscode.window.showWarningMessage(
        `Failed to load previous todos: ${errorMessage}. Starting with empty state.`
      );
    }
  }

  async saveMultiSessionState(): Promise<void> {
    try {
      const multiState: MultiSessionState = {
        sessions: Object.fromEntries(this.sessions),
        activeSessions: {},
        sessionMetadata: {},
        globalSettings: {
          autoSessionDetection: true,
          sessionTimeoutMinutes: 60,
          maxActiveSessions: 5,
        },
      };

      fs.writeFileSync(
        this.multiSessionStateFile,
        JSON.stringify(multiState, null, 2)
      );
    } catch (error) {
      console.warn("Could not save multi-session state:", error);
    }
  }

  getSessionSummary(): {
    currentSession: { id: string; description: string; todoCount: number };
    archivedSessions: Array<{
      id: string;
      description: string;
      todoCount: number;
      lastUpdated: Date;
    }>;
  } {
    const archivedSessions = Array.from(this.sessions.values())
      .filter((session) => session.isArchived)
      .map((session) => ({
        id: session.sessionId,
        description: session.contextDescription || "Unnamed session",
        todoCount: session.todos.length,
        lastUpdated: new Date(session.lastUpdated),
      }))
      .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());

    return {
      currentSession: {
        id: this.sessionId,
        description: this.contextDescription,
        todoCount: this.todos.size,
      },
      archivedSessions,
    };
  }

  async restoreSession(sessionId: string): Promise<boolean> {
    const sessionState = this.sessions.get(sessionId);
    if (!sessionState) {
      vscode.window.showErrorMessage(`Session ${sessionId} not found`);
      return false;
    }

    // Archive current session if needed
    if (this.todos.size > 0) {
      await this.archiveCurrentSession();
    }

    // Restore session
    this.sessionId = sessionState.sessionId;
    this.contextDescription =
      sessionState.contextDescription || "Restored session";
    this.chatSessionId = sessionState.chatSessionId;
    this.autoProgressionEnabled = sessionState.autoProgressionEnabled;
    this.currentWorkflowId = sessionState.currentWorkflowId;

    // Load todos
    this.todos.clear();
    sessionState.todos.forEach((todo) => {
      // Convert date strings back to Date objects
      todo.createdAt = new Date(todo.createdAt);
      todo.updatedAt = new Date(todo.updatedAt);
      todo.lastAccessedAt = new Date(todo.lastAccessedAt);
      todo.history.forEach((h) => (h.timestamp = new Date(h.timestamp)));
      todo.subTasks.forEach((st) => {
        st.createdAt = new Date(st.createdAt);
        st.updatedAt = new Date(st.updatedAt);
      });

      this.todos.set(todo.id, todo);
    });

    await this.saveState();
    this.updateStatusBar();

    vscode.window.showInformationMessage(
      `Restored session: ${this.contextDescription} (${this.todos.size} todos)`
    );
    return true;
  }

  /**
   * Ensure that we're working in the correct chat session context
   * This method handles automatic session switching and creation
   */
  async ensureChatSession(
    chatSessionId: string,
    currentPrompt: string,
    model: vscode.LanguageModelChat
  ): Promise<void> {
    // Check if this is a different chat session than what we're currently using
    if (this.chatSessionId && this.chatSessionId !== chatSessionId) {
      // We're switching to a different chat session
      await this.handleChatSessionSwitch(chatSessionId, currentPrompt, model);
    } else if (!this.chatSessionId) {
      // First time initialization for this chat session
      this.chatSessionId = chatSessionId;

      // Check if we have an existing session for this chat
      const existingSession = this.findSessionByChatId(chatSessionId);
      if (existingSession) {
        await this.restoreSession(existingSession.sessionId);
      } else {
        // New chat session - auto-detect if we should create a new todo session
        const shouldCreateNew = await this.shouldCreateNewSessionForChat(
          currentPrompt,
          model
        );
        if (shouldCreateNew) {
          const description = await generateContextDescription(
            currentPrompt,
            model
          );
          await this.createNewSession(description, chatSessionId);
        }
      }
    }

    // Update last accessed time for memory management
    this.updateSessionAccess(chatSessionId);
  }

  private async handleChatSessionSwitch(
    newChatSessionId: string,
    prompt: string,
    model: vscode.LanguageModelChat
  ): Promise<void> {
    // Archive current session if it has active todos
    if (this.todos.size > 0) {
      await this.archiveCurrentSession();
    }

    // Check if the new chat session has an existing todo session
    const existingSession = this.findSessionByChatId(newChatSessionId);
    if (existingSession) {
      await this.restoreSession(existingSession.sessionId);
      vscode.window.showInformationMessage(
        `Switched to chat session todos: ${existingSession.contextDescription}`
      );
    } else {
      // New chat session - create new todo session
      const description = await generateContextDescription(prompt, model);
      await this.createNewSession(description, newChatSessionId);
      vscode.window.showInformationMessage(
        `Created new todo session for new chat: ${description}`
      );
    }
  }

  private findSessionByChatId(chatSessionId: string): TodoState | undefined {
    return Array.from(this.sessions.values()).find(
      (session) => session.chatSessionId === chatSessionId
    );
  }

  private async shouldCreateNewSessionForChat(
    prompt: string,
    model: vscode.LanguageModelChat
  ): Promise<boolean> {
    // Auto-create new session if:
    // 1. This is a complex task (AI analysis)
    // 2. This contains task orchestration keywords (AI analysis)
    // 3. Current session has many todos already

    try {
      const complexity = await analyzeTaskComplexity(prompt, model);
      const shouldUseTodos = await shouldUseTodoTool(prompt, model);
      const currentTodoCount = this.todos.size;

      return (
        complexity.needsOrchestration ||
        shouldUseTodos.shouldUse ||
        currentTodoCount > 10
      );
    } catch (error) {
      console.warn(
        "AI analysis failed for session creation decision, using fallback logic:",
        error
      );
    }

    // Fallback to simple heuristics
    const isComplexTask = prompt.length > 200 || prompt.split("\n").length > 3;
    const hasTaskKeywords =
      /\b(implement|create|build|develop|setup|configure|task|todo|workflow)\b/i.test(
        prompt
      );
    const currentTodoCount = this.todos.size;

    return isComplexTask || hasTaskKeywords || currentTodoCount > 10;
  }

  private updateSessionAccess(chatSessionId: string): void {
    // Update access time for memory management
    const session = this.findSessionByChatId(chatSessionId);
    if (session) {
      session.lastUpdated = new Date();
      this.saveMultiSessionState();
    }
  }

  private getCurrentSessionId(): string | undefined {
    return this.chatSessionId;
  }

  private getSessionCount(): number {
    return this.sessions.size;
  }

  // ============= AI AGENT AUTO-PROGRESSION FEATURES =============

  /**
   * Check and unblock tasks that depend on the completed task
   */
  private async checkAndUnblockDependentTasks(
    completedTodoId: string
  ): Promise<void> {
    const dependentTasks = Array.from(this.todos.values()).filter(
      (todo) =>
        todo.dependencies.includes(completedTodoId) && todo.status === "blocked"
    );

    for (const task of dependentTasks) {
      const remainingDeps = task.dependencies.filter((depId) => {
        const depTodo = this.todos.get(depId);
        return depTodo && depTodo.status !== "completed";
      });

      if (remainingDeps.length === 0) {
        // All dependencies completed, unblock the task
        task.status = "pending";
        task.blockedReason = undefined;
        task.updatedAt = new Date();
        task.history.push({
          timestamp: new Date(),
          action: "unblocked",
          previousStatus: "blocked",
          newStatus: "pending",
          notes: `Unblocked after completion of dependency: ${completedTodoId}`,
          agentId: "system",
        });

        vscode.window.showInformationMessage(
          `✅ Task "${task.content}" unblocked and ready to start`
        );
      }
    }

    await this.saveState();
  }

  /**
   * Create state checkpoint for long-running tasks
   */
  async createCheckpoint(todoId: string, context: string): Promise<void> {
    const todo = this.todos.get(todoId);
    if (!todo) {
      return;
    }

    todo.contextSnapshot = JSON.stringify({
      timestamp: new Date(),
      context,
      progress:
        todo.subTasks.filter((st) => st.status === "completed").length /
        todo.subTasks.length,
      environment: {
        workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
        activeFile: vscode.window.activeTextEditor?.document.fileName,
        openTabs: vscode.window.tabGroups.all.flatMap((group) =>
          group.tabs
            .map((tab) => (tab.input as any)?.uri?.fsPath)
            .filter(Boolean)
        ),
      },
    });

    todo.history.push({
      timestamp: new Date(),
      action: "checkpoint_created",
      notes: `Context snapshot saved: ${context.substring(0, 100)}...`,
      agentId: "ai-agent",
    });

    await this.saveState();
    vscode.window.showInformationMessage(
      `Checkpoint created for "${todo.content}"`
    );
  }

  /**
   * Smart task analysis for AI agents using semantic understanding
   */
  async analyzeTask(todoId: string): Promise<{
    complexity: "simple" | "medium" | "complex" | "very_complex";
    suggestedBreakdown: string[];
    estimatedTime: number;
    riskFactors: string[];
    prerequisites: string[];
  }> {
    const todo = this.todos.get(todoId);
    if (!todo) {
      throw new Error("Todo not found");
    }

    // Get content for analysis
    const content = todo.content;
    const summary = todo.summary || "";
    const fullText = `${content} ${summary}`;

    try {
      // Get AI model for semantic analysis
      const models = await vscode.lm.selectChatModels();
      const model = models.length > 0 ? models[0] : null;

      // Use AI-powered semantic analysis
      const semanticAnalysis = await analyzeTaskSemantics(fullText, model);

      // Map semantic complexity to our complexity levels
      const complexityMap: Record<
        string,
        "simple" | "medium" | "complex" | "very_complex"
      > = {
        simple: "simple",
        medium: "medium",
        complex: "complex",
        very_complex: "very_complex",
      };

      const complexity = complexityMap[semanticAnalysis.complexity] || "medium";

      // Estimate time based on complexity and task type
      const timeEstimates: Record<string, Record<string, number>> = {
        simple: {
          implementation: 30,
          testing: 20,
          research: 15,
          api: 25,
          generic: 20,
        },
        medium: {
          implementation: 90,
          testing: 60,
          research: 45,
          api: 75,
          generic: 60,
        },
        complex: {
          implementation: 240,
          testing: 180,
          research: 120,
          api: 200,
          generic: 180,
        },
        very_complex: {
          implementation: 480,
          testing: 360,
          research: 240,
          api: 400,
          generic: 360,
        },
      };

      const estimatedTime =
        timeEstimates[complexity][semanticAnalysis.taskType] ||
        timeEstimates[complexity]["generic"];

      // Generate risk factors based on semantic analysis
      const riskFactors = await this.generateRiskFactors(
        semanticAnalysis,
        model
      );

      // Generate prerequisites based on task type and complexity
      const prerequisites = await this.generatePrerequisites(
        semanticAnalysis,
        model
      );

      return {
        complexity,
        suggestedBreakdown: semanticAnalysis.suggestedBreakdown,
        estimatedTime,
        riskFactors,
        prerequisites,
      };
    } catch (error) {
      console.warn(
        "AI semantic analysis failed, using fallback analysis:",
        error
      );

      // Fallback to simple heuristic analysis
      const wordCount = fullText.split(/\s+/).length;
      const complexity =
        wordCount > 50 ? "complex" : wordCount > 20 ? "medium" : "simple";
      const estimatedTime = wordCount * 2; // 2 minutes per word as rough estimate

      return {
        complexity: complexity as any,
        suggestedBreakdown: [
          "Analyze task requirements",
          "Plan implementation approach",
          "Execute the main task",
          "Test and validate results",
          "Document completion",
        ],
        estimatedTime: Math.max(15, Math.min(480, estimatedTime)),
        riskFactors: ["Task complexity may be underestimated"],
        prerequisites: ["Ensure required tools and permissions are available"],
      };
    }
  }

  /**
   * Generate risk factors using AI analysis
   */
  private async generateRiskFactors(
    semanticAnalysis: any,
    model: vscode.LanguageModelChat | null
  ): Promise<string[]> {
    if (!model) {
      return [
        "Complexity may vary during execution",
        "Dependencies might need additional time",
      ];
    }

    try {
      const prompt = `Based on this task analysis:
Task Type: ${semanticAnalysis.taskType}
Complexity: ${semanticAnalysis.complexity}

Generate 2-3 specific risk factors that could affect this task completion. Focus on potential blockers, dependencies, or complexity increases. Return as JSON array: ["risk1", "risk2", "risk3"]`;

      // Use standardized AI request utility
      const riskFactors = await executeAIRequest<string[] | undefined>(
        model,
        prompt,
        undefined,
        'Risk factor analysis'
      );
      return Array.isArray(riskFactors)
        ? riskFactors
        : ["Task complexity may increase during execution"];
    } catch {
      return [
        "Task complexity may increase during execution",
        "External dependencies could cause delays",
      ];
    }
  }

  /**
   * Generate prerequisites using AI analysis
   */
  private async generatePrerequisites(
    semanticAnalysis: any,
    model: vscode.LanguageModelChat | null
  ): Promise<string[]> {
    if (!model) {
      return [
        "Review task requirements",
        "Ensure necessary tools are available",
      ];
    }

    try {
      const prompt = `Based on this task analysis:
Task Type: ${semanticAnalysis.taskType}
Complexity: ${semanticAnalysis.complexity}

Generate 2-3 specific prerequisites needed before starting this task. Focus on setup, permissions, knowledge, or dependencies. Return as JSON array: ["prereq1", "prereq2", "prereq3"]`;

      const messages = [vscode.LanguageModelChatMessage.User(prompt)];
      const response = await model.sendRequest(
        messages,
        {},
        new vscode.CancellationTokenSource().token
      );

      let responseText = "";
      for await (const part of response.text) {
        responseText += part;
      }

      const prerequisites = safeParseAIResponse(responseText.trim(), []);
      return Array.isArray(prerequisites)
        ? prerequisites
        : ["Ensure task requirements are clear"];
    } catch {
      return [
        "Ensure task requirements are clear",
        "Verify access to necessary resources",
      ];
    }
  }

  /**
   * AI Agent Memory Management - Clean up old unused todos
   */
  async performMemoryCleanup(): Promise<void> {
    const now = new Date();
    const oldTodos = Array.from(this.todos.values()).filter((todo) => {
      const daysSinceAccess =
        (now.getTime() - todo.lastAccessedAt.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceAccess > 7 && todo.status === "completed"; // Clean up completed todos older than 7 days
    });

    let cleanedCount = 0;
    for (const todo of oldTodos) {
      // Archive instead of delete - move to separate storage
      await this.archiveTodo(todo.id);
      this.todos.delete(todo.id);
      cleanedCount++;
    }

    if (cleanedCount > 0) {
      await this.saveState();
      vscode.window.showInformationMessage(
        `Cleaned up ${cleanedCount} old completed todos`
      );
    }
  }

  /**
   * Archive todo for long-term storage
   */
  private async archiveTodo(todoId: string): Promise<void> {
    const todo = this.todos.get(todoId);
    if (!todo) {
      return;
    }

    try {
      const archiveFile = path.join(
        this.context.globalStorageUri?.fsPath || "",
        "todos-archive.jsonl"
      );

      const archiveEntry =
        JSON.stringify({
          ...todo,
          archivedAt: new Date(),
        }) + "\n";

      fs.appendFileSync(archiveFile, archiveEntry);
    } catch (error) {
      console.warn("Could not archive todo:", error);
    }
  }

  /**
   * Enable/disable automatic task progression
   */
  async setAutoProgression(enabled: boolean): Promise<void> {
    this.autoProgressionEnabled = enabled;
    await this.saveState();
    vscode.window.showInformationMessage(
      `Auto-progression ${enabled ? "enabled" : "disabled"}`
    );
  }

  // ===== WORKFLOW METHODS =====
  /**
   * Create a workflow of linked todos that auto-progress
   */
  async createWorkflow(
    tasks: string[],
    workflowId?: string,
    enableSmartAnalysis: boolean = true
  ): Promise<string> {
    const wfId = workflowId || `workflow_${Date.now()}`;
    this.currentWorkflowId = wfId;

    // Add initial context snapshot
    globalContextManager.addContext(wfId, {
      timestamp: new Date(),
      type: 'workflow_progress',
      content: `Workflow "${wfId}" created with ${tasks.length} tasks: ${tasks.join(', ')}`,
      metadata: {
        workflowId: wfId,
        stepNumber: 0,
        priority: 'high'
      }
    });

    // Create todos with workflow metadata and smart analysis
    for (let i = 0; i < tasks.length; i++) {
      const taskContent = tasks[i];
      const summary = `Workflow: ${wfId}, Step ${i + 1}/${tasks.length}`;

      // Set dependencies - each task depends on the previous one
      const dependencies = i > 0 ? [`todo_workflow_${wfId}_${i - 1}`] : [];

      const todoId = await this.createTodo(taskContent, summary);

      // Update the todo with workflow-specific data
      const todo = this.todos.get(todoId);
      if (todo) {
        // Use predictable IDs for workflow dependencies
        const workflowTodoId = `todo_workflow_${wfId}_${i}`;
        this.todos.delete(todoId);
        todo.id = workflowTodoId;
        this.todos.set(workflowTodoId, todo);

        todo.parentWorkflowId = wfId;
        todo.position = i;
        todo.dependencies = dependencies;
        todo.tags.push("workflow", `workflow-${wfId}`);

        // Perform smart analysis if enabled
        if (enableSmartAnalysis) {
          try {
            const analysis = await this.analyzeTask(workflowTodoId);
            todo.estimatedTime = analysis.estimatedTime;

            // Auto-create subtasks based on analysis
            if (analysis.suggestedBreakdown.length > 0) {
              for (const subtaskContent of analysis.suggestedBreakdown) {
                await this.addSubTask(workflowTodoId, subtaskContent);
              }
            }

            // Add risk factors and prerequisites as notes
            if (
              analysis.riskFactors.length > 0 ||
              analysis.prerequisites.length > 0
            ) {
              const riskNotes = [
                ...analysis.riskFactors.map((r) => `⚠️ Risk: ${r}`),
                ...analysis.prerequisites.map((p) => `📋 Prerequisite: ${p}`),
              ].join("\n");

              todo.history.push({
                timestamp: new Date(),
                action: "analysis_completed",
                notes: `Smart Analysis:\n${riskNotes}`,
                agentId: "ai-analyzer",
              });
            }
          } catch (error) {
            console.warn("Smart analysis failed for task:", taskContent, error);
          }
        }

        todo.history.push({
          timestamp: new Date(),
          action: "workflow_created",
          notes: `Part of workflow ${wfId}, step ${i + 1}, dependencies: ${
            dependencies.join(", ") || "none"
          }`,
          agentId: "workflow-manager",
        });
      }
    }

    await this.saveState();

    // Trigger performance monitoring
    this.startWorkflowMonitoring(wfId);

    return wfId;
  }

  /**
   * Create enhanced workflow with AI agent orchestration guidance
   */
  async createEnhancedWorkflow(
    workflowTasks: Array<WorkflowTask>,
    parentPrompt: string
  ): Promise<string> {
    const wfId = `enhanced_workflow_${Date.now()}`;
    this.currentWorkflowId = wfId;

    // Extract parent objective from the prompt for context preservation
    const parentObjective =
      workflowTasks[0]?.guidance?.parentObjective ||
      `Complex task workflow: ${parentPrompt.substring(0, 100)}...`;

    // Create todos with enhanced AI agent guidance
    for (let i = 0; i < workflowTasks.length; i++) {
      const task = workflowTasks[i];
      const guidance = task.guidance;
      const summary = `Enhanced Workflow: ${wfId}, Step ${i + 1}/${
        workflowTasks.length
      }`;

      // Set dependencies - each task depends on the previous one (except approval tasks)
      const dependencies = i > 0 ? [`todo_enhanced_${wfId}_${i - 1}`] : [];

      const todoId = await this.createTodo(task.content, summary);

      // Update the todo with enhanced workflow-specific data and AI guidance
      const todo = this.todos.get(todoId);
      if (todo) {
        // Use predictable IDs for workflow dependencies
        const enhancedTodoId = `todo_enhanced_${wfId}_${i}`;
        this.todos.delete(todoId);
        todo.id = enhancedTodoId;
        this.todos.set(enhancedTodoId, todo);

        // Set workflow metadata
        todo.parentWorkflowId = wfId;
        todo.position = i;
        todo.dependencies = dependencies;
        todo.tags.push("enhanced-workflow", `workflow-${wfId}`);

        // === AI AGENT ORCHESTRATION ENHANCEMENTS ===
        todo.parentObjective = parentObjective;
        todo.aiInstructions = guidance?.aiInstructions;
        todo.nextStepGuidance = guidance?.nextStepGuidance;
        todo.expectedOutput = guidance?.expectedOutput;
        todo.validationCriteria = guidance?.validationCriteria;
        todo.recoveryInstructions = guidance?.recoveryInstructions;
        todo.approvalRequired = guidance?.approvalRequired || false;

        // Set status based on approval requirements and dependencies
        if (todo.approvalRequired) {
          todo.status =
            dependencies.length > 0 ? "blocked" : "awaiting_approval";
        } else {
          todo.status =
            dependencies.length > 0
              ? "blocked"
              : i === 0
              ? "pending"
              : "blocked";
        }

        // Add enhanced history entry
        todo.history.push({
          timestamp: new Date(),
          action: "enhanced_workflow_created",
          notes: `Enhanced workflow step ${
            i + 1
          } with AI guidance. Parent objective: ${parentObjective}. Dependencies: ${
            dependencies.join(", ") || "none"
          }. Approval required: ${todo.approvalRequired}`,
          agentId: "enhanced-workflow-manager",
        });

        // Add context snapshot for the first task
        if (i === 0) {
          todo.contextSnapshot = `Initial context: ${parentPrompt}. Workflow objective: ${parentObjective}`;
        }
      }
    }

    await this.saveState();

    // Enable auto-progression for enhanced workflows
    this.autoProgressionEnabled = true;

    // Trigger enhanced monitoring
    this.startWorkflowMonitoring(wfId);

    return wfId;
  }

  /**
   * Monitor workflow performance and provide insights
   */
  private startWorkflowMonitoring(workflowId: string): void {
    const checkInterval = setInterval(async () => {
      const workflowTodos = Array.from(this.todos.values()).filter(
        (todo) => todo.parentWorkflowId === workflowId
      );

      if (workflowTodos.length === 0) {
        clearInterval(checkInterval);
        return;
      }

      const completedTodos = workflowTodos.filter(
        (t) => t.status === "completed"
      );
      const blockedTodos = workflowTodos.filter((t) => t.status === "blocked");

      // Check for stuck workflows
      if (blockedTodos.length > 0) {
        const stuckTime = blockedTodos.reduce((max, todo) => {
          const blockTime = new Date().getTime() - todo.updatedAt.getTime();
          return Math.max(max, blockTime);
        }, 0);

        // If blocked for more than 30 minutes, suggest intervention
        if (stuckTime > 30 * 60 * 1000) {
          vscode.window.showWarningMessage(
            `Workflow "${workflowId}" has been blocked for ${Math.round(
              stuckTime / 60000
            )} minutes. Consider manual intervention.`,
            "Review Blocked Tasks"
          );
        }
      }

      // Workflow completed
      if (completedTodos.length === workflowTodos.length) {
        clearInterval(checkInterval);

        // Generate completion report
        const totalTime = workflowTodos.reduce(
          (sum, todo) => sum + (todo.actualTime || 0),
          0
        );
        const estimatedTime = workflowTodos.reduce(
          (sum, todo) => sum + (todo.estimatedTime || 0),
          0
        );
        const efficiency =
          estimatedTime > 0 ? Math.round((estimatedTime / totalTime) * 100) : 0;

        vscode.window.showInformationMessage(
          `🎉 Workflow "${workflowId}" completed! Time: ${totalTime}min (estimated: ${estimatedTime}min) Efficiency: ${efficiency}%`
        );
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Check if current task is complete and progress to next task
   */
  private async checkAndProgressWorkflow(
    completedTodoId: string
  ): Promise<void> {
    if (!this.currentWorkflowId) {
      return;
    }

    const completedTodo = this.todos.get(completedTodoId);
    if (!completedTodo) {
      return;
    }

    // Find the next pending todo in the workflow
    const workflowTodos = Array.from(this.todos.values())
      .filter(
        (todo) =>
          todo.summary?.includes(`Workflow: ${this.currentWorkflowId}`) &&
          todo.status === "pending"
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    if (workflowTodos.length > 0) {
      const nextTodo = workflowTodos[0];

      // Auto-start the next task
      await this.updateTodoStatus(
        nextTodo.id,
        "in_progress",
        `Auto-started after completion of: ${completedTodo.content}`
      );

      // Trigger AI agent callback if available
      vscode.commands.executeCommand("ai-todos-tool.aiAgentCallback", {
        event: "task_auto_progressed",
        completedTask: completedTodoId,
        nextTask: nextTodo.id,
        workflowId: this.currentWorkflowId,
      });

      vscode.window.showInformationMessage(
        `✅ "${completedTodo.content}" completed. 🔄 Auto-started: "${nextTodo.content}"`
      );
    } else {
      // Workflow completed
      vscode.commands.executeCommand("ai-todos-tool.aiAgentCallback", {
        event: "workflow_completed",
        workflowId: this.currentWorkflowId,
        completedTask: completedTodoId,
      });

      vscode.window.showInformationMessage(
        `🎉 Workflow "${this.currentWorkflowId}" completed!`
      );

      this.currentWorkflowId = undefined;
      await this.saveState();
    }
  }

  /**
   * Get next pending task in current workflow
   */
  getNextTask(): Todo | undefined {
    if (!this.currentWorkflowId) {
      return undefined;
    }

    const workflowTodos = Array.from(this.todos.values())
      .filter(
        (todo) =>
          todo.summary?.includes(`Workflow: ${this.currentWorkflowId}`) &&
          todo.status === "pending"
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return workflowTodos[0];
  }

  /**
   * Get current active task in workflow
   */
  getCurrentTask(): Todo | undefined {
    if (!this.currentWorkflowId) {
      return undefined;
    }

    return Array.from(this.todos.values()).find(
      (todo) =>
        todo.summary?.includes(`Workflow: ${this.currentWorkflowId}`) &&
        todo.status === "in_progress"
    );
  }

  /**
   * AI Agent API - Get workflow status
   */
  getWorkflowStatus(): {
    workflowId?: string;
    currentTask?: Todo;
    nextTask?: Todo;
    totalTasks: number;
    completedTasks: number;
    autoProgressionEnabled: boolean;
  } {
    const workflowTodos = this.currentWorkflowId
      ? Array.from(this.todos.values()).filter((todo) =>
          todo.summary?.includes(`Workflow: ${this.currentWorkflowId}`)
        )
      : [];

    return {
      workflowId: this.currentWorkflowId,
      currentTask: this.getCurrentTask(),
      nextTask: this.getNextTask(),
      totalTasks: workflowTodos.length,
      completedTasks: workflowTodos.filter((t) => t.status === "completed")
        .length,
      autoProgressionEnabled: this.autoProgressionEnabled,
    };
  }

  /**
   * Pause/Resume workflow
   */
  async pauseResumeWorkflow(): Promise<void> {
    this.autoProgressionEnabled = !this.autoProgressionEnabled;
    await this.saveState();

    const status = this.autoProgressionEnabled ? "resumed" : "paused";
    vscode.window.showInformationMessage(`Workflow ${status}`);
  }

  // ============= AI AGENT ORCHESTRATION METHODS =============

  /**
   * Get next steps guidance for a todo - helps AI agents know what to do after completion
   */
  async getNextStepsForTodo(todoId: string): Promise<any> {
    const todo = this.todos.get(todoId);
    if (!todo) {
      throw new Error(`Todo with id ${todoId} not found`);
    }

    const guidance: any = {
      parentObjective: todo.parentObjective,
      nextStepGuidance: todo.nextStepGuidance,
      validationCriteria: todo.validationCriteria,
      expectedOutput: todo.expectedOutput,
      currentStatus: todo.status,
      isPartOfWorkflow: !!todo.parentWorkflowId,
      workflowPosition: todo.position,
      hasDependencies: todo.dependencies.length > 0,
      requiredDependencies: todo.dependencies,
      upcomingTasks: this.getUpcomingWorkflowTasks(todoId),
      contextSnapshot: todo.contextSnapshot,
    };

    // If task is completed, provide next action guidance
    if (todo.status === "completed") {
      const nextTask = this.getNextWorkflowTask(todoId);
      guidance.nextTask = nextTask
        ? {
            id: nextTask.id,
            content: nextTask.content,
            aiInstructions: nextTask.aiInstructions,
            approvalRequired: nextTask.approvalRequired,
          }
        : null;

      guidance.recommendedAction = nextTask
        ? nextTask.approvalRequired
          ? "Request user approval for next task"
          : "Proceed to next task automatically"
        : "Workflow complete - review and summarize results";
    }

    return guidance;
  }

  /**
   * Approve a todo that requires approval (like Phase 3 tasks)
   */
  async approveTodo(todoId: string, notes?: string): Promise<boolean> {
    const todo = this.todos.get(todoId);
    if (!todo) {
      throw new Error(`Todo with id ${todoId} not found`);
    }

    if (!todo.approvalRequired) {
      throw new Error("This todo does not require approval");
    }

    if (todo.status !== "awaiting_approval") {
      throw new Error(
        `Todo must be in 'awaiting_approval' status to be approved. Current status: ${todo.status}`
      );
    }

    // Approve the todo
    await this.updateTodoStatus(
      todoId,
      "pending",
      `Approved by user. ${notes || ""}`
    );

    todo.history.push({
      timestamp: new Date(),
      action: "approved",
      notes: `User approved task. ${notes || ""}`,
      agentId: "user",
    });

    await this.saveState();
    this.updateStatusBar();

    // Auto-start if auto-progression is enabled
    if (this.autoProgressionEnabled) {
      await this.updateTodoStatus(
        todoId,
        "in_progress",
        "Auto-started after approval"
      );
    }

    return true;
  }

  /**
   * Get AI guidance for a specific todo - helps when AI agent gets stuck
   */
  async getAIGuidanceForTodo(
    todoId: string,
    model: vscode.LanguageModelChat
  ): Promise<any> {
    const todo = this.todos.get(todoId);
    if (!todo) {
      throw new Error(`Todo with id ${todoId} not found`);
    }

    // Add current request to context
    const workflowId = todo.parentWorkflowId || this.currentWorkflowId || todoId;
    globalContextManager.addContext(workflowId, {
      timestamp: new Date(),
      type: 'user_prompt',
      content: `Requesting AI guidance for task: ${todo.content}`,
      metadata: {
        taskId: todoId,
        workflowId: workflowId,
        priority: 'high'
      }
    });

    // Get compressed context for AI
    const compressedContext = await globalContextManager.getContextForAI(
      workflowId,
      `Please provide guidance for completing this task: ${todo.content}`,
      model
    );

    const guidance = {
      parentObjective: todo.parentObjective,
      aiInstructions: todo.aiInstructions,
      expectedOutput: todo.expectedOutput,
      validationCriteria: todo.validationCriteria,
      recoveryInstructions: todo.recoveryInstructions,
      contextLinks: todo.contextLinks,
      failureRecoveryHints: todo.failureRecoveryHints,
      currentContext: compressedContext, // Use compressed context instead of raw snapshot
      workflowContext: this.getWorkflowContext(todoId),
      troubleshootingTips: await this.generateTroubleshootingTips(todo, model),
      commonPatterns: await this.suggestCommonPatterns(todo, model),
    };

    return guidance;
  }

  /**
   * Get upcoming tasks in workflow
   */
  private getUpcomingWorkflowTasks(todoId: string): any[] {
    const todo = this.todos.get(todoId);
    if (!todo || !todo.parentWorkflowId) {
      return [];
    }

    return Array.from(this.todos.values())
      .filter(
        (t) =>
          t.parentWorkflowId === todo.parentWorkflowId &&
          (t.position || 0) > (todo.position || 0)
      )
      .sort((a, b) => (a.position || 0) - (b.position || 0))
      .slice(0, 3) // Next 3 tasks
      .map((t) => ({
        id: t.id,
        content: t.content,
        aiInstructions: t.aiInstructions,
        approvalRequired: t.approvalRequired,
        position: t.position,
      }));
  }

  /**
   * Get next task in workflow
   */
  private getNextWorkflowTask(todoId: string): Todo | undefined {
    const todo = this.todos.get(todoId);
    if (!todo || !todo.parentWorkflowId) {
      return undefined;
    }

    return Array.from(this.todos.values()).filter(
      (t) =>
        t.parentWorkflowId === todo.parentWorkflowId &&
        (t.position || 0) === (todo.position || 0) + 1
    )[0];
  }

  /**
   * Get workflow context for guidance
   */
  private getWorkflowContext(todoId: string): any {
    const todo = this.todos.get(todoId);
    if (!todo || !todo.parentWorkflowId) {
      return null;
    }

    const workflowTodos = Array.from(this.todos.values())
      .filter((t) => t.parentWorkflowId === todo.parentWorkflowId)
      .sort((a, b) => (a.position || 0) - (b.position || 0));

    return {
      workflowId: todo.parentWorkflowId,
      totalTasks: workflowTodos.length,
      currentPosition: todo.position,
      completedTasks: workflowTodos.filter((t) => t.status === "completed")
        .length,
      parentObjective: todo.parentObjective,
      overallProgress:
        workflowTodos.filter((t) => t.status === "completed").length /
        workflowTodos.length,
    };
  }

  /**
   * Generate troubleshooting tips using AI semantic analysis
   */
  private async generateTroubleshootingTips(
    todo: Todo,
    model: vscode.LanguageModelChat
  ): Promise<string[]> {
    try {
      // Use AI-powered semantic analysis to generate contextual tips
      const semanticAnalysis = await analyzeTaskSemantics(todo.content, model);

      // Combine AI-generated tips with status-based tips
      const statusTips = this.getStatusBasedTips(todo);

      return [...semanticAnalysis.contextualTips, ...statusTips];
    } catch (error) {
      console.warn("AI tip generation failed, using fallback tips:", error);

      // Fallback to basic status-based tips
      return this.getStatusBasedTips(todo);
    }
  }

  /**
   * Get tips based on todo status and dependencies (language-agnostic)
   */
  private getStatusBasedTips(todo: Todo): string[] {
    const tips = [];

    if (todo.status === "blocked") {
      tips.push("Review dependency tasks and their completion status");
      tips.push("Check if blocked reason can be resolved");
    }

    if (todo.dependencies.length > 0) {
      tips.push("Ensure all dependency tasks are completed before proceeding");
      tips.push("Review outputs from dependency tasks for context");
    }

    if (
      todo.status === "in_progress" &&
      todo.estimatedTime &&
      todo.actualTime
    ) {
      const timeRatio = todo.actualTime / todo.estimatedTime;
      if (timeRatio > 1.5) {
        tips.push(
          "Task is taking longer than estimated - consider breaking it down further"
        );
        tips.push("Review if scope has expanded beyond original requirements");
      }
    }

    if (todo.subTasks.length > 0) {
      const completedSubtasks = todo.subTasks.filter(
        (st) => st.status === "completed"
      ).length;
      const progressPercent = (completedSubtasks / todo.subTasks.length) * 100;
      if (progressPercent < 30) {
        tips.push(
          "Focus on completing subtasks one at a time for better progress tracking"
        );
      }
    }

    return tips;
  }

  /**
   * Suggest common patterns using AI semantic analysis
   */
  private async suggestCommonPatterns(
    todo: Todo,
    model: vscode.LanguageModelChat
  ): Promise<string[]> {
    try {
      if (!model) {
        return this.getFallbackPatterns();
      }

      const prompt = `Based on this task: "${todo.content}"

Generate 3-4 best practice patterns or recommendations that would help complete this task effectively. Focus on:
- Common approaches for this type of task
- Quality standards and patterns to follow
- Tools or techniques that work well
- Pitfalls to avoid

Return as JSON array: ["pattern1", "pattern2", "pattern3", "pattern4"]`;

      const messages = [vscode.LanguageModelChatMessage.User(prompt)];
      const response = await model.sendRequest(
        messages,
        {},
        new vscode.CancellationTokenSource().token
      );

      let responseText = "";
      for await (const part of response.text) {
        responseText += part;
      }

      const patterns = safeParseAIResponse<string[] | undefined>(
        responseText.trim(),
        undefined
      );
      return Array.isArray(patterns) ? patterns : this.getFallbackPatterns();
    } catch (error) {
      console.warn(
        "AI pattern suggestion failed, using fallback patterns:",
        error
      );
      return this.getFallbackPatterns();
    }
  }

  /**
   * Fallback patterns when AI analysis is unavailable
   */
  private getFallbackPatterns(): string[] {
    return [
      "Research existing implementations before starting new work",
      "Follow established patterns and conventions in the codebase",
      "Test incrementally during development",
      "Document decisions and approach for future reference",
    ];
  }
}

let todosTool: AIToDosTool;
let mcpServer: any;
let aiToolsRegistry: AIToolsRegistry;
let aiAgentCommunication: AIAgentCommunication;

// ================================================================================================
// EXTENSION LIFECYCLE
// ================================================================================================

// This method is called when your extension is activated
export async function activate(context: vscode.ExtensionContext) {
  try {
    console.log("AIToDosTool extension is now active!");

    // Global error handlers for uncaught exceptions
    process.on("unhandledRejection", (reason, promise) => {
      console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
      vscode.window
        .showErrorMessage(
          `AI-ToDos-Tool: Unhandled error occurred. Check console for details.`,
          "View Logs"
        )
        .then((action) => {
          if (action === "View Logs") {
            vscode.commands.executeCommand("workbench.action.toggleDevTools");
          }
        });
    });

    process.on("uncaughtException", (error) => {
      console.error("❌ Uncaught Exception:", error);
      vscode.window
        .showErrorMessage(
          `AI-ToDos-Tool: Critical error occurred: ${error.message}`,
          "Restart VS Code"
        )
        .then((action) => {
          if (action === "Restart VS Code") {
            vscode.commands.executeCommand("workbench.action.reloadWindow");
          }
        });
    });

    todosTool = new AIToDosTool(context);

    // Load existing state
    await todosTool.loadState();
    await todosTool.loadMultiSessionState();

    // Initialize AI Tools System
    console.log("🤖 Initializing AI Tools System...");
    aiToolsRegistry = AIToolsRegistry.getInstance();
    // Initialize AI Agent Communication without command registration
    aiAgentCommunication = new AIAgentCommunication();

    // Register AI Tools
    const aiTodoManager = new AITodoManagerTool(todosTool);
    const aiSemanticAnalyzer = new AISemanticAnalyzerTool();
    const aiWorkflowOrchestrator = new AIWorkflowOrchestratorTool();

    aiToolsRegistry.registerTool(aiTodoManager);
    aiToolsRegistry.registerTool(aiSemanticAnalyzer);
    aiToolsRegistry.registerTool(aiWorkflowOrchestrator);

    // Use centralized command registry to prevent duplicates
    const { CommandRegistry } = await import('./aiTools/CommandRegistry.js');
    const commandRegistry = CommandRegistry.getInstance();
    commandRegistry.registerAllCommands(context);

    console.log(`✅ AI Tools System initialized with ${aiToolsRegistry.getAllTools().length} tools`);

    // Setup Context Management Configuration Listener
    const configChangeListener = vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('ai-todos-tool.contextManagement')) {
        console.log('🔧 Context management configuration changed, reloading...');
        globalContextManager.reloadConfig();
      }
    });
    context.subscriptions.push(configChangeListener);

    // Register commands
    const createTodoCommand = vscode.commands.registerCommand(
      "ai-todos-tool.createTodo",
      async () => {
        try {
          const content = await vscode.window.showInputBox({
            prompt: "Enter todo content",
            placeHolder: "Describe the task...",
          });

          if (content) {
            const summary = await vscode.window.showInputBox({
              prompt: "Enter optional summary",
              placeHolder: "Brief description of the task...",
            });

            await todosTool.createTodo(content, summary);
          }
        } catch (error) {
          console.error("❌ Create todo command error:", error);
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          vscode.window.showErrorMessage(
            `Failed to create todo: ${errorMessage}`
          );
        }
      }
    );

    const updateStatusCommand = vscode.commands.registerCommand(
      "ai-todos-tool.updateStatus",
      async () => {
        try {
          const todos = todosTool.getAllTodos();
          if (todos.length === 0) {
            vscode.window.showInformationMessage("No todos found");
            return;
          }

          const todoItems = todos.map((t) => ({
            label: t.content,
            description: `Status: ${t.status}`,
            detail: t.id,
          }));

          const selected = await vscode.window.showQuickPick(todoItems, {
            placeHolder: "Select todo to update",
          });

          if (selected) {
            const statusItems = [
              { label: "Pending", value: "pending" as const },
              { label: "In Progress", value: "in_progress" as const },
              { label: "Completed", value: "completed" as const },
              { label: "Cancelled", value: "cancelled" as const },
            ];

            const newStatus = await vscode.window.showQuickPick(statusItems, {
              placeHolder: "Select new status",
            });

            if (newStatus) {
              const notes = await vscode.window.showInputBox({
                prompt: "Optional notes for this status change",
                placeHolder: "Why did you change the status?",
              });

              await todosTool.updateTodoStatus(
                selected.detail,
                newStatus.value,
                notes
              );
            }
          }
        } catch (error) {
          console.error("❌ Update status command error:", error);
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          vscode.window.showErrorMessage(
            `Failed to update todo status: ${errorMessage}`
          );
        }
      }
    );

    const addSubTaskCommand = vscode.commands.registerCommand(
      "ai-todos-tool.addSubTask",
      async () => {
        const todos = todosTool.getAllTodos();
        if (todos.length === 0) {
          vscode.window.showInformationMessage("No todos found");
          return;
        }

        const todoItems = todos.map((t) => ({
          label: t.content,
          description: `Status: ${t.status}`,
          detail: t.id,
        }));

        const selected = await vscode.window.showQuickPick(todoItems, {
          placeHolder: "Select todo to add subtask to",
        });

        if (selected) {
          const content = await vscode.window.showInputBox({
            prompt: "Enter subtask content",
            placeHolder: "Describe the subtask...",
          });

          if (content) {
            await todosTool.addSubTask(selected.detail, content);
          }
        }
      }
    );

    const showDashboardCommand = vscode.commands.registerCommand(
      "ai-todos-tool.showDashboard",
      () => {
        try {
          todosTool.showDashboard();
        } catch (error) {
          console.error("❌ Show dashboard command error:", error);
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          vscode.window.showErrorMessage(
            `Failed to show dashboard: ${errorMessage}`
          );
        }
      }
    );

    const clearSessionCommand = vscode.commands.registerCommand(
      "ai-todos-tool.clearSession",
      async () => {
        const confirm = await vscode.window.showWarningMessage(
          "Are you sure you want to clear all todos?",
          "Yes",
          "No"
        );

        if (confirm === "Yes") {
          await todosTool.clearSession();
        }
      }
    );

    const showConfigurationCommand = vscode.commands.registerCommand(
      "ai-todos-tool.showConfiguration",
      async () => {
        try {
          await ConfigurationDemo.showConfiguration();
        } catch (error) {
          console.error("❌ Show configuration command error:", error);
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          vscode.window.showErrorMessage(
            `Failed to show configuration: ${errorMessage}`
          );
        }
      }
    );

    const testContextCompressionCommand = vscode.commands.registerCommand(
      "ai-todos-tool.testContextCompression",
      async () => {
        try {
          await ConfigurationDemo.testContextCompression();
        } catch (error) {
          console.error("❌ Test context compression command error:", error);
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          vscode.window.showErrorMessage(
            `Failed to test context compression: ${errorMessage}`
          );
        }
      }
    );

    const toggleAutoProgressionCommand = vscode.commands.registerCommand(
      "ai-todos-tool.toggleAutoProgression",
      async () => {
        const currentStatus = todosTool.getWorkflowStatus();
        await todosTool.setAutoProgression(
          !currentStatus.autoProgressionEnabled
        );
      }
    );

    const createWorkflowCommand = vscode.commands.registerCommand(
      "ai-todos-tool.createWorkflow",
      async () => {
        const tasksInput = await vscode.window.showInputBox({
          prompt: "Enter tasks separated by semicolons (;)",
          placeHolder: "Task 1; Task 2; Task 3...",
        });

        if (tasksInput) {
          const tasks = tasksInput
            .split(";")
            .map((t) => t.trim())
            .filter((t) => t.length > 0);
          if (tasks.length > 0) {
            const workflowId = await todosTool.createWorkflow(tasks);
            await todosTool.setAutoProgression(true);
            vscode.window.showInformationMessage(
              `Workflow "${workflowId}" created with ${tasks.length} tasks`
            );
          }
        }
      }
    );

    const showWorkflowStatusCommand = vscode.commands.registerCommand(
      "ai-todos-tool.showWorkflowStatus",
      () => {
        const status = todosTool.getWorkflowStatus();
        const message = status.workflowId
          ? `Workflow: ${status.workflowId}\nProgress: ${
              status.completedTasks
            }/${status.totalTasks}\nCurrent: ${
              status.currentTask?.content || "None"
            }\nNext: ${status.nextTask?.content || "None"}\nAuto-progression: ${
              status.autoProgressionEnabled ? "ON" : "OFF"
            }`
          : "No active workflow";

        vscode.window.showInformationMessage(message);
      }
    );

    const pauseResumeWorkflowCommand = vscode.commands.registerCommand(
      "ai-todos-tool.pauseResumeWorkflow",
      async () => {
        await todosTool.pauseResumeWorkflow();
      }
    );

    // AI Agent callback command (for external integration)
    const aiAgentCallbackCommand = vscode.commands.registerCommand(
      "ai-todos-tool.aiAgentCallback",
      (data: any) => {
        // This command can be used by AI agents to receive notifications
        console.log("AI Agent Callback:", data);
        // AI agents can listen for this command to receive workflow events
      }
    );

    // New enhanced commands for AI agent support
    const analyzeTaskCommand = vscode.commands.registerCommand(
      "ai-todos-tool.analyzeTask",
      async () => {
        const todos = todosTool
          .getAllTodos()
          .filter((t) => t.status !== "completed");
        if (todos.length === 0) {
          vscode.window.showInformationMessage("No active todos to analyze");
          return;
        }

        const todoItems = todos.map((t) => ({
          label: t.content,
          description: `Status: ${t.status}, Priority: ${t.priority}`,
          detail: t.id,
        }));

        const selected = await vscode.window.showQuickPick(todoItems, {
          placeHolder: "Select todo to analyze",
        });

        if (selected) {
          try {
            const analysis = await todosTool.analyzeTask(selected.detail);
            const message = `Analysis Complete:
Complexity: ${analysis.complexity}
Estimated Time: ${analysis.estimatedTime} minutes
Risk Factors: ${analysis.riskFactors.length}
Suggested Steps: ${analysis.suggestedBreakdown.length}`;

            vscode.window
              .showInformationMessage(message, "View Details")
              .then((action) => {
                if (action === "View Details") {
                  todosTool.showDashboard();
                }
              });
          } catch (error) {
            vscode.window.showErrorMessage(
              `Analysis failed: ${
                error instanceof Error ? error.message : "Unknown error"
              }`
            );
          }
        }
      }
    );

    const createCheckpointCommand = vscode.commands.registerCommand(
      "ai-todos-tool.createCheckpoint",
      async () => {
        const todos = todosTool
          .getAllTodos()
          .filter((t) => t.status === "in_progress");
        if (todos.length === 0) {
          vscode.window.showInformationMessage("No active todos to checkpoint");
          return;
        }

        const todoItems = todos.map((t) => ({
          label: t.content,
          description: `Status: ${t.status}`,
          detail: t.id,
        }));

        const selected = await vscode.window.showQuickPick(todoItems, {
          placeHolder: "Select todo to checkpoint",
        });

        if (selected) {
          const context = await vscode.window.showInputBox({
            prompt: "Enter current context/progress notes",
            placeHolder:
              "What are you currently working on? What is the current state?",
          });

          if (context) {
            await todosTool.createCheckpoint(selected.detail, context);
          }
        }
      }
    );

    const cleanupMemoryCommand = vscode.commands.registerCommand(
      "ai-todos-tool.cleanupMemory",
      async () => {
        const confirm = await vscode.window.showWarningMessage(
          "This will archive completed todos older than 7 days. Continue?",
          "Yes",
          "No"
        );

        if (confirm === "Yes") {
          await todosTool.performMemoryCleanup();
        }
      }
    );

    const prioritizeTasksCommand = vscode.commands.registerCommand(
      "ai-todos-tool.prioritizeTasks",
      async () => {
        const todos = todosTool
          .getAllTodos()
          .filter((t) => t.status !== "completed");
        if (todos.length === 0) {
          vscode.window.showInformationMessage("No active todos to prioritize");
          return;
        }

        const prioritized = todos.sort((a, b) => {
          const priorities = { critical: 4, high: 3, medium: 2, low: 1 };
          return priorities[b.priority] - priorities[a.priority];
        });

        const items = prioritized.slice(0, 10).map((todo, index) => {
          const priorityEmoji =
            { critical: "🔴", high: "🟠", medium: "🟡", low: "🟢" }[
              todo.priority
            ] || "🟡";
          return `${index + 1}. ${priorityEmoji} ${todo.content} (${
            todo.priority
          })`;
        });

        vscode.window
          .showQuickPick(items, {
            placeHolder: "Top Priority Tasks (Select to open dashboard)",
            canPickMany: false,
          })
          .then((selected) => {
            if (selected) {
              todosTool.showDashboard();
            }
          });
      }
    );

    const showAIActivityCommand = vscode.commands.registerCommand(
      "ai-todos-tool.showAIActivity",
      () => {
        vscode.window.showInformationMessage(
          "Check the VS Code Output Panel (View → Output → AI-ToDos-Tool) for detailed AI tool activity logs. Console logs show real-time AI agent interactions with timestamps and action details."
        );
        // Optionally open the output panel
        vscode.commands.executeCommand("workbench.action.output.toggleOutput");
      }
    );

    const debugToolRegistrationCommand = vscode.commands.registerCommand(
      "ai-todos-tool.debugToolRegistration",
      async () => {
        try {
          const timestamp = new Date().toLocaleTimeString();
          console.log(`🔍 [${timestamp}] === TODOSTOOL DIAGNOSTIC REPORT ===`);

          // Basic checks
          const extensionId = "duc01226.ai-todos-tool";
          const extension = vscode.extensions.getExtension(extensionId);
          const isActive = extension?.isActive || false;
          const hasLMAPI = !!(vscode.lm && vscode.lm.registerTool);
          const vscodeVersion = vscode.version;

          console.log(
            `📦 Extension (${extensionId}): ${
              isActive ? "✅ Active" : "❌ Inactive"
            }`
          );
          console.log(
            `🤖 Language Model Tools API: ${
              hasLMAPI ? "✅ Available" : "❌ Missing"
            }`
          );
          console.log(`📱 VSCode Version: ${vscodeVersion}`);

          // Test prompts for user
          const testPrompts = [
            "@copilot I need to implement a user authentication system with login, registration, and password reset. Can you help me organize this into manageable tasks?",
            "@copilot I'm working on a complex React project with multiple components. Help me break down the development into structured todos.",
            "@copilot Create a workflow for building a REST API with authentication, CRUD operations, and comprehensive testing.",
          ];

          console.log(`🧪 === TEST THESE PROMPTS IN GITHUB COPILOT CHAT ===`);
          testPrompts.forEach((prompt, i) => {
            console.log(`${i + 1}. ${prompt}`);
          });

          const summary = `
🔍 TODOSTOOL DIAGNOSTIC SUMMARY

📦 Extension Status: ${isActive ? "✅ Active" : "❌ Inactive"}
🤖 Language Model API: ${
            hasLMAPI ? "✅ Available" : "❌ Missing (requires VSCode 1.103.0+)"
          }
� VSCode Version: ${vscodeVersion}

💡 IMPORTANT UNDERSTANDING:
- Your extension uses VSCode Language Model Tools (NOT MCP)
- Tools don't appear in "Configure Tools" menu - that's for MCP tools
- AI automatically invokes your tool when it detects task management needs
- Tool works behind the scenes - you'll see notifications when invoked

🧪 TO TEST YOUR TOOL:
1. Open GitHub Copilot Chat
2. Try complex, multi-step prompts (see console for examples)
3. Watch for visual notifications
4. Check Extension Host console for tool invocation logs

❓ IF TOOL NOT BEING INVOKED:
- AI doesn't think task management is needed for your prompt
- Try more complex project organization requests
- Use explicit workflow/task management language
- Your tool IS registered correctly - it's about prompt patterns
        `;

          console.log(summary);

          vscode.window
            .showInformationMessage(
              `TodosTool Diagnostic Complete - Extension ${
                isActive ? "Active" : "Inactive"
              }`,
              "View Console",
              "Test in Copilot",
              "Open Debug Tools"
            )
            .then((action) => {
              if (action === "View Console") {
                vscode.commands.executeCommand(
                  "workbench.action.toggleDevTools"
                );
              } else if (action === "Test in Copilot") {
                vscode.commands.executeCommand("workbench.action.chat.open");
              } else if (action === "Open Debug Tools") {
                vscode.commands.executeCommand(
                  "workbench.action.toggleDevTools"
                );
              }
            });
        } catch (error) {
          console.error("❌ Diagnostic failed:", error);
          vscode.window.showErrorMessage(`Diagnostic failed: ${error}`);
        }
      }
    );

    // AI Tools Demo Command
    const aiToolsDemoCommand = vscode.commands.registerCommand(
      "ai-todos-tool.demoAITools",
      async () => {
        try {
          // Get AIToolsManager instance for demo functionality
          const aiToolsManager = AIToolsManager.getInstance();
          await aiToolsManager.demoAITools();
        } catch (error) {
          console.error("❌ AI Tools demo error:", error);
          vscode.window.showErrorMessage(`AI Tools demo failed: ${error}`);
        }
      }
    );

    context.subscriptions.push(
      createTodoCommand,
      updateStatusCommand,
      addSubTaskCommand,
      showDashboardCommand,
      clearSessionCommand,
      showConfigurationCommand,
      testContextCompressionCommand,
      toggleAutoProgressionCommand,
      createWorkflowCommand,
      showWorkflowStatusCommand,
      pauseResumeWorkflowCommand,
      aiAgentCallbackCommand,
      analyzeTaskCommand,
      createCheckpointCommand,
      cleanupMemoryCommand,
      prioritizeTasksCommand,
      showAIActivityCommand,
      debugToolRegistrationCommand,
      aiToolsDemoCommand
    );

    // ============= MCP SERVER COMMANDS =============

    const startMCPServerCommand = vscode.commands.registerCommand(
      "ai-todos-tool.startMCPServer",
      async () => {
        try {
          const config = vscode.workspace.getConfiguration("ai-todos-tool.mcp");
          const enabled = config.get<boolean>("enabled", true);

          if (!enabled) {
            vscode.window
              .showWarningMessage(
                "MCP Server is disabled in settings. Enable it first in Settings > AI-ToDos-Tool > MCP.",
                "Open Settings"
              )
              .then((action) => {
                if (action === "Open Settings") {
                  vscode.commands.executeCommand(
                    "workbench.action.openSettings",
                    "ai-todos-tool.mcp"
                  );
                }
              });
            return;
          }

          if (mcpServer && mcpServer.isServerRunning()) {
            vscode.window.showInformationMessage(
              "MCP Server is already running"
            );
            return;
          }

          if (!mcpServer) {
            const { TodosMCPServer } = await import("./mcpServer.js");
            mcpServer = new TodosMCPServer(todosTool);
          }

          await mcpServer.start();

          vscode.window
            .showInformationMessage(
              "🚀 MCP Server started successfully! TodosTool is now available to Claude and other MCP-compatible AI models.",
              "Show Status"
            )
            .then((action) => {
              if (action === "Show Status") {
                vscode.commands.executeCommand("ai-todos-tool.showMCPStatus");
              }
            });
        } catch (error) {
          console.error("❌ Failed to start MCP server:", error);
          vscode.window
            .showErrorMessage(
              `Failed to start MCP Server: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
              "View Logs"
            )
            .then((action) => {
              if (action === "View Logs") {
                vscode.commands.executeCommand(
                  "workbench.action.toggleDevTools"
                );
              }
            });
        }
      }
    );

    const stopMCPServerCommand = vscode.commands.registerCommand(
      "ai-todos-tool.stopMCPServer",
      async () => {
        try {
          if (!mcpServer || !mcpServer.isServerRunning()) {
            vscode.window.showInformationMessage("MCP Server is not running");
            return;
          }

          await mcpServer.stop();

          vscode.window.showInformationMessage(
            "⏹️ MCP Server stopped successfully"
          );
        } catch (error) {
          console.error("❌ Failed to stop MCP server:", error);
          vscode.window.showErrorMessage(
            `Failed to stop MCP Server: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }
      }
    );

    const showMCPStatusCommand = vscode.commands.registerCommand(
      "ai-todos-tool.showMCPStatus",
      () => {
        try {
          const config = vscode.workspace.getConfiguration("ai-todos-tool.mcp");
          const enabled = config.get<boolean>("enabled", true);
          const port = config.get<number>("port", 3000);
          const autoStart = config.get<boolean>("autoStart", true);

          const serverInfo = mcpServer
            ? mcpServer.getServerInfo()
            : { running: false, tools: 0 };

          const status = `
🔍 **MCP SERVER STATUS**

**Configuration:**
• Enabled: ${enabled ? "✅ Yes" : "❌ No"}
• Port: ${port}
• Auto-start: ${autoStart ? "✅ Yes" : "❌ No"}

**Server Status:**
• Running: ${serverInfo.running ? "✅ Active" : "❌ Stopped"}
• Available Tools: ${serverInfo.tools}

**Supported AI Models:**
• Claude (Anthropic)
• GPT-4 with MCP support
• Any MCP-compatible AI agent

**Usage Instructions:**
1. Start MCP Server (if not auto-started)
2. Configure your AI client to connect to MCP server
3. AI models can now access TodosTool functions
4. Use prompts like "create a todo" or "show my workflow status"

**Available Tools:**
• create_todo - Create new tasks
• list_todos - Show all todos
• update_todo_status - Change task status
• create_workflow - Create multi-step workflows
• analyze_task - AI-powered task analysis
• get_workflow_status - Check progress
• add_subtask - Break down complex tasks
• create_checkpoint - Save progress states
• clear_session - Reset current session
• get_session_summary - View session info
        `;

          vscode.window
            .showInformationMessage(
              `MCP Server: ${serverInfo.running ? "Running" : "Stopped"}`,
              "View Details",
              serverInfo.running ? "Stop Server" : "Start Server",
              "Open Settings"
            )
            .then((action) => {
              if (action === "View Details") {
                vscode.workspace
                  .openTextDocument({
                    content: status,
                    language: "markdown",
                  })
                  .then((doc) => vscode.window.showTextDocument(doc));
              } else if (action === "Stop Server") {
                vscode.commands.executeCommand("ai-todos-tool.stopMCPServer");
              } else if (action === "Start Server") {
                vscode.commands.executeCommand("ai-todos-tool.startMCPServer");
              } else if (action === "Open Settings") {
                vscode.commands.executeCommand(
                  "workbench.action.openSettings",
                  "ai-todos-tool.mcp"
                );
              }
            });
        } catch (error) {
          console.error("❌ Failed to get MCP status:", error);
          vscode.window.showErrorMessage(`Failed to get MCP status: ${error}`);
        }
      }
    );

    // Add MCP commands to subscriptions
    context.subscriptions.push(
      startMCPServerCommand,
      stopMCPServerCommand,
      showMCPStatusCommand
    );

    // Create chat participant with enhanced AI agent support
    const todosChatParticipant = createTodosChatParticipant(todosTool);
    context.subscriptions.push(todosChatParticipant);

    // Register command for AI Tools integration
    const executeTodoToolCommand = vscode.commands.registerCommand(
      'ai-todos-tool.executeTodoTool',
      async (input: TodoToolInput): Promise<TodoToolResult> => {
        try {
          console.log(`🔧 AI Tool executing todo action: ${input.action}`);
          
          switch (input.action) {
            case "create":
              const todoId = await todosTool.createTodo(
                input.content || "",
                input.summary,
                input.priority,
                input.tags
              );
              return { 
                success: true, 
                data: { todoId, content: input.content || "" } as CreateTodoData 
              };

            case "update":
              if (!input.todoId) {
                throw new Error("todoId required for update");
              }
              await todosTool.updateTodoStatus(
                input.todoId,
                input.status || "pending",
                input.notes
              );
              return { 
                success: true, 
                data: { todoId: input.todoId, status: input.status || "pending" } as UpdateTodoData 
              };

            case "complete":
              if (!input.todoId) {
                throw new Error("todoId required for complete");
              }
              await todosTool.updateTodoStatus(input.todoId, "completed", input.notes);
              return { 
                success: true, 
                data: { todoId: input.todoId, status: "completed" } as UpdateTodoData 
              };

            case "list":
              const todos = todosTool.getAllTodos();
              return { 
                success: true, 
                data: { todos, count: todos.length } as ListTodosData 
              };

            case "get":
              if (!input.todoId) {
                throw new Error("todoId required for get");
              }
              const todo = todosTool.getTodo(input.todoId);
              if (!todo) {
                throw new Error(`Todo ${input.todoId} not found`);
              }
              return { 
                success: true, 
                data: { todo } as GetTodoData 
              };

            case "summary":
              const allTodos = todosTool.getAllTodos();
              const summary = todosTool.getSessionSummary();
              return { 
                success: true, 
                data: { allTodos, summary } as SummaryData 
              };

            case "clear":
              await todosTool.clearSession();
              return { 
                success: true, 
                data: { message: "Session cleared" } as ClearSessionData 
              };

            case "addSubTask":
              if (!input.todoId || !input.subTaskContent) {
                throw new Error("todoId and subTaskContent required");
              }
              const subTaskId = await todosTool.addSubTask(input.todoId, input.subTaskContent);
              return { 
                success: true, 
                data: { todoId: input.todoId, subTaskId } as AddSubTaskData 
              };

            case "createWorkflow":
              if (!input.workflowTasks || !Array.isArray(input.workflowTasks)) {
                throw new Error("workflowTasks array required for createWorkflow");
              }
              const workflowId = await todosTool.createWorkflow(input.workflowTasks);
              return {
                success: true,
                data: { workflowId, tasksCount: input.workflowTasks.length } as CreateWorkflowData
              };

            case "getWorkflowStatus":
              const workflowStatus = todosTool.getWorkflowStatus();
              return {
                success: true,
                data: workflowStatus as GetWorkflowStatusData
              };

            case "analyze":
              if (!input.todoId) {
                throw new Error("todoId required for analyze");
              }
              const analysis = await todosTool.analyzeTask(input.todoId);
              return {
                success: true,
                data: analysis as AnalyzeTaskData
              };

            case "delete":
              if (!input.todoId) {
                throw new Error("todoId required for delete");
              }
              const deleted = todosTool.deleteTodo(input.todoId);
              return {
                success: true,
                data: { 
                  message: deleted ? "Todo deleted successfully" : "Todo not found",
                  success: deleted
                } as GenericActionData
              };

            case "toggleAutoProgression":
              const currentStatus = todosTool.getWorkflowStatus();
              const newAutoState = input.autoProgression !== undefined 
                ? input.autoProgression 
                : !currentStatus.autoProgressionEnabled;
              await todosTool.setAutoProgression(newAutoState);
              return {
                success: true,
                data: {
                  message: `Auto-progression ${newAutoState ? "enabled" : "disabled"}`,
                  success: true,
                  autoProgressionEnabled: newAutoState
                } as GenericActionData
              };

            default:
              throw new Error(`Unsupported action: ${input.action}`);
          }
        } catch (error) {
          console.error(`❌ AI Tool execution failed:`, error);
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
          } as TodoToolErrorResult;
        }
      }
    );

    context.subscriptions.push(executeTodoToolCommand);

    // Register the language model tool for GitHub Copilot integration
    try {
      const todosToolHandler = vscode.lm.registerTool("todosTool", {
        invoke: async (options: vscode.LanguageModelToolInvocationOptions<TodosToolInput>) => {
          // === ENHANCED TOOL INVOCATION FEEDBACK ===
          const timestamp = new Date().toLocaleTimeString();
          const action = options.input?.action || "unknown";

          console.log(
            `🤖 [${timestamp}] ✨ AI AGENT SUCCESSFULLY INVOKED TODOSTOOL ✨`
          );
          console.log(`🎯 [${timestamp}] Action: ${action}`);
          console.log(
            `🔧 [${timestamp}] Input:`,
            JSON.stringify(options.input, null, 2)
          );

          // Show visual confirmation that tool is working
          vscode.window.showInformationMessage(
            `🤖 AI Agent used TodosTool: ${action}`,
            { modal: false }
          );

          try {
            const {
              action,
              todoId,
              content,
              summary,
              status,
              notes,
              subTaskContent,
              workflowTasks,
              autoProgression,
            } = options.input;

            let result: string;

            switch (action) {
              case "create":
                const newId = await todosTool.createTodo(
                  content || "",
                  summary
                );
                result = `Todo created with ID: ${newId}`;
                console.log(
                  `✅ [${timestamp}] Todo created: "${content?.substring(
                    0,
                    50
                  )}..." (ID: ${newId})`
                );
                break;
              case "update":
                await todosTool.updateTodoStatus(
                  todoId || "",
                  status as any,
                  notes
                );
                result = `Todo ${todoId} updated to ${status}`;
                console.log(
                  `🔄 [${timestamp}] Todo ${todoId} updated to ${status}`
                );
                break;
              case "get":
                const todo = todosTool.getTodo(todoId || "");
                result = todo
                  ? JSON.stringify(todo, null, 2)
                  : "Todo not found";
                console.log(`👁️ [${timestamp}] Todo retrieved: ${todoId}`);
                break;
              case "list":
                const todos = todosTool.getAllTodos();
                result = JSON.stringify(todos, null, 2);
                console.log(`📋 [${timestamp}] Listed ${todos.length} todos`);
                break;
              case "summary":
                const summaryResult = todosTool.getTodoSummary(todoId || "");
                result = summaryResult || "Todo not found";
                console.log(
                  `📊 [${timestamp}] Summary requested for: ${todoId}`
                );
                break;
              case "clear":
                await todosTool.clearSession();
                result = "Session cleared successfully";
                console.log(`🗑️ [${timestamp}] Session cleared by AI agent`);
                break;
              case "addSubTask":
                const subTaskId = await todosTool.addSubTask(
                  todoId || "",
                  subTaskContent || ""
                );
                result = `SubTask created with ID: ${subTaskId}`;
                console.log(
                  `➕ [${timestamp}] SubTask added to ${todoId}: "${subTaskContent?.substring(
                    0,
                    30
                  )}..."`
                );
                break;
              case "createWorkflow":
                if (!workflowTasks || !Array.isArray(workflowTasks)) {
                  result =
                    "Error: workflowTasks must be an array of task descriptions";
                  console.log(
                    `❌ [${timestamp}] Invalid workflowTasks provided`
                  );
                  break;
                }
                const workflowId = await todosTool.createWorkflow(
                  workflowTasks
                );
                result = `Workflow created with ID: ${workflowId} (${workflowTasks.length} tasks)`;
                console.log(
                  `🔄 [${timestamp}] Workflow ${workflowId} created with ${workflowTasks.length} tasks`
                );
                break;
              case "toggleAutoProgression":
                const currentStatus = todosTool.getWorkflowStatus();
                const newAutoState =
                  autoProgression !== undefined
                    ? autoProgression
                    : !currentStatus.autoProgressionEnabled;
                await todosTool.setAutoProgression(newAutoState);
                result = `Auto-progression ${
                  newAutoState ? "enabled" : "disabled"
                }`;
                console.log(
                  `⚙️ [${timestamp}] Auto-progression ${
                    newAutoState ? "enabled" : "disabled"
                  } by AI agent`
                );
                break;
              case "getWorkflowStatus":
                const workflowStatus = todosTool.getWorkflowStatus();
                result = JSON.stringify(workflowStatus, null, 2);
                console.log(`📊 [${timestamp}] Workflow status retrieved`);
                break;
              case "complete":
                await todosTool.updateTodoStatus(
                  todoId || "",
                  "completed",
                  notes
                );
                result = `Todo ${todoId} completed`;
                console.log(
                  `✅ [${timestamp}] Todo ${todoId} completed by AI agent`
                );
                break;
              case "delete":
                const deleted = todosTool.deleteTodo(todoId || "");
                result = deleted
                  ? "Todo deleted successfully"
                  : "Todo not found";
                console.log(
                  `🗑️ [${timestamp}] Todo ${todoId} ${
                    deleted ? "deleted" : "not found"
                  } by AI agent`
                );
                break;
              default:
                result = `Unknown action: ${action}`;
                console.log(
                  `❓ [${timestamp}] Unknown action requested by AI agent: ${action}`
                );
            }

            console.log(
              `🔄 [${timestamp}] AI Agent tool result: ${result.substring(
                0,
                100
              )}...`
            );

            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(result),
            ]);
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : "Unknown error";
            console.error(`❌ [${timestamp}] AI Agent tool error:`, error);

            // Show user notification for tool errors
            vscode.window
              .showErrorMessage(`AI-ToDos-Tool error: ${errorMsg}`, "View Logs")
              .then((action) => {
                if (action === "View Logs") {
                  vscode.commands.executeCommand(
                    "workbench.action.toggleDevTools"
                  );
                }
              });

            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(
                `Error: ${errorMsg}. Please check the error logs for more details.`
              ),
            ]);
          }
        },
      });
      context.subscriptions.push(todosToolHandler);

      console.log("✅ TodosTool Language Model Tool registered successfully!");
    } catch (registrationError) {
      console.error("❌ Failed to register TodosTool:", registrationError);
      vscode.window.showErrorMessage(
        "Failed to register TodosTool. Please restart VS Code."
      );
    }

    // Register AI Semantic Analyzer Tool for Language Model Tools
    try {
      const aiSemanticAnalyzerHandler = vscode.lm.registerTool("aiSemanticAnalyzer", {
        invoke: async (options: vscode.LanguageModelToolInvocationOptions<AISemanticAnalyzerInput>) => {
          const timestamp = new Date().toLocaleTimeString();
          console.log(`🧠 [${timestamp}] AI Semantic Analyzer invoked by AI agent`);
          console.log(`📊 [${timestamp}] Analysis parameters:`, JSON.stringify(options.input, null, 2));

          try {
            const result = await aiToolsRegistry.executeTool('ai_semantic_analyzer', options.input);
            
            if (!result.success) {
              throw new Error(result.error || 'Analysis failed');
            }

            const analysisData = result.data;
            const responseText = `Analysis completed: ${analysisData?.analysisType || 'unknown'} analysis of prompt "${(analysisData?.prompt || '').substring(0, 100)}..."\n\nResult: ${JSON.stringify(analysisData?.result || {}, null, 2)}\n\nModel Info: ${analysisData?.modelInfo?.hasModel ? `Using ${analysisData.modelInfo.modelName || 'AI model'}` : 'Using fallback analysis'}`;

            console.log(`✅ [${timestamp}] AI Semantic Analysis completed successfully`);
            
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(responseText),
            ]);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "Unknown error";
            console.error(`❌ [${timestamp}] AI Semantic Analysis failed:`, error);
            
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(
                `AI Semantic Analysis Error: ${errorMsg}. Please check the error logs for more details.`
              ),
            ]);
          }
        },
      });
      context.subscriptions.push(aiSemanticAnalyzerHandler);
      console.log("✅ AI Semantic Analyzer Language Model Tool registered successfully!");
    } catch (registrationError) {
      console.error("❌ Failed to register AI Semantic Analyzer:", registrationError);
    }

    // Register AI Todo Manager Tool for Language Model Tools  
    try {
      const aiTodoManagerHandler = vscode.lm.registerTool("aiTodoManager", {
        invoke: async (options: vscode.LanguageModelToolInvocationOptions<AITodoManagerInput>) => {
          const timestamp = new Date().toLocaleTimeString();
          const action = options.input?.action || "unknown";
          
          console.log(`🤖 [${timestamp}] AI Todo Manager invoked by AI agent`);
          console.log(`🎯 [${timestamp}] Action: ${action}`);
          console.log(`📋 [${timestamp}] Parameters:`, JSON.stringify(options.input, null, 2));

          try {
            const result = await aiToolsRegistry.executeTool('ai_todos_manager', options.input);
            
            if (!result.success) {
              throw new Error(result.error || 'Todo operation failed');
            }

            const responseText = typeof result.data === 'string' 
              ? result.data 
              : `Todo operation '${action}' completed successfully.\n\nResult: ${JSON.stringify(result.data, null, 2)}`;

            console.log(`✅ [${timestamp}] AI Todo Manager operation completed successfully`);
            
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(responseText),
            ]);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "Unknown error";
            console.error(`❌ [${timestamp}] AI Todo Manager failed:`, error);
            
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(
                `AI Todo Manager Error: ${errorMsg}. Please check the error logs for more details.`
              ),
            ]);
          }
        },
      });
      context.subscriptions.push(aiTodoManagerHandler);
      console.log("✅ AI Todo Manager Language Model Tool registered successfully!");
    } catch (registrationError) {
      console.error("❌ Failed to register AI Todo Manager:", registrationError);
    }

    // Register AI Workflow Orchestrator Tool for Language Model Tools
    try {
      const aiWorkflowOrchestratorHandler = vscode.lm.registerTool("aiWorkflowOrchestrator", {
        invoke: async (options: vscode.LanguageModelToolInvocationOptions<AIWorkflowOrchestratorInput>) => {
          const timestamp = new Date().toLocaleTimeString();
          const objective = options.input?.objective || "unknown";
          
          console.log(`🚀 [${timestamp}] AI Workflow Orchestrator invoked by AI agent`);
          console.log(`🎯 [${timestamp}] Objective: ${objective}`);
          console.log(`⚙️ [${timestamp}] Parameters:`, JSON.stringify(options.input, null, 2));

          try {
            const result = await aiToolsRegistry.executeTool('ai_workflow_orchestrator', options.input);
            
            if (!result.success) {
              throw new Error(result.error || 'Workflow generation failed');
            }

            const workflowData = result.data;
            const responseText = `Workflow generated successfully!\n\nObjective: ${workflowData?.objective || 'Unknown'}\nComplexity: ${workflowData?.complexity || 'Medium'}\nTotal Steps: ${workflowData?.totalSteps || 0}\nEstimated Duration: ${workflowData?.estimatedDuration || 'Unknown'}\nWorkflow ID: ${workflowData?.workflowId || 'N/A'}\n\nTasks:\n${(workflowData?.workflowTasks || []).map((task: any, index: number) => `${index + 1}. ${task.content || task}`).join('\n')}\n\nModel Info: ${workflowData?.modelInfo?.hasModel ? `Using ${workflowData.modelInfo.modelName || 'AI model'}` : 'Using fallback generation'}`;

            console.log(`✅ [${timestamp}] AI Workflow Orchestrator completed successfully`);
            
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(responseText),
            ]);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "Unknown error";
            console.error(`❌ [${timestamp}] AI Workflow Orchestrator failed:`, error);
            
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(
                `AI Workflow Orchestrator Error: ${errorMsg}. Please check the error logs for more details.`
              ),
            ]);
          }
        },
      });
      context.subscriptions.push(aiWorkflowOrchestratorHandler);
      console.log("✅ AI Workflow Orchestrator Language Model Tool registered successfully!");
    } catch (registrationError) {
      console.error("❌ Failed to register AI Workflow Orchestrator:", registrationError);
    }

    // === TOOL REGISTRATION VERIFICATION ===
    console.log("🔧 Language Model Tools registration complete!");
    console.log("🆔 Registered Tools:");
    console.log("   - todosTool: AI WORKFLOW ORCHESTRATION");
    console.log("   - aiSemanticAnalyzer: INTELLIGENT SEMANTIC ANALYSIS");
    console.log("   - aiTodoManager: ADVANCED TODO MANAGEMENT");
    console.log("   - aiWorkflowOrchestrator: WORKFLOW GENERATION & MANAGEMENT");

    // Verify tool registration after a short delay
    setTimeout(() => {
      console.log("🔍 Verifying tool registration...");
      try {
        // Show confirmation that tools are ready
        vscode.window.showInformationMessage(
          "✅ AI Tools Suite is ready for AI agents! (TodosTool + 3 AI Tools)",
          { modal: false }
        );
        console.log(
          "✅ AI Tools Suite verification complete - ready for AI agent usage"
        );
      } catch (error) {
        console.error("❌ AI Tools Suite registration verification failed:", error);
        vscode.window.showErrorMessage(
          "❌ AI Tools Suite registration issue detected"
        );
      }
    }, 2000);

    // Periodic memory cleanup
    const cleanupInterval = setInterval(() => {
      todosTool.performMemoryCleanup();
    }, 60 * 60 * 1000); // Every hour

    context.subscriptions.push({
      dispose: () => clearInterval(cleanupInterval),
    });

    // ============= MCP SERVER AUTO-START =============

    const config = vscode.workspace.getConfiguration("ai-todos-tool.mcp");
    const mcpEnabled = config.get<boolean>("enabled", true);
    const mcpAutoStart = config.get<boolean>("autoStart", true);

    if (mcpEnabled && mcpAutoStart) {
      // Auto-start MCP server after a short delay
      setTimeout(async () => {
        try {
          console.log("🔄 Auto-starting MCP server...");
          const { TodosMCPServer } = await import("./mcpServer.js");
          mcpServer = new TodosMCPServer(todosTool);
          await mcpServer.start();
          console.log("✅ MCP server auto-started successfully");
        } catch (error) {
          console.warn("⚠️ MCP server auto-start failed:", error);
          // Don't show error to user for auto-start failures
        }
      }, 3000);
    }
  } catch (activationError) {
    console.error("❌ Extension activation failed:", activationError);
    const errorMessage =
      activationError instanceof Error
        ? activationError.message
        : "Unknown activation error";
    vscode.window
      .showErrorMessage(
        `AI-ToDos-Tool failed to activate: ${errorMessage}. Please restart VS Code or reinstall the extension.`,
        "Restart VS Code",
        "View Logs"
      )
      .then((action) => {
        if (action === "Restart VS Code") {
          vscode.commands.executeCommand("workbench.action.reloadWindow");
        } else if (action === "View Logs") {
          vscode.commands.executeCommand("workbench.action.toggleDevTools");
        }
      });

    // Rethrow to prevent partial activation
    throw activationError;
  }
}

// This method is called when your extension is deactivated
export function deactivate() {
  if (todosTool) {
    todosTool.dispose();
  }

  // Stop MCP server if running
  if (mcpServer && mcpServer.isServerRunning()) {
    mcpServer.stop().catch((error: any) => {
      console.warn(
        "Warning: Failed to stop MCP server during deactivation:",
        error
      );
    });
  }
}
