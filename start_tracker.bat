@echo off
title Eiyuden Chronicle Gameplay Tracker
echo Starting Eiyuden Chronicle Gameplay Tracker...
echo.

where python >nul 2>nul
if %errorlevel% equ 0 (
    python server.py --open
    goto done
)

where py >nul 2>nul
if %errorlevel% equ 0 (
    py -3 server.py --open
    goto done
)

echo.
echo Failed to find Python. Please ensure Python 3 is installed and added to PATH.
pause

:done
