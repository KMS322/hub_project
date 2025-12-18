import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import HardwareAlertBar from "../components/HardwareAlertBar";
import petService from "../api/petService";
import deviceService from "../api/deviceService";
import hubService from "../api/hubService";
import { useSocket } from "../hooks/useSocket";
import { detectDeviceErrors } from "../utils/hardwareErrorDetector";
import ConfirmModal from "../components/ConfirmModal";
import "./Dashboard.css";

function Dashboard() {
  const navigate = useNavigate();
  const { isConnected, on, off, emit } = useSocket();
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [connectedDevices, setConnectedDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hardwareAlerts, setHardwareAlerts] = useState([]);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
  });
  const [deviceConnectionStatuses, setDeviceConnectionStatuses] = useState({}); // 디바이스 연결 상태
  const [hubStatuses, setHubStatuses] = useState({}); // 허브 온라인 상태
  const [measurementStates, setMeasurementStates] = useState({}); // 디바이스별 측정 상태 { deviceAddress: true/false }

  // 데이터 로드
  useEffect(() => {
    loadData();
  }, []);

  // Socket.IO로 실시간 데이터 업데이트
  useEffect(() => {
    if (!isConnected) return;

    const handleTelemetry = (data) => {
      if (data.type === "sensor_data" && data.deviceId) {
        // 디바이스의 현재 데이터 업데이트
        setConnectedDevices((prev) =>
          prev.map((device) => {
            if (device.address === data.deviceId) {
              const latest =
                data.data?.dataArr?.[data.data.dataArr.length - 1] || data.data;
              return {
                ...device,
                currentData: {
                  heartRate: latest.hr || device.currentData?.heartRate || 0,
                  spo2: latest.spo2 || device.currentData?.spo2 || 0,
                  temperature:
                    latest.temp || device.currentData?.temperature || 0,
                  battery: latest.battery || device.currentData?.battery || 0,
                },
              };
            }
            return device;
          })
        );
      }
    };

    // 연결된 디바이스 목록 수신 (state:hub 응답)
    const handleConnectedDevices = (payload) => {
      const hubAddress = payload.hubAddress;
      const connectedDevices = payload.connected_devices || [];

      if (hubAddress) {
        setHubStatuses(prev => ({
          ...prev,
          [hubAddress]: true
        }));
      }

      // 연결된 디바이스 상태 업데이트
      const normalizeMac = (mac) => mac.replace(/[:-]/g, '').toUpperCase();
      const connectedMacSet = new Set(connectedDevices.map(mac => normalizeMac(mac)));

      setDeviceConnectionStatuses(prev => {
        const newStatuses = { ...prev };
        connectedDevices.forEach(device => {
          const deviceMac = normalizeMac(device);
          newStatuses[deviceMac] = 'connected';
        });
        return newStatuses;
      });
    };

    // 측정 시작/정지 결과 수신
    const handleControlResult = (data) => {
      if (data.success && data.deviceId) {
        const command = data.data?.command || data.command || {};
        if (command.action === 'start_measurement') {
          setMeasurementStates(prev => ({
            ...prev,
            [data.deviceId]: true
          }));
        } else if (command.action === 'stop_measurement') {
          setMeasurementStates(prev => ({
            ...prev,
            [data.deviceId]: false
          }));
        }
      }
    };

    on("TELEMETRY", handleTelemetry);
    on("CONNECTED_DEVICES", handleConnectedDevices);
    on("CONTROL_RESULT", handleControlResult);

    return () => {
      off("TELEMETRY", handleTelemetry);
      off("CONNECTED_DEVICES", handleConnectedDevices);
      off("CONTROL_RESULT", handleControlResult);
    };
  }, [isConnected, on, off]);

  // 페이지 접속 시 허브 상태 체크
  useEffect(() => {
    if (!isConnected) return;

    const checkHubStates = async () => {
      try {
        const hubs = await hubService.getHubs();
        hubs.forEach(hub => {
          const requestId = `state_check_${hub.address}_${Date.now()}`;
          emit('CONTROL_REQUEST', {
            hubId: hub.address,
            deviceId: 'HUB',
            command: {
              raw_command: 'state:hub'
            },
            requestId
          });
        });
      } catch (error) {
        console.error('[Dashboard] Failed to check hub states:', error);
      }
    };

    // 즉시 한 번 실행
    checkHubStates();

    // 30초마다 상태 체크
    const interval = setInterval(checkHubStates, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [isConnected, emit]);

  // 하드웨어 오류 감지 및 알림 업데이트
  useEffect(() => {
    const alerts = detectDeviceErrors(connectedDevices);
    setHardwareAlerts(alerts);
  }, [connectedDevices]);

  const handleDismissAlert = (alertId) => {
    setHardwareAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
  };

  // 측정 시작
  const handleStartMeasurement = async (device) => {
    if (!isConnected) {
      alert('서버와의 연결이 없습니다.');
      return;
    }

    if (!device.hub_address) {
      alert('디바이스의 허브 정보를 찾을 수 없습니다.');
      return;
    }

    // 디바이스 연결 상태 확인
    const normalizeMac = (mac) => mac.replace(/[:-]/g, '').toUpperCase();
    const deviceMac = normalizeMac(device.address);
    const isConnected = deviceConnectionStatuses[deviceMac] === 'connected' || 
                       deviceConnectionStatuses[device.address] === 'connected';
    
    if (!isConnected) {
      alert('디바이스가 연결되어 있지 않습니다. 디바이스를 켜주세요.');
      return;
    }

    const requestId = `start_${device.address}_${Date.now()}`;
    const measurementCommand = `start:${device.address}`;

    console.log('[Dashboard] 📤 Sending start measurement command:', {
      hubId: device.hub_address,
      deviceId: device.address,
      command: measurementCommand
    });

    // CSV 세션 시작
    try {
      const now = new Date();
      const startTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}:${String(now.getMilliseconds()).padStart(3, '0')}`;
      
      const response = await fetch('http://localhost:5000/api/measurement/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          deviceAddress: device.address,
          userEmail: 'test@example.com', // TODO: 실제 사용자 이메일로 변경
          petName: device.connectedPatient?.name || '테스트펫',
          startTime
        })
      });
      const result = await response.json();
      if (!result.success) {
        console.error('[Dashboard] Failed to start CSV session:', result.message);
      }
    } catch (error) {
      console.error('[Dashboard] Error starting CSV session:', error);
    }

    // Socket.IO로 제어 명령 전송
    emit('CONTROL_REQUEST', {
      hubId: device.hub_address,
      deviceId: device.address,
      command: {
        action: 'start_measurement',
        raw_command: measurementCommand
      },
      requestId
    });

    // 측정 상태 즉시 업데이트 (응답 대기 전)
    setMeasurementStates(prev => ({
      ...prev,
      [device.address]: true
    }));
  };

  // 측정 정지
  const handleStopMeasurement = async (device) => {
    if (!isConnected) {
      alert('서버와의 연결이 없습니다.');
      return;
    }

    if (!device.hub_address) {
      alert('디바이스의 허브 정보를 찾을 수 없습니다.');
      return;
    }

    const requestId = `stop_${device.address}_${Date.now()}`;
    const measurementCommand = `stop:${device.address}`;

    console.log('[Dashboard] 📤 Sending stop measurement command:', {
      hubId: device.hub_address,
      deviceId: device.address,
      command: measurementCommand
    });

    // CSV 세션 종료
    try {
      const response = await fetch('http://localhost:5000/api/measurement/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          deviceAddress: device.address
        })
      });
      const result = await response.json();
      if (!result.success) {
        console.error('[Dashboard] Failed to stop CSV session:', result.message);
      }
    } catch (error) {
      console.error('[Dashboard] Error stopping CSV session:', error);
    }

    // Socket.IO로 제어 명령 전송
    emit('CONTROL_REQUEST', {
      hubId: device.hub_address,
      deviceId: device.address,
      command: {
        action: 'stop_measurement',
        raw_command: measurementCommand
      },
      requestId
    });

    // 측정 상태 즉시 업데이트 (응답 대기 전)
    setMeasurementStates(prev => ({
      ...prev,
      [device.address]: false
    }));
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 허브 목록 조회
      const hubs = await hubService.getHubs();

      // 디바이스 목록 조회
      const devices = await deviceService.getDevices();

      // Hub와 Device 체크
      if (hubs.length === 0) {
        // Hub가 없으면
        setConfirmModal({
          isOpen: true,
          title: "허브 등록 필요",
          message: "허브를 등록해주세요. 허브 관리 페이지로 이동하시겠습니까?",
          onConfirm: () => {
            setConfirmModal({
              isOpen: false,
              title: "",
              message: "",
              onConfirm: null,
            });
            navigate("/hardware");
          },
        });
        setLoading(false);
        return;
      }

      if (devices.length === 0) {
        // Hub는 있지만 Device가 없으면
        setConfirmModal({
          isOpen: true,
          title: "디바이스 등록 필요",
          message:
            "디바이스를 등록해주세요. 디바이스 관리 페이지로 이동하시겠습니까?",
          onConfirm: () => {
            setConfirmModal({
              isOpen: false,
              title: "",
              message: "",
              onConfirm: null,
            });
            navigate("/hardware");
          },
        });
        setLoading(false);
        return;
      }

      // 환자 목록 조회
      const pets = await petService.getPets();

      // 디바이스와 환자 연결
      const devicesWithPatients = devices
        .filter(
          (device) => device.status === "connected" && device.connectedPatient
        )
        .map((device) => {
          const patient = pets.find(
            (p) => p.id === device.connectedPatient?.id
          );
          return {
            id: device.id,
            address: device.address,
            name: device.name,
            hub_address: device.hub_address,
            hubName: device.hubName,
            status: device.status,
            connectedPatient: patient
              ? {
                  id: patient.id,
                  name: patient.name,
                  species: patient.species,
                  breed: patient.breed,
                  weight: patient.weight,
                  gender: patient.gender,
                  doctor: patient.veterinarian,
                  diagnosis: patient.diagnosis,
                }
              : null,
            currentData: {
              heartRate: 0,
              spo2: 0,
              temperature: 0,
              battery: 0,
            },
          };
        });

      setConnectedDevices(devicesWithPatients);

      // 디바이스 연결 상태 초기화 (모두 disconnected로 시작, 이후 CONNECTED_DEVICES 이벤트로 업데이트)
      const initialStatuses = {};
      devicesWithPatients.forEach(device => {
        initialStatuses[device.address] = 'disconnected';
      });
      setDeviceConnectionStatuses(initialStatuses);
    } catch (err) {
      console.error("Failed to load data:", err);
      setError(err.message || "데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleMonitor = (patientId) => {
    navigate(`/monitoring/${patientId}`);
  };

  const handleShowMore = (patientId) => {
    const device = connectedDevices.find(
      (d) => d.connectedPatient?.id === patientId
    );
    if (device && device.connectedPatient) {
      setSelectedPatient(device.connectedPatient);
    }
  };

  const handleCloseModal = () => {
    setSelectedPatient(null);
  };

  const handleConfirmModalClose = () => {
    setConfirmModal({ isOpen: false, title: "", message: "", onConfirm: null });
  };

  if (loading) {
    return (
      <div className="dashboard-page">
        <Header />
        <div className="dashboard-container">
          <div className="loading">데이터를 불러오는 중...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <Header />
        <div className="dashboard-container">
          <div className="error-message">{error}</div>
          <button onClick={loadData} className="btn-primary">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <Header />
      <HardwareAlertBar
        alerts={hardwareAlerts}
        onDismiss={handleDismissAlert}
      />
      <div className="dashboard-container">
        {/* 현황 섹션 */}
        <section className="monitoring-section">
          <h2>현황</h2>
          {connectedDevices.length > 0 ? (
            <div className="monitoring-grid">
              {connectedDevices.map((device) => {
                const patient = device.connectedPatient;
                return (
                  <div key={device.id} className="monitoring-card">
                    <div className="monitoring-header">
                      <div className="patient-info-left">
                        <div className="patient-name-row">
                          <h3>
                            환자명 : {patient?.name || "알 수 없음"}
                            {hardwareAlerts.some(
                              (alert) =>
                                alert.deviceId === device.id ||
                                alert.deviceAddress === device.address
                            ) && (
                              <span
                                className="device-warning-badge"
                                title="하드웨어 오류 감지됨"
                              >
                                ⚠️
                              </span>
                            )}
                          </h3>
                          {patient && (
                            <div className="patient-basic-info">
                              <span className="info-text">
                                {patient.weight}kg / {patient.gender}
                              </span>
                              <span className="info-text">
                                주치의: {patient.doctor}
                              </span>
                              <span className="info-text">
                                진단명: {patient.diagnosis}
                              </span>
                              <button
                                className="more-btn"
                                onClick={() => handleShowMore(patient.id)}
                              >
                                더보기
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="header-right">
                        <span className="device-name">{device.name}</span>
                        {(() => {
                          const normalizeMac = (mac) => mac.replace(/[:-]/g, '').toUpperCase();
                          const deviceMac = normalizeMac(device.address);
                          const isDeviceConnected = deviceConnectionStatuses[deviceMac] === 'connected' || 
                                                   deviceConnectionStatuses[device.address] === 'connected';
                          const isMeasuring = measurementStates[device.address] === true;

                          if (!isDeviceConnected) {
                            return (
                              <button
                                className="monitor-btn"
                                disabled
                                style={{ opacity: 0.5, cursor: 'not-allowed' }}
                                title="디바이스가 연결되어 있지 않습니다"
                              >
                                디바이스 미연결
                              </button>
                            );
                          }

                          return (
                            <>
                              {isMeasuring ? (
                                <button
                                  className="monitor-btn"
                                  onClick={() => handleStopMeasurement(device)}
                                  disabled={!isConnected}
                                >
                                  측정 정지
                                </button>
                              ) : (
                                <button
                                  className="monitor-btn"
                                  onClick={() => handleStartMeasurement(device)}
                                  disabled={!isConnected}
                                >
                                  측정 시작
                                </button>
                              )}
                              <button
                                className="monitor-btn"
                                onClick={() => handleMonitor(patient?.id)}
                                disabled={!isDeviceConnected}
                              >
                                모니터링하기
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="monitoring-data">
                      <div className="data-item">
                        <span className="data-label">심박수</span>
                        <span className="data-value">
                          {device.currentData.spo2} bpm
                        </span>
                      </div>
                      <div className="data-item">
                        <span className="data-label">산포도</span>
                        <span className="data-value">
                          {device.currentData.heartRate}%
                        </span>
                      </div>
                      <div className="data-item">
                        <span className="data-label">온도</span>
                        <span className="data-value">
                          {device.currentData.temperature}°C
                        </span>
                      </div>
                      <div className="data-item">
                        <span className="data-label">배터리</span>
                        <span className="data-value">
                          {device.currentData.battery}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="no-data">연결된 디바이스가 없습니다.</div>
          )}
        </section>
      </div>

      {/* 환자 상세 정보 모달 */}
      {selectedPatient && (
        <div className="modal-overlay">
          <div
            className="modal-content patient-detail-modal"
          >
            <div className="modal-header">
              <h3>환자 상세 정보</h3>
              <button onClick={handleCloseModal} className="close-btn">
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="patient-detail-grid">
                <div className="detail-item">
                  <span className="detail-label">이름:</span>
                  <span className="detail-value">{selectedPatient.name}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">종류:</span>
                  <span className="detail-value">
                    {selectedPatient.species} ({selectedPatient.breed})
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">체중:</span>
                  <span className="detail-value">
                    {selectedPatient.weight} kg
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">성별:</span>
                  <span className="detail-value">{selectedPatient.gender}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">담당주치의:</span>
                  <span className="detail-value">{selectedPatient.doctor}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">진단명:</span>
                  <span className="detail-value">
                    {selectedPatient.diagnosis}
                  </span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={handleCloseModal} className="btn-primary">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 확인 모달 */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onClose={handleConfirmModalClose}
        onConfirm={confirmModal.onConfirm}
      />
    </div>
  );
}

export default Dashboard;
