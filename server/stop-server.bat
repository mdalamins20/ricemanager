@echo off
echo ==============================================
echo   Stopping Meal Manager WhatsApp Bot Server
echo ==============================================
echo Searching for process on port 5000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING') do (
    echo Terminating PID: %%a
    taskkill /F /PID %%a >nul 2>&1
)
echo Server stopped successfully.
pause
