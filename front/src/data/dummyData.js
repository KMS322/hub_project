// 더미 데이터

// 로그인된 사용자 정보
export const dummyUser = {
  email: 'hospital@example.com',
  password: 'password123',
  hospitalName: '서울 동물병원',
  hospitalAddress: '서울시 강남구 테헤란로 123',
  hospitalEmail: 'contact@hospital.com',
  hospitalPhone: '02-1234-5678',
  marketingAgree: true
}

// 허브 데이터
export const dummyHubs = [
  {
    id: 'hub1',
    name: '허브 1',
    wifiId: 'hospital_wifi',
    wifiPassword: '****',
    userEmail: 'hospital@example.com',
    connectedDevices: 3,
    status: 'connected'
  },
  {
    id: 'hub2',
    name: '허브 2',
    wifiId: 'hospital_wifi2',
    wifiPassword: '****',
    userEmail: 'hospital@example.com',
    connectedDevices: 2,
    status: 'connected'
  }
]

// 디바이스 데이터
export const dummyDevices = [
  {
    id: 'device1',
    name: '디바이스 1',
    macAddress: 'AA:BB:CC:DD:EE:01',
    hubId: 'hub1',
    hubName: '허브 1',
    battery: 85,
    status: 'connected',
    connectedPatient: {
      id: 'patient1',
      name: '멍멍이'
    },
    currentData: {
      heartRate: 120,
      spo2: 98,
      temperature: 38.5,
      battery: 85
    }
  },
  {
    id: 'device2',
    name: '디바이스 2',
    macAddress: 'AA:BB:CC:DD:EE:02',
    hubId: 'hub1',
    hubName: '허브 1',
    battery: 72,
    status: 'connected',
    connectedPatient: {
      id: 'patient2',
      name: '야옹이'
    },
    currentData: {
      heartRate: 140,
      spo2: 96,
      temperature: 39.2,
      battery: 72
    }
  },
  {
    id: 'device3',
    name: '디바이스 3',
    macAddress: 'AA:BB:CC:DD:EE:03',
    hubId: 'hub1',
    hubName: '허브 1',
    battery: 65,
    status: 'connected',
    connectedPatient: {
      id: 'patient4',
      name: '초코'
    },
    currentData: {
      heartRate: 110,
      spo2: 97,
      temperature: 38.8,
      battery: 65
    }
  },
  {
    id: 'device4',
    name: '디바이스 4',
    macAddress: 'AA:BB:CC:DD:EE:04',
    hubId: 'hub2',
    hubName: '허브 2',
    battery: 78,
    status: 'connected',
    connectedPatient: {
      id: 'patient5',
      name: '루이'
    },
    currentData: {
      heartRate: 130,
      spo2: 99,
      temperature: 38.2,
      battery: 78
    }
  }
]

// 환자 데이터
export const dummyPatients = [
  {
    id: 'patient1',
    name: '멍멍이',
    species: '개',
    breed: '골든 리트리버',
    birthDate: '2019-03-15',
    weight: 28.5,
    gender: '수컷',
    neutered: true,
    ownerName: '홍길동',
    ownerPhone: '010-1234-5678',
    admissionDate: '2024-01-15',
    dischargeDate: null,
    status: 'admitted',
    doctor: '김수의사',
    diagnosis: '호흡기 감염',
    medicalHistory: '2022년 5월 - 피부염 치료, 2023년 8월 - 예방접종',
    connectedDevice: {
      id: 'device1',
      name: '디바이스 1'
    }
  },
  {
    id: 'patient2',
    name: '야옹이',
    species: '고양이',
    breed: '페르시안',
    birthDate: '2020-07-22',
    weight: 4.2,
    gender: '암컷',
    neutered: true,
    ownerName: '김철수',
    ownerPhone: '010-2345-6789',
    admissionDate: '2024-01-16',
    dischargeDate: null,
    status: 'admitted',
    doctor: '이수의사',
    diagnosis: '심장 질환 의심',
    medicalHistory: '2021년 3월 - 중성화 수술, 2023년 11월 - 정기 검진',
    connectedDevice: {
      id: 'device2',
      name: '디바이스 2'
    }
  },
  {
    id: 'patient3',
    name: '뽀삐',
    species: '개',
    breed: '비글',
    birthDate: '2021-11-08',
    weight: 12.3,
    gender: '수컷',
    neutered: false,
    ownerName: '이영희',
    ownerPhone: '010-3456-7890',
    admissionDate: '2024-01-10',
    dischargeDate: '2024-01-14',
    status: 'discharged',
    doctor: '박수의사',
    diagnosis: '소화불량',
    medicalHistory: '2023년 2월 - 예방접종, 2023년 6월 - 정기 검진',
    connectedDevice: null
  },
  {
    id: 'patient4',
    name: '초코',
    species: '개',
    breed: '래브라도 리트리버',
    birthDate: '2020-05-10',
    weight: 32.0,
    gender: '수컷',
    neutered: true,
    ownerName: '최민수',
    ownerPhone: '010-4567-8901',
    admissionDate: '2024-01-17',
    dischargeDate: null,
    status: 'admitted',
    doctor: '김수의사',
    diagnosis: '관절염',
    medicalHistory: '2022년 9월 - 정기 검진, 2023년 4월 - 예방접종',
    connectedDevice: {
      id: 'device3',
      name: '디바이스 3'
    }
  },
  {
    id: 'patient5',
    name: '루이',
    species: '고양이',
    breed: '러시안 블루',
    birthDate: '2021-02-14',
    weight: 5.1,
    gender: '암컷',
    neutered: true,
    ownerName: '정수진',
    ownerPhone: '010-5678-9012',
    admissionDate: '2024-01-18',
    dischargeDate: null,
    status: 'admitted',
    doctor: '이수의사',
    diagnosis: '신장 질환',
    medicalHistory: '2022년 6월 - 중성화 수술, 2023년 9월 - 정기 검진',
    connectedDevice: {
      id: 'device4',
      name: '디바이스 4'
    }
  }
]

// CSV 기록 데이터
export const dummyRecords = [
  {
    id: 'record1',
    fileName: 'device1_patient1_20240115_120000.csv',
    deviceId: 'device1',
    deviceName: '디바이스 1',
    patientId: 'patient1',
    patientName: '멍멍이',
    startDate: '2024-01-15 12:00:00',
    endDate: '2024-01-15 18:30:00',
    fileSize: '2.5 MB',
    createdAt: '2024-01-15 18:30:00'
  },
  {
    id: 'record2',
    fileName: 'device2_patient2_20240116_090000.csv',
    deviceId: 'device2',
    deviceName: '디바이스 2',
    patientId: 'patient2',
    patientName: '야옹이',
    startDate: '2024-01-16 09:00:00',
    endDate: '2024-01-16 17:45:00',
    fileSize: '3.1 MB',
    createdAt: '2024-01-16 17:45:00'
  },
  {
    id: 'record3',
    fileName: 'device1_patient1_20240114_100000.csv',
    deviceId: 'device1',
    deviceName: '디바이스 1',
    patientId: 'patient1',
    patientName: '멍멍이',
    startDate: '2024-01-14 10:00:00',
    endDate: '2024-01-14 16:20:00',
    fileSize: '2.2 MB',
    createdAt: '2024-01-14 16:20:00'
  }
]

// 대시보드 통계
export const dummyDashboardStats = {
  totalHubs: 2,
  totalDevices: 4,
  connectedDevices: 4,
  availableDevices: 0
}

