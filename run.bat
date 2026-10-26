@echo off
title Kaiser Deck 2.0
echo ===================================================
echo Starting Kaiser Deck 2.0 (Animal Kaiser & Play!)
echo ===================================================

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH!
    pause
    exit /b
)

echo Checking dependencies...
python -m pip install -r requirements.txt --quiet

echo Launching Kaiser Deck 2.0...
python app.py
pause
