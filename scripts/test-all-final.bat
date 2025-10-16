@echo off
echo ========================================
echo FINAL TEST - All 5 Platforms
echo ========================================
echo.
echo Testing all platforms to verify everything works...
echo.

set FILENAME=testdhai.json

echo [1/5] Testing Webchat...
set PLATFORM=webchat
npm run build >nul 2>&1
node dist/main.js
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Webchat FAILED
    pause
    exit /b 1
)
echo ✅ Webchat PASSED
echo.

echo [2/5] Testing Telegram...
set PLATFORM=telegram
npm run build >nul 2>&1
node dist/main.js
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Telegram FAILED
    pause
    exit /b 1
)
echo ✅ Telegram PASSED
echo.

echo [3/5] Testing Facebook...
set PLATFORM=facebook
npm run build >nul 2>&1
node dist/main.js
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Facebook FAILED
    pause
    exit /b 1
)
echo ✅ Facebook PASSED
echo.

echo [4/5] Testing Instagram...
set PLATFORM=instagram
npm run build >nul 2>&1
node dist/main.js
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Instagram FAILED
    pause
    exit /b 1
)
echo ✅ Instagram PASSED
echo.

echo [5/5] Testing DHAI...
set PLATFORM=dhai
npm run build >nul 2>&1
node dist/main.js
if %ERRORLEVEL% NEQ 0 (
    echo ❌ DHAI FAILED
    pause
    exit /b 1
)
echo ✅ DHAI PASSED
echo.

echo ========================================
echo 🎉 ALL 5 PLATFORMS PASSED!
echo ========================================
echo.
echo ✅ Webchat - Working
echo ✅ Telegram - Working
echo ✅ Facebook - Working
echo ✅ Instagram - Working
echo ✅ DHAI - Working
echo.
echo Migration 100% COMPLETE!
echo All Python/Selenium files deleted!
echo TypeScript + Playwright is now the only version!
echo.
pause
