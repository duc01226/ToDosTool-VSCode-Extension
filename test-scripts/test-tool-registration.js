// Test script to verify VSCode Language Model Tool registration
// Run this in VSCode Developer Console (Help > Toggle Developer Tools)

console.log("🔍 Testing TodosTool registration...");

// Check if the extension is active
const extension = vscode.extensions.getExtension('duc01226.ai-todos-tool');
if (extension) {
    console.log("✅ Extension found:", extension.isActive ? "ACTIVE" : "INACTIVE");
    if (!extension.isActive) {
        console.log("⚠️ Extension not active - try activating it");
    }
} else {
    console.log("❌ Extension not found - check extension ID");
}

// Test Language Model Tools API availability
if (vscode.lm && vscode.lm.registerTool) {
    console.log("✅ VSCode Language Model Tools API available");
} else {
    console.log("❌ VSCode Language Model Tools API not available");
    console.log("   Your VSCode version might be too old (need 1.103.0+)");
}

// Check chat participants
const chatParticipants = vscode.chat.participants;
console.log("🤖 Chat participants:", chatParticipants.map(p => p.id));

console.log("📋 Instructions:");
console.log("1. Open GitHub Copilot Chat");
console.log("2. Try: '@todos create \"test task\"'");
console.log("3. Try: '@copilot can you help me create some todos for a React project?'");
console.log("4. Watch for tool invocations in Extension Host console");
