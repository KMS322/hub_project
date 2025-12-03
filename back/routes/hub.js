const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');
const db = require('../models');

/**
 * 허브 목록 조회
 * GET /hub
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const hubs = await db.Hub.findAll({
      where: {
        user_email: req.user.email
      },
      include: [{
        model: db.Device,
        as: 'Devices',
        include: [{
          model: db.Pet,
          as: 'Pet'
        }]
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      count: hubs.length,
      data: hubs.map(hub => ({
        id: hub.address,
        address: hub.address,
        name: hub.name,
        user_email: hub.user_email,
        is_change: hub.is_change,
        connectedDevices: hub.Devices?.length || 0,
        devices: hub.Devices?.map(device => ({
          id: device.address,
          address: device.address,
          name: device.name,
          hub_address: device.hub_address,
          connectedPatient: device.Pet ? {
            id: device.Pet.id,
            name: device.Pet.name
          } : null
        })) || []
      }))
    });
  } catch (error) {
    console.error('[Hub API] Error:', error);
    res.status(500).json({
      success: false,
      message: '허브 목록 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * 허브 상세 조회
 * GET /hub/:hubAddress
 */
router.get('/:hubAddress', verifyToken, async (req, res) => {
  try {
    const { hubAddress } = req.params;

    const hub = await db.Hub.findOne({
      where: {
        address: hubAddress,
        user_email: req.user.email
      },
      include: [{
        model: db.Device,
        as: 'Devices'
      }]
    });

    if (!hub) {
      return res.status(404).json({
        success: false,
        message: '허브를 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      data: {
        id: hub.address,
        address: hub.address,
        name: hub.name,
        user_email: hub.user_email,
        is_change: hub.is_change,
        devices: hub.Devices || []
      }
    });
  } catch (error) {
    console.error('[Hub API] Error:', error);
    res.status(500).json({
      success: false,
      message: '허브 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * 허브 등록
 * POST /hub
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const { address, name } = req.body;

    if (!address || !name) {
      return res.status(400).json({
        success: false,
        message: 'address와 name은 필수입니다.'
      });
    }

    // 중복 확인
    const existingHub = await db.Hub.findByPk(address);
    if (existingHub) {
      return res.status(409).json({
        success: false,
        message: '이미 등록된 허브입니다.'
      });
    }

    const hub = await db.Hub.create({
      address,
      name,
      user_email: req.user.email,
      is_change: false
    });

    res.status(201).json({
      success: true,
      message: '허브가 등록되었습니다.',
      data: {
        id: hub.address,
        address: hub.address,
        name: hub.name,
        user_email: hub.user_email,
        is_change: hub.is_change
      }
    });
  } catch (error) {
    console.error('[Hub API] Error:', error);
    res.status(500).json({
      success: false,
      message: '허브 등록 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * 허브 수정
 * PUT /hub/:hubAddress
 */
router.put('/:hubAddress', verifyToken, async (req, res) => {
  try {
    const { hubAddress } = req.params;
    const { name } = req.body;

    const hub = await db.Hub.findOne({
      where: {
        address: hubAddress,
        user_email: req.user.email
      }
    });

    if (!hub) {
      return res.status(404).json({
        success: false,
        message: '허브를 찾을 수 없습니다.'
      });
    }

    if (name) {
      hub.name = name;
    }

    await hub.save();

    res.json({
      success: true,
      message: '허브 정보가 수정되었습니다.',
      data: {
        id: hub.address,
        address: hub.address,
        name: hub.name,
        user_email: hub.user_email,
        is_change: hub.is_change
      }
    });
  } catch (error) {
    console.error('[Hub API] Error:', error);
    res.status(500).json({
      success: false,
      message: '허브 수정 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * 허브 삭제
 * DELETE /hub/:hubAddress
 */
router.delete('/:hubAddress', verifyToken, async (req, res) => {
  try {
    const { hubAddress } = req.params;

    const hub = await db.Hub.findOne({
      where: {
        address: hubAddress,
        user_email: req.user.email
      }
    });

    if (!hub) {
      return res.status(404).json({
        success: false,
        message: '허브를 찾을 수 없습니다.'
      });
    }

    await hub.destroy();

    res.json({
      success: true,
      message: '허브가 삭제되었습니다.'
    });
  } catch (error) {
    console.error('[Hub API] Error:', error);
    res.status(500).json({
      success: false,
      message: '허브 삭제 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;

