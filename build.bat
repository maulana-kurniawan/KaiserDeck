@echo off
title Build Kaiser Deck EXE
echo ========================================================
echo   BUILD KAISER DECK STANDALONE EXE (by maulana-kurniawan)
echo ========================================================

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python was not found in your PATH!
    pause
    exit /b 1
)

echo [1/2] Verifying Python dependencies and PyInstaller...
python -m pip install -r requirements.txt --quiet
python -m pip install pyinstaller --quiet

echo [2/2] Compiling KaiserDeck.exe with PyInstaller...
pyinstaller --clean --noconfirm KaiserDeck.spec

if not exist dist\KaiserDeck.exe goto :build_failed

echo.
echo ========================================================
echo BUILD SUCCESSFUL!
echo Standalone executable is ready at:
echo   dist\KaiserDeck.exe
echo.
echo Note: data.json and images/ folder will be auto-generated
echo when you add your first card through the application.
echo ========================================================
pause
exit /b 0

:build_failed
echo [ERROR] Failed to compile executable.
pause
exit /b 1
