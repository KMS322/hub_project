const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');
const db = require('../models');
const { Op } = require('sequelize');
const { validateMacAddress } = require('../utils/validation');

/**
 * 디바이스 목록 조회
 * GET /device
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const { hubAddress } = req.query;

    // 사용자 이메일 기준으로 디바이스 조회 (user_email 필드 사용)
    const where = {
      user_email: req.user.email
    };
    
    // hubAddress 파라미터가 있으면 해당 허브의 디바이스만 조회 (단, 사용자의 허브인지 확인)
    if (hubAddress) {
      // 허브 소유권 확인
      const hub = await db.Hub.findOne({
        where: {
          address: hubAddress,
          user_email: req.user.email
        }
      });

      if (!hub) {
        return res.status(403).json({
          success: false,
          message: '접근 권한이 없습니다.'
        });
      }
      where.hub_address = hubAddress;
    }

    const devices = await db.Device.findAll({
      where,
      include: [{
        model: db.Hub,
        as: 'Hub',
        attributes: ['address', 'name']
      }, {
        model: db.Pet,
        as: 'Pet',
        attributes: ['id', 'name', 'species', 'breed']
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      count: devices.length,
      data: devices.map(device => ({
        id: device.address,
        address: device.address,
        name: device.name,
        hub_address: device.hub_address,
        hubName: device.Hub?.name || '',
        connectedPatient: device.Pet ? {
          id: device.Pet.id,
          name: device.Pet.name,
          species: device.Pet.species,
          breed: device.Pet.breed
        } : null,
        status: 'connected', // TODO: 실제 연결 상태 확인
        updatedAt: device.updatedAt // 마지막 활동 시간
      }))
    });
  } catch (error) {
    console.error('[Device API] Error:', error);
    res.status(500).json({
      success: false,
      message: '디바이스 목록 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * 디바이스 상세 조회
 * GET /device/:deviceAddress
 */
router.get('/:deviceAddress', verifyToken, async (req, res) => {
  try {
    const { deviceAddress } = req.params;

    // MAC 주소 형식 검증
    const macValidation = validateMacAddress(deviceAddress);
    if (!macValidation.valid) {
      return res.status(400).json({
        success: false,
        message: macValidation.message,
      });
    }

    const device = await db.Device.findOne({
      where: { 
        address: deviceAddress,
        user_email: req.user.email
      },
      include: [{
        model: db.Hub,
        as: 'Hub',
        attributes: ['address', 'name']
      }, {
        model: db.Pet,
        as: 'Pet'
      }]
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: '디바이스를 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      data: {
        id: device.address,
        address: device.address,
        name: device.name,
        hub_address: device.hub_address,
        hubName: device.Hub?.name || '',
        connectedPatient: device.Pet || null
      }
    });
  } catch (error) {
    console.error('[Device API] Error:', error);
    res.status(500).json({
      success: false,
      message: '디바이스 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * 디바이스 등록
 * POST /device
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const { address, name, hubAddress } = req.body;

    if (!address || !name || !hubAddress) {
      return res.status(400).json({
        success: false,
        message: 'address, name, hubAddress는 필수입니다.'
      });
    }

    // 허브 소유권 확인
    const hub = await db.Hub.findOne({
      where: {
        address: hubAddress,
        user_email: req.user.email
      }
    });

    if (!hub) {
      return res.status(404).json({
        success: false,
        message: '허브를 찾을 수 없거나 접근 권한이 없습니다.'
      });
    }

    // 중복 확인: 같은 MAC 주소이지만 다른 사용자의 디바이스인 경우 재등록 허용
    const existingDevice = await db.Device.findByPk(address);
    if (existingDevice) {
      // 같은 사용자의 디바이스인 경우 중복 오류
      if (existingDevice.user_email === req.user.email) {
        return res.status(409).json({
          success: false,
          message: '이미 등록된 디바이스입니다.'
        });
      }
      // 다른 사용자의 디바이스인 경우 기존 디바이스 정보 업데이트 (재등록)
      existingDevice.name = name && name.trim() ? name.trim() : address.slice(-5);
      existingDevice.hub_address = hubAddress;
      existingDevice.user_email = req.user.email;
      await existingDevice.save();
      
      return res.status(200).json({
        success: true,
        message: '디바이스가 재등록되었습니다.',
        data: {
          id: existingDevice.address,
          address: existingDevice.address,
          name: existingDevice.name,
          hub_address: existingDevice.hub_address
        }
      });
    }

    // 이름이 없거나 비어있으면 MAC 주소의 tailing(마지막 5글자)을 기본값으로 사용
    const deviceName = name && name.trim() ? name.trim() : address.slice(-5);

    const device = await db.Device.create({
      address,
      name: deviceName,
      hub_address: hubAddress,
      user_email: req.user.email
    });

    res.status(201).json({
      success: true,
      message: '디바이스가 등록되었습니다.',
      data: {
        id: device.address,
        address: device.address,
        name: device.name,
        hub_address: device.hub_address
      }
    });
  } catch (error) {
    console.error('[Device API] Error:', error);
    res.status(500).json({
      success: false,
      message: '디바이스 등록 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * 디바이스 수정
 * PUT /device/:deviceAddress
 */
router.put('/:deviceAddress', verifyToken, async (req, res) => {
  try {
    const { deviceAddress } = req.params;
    const { name } = req.body;

    // MAC 주소 형식 검증
    const macValidation = validateMacAddress(deviceAddress);
    if (!macValidation.valid) {
      return res.status(400).json({
        success: false,
        message: macValidation.message,
      });
    }

    const device = await db.Device.findOne({
      where: { 
        address: deviceAddress,
        user_email: req.user.email
      }
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: '디바이스를 찾을 수 없습니다.'
      });
    }

    if (name) {
      device.name = name;
      await device.save();
    }

    res.json({
      success: true,
      message: '디바이스 정보가 수정되었습니다.',
      data: {
        id: device.address,
        address: device.address,
        name: device.name,
        hub_address: device.hub_address
      }
    });
  } catch (error) {
    console.error('[Device API] Error:', error);
    res.status(500).json({
      success: false,
      message: '디바이스 수정 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * 디바이스 삭제
 * DELETE /device/:deviceAddress
 */
router.delete('/:deviceAddress', verifyToken, async (req, res) => {
  try {
    const { deviceAddress } = req.params;

    // MAC 주소 형식 검증
    const macValidation = validateMacAddress(deviceAddress);
    if (!macValidation.valid) {
      return res.status(400).json({
        success: false,
        message: macValidation.message,
      });
    }

    const device = await db.Device.findOne({
      where: { address: deviceAddress },
      include: [{
        model: db.Hub,
        as: 'Hub',
        where: { user_email: req.user.email }
      }, {
        model: db.Pet,
        as: 'Pet'
      }]
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: '디바이스를 찾을 수 없습니다.'
      });
    }

    // ✅ 디바이스 삭제 전에 연결된 펫의 device_address를 null로 설정
    // ✅ 디바이스 삭제 전에 관련된 Telemetries 레코드 먼저 삭제 (외래 키 제약 조건 해결)
    // 트랜잭션으로 처리하여 데이터 일관성 보장
    await db.sequelize.transaction(async (t) => {
      // 연결된 펫이 있으면 device_address를 null로 설정
      if (device.Pet) {
        device.Pet.device_address = null;
        await device.Pet.save({ transaction: t });
      }

      // ✅ 디바이스 삭제 전에 관련된 Telemetries 레코드 먼저 삭제
      const deletedTelemetries = await db.Telemetry.destroy({
        where: {
          device_address: deviceAddress
        },
        transaction: t,
      });
      console.log(`[Device API] ✅ Deleted ${deletedTelemetries} telemetries for device ${deviceAddress}`);

      // 디바이스 삭제
      await device.destroy({ transaction: t });
    });

    res.json({
      success: true,
      message: '디바이스가 삭제되었습니다.'
    });
  } catch (error) {
    console.error('[Device API] Error:', error);
    res.status(500).json({
      success: false,
      message: '디바이스 삭제 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * 디바이스에 환자 연결/해제
 * PUT /device/:deviceAddress/patient
 */
router.put('/:deviceAddress/patient', verifyToken, async (req, res) => {
  try {
    const { deviceAddress } = req.params;
    const { petId } = req.body; // null이면 해제

    // MAC 주소 형식 검증
    const macValidation = validateMacAddress(deviceAddress);
    if (!macValidation.valid) {
      return res.status(400).json({
        success: false,
        message: macValidation.message,
      });
    }

    const device = await db.Device.findOne({
      where: { 
        address: deviceAddress,
        user_email: req.user.email
      }
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: '디바이스를 찾을 수 없습니다.'
      });
    }

    // 환자 소유권 확인
    if (petId) {
      const pet = await db.Pet.findOne({
        where: {
          id: petId,
          user_email: req.user.email
        }
      });

      if (!pet) {
        return res.status(404).json({
          success: false,
          message: '환자를 찾을 수 없습니다.'
        });
      }

      pet.device_address = deviceAddress;
      await pet.save();
    } else {
      // 해제: 같은 사용자의 환자만 해제
      const pet = await db.Pet.findOne({
        where: { 
          device_address: deviceAddress,
          user_email: req.user.email
        }
      });
      if (pet) {
        pet.device_address = null;
        await pet.save();
      }
    }

    res.json({
      success: true,
      message: petId ? '환자가 연결되었습니다.' : '환자 연결이 해제되었습니다.'
    });
  } catch (error) {
    console.error('[Device API] Error:', error);
    res.status(500).json({
      success: false,
      message: '환자 연결 처리 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;

