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
  const [activeTab, setActiveTab] = useState('heartRate') // ir, heartRate, spo2, temperature
  const [chartData, setChartData] = useState([])
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [petInfo, setPetInfo] = useState(null) // 펫 정보 저장
  const [currentValues, setCurrentValues] = useState({
    heartRate: 0,
    spo2: 0,
    temperature: 0,
    battery: 0
  })
  const [deviceInfo, setDeviceInfo] = useState(null)
  const deviceInfoRef = useRef(null) // 디바이스 정보 참조용
  const petInfoRef = useRef(null) // 펫 정보 참조용
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
  const [isErrorSimulationActive, setIsErrorSimulationActive] = useState(false)
  const [simulatedError, setSimulatedError] = useState(null) // null 또는 { code, type, message }
  const chartDataRef = useRef([])
  const simulationIntervalRef = useRef(null)
  const errorDurationRef = useRef(null)
  const measurementStartTimeRef = useRef(null) // 측정 시작 시간 저장
  const spo2NineCountRef = useRef(0) // 산포도 9가 연속으로 나온 횟수
  const [deviceConnectionStatus, setDeviceConnectionStatus] = useState('unknown') // 디바이스 연결 상태
  const [hubStatus, setHubStatus] = useState(false) // 허브 온라인 상태

  // 초기 디바이스 정보 로드 (한 번만 실행)
  useEffect(() => {
    const loadDeviceInfo = async () => {
      if (!patientId) return;
      
      try {
        // 1. pet 정보 조회
        const pet = await petService.getPet(patientId);
        if (!pet || !pet.device_address) {
          console.warn('[Monitoring] Pet has no device_address');
          setDeviceConnectionStatus('disconnected');
          return;
        }
        
        // 펫 정보 저장
        setPetInfo(pet);
        petInfoRef.current = pet; // ref에도 저장
        
        // 2. device 정보 조회
        const device = await deviceService.getDevice(pet.device_address);
        if (device) {
          setDeviceInfo(device);
          deviceInfoRef.current = device; // ref에도 저장
          console.log('[Monitoring] Loaded device info:', device);
          
          // 허브 상태 체크
          if (device.hub_address && isConnected) {
            const requestId = `state_check_${device.hub_address}_${Date.now()}`;
            emit('CONTROL_REQUEST', {
              hubId: device.hub_address,
              deviceId: 'HUB',
              command: {
                raw_command: 'state:hub'
              },
              requestId
            });
          }
        } else {
          setDeviceConnectionStatus('disconnected');
        }
      } catch (error) {
        console.error('[Monitoring] Failed to load device info:', error);
        setDeviceConnectionStatus('disconnected');
      }
    };

    loadDeviceInfo();
  }, [patientId, isConnected, emit]); // patientId가 변경될 때만 실행

  // 페이지 접속 시 주기적으로 허브 상태 체크
  useEffect(() => {
    if (!isConnected || !deviceInfo?.hub_address) return;

    const checkHubState = () => {
      const requestId = `state_check_${deviceInfo.hub_address}_${Date.now()}`;
      emit('CONTROL_REQUEST', {
        hubId: deviceInfo.hub_address,
        deviceId: 'HUB',
        command: {
          raw_command: 'state:hub'
        },
        requestId
      });
    };

    // 즉시 한 번 실행
    checkHubState();

    // 30초마다 상태 체크
    const interval = setInterval(checkHubState, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [isConnected, deviceInfo?.hub_address, emit]);

  // Socket.IO 이벤트 리스너 설정
  useEffect(() => {
    if (!isConnected) {
      console.log('[Monitoring] Socket not connected yet');
      return;
    }

    console.log('[Monitoring] Setting up Socket.IO listeners');

    // TELEMETRY 데이터 수신
    const handleTelemetry = (data) => {
      console.log('[Monitoring] Received TELEMETRY:', data);
      
      if (data.type === 'sensor_data' && data.deviceId) {
        // 디바이스 매칭 확인 (ref 사용으로 dependency 문제 해결)
        const currentDeviceInfo = deviceInfoRef.current;
        if (currentDeviceInfo && currentDeviceInfo.address !== data.deviceId) {
          console.log(`[Monitoring] Ignoring TELEMETRY from device ${data.deviceId}, expecting ${currentDeviceInfo.address}`);
          return; // 다른 디바이스의 데이터는 무시
        }
        
        // deviceInfo가 없거나 매칭되면 데이터 처리
        // 신호처리 결과 확인
        if (data.data?.processedHR !== undefined) {
          // 신호처리된 HR 사용
          setSignalProcessingStatus({
            processedHR: data.data.processedHR,
            originalHR: data.data.originalHR || null,
            sqi: data.data.sqi || 0,
            pi: data.data.pi || 0,
            status: data.data.status || 'normal',
            message: data.data.statusMessage || '정상 측정'
          });
        }

        // dataArr가 있는 경우 (배치 데이터)
        if (data.data?.dataArr && Array.isArray(data.data.dataArr)) {
          // start_time 파싱 (HHmmssSSS 형식)
          const parseStartTime = (startTimeStr) => {
            if (!startTimeStr || startTimeStr.length < 9) {
              // start_time이 없으면 현재 시간 사용
              const now = Date.now();
              if (!measurementStartTimeRef.current) {
                measurementStartTimeRef.current = now;
              }
              return measurementStartTimeRef.current;
            }
            try {
              const hours = parseInt(startTimeStr.substring(0, 2));
              const minutes = parseInt(startTimeStr.substring(2, 4));
              const seconds = parseInt(startTimeStr.substring(4, 6));
              const milliseconds = parseInt(startTimeStr.substring(6, 9));
              const today = new Date();
              today.setHours(hours, minutes, seconds, milliseconds);
              const startTimeMs = today.getTime();
              
              // 측정 시작 시간 저장 (첫 번째 데이터인 경우)
              if (!measurementStartTimeRef.current) {
                measurementStartTimeRef.current = startTimeMs;
              }
              
              return startTimeMs;
            } catch (e) {
              const now = Date.now();
              if (!measurementStartTimeRef.current) {
                measurementStartTimeRef.current = now;
              }
              return measurementStartTimeRef.current;
            }
          };

          const startTimeStr = data.data.start_time || '000000000';
          const startTimeMs = parseStartTime(startTimeStr);
          const samplingRate = data.data.sampling_rate || 50;
          
          // 각 샘플마다 개별 데이터 포인트로 처리
          // 시간 계산: start_time + (1 / sampling_rate * 250 * index)
          const newData = data.data.dataArr.map((sample, index) => {
            // 시간 계산: start_time + (1 / sampling_rate * 250 * index) 초
            const elapsedSecondsFromStart = (1 / samplingRate) * 250 * index; // 초 단위
            const sampleTime = startTimeMs + (elapsedSecondsFromStart * 1000); // 밀리초로 변환
            
            // 실제 시간 계산 (측정 시작 시간 + 경과 시간)
            const actualTime = new Date(sampleTime);
            const hours = actualTime.getHours();
            const minutes = actualTime.getMinutes();
            const seconds = actualTime.getSeconds();
            const milliseconds = actualTime.getMilliseconds();
            const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(milliseconds).padStart(3, '0')}`;
            
            // 허브에서 나오는 데이터: spo2와 hr이 바뀌어 있음
            // 신호처리된 HR 우선 사용, 없으면 sample.hr 사용
            const heartRate = data.data.processedHR !== undefined && data.data.processedHR !== null 
              ? data.data.processedHR 
              : (sample.hr || data.data.hr || 0);
            
            const spo2 = sample.spo2 !== null && sample.spo2 !== undefined ? sample.spo2 : (data.data.spo2 || 0);
            
            return {
              timestamp: sampleTime,
              elapsedSeconds: elapsedSecondsFromStart,
              time: timeString,
              ir: sample.ir || 0,
              heartRate: heartRate,
              spo2: spo2,
              temperature: sample.temp !== null && sample.temp !== undefined ? sample.temp : (data.data.temp || 0),
              battery: sample.battery || 0
            };
          });

          // 최신 데이터로 현재 값 업데이트
          if (newData.length > 0) {
            const latest = newData[newData.length - 1];
          setCurrentValues(prev => ({
            heartRate: latest.heartRate,
            spo2: latest.spo2,
            temperature: latest.temperature,
            battery: latest.battery !== 0 ? latest.battery : prev.battery
          }));
          
          // 산포도가 9인지 체크 (2번 이상 연속으로 나오면 경고)
          if (latest.spo2 === 9) {
            spo2NineCountRef.current += 1;
            if (spo2NineCountRef.current >= 2) {
              // 펫 이름 가져오기
              const petName = petInfoRef.current?.name || '강아지';
              alert(`현재 연결된 ${petName}가 많이 움직이고 있어 정확한 측정이 어렵습니다.`);
              spo2NineCountRef.current = 0; // 알림 후 리셋
            }
          } else {
            // 산포도가 9가 아니면 카운터 리셋
            spo2NineCountRef.current = 0;
          }

          // 시뮬레이션된 오류가 있으면 그것을 우선 사용, 없으면 실제 데이터에서 감지
          // 신호처리된 HR이 있으면 그것을 사용
          const hrForErrorDetection = data.data.processedHR !== undefined && data.data.processedHR !== null
            ? data.data.processedHR
            : latest.heartRate;
          const error = simulatedError || detectHardwareError(hrForErrorDetection);
          if (error) {
            setHardwareAlerts([{
              id: `alert-${data.deviceId}-${error.code}`,
              deviceId: data.deviceId,
              deviceName: deviceInfo?.name || data.deviceId,
              deviceAddress: data.deviceId,
              ...error,
              timestamp: Date.now()
            }]);
          } else {
            setHardwareAlerts([]);
          }
          }

          // 각 샘플을 개별 데이터 포인트로 차트에 추가 (오른쪽에서 왼쪽으로 밀어주는 느낌)
          if (newData.length > 0) {
            setChartData(prev => {
              // 기존 데이터와 새 데이터를 합치되, 같은 timestamp를 가진 데이터는 제거
              const existingTimestamps = new Set(prev.map(d => d.timestamp));
              const uniqueNewData = newData.filter(d => !existingTimestamps.has(d.timestamp));
              const updated = [...prev, ...uniqueNewData];
              // 시간 순서대로 정렬
              const sorted = updated.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
              // 최근 데이터만 유지 (10개 정도 표시하기 위해 충분한 양 유지)
              return sorted.slice(-50);
            });
          }
        } else {
          // 단일 샘플인 경우 또는 신호처리된 데이터
          const heartRate = data.data?.processedHR !== undefined && data.data?.processedHR !== null
            ? data.data.processedHR
            : (data.data?.hr || 0);
          
          const spo2 = data.data?.spo2 || 0;
          
          // start_time이 있으면 파싱, 없으면 현재 시간 사용
          const parseStartTime = (startTimeStr) => {
            if (!startTimeStr || startTimeStr.length < 9) {
              const now = Date.now();
              if (!measurementStartTimeRef.current) {
                measurementStartTimeRef.current = now;
              }
              return measurementStartTimeRef.current;
            }
            try {
              const hours = parseInt(startTimeStr.substring(0, 2));
              const minutes = parseInt(startTimeStr.substring(2, 4));
              const seconds = parseInt(startTimeStr.substring(4, 6));
              const milliseconds = parseInt(startTimeStr.substring(6, 9));
              const today = new Date();
              today.setHours(hours, minutes, seconds, milliseconds);
              const startTimeMs = today.getTime();
              
              if (!measurementStartTimeRef.current) {
                measurementStartTimeRef.current = startTimeMs;
              }
              
              return startTimeMs;
            } catch (e) {
              const now = Date.now();
              if (!measurementStartTimeRef.current) {
                measurementStartTimeRef.current = now;
              }
              return measurementStartTimeRef.current;
            }
          };

          const deviceTime = data.data?.start_time 
            ? parseStartTime(data.data.start_time)
            : (data.timestamp || data.data?.timestamp || Date.now());
          
          const elapsedMs = deviceTime - measurementStartTimeRef.current;
          const elapsedSeconds = elapsedMs / 1000;
          
          // 경과 시간을 HH:MM:SS:SSS 형식으로 표시
          const hours = Math.floor(elapsedSeconds / 3600);
          const minutes = Math.floor((elapsedSeconds % 3600) / 60);
          const seconds = Math.floor(elapsedSeconds % 60);
          const milliseconds = Math.floor(elapsedMs % 1000);
          const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(milliseconds).padStart(3, '0')}`;
          
          const sample = {
            timestamp: deviceTime,
            elapsedSeconds: elapsedSeconds,
            time: timeString,
            ir: data.data?.ir || 0,
            heartRate: heartRate,
            spo2: spo2,
            temperature: data.data?.temp || 0,
            battery: data.data?.battery || 0
          };

          setCurrentValues(prev => ({
            heartRate: sample.heartRate,
            spo2: sample.spo2,
            temperature: sample.temperature,
            battery: sample.battery !== 0 ? sample.battery : prev.battery
          }));
          
          // 산포도가 9인지 체크 (2번 이상 연속으로 나오면 경고)
          if (sample.spo2 === 9) {
            spo2NineCountRef.current += 1;
            if (spo2NineCountRef.current >= 2) {
              // 펫 이름 가져오기
              const petName = petInfoRef.current?.name || '강아지';
              alert(`현재 연결된 ${petName}가 많이 움직이고 있어 정확한 측정이 어렵습니다.`);
              spo2NineCountRef.current = 0; // 알림 후 리셋
            }
          } else {
            // 산포도가 9가 아니면 카운터 리셋
            spo2NineCountRef.current = 0;
          }

          // 시뮬레이션된 오류가 있으면 그것을 우선 사용, 없으면 실제 데이터에서 감지
          const error = simulatedError || detectHardwareError(sample.heartRate);
          if (error) {
            setHardwareAlerts([{
              id: `alert-${data.deviceId}-${error.code}`,
              deviceId: data.deviceId,
              deviceName: deviceInfo?.name || data.deviceId,
              deviceAddress: data.deviceId,
              ...error,
              timestamp: Date.now()
            }]);
          } else {
            setHardwareAlerts([]);
          }

          // 단일 샘플도 차트에 추가 (중복 제거)
          setChartData(prev => {
            const existingTimestamps = new Set(prev.map(d => d.timestamp));
            if (!existingTimestamps.has(sample.timestamp)) {
              const updated = [...prev, sample];
              // 최근 100개만 유지 (10칸 기준으로 충분)
              return updated.slice(-100);
            }
            return prev;
          });
        }
      }
    };

    // DEVICE_STATUS 수신
    const handleDeviceStatus = (data) => {
      console.log('[Monitoring] Received DEVICE_STATUS:', data);
      setDeviceInfo(data);
    };

    // MQTT_READY 메시지 수신 (디바이스 검색 모달 트리거)
    const handleMqttReady = (data) => {
      console.log('[Monitoring] Received MQTT_READY:', data);
      if (data.message && data.message.includes('mqtt ready')) {
        // TODO: 디바이스 검색 모달 표시
        console.log('[Monitoring] 디바이스 검색 모달 표시 필요');
        alert('디바이스 검색을 시작합니다.');
      }
    };

    // CONTROL_RESULT 수신 (명령 실행 결과)
    const handleControlResult = (data) => {
      console.log('[Monitoring] Received CONTROL_RESULT:', data);
      
      // 현재 경로가 Monitoring 페이지인지 확인
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/monitoring/')) {
        // Monitoring 페이지가 아니면 무시
        console.log('[Monitoring] Ignoring CONTROL_RESULT (not on monitoring page)');
        return;
      }
      
      if (data.success) {
        const command = data.data?.command || data.command || {};
        console.log('[Monitoring] Command result success, command:', command);
        
        if (command.action === 'start_measurement') {
          setIsMeasurementRunning(true);
          measurementStartTimeRef.current = null; // 측정 시작 시간 리셋
          spo2NineCountRef.current = 0; // 산포도 9 카운터 리셋
          setChartData([]); // 차트 데이터 초기화
          console.log('[Monitoring] 측정이 시작되었습니다.');
        } else if (command.action === 'stop_measurement') {
          setIsMeasurementRunning(false);
          spo2NineCountRef.current = 0; // 산포도 9 카운터 리셋
          console.log('[Monitoring] 측정이 정지되었습니다.');
        } else if (command.action === 'check_hub_state') {
          // 상태 체크 명령은 응답을 CONNECTED_DEVICES로 받음
          console.log('[Monitoring] 허브 상태 확인 명령 전송됨');
        } else {
          console.log('[Monitoring] 명령이 성공적으로 실행되었습니다.');
        }
      } else {
        // 에러 메시지에서 타임아웃 관련 메시지 필터링
        const errorMsg = data.error || '알 수 없는 오류';
        if (errorMsg.includes('timeout') || errorMsg.includes('타임아웃')) {
          console.error('[Monitoring] Command timeout error:', errorMsg);
          alert(`명령 실행 실패: ${errorMsg}\n\nmqtt-monitor 서버가 실행 중인지 확인해주세요.`);
        } else {
          alert(`명령 실행 실패: ${errorMsg}`);
        }
      }
    };

    // 연결된 디바이스 목록 수신 (state:hub 응답)
    const handleConnectedDevices = (payload) => {
      const hubAddress = payload.hubAddress;
      const connectedDevices = payload.connected_devices || [];

      if (hubAddress === deviceInfoRef.current?.hub_address) {
        setHubStatus(true);
        
        // 현재 디바이스가 연결되어 있는지 확인
        const normalizeMac = (mac) => mac.replace(/[:-]/g, '').toUpperCase();
        const currentDeviceMac = normalizeMac(deviceInfoRef.current?.address || '');
        const isConnected = connectedDevices.some(mac => normalizeMac(mac) === currentDeviceMac);
        
        setDeviceConnectionStatus(isConnected ? 'connected' : 'disconnected');
      }
    };

    // 이벤트 리스너 등록
    on('TELEMETRY', handleTelemetry);
    on('DEVICE_STATUS', handleDeviceStatus);
    on('CONTROL_RESULT', handleControlResult);
    on('MQTT_READY', handleMqttReady);
    on('CONNECTED_DEVICES', handleConnectedDevices);

    // 정리 함수
    return () => {
      off('TELEMETRY', handleTelemetry);
      off('DEVICE_STATUS', handleDeviceStatus);
      off('CONTROL_RESULT', handleControlResult);
      off('MQTT_READY', handleMqttReady);
      off('CONNECTED_DEVICES', handleConnectedDevices);
    };
  }, [isConnected, patientId, on, off, simulatedError]); // deviceInfo 제거

  // 랜덤 오류 시뮬레이션
  useEffect(() => {
    if (!isErrorSimulationActive) {
      // 시뮬레이션이 비활성화되면 정리
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
      if (errorDurationRef.current) {
        clearTimeout(errorDurationRef.current);
        errorDurationRef.current = null;
      }
      setSimulatedError(null);
      setHardwareAlerts([]);
      return;
    }

    // 랜덤 오류 발생 함수
    const triggerRandomError = () => {
      // 랜덤하게 오류 발생 (30% 확률)
      if (Math.random() < 0.3) {
        const errorCodes = [
          { code: 'hr:7', type: 'warning', message: '배터리가 부족하니 충전을 해라.' },
          { code: 'hr:8', type: 'error', message: '신호가 불량하니 다시 해라' },
          { code: 'hr:9', type: 'info', message: '날뛰고 있어 신호가 안나오니 참고해라' }
        ];
        
        const randomError = errorCodes[Math.floor(Math.random() * errorCodes.length)];
        setSimulatedError(randomError);

        // 오류 알림 생성
        setHardwareAlerts([{
          id: `simulated-alert-${Date.now()}`,
          deviceId: patientId || 'test-device',
          deviceName: deviceInfo?.name || '테스트 디바이스',
          deviceAddress: patientId || 'TEST:00:00:00:00:00',
          ...randomError,
          timestamp: Date.now()
        }]);

        // 5-15초 후 자동으로 정상 복귀
        const errorDuration = 5000 + Math.random() * 10000; // 5-15초
        errorDurationRef.current = setTimeout(() => {
          setSimulatedError(null);
          setHardwareAlerts([]);
        }, errorDuration);
      }
    };

    // 처음 한 번 실행
    triggerRandomError();

    // 10-30초마다 랜덤 오류 발생 시도
    const interval = 10000 + Math.random() * 20000; // 10-30초
    simulationIntervalRef.current = setInterval(triggerRandomError, interval);

    return () => {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
      if (errorDurationRef.current) {
        clearTimeout(errorDurationRef.current);
        errorDurationRef.current = null;
      }
    };
  }, [isErrorSimulationActive, patientId, deviceInfo]);

  const handleToggleErrorSimulation = () => {
    setIsErrorSimulationActive(prev => !prev);
  };



  // 디바이스 제어 함수
  const sendControlCommand = async (command) => {
    if (!isConnected) {
      alert('Socket이 연결되지 않았습니다.');
      return;
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 측정 시작/정지 명령
    if (command.action === 'start_measurement' || command.action === 'stop_measurement') {
      // 디바이스 정보 가져오기
      let deviceMacAddress = null;
      let hubId = null;
      
      // deviceInfo가 있으면 사용
      if (deviceInfo && deviceInfo.hub_address) {
        hubId = deviceInfo.hub_address;
        deviceMacAddress = deviceInfo.address;
      } else if (patientId) {
        // patientId는 pet의 ID이므로, pet 테이블에서 device_address를 가져온 다음 device 조회
        try {
          // 1. pet 정보 조회
          const pet = await petService.getPet(patientId);
          if (!pet || !pet.device_address) {
            alert('환자에 연결된 디바이스를 찾을 수 없습니다.');
            return;
          }
          
          // 2. device 정보 조회 (사용자 email 확인 포함)
          const device = await deviceService.getDevice(pet.device_address);
          if (!device || !device.hub_address) {
            alert('디바이스 정보를 찾을 수 없습니다.');
            return;
          }
          
          hubId = device.hub_address;
          deviceMacAddress = device.address;
          
          // deviceInfo 업데이트
          setDeviceInfo(device);
        } catch (error) {
          console.error('[Monitoring] Failed to get device info:', error);
          alert('디바이스 정보를 가져오는데 실패했습니다.');
          return;
        }
      }
      
      if (!hubId) {
        alert('디바이스의 허브 정보를 찾을 수 없습니다.');
        return;
      }
      
      const measurementCommand = command.action === 'start_measurement' 
        ? `start:${deviceMacAddress}`
        : `stop:${deviceMacAddress}`;
      
      console.log(`[Monitoring] 📤 Sending ${command.action} command:`, {
        hubId,
        deviceId: deviceMacAddress,
        command: measurementCommand
      });
      
      // CSV 세션 시작/종료
      try {
        const now = new Date();
        const startTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}:${String(now.getMilliseconds()).padStart(3, '0')}`;
        
        if (command.action === 'start_measurement') {
          const response = await fetch('http://localhost:5000/api/measurement/start', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              deviceAddress: deviceMacAddress,
              userEmail: 'test@example.com', // TODO: 실제 사용자 이메일로 변경
              petName: '테스트펫', // TODO: 실제 펫 이름으로 변경
              startTime
            })
          });
          const result = await response.json();
          if (!result.success) {
            console.error('[Monitoring] Failed to start CSV session:', result.message);
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
          });
          const result = await response.json();
          if (!result.success) {
            console.error('[Monitoring] Failed to stop CSV session:', result.message);
          }
        }
      } catch (error) {
        console.error(`[Monitoring] Error ${command.action} CSV session:`, error);
      }
      
      // Socket.IO로 제어 명령 전송
      emit('CONTROL_REQUEST', {
        hubId,
        deviceId: deviceMacAddress,
        command: {
          action: command.action,
          raw_command: measurementCommand
        },
        requestId
      });
    } else {
      // 기타 명령은 그대로 전송
      console.log('[Monitoring] 📤 Sending MQTT command:', command);
      emit('CONTROL_REQUEST', {
        hubId: '', // 임시 값
        deviceId: patientId || '', // 임시 값
        command,
        requestId
      });
    }
  };

  const getChartData = () => {
    if (!chartData || chartData.length === 0) return [];
    
    // activeTab에 따라 올바른 필드 선택
    let valueField = 'heartRate';
    if (activeTab === 'spo2') {
      valueField = 'spo2';
    } else if (activeTab === 'temperature') {
      valueField = 'temperature';
    } else if (activeTab === 'heartRate') {
      valueField = 'heartRate';
    }

    // 데이터 필터링 및 정렬 (시간 순서대로)
    const validData = chartData
      .map(d => ({
        timestamp: d.timestamp,
        elapsedSeconds: d.elapsedSeconds || 0,
        value: d[valueField],
        time: d.time
      }))
      .filter(d => d.value !== null && d.value !== undefined && !isNaN(d.value))
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)); // 시간 순서대로 정렬

    // 최근 10개 데이터만 선택 (오른쪽이 최신, 왼쪽이 오래된 정보)
    const recentData = validData.slice(-10);
    
    // 10칸 기준으로 데이터 매핑 (왼쪽이 1번=오래된 정보, 오른쪽이 10번=최신 정보)
    const chartDataArray = recentData.map((data, index) => {
      return {
        slotNumber: index + 1, // 1~10 (왼쪽부터)
        timestamp: data.timestamp,
        elapsedSeconds: data.elapsedSeconds,
        value: data.value,
        time: data.time // 실제 시간 (HH:MM:SS:SSS 형식)
      };
    });
    
    return chartDataArray;
  }

  const renderChart = () => {
    const data = getChartData();
    
    // 빈 그래프 표시 (데이터가 없어도 그래프 표는 보여줌)
    if (data.length === 0) {
      return (
        <>
          {/* 그리드 라인만 표시 */}
          {[0, 1, 2, 3, 4].map(i => (
            <line
              key={`grid-${i}`}
              x1="0"
              y1={10 + i * 70}
              x2="800"
              y2={10 + i * 70}
              stroke="#e0e0e0"
              strokeWidth="1"
              strokeDasharray="5,5"
            />
          ))}
        </>
      );
    }

    // Y축 범위를 0~250으로 고정
    const effectiveMin = 0;
    const effectiveMax = 250;

    // slotNumber 기준으로 정렬 (1~10 순서, 왼쪽이 1번, 오른쪽이 10번)
    const sortedData = [...data].sort((a, b) => (a.slotNumber || 0) - (b.slotNumber || 0));

    // 포인트 생성 (10칸에 맞춰 균등 배치, 왼쪽이 1번, 오른쪽이 10번)
    const points = sortedData.map((d, i) => {
      // 10칸 기준으로 x 위치 계산
      // 데이터가 10개 미만일 때도 올바르게 배치
      const totalSlots = Math.max(10, sortedData.length);
      const slotIndex = (d.slotNumber || (i + 1)) - 1; // 1~10을 0~9로 변환
      const x = totalSlots > 1 ? (slotIndex / (totalSlots - 1)) * 800 : 400;
      const normalizedValue = (d.value - effectiveMin) / (effectiveMax - effectiveMin);
      const y = 280 - (normalizedValue * 260); // 10px 여백, 260px 그래프 영역
      return `${x},${Math.max(10, Math.min(290, y))}`; // Y 범위 제한
    }).join(' ');

    return (
      <>
        {/* 그리드 라인 */}
        {[0, 1, 2, 3, 4].map(i => (
          <line
            key={`grid-${i}`}
            x1="0"
            y1={10 + i * 70}
            x2="800"
            y2={10 + i * 70}
            stroke="#e0e0e0"
            strokeWidth="1"
            strokeDasharray="5,5"
          />
        ))}
        
        {/* Y축 레이블 (0~250 범위) */}
        {[0, 1, 2, 3, 4].map(i => {
          const value = effectiveMax - (i * (effectiveMax - effectiveMin) / 4);
          return (
            <text
              key={`label-${i}`}
              x="5"
              y={15 + i * 70}
              fill="#666"
              fontSize="12"
            >
              {value.toFixed(0)}
            </text>
          );
        })}
        
        {/* 차트 라인 */}
        <polyline
          fill="none"
          stroke="#3498db"
          strokeWidth="2.5"
          points={points}
        />
        
        {/* 데이터 포인트 표시 */}
        {sortedData.map((d, i) => {
          const slotIndex = (d.slotNumber || (i + 1)) - 1; // 1~10을 0~9로 변환
          const x = (slotIndex / 9) * 800; // 0~9를 0~800으로 매핑
          const normalizedValue = (d.value - effectiveMin) / (effectiveMax - effectiveMin);
          const y = Math.max(10, Math.min(290, 280 - (normalizedValue * 260)));
          return (
            <circle
              key={`point-${d.slotNumber || i}`}
              cx={x}
              cy={y}
              r="5"
              fill="#3498db"
            />
          );
        })}
      </>
    );
  }

  const handleShowMore = () => {
    // TODO: 실제 환자 데이터 가져오기
    setSelectedPatient({
      name: '환자명',
      species: '강아지',
      breed: '포메라니안',
      weight: '3.5kg',
      gender: '수컷',
      neutered: true,
      doctor: '김수의사',
      diagnosis: '건강함'
    })
  }

  const handleCloseModal = () => {
    setSelectedPatient(null)
  }

  const handleDismissAlert = (alertId) => {
    setHardwareAlerts(prev => prev.filter(alert => alert.id !== alertId))
  }

  return (
    <div className="monitoring-page">
      <Header />
      <HardwareAlertBar alerts={hardwareAlerts} onDismiss={handleDismissAlert} />
      <div className="monitoring-container">
        {/* 연결 상태 표시 */}
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
              <div className="patient-info-items">
                <button 
                  className="more-btn"
                  onClick={handleShowMore}
                >
                  더보기
                </button>
              </div>
            </div>
            <div className="device-name-right">
              {deviceInfo?.name || '디바이스 연결 중...'}
            </div>
          </div>
          {/* 신호처리 상태 표시 */}
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

        {/* 디바이스 연결 상태 확인 */}
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
                {(() => {
                  const chartData = getChartData();
                  // 데이터가 있는 슬롯만 시간 표시
                  return chartData.map((d, i) => (
                    <div key={i} className="chart-label" style={{ flex: 1, textAlign: 'center' }}>
                      {d.time}
                    </div>
                  ));
                })()}
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

      {/* 환자 상세 정보 모달 */}
      {selectedPatient && (
        <div className="modal-overlay">
          <div className="modal-content patient-detail-modal">
            <div className="modal-header">
              <h3>환자 상세 정보</h3>
              <button onClick={handleCloseModal} className="close-btn">×</button>
            </div>
            <div className="modal-body">
              <div className="patient-detail-grid">
                {Object.entries(selectedPatient).map(([key, value]) => (
                  <div key={key} className="detail-item">
                    <span className="detail-label">{key}:</span>
                    <span className="detail-value">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={handleCloseModal} className="btn-primary">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Monitoring
