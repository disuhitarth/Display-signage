@echo off
title Pizza Depot Signage - One-Click Setup
color 0C

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║                                                  ║
echo  ║   🍕 Pizza Depot Digital Signage Setup           ║
echo  ║                                                  ║
echo  ║   This will configure your store's TV displays   ║
echo  ║   to show menu content automatically.            ║
echo  ║                                                  ║
echo  ╚══════════════════════════════════════════════════╝
echo.
echo.

REM ─── Prompt for Store ID ─────────────────────────────────────────
set /p STORE_ID="Enter your Store ID (e.g. store-101): "
if "%STORE_ID%"=="" (
    echo ERROR: Store ID is required!
    pause
    exit /b 1
)

REM ─── Prompt for Server URL ───────────────────────────────────────
set /p BASE_URL="Enter signage server URL (e.g. https://signage.pizzadepot.com): "
if "%BASE_URL%"=="" (
    set BASE_URL=https://signage.pizzadepot.com
    echo Using default URL: %BASE_URL%
)

echo.
echo ─────────────────────────────────────────────────────
echo  Store ID  : %STORE_ID%
echo  Server URL: %BASE_URL%
echo ─────────────────────────────────────────────────────
echo.

REM ─── Create working directory ────────────────────────────────────
if not exist "%USERPROFILE%\PizzaSignage" mkdir "%USERPROFILE%\PizzaSignage"

REM ─── Update Store ID and URL in the PowerShell script ────────────
echo Configuring launcher script...

REM Copy the PowerShell script to the signage folder
copy /Y "%~dp0LaunchSignage.ps1" "%USERPROFILE%\PizzaSignage\LaunchSignage.ps1" >nul

REM Update the Store ID in the script
powershell -Command "(Get-Content '%USERPROFILE%\PizzaSignage\LaunchSignage.ps1') -replace 'StoreID\s*=\s*\"store-101\"', 'StoreID       = \"%STORE_ID%\"' | Set-Content '%USERPROFILE%\PizzaSignage\LaunchSignage.ps1'"

REM Update the Base URL in the script
powershell -Command "(Get-Content '%USERPROFILE%\PizzaSignage\LaunchSignage.ps1') -replace 'BaseURL\s*=\s*\"https://yoursignage.pizzadepot.com\"', 'BaseURL       = \"%BASE_URL%\"' | Set-Content '%USERPROFILE%\PizzaSignage\LaunchSignage.ps1'"

echo [OK] Script configured.

REM ─── Install to startup ──────────────────────────────────────────
echo.
echo Installing to Windows startup...
powershell -ExecutionPolicy Bypass -File "%USERPROFILE%\PizzaSignage\LaunchSignage.ps1" -Install

echo.
echo ═════════════════════════════════════════════════════
echo.
echo  ✅ SETUP COMPLETE!
echo.
echo  What happens now:
echo    1. Signage will auto-start every time this PC turns on
echo    2. It detects how many TVs are connected automatically
echo    3. Each TV shows its assigned content from the server
echo    4. If Chrome crashes, it auto-restarts within 60 seconds
echo    5. Screen saver and sleep are disabled automatically
echo.
echo  To test right now, press any key to launch the displays.
echo  Or just restart the PC and it will start on its own.
echo.
echo ═════════════════════════════════════════════════════
echo.

pause

REM ─── Launch now for immediate testing ────────────────────────────
echo.
echo Launching displays now...
start /min powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File "%USERPROFILE%\PizzaSignage\LaunchSignage.ps1" -NoWatchdog

echo.
echo Displays should be appearing on your TVs now!
echo You can close this window.
echo.
pause
