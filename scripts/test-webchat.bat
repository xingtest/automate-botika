@echo off
echo ========================================
echo Testing Webchat Platform
echo ========================================
set PLATFORM=webchat
npm run build
node dist/main.js
