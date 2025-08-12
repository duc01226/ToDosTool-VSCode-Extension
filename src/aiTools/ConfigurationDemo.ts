/**
 * Configuration Demo - Shows how the context management settings work
 */

import * as vscode from 'vscode';
import { globalContextManager } from './ContextManager';

export class ConfigurationDemo {
    
    /**
     * Show current context management configuration
     */
    public static async showConfiguration(): Promise<void> {
        const config = vscode.workspace.getConfiguration('ai-todos-tool.contextManagement');
        
        const maxTokens = config.get('maxTokensBeforeCompression', 100000);
        const maxHistory = config.get('maxHistoryItems', 100);
        const compressionRatio = config.get('compressionRatio', 0.7);
        const enableSummarization = config.get('enableIntelligentSummarization', true);

        const message = `🔧 **Context Management Configuration**

**Token Management:**
• Max Tokens Before Compression: ${maxTokens.toLocaleString()}
• Compression Ratio: ${(compressionRatio * 100).toFixed(0)}%

**History Management:**
• Max History Items: ${maxHistory}

**AI Features:**
• Intelligent Summarization: ${enableSummarization ? '✅ Enabled' : '❌ Disabled'}

**How to customize:**
1. Open VS Code Settings (Ctrl+,)
2. Search for "ai-todos-tool context"
3. Adjust values according to your needs

**Recommended settings:**
• For large projects: 100,000+ tokens
• For small projects: 50,000 tokens
• Keep compression ratio at 50% for best results`;

        vscode.window.showInformationMessage(
            'Context Management Configuration',
            { modal: true, detail: message },
            'Open Settings'
        ).then(selection => {
            if (selection === 'Open Settings') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'ai-todos-tool.contextManagement');
            }
        });
    }

    /**
     * Test context compression with sample data
     */
    public static async testContextCompression(): Promise<void> {
        const workflowId = 'config-demo-test';
        
        // Add some sample context data
        globalContextManager.addContext(workflowId, {
            timestamp: new Date(),
            type: 'user_prompt',
            content: 'This is a test of the context management system with user-configurable settings. ' +
                    'The system should compress context when it gets too large while preserving important information.',
            metadata: {
                workflowId: workflowId,
                priority: 'high'
            },
            tokenCount: 150
        });

        globalContextManager.addContext(workflowId, {
            timestamp: new Date(),
            type: 'ai_guidance',
            content: 'Based on your request, I am testing the context compression system. ' +
                    'The new configuration allows users to set their own limits for token count and history items.',
            metadata: {
                workflowId: workflowId,
                priority: 'medium'
            },
            tokenCount: 120
        });

        // Test getting context for AI (this will trigger compression if needed)
        try {
            const contextForAI = await globalContextManager.getContextForAI(
                workflowId, 
                'Testing context compression with user-configurable settings'
            );
            
            vscode.window.showInformationMessage(
                `✅ Context compression test completed successfully!\n\nContext length: ${contextForAI.length} characters\nCheck the console for detailed output.`
            );

            console.log('🧪 Context Compression Test Results:');
            console.log('Context for AI:', contextForAI);
            
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Context compression test failed: ${error}`);
            console.error('Context compression test error:', error);
        }
    }
}
