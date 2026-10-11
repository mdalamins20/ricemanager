@echo off
title Meal Manager WhatsApp Bot Server
cd /d "%~dp0"
echo ==============================================
echo   Meal Manager WhatsApp Automation Server
echo ==============================================
echo Running on http://localhost:5000 ...
echo Close this window to stop the server.
echo.
node server.js
pause
