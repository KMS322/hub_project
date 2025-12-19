const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const { verifyToken } = require('../middlewares/auth');
const csvWriter = require('../utils/csvWriter');

// 공통: 사용자별 CSV 루트 경로
function getUserCsvRoot(userEmail) {
  // 이메일은 그대로 사용 (sanitize하지 않음)
  const safeEmail = csvWriter.sanitizeForPath(userEmail);
  return path.join(process.cwd(), csvWriter.baseDir, safeEmail);
}

// 디렉터리 존재 여부 체크
function existsDir(dirPath) {
  try {
    const stat = fs.statSync(dirPath);
    return stat.isDirectory();
  } catch (e) {
    return false;
  }
}

// 파일 존재 여부 체크
function existsFile(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile();
  } catch (e) {
    return false;
  }
}

/**
 * 디바이스별 CSV 목록 조회
 * GET /api/csv/device/:deviceAddress
 * - user_email/date/device_mac/pet_name/device_mac-HH:mm:ss:SSS.csv
 */
router.get('/device/:deviceAddress', verifyToken, async (req, res) => {
  try {
    const { deviceAddress } = req.params;
    const root = getUserCsvRoot(req.user.email);

    if (!existsDir(root)) {
      return res.json({ success: true, files: [] });
    }

    // MAC 주소의 :를 _로 변환 (Windows 호환)
    const safeDevice = deviceAddress.replace(/:/g, '_');
    const dates = fs.readdirSync(root);
    const results = [];

    for (const date of dates) {
      const dateDir = path.join(root, date);
      if (!existsDir(dateDir)) continue;

      const deviceDir = path.join(dateDir, safeDevice);
      if (!existsDir(deviceDir)) continue;

      const pets = fs.readdirSync(deviceDir);
      for (const petName of pets) {
        const petDir = path.join(deviceDir, petName);
        if (!existsDir(petDir)) continue;

        const files = fs.readdirSync(petDir).filter(f => f.endsWith('.csv'));
        for (const file of files) {
          const fullPath = path.join(petDir, file);
          const stat = fs.statSync(fullPath);
          results.push({
            date,
            device: safeDevice,
            pet: petName,
            filename: file,
            size: stat.size,
            mtime: stat.mtime,
            // 사용자 루트 기준 상대 경로 (다운로드에 사용)
            relativePath: path.relative(root, fullPath),
          });
        }
      }
    }

    res.json({ success: true, files: results });
  } catch (error) {
    console.error('[CSV API] Error in /device/:deviceAddress:', error);
    res.status(500).json({
      success: false,
      message: '디바이스별 CSV 목록을 가져오는 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

/**
 * 환자(펫)별 CSV 목록 조회
 * GET /api/csv/pet/:petName
 * - user_email/date/device_mac/pet_name/device_mac-HH:mm:ss:SSS.csv
 */
router.get('/pet/:petName', verifyToken, async (req, res) => {
  try {
    const { petName } = req.params;
    const root = getUserCsvRoot(req.user.email);

    if (!existsDir(root)) {
      return res.json({ success: true, files: [] });
    }

    const safePet = csvWriter.sanitizeForPath(petName);
    const dates = fs.readdirSync(root);
    const results = [];

    for (const date of dates) {
      const dateDir = path.join(root, date);
      if (!existsDir(dateDir)) continue;

      const devices = fs.readdirSync(dateDir);
      for (const deviceDirName of devices) {
        const deviceDir = path.join(dateDir, deviceDirName);
        if (!existsDir(deviceDir)) continue;

        const petDir = path.join(deviceDir, safePet);
        if (!existsDir(petDir)) continue;

        const files = fs.readdirSync(petDir).filter(f => f.endsWith('.csv'));
        for (const file of files) {
          const fullPath = path.join(petDir, file);
          const stat = fs.statSync(fullPath);
          results.push({
            date,
            device: deviceDirName,
            pet: safePet,
            filename: file,
            size: stat.size,
            mtime: stat.mtime,
            relativePath: path.relative(root, fullPath),
          });
        }
      }
    }

    res.json({ success: true, files: results });
  } catch (error) {
    console.error('[CSV API] Error in /pet/:petName:', error);
    res.status(500).json({
      success: false,
      message: '환자별 CSV 목록을 가져오는 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

// 사용자 전체 CSV 목록 조회
// GET /api/csv/all
router.get('/all', verifyToken, async (req, res) => {
  try {
    const root = getUserCsvRoot(req.user.email);

    if (!existsDir(root)) {
      return res.json({ success: true, files: [] });
    }

    const dates = fs.readdirSync(root);
    const results = [];

    for (const date of dates) {
      const dateDir = path.join(root, date);
      if (!existsDir(dateDir)) continue;

      const devices = fs.readdirSync(dateDir);
      for (const deviceDirName of devices) {
        const deviceDir = path.join(dateDir, deviceDirName);
        if (!existsDir(deviceDir)) continue;

        const pets = fs.readdirSync(deviceDir);
        for (const petName of pets) {
          const petDir = path.join(deviceDir, petName);
          if (!existsDir(petDir)) continue;

          const files = fs.readdirSync(petDir).filter(f => f.endsWith('.csv'));
          for (const file of files) {
            const fullPath = path.join(petDir, file);
            const stat = fs.statSync(fullPath);
            results.push({
              date,
              device: deviceDirName,
              pet: petName,
              filename: file,
              size: stat.size,
              mtime: stat.mtime,
              relativePath: path.relative(root, fullPath),
            });
          }
        }
      }
    }

    res.json({ success: true, files: results });
  } catch (error) {
    console.error('[CSV API] Error in /all:', error);
    res.status(500).json({
      success: false,
      message: '전체 CSV 목록을 가져오는 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

/**
 * 개별 CSV 파일 다운로드
 * GET /api/csv/download?path=relativePath
 * - relativePath 는 위 목록 API에서 받은 relativePath 그대로 사용
 */
router.get('/download', verifyToken, async (req, res) => {
  try {
    const { path: relativePath } = req.query;
    if (!relativePath) {
      return res.status(400).json({
        success: false,
        message: 'path 쿼리 파라미터가 필요합니다.',
      });
    }

    const root = getUserCsvRoot(req.user.email);
    const normalized = path.normalize(relativePath);
    const fullPath = path.join(root, normalized);

    // 디렉터리 탈출 방지
    if (!fullPath.startsWith(root)) {
      return res.status(400).json({
        success: false,
        message: '잘못된 경로입니다.',
      });
    }

    if (!existsFile(fullPath)) {
      return res.status(404).json({
        success: false,
        message: '파일을 찾을 수 없습니다.',
      });
    }

    const filename = path.basename(fullPath);
    res.download(fullPath, filename);
  } catch (error) {
    console.error('[CSV API] Error in /download:', error);
    res.status(500).json({
      success: false,
      message: 'CSV 파일 다운로드 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

module.exports = router;


