import axiosInstance from './axios';

/**
 * 허브 관련 API 서비스
 */
const hubService = {
  /**
   * 허브 목록 조회
   * @returns {Promise<Array>}
   */
  getHubs: async () => {
    const response = await axiosInstance.get('/hub');
    return response.data.data || [];
  },

  /**
   * 허브 상세 조회
   * @param {string} hubAddress - 허브 MAC 주소
   * @returns {Promise<Object>}
   */
  getHub: async (hubAddress) => {
    const response = await axiosInstance.get(`/hub/${hubAddress}`);
    return response.data.data;
  },

  /**
   * 허브 등록
   * @param {Object} hubData - 허브 데이터 { address, name }
   * @returns {Promise<Object>}
   */
  createHub: async (hubData) => {
    const response = await axiosInstance.post('/hub', hubData);
    return response.data.data;
  },

  /**
   * 허브 수정
   * @param {string} hubAddress - 허브 MAC 주소
   * @param {Object} hubData - 수정할 데이터 { name }
   * @returns {Promise<Object>}
   */
  updateHub: async (hubAddress, hubData) => {
    const response = await axiosInstance.put(`/hub/${hubAddress}`, hubData);
    return response.data.data;
  },

  /**
   * 허브 삭제
   * @param {string} hubAddress - 허브 MAC 주소
   * @returns {Promise<void>}
   */
  deleteHub: async (hubAddress) => {
    await axiosInstance.delete(`/hub/${hubAddress}`);
  },

  /**
   * 허브 재시작
   * @param {string} hubAddress - 허브 MAC 주소
   * @returns {Promise<Object>}
   */
  restartHub: async (hubAddress) => {
    // MQTT publish를 통해 허브 설정 토픽에 재시작 명령 전송
    const response = await axiosInstance.post('/mqtt/publish', {
      topic: `hub/${hubAddress}/settings`,
      message: {
        command: 'restart',
        action: 'reboot',
        timestamp: new Date().toISOString()
      },
      options: {
        qos: 1,
        retain: false
      }
    });
    return response.data;
  }
};

export default hubService;

