import { useEffect, useRef, useState } from 'react';
import socketService from '../services/socketService';
import { useAuthStore } from '../stores/useAuthStore';

/**
 * Socket.IO 훅
 * 컴포넌트에서 Socket.IO 통신을 쉽게 사용할 수 있도록 하는 커스텀 훅
 */
export const useSocket = () => {
  const { token } = useAuthStore();
  const [isConnected, setIsConnected] = useState(false);
  const listenersRef = useRef(new Map());

  // 연결
  useEffect(() => {
    if (!token) {
      console.warn('[useSocket] No token available');
      return;
    }

    // Socket 연결
    socketService.connect(token);

    // 연결 상태 업데이트
    const updateConnectionStatus = () => {
      setIsConnected(socketService.getConnectionStatus());
    };

    // 초기 상태 확인
    updateConnectionStatus();

    // 연결 상태 변경 리스너
    socketService.on('connect', updateConnectionStatus);
    socketService.on('disconnect', updateConnectionStatus);
    socketService.on('connected', updateConnectionStatus);

    // 정리 함수
    return () => {
      socketService.off('connect', updateConnectionStatus);
      socketService.off('disconnect', updateConnectionStatus);
      socketService.off('connected', updateConnectionStatus);
      
      // 등록된 모든 리스너 제거
      listenersRef.current.forEach((callback, event) => {
        socketService.off(event, callback);
      });
      listenersRef.current.clear();
    };
  }, [token]);

  /**
   * 이벤트 리스너 등록
   */
  const on = (event, callback) => {
    socketService.on(event, callback);
    listenersRef.current.set(event, callback);
  };

  /**
   * 이벤트 발송
   */
  const emit = (event, data) => {
    return socketService.emit(event, data);
  };

  /**
   * 이벤트 리스너 제거
   */
  const off = (event, callback) => {
    socketService.off(event, callback);
    listenersRef.current.delete(event);
  };

  return {
    isConnected,
    socket: socketService.getSocket(),
    on,
    emit,
    off,
    socketService
  };
};

