import axiosInstance from './axios';
import { API_URL } from '../constants';

/**
 * 기록(Records) 관련 API 서비스
 */
const recordsService = {
  /**
   * 기록 목록 조회 (레거시 - 사용 안 함)
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
   * CSV 파일 목록 조회 (전체)
   * @returns {Promise<Array>}
   */
  getCsvFiles: async () => {
    const response = await axiosInstance.get('/csv/all');
    return response.data.files || [];
  },

  /**
   * 디바이스별 CSV 파일 목록 조회
   * @param {string} deviceAddress - 디바이스 MAC 주소
   * @returns {Promise<Array>}
   */
  getCsvFilesByDevice: async (deviceAddress) => {
    const response = await axiosInstance.get(`/csv/device/${deviceAddress}`);
    return response.data.files || [];
  },

  /**
   * 환자별 CSV 파일 목록 조회
   * @param {string} petName - 환자(펫) 이름
   * @returns {Promise<Array>}
   */
  getCsvFilesByPet: async (petName) => {
    const response = await axiosInstance.get(`/csv/pet/${petName}`);
    return response.data.files || [];
  },

  /**
   * CSV 파일 다운로드 (새 API)
   * @param {string} relativePath - 상대 경로 (API에서 받은 relativePath)
   * @param {string} customFileName - 커스텀 파일명 (선택사항, 없으면 원본 파일명 사용)
   * @returns {Promise<void>}
   */
  downloadCsvFile: async (relativePath, customFileName = null) => {
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

    const url = `${API_URL}/csv/download?path=${encodeURIComponent(relativePath)}`;
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

    // 커스텀 파일명이 있으면 사용, 없으면 원본 파일명 사용
    let filename = customFileName || relativePath.split('/').pop() || 'download.csv';

    // .csv 확장자가 없으면 추가
    if (!filename.endsWith('.csv')) {
      filename = filename + '.csv';
    }

    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  },

  /**
   * CSV 파일 다운로드
   * @param {string} fileName - 파일명
   * @param {string} customFileName - 커스텀 파일명 (선택사항, 없으면 원본 파일명 사용)
   * @returns {Promise<void>}
   */
  downloadFile: async (fileName, customFileName = null) => {
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

    // 커스텀 파일명이 있으면 사용, 없으면 원본 파일명 사용
    let downloadFileName = customFileName || fileName;

    // .csv 확장자가 없으면 추가
    if (!downloadFileName.endsWith('.csv')) {
      downloadFileName = downloadFileName + '.csv';
    }

    link.download = downloadFileName;
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
  },

  /**
   * 새 CSV 파일 내용 조회 (csv_files 기반, 그래프용)
   * @param {Object} params - { user_email, date, device_mac_address, pet_name, start_time }
   * @returns {Promise<Array<{ time, ir, red, green, hr, spo2, temp }>>}
   */
  getCsvContent: async (params) => {
    const response = await axiosInstance.get('/records/csv-content', { params });
    return response.data.data || [];
  }
};

export default recordsService;

