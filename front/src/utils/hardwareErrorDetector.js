/**
 * 하드웨어 오류 코드 감지 및 메시지 변환 유틸리티
 */

/**
 * heartRate 값에서 오류 코드를 감지하고 메시지를 반환
 * @param {number|string} heartRate - 심박수 값 (hr:7, hr:8, hr:9 등)
 * @returns {object|null} 오류 정보 또는 null
 */
export function detectHardwareError(heartRate) {
  if (!heartRate) return null

  // 문자열로 변환하여 확인
  const hrStr = String(heartRate).toLowerCase().trim()

  // hr:7 => 배터리 부족
  if (hrStr === 'hr:7' || hrStr === '7' || heartRate === 7) {
    return {
      code: 'hr:7',
      type: 'warning',
      message: '배터리가 부족하니 충전을 해주세요.',
      action: '배터리 충전 필요'
    }
  }

  // hr:8 => 신호 불량
  if (hrStr === 'hr:8' || hrStr === '8' || heartRate === 8) {
    return {
      code: 'hr:8',
      type: 'error',
      message: '신호가 불량하니 다시 측정 해주세요.',
      action: '신호 재연결 필요'
    }
  }

  // hr:9 => 움직임 감지
  if (hrStr === 'hr:9' || hrStr === '9' || heartRate === 9) {
    return {
      code: 'hr:9',
      type: 'info',
      message: '환자가 움직여서 신호가 불안정합니다. 다시 측정 해주세요.',
      action: '움직임 감지됨'
    }
  }

  return null
}

/**
 * 디바이스 데이터에서 오류를 감지하고 알림 배열 반환
 * @param {Array} devices - 디바이스 배열
 * @returns {Array} 알림 배열
 */
export function detectDeviceErrors(devices) {
  const alerts = []

  if (!devices || !Array.isArray(devices)) {
    return alerts
  }

  devices.forEach(device => {
    const heartRate = device.currentData?.heartRate || device.heartRate
    const error = detectHardwareError(heartRate)

    if (error) {
      alerts.push({
        id: `alert-${device.id || device.address}-${error.code}`,
        deviceId: device.id || device.address,
        deviceName: device.name || device.address,
        deviceAddress: device.address,
        ...error,
        timestamp: Date.now()
      })
    }
  })

  return alerts
}

/**
 * 단일 디바이스의 오류 상태 확인
 * @param {object} device - 디바이스 객체
 * @returns {object|null} 오류 정보 또는 null
 */
export function getDeviceErrorStatus(device) {
  if (!device) return null

  const heartRate = device.currentData?.heartRate || device.heartRate
  return detectHardwareError(heartRate)
}

