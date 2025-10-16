@echo off
echo ========================================
echo Testing Instagram Platform
echo ========================================
set PLATFORM=instagram
npm run build
node dist/main.js
