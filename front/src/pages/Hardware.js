import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import Header from "../components/Header";
import HardwareAlertBar from "../components/HardwareAlertBar";
import hubService from "../api/hubService";
import deviceService from "../api/deviceService";
import AlertModal from "../components/AlertModal";
import ConfirmModal from "../components/ConfirmModal";
import { useAuthStore } from "../stores/useAuthStore";
import { API_URL } from "../constants";
import { useSocket } from "../hooks/useSocket";
import axiosInstance from "../api/axios";
import { detectHardwareError } from "../utils/hardwareErrorDetector";
import "./Hardware.css";

function Hardware() {
  const [searchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const [hubs, setHubs] = useState([]);
  const [devices, setDevices] = useState([]);
  const [isConnectingAll, setIsConnectingAll] = useState(false);
  const [deviceConnectionStatuses, setDeviceConnectionStatuses] = useState({}); // 디바이스 연결 상태 { address: 'connected' | 'disconnected' }
  const [stats, setStats] = useState({
    totalHubs: 0,
    totalDevices: 0,
    connectedDevices: 0,
    availableDevices: 0,
  });
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: "",
    message: "",
  });
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
  });
  const [hubRegisterModal, setHubRegisterModal] = useState({ isOpen: false });
  const [availableDevices, setAvailableDevices] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [wifiId, setWifiId] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchStatus, setSearchStatus] = useState({ type: null, message: "" }); // 'success', 'error', 'info'
  const [currentPort, setCurrentPort] = useState(null); // USB 포트 저장
  const [receivedData, setReceivedData] = useState(""); // USB로 받은 원시 데이터
  const [isReading, setIsReading] = useState(false); // 데이터 읽기 중인지
  const readerRef = useRef(null); // reader 참조 저장
  const shouldContinueRef = useRef(false); // 읽기 계속할지 여부
  const writerRef = useRef(null); // writer 참조 저장
  const [registrationStep, setRegistrationStep] = useState(1); // 1: USB 연결, 2: WiFi 입력
  const [portInfo, setPortInfo] = useState(null); // 포트 정보
  const [filterBootLog, setFilterBootLog] = useState(true); // 부팅 로그 필터링
  const [isRegistered, setIsRegistered] = useState(false); // 등록 완료 여부
  const [detectedMacAddress, setDetectedMacAddress] = useState(null); // 감지된 MAC 주소
  const [hubStatuses, setHubStatuses] = useState({}); // 허브별 온라인 상태 { hubAddress: true/false }
  const [hubActivityProgress, setHubActivityProgress] = useState({}); // 허브별 활동 프로그레스 { hubAddress: { progress: 0-100, isActive: boolean } }

  // Socket.IO 연결
  const { isConnected, on, off, emit } = useSocket();

  // 디바이스 등록 모달 상태
  const [deviceRegisterModal, setDeviceRegisterModal] = useState({
    isOpen: false,
  });
  const [hubModeSwitched, setHubModeSwitched] = useState(false);
  const [scannedDevices, setScannedDevices] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [devicesToRegister, setDevicesToRegister] = useState({});
  const [selectedDevices, setSelectedDevices] = useState({}); // 선택된 디바이스 { deviceId: true/false }
  const [searchCommandReceived, setSearchCommandReceived] = useState(false); // 검색 명령 수신 확인
  const searchCommandTimeoutRef = useRef(null); // 검색 명령 타임아웃 참조
  const registrationProcessedRef = useRef(new Set()); // 이미 처리된 등록 완료 MAC 주소 추적
  const reconnectTimerRef = useRef(null); // USB 재연결 타이머 참조
  const wasConnectedRef = useRef(false); // 이전에 연결되었는지 추적
  const [hardwareAlerts, setHardwareAlerts] = useState([]);
  const [deviceCurrentData, setDeviceCurrentData] = useState({}); // 디바이스별 현재 데이터 저장
  const [isErrorSimulationActive, setIsErrorSimulationActive] = useState(false);
  const [simulatedErrors, setSimulatedErrors] = useState({}); // { deviceId: { code, type, message } }
  const simulationIntervalRef = useRef(null);
  const errorDurationRefs = useRef({}); // { deviceId: timeoutRef }

  // 데이터 로드
  useEffect(() => {
    loadData();
  }, []);

  // 페이지 접속 시 한 번만 허브 상태 체크
  const hasCheckedRef = useRef(false);
  const hubTimeoutRefs = useRef({}); // 허브별 타임아웃 참조

  useEffect(() => {
    // 이미 체크했거나 연결되지 않았거나 허브가 없으면 리턴
    if (hasCheckedRef.current || !isConnected || hubs.length === 0) return;

    // 모든 허브에 대해 상태 체크 (한 번만 실행)
    hubs.forEach((hub) => {
      const hubAddress = hub.address;
      const requestId = `state_check_${hubAddress}_${Date.now()}`;

      // 기존 타임아웃 정리
      if (hubTimeoutRefs.current[hubAddress]) {
        clearTimeout(hubTimeoutRefs.current[hubAddress]);
      }

      // 20초 타임아웃 설정
      hubTimeoutRefs.current[hubAddress] = setTimeout(() => {
        // 응답이 없으면 허브를 오프라인으로 표시
        setHubStatuses((prev) => ({
          ...prev,
          [hubAddress]: false,
        }));
        console.log(`[Hardware] Hub ${hubAddress} timeout - no response`);
      }, 20000);

      emit("CONTROL_REQUEST", {
        hubId: hubAddress,
        deviceId: "HUB",
        command: {
          raw_command: "state:hub",
        },
        requestId,
      });
    });

    // 체크 완료 플래그 설정
    hasCheckedRef.current = true;
  }, [isConnected, hubs, emit]);

  // 페이지를 떠날 때 플래그 리셋
  useEffect(() => {
    return () => {
      hasCheckedRef.current = false;
      // 타임아웃 정리
      Object.values(hubTimeoutRefs.current).forEach((timeout) =>
        clearTimeout(timeout)
      );
      hubTimeoutRefs.current = {};
    };
  }, []);

  // MQTT는 백엔드에서만 사용하므로 프론트엔드에서 직접 연결하지 않음
  // Socket.IO를 통해 백엔드와 통신

  // Socket.IO를 통한 허브 상태 실시간 업데이트
  useEffect(() => {
    if (!isConnected) return;

    const timeoutRefs = {}; // 각 허브별 타임아웃 참조
    const progressIntervals = {}; // 각 허브별 프로그레스 인터벌 참조

    // 허브 활동 이벤트 수신 (허브가 /check/hub를 호출할 때)
    const handleHubActivity = (data) => {
      // 디바이스 등록 모달이 열려있으면 상태 업데이트만 하고 프로그레스바는 시작하지 않음
      if (deviceRegisterModal.isOpen) {
        if (data.hubAddress) {
          const hubAddress = data.hubAddress;
          setHubStatuses((prev) => ({
            ...prev,
            [hubAddress]: true,
          }));
        }
        return;
      }

      // 허브 등록 모달이 열려있고 등록 완료가 아직 안 된 경우,
      // 허브가 MQTT에 정상 등록되었다고 판단하고 디바이스 등록 모달을 자동으로 연다.
      if (hubRegisterModal.isOpen && !isRegistered && data.hubAddress) {
        const hubAddress = data.hubAddress;
        // 감지된 허브 MAC 주소 저장 (디바이스 등록 시 사용)
        setDetectedMacAddress(hubAddress);

        // 잠시 후 목록 새로고침 (허브가 등록되었을 수 있음)
        setTimeout(() => {
          loadData().catch((err) => {
            console.error("[Hub Activity] 새로고침 오류:", err);
          });
        }, 1000);

        // 허브 등록 모달 닫고 디바이스 등록 모달 열기
        setTimeout(() => {
          setHubRegisterModal({ isOpen: false });
          setIsRegistered(true);
          handleOpenDeviceRegister();
        }, 1500);
      }

      if (data.hubAddress) {
        const hubAddress = data.hubAddress;

        // 허브를 온라인으로 표시
        setHubStatuses((prev) => ({
          ...prev,
          [hubAddress]: true,
        }));

        // 프로그레스바 시작 (0%에서 100%로 진행)
        setHubActivityProgress((prev) => ({
          ...prev,
          [hubAddress]: { progress: 0, isActive: true },
        }));

        // 프로그레스바 애니메이션 (3초 동안 0% -> 100%)
        let progress = 0;
        const interval = setInterval(() => {
          progress += 2;
          if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            delete progressIntervals[hubAddress];

            // 프로그레스 완료 후 유지
            setTimeout(() => {
              setHubActivityProgress((prev) => ({
                ...prev,
                [hubAddress]: { progress: 100, isActive: false },
              }));
            }, 500);
          } else {
            setHubActivityProgress((prev) => ({
              ...prev,
              [hubAddress]: { progress, isActive: true },
            }));
          }
        }, 60); // 60ms마다 2%씩 증가 (총 3초)

        progressIntervals[hubAddress] = interval;

        // 기존 타임아웃 취소
        if (timeoutRefs[hubAddress]) {
          clearTimeout(timeoutRefs[hubAddress]);
        }

        // 60초 후 자동으로 오프라인으로 변경 (활동이 없으면)
        timeoutRefs[hubAddress] = setTimeout(() => {
          setHubStatuses((prev) => ({
            ...prev,
            [hubAddress]: false,
          }));
          setHubActivityProgress((prev) => ({
            ...prev,
            [hubAddress]: { progress: 0, isActive: false },
          }));
          delete timeoutRefs[hubAddress];
        }, 60000); // 60초
      }
    };

    // Telemetry 데이터 수신 시 허브/디바이스 상태 업데이트
    const handleTelemetry = (data) => {
      // 디바이스 등록 모달이 열려있으면 상태 업데이트만
      if (deviceRegisterModal.isOpen) {
        if (data.hubId) {
          const hubId = data.hubId;
          setHubStatuses((prev) => ({
            ...prev,
            [hubId]: true,
          }));
        }
        return;
      }

      if (data.hubId) {
        const hubId = data.hubId;

        // 기존 타임아웃 취소
        if (timeoutRefs[hubId]) {
          clearTimeout(timeoutRefs[hubId]);
        }

        // 허브를 온라인으로 표시
        setHubStatuses((prev) => ({
          ...prev,
          [hubId]: true,
        }));

        // 60초 후 자동으로 오프라인으로 변경 (데이터가 없으면)
        timeoutRefs[hubId] = setTimeout(() => {
          setHubStatuses((prev) => ({
            ...prev,
            [hubId]: false,
          }));
          delete timeoutRefs[hubId];
        }, 60000); // 60초
      }

      // 하드웨어 오류 감지
      if (data.type === "sensor_data" && data.deviceId) {
        // 텔레메트리가 오면 해당 디바이스를 연결됨으로 표시
        setDeviceConnectionStatuses((prev) => {
          const normalizeMac = (mac) => mac.replace(/[:-]/g, "").toUpperCase();
          const deviceId = data.deviceId;
          const normalized = normalizeMac(deviceId);
          return {
            ...prev,
            [deviceId]: "connected",
            [normalized]: "connected",
          };
        });

        const latest =
          data.data?.dataArr?.[data.data.dataArr.length - 1] || data.data;
        const heartRate = latest?.hr || latest?.heartRate || 0;

        // 디바이스 현재 데이터 업데이트
        setDeviceCurrentData((prev) => ({
          ...prev,
          [data.deviceId]: {
            heartRate,
            spo2: latest?.spo2 || 0,
            temperature: latest?.temp || 0,
            battery: latest?.battery || 0,
          },
        }));

        // 시뮬레이션된 오류가 있으면 그것을 우선 사용, 없으면 실제 데이터에서 감지
        const simulatedError = simulatedErrors[data.deviceId];
        const error = simulatedError || detectHardwareError(heartRate);
        if (error) {
          const device = devices.find((d) => d.address === data.deviceId);
          setHardwareAlerts((prev) => {
            const existingIndex = prev.findIndex(
              (alert) =>
                alert.deviceId === data.deviceId && alert.code === error.code
            );
            if (existingIndex >= 0) {
              // 기존 알림 업데이트
              const updated = [...prev];
              updated[existingIndex] = {
                id: `alert-${data.deviceId}-${error.code}`,
                deviceId: data.deviceId,
                deviceName: device?.name || data.deviceId,
                deviceAddress: data.deviceId,
                ...error,
                timestamp: Date.now(),
              };
              return updated;
            } else {
              // 새 알림 추가
              return [
                ...prev,
                {
                  id: `alert-${data.deviceId}-${error.code}`,
                  deviceId: data.deviceId,
                  deviceName: device?.name || data.deviceId,
                  deviceAddress: data.deviceId,
                  ...error,
                  timestamp: Date.now(),
                },
              ];
            }
          });
        } else {
          // 오류가 없으면 해당 디바이스의 알림 제거
          setHardwareAlerts((prev) =>
            prev.filter((alert) => alert.deviceId !== data.deviceId)
          );
        }
      }
    };

    // CONTROL_RESULT 수신 (명령 실행 결과 - blink, state:hub 등)
    const handleControlResult = async (data) => {
      const isStateCheck = data.requestId?.startsWith("state_check_");

      // state:hub 에 대한 CONTROL_RESULT 는 허브에 명령이 전달되었다는 ACK 이므로
      // 타임아웃만 해제하고 별도 로그는 남기지 않음
      if (isStateCheck && data.hubId) {
        const hubAddress = data.hubId;
        if (hubTimeoutRefs.current[hubAddress]) {
          clearTimeout(hubTimeoutRefs.current[hubAddress]);
          delete hubTimeoutRefs.current[hubAddress];
        }
        // 허브를 온라인으로 표시
        setHubStatuses((prev) => ({
          ...prev,
          [hubAddress]: true,
        }));
        return;
      }

      console.log("[Hardware] Received CONTROL_RESULT:", data);

      // 허브가 응답을 보냈으면 온라인으로 표시
      if (data.hubId) {
        setHubStatuses((prev) => ({
          ...prev,
          [data.hubId]: true,
        }));
      }

      if (!data.success) {
        return;
      }

      // 현재는 blink 등의 단순 명령에 대해서만 성공 여부 확인용으로 사용
      // connect_devices 결과는 CONNECTED_DEVICES 이벤트에서 처리
      // state:hub 결과는 CONNECTED_DEVICES 이벤트에서 처리
    };

    // 허브에서 MQTT send 토픽으로 전달하는 연결된 디바이스 목록 처리
    const handleConnectedDevices = async (payload) => {
      console.log("[Hardware] Received CONNECTED_DEVICES:", payload);

      const hubAddress = payload.hubAddress;
      const connectedDevices = payload.connected_devices;

      if (hubAddress) {
        // 허브가 응답했으므로 온라인으로 표시
        setHubStatuses((prev) => ({
          ...prev,
          [hubAddress]: true,
        }));

        // 타임아웃 정리
        if (hubTimeoutRefs.current[hubAddress]) {
          clearTimeout(hubTimeoutRefs.current[hubAddress]);
          delete hubTimeoutRefs.current[hubAddress];
        }
      }

      // 연결된 디바이스 상태 업데이트
      if (Array.isArray(connectedDevices) && connectedDevices.length > 0) {
        const normalizeMac = (mac) => mac.replace(/[:-]/g, "").toUpperCase();
        const connectedMacSet = new Set(
          connectedDevices.map((mac) => normalizeMac(mac))
        );

        // 모든 디바이스 상태 업데이트
        setDeviceConnectionStatuses((prev) => {
          const newStatuses = { ...prev };
          devices.forEach((device) => {
            const deviceMac = normalizeMac(device.address);
            // 정규화된 MAC과 원본 MAC 모두 확인
            const isConnected =
              connectedMacSet.has(deviceMac) ||
              connectedMacSet.has(normalizeMac(device.address));
            newStatuses[device.address] = isConnected
              ? "connected"
              : "disconnected";
            // 정규화된 MAC도 저장
            newStatuses[deviceMac] = isConnected ? "connected" : "disconnected";
          });
          return newStatuses;
        });
      }

      if (!Array.isArray(connectedDevices) || connectedDevices.length === 0) {
        // 디바이스 전체 연결 중이면 성공 메시지 표시
        if (isConnectingAll) {
          setAlertModal({
            isOpen: true,
            title: "연결 완료",
            message: "정상적으로 연결되었습니다.",
          });
          setIsConnectingAll(false);
        }
        // 연결된 디바이스가 없으면 모든 디바이스를 disconnected로 표시
        setDeviceConnectionStatuses((prev) => {
          const newStatuses = { ...prev };
          devices.forEach((device) => {
            newStatuses[device.address] = "disconnected";
          });
          return newStatuses;
        });
        return;
      }

      // 디바이스 전체 연결 모드인 경우
      if (isConnectingAll) {
        try {
          const existingDevices = await deviceService.getDevices();
          const normalizeMac = (mac) => mac.replace(/[:-]/g, "").toUpperCase();

          // 연결된 디바이스 MAC 주소 정규화
          const connectedMacSet = new Set(
            connectedDevices.map((mac) => normalizeMac(mac))
          );

          // 각 디바이스의 상태 업데이트
          for (const device of existingDevices) {
            const deviceMac = normalizeMac(device.address);
            const newStatus = connectedMacSet.has(deviceMac)
              ? "connected"
              : "disconnected";

            if (device.status !== newStatus) {
              await deviceService.updateDevice(device.address, {
                status: newStatus,
              });
              console.log(
                `[Device Connect All] ${device.address} 상태 업데이트: ${device.status} -> ${newStatus}`
              );
            }
          }

          // 디바이스 목록 새로고침
          await loadData();

          // loadData() 완료 후 deviceConnectionStatuses 다시 업데이트 (loadData가 상태를 초기화할 수 있으므로)
          const updatedDevices = await deviceService.getDevices();
          const newConnectionStatuses = {};
          updatedDevices.forEach((device) => {
            const deviceMac = normalizeMac(device.address);
            const isConnected = connectedMacSet.has(deviceMac);
            newConnectionStatuses[device.address] = isConnected
              ? "connected"
              : "disconnected";
            // 정규화된 MAC도 저장
            newConnectionStatuses[deviceMac] = isConnected
              ? "connected"
              : "disconnected";
          });
          setDeviceConnectionStatuses((prev) => ({
            ...prev,
            ...newConnectionStatuses,
          }));

          setAlertModal({
            isOpen: true,
            title: "연결 완료",
            message: "정상적으로 연결되었습니다.",
          });
        } catch (error) {
          console.error("[Device Connect All] 상태 업데이트 오류:", error);
          setAlertModal({
            isOpen: true,
            title: "오류",
            message: "디바이스 상태 업데이트에 실패했습니다.",
          });
        }

        setIsConnectingAll(false);
        return;
      }

      // 디바이스 등록 스캔이 아닐 때는 여기서 종료 (페이지 초기 state:hub, connect_all 등)
      if (!isScanning) {
        return;
      }

      // 기존 디바이스 등록 모달 로직 (디바이스 검색 후에만)
      if (!deviceRegisterModal.isOpen) {
        handleOpenDeviceRegister();
      }

      try {
        const existingDevices = await deviceService.getDevices();
        console.log(
          "[Device Register] DB에서 가져온 디바이스:",
          existingDevices
        );

        // MAC 주소를 정규화하여 매핑 (대소문자 무시, 구분자 통일)
        const normalizeMac = (mac) => mac.replace(/[:-]/g, "").toUpperCase();
        const nameMap = new Map(
          existingDevices.map((d) => [normalizeMac(d.address), d.name])
        );

        const devices = connectedDevices.map((mac, index) => {
          const normalizedMac = normalizeMac(mac);
          const dbName = nameMap.get(normalizedMac);
          const deviceName = dbName || "tailing";

          console.log(
            `[Device Register] MAC: ${mac}, 정규화: ${normalizedMac}, DB 이름: ${
              dbName || "없음"
            }, 최종 이름: ${deviceName}`
          );

          return {
            id: `${mac}-${index}`,
            macAddress: mac,
            name: deviceName,
          };
        });

        setScannedDevices(devices);
        setIsScanning(false);
        setSearchCommandReceived(true);

        // 타임아웃 정리
        if (searchCommandTimeoutRef.current) {
          clearTimeout(searchCommandTimeoutRef.current);
          searchCommandTimeoutRef.current = null;
        }
      } catch (error) {
        console.error("[Hardware] CONNECTED_DEVICES 처리 중 오류:", error);
        setIsScanning(false);
      }
    };

    // 허브 상태 메시지 수신
    const handleHubStatus = (data) => {
      if (data.type === "hub_status" && data.hubId) {
        const hubId = data.hubId;

        // 기존 타임아웃 취소
        if (timeoutRefs[hubId]) {
          clearTimeout(timeoutRefs[hubId]);
        }

        // 허브를 온라인으로 표시
        setHubStatuses((prev) => ({
          ...prev,
          [hubId]: true,
        }));

        // 60초 후 자동으로 오프라인으로 변경
        timeoutRefs[hubId] = setTimeout(() => {
          setHubStatuses((prev) => ({
            ...prev,
            [hubId]: false,
          }));
          delete timeoutRefs[hubId];
        }, 60000);
      }
    };

    on("HUB_ACTIVITY", handleHubActivity);
    on("TELEMETRY", handleTelemetry);
    on("CONTROL_RESULT", handleControlResult);
    on("CONNECTED_DEVICES", handleConnectedDevices);

    return () => {
      off("HUB_ACTIVITY", handleHubActivity);
      off("TELEMETRY", handleTelemetry);
      off("CONTROL_RESULT", handleControlResult);
      off("CONNECTED_DEVICES", handleConnectedDevices);
      // 모든 타임아웃 및 인터벌 정리
      Object.values(timeoutRefs).forEach((timeout) => clearTimeout(timeout));
      Object.values(progressIntervals).forEach((interval) =>
        clearInterval(interval)
      );
    };
  }, [
    isConnected,
    on,
    off,
    deviceRegisterModal.isOpen,
    devices,
    simulatedErrors,
    isConnectingAll,
  ]);

  const loadData = async (skipLoading = false) => {
    // 디바이스 등록 모달이 열려있으면 로딩 상태 변경하지 않음
    if (deviceRegisterModal.isOpen && skipLoading) {
      return;
    }

    try {
      if (!skipLoading) {
        setLoading(true);
      }
      const [hubsData, devicesData] = await Promise.all([
        hubService.getHubs(),
        deviceService.getDevices(),
      ]);

      setHubs(hubsData);
      setDevices(devicesData);

      // 허브 온라인 상태 초기화 (updatedAt 기준으로 최근 60초 이내면 온라인)
      const now = Date.now();
      const hubStatusMap = {};
      hubsData.forEach((hub) => {
        const lastSeen = hub.updatedAt ? new Date(hub.updatedAt).getTime() : 0;
        const timeSinceLastSeen = now - lastSeen;
        // 최근 60초 이내에 활동이 있으면 온라인
        hubStatusMap[hub.address] = timeSinceLastSeen < 60000;
      });
      setHubStatuses(hubStatusMap);

      // 디바이스 연결 상태 초기화 (updatedAt 기준으로 최근 60초 이내면 연결됨)
      const deviceStatusMap = {};
      devicesData.forEach((device) => {
        const lastSeen = device.updatedAt
          ? new Date(device.updatedAt).getTime()
          : 0;
        const timeSinceLastSeen = now - lastSeen;
        // 최근 60초 이내에 활동이 있으면 연결됨
        deviceStatusMap[device.address] =
          timeSinceLastSeen < 60000 ? "connected" : "disconnected";
      });
      setDeviceConnectionStatuses(deviceStatusMap);

      // 통계 계산
      setStats({
        totalHubs: hubsData.length,
        totalDevices: devicesData.length,
        connectedDevices: devicesData.filter((d) => {
          const lastSeen = d.updatedAt ? new Date(d.updatedAt).getTime() : 0;
          return now - lastSeen < 60000;
        }).length,
        availableDevices: devicesData.filter((d) => {
          const lastSeen = d.updatedAt ? new Date(d.updatedAt).getTime() : 0;
          return now - lastSeen < 60000 && !d.connectedPatient;
        }).length,
      });
    } catch (error) {
      console.error("Failed to load data:", error);
      // 디바이스 등록 모달이 열려있으면 에러 모달 표시하지 않음
      if (!deviceRegisterModal.isOpen) {
        setAlertModal({
          isOpen: true,
          title: "오류",
          message: "데이터를 불러오는데 실패했습니다.",
        });
      }
    } finally {
      if (!skipLoading) {
        setLoading(false);
      }
    }
  };

  // 허브 관리
  const handleHubDelete = async (hubAddress) => {
    setConfirmModal({
      isOpen: true,
      title: "허브 삭제",
      message: "정말 이 허브를 삭제하시겠습니까?",
      onConfirm: async () => {
        try {
          await hubService.deleteHub(hubAddress);
          setAlertModal({
            isOpen: true,
            title: "삭제 완료",
            message: "허브가 삭제되었습니다.",
          });
          loadData();
        } catch (error) {
          setAlertModal({
            isOpen: true,
            title: "오류",
            message: error.message || "허브 삭제에 실패했습니다.",
          });
        }
      },
    });
  };

  const handleHubWifiConfig = (hubAddress) => {
    setAlertModal({
      isOpen: true,
      title: "WiFi 설정",
      message: "USB 연결을 통해 WiFi 설정을 진행하세요.",
    });
  };

  const handleHubNameChange = async (hubAddress, newName) => {
    try {
      await hubService.updateHub(hubAddress, { name: newName });
      setAlertModal({
        isOpen: true,
        title: "수정 완료",
        message: "허브 이름이 변경되었습니다.",
      });
      loadData();
    } catch (error) {
      setAlertModal({
        isOpen: true,
        title: "오류",
        message: error.message || "이름 변경에 실패했습니다.",
      });
    }
  };

  // 디바이스 관리
  const handleDevicePatientChange = (deviceId) => {
    setAlertModal({
      isOpen: true,
      title: "환자 연결",
      message: "환자 연결은 환자 관리 페이지에서 진행하세요.",
    });
  };

  const handleDeviceNameChange = async (deviceAddress, newName) => {
    try {
      await deviceService.updateDevice(deviceAddress, { name: newName });
      setAlertModal({
        isOpen: true,
        title: "수정 완료",
        message: "디바이스 이름이 변경되었습니다.",
      });
      loadData();
    } catch (error) {
      setAlertModal({
        isOpen: true,
        title: "오류",
        message: error.message || "이름 변경에 실패했습니다.",
      });
    }
  };

  // ANSI 이스케이프 코드 제거 함수
  const removeAnsiCodes = (text) => {
    return text
      .replace(/\x1b\[[0-9;]*m/g, "")
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
  };

  // 부팅 로그인지 확인하는 함수
  const isBootLog = (line) => {
    const cleanLine = removeAnsiCodes(line);

    const bootLogPatterns = [
      /^ets /,
      /^rst /,
      /^Guru Meditation/,
      /^Brownout/,
      /^I \(/,
      /^W \(/,
      /^E \(/,
      /^D \(/,
      /^V \(/,
      /^\[0;32mI \(/,
      /^\[0;33mW \(/,
      /^\[0;31mE \(/,
      /esp_image:/,
      /segment \d+:/,
      /paddr=/,
      /vaddr=/,
      /^GDB/,
      /^ELF file/,
      /^Free heap/,
      /^Heap/,
      /^Stack/,
      /^Core /,
      /^CPU/,
      /^Flash/,
      /^MAC/,
      /^WiFi/,
      /^mode:/,
      /^phy:/,
      /^freq/,
    ];

    return bootLogPatterns.some((pattern) => pattern.test(cleanLine));
  };

  // 허브 등록 모달
  const handleOpenHubRegister = async () => {
    setHubRegisterModal({ isOpen: true });
    setAvailableDevices([]);
    setSelectedDevice(null);
    setWifiId("");
    setWifiPassword("");
    setIsSearching(false);
    setSearchStatus({ type: null, message: "" });
    setReceivedData("");
    setRegistrationStep(1);
    setPortInfo(null);
    setIsRegistered(false);
    setDetectedMacAddress(null);
    // 등록 완료 처리 추적 초기화 (새로운 등록 시도)
    registrationProcessedRef.current.clear();

    // 모달이 열릴 때 자동으로 이전에 권한이 부여된 USB 포트 연결 시도
    if (navigator.serial) {
      try {
        const port = await tryAutoConnect();
        if (port) {
          // 자동 연결 성공 시 연결 처리
          await connectToPort(port, true); // true = 자동 연결
        }
      } catch (error) {
        // 자동 연결 실패는 무시 (사용자가 수동으로 연결할 수 있음)
        console.log("[Auto Connect] Failed to auto-connect:", error);
      }
    }
  };

  const handleCloseHubRegister = async (keepUsbConnection = false) => {
    // 재연결 타이머 정리
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    // USB 연결을 유지하지 않는 경우에만 연결 해제
    if (!keepUsbConnection) {
      // 데이터 읽기 중지
      shouldContinueRef.current = false;
      setIsReading(false);
      wasConnectedRef.current = false; // 연결 해제 표시

      if (readerRef.current) {
        try {
          await readerRef.current.cancel();
          await readerRef.current.releaseLock();
        } catch (error) {
          console.error("[USB] Error stopping reader:", error);
        }
        readerRef.current = null;
      }

      // Writer 해제
      if (writerRef.current) {
        try {
          await writerRef.current.releaseLock();
        } catch (error) {
          console.error("[USB] Error releasing writer:", error);
        }
        writerRef.current = null;
      }

      // USB 포트가 열려있으면 닫기
      if (currentPort) {
        try {
          await currentPort.close();
        } catch (error) {
          console.error("포트 닫기 오류:", error);
        }
        setCurrentPort(null);
      }
    }

    setHubRegisterModal({ isOpen: false });
    setAvailableDevices([]);
    setSelectedDevice(null);
    setWifiId("");
    setWifiPassword("");
    setIsSearching(false);
    setSearchStatus({ type: null, message: "" });
    setReceivedData("");
    setRegistrationStep(1);
    setPortInfo(null);
    setIsRegistered(false);

    // USB 연결을 유지하는 경우 detectedMacAddress는 유지
    if (!keepUsbConnection) {
      setDetectedMacAddress(null);
    }
  };

  // 이전에 권한이 부여된 포트 자동 연결 시도
  const tryAutoConnect = async () => {
    if (!navigator.serial) return null;

    try {
      // 이전에 권한이 부여된 포트들 가져오기
      const ports = await navigator.serial.getPorts();

      if (ports.length === 0) {
        return null;
      }

      // 첫 번째 포트를 자동으로 선택 (일반적으로 가장 최근에 연결한 포트)
      const port = ports[0];

      // 포트 정보 확인
      const portInfoData = port.getInfo?.();
      if (portInfoData) {
        // USB 포트인지 확인
        if (
          portInfoData.usbVendorId !== undefined &&
          portInfoData.usbProductId !== undefined
        ) {
          return port;
        }
      }

      return null;
    } catch (error) {
      console.error("[Auto Connect] Error:", error);
      return null;
    }
  };

  // USB 자동 재연결 처리
  const handleAutoReconnect = async () => {
    // 이미 재연결 시도 중이면 중복 실행 방지
    if (reconnectTimerRef.current) {
      return;
    }

    // 기존 타이머 정리
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }

    // 2초 후 재연결 시도
    reconnectTimerRef.current = setTimeout(async () => {
      reconnectTimerRef.current = null;

      if (!navigator.serial) {
        return;
      }

      try {
        // 이전에 권한이 부여된 포트 확인
        const port = await tryAutoConnect();
        if (port) {
          appendLog("✅ USB 포트 재연결 성공!");
          await connectToPort(port, true);
          wasConnectedRef.current = true;

          // 허브 등록 모달이 닫혀있으면 자동으로 열기
          if (!hubRegisterModal.isOpen) {
            handleOpenHubRegister();
          }
        } else {
          appendLog("⚠ USB 포트를 찾을 수 없습니다. 수동으로 연결해주세요.");
          wasConnectedRef.current = false;
        }
      } catch (error) {
        console.error("[Auto Reconnect] Error:", error);
        appendLog("❌ USB 자동 재연결 실패: " + error.message);
        wasConnectedRef.current = false;
      }
    }, 2000);
  };

  // 포트 연결 공통 함수
  const connectToPort = async (port, isAutoConnect = false) => {
    setIsSearching(true);
    if (!isAutoConnect) {
      setSearchStatus({ type: "info", message: "USB 허브 연결 중..." });
    } else {
      setSearchStatus({ type: "info", message: "USB 자동 연결 중..." });
    }

    try {
      // 포트 정보 확인
      const portInfoData = port.getInfo?.();
      if (portInfoData) {
        setPortInfo(portInfoData);
        const portInfoStr = JSON.stringify(portInfoData);
        appendLog(`선택한 포트 정보: ${portInfoStr}`);

        // 블루투스 포트 감지 시 경고
        if (
          portInfoData.usbVendorId === undefined &&
          portInfoData.usbProductId === undefined
        ) {
          appendLog(
            "⚠ 경고: USB 포트가 아닐 수 있습니다. 블루투스 포트는 작동하지 않습니다."
          );
          appendLog(
            "⚠ 블루투스 포트를 선택하셨다면, USB 포트를 다시 선택해주세요."
          );
        } else {
          appendLog(
            `✓ USB 포트 확인됨 (Vendor: 0x${portInfoData.usbVendorId?.toString(
              16
            )}, Product: 0x${portInfoData.usbProductId?.toString(16)})`
          );
        }
      }

      // 포트 열기
      await port.open({ baudRate: 115200 });

      setCurrentPort(port);
      wasConnectedRef.current = true; // 연결 성공 표시

      // writer 생성 및 저장
      writerRef.current = port.writable.getWriter();

      appendLog("✓ USB 연결 성공! (BaudRate: 115200)");
      appendLog("📤 데이터 전송 준비 완료");
      setSearchStatus({
        type: "success",
        message: isAutoConnect
          ? "USB 자동 연결 완료! 이제 WiFi 정보를 입력하세요."
          : "USB 연결 완료! 이제 WiFi 정보를 입력하세요.",
      });
      setRegistrationStep(2); // 2단계로 이동

      // 데이터 읽기 시작
      readLoop(port);
    } catch (error) {
      console.error("USB 연결 오류:", error);
      setIsReading(false);
      wasConnectedRef.current = false;

      if (error.name === "InvalidStateError") {
        setSearchStatus({
          type: "error",
          message: "포트가 이미 열려있거나 사용 중입니다.",
        });
      } else {
        setSearchStatus({
          type: "error",
          message: `USB 허브 연결 중 오류가 발생했습니다: ${error.message}`,
        });
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchDevices = async () => {
    setIsSearching(true);
    setSearchStatus({ type: "info", message: "USB 포트를 찾는 중..." });

    try {
      // Web Serial API를 사용하여 USB 시리얼 포트 검색
      if (!navigator.serial) {
        setSearchStatus({
          type: "error",
          message:
            "이 브라우저는 USB 시리얼 포트 접근을 지원하지 않습니다. Chrome, Edge, Opera 등의 최신 브라우저를 사용해주세요.",
        });
        setIsSearching(false);
        return;
      }

      // 먼저 자동 연결 시도
      let port = await tryAutoConnect();

      // 자동 연결 실패 시 사용자에게 포트 선택 요청
      if (!port) {
        setSearchStatus({
          type: "info",
          message: "USB 포트를 선택해주세요...",
        });
        port = await navigator.serial.requestPort();
      }

      // 포트 연결 처리
      const wasAutoConnected = port && (await tryAutoConnect()) === port;
      await connectToPort(port, wasAutoConnected);
    } catch (error) {
      console.error("USB 검색 오류:", error);
      setIsReading(false);

      if (error.name === "NotFoundError") {
        setSearchStatus({
          type: "error",
          message: "USB 포트 선택이 취소되었습니다.",
        });
      } else if (error.name === "SecurityError") {
        setSearchStatus({
          type: "error",
          message:
            "USB 시리얼 포트 접근 권한이 필요합니다. 브라우저 설정에서 권한을 확인해주세요.",
        });
      } else if (
        error.message?.includes("blocklist") ||
        error.message?.includes("blocked")
      ) {
        setSearchStatus({
          type: "error",
          message:
            "선택한 포트가 차단되었습니다. 블루투스 포트가 아닌 USB 포트를 선택해주세요.",
        });
      } else if (error.name === "InvalidStateError") {
        setSearchStatus({
          type: "error",
          message: "포트가 이미 열려있거나 사용 중입니다.",
        });
      } else {
        setSearchStatus({
          type: "error",
          message: `USB 허브 연결 중 오류가 발생했습니다: ${error.message}`,
        });
      }
    } finally {
      setIsSearching(false);
    }
  };

  // USB 읽기 루프
  const readLoop = async (selectedPort) => {
    const textDecoder = new TextDecoder();
    const reader = selectedPort.readable.getReader();
    let buffer = ""; // 수신 데이터 버퍼

    appendLog("📡 데이터 수신 대기 중...");
    setIsReading(true);
    shouldContinueRef.current = true;

    while (shouldContinueRef.current) {
      try {
        const { value, done } = await reader.read();
        if (done) {
          // 버퍼에 남은 데이터가 있으면 출력
          if (buffer.trim()) {
            const cleanedBuffer = removeAnsiCodes(buffer.trim());
            if (
              cleanedBuffer &&
              (!filterBootLog || !isBootLog(cleanedBuffer))
            ) {
              appendLog("ESP → " + cleanedBuffer);
              checkForRegistrationComplete(cleanedBuffer);
            }
          }
          appendLog("❌ 포트 연결 종료됨.");
          reader.releaseLock();

          // USB가 연결되어 있었다가 끊어진 경우 재연결 시도
          if (wasConnectedRef.current) {
            appendLog("🔄 USB 재연결 시도 중...");
            handleAutoReconnect();
          }

          break;
        }
        if (value) {
          const decoded = textDecoder.decode(value, { stream: true });
          buffer += decoded; // 버퍼에 추가

          // 줄바꿈 문자를 기준으로 완전한 메시지 분리
          const lines = buffer.split("\n");
          // 마지막 줄은 아직 완성되지 않았을 수 있으므로 버퍼에 유지
          buffer = lines.pop() || "";

          // 완성된 메시지들 출력
          lines.forEach((line) => {
            let trimmedLine = line.trim();
            if (!trimmedLine) return;

            // ANSI 코드 제거
            trimmedLine = removeAnsiCodes(trimmedLine);

            // "usb connected" 메시지 필터링
            if (trimmedLine.toLowerCase().includes("usb connected")) {
              return;
            }

            // 부팅 로그 필터링
            if (filterBootLog) {
              const bootLogMatch = trimmedLine.match(
                /(esp_image:|segment \d+:|paddr=|vaddr=|I \(\d+\)|W \(\d+\)|E \(\d+\))/
              );
              if (bootLogMatch) {
                const dataPatterns = [/wifi:/, /account:/, /[a-zA-Z0-9_]+:/];
                for (const pattern of dataPatterns) {
                  const match = trimmedLine.match(pattern);
                  if (match && match.index !== undefined) {
                    trimmedLine = trimmedLine.substring(match.index);
                    break;
                  }
                }
                if (
                  isBootLog(trimmedLine) &&
                  !dataPatterns.some((p) => p.test(trimmedLine))
                ) {
                  return;
                }
              } else if (isBootLog(trimmedLine)) {
                return;
              }
            }

            // MAC 주소 감지 (ESP32 로그에서 MAC 주소 추출) - 한 번만 처리
            const macMatch = trimmedLine.match(
              /([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/i
            );
            if (macMatch) {
              const macAddress = macMatch[0];

              // MAC 주소가 처음 감지되었을 때만 처리
              if (!detectedMacAddress || detectedMacAddress !== macAddress) {
                setDetectedMacAddress(macAddress);

                // 허브를 온라인으로 표시
                setHubStatuses((prev) => ({
                  ...prev,
                  [macAddress]: true,
                }));
              }

              // 임시로 저장된 WiFi 정보가 있으면 MAC 주소로 이동 (한 번만)
              const tempWifiInfo = localStorage.getItem("hub_wifi_temp");
              if (
                tempWifiInfo &&
                (!detectedMacAddress || detectedMacAddress !== macAddress)
              ) {
                try {
                  const wifiInfo = JSON.parse(tempWifiInfo);
                  // MAC 주소로 WiFi 정보 저장
                  localStorage.setItem(
                    `hub_wifi_${macAddress}`,
                    JSON.stringify(wifiInfo)
                  );
                  // 임시 저장 삭제
                  localStorage.removeItem("hub_wifi_temp");
                  console.log(
                    `[Hub Register] WiFi 정보를 MAC 주소(${macAddress})로 저장했습니다.`
                  );
                } catch (e) {
                  console.error("Failed to save WiFi info:", e);
                }
              }
            }

            appendLog("ESP → " + trimmedLine);
            checkForRegistrationComplete(trimmedLine);
            checkForDeviceSearchResults(trimmedLine);
          });
        }
      } catch (err) {
        // 버퍼에 남은 데이터가 있으면 출력
        if (buffer.trim()) {
          const cleanedBuffer = removeAnsiCodes(buffer.trim());
          if (cleanedBuffer && (!filterBootLog || !isBootLog(cleanedBuffer))) {
            appendLog("ESP → " + cleanedBuffer);
            checkForRegistrationComplete(cleanedBuffer);
            checkForDeviceSearchResults(cleanedBuffer);
          }
        }
        appendLog("❌ 읽기 오류: " + (err.message || err));
        appendLog("💡 데이터 수신이 중단되었습니다. 포트를 다시 연결해주세요.");
        reader.releaseLock();

        // USB가 연결되어 있었다가 오류가 발생한 경우 재연결 시도
        if (wasConnectedRef.current) {
          appendLog("🔄 USB 재연결 시도 중...");
          handleAutoReconnect();
        }

        break;
      }
    }

    setIsReading(false);
    shouldContinueRef.current = false;
  };

  // 디바이스 검색 결과 확인
  const checkForDeviceSearchResults = (line) => {
    // 디바이스 검색 중이 아니면 무시
    if (!isScanning) return;

    // 검색 명령 수신 확인 (허브에서 명령을 받았는지 확인)
    if (
      line.includes("searchDevice") ||
      line.includes("Search") ||
      line.includes("검색") ||
      line.includes("Device search") ||
      line.includes("디바이스 검색")
    ) {
      if (!searchCommandReceived) {
        setSearchCommandReceived(true);
        console.log("[Device Search] 허브에서 검색 명령 수신 확인");

        // 타임아웃 정리
        if (searchCommandTimeoutRef.current) {
          clearTimeout(searchCommandTimeoutRef.current);
          searchCommandTimeoutRef.current = null;
        }
      }
    }

    // 일반적인 MAC 주소 패턴 확인 (단독으로 나타나는 경우)
    const macMatch = line.match(/([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/i);
    if (
      macMatch &&
      !line.includes("wifi") &&
      !line.includes("HTTP") &&
      !line.includes("ESP") &&
      !line.includes("GATTS")
    ) {
      const macAddress = macMatch[0].replace(/-/g, ":").toUpperCase();
      const exists = scannedDevices.some(
        (device) => device.macAddress === macAddress
      );
      if (!exists && macAddress.length === 17) {
        const newDevice = {
          id: `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          macAddress: macAddress,
          name: "",
        };
        setScannedDevices((prev) => [...prev, newDevice]);
        console.log(`[Device Search] 디바이스 발견: ${macAddress}`);
      }
    }

    // 검색 완료 신호 확인
    if (
      line.includes("Search complete") ||
      line.includes("검색 완료") ||
      line.includes("Found") ||
      line.includes("found")
    ) {
      setIsScanning(false);
      setSearchCommandReceived(false);
      if (searchCommandTimeoutRef.current) {
        clearTimeout(searchCommandTimeoutRef.current);
        searchCommandTimeoutRef.current = null;
      }
      console.log("[Device Search] 검색 완료");
    }
  };

  // 등록 완료 확인 (HTTP POST 성공 응답 감지)
  const checkForRegistrationComplete = (line) => {
    // 허브 등록 모달이 열려있지 않으면 등록 완료 처리를 하지 않음
    // (허브가 주기적으로 보내는 요청에 대한 응답은 무시)
    if (!hubRegisterModal.isOpen) {
      return;
    }

    // MAC 주소 추출
    const macMatch = line.match(/([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/i);
    let macAddress = null;
    if (macMatch) {
      macAddress = macMatch[0];

      // MAC 주소가 처음 감지되었을 때만 처리
      if (!detectedMacAddress || detectedMacAddress !== macAddress) {
        setDetectedMacAddress(macAddress);

        // 허브를 온라인으로 표시
        setHubStatuses((prev) => ({
          ...prev,
          [macAddress]: true,
        }));

        // 임시로 저장된 WiFi 정보가 있으면 MAC 주소로 이동
        const tempWifiInfo = localStorage.getItem("hub_wifi_temp");
        if (
          tempWifiInfo &&
          (!detectedMacAddress || detectedMacAddress !== macAddress)
        ) {
          try {
            const wifiInfo = JSON.parse(tempWifiInfo);
            // MAC 주소로 WiFi 정보 저장
            localStorage.setItem(
              `hub_wifi_${macAddress}`,
              JSON.stringify(wifiInfo)
            );
            // 임시 저장 삭제
            localStorage.removeItem("hub_wifi_temp");
            console.log(
              `[Hub Register] WiFi 정보를 MAC 주소(${macAddress})로 저장했습니다.`
            );
          } catch (e) {
            console.error("Failed to save WiFi info:", e);
          }
        }
      }
    }

    // HTTP POST 성공 응답 패턴 확인
    if (
      line.includes("HTTP POST 성공") ||
      line.includes("HTTP_POST 성공") ||
      line.includes("Status: 200") ||
      line.includes("등록 완료") ||
      line.includes('"success":true') ||
      line.includes("connected : success")
    ) {
      // JSON 응답에서 success 확인
      if (
        line.includes('"success":true') ||
        line.includes("등록 완료") ||
        line.includes("connected : success")
      ) {
        // MAC 주소가 없으면 추출 시도
        if (!macAddress && macMatch) {
          macAddress = macMatch[0];
        }

        // 이미 등록 완료 처리되었거나, 이미 처리된 MAC 주소면 중복 실행 방지
        if (isRegistered) return;
        if (macAddress && registrationProcessedRef.current.has(macAddress)) {
          return;
        }

        // MAC 주소가 있으면 처리된 목록에 추가
        if (macAddress) {
          registrationProcessedRef.current.add(macAddress);
        }

        setIsRegistered(true);

        console.log("[Hub Register] 등록 완료 감지됨, 목록 새로고침 시작");

        setSearchStatus({
          type: "success",
          message: "허브 등록이 완료되었습니다! 목록을 새로고침합니다.",
        });

        // 즉시 새로고침 (조건 없이)
        loadData()
          .then(() => {
            console.log("[Hub Register] 첫 번째 새로고침 완료");
          })
          .catch((err) => {
            console.error("[Hub Register] 새로고침 오류:", err);
          });

        // 허브 목록 새로고침 (약간의 지연을 두고 여러 번 시도)
        // 백엔드에 저장되는 시간을 고려하여 지연 후 새로고침
        setTimeout(() => {
          loadData()
            .then(() => {
              console.log("[Hub Register] 두 번째 새로고침 완료");
            })
            .catch((err) => {
              console.error("[Hub Register] 새로고침 오류:", err);
            });
        }, 1000);

        // 추가로 2초 후 한 번 더 새로고침 (확실하게)
        setTimeout(() => {
          loadData()
            .then(() => {
              console.log("[Hub Register] 세 번째 새로고침 완료");
            })
            .catch((err) => {
              console.error("[Hub Register] 새로고침 오류:", err);
            });
        }, 2000);

        // 2초 후 디바이스 등록 모달 열기 (USB 연결은 유지)
        setTimeout(() => {
          // 허브 등록 모달만 닫기 (USB 연결은 유지)
          setHubRegisterModal({ isOpen: false });
          setAvailableDevices([]);
          setSelectedDevice(null);
          setWifiId("");
          setWifiPassword("");
          setIsSearching(false);
          setSearchStatus({ type: null, message: "" });
          setReceivedData("");
          setRegistrationStep(1);
          setPortInfo(null);
          setIsRegistered(false);
          // detectedMacAddress는 유지 (디바이스 등록에 필요)

          // 모달이 닫힌 후 한 번 더 새로고침
          setTimeout(() => {
            loadData()
              .then(() => {
                console.log("[Hub Register] 모달 닫힌 후 새로고침 완료");
              })
              .catch((err) => {
                console.error("[Hub Register] 새로고침 오류:", err);
              });
          }, 500);

          // 디바이스 등록 모달 자동 열기
          setTimeout(() => {
            handleOpenDeviceRegister();
          }, 500);
        }, 2000);
      }
    }
  };

  // 로그에 메시지 추가
  const appendLog = (msg) => {
    setReceivedData((prev) => prev + msg + "\n");
  };

  // 데이터 읽기 중지
  const handleStopReading = async () => {
    shouldContinueRef.current = false;
    setIsReading(false);
    if (readerRef.current) {
      try {
        await readerRef.current.cancel();
        await readerRef.current.releaseLock();
      } catch (error) {
        console.error("[USB] Error stopping reader:", error);
      }
      readerRef.current = null;
    }
    setSearchStatus({ type: "info", message: "데이터 수신이 중지되었습니다." });
  };

  const handleSelectDevice = (device) => {
    setSelectedDevice(device);
  };

  const handleRegisterHub = async () => {
    if (!currentPort || !writerRef.current) {
      setSearchStatus({
        type: "error",
        message: "먼저 USB 연결 버튼을 눌러주세요.",
      });
      return;
    }

    if (!wifiId.trim()) {
      setSearchStatus({
        type: "error",
        message: "WiFi ID를 입력해주세요.",
      });
      return;
    }

    if (!user?.email) {
      setSearchStatus({
        type: "error",
        message: "로그인이 필요합니다.",
      });
      return;
    }

    setSearchStatus({ type: "info", message: "WiFi 설정을 허브에 전송 중..." });

    try {
      // WiFi ID와 비밀번호를 함께 전송 (형식: "wifi:wifi_id,wifi_password,user_email\n")
      const msg = `wifi:${wifiId},${wifiPassword || ""},${user.email}\n`;
      const encoder = new TextEncoder();

      // 저장된 writer 재사용
      await writerRef.current.write(encoder.encode(msg));
      appendLog(
        `PC → WiFi 정보 전송: ID=${wifiId}, Password=${
          wifiPassword ? "***" : "(없음)"
        }`
      );

      // WiFi 정보를 임시로 저장 (MAC 주소가 감지되면 업데이트됨)
      const wifiInfo = {
        ssid: wifiId,
        password: wifiPassword || "",
        userEmail: user.email,
        savedAt: new Date().toISOString(),
      };
      // 임시 키로 저장 (나중에 MAC 주소가 감지되면 이동)
      localStorage.setItem("hub_wifi_temp", JSON.stringify(wifiInfo));

      // 허브를 온라인으로 표시
      if (detectedMacAddress) {
        setHubStatuses((prev) => ({
          ...prev,
          [detectedMacAddress]: true,
        }));

        // WiFi 정보를 MAC 주소로 저장
        localStorage.setItem(
          `hub_wifi_${detectedMacAddress}`,
          JSON.stringify(wifiInfo)
        );
        // 임시 저장 삭제
        localStorage.removeItem("hub_wifi_temp");
      }

      setSearchStatus({
        type: "info",
        message:
          "WiFi 설정이 전송되었습니다. 허브가 WiFi에 연결되고 등록을 완료할 때까지 기다려주세요...",
      });
    } catch (err) {
      appendLog("전송 실패: " + err);
      setSearchStatus({
        type: "error",
        message: `WiFi 설정 전송 중 오류가 발생했습니다: ${err.message}`,
      });

      // 에러 발생 시 writer가 손상되었을 수 있으므로 재생성 시도
      if (currentPort && currentPort.writable) {
        try {
          if (writerRef.current) {
            writerRef.current.releaseLock();
          }
          writerRef.current = currentPort.writable.getWriter();
          appendLog("⚠ Writer 재생성 완료");
        } catch (reconnectErr) {
          appendLog("⚠ Writer 재생성 실패: " + reconnectErr);
        }
      }
    }
  };

  // 디바이스 등록 모달
  const handleOpenDeviceRegister = () => {
    setDeviceRegisterModal({ isOpen: true });
    setHubModeSwitched(false);
    setScannedDevices([]);
    setIsScanning(false);
    setDevicesToRegister({});
  };

  const handleCloseDeviceRegister = () => {
    setDeviceRegisterModal({ isOpen: false });
    setHubModeSwitched(false);
    setScannedDevices([]);
    setIsScanning(false);
    setDevicesToRegister({});
    setSelectedDevices({});
  };

  const handleSwitchHubMode = () => {
    setHubModeSwitched(true);
    setAlertModal({
      isOpen: true,
      title: "모드 전환",
      message:
        "허브가 디바이스 등록 모드로 전환되었습니다. 이제 모든 디바이스를 켜주세요.",
    });
  };

  // Socket.IO를 이용한 디바이스 검색 명령 전송 (connect:devices)
  const handleScanDevices = async () => {
    if (!isConnected) {
      setAlertModal({
        isOpen: true,
        title: "연결 오류",
        message: "서버와의 실시간 연결이 없습니다. 잠시 후 다시 시도해주세요.",
      });
      return;
    }

    // 허브 주소 결정: detectedMacAddress가 있으면 사용, 없으면 등록된 허브 중 첫 번째 사용
    let hubAddress = detectedMacAddress;
    if (!hubAddress) {
      if (!hubs || hubs.length === 0) {
        // 허브가 전혀 없는 경우에만 안내 메시지 출력
        setAlertModal({
          isOpen: true,
          title: "허브 없음",
          message: "등록된 허브가 없습니다. 먼저 허브를 등록해주세요.",
        });
        return;
      }
      hubAddress = hubs[0].address;
      setDetectedMacAddress(hubAddress);
    }

    setIsScanning(true);
    setScannedDevices([]);
    setSearchCommandReceived(false);

    // 응답 타임아웃 설정: CONNECTED_DEVICES가 오지 않을 때만 안내 메시지 출력
    if (searchCommandTimeoutRef.current) {
      clearTimeout(searchCommandTimeoutRef.current);
    }
    // 허브에서 디바이스를 20초 동안 검색하므로, 여유를 두고 25초 타임아웃을 설정
    searchCommandTimeoutRef.current = setTimeout(() => {
      if (!searchCommandReceived) {
        setIsScanning(false);
        setAlertModal({
          isOpen: true,
          title: "허브 응답 없음",
          message:
            "허브로부터 디바이스 목록 응답을 받지 못했습니다. 허브가 전원이 켜져 있고 네트워크에 연결되어 있는지 확인해주세요.",
        });
      }
    }, 25000);

    try {
      const requestId = `connect_devices_${hubAddress}_${Date.now()}`;
      emit("CONTROL_REQUEST", {
        hubId: hubAddress,
        deviceId: "HUB",
        command: {
          action: "connect_devices",
          duration: 20000, // 20초 스캔
        },
        requestId,
      });
      console.log("[Device Search] Socket.IO connect_devices 명령 전송:", {
        hubId: hubAddress,
        requestId,
      });
    } catch (error) {
      console.error("[Device Search] MQTT 명령 전송 실패:", error);
      setAlertModal({
        isOpen: true,
        title: "검색 오류",
        message: `디바이스 검색 명령 전송에 실패했습니다: ${error.message}`,
      });
      setIsScanning(false);
    }
  };

  const handleBlinkLED = async (deviceId) => {
    // 디바이스 MAC 주소 찾기
    const device = scannedDevices.find((d) => d.id === deviceId);
    if (!device || !device.macAddress) {
      setAlertModal({
        isOpen: true,
        title: "오류",
        message: "디바이스 정보를 찾을 수 없습니다.",
      });
      return;
    }

    if (!detectedMacAddress || !isConnected) {
      setAlertModal({
        isOpen: true,
        title: "연결 오류",
        message: "허브가 온라인 상태인지 확인해주세요.",
      });
      return;
    }

    try {
      const requestId = `blink_${device.macAddress}_${Date.now()}`;
      emit("CONTROL_REQUEST", {
        hubId: detectedMacAddress,
        deviceId: device.macAddress,
        command: {
          action: "blink",
          mac_address: device.macAddress,
        },
        requestId,
      });
      console.log("[Device Blink] MQTT blink 명령 전송:", {
        hubId: detectedMacAddress,
        device: device.macAddress,
        requestId,
      });

      setAlertModal({
        isOpen: true,
        title: "LED 깜빡임",
        message: `디바이스(${device.macAddress})의 LED 깜빡임 명령이 전송되었습니다.`,
      });
    } catch (error) {
      console.error("[Device Blink] 명령 전송 실패:", error);
      setAlertModal({
        isOpen: true,
        title: "오류",
        message: `LED 깜빡임 명령 전송에 실패했습니다: ${error.message}`,
      });
    }
  };

  // 등록된 디바이스용 LED 깜빡이기 함수
  const handleBlinkRegisteredDevice = async (deviceAddress) => {
    if (!isConnected) {
      setAlertModal({
        isOpen: true,
        title: "연결 오류",
        message: "서버와의 실시간 연결이 없습니다.",
      });
      return;
    }

    // 허브 주소 결정
    let hubAddress = detectedMacAddress;
    if (!hubAddress) {
      if (!hubs || hubs.length === 0) {
        setAlertModal({
          isOpen: true,
          title: "허브 없음",
          message: "등록된 허브가 없습니다.",
        });
        return;
      }
      hubAddress = hubs[0].address;
    }

    try {
      const requestId = `blink_${deviceAddress}_${Date.now()}`;
      emit("CONTROL_REQUEST", {
        hubId: hubAddress,
        deviceId: deviceAddress,
        command: {
          action: "blink",
          mac_address: deviceAddress,
        },
        requestId,
      });
      console.log("[Device Blink Registered] Socket.IO blink 명령 전송:", {
        hubId: hubAddress,
        device: deviceAddress,
        requestId,
      });

      setAlertModal({
        isOpen: true,
        title: "LED 깜빡임",
        message: `디바이스(${deviceAddress})의 LED 깜빡임 명령이 전송되었습니다.`,
      });
    } catch (error) {
      console.error("[Device Blink Registered] 명령 전송 실패:", error);
      setAlertModal({
        isOpen: true,
        title: "오류",
        message: `LED 깜빡임 명령 전송에 실패했습니다: ${error.message}`,
      });
    }
  };

  const handleToggleDeviceSelection = (deviceId) => {
    const isCurrentlySelected = selectedDevices[deviceId];
    const device = scannedDevices.find((d) => d.id === deviceId);

    setSelectedDevices((prev) => ({
      ...prev,
      [deviceId]: !prev[deviceId],
    }));

    // 체크 해제 시 devicesToRegister에서 제거
    if (isCurrentlySelected) {
      setDevicesToRegister((prev) => {
        const newState = { ...prev };
        delete newState[deviceId];
        return newState;
      });
    } else {
      // 체크 시 devicesToRegister에 추가
      const defaultName = device?.name || "tailing";
      setDevicesToRegister((prev) => ({
        ...prev,
        [deviceId]: { name: defaultName, isRegistering: true },
      }));
    }
  };

  const handleSelectAllDevices = () => {
    const allSelected = scannedDevices.every(
      (device) => selectedDevices[device.id]
    );
    const newSelection = {};
    const newDevicesToRegister = {};

    scannedDevices.forEach((device) => {
      const willBeSelected = !allSelected;
      newSelection[device.id] = willBeSelected;

      if (willBeSelected) {
        // 선택되면 등록 목록에 추가
        const defaultName = device?.name || "tailing";
        newDevicesToRegister[device.id] = {
          name: defaultName,
          isRegistering: true,
        };
      }
    });

    setSelectedDevices(newSelection);

    if (allSelected) {
      // 전체 해제 시 모두 제거
      setDevicesToRegister({});
    } else {
      // 전체 선택 시 모두 추가
      setDevicesToRegister(newDevicesToRegister);
    }
  };

  const handleDeviceRegisterNameChange = (deviceId, name) => {
    setDevicesToRegister((prev) => ({
      ...prev,
      [deviceId]: { ...prev[deviceId], name },
    }));
  };

  const handleCancelRegisterDevice = (deviceId) => {
    setDevicesToRegister((prev) => {
      const newState = { ...prev };
      delete newState[deviceId];
      return newState;
    });
    // 체크박스도 해제
    setSelectedDevices((prev) => ({
      ...prev,
      [deviceId]: false,
    }));
  };

  const handleFinalRegister = async () => {
    console.log(
      "[Device Register] 시작 - devicesToRegister:",
      devicesToRegister
    );
    console.log("[Device Register] scannedDevices:", scannedDevices);
    console.log("[Device Register] detectedMacAddress:", detectedMacAddress);

    const devicesWithNames = Object.entries(devicesToRegister).filter(
      ([_, data]) => {
        // null, undefined 체크 및 빈 문자열 체크
        return data.name != null && data.name.trim() !== "";
      }
    );

    console.log("[Device Register] 이름이 입력된 디바이스:", devicesWithNames);

    if (devicesWithNames.length === 0) {
      setAlertModal({
        isOpen: true,
        title: "등록 오류",
        message:
          "등록할 디바이스가 없거나 모든 디바이스명이 비어있습니다. 디바이스명을 입력해주세요.",
      });
      return;
    }

    try {
      // 허브 선택 (등록 중인 허브의 MAC 주소 사용)
      const hubAddress = detectedMacAddress;
      if (!hubAddress) {
        setAlertModal({
          isOpen: true,
          title: "오류",
          message: "허브 정보를 찾을 수 없습니다. 허브를 먼저 등록해주세요.",
        });
        return;
      }

      console.log("[Device Register] 허브 주소:", hubAddress);

      // 각 디바이스 등록
      const registrationResults = await Promise.allSettled(
        devicesWithNames.map(async ([deviceId, data]) => {
          console.log(
            `[Device Register] 디바이스 등록 시도 - ID: ${deviceId}, Name: ${data.name.trim()}`
          );
          const device = scannedDevices.find((d) => d.id === deviceId);
          if (!device || !device.macAddress) {
            throw new Error(`디바이스 정보를 찾을 수 없습니다: ${deviceId}`);
          }

          console.log(
            `[Device Register] 디바이스 MAC 주소: ${device.macAddress}`
          );

          const result = await deviceService.createDevice({
            address: device.macAddress,
            name: data.name.trim(),
            hubAddress: hubAddress,
          });

          console.log(`[Device Register] 디바이스 등록 성공:`, result);
          return {
            deviceId,
            name: data.name.trim(),
            macAddress: device.macAddress,
          };
        })
      );

      console.log("[Device Register] 등록 결과:", registrationResults);

      // 성공/실패 결과 확인
      const successful = registrationResults.filter(
        (r) => r.status === "fulfilled"
      ).length;
      const failed = registrationResults.filter(
        (r) => r.status === "rejected"
      ).length;

      if (successful > 0) {
        setAlertModal({
          isOpen: true,
          title: "등록 완료",
          message: `${successful}개의 디바이스가 성공적으로 등록되었습니다.${
            failed > 0 ? ` (${failed}개 실패)` : ""
          }`,
        });
        handleCloseDeviceRegister();
        // 자동 새로고침 제거 (사용자가 수동으로 새로고침 가능)
      } else {
        const errorMessages = registrationResults
          .filter((r) => r.status === "rejected")
          .map((r) => {
            console.error("[Device Register] 등록 실패:", r.reason);
            return (
              r.reason?.message || r.reason?.toString() || "알 수 없는 오류"
            );
          })
          .join(", ");

        setAlertModal({
          isOpen: true,
          title: "등록 실패",
          message: `모든 디바이스 등록에 실패했습니다: ${errorMessages}`,
        });
      }
    } catch (error) {
      console.error("[Device Register] Error:", error);
      setAlertModal({
        isOpen: true,
        title: "오류",
        message: error.message || "디바이스 등록에 실패했습니다.",
      });
    }
  };

  const handleDismissAlert = (alertId) => {
    setHardwareAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
  };

  // 랜덤 오류 시뮬레이션
  useEffect(() => {
    if (!isErrorSimulationActive) {
      // 시뮬레이션이 비활성화되면 정리
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
      Object.values(errorDurationRefs.current).forEach((timeout) => {
        if (timeout) clearTimeout(timeout);
      });
      errorDurationRefs.current = {};
      setSimulatedErrors({});
      // 시뮬레이션 오류 알림 제거
      setHardwareAlerts((prev) =>
        prev.filter((alert) => !alert.id?.includes("simulated"))
      );
      return;
    }

    // 랜덤 오류 발생 함수
    const triggerRandomError = () => {
      // 연결된 디바이스 중 랜덤하게 선택
      const connectedDevices = devices.filter((d) => d.status === "connected");
      if (connectedDevices.length === 0) return;

      // 랜덤하게 오류 발생 (30% 확률)
      if (Math.random() < 0.3) {
        const randomDevice =
          connectedDevices[Math.floor(Math.random() * connectedDevices.length)];
        const deviceId = randomDevice.address;

        const errorCodes = [
          {
            code: "hr:7",
            type: "warning",
            message: "배터리가 부족하니 충전을 해라.",
          },
          { code: "hr:8", type: "error", message: "신호가 불량하니 다시 해라" },
          {
            code: "hr:9",
            type: "info",
            message: "날뛰고 있어 신호가 안나오니 참고해라",
          },
        ];

        const randomError =
          errorCodes[Math.floor(Math.random() * errorCodes.length)];

        // 시뮬레이션된 오류 설정
        setSimulatedErrors((prev) => ({
          ...prev,
          [deviceId]: randomError,
        }));

        // 오류 알림 생성
        setHardwareAlerts((prev) => {
          const existingIndex = prev.findIndex(
            (alert) =>
              alert.deviceId === deviceId && alert.id?.includes("simulated")
          );
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = {
              id: `simulated-alert-${deviceId}-${Date.now()}`,
              deviceId: deviceId,
              deviceName: randomDevice.name || deviceId,
              deviceAddress: deviceId,
              ...randomError,
              timestamp: Date.now(),
            };
            return updated;
          } else {
            return [
              ...prev,
              {
                id: `simulated-alert-${deviceId}-${Date.now()}`,
                deviceId: deviceId,
                deviceName: randomDevice.name || deviceId,
                deviceAddress: deviceId,
                ...randomError,
                timestamp: Date.now(),
              },
            ];
          }
        });

        // 5-15초 후 자동으로 정상 복귀
        const errorDuration = 5000 + Math.random() * 10000; // 5-15초
        errorDurationRefs.current[deviceId] = setTimeout(() => {
          setSimulatedErrors((prev) => {
            const updated = { ...prev };
            delete updated[deviceId];
            return updated;
          });
          setHardwareAlerts((prev) =>
            prev.filter(
              (alert) =>
                !(
                  alert.deviceId === deviceId && alert.id?.includes("simulated")
                )
            )
          );
          delete errorDurationRefs.current[deviceId];
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
      Object.values(errorDurationRefs.current).forEach((timeout) => {
        if (timeout) clearTimeout(timeout);
      });
      errorDurationRefs.current = {};
    };
  }, [isErrorSimulationActive, devices]);

  const handleToggleErrorSimulation = () => {
    setIsErrorSimulationActive((prev) => !prev);
  };

  // 디바이스 전체 연결 (검색 명령 전송)
  const handleConnectAllDevices = async () => {
    if (!isConnected) {
      setAlertModal({
        isOpen: true,
        title: "연결 오류",
        message: "서버와의 실시간 연결이 없습니다. 잠시 후 다시 시도해주세요.",
      });
      return;
    }

    // 허브 주소 결정
    let hubAddress = detectedMacAddress;
    if (!hubAddress) {
      if (!hubs || hubs.length === 0) {
        setAlertModal({
          isOpen: true,
          title: "허브 없음",
          message: "등록된 허브가 없습니다. 먼저 허브를 등록해주세요.",
        });
        return;
      }
      hubAddress = hubs[0].address;
      setDetectedMacAddress(hubAddress);
    }

    setIsConnectingAll(true);

    try {
      const requestId = `connect_all_${hubAddress}_${Date.now()}`;
      emit("CONTROL_REQUEST", {
        hubId: hubAddress,
        deviceId: "HUB",
        command: {
          action: "connect_devices",
          duration: 20000,
        },
        requestId,
      });
      console.log("[Device Connect All] Socket.IO connect_devices 명령 전송:", {
        hubId: hubAddress,
        requestId,
      });

      // 25초 후 타임아웃
      setTimeout(() => {
        setIsConnectingAll(false);
      }, 25000);

      // 25초 후 타임아웃
      setTimeout(() => {
        setIsConnectingAll(false);
      }, 25000);
    } catch (error) {
      console.error("[Device Connect All] MQTT 명령 전송 실패:", error);
      setAlertModal({
        isOpen: true,
        title: "연결 오류",
        message: `디바이스 연결 명령 전송에 실패했습니다: ${error.message}`,
      });
      setIsConnectingAll(false);
    }
  };

  if (loading) {
    return (
      <div className="hardware-page">
        <Header />
        <HardwareAlertBar
          alerts={hardwareAlerts}
          onDismiss={handleDismissAlert}
        />
        <div className="hardware-container">
          <div className="loading">데이터를 불러오는 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="hardware-page">
      <Header />
      <HardwareAlertBar
        alerts={hardwareAlerts}
        onDismiss={handleDismissAlert}
      />
      <div className="hardware-container">
        {/* 디바이스 및 허브 현황 */}
        <section className="stats-section">
          <h2>디바이스 및 허브 현황</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">등록된 허브 수</div>
              <div className="stat-value">{stats.totalHubs}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">등록된 디바이스 수</div>
              <div className="stat-value">{stats.totalDevices}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">연결된 디바이스 수</div>
              <div className="stat-value">{stats.connectedDevices}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">가용중인 디바이스 수</div>
              <div className="stat-value">{stats.availableDevices}</div>
            </div>
          </div>
        </section>

        {/* 허브 & 디바이스 관리 2열 레이아웃 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "2rem",
            marginTop: "2rem",
          }}
        >
          {/* 왼쪽: 허브 관리 */}
          <div className="hub-section">
            <div className="section-header">
              <h2>허브 목록</h2>
              <button className="btn-primary" onClick={handleOpenHubRegister}>
                허브 등록
              </button>
            </div>
            <div className="hub-list">
              {hubs.map((hub) => (
                <div key={hub.id} className="hub-card">
                  <div className="hub-info">
                    <h3>{hub.name}</h3>
                    <div className="hub-details">
                      <div className="detail-item">
                        <span className="label">MAC 주소:</span>
                        <span className="mac-address">{hub.address}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">연결된 디바이스:</span>
                        <span className="device-count">
                          {hub.connectedDevices || 0}개
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="label">상태:</span>
                        <div className="hub-status-container">
                          <span
                            className={
                              hubStatuses[hub.address]
                                ? "status-online"
                                : "status-offline"
                            }
                          >
                            {hubStatuses[hub.address]
                              ? "🟢 온라인"
                              : "🔴 오프라인"}
                          </span>
                          {hubActivityProgress[hub.address] && (
                            <div className="hub-activity-progress">
                              <div className="progress-bar-container">
                                <div
                                  className={`progress-bar ${
                                    hubActivityProgress[hub.address].isActive
                                      ? "active"
                                      : ""
                                  }`}
                                  style={{
                                    width: `${
                                      hubActivityProgress[hub.address].progress
                                    }%`,
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      {hub.devices && hub.devices.length > 0 && (
                        <div className="detail-item">
                          <span className="label">디바이스 목록:</span>
                          <div className="device-list-inline">
                            {hub.devices.map((device, idx) => (
                              <span key={device.id} className="device-tag">
                                {device.name || device.address}
                                {idx < hub.devices.length - 1 && ", "}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="hub-actions">
                    <button
                      className="btn-secondary"
                      onClick={() => handleHubWifiConfig(hub.address)}
                    >
                      WiFi 설정
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => {
                        const newName = prompt(
                          "새 이름을 입력하세요:",
                          hub.name
                        );
                        if (newName && newName !== hub.name) {
                          handleHubNameChange(hub.address, newName);
                        }
                      }}
                    >
                      이름 변경
                    </button>
                    <button
                      className="btn-danger"
                      onClick={() => handleHubDelete(hub.address)}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
              {hubs.length === 0 && (
                <div className="no-data">등록된 허브가 없습니다.</div>
              )}
            </div>
          </div>

          {/* 오른쪽: 디바이스 관리 */}
          <div className="device-section">
            <div className="section-header">
              <h2>디바이스 목록</h2>
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <button
                  className="btn-secondary"
                  onClick={handleConnectAllDevices}
                  disabled={isConnectingAll}
                >
                  {isConnectingAll ? "연결 중..." : "디바이스 전체 연결"}
                </button>
                <button
                  className="btn-primary"
                  onClick={handleOpenDeviceRegister}
                >
                  디바이스 등록
                </button>
              </div>
            </div>
            <div className="device-list">
              {devices.map((device) => {
                const deviceData = deviceCurrentData[device.address];
                const simulatedError = simulatedErrors[device.address];
                const deviceError =
                  simulatedError ||
                  (deviceData
                    ? detectHardwareError(deviceData.heartRate)
                    : null);
                return (
                  <div key={device.id} className="device-card">
                    <div className="device-info">
                      <h3>
                        {device.name}
                        {deviceError && (
                          <span
                            className="device-warning-badge"
                            title={deviceError.message}
                          >
                            ⚠️
                          </span>
                        )}
                      </h3>
                      <div className="device-details">
                        <div className="detail-item">
                          <span className="label">MAC 주소:</span>
                          <span>{device.address}</span>
                        </div>
                        <div className="detail-item">
                          <span className="label">허브:</span>
                          <span>{device.hubName}</span>
                        </div>
                        <div className="detail-item">
                          <span className="label">상태:</span>
                          <span
                            className={
                              deviceConnectionStatuses[device.address] ===
                              "connected"
                                ? "status-connected"
                                : "status-disconnected"
                            }
                          >
                            {deviceConnectionStatuses[device.address] ===
                            "connected"
                              ? "연결됨"
                              : "연결 안됨"}
                          </span>
                        </div>
                        <div className="detail-item">
                          <span className="label">연결된 환자:</span>
                          <span>
                            {device.connectedPatient
                              ? device.connectedPatient.name
                              : "없음"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="device-actions">
                      <button
                        className="btn-secondary"
                        onClick={() =>
                          handleBlinkRegisteredDevice(device.address)
                        }
                        disabled={
                          deviceConnectionStatuses[device.address] !==
                          "connected"
                        }
                        style={{
                          opacity:
                            deviceConnectionStatuses[device.address] !==
                            "connected"
                              ? 0.5
                              : 1,
                        }}
                      >
                        LED 깜빡이기
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => {
                          const newName = prompt(
                            "새 이름을 입력하세요:",
                            device.name
                          );
                          if (newName && newName !== device.name) {
                            handleDeviceNameChange(device.address, newName);
                          }
                        }}
                      >
                        이름 변경
                      </button>
                      <button
                        className="btn-primary"
                        onClick={() => handleDevicePatientChange(device.id)}
                      >
                        {device.connectedPatient ? "환자 변경" : "환자 연결"}
                      </button>
                    </div>
                  </div>
                );
              })}
              {devices.length === 0 && (
                <div className="no-data">등록된 디바이스가 없습니다.</div>
              )}
            </div>
          </div>
        </div>

        {/* 사용 가이드 */}
        <section className="guide-section">
          <button
            className="guide-btn"
            onClick={() =>
              window.open("/guide", "_blank", "width=1000,height=800")
            }
          >
            사용 가이드 보기
          </button>
        </section>
      </div>

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ isOpen: false, title: "", message: "" })}
        title={alertModal.title}
        message={alertModal.message}
      />
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() =>
          setConfirmModal({
            isOpen: false,
            title: "",
            message: "",
            onConfirm: null,
          })
        }
        onConfirm={confirmModal.onConfirm || (() => {})}
        title={confirmModal.title}
        message={confirmModal.message}
      />

      {/* 허브 등록 모달 */}
      {hubRegisterModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content hub-register-modal">
            <div className="modal-header">
              <h3>허브 등록</h3>
              <button onClick={handleCloseHubRegister} className="close-btn">
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="hub-register-content">
                {/* 단계 표시 */}
                <div className="registration-steps">
                  <div
                    className={`step-indicator ${
                      registrationStep >= 1 ? "active" : ""
                    } ${registrationStep > 1 ? "completed" : ""}`}
                  >
                    <div className="step-number">1</div>
                    <div className="step-label">USB 연결</div>
                  </div>
                  <div
                    className={`step-indicator ${
                      registrationStep >= 2 ? "active" : ""
                    } ${isRegistered ? "completed" : ""}`}
                  >
                    <div className="step-number">2</div>
                    <div className="step-label">WiFi 설정</div>
                  </div>
                  {isRegistered && (
                    <div className="step-indicator completed">
                      <div className="step-number">✓</div>
                      <div className="step-label">등록 완료</div>
                    </div>
                  )}
                </div>

                {/* 1단계: USB 연결 */}
                {registrationStep === 1 && (
                  <>
                    <p className="hub-register-instruction">
                      USB 선으로 허브를 연결한 후, 아래 버튼을 클릭하여 USB
                      포트를 선택하세요.
                    </p>

                    <div className="search-section">
                      <button
                        className="btn-primary search-device-btn"
                        onClick={handleSearchDevices}
                        disabled={isSearching || isReading}
                      >
                        {isSearching
                          ? "연결 중..."
                          : isReading
                          ? "수신 중..."
                          : "USB 포트 연결"}
                      </button>

                      {searchStatus.type && (
                        <div
                          className={`search-status-message ${searchStatus.type}`}
                        >
                          {searchStatus.type === "info" && "ℹ️ "}
                          {searchStatus.type === "success" && "✅ "}
                          {searchStatus.type === "error" && "❌ "}
                          {searchStatus.message}
                        </div>
                      )}

                      {portInfo && (
                        <div className="port-info">
                          <div className="port-info-item">
                            <span className="port-info-label">Vendor ID:</span>
                            <span className="port-info-value">
                              0x
                              {portInfo.usbVendorId?.toString(16).toUpperCase()}
                            </span>
                          </div>
                          <div className="port-info-item">
                            <span className="port-info-label">Product ID:</span>
                            <span className="port-info-value">
                              0x
                              {portInfo.usbProductId
                                ?.toString(16)
                                .toUpperCase()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* 2단계: WiFi 입력 */}
                {registrationStep === 2 && (
                  <>
                    <p className="hub-register-instruction">
                      WiFi 정보를 입력하고 전송 버튼을 클릭하세요. 허브가 WiFi에
                      연결되면 자동으로 등록됩니다.
                    </p>

                    <div className="wifi-form-section">
                      <div className="form-group">
                        <label htmlFor="wifi-id">WiFi ID (SSID) *</label>
                        <input
                          id="wifi-id"
                          type="text"
                          value={wifiId}
                          onChange={(e) => setWifiId(e.target.value)}
                          placeholder="WiFi 네트워크 이름을 입력하세요"
                          className="form-input"
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="wifi-password">
                          WiFi 비밀번호 (선택사항)
                        </label>
                        <input
                          id="wifi-password"
                          type="password"
                          value={wifiPassword}
                          onChange={(e) => setWifiPassword(e.target.value)}
                          placeholder="WiFi 비밀번호를 입력하세요 (없으면 비워두세요)"
                          className="form-input"
                        />
                      </div>
                      <button
                        className="btn-primary"
                        onClick={handleRegisterHub}
                        disabled={!wifiId.trim() || isRegistered}
                        style={{ width: "100%", marginTop: "1rem" }}
                      >
                        {isRegistered ? "등록 완료" : "WiFi 설정 전송"}
                      </button>
                    </div>

                    {searchStatus.type && (
                      <div
                        className={`search-status-message ${searchStatus.type}`}
                      >
                        {searchStatus.type === "info" && "ℹ️ "}
                        {searchStatus.type === "success" && "✅ "}
                        {searchStatus.type === "error" && "❌ "}
                        {searchStatus.message}
                      </div>
                    )}

                    {detectedMacAddress && (
                      <div className="detected-mac">
                        <span className="detected-mac-label">
                          감지된 MAC 주소:
                        </span>
                        <span className="detected-mac-value">
                          {detectedMacAddress}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button
                onClick={handleCloseHubRegister}
                className="btn-secondary"
              >
                {isRegistered ? "닫기" : "취소"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 디바이스 등록 모달 */}
      {deviceRegisterModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content device-register-modal">
            <div className="modal-header">
              <h3>디바이스 등록</h3>
              <button onClick={handleCloseDeviceRegister} className="close-btn">
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="device-register-content">
                <p className="device-register-instruction">
                  디바이스를 등록하세요.
                </p>

                <div className="scan-section">
                  <p className="scan-instruction">
                    연결하고자 하는 모든 디바이스를 켜주세요.
                  </p>
                  <button
                    className="btn-primary scan-device-btn"
                    onClick={handleScanDevices}
                    disabled={isScanning}
                  >
                    {isScanning ? "검색 중..." : "디바이스 검색"}
                  </button>
                  {isScanning && (
                    <div style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
                      {searchCommandReceived ? (
                        <p style={{ color: "#27ae60" }}>
                          ✅ 허브에서 검색 명령을 받았습니다. 디바이스를 검색
                          중...
                        </p>
                      ) : (
                        <p style={{ color: "#f39c12" }}>
                          ⏳ 허브 응답 대기 중...
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {scannedDevices.length > 0 && (
                  <div className="scanned-devices-list">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "1rem",
                      }}
                    >
                      <h4 style={{ margin: 0 }}>스캔된 디바이스 목록</h4>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          className="btn-secondary"
                          onClick={handleSelectAllDevices}
                          style={{
                            padding: "0.4rem 0.8rem",
                            fontSize: "0.85rem",
                          }}
                        >
                          {scannedDevices.every(
                            (device) => selectedDevices[device.id]
                          )
                            ? "전체 해제"
                            : "전체 선택"}
                        </button>
                      </div>
                    </div>
                    {scannedDevices.map((device) => {
                      const deviceData = devicesToRegister[device.id];
                      const isRegistering = deviceData?.isRegistering;
                      const isSelected = selectedDevices[device.id];
                      // 등록 중일 때는 입력된 이름을 우선, 아니면 기본 이름 표시
                      const deviceName = isRegistering
                        ? deviceData?.name !== undefined
                          ? deviceData.name
                          : device.name || "tailing"
                        : device.name || "tailing";

                      return (
                        <div
                          key={device.id}
                          className="scanned-device-item"
                          style={{ minHeight: "80px" }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.75rem",
                              flex: 1,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected || false}
                              onChange={() =>
                                handleToggleDeviceSelection(device.id)
                              }
                              style={{
                                width: "18px",
                                height: "18px",
                                cursor: "pointer",
                              }}
                            />
                            <div
                              className="scanned-device-info"
                              style={{ flex: 1 }}
                            >
                              {isRegistering ? (
                                <div className="device-name-input-section">
                                  <input
                                    type="text"
                                    value={deviceName}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      if (value.length <= 12) {
                                        handleDeviceRegisterNameChange(
                                          device.id,
                                          value
                                        );
                                      }
                                    }}
                                    placeholder="디바이스명을 입력하세요"
                                    className="form-input device-name-input"
                                    maxLength={12}
                                  />
                                </div>
                              ) : (
                                <>
                                  <span className="scanned-device-name">
                                    {deviceName || "tailing"}
                                  </span>
                                  <span className="scanned-device-mac">
                                    {device.macAddress}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="scanned-device-actions">
                            {isRegistering ? (
                              <span
                                style={{ fontSize: "0.85rem", color: "#666" }}
                              >
                                이름을 수정하세요
                              </span>
                            ) : (
                              <button
                                className="btn-secondary blink-led-btn"
                                onClick={() => handleBlinkLED(device.id)}
                              >
                                LED 깜빡이기
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {Object.keys(devicesToRegister).length > 0 && (
                  <div
                    className="final-register-section"
                    style={{
                      marginTop: "1.5rem",
                      paddingTop: "1rem",
                      borderTop: "1px solid #e0e0e0",
                    }}
                  >
                    <p
                      style={{
                        marginBottom: "0.5rem",
                        fontSize: "0.9rem",
                        color: "#666",
                      }}
                    >
                      등록할 디바이스:{" "}
                      {
                        Object.keys(devicesToRegister).filter(
                          (id) =>
                            devicesToRegister[id].name != null &&
                            devicesToRegister[id].name.trim()
                        ).length
                      }
                      개
                    </p>
                    <button
                      className="btn-primary final-register-btn"
                      onClick={handleFinalRegister}
                      disabled={
                        Object.keys(devicesToRegister).filter(
                          (id) =>
                            devicesToRegister[id].name != null &&
                            devicesToRegister[id].name.trim()
                        ).length === 0
                      }
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        fontSize: "1rem",
                        fontWeight: "600",
                      }}
                    >
                      등록하기 (
                      {
                        Object.keys(devicesToRegister).filter(
                          (id) =>
                            devicesToRegister[id].name != null &&
                            devicesToRegister[id].name.trim()
                        ).length
                      }
                      개)
                    </button>
                    {Object.keys(devicesToRegister).filter(
                      (id) =>
                        !devicesToRegister[id].name ||
                        !devicesToRegister[id].name.trim()
                    ).length > 0 && (
                      <p
                        style={{
                          marginTop: "0.5rem",
                          fontSize: "0.85rem",
                          color: "#e74c3c",
                        }}
                      >
                        ⚠️ 이름이 입력되지 않은 디바이스가 있습니다. 이름을
                        입력해주세요.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button
                onClick={handleCloseDeviceRegister}
                className="btn-secondary"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Hardware;
