@echo off
echo ========================================
echo Testing Facebook Platform
echo ========================================
set PLATFORM=facebook
npm run build
node dist/main.js
