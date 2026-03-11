import axiosInstance from './axios';

/**
 * GET /api/admin/errors - paginated list
 * @param {Object} params - page, limit, code, channel, deviceId, startDate, endDate, keyword
 */
export async function getAdminErrors(params = {}) {
  const { data } = await axiosInstance.get('/admin/errors', { params });
  return data;
}

/**
 * GET /api/admin/errors/stats
 */
export async function getAdminErrorStats() {
  const { data } = await axiosInstance.get('/admin/errors/stats');
  return data;
}

/**
 * GET /api/admin/errors/device/:deviceId
 */
export async function getAdminErrorsByDevice(deviceId, params = {}) {
  const { data } = await axiosInstance.get(`/admin/errors/device/${encodeURIComponent(deviceId)}`, { params });
  return data;
}

/**
 * GET /api/admin/errors/device-stats - 디바이스별 에러 건수
 */
export async function getAdminDeviceErrorStats() {
  const { data } = await axiosInstance.get('/admin/errors/device-stats');
  return data;
}

/**
 * GET /api/admin/health - 시스템 상태 (MQTT, Socket, Queue, Uptime)
 */
export async function getAdminHealth() {
  const { data } = await axiosInstance.get('/admin/health');
  return data;
}

/**
 * GET /api/admin/csv-files - 유저별 전체 CSV 목록 (admin only)
 */
export async function getAdminCsvFiles() {
  const { data } = await axiosInstance.get('/admin/csv-files');
  return data;
}

/**
 * Admin CSV 파일 다운로드 (blob으로 받아서 파일로 저장)
 */
export async function downloadAdminCsvFile(userKey, relativePath, filename) {
  const { data } = await axiosInstance.get('/admin/csv-files/download', {
    params: { userKey, path: relativePath },
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || relativePath.split('/').pop() || 'download.csv';
  a.click();
  window.URL.revokeObjectURL(url);
}
