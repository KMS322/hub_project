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
 * CSV 파일 저장 (HUB에서 250개 데이터 전송)
 * POST /records/csv
 * body: {
 *   device_mac_address: "AA:BB:CC:DD:EE:01",
 *   sampling_rate: 50,
 *   spo2: 0,
 *   hr: 8,
 *   temp: 33.8,
 *   data: ["123456,654321,123456", ...],
 *   start_time: "17:36:45:163"
 * }
 */
router.post('/csv', async (req, res) => {
  try {
    const { device_mac_address, sampling_rate, spo2, hr, temp, data, start_time } = req.body;

    // 필수 필드 검증
    if (!device_mac_address || !sampling_rate || !data || !Array.isArray(data) || !start_time) {
      return res.status(400).json({
        success: false,
        message: '필수 필드가 누락되었습니다. (device_mac_address, sampling_rate, data, start_time)'
      });
    }

    // MAC 주소 형식 검증
    const macPattern = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macPattern.test(device_mac_address)) {
      return res.status(400).json({
        success: false,
        message: '올바른 MAC 주소 형식이 아닙니다.'
      });
    }

    // start_time 형식 검증 (HH:mm:ss:SSS)
    const timePattern = /^(\d{2}):(\d{2}):(\d{2}):(\d{3})$/;
    if (!timePattern.test(start_time)) {
      return res.status(400).json({
        success: false,
        message: '올바른 시간 형식이 아닙니다. (HH:mm:ss:SSS 형식)'
      });
    }

    // 디바이스와 연결된 펫 정보 조회
    const device = await db.Device.findOne({
      where: { address: device_mac_address },
      include: [
        {
          model: db.Pet,
          as: 'Pet',
          attributes: ['id', 'name', 'user_email']
        },
        {
          model: db.Hub,
          as: 'Hub',
          attributes: ['address', 'user_email']
        }
      ]
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: '디바이스를 찾을 수 없습니다.'
      });
    }

    // 펫 정보 확인
    if (!device.Pet) {
      return res.status(400).json({
        success: false,
        message: '디바이스에 연결된 펫이 없습니다.'
      });
    }

    const userEmail = device.Pet.user_email || device.Hub?.user_email;
    const petName = device.Pet.name;

    if (!userEmail) {
      return res.status(400).json({
        success: false,
        message: '사용자 정보를 찾을 수 없습니다.'
      });
    }

    // start_time 파싱 (HH:mm:ss:SSS -> 밀리초)
    const [hours, minutes, seconds, milliseconds] = start_time.split(':').map(Number);
    const today = new Date();
    today.setHours(hours, minutes, seconds, milliseconds);
    const startTimeMs = today.getTime();

    // 현재 날짜 (YYYY-MM-DD)
    const dateStr = today.toISOString().split('T')[0];

    // 파일 경로 생성: csv_files/user_email/YYYY-MM-DD/device_mac_address/pet_name/device_mac_address_pet_name_HH_mm_ss_SSS.csv
    // Windows에서는 폴더명과 파일명에 : 사용 불가하므로 _로 변환
    const sanitizedEmail = csvWriter.sanitizeForPath(userEmail);
    const sanitizedAddress = device_mac_address.replace(/:/g, '_'); // MAC 주소의 :를 _로 변환
    const sanitizedPet = csvWriter.sanitizeForPath(petName);
    const sanitizedTime = start_time.replace(/:/g, '_'); // 시간의 :를 _로 변환
    const fileName = `${sanitizedAddress}_${sanitizedPet}_${sanitizedTime}.csv`;
    
    const fileDir = path.join(
      process.cwd(),
      'csv_files',
      sanitizedEmail,
      dateStr,
      sanitizedAddress,
      petName
    );
    
    const filePath = path.join(fileDir, fileName);

    // 디렉토리 생성
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
      console.log(`[CSV Save] Created directory: ${fileDir}`);
    }

    // CSV 헤더 작성
    const csvHeader = 'time,ir,red,green,hr,spo2,temp\n';
    
    // CSV 데이터 생성
    const csvRows = [];
    const intervalMs = 1000 / sampling_rate; // 각 데이터 간격 (ms)

    for (let i = 0; i < data.length; i++) {
      const dataStr = data[i];
      if (!dataStr || typeof dataStr !== 'string') continue;

      // "ir,red,green" 형식 파싱
      const values = dataStr.split(',');
      if (values.length !== 3) continue;

      const ir = values[0].trim();
      const red = values[1].trim();
      const green = values[2].trim();

      // 시간 계산: start_time + (i * intervalMs)
      const currentTimeMs = startTimeMs + (i * intervalMs);
      const currentTime = new Date(currentTimeMs);
      const timeStr = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}:${String(currentTime.getSeconds()).padStart(2, '0')}:${String(currentTime.getMilliseconds()).padStart(3, '0')}`;

      // 마지막 행인지 확인
      const isLastRow = i === data.length - 1;
      
      // spo2, hr, temp: 마지막 행이 아니면 0, 마지막 행이면 받아온 값 사용
      const rowSpo2 = isLastRow ? spo2 : 0;
      const rowHr = isLastRow ? hr : 0;
      const rowTemp = isLastRow ? temp : 0;

      // CSV 행 생성
      csvRows.push(`${timeStr},${ir},${red},${green},${rowHr},${rowSpo2},${rowTemp}\n`);
    }

    // CSV 파일 작성/추가
    const rowsContent = csvRows.join('');
    const fileExists = fs.existsSync(filePath);

    if (!fileExists) {
      // 파일이 없으면 헤더 + 데이터 작성
      const csvContent = csvHeader + rowsContent;
      fs.writeFileSync(filePath, csvContent, 'utf8');
      console.log(`[CSV Save] ✅ CSV file created: ${filePath}`);
    } else {
      // 파일이 이미 있으면 데이터만 이어서 추가
      fs.appendFileSync(filePath, rowsContent, 'utf8');
      console.log(`[CSV Save] ✅ CSV file appended: ${filePath}`);
    }

    console.log(`[CSV Save]   - Device: ${device_mac_address}`);
    console.log(`[CSV Save]   - Pet: ${petName}`);
    console.log(`[CSV Save]   - User: ${userEmail}`);
    console.log(`[CSV Save]   - Appended Records: ${csvRows.length} rows`);

    res.status(200).json({
      success: true,
      message: 'CSV 파일이 저장되었습니다.',
      data: {
        filePath: filePath,
        fileName: fileName,
        device_mac_address: device_mac_address,
        pet_name: petName,
        user_email: userEmail,
        recordCount: csvRows.length,
        start_time: start_time,
        sampling_rate: sampling_rate
      }
    });
  } catch (error) {
    console.error('[CSV Save] Error:', error);
    res.status(500).json({
      success: false,
      message: 'CSV 파일 저장 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * CSV 파일 내용 조회 (그래프용)
 * GET /records/csv-content
 * query: user_email, date(YYYY-MM-DD), device_mac_address, pet_name, start_time(HH:mm:ss:SSS)
 */
router.get('/csv-content', async (req, res) => {
  try {
    const { user_email, date, device_mac_address, pet_name, start_time } = req.query;

    if (!user_email || !date || !device_mac_address || !pet_name || !start_time) {
      return res.status(400).json({
        success: false,
        message: 'user_email, date, device_mac_address, pet_name, start_time 쿼리 파라미터가 모두 필요합니다.'
      });
    }

    // start_time 형식 검증
    const timePattern = /^(\d{2}):(\d{2}):(\d{2}):(\d{3})$/;
    if (!timePattern.test(start_time)) {
      return res.status(400).json({
        success: false,
        message: 'start_time 형식이 올바르지 않습니다. (HH:mm:ss:SSS)'
      });
    }

    // Windows에서는 폴더명과 파일명에 : 사용 불가하므로 _로 변환
    const sanitizedEmail = csvWriter.sanitizeForPath(user_email);
    const sanitizedAddress = device_mac_address.replace(/:/g, '_'); // MAC 주소의 :를 _로 변환
    const sanitizedPet = csvWriter.sanitizeForPath(pet_name);
    const sanitizedTime = start_time.replace(/:/g, '_'); // 시간의 :를 _로 변환
    const fileName = `${sanitizedAddress}_${sanitizedPet}_${sanitizedTime}.csv`;

    const fileDir = path.join(
      process.cwd(),
      'csv_files',
      sanitizedEmail,
      date,
      sanitizedAddress,
      pet_name
    );
    const filePath = path.join(fileDir, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'CSV 파일을 찾을 수 없습니다.',
        filePath
      });
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');
    if (lines.length <= 1) {
      return res.json({
        success: true,
        data: []
      });
    }

    // 첫 줄은 헤더
    const dataLines = lines.slice(1);
    const rows = dataLines.map((line) => {
      const [time, ir, red, green, hr, spo2, temp] = line.split(',');
      return {
        time,
        ir: Number(ir) || 0,
        red: Number(red) || 0,
        green: Number(green) || 0,
        hr: Number(hr) || 0,
        spo2: Number(spo2) || 0,
        temp: Number(temp) || 0
      };
    });

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('[CSV Content] Error:', error);
    res.status(500).json({
      success: false,
      message: 'CSV 파일 내용을 읽는 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
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

