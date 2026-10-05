@echo off
echo Сборка RetroCard Local Agent (.exe). Нужен Node.js 18+ (https://nodejs.org)
call npm install
call npx pkg . --targets node18-win-x64 --output dist/RetroCard-Local-Agent.exe
echo Готово: dist\RetroCard-Local-Agent.exe
pause
