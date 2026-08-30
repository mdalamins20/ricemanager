@echo off
setlocal enabledelayedexpansion
title GitHub Auto Push Script
color 07

echo =======================================================
echo          GitHub Auto Push ^& Sync Script
echo =======================================================
echo.

:: 1. Check if it is a valid Git repository
if not exist ".git" (
    color 0C
    echo [ERROR] Sir, this is not a Git repository! No .git folder found.
    echo Please initialize with "git init" and connect to GitHub first.
    echo.
    pause
    exit /b
)

:: 2. Detect the current branch
FOR /F "tokens=*" %%g IN ('git branch --show-current') do (SET CURRENT_BRANCH=%%g)
if "%CURRENT_BRANCH%"=="" SET CURRENT_BRANCH=main

echo [INFO] Current Branch: !CURRENT_BRANCH!
echo.

:: 3. Show what code is new/modified (Files to be pushed)
echo =======================================================
echo [LOG] NEW / MODIFIED FILES TO PUSH:
git status -s
echo =======================================================
echo.

:: 4. Ask for a commit message
set /p commit_msg="Enter commit message (Leave blank for auto-timestamp): "
if "!commit_msg!"=="" set commit_msg=Auto Push Update - %date% %time%

echo.
echo [INFO] Staging all files...
git add .

echo [INFO] Committing changes...
git commit -m "!commit_msg!"

echo.
echo [INFO] Attempting standard push to GitHub...
:: Redirecting standard error to a temporary log file to read it if it fails
git push origin !CURRENT_BRANCH! 2> push_error_log.txt

:: 5. Handle conflicts and force push
if !errorlevel! neq 0 (
    color 0C
    echo.
    echo [ERROR] Sir, a conflict or error occurred during the normal push!
    echo =======================================================
    echo [LOG] DETAILED ERROR MESSAGE:
    type push_error_log.txt
    echo =======================================================
    echo.
    
    color 0E
    echo [ACTION] Force pushing to delete old remote code and upload local code...
    
    git push --force origin !CURRENT_BRANCH! 2> force_push_error_log.txt
    
    if !errorlevel! neq 0 (
        color 0C
        echo.
        echo [CRITICAL ERROR] Sir, force push also failed!
        echo =======================================================
        echo [LOG] FORCE PUSH ERROR DETAILS:
        type force_push_error_log.txt
        echo =======================================================
    ) else (
        color 0A
        echo.
        echo [SUCCESS] Conflict resolved! Local code successfully force-pushed to GitHub.
    )
) else (
    color 0A
    echo.
    echo [SUCCESS] Code successfully pushed to GitHub without any conflicts, Sir!
)

:: 6. Clean up temporary error log files
if exist push_error_log.txt del push_error_log.txt
if exist force_push_error_log.txt del force_push_error_log.txt

:: 7. Show final commit history to verify what was successfully pushed
echo.
echo =======================================================
echo [LOG] RECENT COMMIT HISTORY (What is currently on GitHub):
git log --oneline -n 5
echo =======================================================
echo.

pause