@echo off
echo VS Code Shell Integration Setup for Windows
echo ==========================================
echo.
echo This script will configure VS Code shell integration automatically.
echo.
powershell.exe -ExecutionPolicy Bypass -File "%~dp0setup-vscode-shell-integration.ps1" %*
echo.
pause
