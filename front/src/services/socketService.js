import { io } from "socket.io-client";

/**
 * Socket.IO 서비스
 * 백엔드와의 실시간 양방향 통신을 담당
 */
class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = new Map(); // 이벤트 리스너 관리
  }

  /**
   * Socket.IO 연결
   * @param {string} token - JWT 인증 토큰
   * @param {string} serverUrl - 서버 URL (기본: http://localhost:5000)
   */
  connect(token, serverUrl = import.meta.env.VITE_API_URL) {
    if (this.socket && this.isConnected) {
      console.log("[Socket] Already connected");
      return;
    }

    // 기존 연결이 있으면 먼저 해제
    if (this.socket) {
      this.disconnect();
    }

    // API URL에 /api 같은 path가 붙어있으면 Socket.IO는 루트(origin)로만 연결해야 함
    // 예: VITE_API_URL = http://localhost:5000/api 인 경우 → http://localhost:5000 으로 변경
    let socketUrl = serverUrl;
    try {
      const urlObj = new URL(serverUrl);
      socketUrl = urlObj.origin; // 프로토콜 + 호스트 + 포트만 사용
    } catch (e) {
      // serverUrl이 절대 URL이 아니면 그대로 사용
      console.warn('[Socket] Invalid URL format for serverUrl, using as is:', serverUrl);
    }

    this.socket = io(socketUrl, {
      auth: {
        token: token,
      },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    // 연결 성공 이벤트
    this.socket.on("connect", () => {
      this.isConnected = true;
      console.log("[Socket] Connected to server");
    });

    // 연결 해제 이벤트
    this.socket.on("disconnect", (reason) => {
      this.isConnected = false;
      console.log("[Socket] Disconnected:", reason);
    });

    // 연결 에러 이벤트
    this.socket.on("connect_error", (error) => {
      console.error("[Socket] Connection error:", error);
      this.isConnected = false;
    });

    // 서버에서 보낸 연결 확인
    this.socket.on("connected", (data) => {
      console.log("[Socket] Server confirmed connection:", data);
    });

    // 재연결 성공 이벤트
    this.socket.on("reconnect", (attemptNumber) => {
      console.log("[Socket] Reconnected after", attemptNumber, "attempts");
      this.isConnected = true;
    });
  }

  /**
   * Socket.IO 연결 해제
   */
  disconnect() {
    if (this.socket) {
      // 모든 리스너 제거
      this.listeners.forEach((handler, event) => {
        this.socket.off(event, handler);
      });
      this.listeners.clear();

      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      console.log("[Socket] Disconnected");
    }
  }

  /**
   * 이벤트 리스너 등록
   * @param {string} event - 이벤트 이름
   * @param {Function} callback - 콜백 함수
   */
  on(event, callback) {
    if (!this.socket) {
      console.warn("[Socket] Socket not initialized. Call connect() first.");
      return;
    }

    this.socket.on(event, callback);
    this.listeners.set(event, callback);
  }

  /**
   * 이벤트 리스너 제거
   * @param {string} event - 이벤트 이름
   * @param {Function} callback - 콜백 함수 (선택사항)
   */
  off(event, callback) {
    if (!this.socket) return;

    if (callback) {
      this.socket.off(event, callback);
    } else {
      this.socket.off(event);
      this.listeners.delete(event);
    }
  }

  /**
   * 이벤트 발송
   * @param {string} event - 이벤트 이름
   * @param {any} data - 전송할 데이터
   */
  emit(event, data) {
    if (!this.socket || !this.isConnected) {
      console.warn("[Socket] Socket not connected. Cannot emit:", event);
      return false;
    }

    this.socket.emit(event, data);
    return true;
  }

  /**
   * 연결 상태 확인
   */
  getConnectionStatus() {
    return this.isConnected && this.socket?.connected;
  }

  /**
   * Socket 인스턴스 가져오기
   */
  getSocket() {
    return this.socket;
  }
}

// 싱글톤 인스턴스
const socketService = new SocketService();

export default socketService;
