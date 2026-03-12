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

  // 연결 (토큰 있을 때만 연결, 없으면 연결 해제)
  useEffect(() => {
    if (!token) {
      socketService.disconnect();
      setIsConnected(false);
      return;
    }

    socketService.connect(token);

    const updateConnectionStatus = () => {
      setIsConnected(socketService.getConnectionStatus());
    };

    updateConnectionStatus();

    socketService.on('connect', updateConnectionStatus);
    socketService.on('disconnect', updateConnectionStatus);
    socketService.on('connected', updateConnectionStatus);

    return () => {
      socketService.off('connect', updateConnectionStatus);
      socketService.off('disconnect', updateConnectionStatus);
      socketService.off('connected', updateConnectionStatus);
      listenersRef.current.forEach((callback, event) => {
        socketService.off(event, callback);
      });
      listenersRef.current.clear();
      socketService.disconnect();
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

