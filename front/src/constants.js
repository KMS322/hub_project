// 환경 변수에서 API URL 가져오기, 없으면 현재 호스트 기반으로 자동 설정
const getApiUrl = () => {
  // 환경 변수가 설정되어 있으면 사용
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // 환경 변수가 없으면 현재 호스트 기반으로 자동 설정
  // 개발 환경: localhost:5000
  // 프로덕션: 현재 호스트의 5000 포트
  if (import.meta.env.DEV) {
    return 'http://localhost:5000';
  }
  
  // 프로덕션 환경에서는 현재 호스트 사용 (포트 5000)
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  return `${protocol}//${hostname}:5000`;
};

export const API_URL = getApiUrl();
export const MQTT_BROKER_URL = import.meta.env.VITE_MQTT_BROKER_URL || 'ws://localhost:9001'; // MQTT over WebSocket
