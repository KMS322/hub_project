const bcrypt = require("bcryptjs");
const db = require("../models");

const initializeDatabase = async () => {
  try {
    console.log("🔄 Initializing dummy data...");

    // User 더미 데이터 (role 기본값은 모델에서 'user')
    const users = [
      {
        email: "creamoff2021@gmail.com",
        password: await bcrypt.hash("Dlqdjqhro1!", 10),
        name: "시스템 관리자",
        postcode: "00000",
        address: "관리자",
        detail_address: "-",
        phone: "000-0000-0000",
        role: "admin",
      },
      {
        email: "a@a.com",
        password: await bcrypt.hash("a", 10),
        name: "유저1111",
        postcode: "12345",
        address: "서울시 강남구",
        detail_address: "101호",
        phone: "010-1234-5678",
        role: "user",
      },
      {
        email: "b@b.com",
        password: await bcrypt.hash("b", 10),
        name: "유저2222",
        postcode: "54321",
        address: "서울시 서초구",
        detail_address: "201호",
        phone: "010-9876-5432",
        role: "user",
      },
      {
        email: "c@c.com",
        password: await bcrypt.hash("c", 10),
        name: "유저3333",
        postcode: "54321",
        address: "서울시 서초구",
        detail_address: "201호",
        phone: "010-9876-5432",
        role: "user",
      },
    ];

    for (const userData of users) {
      const [user] = await db.User.findOrCreate({
        where: { email: userData.email },
        defaults: userData,
      });
      if (user && userData.role === 'admin' && user.role !== 'admin') {
        await user.update({ role: 'admin' });
      }
    }

    // Hub 더미 데이터
    // const hubs = [
    //   {
    //     address: "hub_001",
    //     name: "테스트 허브 1",
    //     user_email: "test@example.com",
    //     is_change: false,
    //   },
    //   {
    //     address: "hub_002",
    //     name: "테스트 허브 2",
    //     user_email: "admin@example.com",
    //     is_change: false,
    //   },
    // ];

    // for (const hubData of hubs) {
    //   await db.Hub.findOrCreate({
    //     where: { address: hubData.address },
    //     defaults: hubData,
    //   });
    // }

    // // Device 더미 데이터
    // const devices = [
    //   {
    //     address: "device_001",
    //     name: "디바이스 1",
    //     hub_address: "hub_001",
    //   },
    //   {
    //     address: "device_002",
    //     name: "디바이스 2",
    //     hub_address: "hub_001",
    //   },
    //   {
    //     address: "device_003",
    //     name: "디바이스 3",
    //     hub_address: "hub_002",
    //   },
    // ];

    // for (const deviceData of devices) {
    //   await db.Device.findOrCreate({
    //     where: { address: deviceData.address },
    //     defaults: deviceData,
    //   });
    // }

    // Pet 더미 데이터
    const pets = [
      {
        name: "뽀삐",
        species: "개",
        breed: "포메라니안",
        weight: "3.5",
        gender: "수컷",
        neutering: "여",
        birthDate: "2020-05-15",
        admissionDate: "2024-01-10",
        veterinarian: "김수의사",
        diagnosis: "건강함",
        medicalHistory: "예방접종 완료",
        user_email: "a@a.com",
        device_address: null,
        state: "입원중",
      },
      {
        name: "나비",
        species: "고양이",
        breed: "코리안숏헤어",
        weight: "4.2",
        gender: "암컷",
        neutering: "여",
        birthDate: "2021-03-20",
        admissionDate: "2024-02-15",
        veterinarian: "이수의사",
        diagnosis: "건강함",
        medicalHistory: "정기검진 완료",
        user_email: "b@b.com",
        device_address: null,
        state: "퇴원",
      },
    ];

    for (const petData of pets) {
      // device_address가 빈 문자열이면 NULL로 변환 (외래 키 제약 조건 위반 방지)
      const petDataToCreate = {
        ...petData,
        device_address: petData.device_address && petData.device_address.trim() !== '' 
          ? petData.device_address 
          : null
      };
      
      await db.Pet.findOrCreate({
        where: {
          name: petData.name,
          user_email: petData.user_email,
        },
        defaults: petDataToCreate,
      });
    }

    console.log("✅ Dummy data initialized successfully");
  } catch (error) {
    console.error("❌ Error initializing dummy data:", error);
  }
};

module.exports = initializeDatabase;
