@echo off
echo ========================================
echo Testing DHAI Platform
echo ========================================
set PLATFORM=dhai
npm run build
node dist/main.js
