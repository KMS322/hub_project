import axiosInstance from './axios';

/**
 * 인증 관련 API 서비스
 */
const authService = {
  /**
   * 로그인
   * @param {string} email - 이메일
   * @param {string} password - 비밀번호
   * @returns {Promise<{user: Object, token: string}>}
   */
  login: async (email, password) => {
    const response = await axiosInstance.post('/auth/login', {
      email,
      password
    });
    // 응답 형식: { success: true, message: "...", data: { user: {...}, token: "..." } }
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.message || '로그인에 실패했습니다.');
  },

  /**
   * 회원가입
   * @param {Object} userData - 회원가입 데이터
   * @returns {Promise<{user: Object, token: string}>}
   */
  register: async (userData) => {
    const response = await axiosInstance.post('/auth/register', userData);
    // 응답 형식: { success: true, message: "...", data: { user: {...}, token: "..." } }
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.message || '회원가입에 실패했습니다.');
  },

  /**
   * 로그아웃
   * @returns {Promise<void>}
   */
  logout: async () => {
    const response = await axiosInstance.post('/auth/logout');
    return response.data;
  },

  /**
   * 사용자 정보 조회
   * @returns {Promise<{user: Object}>}
   */
  getMe: async () => {
    const response = await axiosInstance.get('/auth/me');
    return response.data;
  }
};

export default authService;
