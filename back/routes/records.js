const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');
const fs = require('fs');
const path = require('path');
const db = require('../models');

/**
 * CSV 파일 목록 조회
 * GET /records?deviceAddress=&startDate=&endDate=
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const { deviceAddress, startDate, endDate } = req.query;
    const csvDir = path.join(process.cwd(), 'data', 'csv');
    
    if (!fs.existsSync(csvDir)) {
      return res.json({
        success: true,
        count: 0,
        data: []
      });
    }

    const files = fs.readdirSync(csvDir);
    const csvFiles = files.filter(f => f.endsWith('.csv'));

    const records = [];

    for (const file of csvFiles) {
      // 파일명 형식: {device_mac_address}_YYYY-MM-DD.csv
      const match = file.match(/^(.+)_(\d{4}-\d{2}-\d{2})\.csv$/);
      if (!match) continue;

      const fileDeviceAddress = match[1].replace(/-/g, ':');
      const fileDate = match[2];

      // 필터링
      if (deviceAddress && fileDeviceAddress !== deviceAddress) continue;
      if (startDate && fileDate < startDate) continue;
      if (endDate && fileDate > endDate) continue;

      // 디바이스 소유권 확인
      const device = await db.Device.findOne({
        where: { address: fileDeviceAddress },
        include: [{
          model: db.Hub,
          as: 'Hub',
          where: { user_email: req.user.email }
        }]
      });

      if (!device) continue;

      const filePath = path.join(csvDir, file);
      const stats = fs.statSync(filePath);
      
      // 파일 내용 읽어서 라인 수 확인
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.trim().split('\n');
      const dataLines = lines.length - 1; // 헤더 제외

      // 첫 번째와 마지막 데이터 라인에서 타임스탬프 추출
      let startTime = null;
      let endTime = null;
      
      if (dataLines > 0) {
        const firstDataLine = lines[1];
        const lastDataLine = lines[lines.length - 1];
        const firstValues = firstDataLine.split(',');
        const lastValues = lastDataLine.split(',');
        
        if (firstValues.length > 1) {
          startTime = new Date(parseInt(firstValues[1])).toISOString();
        }
        if (lastValues.length > 1) {
          endTime = new Date(parseInt(lastValues[1])).toISOString();
        }
      }

      records.push({
        id: file,
        fileName: file,
        deviceAddress: fileDeviceAddress,
        deviceName: device.name,
        date: fileDate,
        startTime,
        endTime,
        fileSize: formatFileSize(stats.size),
        recordCount: dataLines,
        createdAt: stats.birthtime.toISOString()
      });
    }

    // 날짜순 정렬 (최신순)
    records.sort((a, b) => {
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date);
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json({
      success: true,
      count: records.length,
      data: records
    });
  } catch (error) {
    console.error('[Records API] Error:', error);
    res.status(500).json({
      success: false,
      message: '기록 목록 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * CSV 파일 다운로드
 * GET /records/download/:fileName
 */
router.get('/download/:fileName', verifyToken, async (req, res) => {
  try {
    const { fileName } = req.params;
    
    // 파일명 검증 (보안)
    if (!fileName.match(/^[A-Za-z0-9:_-]+_\d{4}-\d{2}-\d{2}\.csv$/)) {
      return res.status(400).json({
        success: false,
        message: '잘못된 파일명입니다.'
      });
    }

    const csvDir = path.join(process.cwd(), 'data', 'csv');
    const filePath = path.join(csvDir, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: '파일을 찾을 수 없습니다.'
      });
    }

    // 디바이스 소유권 확인
    const match = fileName.match(/^(.+)_\d{4}-\d{2}-\d{2}\.csv$/);
    if (match) {
      const deviceAddress = match[1].replace(/-/g, ':');
      const device = await db.Device.findOne({
        where: { address: deviceAddress },
        include: [{
          model: db.Hub,
          as: 'Hub',
          where: { user_email: req.user.email }
        }]
      });

      if (!device) {
        return res.status(403).json({
          success: false,
          message: '접근 권한이 없습니다.'
        });
      }
    }

    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('[Records API] Download error:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: '파일 다운로드 중 오류가 발생했습니다.'
          });
        }
      }
    });
  } catch (error) {
    console.error('[Records API] Error:', error);
    res.status(500).json({
      success: false,
      message: '파일 다운로드 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * CSV 파일 삭제
 * DELETE /records/:fileName
 */
router.delete('/:fileName', verifyToken, async (req, res) => {
  try {
    const { fileName } = req.params;
    
    // 파일명 검증
    if (!fileName.match(/^[A-Za-z0-9:_-]+_\d{4}-\d{2}-\d{2}\.csv$/)) {
      return res.status(400).json({
        success: false,
        message: '잘못된 파일명입니다.'
      });
    }

    const csvDir = path.join(process.cwd(), 'data', 'csv');
    const filePath = path.join(csvDir, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: '파일을 찾을 수 없습니다.'
      });
    }

    // 디바이스 소유권 확인
    const match = fileName.match(/^(.+)_\d{4}-\d{2}-\d{2}\.csv$/);
    if (match) {
      const deviceAddress = match[1].replace(/-/g, ':');
      const device = await db.Device.findOne({
        where: { address: deviceAddress },
        include: [{
          model: db.Hub,
          as: 'Hub',
          where: { user_email: req.user.email }
        }]
      });

      if (!device) {
        return res.status(403).json({
          success: false,
          message: '접근 권한이 없습니다.'
        });
      }
    }

    fs.unlinkSync(filePath);

    res.json({
      success: true,
      message: '파일이 삭제되었습니다.'
    });
  } catch (error) {
    console.error('[Records API] Error:', error);
    res.status(500).json({
      success: false,
      message: '파일 삭제 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * 파일 크기 포맷팅 헬퍼 함수
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

module.exports = router;

