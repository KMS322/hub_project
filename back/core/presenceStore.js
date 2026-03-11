/**
 * 인메모리 허브/디바이스 연결·활동 상태 저장소
 * - 허브/디바이스 마지막 활동 시각 (lastSeen)
 * - 허브별 연결된 디바이스 목록 (CONNECTED_DEVICES 응답 기준)
 * 어드민 모니터링(연결 상태, 측정 여부)에 사용
 */

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2분 이내 활동이면 온라인

const hubLastSeen = new Map(); // hubId -> timestamp (ms)
const deviceLastSeen = new Map(); // deviceId -> timestamp (ms)
const deviceToHub = new Map(); // deviceId -> hubId (마지막으로 확인된 허브)
const hubConnectedDevices = new Map(); // hubId -> string[] (마지막 CONNECTED_DEVICES 목록)

function normalizeId(id) {
  return typeof id === 'string' ? id.trim().toLowerCase() : id;
}

/**
 * 허브 활동 기록 (status, telemetry, response, send 수신 시)
 */
function updateHubSeen(hubId) {
  const id = normalizeId(hubId);
  if (id) {
    hubLastSeen.set(id, Date.now());
  }
}

/**
 * 디바이스 활동 기록 (telemetry, response 수신 시)
 */
function updateDeviceSeen(hubId, deviceId) {
  const h = normalizeId(hubId);
  const d = normalizeId(deviceId);
  if (d) {
    deviceLastSeen.set(d, Date.now());
    if (h) deviceToHub.set(d, h);
  }
}

/**
 * 허브별 연결 디바이스 목록 갱신 (CONNECTED_DEVICES 파싱 시)
 */
function setHubConnectedDevices(hubId, deviceList) {
  const id = normalizeId(hubId);
  if (!id) return;
  const list = Array.isArray(deviceList)
    ? deviceList.map((mac) => normalizeId(mac)).filter(Boolean)
    : [];
  hubConnectedDevices.set(id, list);
  const now = Date.now();
  hubLastSeen.set(id, now);
  for (const dev of list) {
    deviceLastSeen.set(dev, now);
    deviceToHub.set(dev, id);
  }
}

/**
 * 허브가 온라인인지 여부 (threshold 이내 활동)
 */
function isHubOnline(hubId) {
  const t = hubLastSeen.get(normalizeId(hubId));
  return t != null && Date.now() - t < ONLINE_THRESHOLD_MS;
}

/**
 * 디바이스가 연결된 것으로 보이는지 (허브 연결 목록에 있거나, 최근 활동 있음)
 */
function isDeviceConnected(deviceId, hubId) {
  const d = normalizeId(deviceId);
  const h = normalizeId(hubId);
  const list = h ? hubConnectedDevices.get(h) : null;
  if (list && list.includes(d)) return true;
  const t = deviceLastSeen.get(d);
  return t != null && Date.now() - t < ONLINE_THRESHOLD_MS;
}

/**
 * 현재 presence 상태 스냅샷 (어드민 API용)
 * @returns {{ hubs: Object.<string, { lastSeen: number, connectedDevices: string[] }>, devices: Object.<string, { lastSeen: number, hubId: string }> }}
 */
function getStatus() {
  const now = Date.now();
  const hubs = {};
  for (const [hubId, ts] of hubLastSeen) {
    hubs[hubId] = {
      lastSeen: ts,
      connectedDevices: hubConnectedDevices.get(hubId) || [],
    };
  }
  const devices = {};
  for (const [deviceId, ts] of deviceLastSeen) {
    devices[deviceId] = {
      lastSeen: ts,
      hubId: deviceToHub.get(deviceId) || null,
    };
  }
  return { hubs, devices };
}

module.exports = {
  updateHubSeen,
  updateDeviceSeen,
  setHubConnectedDevices,
  isHubOnline,
  isDeviceConnected,
  getStatus,
  ONLINE_THRESHOLD_MS,
};
