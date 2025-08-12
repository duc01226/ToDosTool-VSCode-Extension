# VS Code Shell Integration Auto-Setup

Copy these files to any Windows VS Code workspace folder and run the setup:

## Files included:
- `setup-vscode-shell-integration.ps1` - Main setup script
- `setup-vscode-shell-integration.bat` - Batch launcher (double-click to run)
- `SHELL-INTEGRATION-README.md` - Detailed instructions

## Quick Setup (3 methods):

### Method 1: Double-click the batch file
1. Double-click `setup-vscode-shell-integration.bat`
2. Follow the prompts
3. Restart VS Code

### Method 2: PowerShell (recommended)
```powershell
.\setup-vscode-shell-integration.ps1
```

### Method 3: Force overwrite existing configs
```powershell
.\setup-vscode-shell-integration.ps1 -Force
```

## What gets configured automatically:

✅ **PowerShell Profile** - Adds shell integration to your PowerShell profile  
✅ **VS Code Settings** - Configures workspace with optimal shell integration settings  
✅ **Test Scripts** - Creates test files to verify everything works  
✅ **Backup System** - Automatically backs up existing configurations  

## After running the script:

1. **Restart VS Code** (Ctrl+Shift+P → "Developer: Reload Window")
2. **Open new terminal** (Ctrl+Shift+`) - should use PowerShell
3. **Test features**: Run `.\test-shell-integration.ps1`

## Features you'll get:

🔵 **Command decorations** (blue = success, red = failed)  
📍 **Command navigation** (Ctrl+Up/Down)  
📋 **Recent commands** (Ctrl+Alt+R)  
🔍 **IntelliSense** in terminal  
📁 **Working directory detection**  
⚡ **Quick fixes** for common issues  

## Requirements:
- Windows 10/11
- VS Code installed with `code` command in PATH
- PowerShell 5.1+ (built into Windows)

## Troubleshooting:
If you get execution policy errors, run PowerShell as Administrator:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---
**Ready to use on any Windows laptop with VS Code!** 🚀
