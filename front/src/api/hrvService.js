import axiosInstance from './axios';

/**
 * HRV 분석 관련 API 서비스
 */
const hrvService = {
  /**
   * CSV 파일 목록 조회
   * @returns {Promise<Array>}
   */
  getCsvFiles: async () => {
    const response = await axiosInstance.get('/hrv/files');
    return response.data.data || [];
  },

  /**
   * CSV 파일 다운로드 및 내용 조회
   * @param {string} fileName - 파일명
   * @param {string} relativePath - 상대 경로 (선택사항)
   * @returns {Promise<Object>}
   */
  downloadCsvFile: async (fileName, relativePath = null) => {
    const response = await axiosInstance.post('/hrv/download', {
      fileName,
      relativePath
    });
    return response.data.data;
  },

  /**
   * 실시간 분석용 디바이스 목록 조회
   * @returns {Promise<Array>}
   */
  getDevices: async () => {
    const response = await axiosInstance.get('/hrv/devices');
    return response.data.data || [];
  }
};

export default hrvService;

