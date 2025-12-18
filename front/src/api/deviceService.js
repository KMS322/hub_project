import axiosInstance from './axios';

/**
 * 디바이스 관련 API 서비스
 */
const deviceService = {
  /**
   * 디바이스 목록 조회
   * @param {string} hubAddress - 허브 주소 (선택사항)
   * @returns {Promise<Array>}
   */
  getDevices: async (hubAddress = null) => {
    const url = hubAddress ? `/device?hubAddress=${hubAddress}` : '/device';
    const response = await axiosInstance.get(url);
    return response.data.data || [];
  },

  /**
   * 디바이스 상세 조회
   * @param {string} deviceAddress - 디바이스 MAC 주소
   * @returns {Promise<Object>}
   */
  getDevice: async (deviceAddress) => {
    const response = await axiosInstance.get(`/device/${deviceAddress}`);
    return response.data.data;
  },

  /**
   * 디바이스 등록
   * @param {Object} deviceData - 디바이스 데이터 { address, name, hubAddress }
   * @returns {Promise<Object>}
   */
  createDevice: async (deviceData) => {
    const response = await axiosInstance.post('/device', deviceData);
    return response.data.data;
  },

  /**
   * 디바이스 수정
   * @param {string} deviceAddress - 디바이스 MAC 주소
   * @param {Object} deviceData - 수정할 데이터 { name }
   * @returns {Promise<Object>}
   */
  updateDevice: async (deviceAddress, deviceData) => {
    const response = await axiosInstance.put(`/device/${deviceAddress}`, deviceData);
    return response.data.data;
  },

  /**
   * 디바이스 삭제
   * @param {string} deviceAddress - 디바이스 MAC 주소
   * @returns {Promise<void>}
   */
  deleteDevice: async (deviceAddress) => {
    await axiosInstance.delete(`/device/${deviceAddress}`);
  },

  /**
   * 디바이스에 환자 연결/해제
   * @param {string} deviceAddress - 디바이스 MAC 주소
   * @param {number|null} petId - 환자 ID (null이면 해제)
   * @returns {Promise<void>}
   */
  connectPatient: async (deviceAddress, petId) => {
    await axiosInstance.put(`/device/${deviceAddress}/patient`, { petId });
  }
};

export default deviceService;

