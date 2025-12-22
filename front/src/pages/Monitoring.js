import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import HardwareAlertBar from '../components/HardwareAlertBar'
import { useSocket } from '../hooks/useSocket'
import { API_URL } from '../constants'
import { detectHardwareError } from '../utils/hardwareErrorDetector'
import deviceService from '../api/deviceService'
import petService from '../api/petService'
import './Monitoring.css'

function Monitoring() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const { isConnected, on, emit, off } = useSocket()
  
  // UI 상태
  const [activeTab, setActiveTab] = useState('heartRate')
  const [deviceInfo, setDeviceInfo] = useState(null)
  const [petInfo, setPetInfo] = useState(null)
  const [deviceConnectionStatus, setDeviceConnectionStatus] = useState('unknown')
  const [hubStatus, setHubStatus] = useState(false)
  const [isMeasurementRunning, setIsMeasurementRunning] = useState(false)
  const [hardwareAlerts, setHardwareAlerts] = useState([])
  const [signalProcessingStatus, setSignalProcessingStatus] = useState({
    processedHR: null,
    originalHR: null,
    sqi: 0,
    pi: 0,
    status: 'idle',
    message: '신호처리 대기 중'
  })
  
  // 차트 데이터 (최대 10개)
  const [chartData, setChartData] = useState([])
  
  // 현재 측정값
  const [currentValues, setCurrentValues] = useState({
    heartRate: 0,
    spo2: 0,
    temperature: 0,
    battery: 0
  })
  
  // Ref로 관리 (렌더링과 무관)
  const deviceInfoRef = useRef(null)
  const petInfoRef = useRef(null)
  const measurementStartTimeRef = useRef(null)
  const spo2NineCountRef = useRef(0)
  const hasHubStateCheckedRef = useRef(false)
  const listenersRegisteredRef = useRef(false)
  
  // localStorage 키 생성 (환자/디바이스 단위 분리)
  const getStorageKey = (suffix) => {
    const deviceAddress = deviceInfoRef.current?.address || 'unknown'
    return `monitoring_${deviceAddress}_${suffix}`
  }
  
  // localStorage에서 데이터 복구
  const restoreFromStorage = () => {
    if (!deviceInfoRef.current) return
    
    try {
      const chartKey = getStorageKey('chartData')
      const valuesKey = getStorageKey('currentValues')
      const startTimeKey = getStorageKey('startTime')
      const runningKey = getStorageKey('isRunning')
      
      const savedChartData = localStorage.getItem(chartKey)
      const savedValues = localStorage.getItem(valuesKey)
      const savedStartTime = localStorage.getItem(startTimeKey)
      const savedRunning = localStorage.getItem(runningKey)
      
      if (savedChartData) {
        const parsed = JSON.parse(savedChartData)
        // 최대 10개만 유지
        const limited = parsed.slice(-10)
        setChartData(limited)
      }
      
      if (savedValues) {
        setCurrentValues(JSON.parse(savedValues))
      }
      
      if (savedStartTime) {
        measurementStartTimeRef.current = parseInt(savedStartTime, 10)
      }
      
      if (savedRunning === 'true') {
        setIsMeasurementRunning(true)
      }
    } catch (error) {
      console.error('[Monitoring] Failed to restore from storage:', error)
    }
  }
  
  // localStorage에 데이터 저장
  const saveToStorage = () => {
    if (!deviceInfoRef.current) return
    
    try {
      const chartKey = getStorageKey('chartData')
      const valuesKey = getStorageKey('currentValues')
      const startTimeKey = getStorageKey('startTime')
      const runningKey = getStorageKey('isRunning')
      
      // 차트 데이터 저장 (최대 10개만)
      const dataToSave = chartData.slice(-10)
      localStorage.setItem(chartKey, JSON.stringify(dataToSave))
      
      // 현재값 저장
      localStorage.setItem(valuesKey, JSON.stringify(currentValues))
      
      // 측정 시작 시간 저장
      if (measurementStartTimeRef.current) {
        localStorage.setItem(startTimeKey, String(measurementStartTimeRef.current))
      }
      
      // 측정 상태 저장
      localStorage.setItem(runningKey, String(isMeasurementRunning))
    } catch (error) {
      console.error('[Monitoring] Failed to save to storage:', error)
    }
  }
  
  // 차트 데이터 추가 함수 (최대 10개 유지)
  const addChartData = (newDataPoints) => {
    if (!Array.isArray(newDataPoints) || newDataPoints.length === 0) return
    
    setChartData(prev => {
      // 기존 데이터와 새 데이터 합치기
      const updated = [...prev, ...newDataPoints]
      // 최대 10개만 유지 (가장 오래된 것 제거, 오른쪽이 최신)
      const limited = updated.slice(-10)
      
      // 디버깅: 차트 데이터 상태 확인
      console.log('[Monitoring] Chart data updated:', {
        prevCount: prev.length,
        newCount: newDataPoints.length,
        totalCount: updated.length,
        limitedCount: limited.length,
        values: limited.map(d => ({ 
          heartRate: d.heartRate, 
          spo2: d.spo2, 
          timestamp: d.timestamp 
        }))
      })
      
      return limited
    })
  }
  
  // 차트 데이터 초기화
  const resetChartData = () => {
    setChartData([])
    setCurrentValues({
      heartRate: 0,
      spo2: 0,
      temperature: 0,
      battery: 0
    })
    measurementStartTimeRef.current = null
    spo2NineCountRef.current = 0
    
    // localStorage 초기화
    if (deviceInfoRef.current) {
      const chartKey = getStorageKey('chartData')
      const valuesKey = getStorageKey('currentValues')
      const startTimeKey = getStorageKey('startTime')
      localStorage.removeItem(chartKey)
      localStorage.removeItem(valuesKey)
      localStorage.removeItem(startTimeKey)
    }
  }
  
  // 디바이스 정보 로드
  useEffect(() => {
    const loadDeviceInfo = async () => {
      if (!patientId) return
      
      try {
        const pet = await petService.getPet(patientId)
        if (!pet || !pet.device_address) {
          setDeviceConnectionStatus('disconnected')
          return
        }
        
        setPetInfo(pet)
        petInfoRef.current = pet
        
        const device = await deviceService.getDevice(pet.device_address)
        if (device) {
          setDeviceInfo(device)
          deviceInfoRef.current = device
          
          // 디바이스 정보 로드 후 localStorage 복구
          setTimeout(() => {
            restoreFromStorage()
          }, 100)
        } else {
          setDeviceConnectionStatus('disconnected')
        }
      } catch (error) {
        console.error('[Monitoring] Failed to load device info:', error)
        setDeviceConnectionStatus('disconnected')
      }
    }
    
    loadDeviceInfo()
  }, [patientId])
  
  // localStorage 자동 저장 (chartData, currentValues 변경 시)
  useEffect(() => {
    saveToStorage()
  }, [chartData, currentValues, isMeasurementRunning])
  
  // 허브 상태 체크
  useEffect(() => {
    if (!isConnected || !deviceInfo?.hub_address || hasHubStateCheckedRef.current) return
    
    const requestId = `state_check_${deviceInfo.hub_address}_${Date.now()}`
    emit('CONTROL_REQUEST', {
      hubId: deviceInfo.hub_address,
      deviceId: 'HUB',
      command: {
        raw_command: 'state:hub'
      },
      requestId
    })
    
    hasHubStateCheckedRef.current = true
  }, [isConnected, deviceInfo?.hub_address, emit])
  
  // Socket.IO 이벤트 리스너 설정
  useEffect(() => {
    if (!isConnected) {
      listenersRegisteredRef.current = false
      return
    }
    
    if (listenersRegisteredRef.current) {
      return
    }
    
    listenersRegisteredRef.current = true
    
    // TELEMETRY 데이터 수신 핸들러
    const handleTelemetry = (data) => {
      if (data.type !== 'sensor_data' || !data.deviceId) return
      
      const currentDeviceInfo = deviceInfoRef.current
      if (currentDeviceInfo && currentDeviceInfo.address !== data.deviceId) {
        return
      }
      
      // 디바이스 연결 상태 업데이트
      setDeviceConnectionStatus('connected')
      setIsMeasurementRunning(true)
      
      // 신호처리 결과 처리
      if (data.data?.processedHR !== undefined) {
        setSignalProcessingStatus({
          processedHR: data.data.processedHR,
          originalHR: data.data.originalHR || null,
          sqi: data.data.sqi || 0,
          pi: data.data.pi || 0,
          status: data.data.status || 'normal',
          message: data.data.statusMessage || '정상 측정'
        })
      }
      
      // dataArr 처리 (배치 데이터)
      if (data.data?.dataArr && Array.isArray(data.data.dataArr)) {
        const parseStartTime = (startTimeStr) => {
          if (!startTimeStr || startTimeStr.length < 9) {
            const now = Date.now()
            if (!measurementStartTimeRef.current) {
              measurementStartTimeRef.current = now
            }
            return measurementStartTimeRef.current
          }
          
          try {
            const hours = parseInt(startTimeStr.substring(0, 2))
            const minutes = parseInt(startTimeStr.substring(2, 4))
            const seconds = parseInt(startTimeStr.substring(4, 6))
            const milliseconds = parseInt(startTimeStr.substring(6, 9))
            const today = new Date()
            today.setHours(hours, minutes, seconds, milliseconds)
            const startTimeMs = today.getTime()
            
            if (!measurementStartTimeRef.current) {
              measurementStartTimeRef.current = startTimeMs
            }
            
            return startTimeMs
          } catch (e) {
            const now = Date.now()
            if (!measurementStartTimeRef.current) {
              measurementStartTimeRef.current = now
            }
            return measurementStartTimeRef.current
          }
        }
        
        const startTimeStr = data.data.start_time || '000000000'
        const startTimeMs = parseStartTime(startTimeStr)
        const samplingRate = data.data.sampling_rate || 50
        
        // 각 샘플을 데이터 포인트로 변환
        // dataArr의 각 샘플은 { hr, spo2, temp, battery, timestamp, index } 형태
        const baseHr = sanitizeValue(data.data.hr || 0)
        const baseSpo2 = sanitizeValue(data.data.spo2 || 0)
        const baseTemp = sanitizeValue(data.data.temp || 0)
        
        // 각 배치에서 마지막 샘플만 차트 포인트로 추가 (10개의 포인트가 시간 순서대로 쌓이도록)
        // 측정 시작 시간: start_time + 1 / sampling_rate * 250 (첫 번째 샘플)
        const lastSample = data.data.dataArr[data.data.dataArr.length - 1]
        const lastIndex = data.data.dataArr.length - 1
        // 첫 번째 샘플의 시간: start_time + 1 / sampling_rate * 250
        // 이후 샘플: start_time + 1 / sampling_rate * 250 * (index + 1)
        const elapsedSecondsFromStart = (1 / samplingRate) * 250 * (lastIndex + 1)
        const sampleTime = startTimeMs + (elapsedSecondsFromStart * 1000)
        
        // 샘플에서 직접 값을 가져오되, 없으면 전체 데이터에서 가져옴
        const rawHr = sanitizeValue((lastSample.hr !== undefined && lastSample.hr !== null) ? lastSample.hr : baseHr)
        const rawSpo2 = sanitizeValue((lastSample.spo2 !== undefined && lastSample.spo2 !== null) ? lastSample.spo2 : baseSpo2)
        
        // 화면 표시: spo2를 심박수에, hr을 산포도에
        const heartRateDisplay = sanitizeValue(rawSpo2)
        const spo2Display = sanitizeValue(rawHr)
        
        const newDataPoint = {
          timestamp: sampleTime,
          elapsedSeconds: elapsedSecondsFromStart,
          heartRate: heartRateDisplay,
          spo2: spo2Display,
          temperature: sanitizeValue((lastSample.temp !== undefined && lastSample.temp !== null) ? lastSample.temp : baseTemp),
          battery: sanitizeValue((lastSample.battery !== undefined && lastSample.battery !== null) ? lastSample.battery : (data.data.battery || 0))
        }
        
        // 디버깅: 추가되는 포인트 확인
        console.log('[Monitoring] Adding chart point:', {
          heartRate: newDataPoint.heartRate,
          spo2: newDataPoint.spo2,
          timestamp: newDataPoint.timestamp,
          rawHr,
          rawSpo2,
          lastSampleHr: lastSample.hr,
          lastSampleSpo2: lastSample.spo2
        })
        
        // 차트 데이터 추가 (최대 10개 유지, 각 배치마다 하나의 포인트만 추가)
        addChartData([newDataPoint])
        
        // 현재값 업데이트 (최신 데이터)
        setCurrentValues(prev => ({
          heartRate: newDataPoint.heartRate,
          spo2: newDataPoint.spo2,
          temperature: newDataPoint.temperature,
          battery: newDataPoint.battery !== 0 ? newDataPoint.battery : prev.battery
        }))
        
        // 경고/오류 감지 (실제 값 사용)
        const lastRawHr = lastSample.hr || data.data.hr || 0
        const lastRawSpo2 = (lastSample.spo2 !== null && lastSample.spo2 !== undefined)
          ? lastSample.spo2
          : (data.data.spo2 || 0)
          
        // SpO2 경고
        if (lastRawSpo2 === 9) {
          spo2NineCountRef.current += 1
          if (spo2NineCountRef.current >= 2) {
            const petName = petInfoRef.current?.name || '강아지'
            alert(`현재 연결된 ${petName}가 많이 움직이고 있어 정확한 측정이 어렵습니다.`)
            spo2NineCountRef.current = 0
          }
        } else {
          spo2NineCountRef.current = 0
        }
        
        // 하드웨어 오류 감지
        const hrForErrorDetection = data.data.processedHR !== undefined && data.data.processedHR !== null
          ? data.data.processedHR
          : lastRawHr
        const error = detectHardwareError(hrForErrorDetection)
        if (error) {
          setHardwareAlerts([{
            id: `alert-${data.deviceId}-${error.code}`,
            deviceId: data.deviceId,
            deviceName: deviceInfo?.name || data.deviceId,
            deviceAddress: data.deviceId,
            ...error,
            timestamp: Date.now()
          }])
        } else {
          setHardwareAlerts([])
        }
      } else {
        // 단일 샘플 처리
        const rawHr = data.data?.hr || 0
        const rawSpo2 = data.data?.spo2 || 0
        
        const heartRateDisplay = (data.data?.processedHR !== undefined && data.data?.processedHR !== null)
          ? data.data.processedHR
          : rawSpo2
        
        const spo2Display = rawHr
        
        const now = Date.now()
        if (!measurementStartTimeRef.current) {
          measurementStartTimeRef.current = now
        }
        
        const newPoint = {
          timestamp: now,
          elapsedSeconds: (now - measurementStartTimeRef.current) / 1000,
          heartRate: heartRateDisplay,
          spo2: spo2Display,
          temperature: data.data?.temp || 0,
          battery: data.data?.battery || 0
        }
        
        // 차트 데이터 추가 (최대 10개 유지)
        addChartData([newPoint])
        
        setCurrentValues({
          heartRate: newPoint.heartRate,
          spo2: newPoint.spo2,
          temperature: newPoint.temperature,
          battery: newPoint.battery !== 0 ? newPoint.battery : currentValues.battery
        })
        
        // 경고/오류 감지
        if (rawSpo2 === 9) {
          spo2NineCountRef.current += 1
          if (spo2NineCountRef.current >= 2) {
            const petName = petInfoRef.current?.name || '강아지'
            alert(`현재 연결된 ${petName}가 많이 움직이고 있어 정확한 측정이 어렵습니다.`)
            spo2NineCountRef.current = 0
          }
        } else {
          spo2NineCountRef.current = 0
        }
        
        const hrForError = (data.data?.processedHR !== undefined && data.data?.processedHR !== null)
          ? data.data.processedHR
          : rawHr
        const error = detectHardwareError(hrForError)
        if (error) {
          setHardwareAlerts([{
            id: `alert-${data.deviceId}-${error.code}`,
            deviceId: data.deviceId,
            deviceName: deviceInfo?.name || data.deviceId,
            deviceAddress: data.deviceId,
            ...error,
            timestamp: Date.now()
          }])
        } else {
          setHardwareAlerts([])
        }
      }
    }
    
    // CONNECTED_DEVICES 핸들러
    const handleConnectedDevices = (payload) => {
      const hubAddress = payload.hubAddress
      const connectedDevices = payload.connected_devices || []
      
      if (hubAddress === deviceInfoRef.current?.hub_address) {
        setHubStatus(true)
        
        const normalizeMac = (mac) => mac.replace(/[:-]/g, '').toUpperCase()
        const currentDeviceMac = normalizeMac(deviceInfoRef.current?.address || '')
        const isConnected = connectedDevices.some(mac => normalizeMac(mac) === currentDeviceMac)
        
        setDeviceConnectionStatus(isConnected ? 'connected' : 'disconnected')
      }
    }
    
    // CONTROL_RESULT 핸들러
    const handleControlResult = (data) => {
      if (!data.success) return
      
      const command = data.data?.command || data.command || {}
      
      if (command.action === 'start_measurement') {
        // 측정 시작: 데이터 초기화
        resetChartData()
        setIsMeasurementRunning(true)
      } else if (command.action === 'stop_measurement') {
        setIsMeasurementRunning(false)
        spo2NineCountRef.current = 0
      }
    }
    
    // 이벤트 리스너 등록
    on('TELEMETRY', handleTelemetry)
    on('CONNECTED_DEVICES', handleConnectedDevices)
    on('CONTROL_RESULT', handleControlResult)
    
    return () => {
      off('TELEMETRY', handleTelemetry)
      off('CONNECTED_DEVICES', handleConnectedDevices)
      off('CONTROL_RESULT', handleControlResult)
      listenersRegisteredRef.current = false
    }
  }, [isConnected, on, off, deviceInfo])
  
  // 측정 제어 함수
  const sendControlCommand = async (command) => {
    if (!isConnected) {
      alert('Socket이 연결되지 않았습니다.')
      return
    }
    
    let deviceMacAddress = null
    let hubId = null
    
    if (deviceInfo && deviceInfo.hub_address) {
      hubId = deviceInfo.hub_address
      deviceMacAddress = deviceInfo.address
    } else if (patientId) {
      try {
        const pet = await petService.getPet(patientId)
        if (!pet || !pet.device_address) {
          alert('환자에 연결된 디바이스를 찾을 수 없습니다.')
          return
        }
        
        const device = await deviceService.getDevice(pet.device_address)
        if (!device || !device.hub_address) {
          alert('디바이스 정보를 찾을 수 없습니다.')
          return
        }
        
        hubId = device.hub_address
        deviceMacAddress = device.address
        setDeviceInfo(device)
      } catch (error) {
        console.error('[Monitoring] Failed to get device info:', error)
        alert('디바이스 정보를 가져오는데 실패했습니다.')
        return
      }
    }
    
    if (!hubId) {
      alert('디바이스의 허브 정보를 찾을 수 없습니다.')
      return
    }
    
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    if (command.action === 'start_measurement' || command.action === 'stop_measurement') {
      const measurementCommand = command.action === 'start_measurement'
        ? `start:${deviceMacAddress}`
        : `stop:${deviceMacAddress}`
      
      // CSV 세션 시작/종료
      try {
        const now = new Date()
        const startTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}:${String(now.getMilliseconds()).padStart(3, '0')}`
        
        if (command.action === 'start_measurement') {
          const response = await fetch('http://localhost:5000/api/measurement/start', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              deviceAddress: deviceMacAddress,
              userEmail: 'test@example.com',
              petName: petInfo?.name || '테스트펫',
              startTime
            })
          })
          const result = await response.json()
          if (!result.success) {
            console.error('[Monitoring] Failed to start CSV session:', result.message)
          }
        } else {
          const response = await fetch('http://localhost:5000/api/measurement/stop', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              deviceAddress: deviceMacAddress
            })
          })
          const result = await response.json()
          if (!result.success) {
            console.error('[Monitoring] Failed to stop CSV session:', result.message)
          }
        }
      } catch (error) {
        console.error(`[Monitoring] Error ${command.action} CSV session:`, error)
      }
      
      emit('CONTROL_REQUEST', {
        hubId,
        deviceId: deviceMacAddress,
        command: {
          action: command.action,
          raw_command: measurementCommand
        },
        requestId
      })
    }
  }
  
  // 시간 포맷 변환: timestamp -> HH:mm:ss:SSS
  const formatTime = (timestamp) => {
    if (!timestamp || isNaN(timestamp)) return '00:00:00:000'
    
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) return '00:00:00:000'
    
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0')
    
    return `${hours}:${minutes}:${seconds}:${milliseconds}`
  }
  
  // 값 유효성 검사 및 정규화 (NaN, Infinity, undefined 방어)
  const sanitizeValue = (value) => {
    if (value === null || value === undefined) return 0
    if (typeof value !== 'number') {
      const num = Number(value)
      if (isNaN(num) || !isFinite(num)) return 0
      return num
    }
    if (isNaN(value) || !isFinite(value)) return 0
    return value
  }
  
  // 차트 데이터 가져오기 (activeTab에 따라)
  const getChartDataForDisplay = () => {
    if (chartData.length === 0) return []
    
    let valueField = 'heartRate'
    if (activeTab === 'spo2') {
      valueField = 'spo2'
    } else if (activeTab === 'temperature') {
      valueField = 'temperature'
    }
    
    const result = chartData.map((d, index) => {
      const rawValue = d[valueField]
      const validValue = sanitizeValue(rawValue)
      
      return {
        index,
        value: validValue,
        timestamp: d.timestamp,
        timeString: formatTime(d.timestamp)
      }
    })
    
    return result
  }
  
  // 그래프 Y축 범위 계산 (데이터 기반 동적 범위)
  const calculateYAxisRange = (data) => {
    if (data.length === 0) {
      // 기본값 (탭에 따라 다름)
      if (activeTab === 'heartRate') {
        return { min: 0, max: 200, effectiveMin: 0, effectiveMax: 200 }
      } else if (activeTab === 'spo2') {
        return { min: 0, max: 100, effectiveMin: 0, effectiveMax: 100 }
      } else if (activeTab === 'temperature') {
        return { min: 30, max: 45, effectiveMin: 30, effectiveMax: 45 }
      }
      return { min: 0, max: 250, effectiveMin: 0, effectiveMax: 250 }
    }
    
    // 실제 데이터 값 추출
    const values = data.map(d => d.value).filter(v => isFinite(v) && !isNaN(v))
    
    if (values.length === 0) {
      // 기본값
      if (activeTab === 'heartRate') {
        return { min: 0, max: 200, effectiveMin: 0, effectiveMax: 200 }
      } else if (activeTab === 'spo2') {
        return { min: 0, max: 100, effectiveMin: 0, effectiveMax: 100 }
      } else if (activeTab === 'temperature') {
        return { min: 30, max: 45, effectiveMin: 30, effectiveMax: 45 }
      }
      return { min: 0, max: 250, effectiveMin: 0, effectiveMax: 250 }
    }
    
    let min = Math.min(...values)
    let max = Math.max(...values)
    
    // 모든 값이 같을 때 처리
    if (min === max) {
      if (activeTab === 'heartRate') {
        // 심박수: ±10% 범위 또는 최소 20 범위
        const center = min
        const range = Math.max(Math.abs(center) * 0.1, 10)
        min = Math.max(0, center - range)
        max = center + range
      } else if (activeTab === 'spo2') {
        // 산포도: ±5% 범위 또는 최소 10 범위
        const center = min
        const range = Math.max(Math.abs(center) * 0.05, 5)
        min = Math.max(0, center - range)
        max = Math.min(100, center + range)
      } else if (activeTab === 'temperature') {
        // 온도: ±2도 범위
        const center = min
        min = Math.max(30, center - 2)
        max = Math.min(45, center + 2)
      } else {
        const range = Math.max(Math.abs(min) * 0.1, 1)
        min = min - range
        max = max + range
      }
    }
    
    // 패딩 추가 (10% 여유)
    const range = max - min
    const padding = range * 0.1
    let effectiveMin = min - padding
    let effectiveMax = max + padding
    
    // 탭별 최소/최대 범위 제한
    if (activeTab === 'heartRate') {
      effectiveMin = Math.max(0, effectiveMin)
      effectiveMax = Math.min(250, effectiveMax)
    } else if (activeTab === 'spo2') {
      effectiveMin = Math.max(0, effectiveMin)
      effectiveMax = Math.min(100, effectiveMax)
    } else if (activeTab === 'temperature') {
      effectiveMin = Math.max(25, effectiveMin)
      effectiveMax = Math.min(50, effectiveMax)
    }
    
    return { min, max, effectiveMin, effectiveMax }
  }
  
  // SVG 좌표 계산 (NaN, Infinity 방어)
  const calculateChartPoints = (data, yAxisRange) => {
    if (data.length === 0) return []
    
    const { effectiveMin, effectiveMax } = yAxisRange
    const chartHeight = 260
    const chartTop = 10
    const chartBottom = 270
    const chartWidth = 800
    
    const points = data.map((d, i) => {
      // X 좌표 계산
      const x = data.length > 1
        ? (i / (data.length - 1)) * chartWidth
        : chartWidth / 2
      
      // 값 정규화 (0~1 범위)
      const range = effectiveMax - effectiveMin
      const normalized = range !== 0
        ? (d.value - effectiveMin) / range
        : 0.5
      
      // Y 좌표 계산 (상단이 max, 하단이 min)
      const y = chartBottom - (normalized * chartHeight)
      
      // 좌표 유효성 검사
      const validX = isFinite(x) && !isNaN(x) ? Math.max(0, Math.min(chartWidth, x)) : chartWidth / 2
      const validY = isFinite(y) && !isNaN(y) ? Math.max(chartTop, Math.min(chartBottom, y)) : chartBottom
      
      return { x: validX, y: validY, value: d.value, timeString: d.timeString }
    })
    
    return points
  }
  
  // SVG 차트 렌더링
  const renderChart = () => {
    const data = getChartDataForDisplay()
    const chartTop = 10
    const chartBottom = 270
    const chartWidth = 800
  
    // 빈 데이터일 때 그리드와 Y축 레이블만 표시
    if (data.length === 0) {
      return (
        <>
          {[0, 1, 2, 3, 4].map(i => (
            <line
              key={`grid-${i}`}
              x1="0"
              y1={chartTop + i * 65}
              x2={chartWidth}
              y2={chartTop + i * 65}
              stroke="#e0e0e0"
              strokeWidth="1"
              strokeDasharray="5,5"
            />
          ))}
          {/* Y축 레이블 (기본값) */}
          {[0, 1, 2, 3, 4].map(i => {
            let value = 0
            if (activeTab === 'heartRate') {
              value = 200 - (i * 50) // 200, 150, 100, 50, 0
            } else if (activeTab === 'spo2') {
              value = 100 - (i * 25) // 100, 75, 50, 25, 0
            } else if (activeTab === 'temperature') {
              value = 45 - (i * 3.75) // 45, 41.25, 37.5, 33.75, 30
            } else {
              value = 250 - (i * 50)
            }
            return (
              <text
                key={`label-${i}`}
                x="5"
                y={chartTop + 5 + i * 65}
                fill="#666"
                fontSize="12"
              >
                {activeTab === 'temperature' ? value.toFixed(1) : value.toFixed(0)}
              </text>
            )
          })}
        </>
      )
    }
  
    // Y축 범위 계산 (데이터 기반 동적 범위)
    const yAxisRange = calculateYAxisRange(data)
    const { effectiveMin, effectiveMax } = yAxisRange

    // 차트 포인트 계산
    const points = calculateChartPoints(data, yAxisRange)
    
    // 디버깅: 렌더링되는 데이터 확인
    console.log('[Monitoring] Rendering chart:', {
      tab: activeTab,
      dataCount: data.length,
      dataValues: data.map(d => ({ value: d.value, time: d.timeString })),
      yAxisRange: { min: yAxisRange.min, max: yAxisRange.max, effectiveMin, effectiveMax },
      pointsCount: points.length,
      pointsCoords: points.map(p => ({ x: p.x.toFixed(2), y: p.y.toFixed(2), value: p.value }))
    })
    
    // polyline points 문자열 생성
    const pointsString = points.map(p => `${p.x},${p.y}`).join(' ')

    return (
      <>
        {/* 그리드 라인 */}
        {[0, 1, 2, 3, 4].map(i => (
          <line
            key={`grid-${i}`}
            x1="0"
            y1={chartTop + i * 65}
            x2={chartWidth}
            y2={chartTop + i * 65}
            stroke="#e0e0e0"
            strokeWidth="1"
            strokeDasharray="5,5"
          />
        ))}

        {/* Y축 레이블 (동적 범위 기반) */}
        {[0, 1, 2, 3, 4].map(i => {
          const value = effectiveMax - (i * (effectiveMax - effectiveMin)) / 4
          const validValue = sanitizeValue(value)
          
          return (
            <text
              key={`label-${i}`}
              x="5"
              y={chartTop + 5 + i * 65}
              fill="#666"
              fontSize="12"
            >
              {validValue.toFixed(activeTab === 'temperature' ? 1 : 0)}
            </text>
          )
        })}
  
        {/* 차트 라인 (애니메이션 적용) */}
        {points.length > 1 && (
          <polyline
            fill="none"
            stroke="#3498db"
            strokeWidth="2.5"
            points={pointsString}
            style={{
              transition: 'all 0.3s ease-out',
              vectorEffect: 'non-scaling-stroke'
            }}
          />
        )}
  
        {/* 데이터 포인트 */}
        {points.map((p, i) => {
          const validX = sanitizeValue(p.x)
          const validY = sanitizeValue(p.y)
          
          return (
            <circle
              key={`point-${i}`}
              cx={validX}
              cy={validY}
              r="5"
              fill="#3498db"
              style={{
                transition: 'all 0.3s ease-out'
              }}
            />
          )
        })}
      </>
    )
  }
  
  
  const handleDismissAlert = (alertId) => {
    setHardwareAlerts(prev => prev.filter(alert => alert.id !== alertId))
  }
  
  return (
    <div className="monitoring-page">
      <Header />
      <HardwareAlertBar alerts={hardwareAlerts} onDismiss={handleDismissAlert} />
      <div className="monitoring-container">
        {/* 연결 상태 */}
        <div className="connection-status" style={{
          padding: '10px',
          marginBottom: '10px',
          backgroundColor: isConnected ? '#d4edda' : '#f8d7da',
          color: isConnected ? '#155724' : '#721c24',
          borderRadius: '4px',
          textAlign: 'center'
        }}>
          {isConnected ? '🟢 실시간 연결됨' : '🔴 연결 안 됨'}
        </div>
        
        {/* 환자 정보 */}
        <section className="patient-info-section">
          <div className="patient-info-row">
            <div className="patient-info-left">
              <h3 className="patient-name">환자 ID: {patientId}</h3>
            </div>
            <div className="device-name-right">
              {deviceInfo?.name || '디바이스 연결 중...'}
            </div>
          </div>
          
          {/* 신호처리 상태 */}
          {signalProcessingStatus.processedHR !== null && (
            <div className={`signal-processing-status ${signalProcessingStatus.status}`}>
              <div className="signal-status-header">
                <span className="signal-status-label">신호처리 상태:</span>
                <span className={`signal-status-badge ${signalProcessingStatus.status}`}>
                  {signalProcessingStatus.status === 'normal' && '✅ 정상'}
                  {signalProcessingStatus.status === 'low_quality' && '⚠️ 신뢰도 낮음'}
                  {signalProcessingStatus.status === 'reposition_needed' && '❌ 재부착 필요'}
                  {signalProcessingStatus.status === 'collecting' && '📊 수집 중'}
                </span>
              </div>
              <div className="signal-status-message">{signalProcessingStatus.message}</div>
              <div className="signal-status-metrics">
                <span className="signal-metric">
                  SQI: <strong>{signalProcessingStatus.sqi.toFixed(2)}</strong>
                </span>
                <span className="signal-metric">
                  PI: <strong>{signalProcessingStatus.pi.toFixed(2)}</strong>
                </span>
                {signalProcessingStatus.originalHR && (
                  <span className="signal-metric">
                    원본 HR: <strong>{signalProcessingStatus.originalHR} bpm</strong>
                  </span>
                )}
              </div>
            </div>
          )}
          
          {/* 현재값 */}
          <div className="current-values-row">
            <div className="current-values-left">
              <span className="current-value-item-inline">
                <span className="current-value-label-inline">심박수:</span>
                <span className="current-value-value-inline">
                  {signalProcessingStatus.processedHR !== null
                    ? `${Math.round(signalProcessingStatus.processedHR)} bpm`
                    : `${Math.round(currentValues.heartRate)} bpm`}
                  {hardwareAlerts.length > 0 && (
                    <span className="device-warning-badge" title={hardwareAlerts[0].message}>⚠️</span>
                  )}
                </span>
              </span>
              <span className="current-value-item-inline">
                <span className="current-value-label-inline">산포도:</span>
                <span className="current-value-value-inline">
                  {Math.round(currentValues.spo2)}%
                </span>
              </span>
              <span className="current-value-item-inline">
                <span className="current-value-label-inline">온도:</span>
                <span className="current-value-value-inline">
                  {currentValues.temperature.toFixed(1)}°C
                </span>
              </span>
            </div>
            <div className="battery-right">
              <span className="current-value-label-inline">배터리:</span>
              <span className="current-value-value-inline">
                {currentValues.battery}%
              </span>
            </div>
          </div>
        </section>
        
        {/* 디바이스 연결 상태 */}
        {deviceConnectionStatus === 'disconnected' && (
          <section style={{
            marginBottom: '20px',
            padding: '20px',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '4px',
            textAlign: 'center'
          }}>
            <p style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 'bold' }}>
              ⚠️ 디바이스가 연결되어 있지 않습니다.
            </p>
            <p style={{ margin: '0 0 15px 0', fontSize: '14px' }}>
              디바이스를 켜주세요.
            </p>
            <button
              className="btn-primary"
              onClick={() => navigate('/hardware')}
            >
              하드웨어 관리로 이동
            </button>
          </section>
        )}
        
        {/* 제어 버튼 */}
        {deviceConnectionStatus === 'connected' && (
          <section style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{
              padding: '8px 16px',
              backgroundColor: isMeasurementRunning ? '#d4edda' : '#f8d7da',
              color: isMeasurementRunning ? '#155724' : '#721c24',
              borderRadius: '4px',
              fontWeight: 'bold',
              fontSize: '14px'
            }}>
              {isMeasurementRunning ? '🟢 측정 실행 중' : '🔴 측정 중지됨'}
            </div>
            {isMeasurementRunning ? (
              <button
                className="btn-secondary"
                onClick={() => sendControlCommand({ action: 'stop_measurement' })}
                disabled={!isConnected}
              >
                측정 정지
              </button>
            ) : (
              <button
                className="btn-primary"
                onClick={() => sendControlCommand({ action: 'start_measurement' })}
                disabled={!isConnected}
              >
                측정 시작
              </button>
            )}
          </section>
        )}
        
        {/* 차트 섹션 */}
        <section className="chart-section">
          <div className="chart-tabs">
            <button
              className={activeTab === 'heartRate' ? 'chart-tab active' : 'chart-tab'}
              onClick={() => setActiveTab('heartRate')}
            >
              심박수
            </button>
            <button
              className={activeTab === 'spo2' ? 'chart-tab active' : 'chart-tab'}
              onClick={() => setActiveTab('spo2')}
            >
              산포도
            </button>
            <button
              className={activeTab === 'temperature' ? 'chart-tab active' : 'chart-tab'}
              onClick={() => setActiveTab('temperature')}
            >
              온도
            </button>
          </div>
          
          <div className="chart-container">
            <div className="chart-header">
              <h3>
                {activeTab === 'heartRate' && '심박수'}
                {activeTab === 'spo2' && '산포도'}
                {activeTab === 'temperature' && '온도'}
              </h3>
            </div>
            <div className="chart-area">
              <svg className="chart-svg" viewBox="0 0 800 300" preserveAspectRatio="none">
                {renderChart()}
              </svg>
              <div className="chart-labels" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                {chartData.map((d, i) => {
                  const timeStr = formatTime(d.timestamp)
                  return (
                    <div key={i} className="chart-label" style={{ flex: 1, textAlign: 'center' }}>
                      {timeStr}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>
        
        <div className="back-button">
          <button onClick={() => navigate('/dashboard')} className="btn-secondary">
            대시보드로 돌아가기
          </button>
        </div>
      </div>
    </div>
  )
}

export default Monitoring

