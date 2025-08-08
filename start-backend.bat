@echo off
echo 백엔드 서버를 시작합니다...
cd /d "C:\Users\DSO19\Desktop\maybe.main2\backend"

echo Node.js 버전 확인:
"C:\Program Files\nodejs\node.exe" -v

echo.
echo 백엔드 서버 시작 중... (포트 3001)
"C:\Program Files\nodejs\node.exe" server.js

pause