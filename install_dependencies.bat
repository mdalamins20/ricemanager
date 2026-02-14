@echo off
echo Initializing project configuration...

:: Initialize package.json if it doesn't exist
if not exist package.json (
  call npm init -y
)

echo.
echo Installing Core Dependencies (React, Firebase, Router)...
call npm install react react-dom firebase react-router-dom lucide-react date-fns

echo.
echo Installing Development Dependencies (Vite, TypeScript)...
call npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom

echo.
echo ==============================================
echo Installation Complete!
echo.
echo To run the project locally using Vite:
echo 1. Run command: npx vite
echo ==============================================
echo.
pause