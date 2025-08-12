#Requires -Version 5.1
<#
.SYNOPSIS
    VS Code Shell Integration Setup Script for Windows
    
.DESCRIPTION
    This script automatically configures VS Code shell integration on Windows laptops.
    It sets up PowerShell profile, workspace settings, and creates test scripts.
    
.PARAMETER WorkspaceFolder
    The VS Code workspace folder path. If not provided, uses current directory.
    
.PARAMETER Force
    Force overwrite existing configurations without prompting.
    
.EXAMPLE
    .\setup-vscode-shell-integration.ps1
    
.EXAMPLE
    .\setup-vscode-shell-integration.ps1 -WorkspaceFolder "C:\MyProject" -Force
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [string]$WorkspaceFolder = (Get-Location).Path,
    
    [Parameter(Mandatory=$false)]
    [switch]$Force
)

# Script configuration
$ErrorActionPreference = "Stop"
$InformationPreference = "Continue"

# Colors for output
$Colors = @{
    Success = "Green"
    Warning = "Yellow"
    Error = "Red"
    Info = "Cyan"
    Header = "Magenta"
}

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Colors[$Color]
}

function Write-Header {
    param([string]$Title)
    Write-Host "`n" + "="*60 -ForegroundColor $Colors.Header
    Write-Host " $Title" -ForegroundColor $Colors.Header
    Write-Host "="*60 -ForegroundColor $Colors.Header
}

function Test-VSCodeInstalled {
    try {
        $null = Get-Command "code" -ErrorAction Stop
        return $true
    }
    catch {
        return $false
    }
}

function Backup-ExistingFile {
    param([string]$FilePath)
    
    if (Test-Path $FilePath) {
        $BackupPath = "$FilePath.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Copy-Item -Path $FilePath -Destination $BackupPath -Force
        Write-ColorOutput "Backed up existing file to: $BackupPath" "Warning"
        return $BackupPath
    }
    return $null
}

function Set-PowerShellProfile {
    Write-Header "Configuring PowerShell Profile"
    
    try {
        # Check if profile exists
        $ProfileExists = Test-Path $PROFILE
        
        if ($ProfileExists -and -not $Force) {
            Write-ColorOutput "PowerShell profile already exists: $PROFILE" "Warning"
            $Response = Read-Host "Do you want to add shell integration? (y/N)"
            if ($Response -notmatch '^[Yy]') {
                Write-ColorOutput "Skipping PowerShell profile configuration" "Info"
                return
            }
        }
        
        # Create profile directory if it doesn't exist
        $ProfileDir = Split-Path $PROFILE -Parent
        if (-not (Test-Path $ProfileDir)) {
            New-Item -Path $ProfileDir -ItemType Directory -Force | Out-Null
            Write-ColorOutput "Created PowerShell profile directory: $ProfileDir" "Success"
        }
        
        # Backup existing profile
        if ($ProfileExists) {
            Backup-ExistingFile -FilePath $PROFILE
        }
        
        # Shell integration line
        $ShellIntegrationLine = 'if ($env:TERM_PROGRAM -eq "vscode") { . "$(code --locate-shell-integration-path pwsh)" }'
        
        # Check if shell integration is already configured
        if ($ProfileExists) {
            $ProfileContent = Get-Content $PROFILE -Raw -ErrorAction SilentlyContinue
            if ($ProfileContent -and $ProfileContent.Contains("locate-shell-integration-path")) {
                Write-ColorOutput "Shell integration already configured in PowerShell profile" "Info"
                return
            }
        }
        
        # Add shell integration to profile
        Add-Content -Path $PROFILE -Value "`n# VS Code Shell Integration"
        Add-Content -Path $PROFILE -Value $ShellIntegrationLine
        
        Write-ColorOutput "PowerShell profile configured: $PROFILE" "Success"
        Write-ColorOutput "Added VS Code shell integration" "Success"
    }
    catch {
        Write-ColorOutput "Failed to configure PowerShell profile: $($_.Exception.Message)" "Error"
        throw
    }
}

function Set-VSCodeWorkspaceSettings {
    param([string]$WorkspacePath)
    
    Write-Header "Configuring VS Code Workspace Settings"
    
    try {
        $VSCodeDir = Join-Path $WorkspacePath ".vscode"
        $SettingsFile = Join-Path $VSCodeDir "settings.json"
        
        # Create .vscode directory if it doesn't exist
        if (-not (Test-Path $VSCodeDir)) {
            New-Item -Path $VSCodeDir -ItemType Directory -Force | Out-Null
            Write-ColorOutput "Created .vscode directory: $VSCodeDir" "Success"
        }
        
        # Shell integration settings
        $ShellSettings = @{
            "terminal.integrated.shellIntegration.enabled" = $true
            "terminal.integrated.shellIntegration.decorationsEnabled" = "both"
            "terminal.integrated.shellIntegration.showCommandGuide" = $true
            "terminal.integrated.stickyScroll.enabled" = $true
            "terminal.integrated.suggest.enabled" = $true
            "terminal.integrated.defaultProfile.windows" = "PowerShell"
            "terminal.integrated.profiles.windows" = @{
                "PowerShell" = @{
                    "source" = "PowerShell"
                    "icon" = "terminal-powershell"
                }
                "Command Prompt" = @{
                    "path" = @(
                        '${env:windir}\Sysnative\cmd.exe',
                        '${env:windir}\System32\cmd.exe'
                    )
                    "args" = @()
                    "icon" = "terminal-cmd"
                }
                "Git Bash" = @{
                    "source" = "Git Bash"
                }
            }
        }
        
        $ExistingSettings = @{}
        
        # Read existing settings if file exists
        if (Test-Path $SettingsFile) {
            Backup-ExistingFile -FilePath $SettingsFile
            
            try {
                $SettingsContent = Get-Content $SettingsFile -Raw | Where-Object { $_ -ne $null }
                if ($SettingsContent) {
                    # Remove comments for JSON parsing
                    $CleanedContent = $SettingsContent -replace '//.*?(?=\r?\n)', ''
                    $ExistingSettings = $CleanedContent | ConvertFrom-Json -AsHashtable -ErrorAction SilentlyContinue
                    if (-not $ExistingSettings) {
                        $ExistingSettings = @{}
                    }
                }
            }
            catch {
                Write-ColorOutput "Warning: Could not parse existing settings.json, will create new one" "Warning"
                $ExistingSettings = @{}
            }
        }
        
        # Merge settings
        foreach ($Key in $ShellSettings.Keys) {
            $ExistingSettings[$Key] = $ShellSettings[$Key]
        }
        
        # Write settings to file
        $JsonSettings = $ExistingSettings | ConvertTo-Json -Depth 10
        $JsonSettings | Set-Content -Path $SettingsFile -Encoding UTF8
        
        Write-ColorOutput "VS Code workspace settings configured: $SettingsFile" "Success"
    }
    catch {
        Write-ColorOutput "Failed to configure VS Code settings: $($_.Exception.Message)" "Error"
        throw
    }
}

function New-TestScript {
    param([string]$WorkspacePath)
    
    Write-Header "Creating Test Scripts"
    
    try {
        $TestScriptPath = Join-Path $WorkspacePath "test-shell-integration.ps1"
        
        # Backup existing test script
        if (Test-Path $TestScriptPath) {
            Backup-ExistingFile -FilePath $TestScriptPath
        }
        
        $TestScriptContent = @'
# Test Shell Integration Script
# This script demonstrates VS Code shell integration features

Write-Host "Testing VS Code Shell Integration Features..." -ForegroundColor Green

# Test 1: Command with success
Write-Host "`n1. Testing successful command:" -ForegroundColor Yellow
Get-Date

# Test 2: Command with failure (to test error decorations)
Write-Host "`n2. Testing failed command:" -ForegroundColor Yellow
try {
    Get-Item "NonExistentFile.txt" -ErrorAction Stop
} catch {
    Write-Host "Command failed as expected (this demonstrates error decorations)" -ForegroundColor Red
}

# Test 3: Directory listing (for link detection)
Write-Host "`n3. Testing file link detection:" -ForegroundColor Yellow
Get-ChildItem -Name *.json | Select-Object -First 5

# Test 4: Git commands (if in git repo)
Write-Host "`n4. Testing git integration:" -ForegroundColor Yellow
if (Get-Command git -ErrorAction SilentlyContinue) {
    git status --short 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Not in a git repository or git not available" -ForegroundColor Gray
    }
} else {
    Write-Host "Git not available" -ForegroundColor Gray
}

# Test 5: Working directory
Write-Host "`n5. Current working directory:" -ForegroundColor Yellow
Write-Host (Get-Location).Path -ForegroundColor White

Write-Host "`nShell integration test completed!" -ForegroundColor Green
Write-Host "`nLook for:" -ForegroundColor Cyan
Write-Host "- Blue/red circles next to commands (decorations)" -ForegroundColor Cyan
Write-Host "- Command guide bars on the left" -ForegroundColor Cyan
Write-Host "- Clickable file links" -ForegroundColor Cyan
Write-Host "- Try Ctrl+Alt+R for recent commands" -ForegroundColor Cyan
Write-Host "- Try Ctrl+G for recent directories" -ForegroundColor Cyan
'@
        
        $TestScriptContent | Set-Content -Path $TestScriptPath -Encoding UTF8
        Write-ColorOutput "Test script created: $TestScriptPath" "Success"
        
        # Create a simple batch script for easy execution
        $BatchScriptPath = Join-Path $WorkspacePath "test-shell-integration.bat"
        $BatchContent = "@echo off`npowershell.exe -ExecutionPolicy Bypass -File `"%~dp0test-shell-integration.ps1`"`npause"
        $BatchContent | Set-Content -Path $BatchScriptPath -Encoding ASCII
        Write-ColorOutput "Batch launcher created: $BatchScriptPath" "Success"
    }
    catch {
        Write-ColorOutput "Failed to create test scripts: $($_.Exception.Message)" "Error"
        throw
    }
}

function Show-Instructions {
    Write-Header "Setup Complete! Next Steps"
    
    Write-ColorOutput "Shell integration has been configured successfully!" "Success"
    Write-Host ""
    
    Write-ColorOutput "To activate the changes:" "Info"
    Write-Host "1. Restart VS Code or reload the window (Ctrl+Shift+P -> 'Developer: Reload Window')"
    Write-Host "2. Open a new terminal (Ctrl+Shift+`) - it should use PowerShell by default"
    Write-Host "3. Run the test script: .\test-shell-integration.ps1"
    Write-Host ""
    
    Write-ColorOutput "Features you'll get:" "Info"
    Write-Host "• Command Decorations: Blue circles for success, red for failures"
    Write-Host "• Command Navigation: Ctrl+Up/Down to navigate between commands"
    Write-Host "• Command Guide: Vertical bars showing command boundaries"
    Write-Host "• Quick Fixes: Intelligent suggestions for common issues"
    Write-Host "• Recent Commands: Ctrl+Alt+R to access command history"
    Write-Host "• IntelliSense: File/command completion in terminal"
    Write-Host "• Working Directory Detection: Better file link resolution"
    Write-Host ""
    
    Write-ColorOutput "Keyboard Shortcuts:" "Info"
    Write-Host "• Ctrl+Up/Down - Navigate between commands"
    Write-Host "• Shift+Ctrl+Up/Down - Select command output"
    Write-Host "• Ctrl+Alt+R - Run recent command"
    Write-Host "• Ctrl+G - Go to recent directory"
}

function Test-Prerequisites {
    Write-Header "Checking Prerequisites"
    
    # Check if VS Code is installed
    if (-not (Test-VSCodeInstalled)) {
        Write-ColorOutput "VS Code is not installed or not in PATH" "Error"
        Write-ColorOutput "Please install VS Code and ensure 'code' command is available" "Error"
        exit 1
    }
    Write-ColorOutput "VS Code is installed and accessible" "Success"
    
    # Check PowerShell version
    $PSVersion = $PSVersionTable.PSVersion
    if ($PSVersion.Major -lt 5) {
        Write-ColorOutput "PowerShell version $PSVersion is too old. Please upgrade to PowerShell 5.1 or later" "Error"
        exit 1
    }
    Write-ColorOutput "PowerShell version $PSVersion is supported" "Success"
    
    # Check if workspace folder exists
    if (-not (Test-Path $WorkspaceFolder)) {
        Write-ColorOutput "Workspace folder does not exist: $WorkspaceFolder" "Error"
        exit 1
    }
    Write-ColorOutput "Workspace folder exists: $WorkspaceFolder" "Success"
}

# Main execution
try {
    Write-Header "VS Code Shell Integration Setup for Windows"
    Write-ColorOutput "This script will configure VS Code shell integration on your Windows system" "Info"
    Write-ColorOutput "Workspace: $WorkspaceFolder" "Info"
    
    if (-not $Force) {
        $Response = Read-Host "`nDo you want to continue? (Y/n)"
        if ($Response -match '^[Nn]') {
            Write-ColorOutput "Setup cancelled by user" "Warning"
            exit 0
        }
    }
    
    # Run setup steps
    Test-Prerequisites
    Set-PowerShellProfile
    Set-VSCodeWorkspaceSettings -WorkspacePath $WorkspaceFolder
    New-TestScript -WorkspacePath $WorkspaceFolder
    Show-Instructions
    
    Write-ColorOutput "`nSetup completed successfully!" "Success"
}
catch {
    Write-ColorOutput "`nSetup failed: $($_.Exception.Message)" "Error"
    Write-ColorOutput "Please check the error above and try again" "Error"
    exit 1
}
