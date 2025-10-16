@echo off
echo ========================================
echo Testing Telegram Platform
echo ========================================
set PLATFORM=telegram
npm run build
node dist/main.js
