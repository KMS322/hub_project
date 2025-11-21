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
    const response = await axiosInstance.post('/api/auth/login', {
      email,
      password
    });
    return response.data;
  },

  /**
   * 회원가입
   * @param {Object} userData - 회원가입 데이터
   * @returns {Promise<{user: Object, token: string}>}
   */
  register: async (userData) => {
    const response = await axiosInstance.post('/api/auth/register', userData);
    return response.data;
  },

  /**
   * 로그아웃
   * @returns {Promise<void>}
   */
  logout: async () => {
    const response = await axiosInstance.post('/api/auth/logout');
    return response.data;
  },

  /**
   * 사용자 정보 조회
   * @returns {Promise<{user: Object}>}
   */
  getMe: async () => {
    const response = await axiosInstance.get('/api/auth/me');
    return response.data;
  },

  /**
   * 사용자 정보 수정
   * @param {Object} userData - 수정할 사용자 데이터
   * @returns {Promise<{user: Object}>}
   */
  updateProfile: async (userData) => {
    const response = await axiosInstance.put('/api/auth/profile', userData);
    return response.data;
  },

  /**
   * 회원 탈퇴
   * @returns {Promise<void>}
   */
  deleteAccount: async () => {
    const response = await axiosInstance.delete('/api/auth/account');
    return response.data;
  },

  /**
   * 비밀번호 변경
   * @param {string} currentPassword - 현재 비밀번호
   * @param {string} newPassword - 새 비밀번호
   * @returns {Promise<void>}
   */
  changePassword: async (currentPassword, newPassword) => {
    const response = await axiosInstance.put('/api/auth/password', {
      currentPassword,
      newPassword
    });
    return response.data;
  }
};

export default authService;
