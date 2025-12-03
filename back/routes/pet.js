const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');
const db = require('../models');

/**
 * 환자 목록 조회
 * GET /pet
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const pets = await db.Pet.findAll({
      where: {
        user_email: req.user.email
      },
      include: [{
        model: db.Device,
        as: 'Device',
        attributes: ['address', 'name'],
        include: [{
          model: db.Hub,
          as: 'Hub',
          attributes: ['address', 'name']
        }]
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      count: pets.length,
      data: pets.map(pet => ({
        id: pet.id,
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        weight: pet.weight,
        gender: pet.gender,
        neutering: pet.neutering,
        birthDate: pet.birthDate,
        admissionDate: pet.admissionDate,
        veterinarian: pet.veterinarian,
        diagnosis: pet.diagnosis,
        medicalHistory: pet.medicalHistory,
        user_email: pet.user_email,
        device_address: pet.device_address,
        connectedDevice: pet.Device ? {
          id: pet.Device.address,
          name: pet.Device.name,
          hubName: pet.Device.Hub?.name || ''
        } : null,
        status: pet.device_address ? 'admitted' : 'discharged'
      }))
    });
  } catch (error) {
    console.error('[Pet API] Error:', error);
    res.status(500).json({
      success: false,
      message: '환자 목록 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * 환자 상세 조회
 * GET /pet/:petId
 */
router.get('/:petId', verifyToken, async (req, res) => {
  try {
    const { petId } = req.params;

    const pet = await db.Pet.findOne({
      where: {
        id: petId,
        user_email: req.user.email
      },
      include: [{
        model: db.Device,
        as: 'Device',
        include: [{
          model: db.Hub,
          as: 'Hub'
        }]
      }]
    });

    if (!pet) {
      return res.status(404).json({
        success: false,
        message: '환자를 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      data: {
        id: pet.id,
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        weight: pet.weight,
        gender: pet.gender,
        neutering: pet.neutering,
        birthDate: pet.birthDate,
        admissionDate: pet.admissionDate,
        veterinarian: pet.veterinarian,
        diagnosis: pet.diagnosis,
        medicalHistory: pet.medicalHistory,
        user_email: pet.user_email,
        device_address: pet.device_address,
        connectedDevice: pet.Device || null
      }
    });
  } catch (error) {
    console.error('[Pet API] Error:', error);
    res.status(500).json({
      success: false,
      message: '환자 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * 환자 등록
 * POST /pet
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const {
      name,
      species,
      breed,
      weight,
      gender,
      neutering,
      birthDate,
      admissionDate,
      veterinarian,
      diagnosis,
      medicalHistory,
      device_address
    } = req.body;

    if (!name || !species || !breed || !weight || !gender || !neutering || 
        !birthDate || !admissionDate || !veterinarian || !diagnosis || !medicalHistory) {
      return res.status(400).json({
        success: false,
        message: '필수 항목을 모두 입력해주세요.'
      });
    }

    // device_address가 있으면 소유권 확인
    if (device_address) {
      const device = await db.Device.findOne({
        where: { address: device_address },
        include: [{
          model: db.Hub,
          as: 'Hub',
          where: { user_email: req.user.email }
        }]
      });

      if (!device) {
        return res.status(404).json({
          success: false,
          message: '디바이스를 찾을 수 없거나 접근 권한이 없습니다.'
        });
      }
    }

    const pet = await db.Pet.create({
      name,
      species,
      breed,
      weight,
      gender,
      neutering,
      birthDate,
      admissionDate,
      veterinarian,
      diagnosis,
      medicalHistory,
      user_email: req.user.email,
      device_address: device_address || null
    });

    res.status(201).json({
      success: true,
      message: '환자가 등록되었습니다.',
      data: {
        id: pet.id,
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        weight: pet.weight,
        gender: pet.gender,
        neutering: pet.neutering,
        birthDate: pet.birthDate,
        admissionDate: pet.admissionDate,
        veterinarian: pet.veterinarian,
        diagnosis: pet.diagnosis,
        medicalHistory: pet.medicalHistory,
        device_address: pet.device_address
      }
    });
  } catch (error) {
    console.error('[Pet API] Error:', error);
    res.status(500).json({
      success: false,
      message: '환자 등록 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * 환자 수정
 * PUT /pet/:petId
 */
router.put('/:petId', verifyToken, async (req, res) => {
  try {
    const { petId } = req.params;
    const updateData = req.body;

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

    // device_address 변경 시 소유권 확인
    if (updateData.device_address !== undefined) {
      if (updateData.device_address) {
        const device = await db.Device.findOne({
          where: { address: updateData.device_address },
          include: [{
            model: db.Hub,
            as: 'Hub',
            where: { user_email: req.user.email }
          }]
        });

        if (!device) {
          return res.status(404).json({
            success: false,
            message: '디바이스를 찾을 수 없거나 접근 권한이 없습니다.'
          });
        }
      }
    }

    // 업데이트 가능한 필드만 업데이트
    const allowedFields = [
      'name', 'species', 'breed', 'weight', 'gender', 'neutering',
      'birthDate', 'admissionDate', 'veterinarian', 'diagnosis',
      'medicalHistory', 'device_address'
    ];

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        pet[field] = updateData[field];
      }
    });

    await pet.save();

    res.json({
      success: true,
      message: '환자 정보가 수정되었습니다.',
      data: {
        id: pet.id,
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        weight: pet.weight,
        gender: pet.gender,
        neutering: pet.neutering,
        birthDate: pet.birthDate,
        admissionDate: pet.admissionDate,
        veterinarian: pet.veterinarian,
        diagnosis: pet.diagnosis,
        medicalHistory: pet.medicalHistory,
        device_address: pet.device_address
      }
    });
  } catch (error) {
    console.error('[Pet API] Error:', error);
    res.status(500).json({
      success: false,
      message: '환자 수정 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * 환자 삭제
 * DELETE /pet/:petId
 */
router.delete('/:petId', verifyToken, async (req, res) => {
  try {
    const { petId } = req.params;

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

    await pet.destroy();

    res.json({
      success: true,
      message: '환자가 삭제되었습니다.'
    });
  } catch (error) {
    console.error('[Pet API] Error:', error);
    res.status(500).json({
      success: false,
      message: '환자 삭제 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;

