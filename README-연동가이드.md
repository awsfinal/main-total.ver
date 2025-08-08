# 백엔드-프론트엔드 연동 가이드

## 📋 현재 상태

### ✅ 수정 완료된 부분
1. **프록시 설정 추가**: 프론트엔드 package.json에 `"proxy": "http://localhost:3001"` 추가
2. **API 엔드포인트 통일**: 백엔드에 `/api/gps` 엔드포인트 추가
3. **CORS 설정**: 백엔드에서 CORS 미들웨어 활성화

### 🔧 연동 구조
```
프론트엔드 (포트 3000)  ←→  백엔드 (포트 3001)
     React App              Express.js API
```

## 🚀 실행 방법

### 1. 백엔드 서버 실행
```bash
cd C:\Users\DSO19\Desktop\maybe.main2\backend
npm install
npm start
```

### 2. 프론트엔드 서버 실행
```bash
cd C:\Users\DSO19\Desktop\maybe.main2\front
npm install
npm start
```

### 3. 연동 테스트
```bash
cd C:\Users\DSO19\Desktop\maybe.main2
node test-connection.js
```

## 📡 API 엔드포인트

### 프론트엔드에서 사용하는 API
- `POST /api/gps` - GPS 데이터 저장 (CameraPage에서 호출)
- `POST /api/check-location` - 위치 확인
- `POST /api/analyze-photo` - 사진 분석
- `GET /api/buildings` - 건물 목록 조회
- `GET /api/building/:id` - 특정 건물 정보

### CameraPage.js의 API 호출 부분
```javascript
const sendToServer = async (data) => {
  try {
    const response = await fetch('/api/gps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      console.log('GPS 데이터 서버 전송 성공:', data);
    }
  } catch (error) {
    console.error('서버 전송 실패:', error);
  }
};
```

## 🔍 연동 확인 방법

### 1. 브라우저 개발자 도구
- Network 탭에서 API 호출 확인
- Console에서 오류 메시지 확인

### 2. 백엔드 로그
- 서버 콘솔에서 GPS 데이터 수신 로그 확인
- API 호출 및 응답 로그 모니터링

### 3. 테스트 스크립트
- `test-connection.js` 실행하여 연동 상태 확인

## ⚠️ 주의사항

1. **포트 충돌**: 3000번(프론트), 3001번(백엔드) 포트가 사용 중이지 않은지 확인
2. **Node.js 설치**: 두 서버 모두 Node.js가 필요
3. **의존성 설치**: 각 폴더에서 `npm install` 실행 필요
4. **HTTPS 이슈**: GPS 기능은 HTTPS 환경에서만 정상 작동

## 🐛 문제 해결

### GPS 데이터가 서버로 전송되지 않는 경우
1. 백엔드 서버 실행 상태 확인
2. 프록시 설정 확인
3. 브라우저 개발자 도구에서 네트워크 오류 확인

### CORS 오류 발생 시
- 백엔드 server.js에서 CORS 설정 확인
- 프론트엔드 package.json의 proxy 설정 확인

## 📊 테스트 데이터

경복궁 건물 좌표 (테스트용):
- 경회루: 37.5788, 126.9770
- 근정전: 37.5796, 126.9770
- 사정전: 37.5801, 126.9770