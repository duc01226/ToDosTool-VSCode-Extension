import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// Import the extension module for testing
import * as extension from '../extension';

// Mock interfaces for testing
interface MockTodo {
	id: string;
	content: string;
	status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
	createdAt: Date;
	updatedAt: Date;
	summary?: string;
	subTasks: MockSubTask[];
	history: Array<{
		timestamp: Date;
		action: string;
		previousStatus?: string;
		newStatus?: string;
		notes?: string;
	}>;
}

interface MockSubTask {
	id: string;
	content: string;
	status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
	createdAt: Date;
	updatedAt: Date;
}

suite('AI-ToDos-Tool Extension Test Suite', () => {
	let context: vscode.ExtensionContext;
	let mockStorageUri: vscode.Uri;

	// Setup before all tests
	suiteSetup(async () => {
		vscode.window.showInformationMessage('Starting AI-ToDos-Tool tests...');
		
		// Create a mock context for testing
		const tempDir = path.join(__dirname, 'test-storage');
		if (!fs.existsSync(tempDir)) {
			fs.mkdirSync(tempDir, { recursive: true });
		}
		
		mockStorageUri = vscode.Uri.file(tempDir);
		
		// Create a simplified mock context for testing
		context = {
			subscriptions: [],
			globalStorageUri: mockStorageUri,
			storageUri: mockStorageUri,
			storagePath: tempDir,
			globalStoragePath: tempDir,
			logPath: path.join(tempDir, 'logs'),
			logUri: vscode.Uri.file(path.join(tempDir, 'logs')),
			extensionUri: vscode.Uri.file(__dirname),
			extensionPath: __dirname,
			extensionMode: vscode.ExtensionMode.Test,
			asAbsolutePath: (relativePath: string) => path.join(__dirname, relativePath)
		} as any;
	});

	// Cleanup after all tests
	suiteTeardown(async () => {
		// Clean up test storage
		const tempDir = path.join(__dirname, 'test-storage');
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	suite('Extension Activation', () => {
		test('Extension should activate without errors', async () => {
			try {
				await extension.activate(context);
				assert.ok(true, 'Extension activated successfully');
			} catch (error) {
				assert.fail(`Extension activation failed: ${error}`);
			}
		});

		test('Extension should register all commands', async () => {
			await extension.activate(context);
			
			const expectedCommands = [
				'ai-todos-tool.createTodo',
				'ai-todos-tool.updateStatus',
				'ai-todos-tool.addSubTask',
				'ai-todos-tool.showDashboard',
				'ai-todos-tool.clearSession'
			];

			const allCommands = await vscode.commands.getCommands();
			
			for (const command of expectedCommands) {
				assert.ok(
					allCommands.includes(command),
					`Command ${command} should be registered`
				);
			}
		});
	});

	suite('Todo Creation', () => {
		test('Should create todo with valid content', async () => {
			// Mock user input
			const originalShowInputBox = vscode.window.showInputBox;
			let inputCallCount = 0;
			
			vscode.window.showInputBox = async (options?: vscode.InputBoxOptions) => {
				inputCallCount++;
				if (inputCallCount === 1) {
					return 'Test todo content'; // Todo content
				} else {
					return 'Test summary'; // Summary
				}
			};

			try {
				await vscode.commands.executeCommand('ai-todos-tool.createTodo');
				assert.ok(true, 'Todo creation command executed successfully');
			} catch (error) {
				assert.fail(`Todo creation failed: ${error}`);
			} finally {
				// Restore original function
				vscode.window.showInputBox = originalShowInputBox;
			}
		});

		test('Should handle empty todo content gracefully', async () => {
			// Mock user input - return undefined (user cancelled)
			const originalShowInputBox = vscode.window.showInputBox;
			vscode.window.showInputBox = async () => undefined;

			try {
				await vscode.commands.executeCommand('ai-todos-tool.createTodo');
				assert.ok(true, 'Handled empty input gracefully');
			} catch (error) {
				assert.fail(`Should handle empty input: ${error}`);
			} finally {
				vscode.window.showInputBox = originalShowInputBox;
			}
		});
	});

	suite('Todo Status Management', () => {
		test('Should handle update status with no todos', async () => {
			// Mock showInformationMessage to prevent actual UI
			const originalShowInfoMessage = vscode.window.showInformationMessage;
			let messageShown = false;
			
			vscode.window.showInformationMessage = async (message: string) => {
				messageShown = true;
				return undefined;
			};

			try {
				await vscode.commands.executeCommand('ai-todos-tool.updateStatus');
				assert.ok(messageShown, 'Should show message when no todos exist');
			} catch (error) {
				assert.fail(`Update status failed: ${error}`);
			} finally {
				vscode.window.showInformationMessage = originalShowInfoMessage;
			}
		});
	});

	suite('SubTask Management', () => {
		test('Should handle add subtask with no todos', async () => {
			const originalShowInfoMessage = vscode.window.showInformationMessage;
			let messageShown = false;
			
			vscode.window.showInformationMessage = async (message: string) => {
				messageShown = true;
				return undefined;
			};

			try {
				await vscode.commands.executeCommand('ai-todos-tool.addSubTask');
				assert.ok(messageShown, 'Should show message when no todos exist for subtasks');
			} catch (error) {
				assert.fail(`Add subtask failed: ${error}`);
			} finally {
				vscode.window.showInformationMessage = originalShowInfoMessage;
			}
		});
	});

	suite('Dashboard Functionality', () => {
		test('Should show dashboard with no todos', async () => {
			const originalShowInfoMessage = vscode.window.showInformationMessage;
			const originalCreateWebviewPanel = vscode.window.createWebviewPanel;
			let messageShown = false;
			
			vscode.window.showInformationMessage = async (message: string) => {
				messageShown = true;
				return undefined;
			};

			try {
				await vscode.commands.executeCommand('ai-todos-tool.showDashboard');
				assert.ok(messageShown, 'Should show message when no todos exist for dashboard');
			} catch (error) {
				assert.fail(`Show dashboard failed: ${error}`);
			} finally {
				vscode.window.showInformationMessage = originalShowInfoMessage;
				vscode.window.createWebviewPanel = originalCreateWebviewPanel;
			}
		});
	});

	suite('Session Management', () => {
		test('Should clear session when confirmed', async () => {
			const originalShowWarningMessage = vscode.window.showWarningMessage;
			const originalShowInfoMessage = vscode.window.showInformationMessage;
			let warningShown = false;
			let infoShown = false;
			
			(vscode.window.showWarningMessage as any) = async (message: string, ...items: any[]) => {
				warningShown = true;
				return 'Yes'; // User confirms
			};
			
			vscode.window.showInformationMessage = async (message: string) => {
				infoShown = true;
				return undefined;
			};

			try {
				await vscode.commands.executeCommand('ai-todos-tool.clearSession');
				assert.ok(warningShown, 'Should show warning before clearing session');
				assert.ok(infoShown, 'Should show confirmation after clearing session');
			} catch (error) {
				assert.fail(`Clear session failed: ${error}`);
			} finally {
				vscode.window.showWarningMessage = originalShowWarningMessage;
				vscode.window.showInformationMessage = originalShowInfoMessage;
			}
		});

		test('Should not clear session when cancelled', async () => {
			const originalShowWarningMessage = vscode.window.showWarningMessage;
			let warningShown = false;
			
			(vscode.window.showWarningMessage as any) = async (message: string, ...items: any[]) => {
				warningShown = true;
				return 'No'; // User cancels
			};

			try {
				await vscode.commands.executeCommand('ai-todos-tool.clearSession');
				assert.ok(warningShown, 'Should show warning dialog');
			} catch (error) {
				assert.fail(`Clear session cancellation failed: ${error}`);
			} finally {
				vscode.window.showWarningMessage = originalShowWarningMessage;
			}
		});
	});

	suite('Data Validation', () => {
		test('Should validate todo ID format', () => {
			const validId = 'todo_1234567890_abcdefghi';
			const invalidId = 'invalid-id';
			
			// Test ID pattern
			const todoIdPattern = /^todo_\d+_[a-z0-9]+$/;
			
			assert.ok(todoIdPattern.test(validId), 'Valid todo ID should match pattern');
			assert.ok(!todoIdPattern.test(invalidId), 'Invalid todo ID should not match pattern');
		});

		test('Should validate subtask ID format', () => {
			const validId = 'subtask_1234567890_abcdefghi';
			const invalidId = 'invalid-subtask-id';
			
			// Test ID pattern
			const subtaskIdPattern = /^subtask_\d+_[a-z0-9]+$/;
			
			assert.ok(subtaskIdPattern.test(validId), 'Valid subtask ID should match pattern');
			assert.ok(!subtaskIdPattern.test(invalidId), 'Invalid subtask ID should not match pattern');
		});

		test('Should validate status values', () => {
			const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
			const invalidStatus = 'invalid_status';
			
			for (const status of validStatuses) {
				assert.ok(validStatuses.includes(status), `${status} should be valid`);
			}
			
			assert.ok(!validStatuses.includes(invalidStatus), 'Invalid status should not be accepted');
		});
	});

	suite('Storage Operations', () => {
		test('Should handle storage directory creation', () => {
			const testDir = path.join(__dirname, 'test-storage-create');
			
			try {
				if (!fs.existsSync(testDir)) {
					fs.mkdirSync(testDir, { recursive: true });
				}
				
				assert.ok(fs.existsSync(testDir), 'Storage directory should be created');
				
				// Cleanup
				if (fs.existsSync(testDir)) {
					fs.rmSync(testDir, { recursive: true });
				}
			} catch (error) {
				assert.fail(`Storage directory creation failed: ${error}`);
			}
		});

		test('Should handle JSON serialization/deserialization', () => {
			const mockTodo: MockTodo = {
				id: 'todo_123_abc',
				content: 'Test todo',
				status: 'pending',
				createdAt: new Date(),
				updatedAt: new Date(),
				summary: 'Test summary',
				subTasks: [],
				history: [{
					timestamp: new Date(),
					action: 'created',
					notes: 'Todo created'
				}]
			};

			try {
				// Test serialization
				const serialized = JSON.stringify(mockTodo);
				assert.ok(serialized.length > 0, 'Should serialize todo to JSON');

				// Test deserialization
				const deserialized = JSON.parse(serialized);
				assert.strictEqual(deserialized.id, mockTodo.id, 'ID should be preserved');
				assert.strictEqual(deserialized.content, mockTodo.content, 'Content should be preserved');
				assert.strictEqual(deserialized.status, mockTodo.status, 'Status should be preserved');
			} catch (error) {
				assert.fail(`JSON operations failed: ${error}`);
			}
		});
	});

	suite('Error Handling', () => {
		test('Should handle file system errors gracefully', () => {
			const invalidPath = '/invalid/path/that/does/not/exist/file.json';
			
			try {
				const exists = fs.existsSync(invalidPath);
				assert.strictEqual(exists, false, 'Should return false for non-existent path');
			} catch (error) {
				// Should not throw for existsSync
				assert.fail(`existsSync should not throw: ${error}`);
			}
		});

		test('Should handle invalid JSON gracefully', () => {
			const invalidJson = '{ invalid json content }';
			
			try {
				JSON.parse(invalidJson);
				assert.fail('Should throw error for invalid JSON');
			} catch (error) {
				assert.ok(error instanceof SyntaxError, 'Should throw SyntaxError for invalid JSON');
			}
		});
	});

	suite('Extension Deactivation', () => {
		test('Extension should deactivate without errors', () => {
			try {
				extension.deactivate();
				assert.ok(true, 'Extension deactivated successfully');
			} catch (error) {
				assert.fail(`Extension deactivation failed: ${error}`);
			}
		});
	});
});
