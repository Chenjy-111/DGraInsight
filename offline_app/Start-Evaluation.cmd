@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-Offline.ps1"
set "evaluation_exit=%errorlevel%"
if not "%evaluation_exit%"=="0" echo Evaluation exited with code %evaluation_exit%. Check the last message and logs folder.
echo Press any key to close this window.
pause >nul
exit /b %evaluation_exit%
