/**
 * Admin API: 사용자별 허브 연결 상태, 디바이스 연결 상태, 측정 여부 모니터링
 * GET /api/admin/connection-status
 */

const presenceStore = require('../core/presenceStore');

function normalizeId(id) {
  return typeof id === 'string' ? id.trim().toLowerCase() : id;
}

/**
 * GET /api/admin/connection-status
 * 응답: { success, data: { users: [ { email, name, hubs: [ { address, name, online, lastSeen, devices: [ { address, name, connected, measuring } ] } ] } ] } }
 */
async function getConnectionStatus(req, res) {
  try {
    const db = require('../models');
    const telemetryWorker = req.app.get('telemetryWorker');
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

    const userMap = new Map(); // email -> { email, name?, hubs: [] }

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

    const users = Array.from(userMap.values());

    res.json({
      success: true,
      data: { users },
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
};
