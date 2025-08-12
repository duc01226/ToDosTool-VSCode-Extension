# VS Code Shell Integration Setup

This folder contains scripts to automatically configure VS Code shell integration on Windows laptops.

## Quick Start

### Option 1: Run the Batch File (Easiest)
Double-click `setup-vscode-shell-integration.bat` or run it from any command prompt:
```cmd
setup-vscode-shell-integration.bat
```

### Option 2: Run PowerShell Script Directly
```powershell
.\setup-vscode-shell-integration.ps1
```

### Option 3: Run with Parameters
```powershell
# Force overwrite existing configurations
.\setup-vscode-shell-integration.ps1 -Force

# Specify different workspace folder
.\setup-vscode-shell-integration.ps1 -WorkspaceFolder "C:\MyProject"

# Combine parameters
.\setup-vscode-shell-integration.ps1 -WorkspaceFolder "C:\MyProject" -Force
```

## What the Script Does

1. **Checks Prerequisites**
   - Verifies VS Code is installed and accessible
   - Checks PowerShell version compatibility
   - Validates workspace folder exists

2. **Configures PowerShell Profile**
   - Creates PowerShell profile if it doesn't exist
   - Adds VS Code shell integration script
   - Backs up existing profile before modifications

3. **Sets Up VS Code Workspace Settings**
   - Creates `.vscode/settings.json` with shell integration settings
   - Configures PowerShell as default terminal
   - Enables decorations, command guide, and IntelliSense
   - Backs up existing settings before modifications

4. **Creates Test Scripts**
   - Generates `test-shell-integration.ps1` to verify functionality
   - Creates batch launcher for easy testing

## Features You'll Get

- **Command Decorations**: Blue circles for successful commands, red for failures
- **Command Navigation**: Use Ctrl+Up/Down to navigate between commands
- **Command Guide**: Vertical bars showing command boundaries
- **Quick Fixes**: Intelligent suggestions for common command issues
- **Recent Commands**: Ctrl+Alt+R to access command history
- **IntelliSense**: File/command completion in terminal
- **Working Directory Detection**: Better file link resolution

## Keyboard Shortcuts

- `Ctrl+Up/Down` - Navigate between commands
- `Shift+Ctrl+Up/Down` - Select command output
- `Ctrl+Alt+R` - Run recent command
- `Ctrl+G` - Go to recent directory

## After Running the Script

1. **Restart VS Code** or reload the window (Ctrl+Shift+P → "Developer: Reload Window")
2. **Open a new terminal** (Ctrl+Shift+`) - it should use PowerShell by default
3. **Test the setup**: Run `.\test-shell-integration.ps1`

## Troubleshooting

- **Execution Policy Error**: Run PowerShell as Administrator and execute:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```

- **VS Code Not Found**: Ensure VS Code is installed and the `code` command is available in PATH

- **Permission Issues**: Run the script as Administrator or adjust file permissions

## Files Created/Modified

- `$PROFILE` (PowerShell profile) - Adds shell integration
- `.vscode/settings.json` - VS Code workspace settings
- `test-shell-integration.ps1` - Test script
- `test-shell-integration.bat` - Batch launcher for test script

## Backup Policy

The script automatically creates timestamped backups of any existing files before modification:
- `PowerShell-Profile.backup.YYYYMMDD-HHMMSS`
- `settings.json.backup.YYYYMMDD-HHMMSS`

## Requirements

- Windows 10/11
- PowerShell 5.1 or later
- VS Code installed with `code` command in PATH
- Appropriate execution permissions

## Support

This script works with:
- VS Code (stable and insiders)
- PowerShell 5.1, PowerShell 7+
- Windows PowerShell ISE (limited functionality)
- Git Bash (when configured as terminal profile)
