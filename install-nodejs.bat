@echo off
echo Node.js 설치를 시작합니다...

echo.
echo 1. Node.js 다운로드 중...
powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi' -OutFile 'nodejs-installer.msi'"

echo.
echo 2. Node.js 설치 중... (관리자 권한이 필요할 수 있습니다)
msiexec /i nodejs-installer.msi /quiet /norestart

echo.
echo 3. 설치 완료 대기 중...
timeout /t 30 /nobreak

echo.
echo 4. 설치 확인 중...
node --version
npm --version

echo.
echo 5. 임시 파일 정리...
del nodejs-installer.msi

echo.
echo Node.js 설치가 완료되었습니다!
echo 새 명령 프롬프트를 열어서 사용하세요.
pause