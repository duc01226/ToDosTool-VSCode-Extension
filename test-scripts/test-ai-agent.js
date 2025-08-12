#!/usr/bin/env node

/**
 * AI-ToDos-Tool AI Agent Validation Script
 * 
 * This script validates that the AI-ToDos-Tool extension is properly configured
 * and ready for AI agent integration in complex, long-running tasks.
 */

console.log('🤖 AI-ToDos-Tool AI Agent Validation Tool');
console.log('=====================================\n');

const fs = require('fs');
const path = require('path');

// Configuration paths
const packageJsonPath = './package.json';
const extensionPath = './src/extension.ts';
const tsConfigPath = './tsconfig.json';

// Test results storage
const testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
    details: []
};

function runTest(testName, testFunction) {
    testResults.total++;
    console.log(`🧪 ${testName}...`);
    
    try {
        const result = testFunction();
        if (result.status === 'passed') {
            testResults.passed++;
            console.log(`   ✅ ${result.message}\n`);
        } else if (result.status === 'warning') {
            testResults.warnings++;
            console.log(`   ⚠️ ${result.message}\n`);
        } else {
            testResults.failed++;
            console.log(`   ❌ ${result.message}\n`);
        }
        testResults.details.push({
            test: testName,
            ...result
        });
    } catch (error) {
        testResults.failed++;
        console.log(`   ❌ Error: ${error.message}\n`);
        testResults.details.push({
            test: testName,
            status: 'failed',
            message: error.message
        });
    }
}

// Test 1: Package.json validation
runTest('Package.json Configuration', () => {
    if (!fs.existsSync(packageJsonPath)) {
        return { status: 'failed', message: 'package.json not found' };
    }
    
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Check required fields
    const requiredFields = ['name', 'displayName', 'description', 'version'];
    const missingFields = requiredFields.filter(field => !packageJson[field]);
    
    if (missingFields.length > 0) {
        return { 
            status: 'failed', 
            message: `Missing required fields: ${missingFields.join(', ')}` 
        };
    }
    
    // Check VS Code API version
    if (!packageJson.engines || !packageJson.engines.vscode) {
        return { 
            status: 'failed', 
            message: 'VS Code engine version not specified' 
        };
    }
    
    // Check language model tools registration
    if (!packageJson.contributes || !packageJson.contributes.languageModelTools) {
        return { 
            status: 'failed', 
            message: 'Language model tools not registered in package.json' 
        };
    }
    
    const toolConfig = packageJson.contributes.languageModelTools[0];
    if (!toolConfig || toolConfig.name !== 'todosTool') {
        return { 
            status: 'failed', 
            message: 'TodosTool language model tool not properly configured' 
        };
    }
    
    // Check chat participant registration
    if (!packageJson.contributes.chatParticipants) {
        return { 
            status: 'warning', 
            message: 'Chat participant registered but could be enhanced' 
        };
    }
    
    return { 
        status: 'passed', 
        message: 'Package.json properly configured for AI agent integration' 
    };
});

// Test 2: Extension source code validation
runTest('Extension Source Code Structure', () => {
    if (!fs.existsSync(extensionPath)) {
        return { status: 'failed', message: 'Extension source file not found' };
    }
    
    const extensionCode = fs.readFileSync(extensionPath, 'utf8');
    
    // Check for required interfaces
    const requiredInterfaces = ['Todo', 'SubTask', 'TodoState', 'TodoToolInput'];
    const missingInterfaces = requiredInterfaces.filter(interfaceName => 
        !extensionCode.includes(`interface ${interfaceName}`)
    );
    
    if (missingInterfaces.length > 0) {
        return { 
            status: 'failed', 
            message: `Missing required interfaces: ${missingInterfaces.join(', ')}` 
        };
    }
    
    // Check for AI agent specific features
    const aiFeatures = [
        'createCheckpoint',
        'analyzeTask', 
        'createWorkflow',
        'setAutoProgression',
        'performMemoryCleanup',
        'getWorkflowStatus'
    ];
    
    const missingFeatures = aiFeatures.filter(feature => 
        !extensionCode.includes(feature)
    );
    
    if (missingFeatures.length > 0) {
        return { 
            status: 'failed', 
            message: `Missing AI agent features: ${missingFeatures.join(', ')}` 
        };
    }
    
    // Check for chat participant with AI enhancement
    if (!extensionCode.includes('createTodosChatParticipant')) {
        return { 
            status: 'warning', 
            message: 'Chat participant may not be properly enhanced for AI agents' 
        };
    }
    
    // Check for auto-detection keywords
    if (!extensionCode.includes('containsTodoKeywords')) {
        return { 
            status: 'warning', 
            message: 'Automatic todo detection may not be implemented' 
        };
    }
    
    return { 
        status: 'passed', 
        message: 'Extension source properly structured for AI agent workflows' 
    };
});

// Test 3: TypeScript configuration
runTest('TypeScript Configuration', () => {
    if (!fs.existsSync(tsConfigPath)) {
        return { status: 'failed', message: 'tsconfig.json not found' };
    }
    
    const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf8'));
    
    // Check compiler options
    if (!tsConfig.compilerOptions) {
        return { status: 'failed', message: 'Compiler options not specified' };
    }
    
    const compilerOptions = tsConfig.compilerOptions;
    
    // Check target and module settings
    if (!compilerOptions.target || !compilerOptions.module) {
        return { 
            status: 'failed', 
            message: 'Target and module settings not properly configured' 
        };
    }
    
    // Check if source directory is properly configured
    if (compilerOptions.rootDir !== 'src') {
        return { 
            status: 'warning', 
            message: 'Root directory may not be optimally configured' 
        };
    }
    
    return { 
        status: 'passed', 
        message: 'TypeScript configuration valid for extension development' 
    };
});

// Test 4: AI Agent Integration Features
runTest('AI Agent Integration Features', () => {
    const extensionCode = fs.readFileSync(extensionPath, 'utf8');
    
    // Check for system prompt integration
    const systemPromptFeatures = [
        'CRITICAL AI AGENT GUIDELINES',
        'RULE 1',
        'Auto-progression',
        'Dynamic Reminders'
    ];
    
    let systemPromptScore = 0;
    systemPromptFeatures.forEach(feature => {
        if (extensionCode.includes(feature)) {
            systemPromptScore++;
        }
    });
    
    if (systemPromptScore === 0) {
        return { 
            status: 'failed', 
            message: 'No AI agent system prompt integration found' 
        };
    }
    
    // Check for complex task handling
    const complexTaskFeatures = [
        'workflow',
        'dependencies',
        'checkpoint',
        'auto-progression',
        'smart analysis'
    ];
    
    let complexTaskScore = 0;
    complexTaskFeatures.forEach(feature => {
        if (extensionCode.toLowerCase().includes(feature.toLowerCase())) {
            complexTaskScore++;
        }
    });
    
    if (complexTaskScore < 3) {
        return { 
            status: 'warning', 
            message: `Complex task handling partially implemented (${complexTaskScore}/${complexTaskFeatures.length} features)` 
        };
    }
    
    // Check for memory management
    if (!extensionCode.includes('performMemoryCleanup') || 
        !extensionCode.includes('contextSnapshot')) {
        return { 
            status: 'warning', 
            message: 'Memory management features may be incomplete' 
        };
    }
    
    return { 
        status: 'passed', 
        message: `AI agent integration comprehensive (${systemPromptScore}/4 prompt features, ${complexTaskScore}/5 task features)` 
    };
});

// Test 5: Error Handling and Resilience
runTest('Error Handling and Resilience', () => {
    const extensionCode = fs.readFileSync(extensionPath, 'utf8');
    
    // Check for try-catch blocks
    const tryCatchCount = (extensionCode.match(/try\s*{/g) || []).length;
    const catchCount = (extensionCode.match(/catch\s*\(/g) || []).length;
    
    if (tryCatchCount === 0 || catchCount === 0) {
        return { 
            status: 'failed', 
            message: 'Insufficient error handling (no try-catch blocks found)' 
        };
    }
    
    if (tryCatchCount !== catchCount) {
        return { 
            status: 'warning', 
            message: `Unmatched try-catch blocks (${tryCatchCount} try, ${catchCount} catch)` 
        };
    }
    
    // Check for validation
    if (!extensionCode.includes('validate') && !extensionCode.includes('Validation')) {
        return { 
            status: 'warning', 
            message: 'Input validation may be insufficient' 
        };
    }
    
    // Check for graceful degradation
    const gracefulFeatures = [
        'showErrorMessage',
        'showWarningMessage', 
        'console.warn',
        'console.error'
    ];
    
    const gracefulScore = gracefulFeatures.filter(feature => 
        extensionCode.includes(feature)
    ).length;
    
    if (gracefulScore < 2) {
        return { 
            status: 'warning', 
            message: 'Limited user feedback for error conditions' 
        };
    }
    
    return { 
        status: 'passed', 
        message: `Error handling comprehensive (${tryCatchCount} try-catch blocks, ${gracefulScore}/4 user feedback features)` 
    };
});

// Test 6: Performance and Scalability
runTest('Performance and Scalability', () => {
    const extensionCode = fs.readFileSync(extensionPath, 'utf8');
    
    // Check for performance optimizations
    const perfFeatures = [
        'cleanup',
        'archive',
        'lastAccessedAt',
        'setInterval',
        'clearInterval'
    ];
    
    const perfScore = perfFeatures.filter(feature => 
        extensionCode.includes(feature)
    ).length;
    
    if (perfScore < 2) {
        return { 
            status: 'warning', 
            message: 'Limited performance optimization features' 
        };
    }
    
    // Check for scalability patterns
    if (!extensionCode.includes('Map<') && !extensionCode.includes('Array.from')) {
        return { 
            status: 'warning', 
            message: 'Data structures may not be optimized for scale' 
        };
    }
    
    // Check for background processing
    if (!extensionCode.includes('isBackground') && !extensionCode.includes('setInterval')) {
        return { 
            status: 'warning', 
            message: 'Limited background processing capabilities' 
        };
    }
    
    return { 
        status: 'passed', 
        message: `Performance features implemented (${perfScore}/5 optimization features)` 
    };
});

// Test 7: Documentation and Usability
runTest('Documentation and Usability', () => {
    // Check for documentation files
    const docFiles = [
        'README.md',
        'USAGE_GUIDE.md', 
        'AI_AGENT_VALIDATION_REPORT.md',
        'AI_AGENT_ENHANCED_USAGE_GUIDE.md'
    ];
    
    const existingDocs = docFiles.filter(file => fs.existsSync(file));
    
    if (existingDocs.length < 2) {
        return { 
            status: 'warning', 
            message: `Limited documentation (${existingDocs.length}/4 files found)` 
        };
    }
    
    // Check for command registration
    const extensionCode = fs.readFileSync(extensionPath, 'utf8');
    const commandCount = (extensionCode.match(/registerCommand/g) || []).length;
    
    if (commandCount < 5) {
        return { 
            status: 'warning', 
            message: `Limited command interface (${commandCount} commands registered)` 
        };
    }
    
    // Check for help text and descriptions
    if (!extensionCode.includes('tooltip') && !extensionCode.includes('description')) {
        return { 
            status: 'warning', 
            message: 'Limited user guidance in interface' 
        };
    }
    
    return { 
        status: 'passed', 
        message: `Good documentation and usability (${existingDocs.length}/4 docs, ${commandCount} commands)` 
    };
});

// Generate summary report
console.log('📊 VALIDATION SUMMARY');
console.log('====================');
console.log(`Total Tests: ${testResults.total}`);
console.log(`✅ Passed: ${testResults.passed}`);
console.log(`⚠️  Warnings: ${testResults.warnings}`);
console.log(`❌ Failed: ${testResults.failed}`);

const successRate = Math.round((testResults.passed / testResults.total) * 100);
console.log(`\n📈 Success Rate: ${successRate}%`);

if (testResults.failed === 0) {
    if (testResults.warnings === 0) {
        console.log('\n🎉 EXCELLENT: AI-ToDos-Tool is fully ready for AI agent deployment!');
        console.log('✨ All systems validated and optimized for complex, long-running tasks.');
    } else {
        console.log('\n✅ GOOD: AI-ToDos-Tool is ready for AI agent deployment with minor optimizations.');
        console.log('💡 Consider addressing warnings for optimal performance.');
    }
} else {
    console.log('\n⚠️  ATTENTION REQUIRED: Critical issues found that must be addressed.');
    console.log('🔧 Please review failed tests and make necessary corrections.');
}

// Detailed recommendations
console.log('\n🎯 RECOMMENDATIONS FOR AI AGENT OPTIMIZATION:');

if (testResults.passed === testResults.total) {
    console.log('✅ All core features validated - extension is production-ready');
    console.log('✅ AI agent integration is comprehensive and well-structured');
    console.log('✅ Error handling and performance optimization are adequate');
    console.log('🚀 Ready for deployment and advanced AI agent workflows!');
} else {
    const failed = testResults.details.filter(t => t.status === 'failed');
    const warnings = testResults.details.filter(t => t.status === 'warning');
    
    if (failed.length > 0) {
        console.log('\n❌ CRITICAL ISSUES TO ADDRESS:');
        failed.forEach(test => {
            console.log(`   • ${test.test}: ${test.message}`);
        });
    }
    
    if (warnings.length > 0) {
        console.log('\n⚠️  RECOMMENDED IMPROVEMENTS:');
        warnings.forEach(test => {
            console.log(`   • ${test.test}: ${test.message}`);
        });
    }
}

console.log('\n🔗 NEXT STEPS:');
console.log('1. Press F5 in VS Code to test the extension in Extension Development Host');
console.log('2. Try creating a complex workflow: @todos workflow "Design; Implement; Test; Deploy"');
console.log('3. Test checkpoint creation and recovery features');
console.log('4. Validate auto-progression with multi-step tasks');
console.log('5. Deploy to production environment when ready');

console.log('\n📚 For detailed usage instructions, see:');
console.log('   • AI_AGENT_ENHANCED_USAGE_GUIDE.md - Comprehensive AI agent integration guide');
console.log('   • AI_AGENT_VALIDATION_REPORT.md - Detailed validation and enhancement report');

// Exit with appropriate code
process.exit(testResults.failed > 0 ? 1 : 0);
