const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');
const db = require('../models');
const { Op } = require('sequelize');

/**
 * 디바이스 목록 조회
 * GET /device
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const { hubAddress } = req.query;

    const where = {};
    
    // 사용자의 허브에 속한 디바이스만 조회
    const userHubs = await db.Hub.findAll({
      where: { user_email: req.user.email },
      attributes: ['address']
    });
    const hubAddresses = userHubs.map(h => h.address);

    if (hubAddress) {
      if (!hubAddresses.includes(hubAddress)) {
        return res.status(403).json({
          success: false,
          message: '접근 권한이 없습니다.'
        });
      }
      where.hub_address = hubAddress;
    } else {
      where.hub_address = { [Op.in]: hubAddresses };
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
        status: 'connected' // TODO: 실제 연결 상태 확인
      }))
    });
  } catch (error) {
    console.error('[Device API] Error:', error);
    res.status(500).json({
      success: false,
      message: '디바이스 목록 조회 중 오류가 발생했습니다.',
      error: error.message
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

    const device = await db.Device.findOne({
      where: { address: deviceAddress },
      include: [{
        model: db.Hub,
        as: 'Hub',
        where: { user_email: req.user.email },
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

    // 중복 확인
    const existingDevice = await db.Device.findByPk(address);
    if (existingDevice) {
      return res.status(409).json({
        success: false,
        message: '이미 등록된 디바이스입니다.'
      });
    }

    const device = await db.Device.create({
      address,
      name,
      hub_address: hubAddress
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

    const device = await db.Device.findOne({
      where: { address: deviceAddress },
      include: [{
        model: db.Hub,
        as: 'Hub',
        where: { user_email: req.user.email }
      }]
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

    const device = await db.Device.findOne({
      where: { address: deviceAddress },
      include: [{
        model: db.Hub,
        as: 'Hub',
        where: { user_email: req.user.email }
      }]
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: '디바이스를 찾을 수 없습니다.'
      });
    }

    await device.destroy();

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

    const device = await db.Device.findOne({
      where: { address: deviceAddress },
      include: [{
        model: db.Hub,
        as: 'Hub',
        where: { user_email: req.user.email }
      }]
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
      // 해제
      const pet = await db.Pet.findOne({
        where: { device_address: deviceAddress }
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

