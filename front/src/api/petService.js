import axiosInstance from './axios';

/**
 * 환자(Pet) 관련 API 서비스
 */
const petService = {
  /**
   * 환자 목록 조회
   * @returns {Promise<Array>}
   */
  getPets: async () => {
    const response = await axiosInstance.get('/pet');
    return response.data.data || [];
  },

  /**
   * 환자 상세 조회
   * @param {number} petId - 환자 ID
   * @returns {Promise<Object>}
   */
  getPet: async (petId) => {
    const response = await axiosInstance.get(`/pet/${petId}`);
    return response.data.data;
  },

  /**
   * 환자 등록
   * @param {Object} petData - 환자 데이터
   * @returns {Promise<Object>}
   */
  createPet: async (petData) => {
    const response = await axiosInstance.post('/pet', petData);
    return response.data.data;
  },

  /**
   * 환자 수정
   * @param {number} petId - 환자 ID
   * @param {Object} petData - 수정할 데이터
   * @returns {Promise<Object>}
   */
  updatePet: async (petId, petData) => {
    const response = await axiosInstance.put(`/pet/${petId}`, petData);
    return response.data.data;
  },

  /**
   * 환자 삭제
   * @param {number} petId - 환자 ID
   * @returns {Promise<void>}
   */
  deletePet: async (petId) => {
    await axiosInstance.delete(`/pet/${petId}`);
  }
};

export default petService;

