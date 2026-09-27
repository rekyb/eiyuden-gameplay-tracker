@echo off
title Eiyuden Chronicle Save Tracker
echo Starting Eiyuden Chronicle Save Tracker...
echo.
python server.py --open
if errorlevel 1 (
    echo.
    echo Failed to start server. Make sure Python 3 is installed.
    pause
)
