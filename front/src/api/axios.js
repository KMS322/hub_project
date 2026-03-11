import axios from 'axios';
import { API_URL } from '../constants';
import { getErrorMessage } from '../utils/errorMessages';
import { useErrorModalStore } from '../stores/useErrorModalStore';

// Axios 인스턴스 생성
const axiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 10000, // 10초 타임아웃
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터: 모든 요청에 토큰 자동 추가
axiosInstance.interceptors.request.use(
  (config) => {
    // localStorage에서 토큰 가져오기
    const authStorage = localStorage.getItem('auth-storage');
    if (authStorage) {
      try {
        const { state } = JSON.parse(authStorage);
        if (state?.token) {
          config.headers.Authorization = `Bearer ${state.token}`;
        }
      } catch (error) {
        console.error('Failed to parse auth token:', error);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 응답 인터셉터: 에러 처리
axiosInstance.interceptors.response.use(
  (response) => {
    // 성공 응답은 그대로 반환
    return response;
  },
  (error) => {
    // 401 Unauthorized: 토큰 만료 또는 인증 실패
    if (error.response?.status === 401) {
      // 로그아웃 처리
      localStorage.removeItem('auth-storage');
      window.location.href = '/login';
    }

    // 서버 표준 코드가 있으면 사용자 친화 메시지로 매핑
    const code = error.response?.data?.code;
    const errorMessage = code
      ? getErrorMessage(code)
      : error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        '서버 오류가 발생했습니다.';

    // HTTP 요청 실패 시 전역 에러 모달 표시 (401은 로그인으로 리다이렉트하므로 모달 생략)
    if (error.response?.status !== 401) {
      const title = error.code === 'ECONNABORTED' ? '요청 시간 초과' : '요청 실패';
      const detail = error.code === 'ECONNABORTED' ? '서버 응답이 없습니다. 네트워크를 확인해 주세요.' : errorMessage;
      useErrorModalStore.getState().showErrorModal(title, detail);
    }

    return Promise.reject({
      status: error.response?.status,
      code,
      message: errorMessage,
      data: error.response?.data,
    });
  }
);

export default axiosInstance;
