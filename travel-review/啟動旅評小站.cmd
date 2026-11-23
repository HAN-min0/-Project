@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
where node.exe >nul 2>&1
if errorlevel 1 (
  echo 找不到 Node.js。請先安裝 Node.js 24 或 26，完成後重新開啟此檔案。
  pause
  exit /b 1
)
where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo 找不到 npm。請確認 Node.js 安裝選項包含 npm 與加入 PATH。
  pause
  exit /b 1
)
node -e "if (![24,26].includes(Number(process.versions.node.split('.')[0]))) process.exit(1)"
if errorlevel 1 (
  echo 此專案已確認支援 Node.js 24 與 26，請使用其中一個版本。
  pause
  exit /b 1
)
if not exist "node_modules\.package-lock.json" (
  echo 正在安裝套件，首次啟動需要網路連線...
  call npm.cmd ci
  if errorlevel 1 goto failed
)
echo 正在建置旅評小站...
call npm.cmd run build
if errorlevel 1 goto failed
echo.
echo 這是本機驗證模式。正式線上展示請使用 Render 提供的網址。
echo 啟動後請在瀏覽器開啟 http://127.0.0.1:3000/
echo 使用期間請保持此視窗開啟，停止時按 Ctrl+C。
call npm.cmd run demo
if errorlevel 1 goto failed
exit /b 0
:failed
echo.
echo 啟動未完成，請保留上方錯誤訊息以便檢查。
pause
exit /b 1
