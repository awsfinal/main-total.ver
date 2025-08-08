import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// 분리된 유틸리티 및 훅 import
import { gyeongbokgungBuildings, getEnglishName, getBuildYear, getCulturalProperty, getFeatures, getDetailedDescription, isInGyeongbokgung } from '../utils/buildingData';
import { calculateDistance, getCompassDirection } from '../utils/gpsUtils';
import { findBuildingFromMap, findClosestBuildingFallback } from '../utils/buildingSearch';
import { useCompass } from '../hooks/useCompass';

// CSS 애니메이션을 위한 스타일 추가
const spinKeyframes = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

// 스타일 태그를 head에 추가
if (!document.querySelector('#camera-animations')) {
  const style = document.createElement('style');
  style.id = 'camera-animations';
  style.textContent = spinKeyframes;
  document.head.appendChild(style);
}

function CameraPage() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  // 상태 관리
  const [stream, setStream] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentGPS, setCurrentGPS] = useState(null);
  const [gpsReadings, setGpsReadings] = useState([]);
  const [isInitialGPSComplete, setIsInitialGPSComplete] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [locationStatus, setLocationStatus] = useState('위치 확인 중...');
  const [currentHeading, setCurrentHeading] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  
  // 칼만필터 인스턴스 (지연 초기화)
  const kalmanFilterRef = useRef(null);
  
  const getKalmanFilter = () => {
    if (!kalmanFilterRef.current) {
      kalmanFilterRef.current = new KalmanFilter();
    }
    return kalmanFilterRef.current;
  };

  // 나침반 센서 초기화 (커스텀 훅 사용)
  useCompass(isIOS, isAndroid, setCurrentHeading);

  useEffect(() => {
    // 기기 타입 감지
    const userAgent = navigator.userAgent;
    setIsIOS(/iPhone|iPad|iPod/i.test(userAgent));
    setIsAndroid(/Android/i.test(userAgent));

    // 카메라 시작
    startCamera();
    // GPS 5초마다 체크 시작
    startGPSTracking();

    return () => {
      stopCamera();
      stopGPSTracking();
    };
  }, []);

  // 페이지 포커스/블러 이벤트로 GPS 제어
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // 페이지가 숨겨지면 GPS 중지
        console.log('📱 CameraPage 비활성화 - GPS 업데이트 중지');
        stopGPSTracking();
      } else if (window.location.pathname === '/camera') {
        // CameraPage에서만 GPS 재시작
        console.log('📱 CameraPage 활성화 - GPS 업데이트 재시작');
        startGPSTracking();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const startCamera = async () => {
    try {
      setIsLoading(true);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'environment' // 후면 카메라 우선 (모바일에서)
        },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        setError(null);
      }
      setIsLoading(false);
    } catch (err) {
      console.error('카메라 접근 오류:', err);
      setError('카메라에 접근할 수 없습니다. 카메라 권한을 확인해주세요.');
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  // 모바일 친화적 GPS 권한 요청
  const requestLocationPermission = async () => {
    if (isIOS && 'DeviceOrientationEvent' in window && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const permission = await DeviceOrientationEvent.requestPermission();
        console.log('📱 iOS 방위각 권한:', permission);
      } catch (error) {
        console.warn('⚠️ iOS 방위각 권한 요청 실패:', error);
      }
    }
    
    if ('permissions' in navigator) {
      try {
        const result = await navigator.permissions.query({name: 'geolocation'});
        console.log('📱 위치 권한 상태:', result.state);
      } catch (error) {
        console.warn('⚠️ 권한 상태 확인 실패:', error);
      }
    }
  };

  const [gpsInterval, setGpsInterval] = useState(null);

  // GPS 초기 측정 (5초간 10번 측정 후 평균)
  const startInitialGPSMeasurement = async () => {
    if (!navigator.geolocation) {
      setLocationStatus('❌ GPS를 지원하지 않는 기기입니다.');
      return;
    }

    await requestLocationPermission();
    setLocationStatus('📡 정확한 GPS 측정 중... (0/10)');
    
    const readings = [];
    
    // 칼만필터 리셋 (새로운 측정 세션 시작)
    getKalmanFilter().reset();
    
    for (let i = 0; i < 3; i++) {
      try {
        const position = await getSingleGPSReading();
        const measurement = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        
        // 원본 GPS 측정값 로그 출력
        console.log(`📍 원본 GPS ${i+1}:`, {
          lat: measurement.latitude.toFixed(7),
          lng: measurement.longitude.toFixed(7),
          acc: Math.round(measurement.accuracy)
        });
        
        // 첫 번째와 비교
        if (i > 0) {
          const prevReading = readings[readings.length - 1];
          const latDiff = Math.abs(measurement.latitude - prevReading.latitude) * 111000; // 미터 단위
          const lngDiff = Math.abs(measurement.longitude - prevReading.longitude) * 111000;
          console.log(`📏 이전 측정과의 거리 차이: 위도 ${latDiff.toFixed(2)}m, 경도 ${lngDiff.toFixed(2)}m`);
        }
        
        // 칼만필터 적용 전후 비교
        const filtered = getKalmanFilter().update(measurement);
        console.log(`🔄 필터링 전후 비교 ${i+1}:`);
        console.log(`   입력: ${measurement.latitude.toFixed(7)}, ${measurement.longitude.toFixed(7)}`);
        console.log(`   출력: ${filtered.latitude.toFixed(7)}, ${filtered.longitude.toFixed(7)}`);
        readings.push(filtered);
        
        setLocationStatus(`📡 칼만필터 GPS 측정 중... (${i+1}/3)`);
        await new Promise(resolve => setTimeout(resolve, 500)); // 0.5초 대기
      } catch (error) {
        console.error(`GPS 측정 ${i+1} 실패:`, error);
      }
    }
    
    console.log(`📊 총 ${readings.length}개의 GPS 측정값 수집 완료`);
    
    if (readings.length >= 3) {
      const avgGPS = calculateAverageGPS(readings);
      setCurrentGPS(avgGPS);
      setIsInitialGPSComplete(true);
      setLocationStatus(`✅ 칼만필터 GPS 완료 (정확도: ${Math.round(avgGPS.accuracy)}m)`);
      console.log('🎯 최종 GPS 좌표:', avgGPS);
      
      // 백엔드로 GPS 데이터 전송
      await sendGPSToBackend(avgGPS);
      
      startRegularGPSTracking();
    } else {
      setLocationStatus('❌ GPS 측정 실패 - 재시도 중...');
      setTimeout(() => startInitialGPSMeasurement(), 3000);
    }
  };

  // 단일 GPS 측정 (매번 새롭게 측정)
  const getSingleGPSReading = () => {
    return new Promise((resolve, reject) => {
      const gpsOptions = {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0  // 캐시 사용 안함
      };
      
      navigator.geolocation.getCurrentPosition(resolve, reject, gpsOptions);
    });
  };

// 칼만필터 클래스 (컴포넌트 외부에 정의)
class KalmanFilter {
  constructor() {
    this.reset();
  }
  
  reset() {
    this.x = { lat: 0, lng: 0 };
    this.P = { lat: 8000, lng: 8000 };
    this.Q = { lat: 50, lng: 50 }; // 8 -> 50 (대폭 증가로 고착 방지)
    this.initialized = false;
    this.count = 0;
    console.log('칼만필터 리셋 완료');
  }
    
  update(measurement) {
    this.count++;
    console.log(`칼만필터 ${this.count}번째 측정:`, measurement.latitude, measurement.longitude);
      
    if (!this.initialized) {
      this.x.lat = measurement.latitude;
      this.x.lng = measurement.longitude;
      this.initialized = true;
      console.log('칼만필터 초기화:', this.x);
      return {
        latitude: measurement.latitude,
        longitude: measurement.longitude,
        accuracy: measurement.accuracy
      };
    }
    
    const R = {
      lat: Math.max(measurement.accuracy / 2.5, 40), // /2 -> /2.5, 50 -> 40
      lng: Math.max(measurement.accuracy / 2.5, 40)
    };
    
    const x_pred = { lat: this.x.lat, lng: this.x.lng };
    const P_pred = { lat: this.P.lat + this.Q.lat, lng: this.P.lng + this.Q.lng };
    
    const K = {
      lat: P_pred.lat / (P_pred.lat + R.lat),
      lng: P_pred.lng / (P_pred.lng + R.lng)
    };
    
    console.log('칼만 게인:', K);
    
    this.x.lat = x_pred.lat + K.lat * (measurement.latitude - x_pred.lat);
    this.x.lng = x_pred.lng + K.lng * (measurement.longitude - x_pred.lng);
    
    this.P.lat = (1 - K.lat) * P_pred.lat;
    this.P.lng = (1 - K.lng) * P_pred.lng;
    
    console.log('칼만필터 결과:', this.x);
    
    return {
      latitude: this.x.lat,
      longitude: this.x.lng,
      accuracy: Math.sqrt(this.P.lat + this.P.lng)
    };
  }
}

  // 칼만필터 결과 GPS 계산 (소수점 7자리)
  const calculateAverageGPS = (readings) => {
    console.log('전체 칼만필터 결과:', readings);
    
    const finalReading = readings[readings.length - 1];
    const avgAccuracy = readings.reduce((sum, r) => sum + r.accuracy, 0) / readings.length;
    
    console.log('🔍 칼만필터 최종 결과:', finalReading);
    console.log('첫 번째 측정:', readings[0]);
    console.log('마지막 측정:', finalReading);
    
    return {
      latitude: parseFloat(finalReading.latitude.toFixed(7)),
      longitude: parseFloat(finalReading.longitude.toFixed(7)),
      accuracy: avgAccuracy,
      heading: currentHeading,
      timestamp: Date.now(),
      deviceType: isIOS ? 'iOS' : isAndroid ? 'Android' : 'Other',
      captureTime: new Date().toISOString(),
      measurementCount: readings.length
    };
  };

  // 정기 GPS 업데이트 시작
  const startRegularGPSTracking = () => {
    const interval = setInterval(() => {
      updateGPS();
    }, 10000); // 10초마다

    setGpsInterval(interval);
  };

  // 기존 GPS 업데이트 함수 (정기 업데이트용)
  const startGPSTracking = () => {
    startInitialGPSMeasurement();
  };

  // GPS 체크 중지
  const stopGPSTracking = () => {
    if (gpsInterval) {
      clearInterval(gpsInterval);
      setGpsInterval(null);
    }
  };

  // GPS 업데이트 (소수점 7자리)
  const updateGPS = () => {
    const gpsOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 1000
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const gpsData = {
          latitude: parseFloat(position.coords.latitude.toFixed(7)),
          longitude: parseFloat(position.coords.longitude.toFixed(7)),
          heading: position.coords.heading || currentHeading,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
          deviceType: isIOS ? 'iOS' : isAndroid ? 'Android' : 'Other',
          captureTime: new Date().toISOString()
        };

        setCurrentGPS(gpsData);
        setLocationStatus(`📡 GPS 업데이트 완료 (정확도: ${Math.round(position.coords.accuracy)}m)`);
        console.log('📍 GPS 업데이트:', gpsData.latitude, gpsData.longitude, '정확도:', Math.round(position.coords.accuracy) + 'm');
      },
      (error) => {
        console.error('GPS 업데이트 실패:', error.message);
        setLocationStatus('❌ GPS 측정 실패 - 재시도 중...');
      },
      gpsOptions
    );
  };

  // 백엔드로 GPS 데이터 전송 (휴대폰 대응)
  const sendGPSToBackend = async (gpsData) => {
    try {
      // 여러 IP 주소 시도 (실제 PC IP로 변경 필요)
      const possibleIPs = [
        '192.168.0.100',  // 일반적인 공유기 IP 대역
        '192.168.1.100',  // 다른 일반적인 IP 대역
        '10.0.0.100',     // 또 다른 사설 IP 대역
        window.location.hostname,
        'localhost',
        '127.0.0.1'
      ];
      
      console.log('📱 휴대폰에서 백엔드 연결 시도...');
      console.log('📍 전송할 GPS 데이터:', JSON.stringify(gpsData, null, 2));
      
      for (const ip of possibleIPs) {
        const url = `http://${ip}:3001/api/gps`;
        try {
          console.log(`🔗 시도 중: ${url}`);
          
          const response = await fetch(url, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(gpsData)
          });
          
          console.log(`📶 ${url} 응답 상태:`, response.status);
          
          if (response.ok) {
            const result = await response.json();
            console.log('✅ 백엔드 전송 성공:', result);
            return result;
          } else {
            const errorText = await response.text();
            console.warn(`⚠️ ${url} 오류 응답:`, errorText);
          }
        } catch (error) {
          console.warn(`❌ ${url} 연결 실패:`, error.name, error.message);
        }
      }
      
      console.error('❌ 모든 백엔드 URL 연결 실패');
      console.log('📝 백엔드 서버가 실행 중인지 확인하고, PC의 실제 IP 주소를 possibleIPs 배열에 추가하세요.');
      
    } catch (error) {
      console.error('❌ 백엔드 전송 오류:', error);
    }
  };



  // GPS 3회 측정 후 평균값 계산
  const getFreshGPS = () => {
    return new Promise(async (resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('이 기기는 GPS를 지원하지 않습니다.'));
        return;
      }

      const requestTime = new Date().getTime();
      console.log(`🛰️ GPS 2회 측정 시작 [${requestTime}] - ${new Date().toLocaleTimeString()}`);
      
      const gpsOptions = {
        enableHighAccuracy: true,    
        timeout: 15000,
        maximumAge: 0
      };

      const getSingleGPS = (measurementNum) => {
        return new Promise((resolve, reject) => {
          console.log(`📡 GPS 측정 ${measurementNum}/2`);
          
          navigator.geolocation.getCurrentPosition(
            (position) => {
              console.log(`✅ GPS 측정 ${measurementNum} 성공`);
              console.log(`   위도: ${position.coords.latitude}`);
              console.log(`   경도: ${position.coords.longitude}`);
              resolve(position);
            },
            (error) => {
              console.error(`❌ GPS 측정 ${measurementNum} 실패:`, error.message);
              reject(error);
            },
            gpsOptions
          );
        });
      };

      try {
        // 2번 측정
        const position1 = await getSingleGPS(1);
        await new Promise(resolve => setTimeout(resolve, 1000));
        const position2 = await getSingleGPS(2);

        // 평균 계산
        const avgLatitude = (position1.coords.latitude + position2.coords.latitude) / 2;
        const avgLongitude = (position1.coords.longitude + position2.coords.longitude) / 2;
        const avgAccuracy = (position1.coords.accuracy + position2.coords.accuracy) / 2;
        
        console.log('📊 GPS 평균값 계산 완료:');
        console.log(`   평균 위도: ${avgLatitude}`);
        console.log(`   평균 경도: ${avgLongitude}`);

        // 평균값으로 가상의 position 객체 생성
        const avgPosition = {
          coords: {
            latitude: avgLatitude,
            longitude: avgLongitude,
            accuracy: avgAccuracy,
            altitude: position2.coords.altitude,
            heading: position2.coords.heading,
            speed: position2.coords.speed
          },
          timestamp: position2.timestamp
        };

        // GPS 데이터 포맷팅
        let finalHeading = null;
        let headingSource = '측정 불가';
        
        if (avgPosition.coords.heading !== null && avgPosition.coords.heading !== undefined) {
          finalHeading = avgPosition.coords.heading;
          headingSource = 'GPS';
        } else if (currentHeading !== null) {
          finalHeading = currentHeading;
          headingSource = '나침반';
        }

        const result = {
          latitude: Math.floor(avgPosition.coords.latitude * 10000000) / 10000000,  // 소수점 7자리로 제한
          longitude: Math.floor(avgPosition.coords.longitude * 10000000) / 10000000,
          heading: finalHeading,
          accuracy: avgPosition.coords.accuracy,
          altitude: avgPosition.coords.altitude,
          speed: avgPosition.coords.speed,
          timestamp: avgPosition.timestamp,
          deviceType: isIOS ? 'iOS' : isAndroid ? 'Android' : 'Other',
          headingSource: headingSource,
          requestId: requestTime.toString(),
          captureTime: new Date().toISOString(),
          measurementCount: 2
        };

        console.log('📊 최종 GPS 데이터:', result);
        resolve(result);
      } catch (error) {
        reject(new Error(`GPS 2회 측정 실패: ${error.message}`));
      }
    });
  };
  
  // 두 좌표 간 직선거리 계산 (미터)
  const calculateDirectDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371000; // 지구 반지름 (미터)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c);
  };
  


  // 사진 촬영 및 분석
  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) {
      return;
    }

    try {
      setIsAnalyzing(true);
      
      console.log('📸 촬영 버튼 클릭');

      // 캔버스에 현재 비디오 프레임 캡처
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);

      // 2초 후 자연스럽게 경회루 페이지로 이동
      setTimeout(() => {
        console.log('📍 DetailPage로 전달할 GPS 데이터:', currentGPS);
        console.log('🚫 DetailPage 이동 - GPS 업데이트 중지');
        stopGPSTracking();
        setIsAnalyzing(false);
        navigate('/detail/gyeonghoeru', { state: { gpsData: currentGPS } });
      }, 2000);

    } catch (error) {
      console.error('사진 촬영 오류:', error);
      setIsAnalyzing(false);
    }
  };

  const handleCancel = () => {
    navigate('/main');
  };

  const handleRetake = async () => {
    console.log('🔄 재촬영 - 상태 초기화');
    
    setIsAnalyzing(false);
    setError(null);
    setCurrentGPS(null);
    setLocationStatus('⚡ GPS 재시작 중...');
    
    await startCamera();
    stopGPSTracking();
    startGPSTracking();
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      backgroundColor: '#000'
    }}>
      {/* Camera View */}
      <div style={{
        flex: 1,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {/* 로딩 상태 */}
        {isLoading && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#000',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            padding: '20px',
            textAlign: 'center'
          }}>
            <div style={{
              width: '50px',
              height: '50px',
              border: '3px solid #333',
              borderTop: '3px solid #fff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: '20px'
            }}></div>
            <p>카메라를 준비하고 있습니다...</p>
          </div>
        )}

        {/* 카메라 화면 */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: isLoading ? 'none' : 'block'
          }}
        />

        {/* 위치 상태 표시 */}
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          right: '20px',
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '14px',
          textAlign: 'center',
          zIndex: 1000
        }}>
          {locationStatus}
          {currentHeading !== null && (
            <div style={{ fontSize: '12px', marginTop: '2px', opacity: 0.8 }}>
              방위: {Math.round(currentHeading)}° ({getCompassDirection(currentHeading)})
            </div>
          )}
        </div>

        {/* 분석 중 오버레이 */}
        {isAnalyzing && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            zIndex: 2000
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              border: '4px solid #333',
              borderTop: '4px solid #007AFF',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: '20px'
            }}></div>
            <p style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
              🏛️ 문화재 인식 중...
            </p>
            <p style={{ fontSize: '14px', color: '#ccc' }}>
              잠시만 기다려주세요
            </p>
          </div>
        )}

        <canvas
          ref={canvasRef}
          style={{ display: 'none' }}
        />
      </div>

      {/* Camera Controls Overlay */}
      <div style={{
        position: 'absolute',
        bottom: '120px', // 네비게이션 바 위에 위치
        left: 0,
        right: 0,
        padding: '20px',
        background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
        color: 'white'
      }}>
        {/* Tip Message */}
        <div style={{
          textAlign: 'center',
          marginBottom: '20px',
          fontSize: '14px',
          opacity: 0.9
        }}>
          <span style={{ fontWeight: 'bold' }}>tip.</span> {!isInitialGPSComplete ? 'GPS 평균 좌표 측정 중입니다...' : isIOS ? 'GPS 정확도를 위해 실외에서 촬영하세요' : isAndroid ? '위치 권한을 허용하고 실외에서 촬영하세요' : '대상이 잘 보이게 촬영해주세요'}
        </div>

        {/* Control Buttons */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '60px',
          paddingHorizontal: '20px'
        }}>
          {/* Cancel Button */}
          <button
            onClick={handleCancel}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '16px',
              cursor: 'pointer',
              padding: '10px',
              minWidth: '50px'
            }}
          >
            취소
          </button>

          {/* Capture Button */}
          <button
            onClick={handleCapture}
            disabled={!isInitialGPSComplete}
            style={{
              width: '70px',
              height: '70px',
              borderRadius: '50%',
              border: '4px solid white',
              backgroundColor: isInitialGPSComplete ? '#87CEEB' : '#ccc',
              cursor: isInitialGPSComplete ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
              opacity: isInitialGPSComplete ? 1 : 0.5
            }}
          >
            📸
          </button>

          {/* Retake Button */}
          <button
            onClick={handleRetake}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '16px',
              cursor: 'pointer',
              padding: '10px',
              minWidth: '50px'
            }}
          >
            재촬영
          </button>
        </div>
      </div>

      {/* Navigation Bar */}
      <div className="nav-bar">
        <div
          className="nav-item"
          onClick={() => navigate('/stamp')}
          style={{ cursor: 'pointer' }}
        >
          <div
            className="nav-icon"
            style={{ backgroundImage: 'url(/image/rubber-stamp.png)' }}
          ></div>
          <span>스탬프</span>
        </div>
        <div
          className="nav-item active"
          style={{ cursor: 'pointer' }}
        >
          <div
            className="nav-icon"
            style={{ backgroundImage: 'url(/image/nav_camera.png)' }}
          ></div>
          <span>사진찍기</span>
        </div>
        <div
          className="nav-item"
          onClick={() => navigate('/settings')}
          style={{ cursor: 'pointer' }}
        >
          <div
            className="nav-icon"
            style={{ backgroundImage: 'url(/image/settings.png)' }}
          ></div>
          <span>설정</span>
        </div>
      </div>
    </div>
  );
}

export default CameraPage;