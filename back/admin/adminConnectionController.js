/**
 * Admin API: 사용자별 허브 연결 상태, 디바이스 연결 상태, 측정 여부 모니터링
 * GET /api/admin/connection-status
 * Socket.IO admin 룸에서도 동일 payload 생성용 getConnectionStatusData(app) 공유
 */

const presenceStore = require('../core/presenceStore');

function normalizeId(id) {
  return typeof id === 'string' ? id.trim().toLowerCase() : id;
}

/**
 * 연결 상태 스냅샷 생성 (HTTP 응답 / Socket.IO admin 전송 공용)
 * @param {Object} app - Express app (app.get('telemetryWorker'))
 * @returns {Promise<{ users: Array }>}
 */
async function getConnectionStatusData(app) {
  const db = require('../models');
  const telemetryWorker = app && app.get('telemetryWorker');
  const status = presenceStore.getStatus();
  const measuringSet = new Set(
    (telemetryWorker && typeof telemetryWorker.getMeasuringDevices === 'function')
      ? telemetryWorker.getMeasuringDevices().map(normalizeId)
      : []
  );

  const hubs = await db.Hub.findAll({
    attributes: ['address', 'name', 'user_email'],
    include: [
      { model: db.Device, as: 'Devices', attributes: ['address', 'name', 'hub_address'] },
    ],
  });

  const userMap = new Map();

  for (const hub of hubs) {
    const email = hub.user_email;
    if (!userMap.has(email)) {
      const user = await db.User.findByPk(email, { attributes: ['email', 'name'] });
      userMap.set(email, {
        email,
        name: (user && user.name) || email,
        hubs: [],
      });
    }
    const hubId = normalizeId(hub.address);
    const hubInfo = status.hubs[hubId] || {};
    const lastSeen = hubInfo.lastSeen || null;
    const online = lastSeen != null && (Date.now() - lastSeen) < presenceStore.ONLINE_THRESHOLD_MS;
    const connectedList = hubInfo.connectedDevices || [];

    const devices = (hub.Devices || []).map((d) => {
      const devId = normalizeId(d.address);
      const connected =
        connectedList.includes(devId) ||
        (status.devices[devId] && (Date.now() - status.devices[devId].lastSeen) < presenceStore.ONLINE_THRESHOLD_MS);
      const measuring = measuringSet.has(devId);
      return {
        address: d.address,
        name: d.name || d.address,
        connected: !!connected,
        measuring: !!measuring,
      };
    });

    userMap.get(email).hubs.push({
      address: hub.address,
      name: hub.name || hub.address,
      online,
      lastSeen,
      devices,
    });
  }

  return { users: Array.from(userMap.values()) };
}

/**
 * GET /api/admin/connection-status
 * 응답: { success, data: { users: [ ... ] } }
 */
async function getConnectionStatus(req, res) {
  try {
    const data = await getConnectionStatusData(req.app);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('[Admin] getConnectionStatus error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '연결 상태 조회 실패',
    });
  }
}

module.exports = {
  getConnectionStatus,
  getConnectionStatusData,
};
