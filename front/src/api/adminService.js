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
