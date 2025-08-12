/**
 * Base Manager - Common base class for shared manager functionality
 * Provides common patterns used by both extension.ts and mcpServer.ts managers
 */

import {
  Todo,
  TodoItem,
  TodoState,
  MultiSessionState,
  SessionContext,
  SessionMetadata,
  Status,
  Priority} from './types';
import { DEFAULTS, SESSION_CONFIG, VALIDATION, ERROR_CODES } from './constants';
import { IDGenerator } from './aiUtils';

// ================================================================================================
// ENHANCED BASE VALIDATION UTILITIES
// ================================================================================================

export abstract class BaseValidator {
  // ID Validation Methods
  static validateTodoId(id: string): boolean {
    // Enhanced pattern to support both old and new ID formats
    const patterns = [
      VALIDATION.TODO_ID_PATTERN,  // Original pattern
      /^todo-\d+-[a-z0-9]{9}$/     // New IDGenerator pattern
    ];
    return patterns.some(pattern => pattern.test(id));
  }

  static validateSessionId(id: string): boolean {
    // Enhanced pattern to support both old and new ID formats
    const patterns = [
      VALIDATION.SESSION_ID_PATTERN, // Original pattern
      /^session_\d+_[a-z0-9]{9}$/    // IDGenerator pattern
    ];
    return patterns.some(pattern => pattern.test(id));
  }

  static validateWorkflowId(id: string): boolean {
    // Support workflow ID patterns
    const patterns = [
      /^workflow-\d+-[a-z0-9]{9}$/,  // IDGenerator pattern
      /^wf-\d+-[a-z0-9]{9}$/         // Short prefix pattern
    ];
    return patterns.some(pattern => pattern.test(id));
  }

  // Content Validation Methods
  static validateContent(content: string): { isValid: boolean; error?: string } {
    if (!content || content.trim().length < VALIDATION.MIN_CONTENT_LENGTH) {
      return { isValid: false, error: 'Content must be at least 3 characters' };
    }
    if (content.length > VALIDATION.MAX_CONTENT_LENGTH) {
      return { isValid: false, error: 'Content exceeds maximum length' };
    }
    return { isValid: true };
  }

  static validatePrompt(prompt: string): { isValid: boolean; error?: string } {
    if (!prompt || prompt.trim().length === 0) {
      return { isValid: false, error: 'Prompt cannot be empty' };
    }

    if (prompt.trim().length < 3) {
      return { isValid: false, error: 'Prompt must be at least 3 characters' };
    }

    if (prompt.length > 5000) {
      return { isValid: false, error: 'Prompt cannot exceed 5000 characters' };
    }

    return { isValid: true };
  }

  // Enum Validation Methods
  static validateStatus(status: string): boolean {
    const validStatuses: Status[] = [
      'pending', 'in_progress', 'completed', 'archived', 'stuck', 
      'waiting', 'cancelled', 'blocked', 'paused', 'awaiting_approval'
    ];
    return validStatuses.includes(status as Status);
  }

  static validatePriority(priority: string): boolean {
    const validPriorities: Priority[] = ['critical', 'high', 'medium', 'low'];
    return validPriorities.includes(priority as Priority);
  }

  static validateComplexity(complexity: string): boolean {
    const validComplexities = ['simple', 'moderate', 'complex', 'enterprise'];
    return validComplexities.includes(complexity);
  }

  static validateApproach(approach: string): boolean {
    const validApproaches = ['iterative', 'waterfall', 'agile', 'research_first'];
    return validApproaches.includes(approach);
  }

  // Array and Object Validation
  static validateArray<T>(arr: any, itemValidator?: (item: T) => boolean): { isValid: boolean; error?: string } {
    if (!Array.isArray(arr)) {
      return { isValid: false, error: 'Expected an array' };
    }

    if (itemValidator) {
      for (let i = 0; i < arr.length; i++) {
        if (!itemValidator(arr[i])) {
          return { isValid: false, error: `Invalid item at index ${i}` };
        }
      }
    }

    return { isValid: true };
  }

  static validateObjectKeys(obj: any, requiredKeys: string[]): { isValid: boolean; error?: string } {
    if (!obj || typeof obj !== 'object') {
      return { isValid: false, error: 'Expected an object' };
    }

    for (const key of requiredKeys) {
      if (!(key in obj)) {
        return { isValid: false, error: `Missing required key: ${key}` };
      }
    }

    return { isValid: true };
  }

  // Range Validation
  static validateRange(value: number, min: number, max: number): { isValid: boolean; error?: string } {
    if (typeof value !== 'number' || isNaN(value)) {
      return { isValid: false, error: 'Expected a number' };
    }

    if (value < min || value > max) {
      return { isValid: false, error: `Value must be between ${min} and ${max}` };
    }

    return { isValid: true };
  }

  // String Pattern Validation
  static validatePattern(value: string, pattern: RegExp, errorMessage?: string): { isValid: boolean; error?: string } {
    if (!pattern.test(value)) {
      return { isValid: false, error: errorMessage || 'Value does not match required pattern' };
    }
    return { isValid: true };
  }

  // Email and URL Validation
  static validateEmail(email: string): { isValid: boolean; error?: string } {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return this.validatePattern(email, emailPattern, 'Invalid email format');
  }

  static validateUrl(url: string): { isValid: boolean; error?: string } {
    try {
      new URL(url);
      return { isValid: true };
    } catch {
      return { isValid: false, error: 'Invalid URL format' };
    }
  }
}

// ================================================================================================
// BASE SESSION MANAGER
// ================================================================================================

export abstract class BaseSessionManager {
  protected sessions: Map<string, SessionContext> = new Map();

  generateSessionId(prefix: string = SESSION_CONFIG.DEFAULT_SESSION_PREFIX): string {
    return IDGenerator.generateSessionId(prefix);
  }

  createSessionMetadata(
    sessionId: string, 
    description: string, 
    chatSessionId?: string
  ): SessionMetadata {
    return {
      sessionId,
      chatSessionId: chatSessionId || sessionId,
      contextDescription: description,
      createdAt: new Date(),
      lastAccessed: new Date(),
      todoCount: 0,
      isActive: true
    };
  }

  isSessionExpired(session: SessionContext): boolean {
    const now = new Date();
    const timeDiff = now.getTime() - session.lastAccessedAt.getTime();
    const timeoutMs = SESSION_CONFIG.TIMEOUT_MINUTES * 60 * 1000;
    return timeDiff > timeoutMs;
  }

  cleanupExpiredSessions(): string[] {
    const expiredSessions: string[] = [];
    
    for (const [sessionId, session] of this.sessions) {
      if (this.isSessionExpired(session)) {
        this.sessions.delete(sessionId);
        expiredSessions.push(sessionId);
      }
    }
    
    return expiredSessions;
  }

  getActiveSessions(): SessionContext[] {
    return Array.from(this.sessions.values()).filter(session => session.isActive);
  }

  getSessionCount(): number {
    return this.sessions.size;
  }
}

// ================================================================================================
// ENHANCED BASE SESSION MANAGER
// ================================================================================================

export class EnhancedSessionManager extends BaseSessionManager {
  protected activeSession: string | null = null;

  /**
   * Create a new session with enhanced capabilities
   */
  createSession(description: string, sessionId?: string): string {
    const id = sessionId || IDGenerator.generateSessionId();
    
    const session: SessionContext = {
      id,
      description,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      workflowIds: [],
      executionState: new Map(),
      parentChildRelationships: new Map(),
      contextMemory: new Map(),
      isActive: false
    };

    this.sessions.set(id, session);
    console.log(`📝 Created session: ${id} - ${description}`);
    return id;
  }

  /**
   * Switch to a different session
   */
  switchSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`Session not found: ${sessionId}`);
      return false;
    }

    // Deactivate current session
    if (this.activeSession) {
      const currentSession = this.sessions.get(this.activeSession);
      if (currentSession) {
        currentSession.isActive = false;
      }
    }

    // Activate new session
    session.isActive = true;
    session.lastAccessedAt = new Date();
    this.activeSession = sessionId;
    
    console.log(`🔄 Switched to session: ${sessionId}`);
    return true;
  }

  /**
   * Get the currently active session
   */
  getActiveSession(): SessionContext | null {
    if (!this.activeSession) {
      return null;
    }
    
    const session = this.sessions.get(this.activeSession);
    if (session) {
      session.lastAccessedAt = new Date();
    }
    
    return session || null;
  }

  /**
   * List all sessions sorted by last access
   */
  listSessions(): SessionContext[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.lastAccessedAt.getTime() - a.lastAccessedAt.getTime());
  }

  /**
   * Save context to session memory
   */
  saveContextToSession(sessionId: string, key: string, context: any): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.contextMemory.set(key, context);
      session.lastAccessedAt = new Date();
      console.log(`💾 Saved context to session ${sessionId}: ${key}`);
    } else {
      console.warn(`Cannot save context - session not found: ${sessionId}`);
    }
  }

  /**
   * Get context from session memory
   */
  getContextFromSession(sessionId: string, key: string): any {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastAccessedAt = new Date();
      return session.contextMemory.get(key) || null;
    }
    return null;
  }

  /**
   * Add workflow to session
   */
  addWorkflowToSession(sessionId: string, workflowId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (!session.workflowIds.includes(workflowId)) {
        session.workflowIds.push(workflowId);
        session.lastAccessedAt = new Date();
        console.log(`🔗 Added workflow ${workflowId} to session ${sessionId}`);
        return true;
      }
    }
    return false;
  }

  /**
   * Get workflows for session
   */
  getSessionWorkflows(sessionId: string): string[] {
    const session = this.sessions.get(sessionId);
    return session?.workflowIds || [];
  }

  /**
   * Set execution state for workflow in session
   */
  setExecutionState(sessionId: string, workflowId: string, state: any): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.executionState.set(workflowId, state);
      session.lastAccessedAt = new Date();
    }
  }

  /**
   * Get execution state for workflow in session
   */
  getExecutionState(sessionId: string, workflowId: string): any {
    const session = this.sessions.get(sessionId);
    return session?.executionState.get(workflowId) || null;
  }

  /**
   * Create parent-child relationship between tasks
   */
  createParentChildRelationship(sessionId: string, parentId: string, childId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (!session.parentChildRelationships.has(parentId)) {
        session.parentChildRelationships.set(parentId, []);
      }
      const children = session.parentChildRelationships.get(parentId)!;
      if (!children.includes(childId)) {
        children.push(childId);
        session.lastAccessedAt = new Date();
      }
    }
  }

  /**
   * Get children for parent task
   */
  getChildTasks(sessionId: string, parentId: string): string[] {
    const session = this.sessions.get(sessionId);
    return session?.parentChildRelationships.get(parentId) || [];
  }

  /**
   * Clean up inactive sessions
   */
  cleanupInactiveSessions(maxAgeHours: number = 24): string[] {
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    const cleanedSessions: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      if (session.lastAccessedAt < cutoff && !session.isActive) {
        this.sessions.delete(sessionId);
        cleanedSessions.push(sessionId);
      }
    }

    if (cleanedSessions.length > 0) {
      console.log(`🧹 Cleaned up ${cleanedSessions.length} inactive sessions`);
    }

    return cleanedSessions;
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    totalSessions: number;
    activeSessions: number;
    oldestSession: Date | null;
    newestSession: Date | null;
  } {
    const sessions = Array.from(this.sessions.values());
    const activeSessions = sessions.filter(s => s.isActive).length;
    
    const creationDates = sessions.map(s => s.createdAt);
    const oldestSession = creationDates.length > 0 ? new Date(Math.min(...creationDates.map(d => d.getTime()))) : null;
    const newestSession = creationDates.length > 0 ? new Date(Math.max(...creationDates.map(d => d.getTime()))) : null;

    return {
      totalSessions: sessions.length,
      activeSessions,
      oldestSession,
      newestSession
    };
  }
}

// ================================================================================================
// BASE TODO UTILITIES
// ================================================================================================

export abstract class BaseTodoUtils {
  static generateTodoId(): string {
    return IDGenerator.generateTodoId();
  }

  static createBaseTodo(content: string, sessionId: string): Omit<Todo, 'id'> {
    const now = new Date();
    return {
      content: content.trim(),
      status: DEFAULTS.STATUS,
      createdAt: now,
      updatedAt: now,
      subTasks: [],
      history: [{
        timestamp: now,
        action: 'created',
        agentId: 'system'
      }],
      priority: DEFAULTS.PRIORITY,
      dependencies: [],
      tags: [],
      lastAccessedAt: now
    };
  }

  static createBaseTodoItem(content: string, sessionId: string): Omit<TodoItem, 'id'> {
    const now = Date.now();
    return {
      content: content.trim(),
      priority: DEFAULTS.PRIORITY,
      status: DEFAULTS.STATUS,
      createdAt: now,
      updatedAt: now,
      sessionId,
      timeEstimate: DEFAULTS.TIME_ESTIMATE,
      complexity: DEFAULTS.COMPLEXITY,
      taskType: DEFAULTS.TASK_TYPE,
      dependencies: []
    };
  }

  static updateTodoTimestamp<T extends { updatedAt: Date | number }>(todo: T): T {
    const updated = { ...todo };
    if (typeof updated.updatedAt === 'number') {
      updated.updatedAt = Date.now();
    } else {
      updated.updatedAt = new Date();
    }
    return updated;
  }

  static addHistoryEntry(
    todo: Todo, 
    action: string, 
    details: {
      previousStatus?: string;
      newStatus?: string;
      notes?: string;
      agentId?: string;
      duration?: number;
    } = {}
  ): Todo {
    const updated = { ...todo };
    updated.history = [...todo.history, {
      timestamp: new Date(),
      action,
      ...details
    }];
    return updated;
  }

  static searchTodos<T extends { content: string; summary?: string }>(
    todos: T[],
    query: string
  ): T[] {
    const queryLower = query.toLowerCase();
    return todos.filter(todo => 
      todo.content.toLowerCase().includes(queryLower) ||
      (todo.summary && todo.summary.toLowerCase().includes(queryLower))
    );
  }

  static filterTodosByStatus<T extends { status: Status }>(
    todos: T[],
    statuses: Status[]
  ): T[] {
    return todos.filter(todo => statuses.includes(todo.status));
  }

  static filterTodosByPriority<T extends { priority: Priority }>(
    todos: T[],
    priorities: Priority[]
  ): T[] {
    return todos.filter(todo => priorities.includes(todo.priority));
  }

  static sortTodosByPriority<T extends { priority: Priority; createdAt: Date | number }>(
    todos: T[]
  ): T[] {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    
    return [...todos].sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      
      // If same priority, sort by creation date (newest first)
      const aTime = typeof a.createdAt === 'number' ? a.createdAt : a.createdAt.getTime();
      const bTime = typeof b.createdAt === 'number' ? b.createdAt : b.createdAt.getTime();
      return bTime - aTime;
    });
  }
}

// ================================================================================================
// BASE STATE MANAGEMENT
// ================================================================================================

export abstract class BaseStateManager {
  protected multiSessionState: MultiSessionState = {
    sessions: {},
    activeSessions: {},
    sessionMetadata: {},
    globalSettings: {
      autoSessionDetection: true,
      sessionTimeoutMinutes: SESSION_CONFIG.TIMEOUT_MINUTES,
      maxActiveSessions: SESSION_CONFIG.MAX_ACTIVE_SESSIONS
    }
  };

  createEmptyTodoState(sessionId: string): TodoState {
    const now = new Date();
    return {
      todos: [],
      sessionId,
      createdAt: now,
      lastUpdated: now,
      autoProgressionEnabled: DEFAULTS.AUTO_PROGRESSION
    };
  }

  updateSessionMetadata(sessionId: string, updates: Partial<SessionMetadata>): void {
    const existing = this.multiSessionState.sessionMetadata[sessionId];
    if (existing) {
      this.multiSessionState.sessionMetadata[sessionId] = {
        ...existing,
        ...updates,
        lastAccessed: new Date()
      };
    }
  }

  getSessionStats(sessionId: string): {
    todoCount: number;
    completedCount: number;
    pendingCount: number;
    averageCompletionTime: number;
  } {
    const session = this.multiSessionState.sessions[sessionId];
    if (!session) {
      return { todoCount: 0, completedCount: 0, pendingCount: 0, averageCompletionTime: 0 };
    }

    const todoCount = session.todos.length;
    const completedCount = session.todos.filter(t => t.status === 'completed').length;
    const pendingCount = session.todos.filter(t => t.status === 'pending').length;
    
    const completedTodos = session.todos.filter(t => t.status === 'completed');
    const averageCompletionTime = completedTodos.length > 0
      ? completedTodos.reduce((sum, todo) => {
          const created = todo.createdAt.getTime();
          const updated = todo.updatedAt.getTime();
          return sum + (updated - created);
        }, 0) / completedTodos.length / 1000 / 60 // Convert to minutes
      : 0;

    return { todoCount, completedCount, pendingCount, averageCompletionTime };
  }

  archiveSession(sessionId: string): boolean {
    const session = this.multiSessionState.sessions[sessionId];
    if (!session) {
      return false;
    }

    session.isArchived = true;
    
    if (!this.multiSessionState.archivedSessions) {
      this.multiSessionState.archivedSessions = [];
    }
    this.multiSessionState.archivedSessions.push(sessionId);

    // Remove from active sessions
    delete this.multiSessionState.activeSessions[sessionId];
    
    // Update metadata
    if (this.multiSessionState.sessionMetadata[sessionId]) {
      this.multiSessionState.sessionMetadata[sessionId].isActive = false;
    }

    return true;
  }

  getGlobalStats(): {
    totalSessions: number;
    activeSessions: number;
    archivedSessions: number;
    totalTodos: number;
    totalCompleted: number;
  } {
    const totalSessions = Object.keys(this.multiSessionState.sessions).length;
    const activeSessions = Object.keys(this.multiSessionState.activeSessions).length;
    const archivedSessions = this.multiSessionState.archivedSessions?.length || 0;
    
    let totalTodos = 0;
    let totalCompleted = 0;
    
    Object.values(this.multiSessionState.sessions).forEach(session => {
      totalTodos += session.todos.length;
      totalCompleted += session.todos.filter(t => t.status === 'completed').length;
    });

    return {
      totalSessions,
      activeSessions,
      archivedSessions,
      totalTodos,
      totalCompleted
    };
  }
}

// ================================================================================================
// BASE ERROR HANDLING
// ================================================================================================

export class TodoError extends Error {
  constructor(
    message: string,
    public code: string = ERROR_CODES.OPERATION_FAILED,
    public details?: any
  ) {
    super(message);
    this.name = 'TodoError';
  }
}

export abstract class BaseErrorHandler {
  static createError(code: string, message: string, details?: any): TodoError {
    return new TodoError(message, code, details);
  }

  static handleValidationError(field: string, value: any): TodoError {
    return new TodoError(
      `Invalid ${field}: ${value}`,
      ERROR_CODES.INVALID_INPUT,
      { field, value }
    );
  }

  static handleNotFoundError(type: string, id: string): TodoError {
    let code: string;
    switch (type.toLowerCase()) {
      case 'todo':
        code = ERROR_CODES.TODO_NOT_FOUND;
        break;
      case 'workflow':
        code = ERROR_CODES.WORKFLOW_NOT_FOUND;
        break;
      case 'session':
        code = ERROR_CODES.SESSION_NOT_FOUND;
        break;
      default:
        code = ERROR_CODES.OPERATION_FAILED;
    }
    
    return new TodoError(`${type} not found: ${id}`, code, { type, id });
  }

  static wrapError(error: any, operation: string): TodoError {
    if (error instanceof TodoError) {
      return error;
    }
    
    return new TodoError(
      `${operation} failed: ${error.message || error}`,
      ERROR_CODES.OPERATION_FAILED,
      { originalError: error, operation }
    );
  }
}

// ================================================================================================
// BASE UTILITIES
// ================================================================================================

export abstract class BaseUtils {
  static deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  static sanitizeInput(input: string): string {
    return input.trim().replace(/[<>]/g, '');
  }

  static formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} minutes`;
    } else if (minutes < 1440) {
      const hours = Math.round(minutes / 60 * 10) / 10;
      return `${hours} hours`;
    } else {
      const days = Math.round(minutes / 1440 * 10) / 10;
      return `${days} days`;
    }
  }

  static parseTimeString(timeStr: string): number {
    const match = timeStr.match(/(\d+)\s*(minute|hour|day)/i);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      
      switch (unit) {
        case 'minute':
          return value;
        case 'hour':
          return value * 60;
        case 'day':
          return value * 1440;
      }
    }
    return 60; // Default 1 hour
  }

  static truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }

  static createCheckpoint<T>(data: T, label: string): { data: T; timestamp: Date; label: string } {
    return {
      data: this.deepClone(data),
      timestamp: new Date(),
      label
    };
  }
}
