const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');
const fs = require('fs').promises;
const path = require('path');
const csvWriter = require('../utils/csvWriter');
const db = require('../models');

/**
 * CSV 파일 목록 조회 (HRV 분석용)
 * GET /api/hrv/files
 */
router.get('/files', verifyToken, async (req, res) => {
  try {
    const userEmail = req.user.email;
    // CSV 루트 경로 생성
    const safeEmail = csvWriter.sanitizeForPath(userEmail);
    const csvRoot = path.join(process.cwd(), csvWriter.baseDir, safeEmail);
    
    // CSV 파일 목록 수집
    const files = [];
    
    try {
      const userDir = await fs.readdir(csvRoot, { withFileTypes: true });
      
      for (const dateDir of userDir) {
        if (!dateDir.isDirectory()) continue;
        
        const datePath = path.join(csvRoot, dateDir.name);
        const deviceDirs = await fs.readdir(datePath, { withFileTypes: true });
        
        for (const deviceDir of deviceDirs) {
          if (!deviceDir.isDirectory()) continue;
          
          const devicePath = path.join(datePath, deviceDir.name);
          const petDirs = await fs.readdir(devicePath, { withFileTypes: true });
          
          for (const petDir of petDirs) {
            if (!petDir.isDirectory()) continue;
            
            const petPath = path.join(devicePath, petDir.name);
            const csvFiles = await fs.readdir(petPath);
            
            for (const csvFile of csvFiles) {
              if (!csvFile.endsWith('.csv')) continue;
              
              const filePath = path.join(petPath, csvFile);
              const stats = await fs.stat(filePath);
              
              // 파일명에서 정보 추출: device_mac_pet_name_time.csv
              const nameParts = csvFile.replace('.csv', '').split('_');
              const deviceMac = nameParts[0];
              const petName = nameParts.slice(1, -1).join('_');
              const time = nameParts[nameParts.length - 1];
              
              // 디바이스 MAC 주소 복원 (deviceDir.name은 _로 변환된 상태)
              const deviceAddress = deviceMac.replace(/_/g, ':');
              
              // 디바이스 정보 조회
              const device = await db.Device.findOne({
                where: {
                  address: deviceAddress,
                  user_email: userEmail
                }
              });
              
              files.push({
                fileName: csvFile,
                relativePath: path.relative(csvRoot, filePath).replace(/\\/g, '/'),
                deviceAddress: deviceAddress,
                deviceName: device?.name || deviceMac.replace(/_/g, ':'),
                petName: petName,
                date: dateDir.name,
                time: time,
                size: stats.size,
                mtime: stats.mtime.toISOString()
              });
            }
          }
        }
      }
    } catch (error) {
      // 디렉토리가 없으면 빈 배열 반환
      if (error.code === 'ENOENT') {
        return res.json({
          success: true,
          data: []
        });
      }
      throw error;
    }
    
    // 날짜와 시간 기준으로 정렬 (최신순)
    files.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return b.time.localeCompare(a.time);
    });
    
    res.json({
      success: true,
      data: files
    });
  } catch (error) {
    console.error('[HRV API] 파일 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '파일 목록 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * CSV 파일 다운로드 및 내용 반환
 * POST /api/hrv/download
 */
router.post('/download', verifyToken, async (req, res) => {
  try {
    const { fileName, relativePath } = req.body;
    const userEmail = req.user.email;
    
    if (!fileName && !relativePath) {
      return res.status(400).json({
        success: false,
        message: 'fileName 또는 relativePath가 필요합니다.'
      });
    }
    
    // CSV 루트 경로 생성
    const safeEmail = csvWriter.sanitizeForPath(userEmail);
    const csvRoot = path.join(process.cwd(), csvWriter.baseDir, safeEmail);
    let filePath;
    
    if (relativePath) {
      filePath = path.join(csvRoot, relativePath);
    } else {
      // fileName으로 파일 찾기
      filePath = await findCsvFile(csvRoot, fileName);
    }
    
    // 파일 존재 확인
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: '파일을 찾을 수 없습니다.'
      });
    }
    
    // 파일 읽기
    const fileContent = await fs.readFile(filePath, 'utf-8');
    
    if (!fileContent || fileContent.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: '파일이 비어있습니다.'
      });
    }
    
    res.json({
      success: true,
      data: {
        fileName: path.basename(filePath),
        content: fileContent
      }
    });
  } catch (error) {
    console.error('[HRV API] 파일 다운로드 오류:', error);
    
    // 파일을 찾을 수 없는 경우
    if (error.code === 'ENOENT') {
      return res.status(404).json({
        success: false,
        message: '파일을 찾을 수 없습니다.',
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: '파일 다운로드 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * 파일 검색 헬퍼 함수
 */
async function findCsvFile(rootDir, fileName) {
  try {
    const entries = await fs.readdir(rootDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(rootDir, entry.name);
      
      if (entry.isDirectory()) {
        const found = await findCsvFile(fullPath, fileName);
        if (found) return found;
      } else if (entry.name === fileName) {
        return fullPath;
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * 실시간 HRV 분석을 위한 디바이스 목록 조회
 * GET /api/hrv/devices
 */
router.get('/devices', verifyToken, async (req, res) => {
  try {
    const devices = await db.Device.findAll({
      where: { user_email: req.user.email },
      include: [{
        model: db.Pet,
        as: 'Pet',
        attributes: ['id', 'name']
      }],
      order: [['createdAt', 'DESC']]
    });
    
    res.json({
      success: true,
      data: devices.map(device => ({
        address: device.address,
        name: device.name,
        pet: device.Pet ? {
          id: device.Pet.id,
          name: device.Pet.name
        } : null
      }))
    });
  } catch (error) {
    console.error('[HRV API] 디바이스 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '디바이스 목록 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;

