' Meal Manager WhatsApp Background Launcher
' Runs node server.js silently without any command prompt window
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = currentDir
WshShell.Run "node server.js", 0, False
Set WshShell = Nothing
Set fso = Nothing
