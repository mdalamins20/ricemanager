@echo off
setlocal
echo ======================================================
echo   Meal Manager - Install Silent Auto-Start on Boot
echo ======================================================
echo.

set SCRIPT_DIR=%~dp0
set VBS_PATH=%SCRIPT_DIR%run-whatsapp.vbs
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT_PATH=%STARTUP_DIR%\MealManagerWhatsAppBot.lnk

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%VBS_PATH%\"'; $s.WorkingDirectory = '%SCRIPT_DIR%'; $s.WindowStyle = 7; $s.Description = 'Meal Manager WhatsApp Automation Bot'; $s.Save()"

if exist "%SHORTCUT_PATH%" (
    echo [SUCCESS] WhatsApp Auto-start successfully enabled!
    echo Windows on/boot korar sathe sathe background-e server run hobe.
    echo Kono black command box asbe na.
    echo.
    echo Ekhon background-e server start kora hochhe...
    wscript.exe "%VBS_PATH%"
    echo Server chalu hoye gese! Browser-e giye http://localhost:5000 check korun.
) else (
    echo [FAILED] Shortcut toiri kora jay ni. Manual vabe run-whatsapp.vbs chalan.
)

echo.
pause
