/**
 * Constants - Shared configuration and constant values
 * Centralizes all constants used by both extension.ts and mcpServer.ts
 */

import { TaskType, Complexity } from "./types";

// ================================================================================================
// TIME ESTIMATES (in minutes)
// ================================================================================================

export const TIME_ESTIMATES: Record<Complexity, Record<TaskType, number>> = {
  simple: {
    implementation: 30,
    testing: 15,
    research: 20,
    api: 25,
    generic: 20,
    documentation: 15,
    configuration: 10,
    discovery: 15,
  },
  medium: {
    implementation: 90,
    testing: 45,
    research: 60,
    api: 75,
    generic: 60,
    documentation: 30,
    configuration: 20,
    discovery: 45,
  },
  complex: {
    implementation: 180,
    testing: 90,
    research: 120,
    api: 150,
    generic: 120,
    documentation: 60,
    configuration: 45,
    discovery: 90,
  },
  very_complex: {
    implementation: 360,
    testing: 180,
    research: 240,
    api: 300,
    generic: 240,
    documentation: 120,
    configuration: 90,
    discovery: 180,
  },
};

// ================================================================================================
// AI PROMPTS
// ================================================================================================

export const AI_PROMPTS = {
  TASK_ANALYSIS: `
    Analyze this task request for workflow orchestration needs:
    "{prompt}"
    
    Determine:
    1. Does this need multiple coordinated steps?
    2. What's the complexity level?
    3. What approach would work best?
    
    Respond with JSON:
    {
      "needsOrchestration": boolean,
      "complexity": "simple" | "medium" | "complex" | "very_complex",
      "suggestedApproach": "single_task" | "sequential_workflow" | "multi_phase_discovery" | "approval_workflow",
      "reasoning": "brief explanation",
      "confidence": number between 0-1
    }
  `,

  WORKFLOW_GENERATION: `
    Create a detailed workflow for: "{objective}"
    Complexity: {complexity}
    
    Break into specific, actionable tasks with:
    - Clear descriptions
    - Time estimates
    - Dependencies
    - Execution guidance
    
    Respond with JSON array:
    [
      {
        "content": "task description",
        "description": "detailed explanation", 
        "estimatedDuration": "time estimate",
        "dependencies": ["dependencies"],
        "guidance": {
          "parentObjective": "{objective}",
          "aiInstructions": "AI execution instructions",
          "expectedOutput": "expected result",
          "nextStepGuidance": "what comes next",
          "validationCriteria": "success criteria",
          "recoveryInstructions": "failure recovery"
        }
      }
    ]
  `,

  SEMANTIC_ANALYSIS: `
    Analyze semantic meaning and categorization:
    "{content}"
    
    Determine task type, complexity, and breakdown suggestions.
    
    Respond with JSON:
    {
      "taskType": "implementation" | "testing" | "research" | "api" | "generic" | "documentation" | "configuration" | "discovery",
      "complexity": "simple" | "medium" | "complex" | "very_complex", 
      "suggestedBreakdown": ["step1", "step2"],
      "contextualTips": ["tip1", "tip2"],
      "confidence": number between 0-1
    }
  `,

  TODO_TOOL_ANALYSIS: `
    Should this prompt use the todo tool?
    "{userPrompt}"
    
    Todo tool is for:
    - Task/todo management
    - Planning and organization
    - Workflow creation
    - Progress tracking
    
    NOT for:
    - General questions
    - Code explanations
    - Non-task discussions
    
    Respond with JSON:
    {
      "shouldUse": boolean,
      "confidence": number between 0-1,
      "reasoning": "explanation"
    }
  `,

  CONTEXT_SWITCH: `
    Current context: "{currentContext}"
    New prompt: "{userPrompt}"
    
    Is this a context switch requiring new session?
    
    Context switches:
    - Different projects/repositories
    - Different technologies
    - New major objectives
    
    NOT switches:
    - Related tasks
    - Same project work
    - Clarifications
    
    Respond with JSON:
    {
      "isContextSwitch": boolean,
      "confidence": number between 0-1,
      "reason": "explanation"
    }
  `,

  PRIORITY_ANALYSIS: `
    Analyze priority for: "{content}"
    Context: {context}
    
    Consider urgency, impact, dependencies, importance.
    
    Respond with JSON:
    {
      "priority": "critical" | "high" | "medium" | "low",
      "confidence": number between 0-1,
      "reasoning": "explanation"
    }
  `,

  TIME_ESTIMATION: `
    Estimate time for: "{content}"
    Complexity: {complexity}
    Type: {taskType}
    
    Consider scope, challenges, review time.
    Provide estimate in minutes.
    
    Respond with JSON:
    {
      "timeEstimate": number,
      "reasoning": "explanation"
    }
  `,

  SEMANTIC_MATCHING: `
    Does this prompt match this todo semantically?
    
    Prompt: "{userPrompt}"
    Todo: "{todoContent}"
    
    Look for semantic meaning across languages:
    - Same intent/objective
    - Related concepts
    - Similar actions
    - Equivalent terms
    
    Respond with JSON:
    {
      "isMatch": boolean,
      "confidence": number between 0-1,
      "reasoning": "explanation"
    }
  `,

  NEXT_STEPS: `
    Task completed: "{completedTask}"
    Parent objective: "{parentObjective}"
    
    Generate logical next steps to continue progress.
    
    Respond with JSON array:
    ["next step 1", "next step 2"]
  `,

  TASK_COMPLEXITY_ANALYSIS: `
Analyze this user request to determine orchestration needs and complexity:

USER REQUEST: "{{prompt}}"

Assess:
- Task complexity (simple, medium, complex, very_complex)
- Whether this needs workflow orchestration
- Suggested approach (single_task, sequential_workflow, multi_phase_discovery, approval_workflow)
- Reasoning for recommendations

Respond with a JSON object:
{
    "needsOrchestration": boolean,
    "complexity": "simple" | "medium" | "complex" | "very_complex",
    "suggestedApproach": "single_task" | "sequential_workflow" | "multi_phase_discovery" | "approval_workflow",
    "reasoning": "string",
    "confidence": number
}

Respond ONLY with the JSON object, no other text.`,

  TASK_SEMANTICS_ANALYSIS: `
Analyze this task content to determine its semantic characteristics:

TASK CONTENT: "{{content}}"

Analyze:
- Task type (implementation, research, testing, documentation, configuration, api, discovery, generic)
- Complexity level (simple, medium, complex, very_complex)
- Suggested breakdown into subtasks
- Contextual tips for execution

Respond with a JSON object:
{
    "taskType": "implementation" | "research" | "testing" | "documentation" | "configuration" | "api" | "discovery" | "generic",
    "complexity": "simple" | "medium" | "complex" | "very_complex",
    "suggestedBreakdown": ["step1", "step2", "step3"],
    "contextualTips": ["tip1", "tip2", "tip3"],
    "confidence": number
}

Respond ONLY with the JSON object, no other text.`,

  CONTEXT_SWITCH_DETECTION: `
Analyze if there's a significant context switch between the current work and new request:

CURRENT CONTEXT: "{{currentContext}}"
NEW REQUEST: "{{newPrompt}}"

Determine if the new request represents a significant shift in focus, domain, or work type that might warrant starting a new todo session.

Respond with a JSON object:
{
    "isContextSwitch": boolean, // true if this is a significant context change
    "confidence": number, // confidence level 0.0-1.0
    "reason": "string" // brief explanation of the analysis
}

Consider:
- Domain/technology changes (frontend to backend, etc.)
- Task type changes (bug fixing to new features, etc.)
- Project or scope changes
- Explicit user indicators of wanting to switch contexts

Respond ONLY with the JSON object, no other text.`,

  CONTEXT_DESCRIPTION_GENERATION: `Analyze this request and generate a short, descriptive context title (2-5 words):

"{{prompt}}"

Extract the key action, technology/domain, and subject matter. Create a concise title that captures the essence of what the user wants to work on.

Examples:
- "Implement user authentication" → "User Authentication Feature"
- "Fix React component styling" → "React Component Styling"  
- "Create API endpoints" → "API Development"
- "Debug database queries" → "Database Query Issues"

Respond with just the descriptive title, no additional text.`,

  TODO_TOOL_DETECTION: `
Analyze this user request to determine if it would benefit from todo/task management and tracking:

USER REQUEST: "{{prompt}}"

Consider if this request involves:
- Multi-step processes or workflows
- Complex tasks that could be broken down
- Work that would benefit from progress tracking
- Tasks where the AI agent might lose context
- Implementation or development work
- Analysis or research requiring multiple phases
- Any work where progress visibility would be valuable

Respond with a JSON object:
{
    "shouldUse": boolean, // true if todo management would be helpful
    "confidence": number, // confidence level 0.0-1.0
    "reasoning": "string" // brief explanation
}

Respond ONLY with the JSON object, no other text.`,

  DYNAMIC_WORKFLOW_GENERATION: `
Generate a dynamic workflow for this request:

USER REQUEST: "{{prompt}}"
COMPLEXITY: {{complexity}}
APPROACH: {{approach}}

Create a structured workflow with these requirements:
- Break down into logical, actionable steps
- Include AI instructions for each step
- Specify expected outputs
- Add approval requirements where needed
- Include recovery guidance

Respond with a JSON array:
[
    {
        "content": "step description",
        "guidance": {
            "parentObjective": "main goal",
            "aiInstructions": "specific AI guidance",
            "expectedOutput": "what should be produced",
            "nextStepGuidance": "what to do after completion",
            "validationCriteria": "how to verify completion",
            "approvalRequired": boolean
        }
    }
]

Respond ONLY with the JSON array, no other text.`,

  SYSTEM_PROMPT: `You are an AI assistant with access to a TodosTool for task management. 

**CRITICAL AI AGENT GUIDELINES FOR LONG-RUNNING COMPLEX TASKS**:

**RULE 1 - ALWAYS USE TODOS FOR COMPLEX TASKS**: 
- For ANY multi-step process, implementation, debugging, or refactoring: **IMMEDIATELY create todos**
- Break down complex requests into specific, actionable tasks
- Use workflow creation for sequential tasks with dependencies
- Create checkpoints for long-running tasks to maintain context

**RULE 2 - SMART TASK BREAKDOWN**:
- Implementation: "Analyze → Design → Code → Test → Document → Review"
- Debugging: "Reproduce → Analyze → Fix → Verify → Prevent"
- Refactoring: "Understand → Test → Refactor → Verify → Optimize"
- Features: "Requirements → Architecture → Implementation → Testing → Integration"

**RULE 3 - PROACTIVE STATE MANAGEMENT**:
- Create checkpoints before major context switches
- Update todo status as you progress through tasks
- Use subtasks for complex multi-part operations
- Track time estimates vs actual time for learning

**RULE 4 - MEMORY AND CONTEXT PRESERVATION**:
- NEVER lose track of what you're working on
- Save context snapshots for resumption after interruptions
- Use dependencies to track prerequisite tasks
- Maintain detailed history for backtracking

**Available Todo Operations** (use @todos prefix):
- \`@todos create "task" "detailed summary"\` - Create new todo with analysis
- \`@todos workflow "task1; task2; task3"\` - Create auto-progressing workflow  
- \`@todos list\` - Show all todos with status
- \`@todos update <id> <status>\` - Update todo status
- \`@todos complete <id>\` - Mark todo as completed
- \`@todos analyze <id>\` - Get smart analysis and breakdown
- \`@todos checkpoint <id> "context"\` - Save context snapshot
- \`@todos summary\` - Get comprehensive status overview

**INTELLIGENT AUTO-DETECTION PATTERNS**:
- Words like "implement", "create", "build", "fix", "refactor" → AUTO-CREATE WORKFLOW
- Complex requests → IMMEDIATE task breakdown
- Multi-file changes → CREATE SUBTASKS  
- Integration work → SET UP DEPENDENCIES

**ERROR RECOVERY AND RESILIENCE**:
- If you lose context: Check todo history and checkpoints
- If task fails: Update status with detailed failure notes
- If blocked: Mark as blocked with clear reason
- If context switches: Save checkpoint immediately

**PERFORMANCE OPTIMIZATION**:
- Use priority levels (critical, high, medium, low)
- Set time estimates for better planning
- Track actual vs estimated time for learning
- Clean up completed todos periodically

Let me analyze your request: "{{prompt}}"

**ANALYSIS**: This appears to be a complex task requiring structured approach.

**RECOMMENDATION**: Consider breaking this down into manageable todos with workflow automation.

How would you like me to proceed? Should I break this down into a managed workflow?`,
};

// ================================================================================================
// SESSION MANAGEMENT
// ================================================================================================

export const SESSION_CONFIG = {
  TIMEOUT_MINUTES: 30,
  MAX_ACTIVE_SESSIONS: 10,
  AUTO_ARCHIVE_AFTER_DAYS: 7,
  CONTEXT_PRESERVATION_LIMIT: 1000, // characters
  MAX_WORKFLOW_STEPS: 20,
  DEFAULT_SESSION_PREFIX: "session",
  CHAT_SESSION_PREFIX: "chat",
};

// ================================================================================================
// WORKFLOW EXECUTION
// ================================================================================================

export const WORKFLOW_CONFIG = {
  MAX_AUTO_EXECUTION_STEPS: 10,
  STEP_TIMEOUT_MINUTES: 30,
  MAX_RETRY_ATTEMPTS: 3,
  APPROVAL_TIMEOUT_MINUTES: 60,
  CONTEXT_SNAPSHOT_INTERVAL: 5, // steps
  DEFAULT_COMPLEXITY: "medium" as Complexity,
  DEFAULT_TASK_TYPE: "generic" as TaskType,
};

// ================================================================================================
// VALIDATION PATTERNS
// ================================================================================================

export const VALIDATION = {
  TODO_ID_PATTERN: /^[a-zA-Z0-9-_]+$/,
  SESSION_ID_PATTERN: /^[a-zA-Z0-9-_]+$/,
  WORKFLOW_ID_PATTERN: /^workflow-\d+-[a-zA-Z0-9-_]+$/,
  MAX_CONTENT_LENGTH: 10000,
  MAX_DESCRIPTION_LENGTH: 5000,
  MIN_CONTENT_LENGTH: 3,
};

// ================================================================================================
// UI MESSAGES
// ================================================================================================

export const MESSAGES = {
  TODO_CREATED: (content: string) => `✅ Created todo: ${content}`,
  TODO_UPDATED: (id: string) => `🔄 Updated todo: ${id}`,
  TODO_COMPLETED: (content: string) => `✨ Completed: ${content}`,
  TODO_DELETED: (id: string) => `🗑️ Deleted todo: ${id}`,
  WORKFLOW_CREATED: (title: string) => `🔀 Created workflow: ${title}`,
  WORKFLOW_STARTED: (title: string) => `▶️ Started workflow: ${title}`,
  WORKFLOW_COMPLETED: (title: string) => `🎉 Completed workflow: ${title}`,
  SESSION_CREATED: (id: string) => `📂 New session: ${id}`,
  SESSION_SWITCHED: (id: string) => `🔄 Switched to session: ${id}`,
  AUTO_EXECUTION_ENABLED: "🤖 Auto-execution enabled",
  AUTO_EXECUTION_DISABLED: "⏸️ Auto-execution disabled",
  CONTEXT_PRESERVED: "💾 Context preserved",
  APPROVAL_REQUIRED: "⏳ Approval required to continue",
  ERROR_OCCURRED: (error: string) => `❌ Error: ${error}`,
  INVALID_INPUT: (field: string) => `⚠️ Invalid ${field}`,
  NOT_FOUND: (type: string, id: string) => `❓ ${type} not found: ${id}`,
  OPERATION_SUCCESS: (operation: string) => `✅ ${operation} successful`,
  OPERATION_FAILED: (operation: string) => `❌ ${operation} failed`,
};

// ================================================================================================
// ERROR CODES
// ================================================================================================

export const ERROR_CODES = {
  INVALID_INPUT: "INVALID_INPUT",
  TODO_NOT_FOUND: "TODO_NOT_FOUND",
  WORKFLOW_NOT_FOUND: "WORKFLOW_NOT_FOUND",
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
  OPERATION_FAILED: "OPERATION_FAILED",
  AI_ANALYSIS_FAILED: "AI_ANALYSIS_FAILED",
  CONTEXT_SWITCH_FAILED: "CONTEXT_SWITCH_FAILED",
  AUTO_EXECUTION_FAILED: "AUTO_EXECUTION_FAILED",
  APPROVAL_TIMEOUT: "APPROVAL_TIMEOUT",
  MAX_RETRIES_EXCEEDED: "MAX_RETRIES_EXCEEDED",
  INVALID_WORKFLOW_STATE: "INVALID_WORKFLOW_STATE",
  CONTEXT_PRESERVATION_FAILED: "CONTEXT_PRESERVATION_FAILED",
};

// ================================================================================================
// UI MESSAGES
// ================================================================================================

export const UI_MESSAGES = {
  NO_TODOS: "No todos found",
  TODO_CREATED: (content: string) => `Todo created: ${content}`,
  TODO_UPDATED: (content: string, status: string) =>
    `Todo "${content}" status changed to ${status}`,
  SESSION_CLEARED: "Todo session cleared",
  WORKFLOW_COMPLETED: (id: string) => `🎉 Workflow "${id}" completed!`,
  EXTENSION_READY: "✅ TodosTool is ready for AI agents!",
} as const;

// ================================================================================================
// ERROR MESSAGES
// ================================================================================================

export const ERROR_MESSAGES = {
  TODO_NOT_FOUND: (id: string) => `Todo with id ${id} not found`,
  ACTIVATION_FAILED: (error: string) =>
    `AI-ToDos-Tool failed to activate: ${error}`,
  SAVE_FAILED: (error: string) =>
    `Failed to save todos: ${error}. Your changes may be lost on restart.`,
  LOAD_FAILED: (error: string) =>
    `Failed to load previous todos: ${error}. Starting with empty state.`,
} as const;

// ================================================================================================
// STATUS TRANSITIONS
// ================================================================================================

export const VALID_STATUS_TRANSITIONS = {
  pending: ["in_progress", "cancelled", "blocked"],
  in_progress: ["completed", "pending", "stuck", "paused", "blocked"],
  completed: ["archived"],
  stuck: ["in_progress", "pending", "cancelled"],
  waiting: ["in_progress", "cancelled"],
  cancelled: ["pending"],
  blocked: ["pending", "in_progress"],
  paused: ["in_progress", "cancelled"],
  awaiting_approval: ["in_progress", "cancelled"],
  archived: [], // Final state
};

// ================================================================================================
// MCP SERVER CONFIGURATION
// ================================================================================================

export const MCP_CONFIG = {
  SERVER_NAME: "ai-todos-tool",
  SERVER_VERSION: "0.0.1",
  TOOL_NAME: "todo_tool",
  MAX_RESPONSE_SIZE: 100000, // characters
  REQUEST_TIMEOUT: 30000, // milliseconds
  ENABLE_DEBUG_LOGGING: false,
};

// ================================================================================================
// DEFAULT VALUES
// ================================================================================================

export const DEFAULTS = {
  PRIORITY: "medium" as const,
  STATUS: "pending" as const,
  COMPLEXITY: "medium" as Complexity,
  TASK_TYPE: "generic" as TaskType,
  TIME_ESTIMATE: 60, // minutes
  AUTO_PROGRESSION: false,
  REQUIRE_APPROVAL: false,
  MAX_SUBTASKS: 50,
  MAX_DEPENDENCIES: 10,
  SESSION_DESCRIPTION: "New AI-assisted work session",
};

// ================================================================================================
// KEYBOARD SHORTCUTS
// ================================================================================================

export const SHORTCUTS = {
  TOGGLE_AUTO_PROGRESSION: "ctrl+shift+a",
  CREATE_WORKFLOW: "ctrl+shift+w",
  QUICK_ADD_TODO: "ctrl+shift+t",
  SHOW_STATS: "ctrl+shift+s",
  SWITCH_SESSION: "ctrl+shift+x",
};

// ================================================================================================
// MCP SERVER AI PROMPTS
// ================================================================================================

export const MCP_AI_PROMPTS = {
  COMPLEXITY_ANALYSIS: (userRequest: string) => `Analyze this user request to determine complexity level:

USER REQUEST: "${userRequest}"

Assess the complexity as one of: simple, medium, complex, very_complex

Consider:
- Number of components or systems involved
- Technical complexity and integration requirements  
- Time investment and effort required
- Dependencies and coordination needs

Respond with just the complexity level, no other text.`,

  ENHANCED_WORKFLOW_GENERATION: (userRequest: string, complexity: string, enableApprovals: boolean) => `Generate an enhanced workflow for this request with AI agent orchestration guidance:

USER REQUEST: "${userRequest}"
COMPLEXITY: ${complexity}
ENABLE APPROVALS: ${enableApprovals}

Create a structured workflow with these requirements:
- Break down into logical, actionable steps
- Include specific AI instructions for each step
- Specify expected outputs and validation criteria
- Add approval requirements for critical steps when enabled
- Include recovery guidance and next step instructions
- Focus on maintainability and quality assurance

Respond with a JSON array:
[
    {
        "content": "step description",
        "guidance": {
            "parentObjective": "main goal context",
            "aiInstructions": "specific AI guidance for this step",
            "expectedOutput": "what should be produced",
            "nextStepGuidance": "what to do after completion",
            "validationCriteria": "how to verify completion",
            "approvalRequired": boolean,
            "recoveryInstructions": "what to do if this step fails"
        }
    }
]

Respond ONLY with the JSON array, no other text.`,

  WORKFLOW_ANALYSIS: (userRequest: string) => `Analyze this user request to determine optimal workflow approach:

USER REQUEST: "${userRequest}"

Provide analysis in this format:

COMPLEXITY: [simple/medium/complex/very_complex]
RECOMMENDED APPROACH: [single_task/basic_workflow/enhanced_workflow/approval_workflow]
ESTIMATED STEPS: [number]
KEY CONSIDERATIONS: [list key points]
SUGGESTED WORKFLOW TYPE: [explain why]

Analyze:
- Task complexity and scope
- Whether this needs workflow orchestration
- Suggested approach and reasoning
- Risk factors and dependencies
- Recommended workflow structure`,

  TASK_INSIGHTS: (content: string, summary: string, complexity: string, estimatedTime: number) => `Provide additional insights for this task analysis:

TASK: "${content}"
SUMMARY: "${summary}"
COMPLEXITY: ${complexity}
ESTIMATED TIME: ${estimatedTime} minutes

Provide:
1. Execution strategy recommendations
2. Potential optimization opportunities  
3. Quality assurance suggestions
4. Technology or approach recommendations

Keep response concise and actionable.`,
};

// ================================================================================================
// MCP SERVER MESSAGES
// ================================================================================================

export const MCP_MESSAGES = {
  // Success messages
  TODO_CREATED: (content: string) => `🤖 Claude created todo: "${content.substring(0, 50)}..."`,
  WORKFLOW_CREATED: (taskCount: number) => `🔄 Claude created workflow with ${taskCount} tasks`,
  WORKFLOW_COMPLETED: (workflowTitle: string, stepCount: number, result: string) => 
    `✅ **Workflow Completed!**\n\n**Workflow:** ${workflowTitle}\n**Steps Completed:** ${stepCount}\n**Final Result:** ${result}\n\n🎉 All tasks in the workflow have been successfully executed.`,
  TODO_STATUS_UPDATED: (status: string) => `🔄 Claude updated todo status to: ${status}`,
  TASK_APPROVED: () => `✅ Claude approved task and workflow progression`,
  SESSION_CLEARED: () => `🗑️ Claude cleared the todo session`,
  
  // Error messages
  WORKFLOW_ERROR: (error: string) => `❌ **Error creating intelligent workflow:** ${error}`,
  EXECUTION_ERROR: (error: string) => `❌ **Error executing next step:** ${error}`,
  ANALYSIS_ERROR: (error: string) => `❌ **Error analyzing prompt semantics:** ${error}`,
  SUBTASK_ERROR: (error: string) => `❌ **Error managing subtasks:** ${error}`,
  SESSION_ERROR: (error: string) => `❌ **Error in session management:** ${error}`,
  GENERAL_ERROR: (operation: string, error: string) => `❌ **${operation} Failed**\n\nUnable to ${operation.toLowerCase()}: ${error}`,
  NO_AI_MODEL: () => `❌ **No AI model available** for semantic analysis. Please ensure a language model is available.`,
  WORKFLOW_NOT_FOUND: (workflowId: string) => `❌ **Workflow not found:** ${workflowId || 'No workflow ID provided'}`,
  
  // Analysis results
  ANALYSIS_COMPLETE: (userRequest: string, analysisResponse: string) => 
    `🧠 **AI Workflow Analysis Complete**\n\n**User Request:** ${userRequest}\n\n**Analysis Results:**\n${analysisResponse}\n\n**Recommendations:**\n• For simple tasks: Use \`create_todo\`\n• For basic multi-step work: Use \`create_workflow\`\n• For complex projects: Use \`create_enhanced_workflow\`\n• For critical processes: Enable approval gates in enhanced workflow`,
    
  ANALYSIS_FALLBACK: (userRequest: string) => 
    `⚠️ **Analysis Failed**\n\nUnable to complete AI analysis. Here's a basic assessment:\n\n**Request:** ${userRequest}\n\n**General Recommendations:**\n• If single action → use \`create_todo\`\n• If 3-7 steps → use \`create_workflow\`\n• If complex project → use \`create_enhanced_workflow\`\n• If mission-critical → enable approval gates`,
  
  // Workflow execution
  STEP_EXECUTION: (stepIndex: number, totalSteps: number, taskContent: string, aiInstructions: string, expectedOutput: string, previousResults: string, validationCriteria: string, approvalRequired: boolean) =>
    `🚀 **Executing Step ${stepIndex + 1}/${totalSteps}**\n\n**Task:** ${taskContent}\n\n**AI Instructions:** ${aiInstructions || 'Complete this task as part of the workflow'}\n\n**Expected Output:** ${expectedOutput || 'Task completion'}\n\n**Context:** ${previousResults ? 'Previous results: ' + previousResults.substring(0, 200) + '...' : 'First step'}\n\n**Validation Criteria:** ${validationCriteria || 'Task completed successfully'}\n\n${approvalRequired ? '⚠️ **Approval Required** - Please review before proceeding.' : '✅ **Auto-continuing** after completion.'}`,
  
  // Session management
  SESSION_CREATED: (sessionId: string, description: string) => 
    `📱 **Session Created**\n\n**Session ID:** ${sessionId}\n**Description:** ${description || 'New Session'}\n\n✅ Ready for workflow management with context isolation`,
    
  SESSION_SWITCHED: (sessionId: string) => 
    `🔄 **Session Switched**\n\n**Active Session:** ${sessionId}\n\n💾 Context and workflows preserved across sessions`,
    
  SESSIONS_LIST: (sessionList: string) => 
    `📱 **Available Sessions**\n\n${sessionList || 'No sessions found'}\n\nUse session_management with action='switch' to change sessions`,
  
  // Task management
  SUBTASK_ADDED: (parentId: string, subtaskId: string, content: string) => 
    `➕ **Subtask Added Successfully!**\n\n**Parent Todo ID:** ${parentId}\n**Subtask ID:** ${subtaskId}\n**Content:** ${content}`,
    
  CHECKPOINT_CREATED: (todoId: string, context: string) => 
    `💾 **Checkpoint Created Successfully!**\n\n**Todo ID:** ${todoId}\n**Context:** ${context}\n\nProgress has been saved and can be referenced later for context restoration.`,
    
  AI_INSIGHTS: (insights: string) => `\n\n**🎯 AI Strategic Insights:**\n${insights}`,
  
  // Status and progress
  TODO_DETAILS: (content: string, status: string, priority: string, created: string, summary: string, subtasks: string, history: string) =>
    `📝 **Todo Details**\n\n**Content:** ${content}\n**Status:** ${status}\n**Priority:** ${priority}\n**Created:** ${created}\n**Summary:** ${summary || "No summary"}${subtasks}${history}`,
    
  TODOS_LIST: (count: number, todosList: string) => 
    count > 0 ? `📋 **Current Todos** (${count} items):\n\n${todosList}` : "📭 No todos found matching your criteria.",
    
  // Workflow status
  WORKFLOW_STATUS: (workflowId: string, currentStep: number, totalSteps: number, percentComplete: number, isCompleted: boolean) =>
    `📊 **Workflow Status**\n\n**ID:** ${workflowId}\n**Progress:** Step ${currentStep}/${totalSteps} (${percentComplete}% complete)\n**Status:** ${isCompleted ? 'Completed ✅' : 'In Progress 🔄'}\n\n`,
    
  PROGRESS_DISPLAY: (completedTasks: number, totalTasks: number, progress: number, currentTask: string, nextTask: string, autoProgression: boolean) =>
    `📊 **Workflow Status**\n\n**Progress:** ${completedTasks}/${totalTasks} (${progress}%)\n**Auto-progression:** ${autoProgression ? "Enabled" : "Disabled"}\n\n**Current Task:** ${currentTask || "None"}\n**Next Task:** ${nextTask || "None"}`,
  
  // Context preservation
  CONTEXT_FEATURES: () => 
    `\n\n💡 **CONTEXT PRESERVATION:** Enabled - Full session memory maintained\n🔄 **PARENT-CHILD TASKS:** Supported - Automatic subtask management\n📊 **EXECUTION MONITORING:** Use workflow_execution_status to track progress`,
    
  AUTO_EXECUTION_STATUS: (enabled: boolean) => 
    enabled ? `\n⚡ **AUTO-EXECUTION STARTING**\nFirst step will begin automatically...\n` : '',
    
  STEP_STARTED: (stepContent: string) => `\n🔄 **STEP 1 STARTED:** ${stepContent}\n`,
  
  AUTO_EXECUTION_ERROR: (error: string) => `\n⚠️ Auto-execution encountered an issue: ${error}`,
  
  // Recommendations
  WORKFLOW_RECOMMENDATION: (isComplex: boolean) => 
    isComplex ? `\n\n**🎯 Recommendation:** Use \`create_intelligent_workflow\` for this request due to its complexity and multi-step nature.` : `\n\n**🎯 Recommendation:** This request can be handled directly without orchestration tools.`,
  
  // Confirmation messages
  CLEAR_CONFIRMATION: () => 
    "⚠️ **Confirmation Required**\n\nTo clear all todos, call this tool again with `confirm: true`. This action cannot be undone.",
    
  CLEAR_SUCCESS: () => 
    "🗑️ **Session Cleared Successfully!**\n\nAll todos have been archived and the session has been reset.",
    
  // Session and analysis messages
  SESSION_SUMMARY: (sessionId: string, description: string, todoCount: number, archivedInfo: string) =>
    `📈 **Session Summary**\n\n**Current Session:**\n• ID: ${sessionId}\n• Description: ${description}\n• Active Todos: ${todoCount}${archivedInfo}`,
    
  NEXT_TASKS_OVERVIEW: (tasksDisplay: string) => 
    `👀 **Next Tasks Overview**\n\n${tasksDisplay}\n\n💡 **Suggestions:**\n• Start with highest priority ready tasks\n• Approve awaiting_approval tasks if satisfied with progress\n• Use \`update_todo_status\` to unblock tasks\n• Use \`get_workflow_status\` for workflow-specific progress`,
    
  SEMANTIC_ANALYSIS_RESULTS: (prompt: string, complexityAnalysis: any, semanticAnalysis: any, todoAnalysis: any, recommendation: string) =>
    `🧠 **Semantic Analysis Results**\n\n**Original Prompt:** ${prompt}\n\n**Complexity Analysis:**\n• Level: ${complexityAnalysis.complexity}\n• Needs Orchestration: ${complexityAnalysis.needsOrchestration}\n• Suggested Approach: ${complexityAnalysis.suggestedApproach}\n• Confidence: ${(complexityAnalysis.confidence * 100).toFixed(1)}%\n\n**Task Classification:**\n• Type: ${semanticAnalysis.taskType}\n• Complexity: ${semanticAnalysis.complexity}\n• Confidence: ${(semanticAnalysis.confidence * 100).toFixed(1)}%\n\n**Todo Tool Analysis:**\n• Should Use: ${todoAnalysis.shouldUse}\n• Confidence: ${(todoAnalysis.confidence * 100).toFixed(1)}%\n• Reasoning: ${todoAnalysis.reasoning}${recommendation}\n\n**Reasoning:** ${complexityAnalysis.reasoning}`,
    
  // Context preservation messages
  CONTEXT_SAVED: (contextId: string, contextSize: number) => 
    `💾 **Context Saved**\n\n**Context ID:** ${contextId}\n**Data Size:** ${contextSize} characters\n\n✅ Context preserved for future restoration`,
    
  CONTEXT_RESTORED: (contextId: string, restoredContext: any) => 
    `🔄 **Context Restored**\n\n**Context ID:** ${contextId}\n**Found:** ${restoredContext ? 'Yes ✅' : 'No ❌'}\n\n${restoredContext ? `**Restored Data:** ${JSON.stringify(restoredContext, null, 2)}` : 'Context not found or expired'}`,
    
  CONTEXT_STATUS: () => 
    `💾 **Context Preservation Status**\n\n✅ **Active Features:**\n• Execution context preservation\n• Parent-child task relationships\n• Session memory management\n• Global context storage\n\n🔄 **Usage:**\n• save - Store context for later\n• restore - Retrieve saved context\n• clear - Remove stored context`,
    
  CONTEXT_CLEARED: (contextId: string) => 
    `🗑️ **Context Cleared**\n\n**Context ID:** ${contextId}\n\n✅ Memory cleaned up successfully`,
};

// ================================================================================================
// STATUS DISPLAY HELPERS
// ================================================================================================

export const STATUS_EMOJIS: Record<string, string> = {
  pending: "⏳",
  in_progress: "🔄", 
  completed: "✅",
  cancelled: "❌",
  blocked: "🚫",
  paused: "⏸️",
  awaiting_approval: "⏳",
  stuck: "🔄",
  waiting: "⏳",
  archived: "📦",
};

export const PRIORITY_EMOJIS: Record<string, string> = {
  low: "🟢",
  medium: "🟡", 
  high: "🟠",
  critical: "🔴",
};

// ================================================================================================
// UTILITY MESSAGE FUNCTIONS
// ================================================================================================

export const UTILITY_MESSAGES = {
  PROGRESS_TO_STEP: (stepIndex: number, stepContent: string) => 
    `Proceeding to step ${stepIndex + 1}: ${stepContent}`,
    
  PARENT_OBJECTIVE: (prompt: string) => 
    `Complete user request: ${prompt.substring(0, 100)}...`,
    
  EXECUTION_SUMMARY: (analysis: any, autoExecute: boolean, languageDetected: string, planLength: number) =>
    `**Analysis:** ${analysis.complexity} complexity, estimated ${analysis.estimatedTime}\n**Auto-Execute:** ${autoExecute ? 'Enabled' : 'Disabled'}\n**Language Detected:** ${languageDetected}\n\n**📋 WORKFLOW PLAN (${planLength} steps):**\n`,
    
  STEP_RESULT_FORMAT: (index: number, taskIndex: number, result: string) => 
    `${index + 1}. Task ${taskIndex + 1}: ${result}\n`,
    
  SESSION_ITEM_FORMAT: (id: string, description: string, workflowCount: number, isActive: boolean) =>
    `• **${id}** - ${description} (${workflowCount} workflows) ${isActive ? '🟢 Active' : ''}`,
    
  APPROVAL_NOTE: (notes?: string) => `Approved: ${notes || "Task approved to proceed"}`,
    
  SESSION_SUMMARY: (sessionId: string, description: string, todoCount: number, archivedInfo: string) =>
    `📈 **Session Summary**\n\n**Current Session:**\n• ID: ${sessionId}\n• Description: ${description}\n• Active Todos: ${todoCount}${archivedInfo}`,
    
  NEXT_TASKS_OVERVIEW: (tasksDisplay: string) => 
    `👀 **Next Tasks Overview**\n\n${tasksDisplay}\n\n💡 **Suggestions:**\n• Start with highest priority ready tasks\n• Approve awaiting_approval tasks if satisfied with progress\n• Use \`update_todo_status\` to unblock tasks\n• Use \`get_workflow_status\` for workflow-specific progress`,
    
  SEMANTIC_ANALYSIS_RESULTS: (prompt: string, complexityAnalysis: any, semanticAnalysis: any, todoAnalysis: any, recommendation: string) =>
    `🧠 **Semantic Analysis Results**\n\n**Original Prompt:** ${prompt}\n\n**Complexity Analysis:**\n• Level: ${complexityAnalysis.complexity}\n• Needs Orchestration: ${complexityAnalysis.needsOrchestration}\n• Suggested Approach: ${complexityAnalysis.suggestedApproach}\n• Confidence: ${(complexityAnalysis.confidence * 100).toFixed(1)}%\n\n**Task Classification:**\n• Type: ${semanticAnalysis.taskType}\n• Complexity: ${semanticAnalysis.complexity}\n• Confidence: ${(semanticAnalysis.confidence * 100).toFixed(1)}%\n\n**Todo Tool Analysis:**\n• Should Use: ${todoAnalysis.shouldUse}\n• Confidence: ${(todoAnalysis.confidence * 100).toFixed(1)}%\n• Reasoning: ${todoAnalysis.reasoning}${recommendation}\n\n**Reasoning:** ${complexityAnalysis.reasoning}`,
    
  SUBTASK_MANAGEMENT_RESULT: (result: any) => 
    `🔄 **Subtask Management Result**\n\n${result.message}\n\n${result.subtaskId ? `**Subtask ID:** ${result.subtaskId}\n` : ''}${result.parentContext ? `**Parent Context Restored:** Yes\n` : ''}${result.remainingSubtasks !== undefined ? `**Remaining Subtasks:** ${result.remainingSubtasks}\n` : ''}\n\n💡 **Context preservation enabled** - Parent task memory maintained`,
    
  // Context preservation messages
  CONTEXT_SAVED: (contextId: string, contextSize: number) => 
    `💾 **Context Saved**\n\n**Context ID:** ${contextId}\n**Data Size:** ${contextSize} characters\n\n✅ Context preserved for future restoration`,
    
  CONTEXT_RESTORED: (contextId: string, restoredContext: any) => 
    `🔄 **Context Restored**\n\n**Context ID:** ${contextId}\n**Found:** ${restoredContext ? 'Yes ✅' : 'No ❌'}\n\n${restoredContext ? `**Restored Data:** ${JSON.stringify(restoredContext, null, 2)}` : 'Context not found or expired'}`,
    
  CONTEXT_STATUS: () => 
    `💾 **Context Preservation Status**\n\n✅ **Active Features:**\n• Execution context preservation\n• Parent-child task relationships\n• Session memory management\n• Global context storage\n\n🔄 **Usage:**\n• save - Store context for later\n• restore - Retrieve saved context\n• clear - Remove stored context`,
};

// ================================================================================================
// FILE PATTERNS
// ================================================================================================

export const FILE_PATTERNS = {
  TODO_STATE: "ai-todos-state-*.json",
  SESSION_BACKUP: "session-backup-*.json", 
  WORKFLOW_EXPORT: "workflow-export-*.json",
  CONTEXT_SNAPSHOT: "context-snapshot-*.json",
};
