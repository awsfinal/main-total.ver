@echo off
echo 윈도우 방화벽에서 Node.js 포트 3001 허용하기

echo.
echo 1. 인바운드 규칙 추가 (포트 3001)
netsh advfirewall firewall add rule name="Node.js Backend Port 3001" dir=in action=allow protocol=TCP localport=3001

echo.
echo 2. 아웃바운드 규칙 추가 (포트 3001)  
netsh advfirewall firewall add rule name="Node.js Backend Port 3001 Out" dir=out action=allow protocol=TCP localport=3001

echo.
echo 3. 현재 PC의 IP 주소 확인:
ipconfig | findstr "IPv4"

echo.
echo 방화벽 규칙이 추가되었습니다!
echo 위에 표시된 IP 주소를 프론트엔드 코드의 possibleIPs에 추가하세요.
pause