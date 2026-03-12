import { io } from "socket.io-client";
import { API_URL } from "../constants";

/**
 * Socket.IO 서비스
 * 백엔드와의 실시간 양방향 통신을 담당
 */
class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = new Map();
    this._lastToken = null;
  }

  /**
   * Socket.IO 연결
   * @param {string} token - JWT 인증 토큰
   * @param {string} serverUrl - 서버 URL (기본: API_URL 상수 사용)
   */
  connect(token, serverUrl = API_URL) {
    if (!token) {
      this.disconnect();
      return;
    }
    if (this.socket && this.socket.connected && this._lastToken === token) {
      return;
    }
    if (this.socket) {
      this.disconnect();
    }
    this._lastToken = token;

    // Socket.IO는 네임스페이스를 사용하므로, URL에서 path를 제거하고 origin만 사용
    let socketUrl = serverUrl;
    try {
      const urlObj = new URL(serverUrl);
      socketUrl = urlObj.origin; // 예: http://localhost:5000/api -> http://localhost:5000
      console.log(
        `[Socket] Connecting to ${socketUrl} (original: ${serverUrl})`
      );
    } catch (e) {
      console.warn(
        "[Socket] Invalid URL format for serverUrl, using as is:",
        serverUrl
      );
      socketUrl = serverUrl;
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

    this.socket.on("connect", () => {
      this.isConnected = true;
      console.log("[Socket] ✅ 서버와 소켓 연결됨 — TELEMETRY 수신 가능");
    });

    this.socket.on("disconnect", (reason) => {
      this.isConnected = false;
      console.log("[Socket] 연결 해제:", reason);
    });

    this.socket.on("connect_error", (error) => {
      this.isConnected = false;
      const msg = error?.message || String(error);
      const isAuth = /auth|token|invalid|401|unauthorized/i.test(msg);
      console.error(
        "[Socket] 연결 실패:",
        isAuth ? "인증 실패 가능성(토큰 만료/잘못됨). 다시 로그인해 보세요." : msg,
        error
      );
    });

    this.socket.on("connected", (data) => {
      console.log("[Socket] ✅ 서버 연결 확인 — TELEMETRY 수신 가능 (room 가입됨)", data?.message || data);
    });

    // 재연결 성공 이벤트 (재연결 시 서버가 자동으로 room 재가입 처리)
    this.socket.on("reconnect", (attemptNumber) => {
      this.isConnected = true;
      console.log("[Socket] 🔄 재연결됨 (시도 횟수:", attemptNumber, ") — 서버에서 room 자동 재가입");
    });
  }

  /**
   * Socket.IO 연결 해제
   */
  disconnect() {
    if (this.socket) {
      this.listeners.forEach((handler, event) => {
        this.socket.off(event, handler);
      });
      this.listeners.clear();
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this._lastToken = null;
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

    // 중복 리스너 방지: 같은 이벤트에 이미 리스너가 있으면 먼저 제거
    if (this.listeners.has(event)) {
      const existingCallback = this.listeners.get(event);
      this.socket.off(event, existingCallback);
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
    if (!this.socket) {
      console.warn("[Socket] Socket not initialized. Cannot emit:", event);
      return false;
    }
    if (!this.socket.connected) {
      console.warn("[Socket] Socket not connected yet. Cannot emit:", event);
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
