@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Lan dau chay: dang cai thu vien, vui long doi...
  call npm install
)
echo Dang bat Di Chua Online tai http://localhost:3000
start "" cmd /c "timeout /t 5 >nul & start http://localhost:3000"
npm run dev
pause
