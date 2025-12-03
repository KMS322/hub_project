import axiosInstance from './axios';
import { API_URL } from '../constants';

/**
 * 기록(Records) 관련 API 서비스
 */
const recordsService = {
  /**
   * 기록 목록 조회
   * @param {Object} filters - 필터 { deviceAddress, startDate, endDate }
   * @returns {Promise<Array>}
   */
  getRecords: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.deviceAddress) params.append('deviceAddress', filters.deviceAddress);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    const response = await axiosInstance.get(`/records?${params.toString()}`);
    return response.data.data || [];
  },

  /**
   * CSV 파일 다운로드
   * @param {string} fileName - 파일명
   * @returns {Promise<void>}
   */
  downloadFile: async (fileName) => {
    const token = localStorage.getItem('auth-storage');
    let authToken = '';
    
    if (token) {
      try {
        const { state } = JSON.parse(token);
        authToken = state?.token || '';
      } catch (e) {
        console.error('Failed to parse token:', e);
      }
    }

    const url = `${API_URL}/records/download/${fileName}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.ok) {
      throw new Error('파일 다운로드 실패');
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  },

  /**
   * CSV 파일 삭제
   * @param {string} fileName - 파일명
   * @returns {Promise<void>}
   */
  deleteFile: async (fileName) => {
    await axiosInstance.delete(`/records/${fileName}`);
  }
};

export default recordsService;

