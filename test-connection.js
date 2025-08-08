// 백엔드-프론트엔드 연동 테스트 스크립트
const http = require('http');

// 테스트용 GPS 데이터
const testGpsData = {
  latitude: 37.5788,
  longitude: 126.9770,
  heading: 45.5,
  accuracy: 10.2,
  timestamp: Date.now(),
  deviceType: 'Test',
  headingSource: 'GPS',
  requestId: 'test-123'
};

// POST 요청 데이터 준비
const postData = JSON.stringify(testGpsData);

// 백엔드 서버 연결 테스트
const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/gps',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🔍 백엔드-프론트엔드 연동 테스트 시작...\n');

const req = http.request(options, (res) => {
  console.log(`✅ 백엔드 서버 응답 상태: ${res.statusCode}`);
  console.log(`📋 응답 헤더:`, res.headers);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('\n📊 서버 응답 데이터:');
      console.log(JSON.stringify(response, null, 2));
      
      if (response.success) {
        console.log('\n✅ 연동 테스트 성공!');
        console.log(`📍 식별된 건물: ${response.data.building?.name || '없음'}`);
        console.log(`🏛️ 경복궁 내부: ${response.data.isInGyeongbokgung ? '예' : '아니오'}`);
      } else {
        console.log('\n❌ 연동 테스트 실패:', response.message);
      }
    } catch (error) {
      console.log('\n❌ 응답 파싱 오류:', error.message);
      console.log('원본 응답:', data);
    }
  });
});

req.on('error', (error) => {
  console.log('\n❌ 연결 오류:', error.message);
  console.log('💡 백엔드 서버가 실행 중인지 확인하세요 (포트 3001)');
});

// 요청 전송
req.write(postData);
req.end();

// 추가 API 엔드포인트 테스트
setTimeout(() => {
  console.log('\n🔍 건물 목록 API 테스트...');
  
  const listOptions = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/buildings',
    method: 'GET'
  };
  
  const listReq = http.request(listOptions, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log(`✅ 건물 목록 API 응답: ${response.buildings?.length || 0}개 건물`);
      } catch (error) {
        console.log('❌ 건물 목록 API 오류:', error.message);
      }
    });
  });
  
  listReq.on('error', (error) => {
    console.log('❌ 건물 목록 API 연결 오류:', error.message);
  });
  
  listReq.end();
}, 1000);