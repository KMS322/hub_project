const db = require('../models');
const csvWriter = require('../utils/csvWriter'); // 싱글톤 인스턴스
const { processData: processHeartRate } = require('../utils/heartRateProcessor');

/**
 * Telemetry 데이터 처리 Worker
 * 대량 데이터를 Queue에서 가져와 DB 저장, CSV 저장 및 WebSocket 브로드캐스트
 */
class TelemetryWorker {
  constructor(io, queue, options = {}) {
    this.io = io; // Socket.IO 인스턴스
    this.queue = queue; // Telemetry 데이터 큐
    this.isRunning = false;
    this.batchSize = options.batchSize || 100; // 배치 크기
    this.processInterval = options.processInterval || 50; // 처리 주기 (ms)
    this.broadcastInterval = options.broadcastInterval || 100; // 브로드캐스트 주기 (ms)
    this.broadcastBuffer = new Map(); // 브로드캐스트 버퍼 (디바이스별)
    this.broadcastTimer = null;
    this.processTimer = null;
    this.csvWriter = csvWriter; // 싱글톤 CSV Writer 인스턴스 사용
    this.batteryCache = new Map(); // 디바이스별 마지막 배터리 값 저장
  }

  /**
   * Worker 시작
   */
  start() {
    if (this.isRunning) {
      console.log('[Telemetry Worker] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[Telemetry Worker] 🔄 Started');
    console.log(`   Batch size: ${this.batchSize}`);
    console.log(`   Process interval: ${this.processInterval}ms`);
    console.log(`   Broadcast interval: ${this.broadcastInterval}ms`);

    // 주기적으로 큐에서 데이터 처리
    this.processTimer = setInterval(() => {
      this.processBatch();
    }, this.processInterval);

    // 주기적으로 WebSocket 브로드캐스트
    this.broadcastTimer = setInterval(() => {
      this.broadcastBuffered();
    }, this.broadcastInterval);
  }

  /**
   * Worker 중지
   */
  stop() {
    this.isRunning = false;
    
    if (this.processTimer) {
      clearInterval(this.processTimer);
      this.processTimer = null;
    }

    if (this.broadcastTimer) {
      clearInterval(this.broadcastTimer);
      this.broadcastTimer = null;
    }

    // 남은 데이터 처리
    this.processBatch();
    this.broadcastBuffered();

    console.log('[Telemetry Worker] Stopped');
  }

  /**
   * 큐에서 배치로 데이터 가져와 처리
   */
  async processBatch() {
    if (!this.isRunning || this.queue.length === 0) {
      return;
    }

    // 큐 크기 제한 체크 (메모리 보호)
    const MAX_QUEUE_SIZE = 10000; // 최대 10,000개 항목
    if (this.queue.length > MAX_QUEUE_SIZE) {
      console.warn(`⚠️  Telemetry queue size exceeded limit: ${this.queue.length}. Dropping oldest items.`);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/dbf439ea-9874-404e-bfdd-9c97e098e02b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'workers/telemetryWorker.js:76',message:'Queue size exceeded',data:{queueLength:this.queue.length,maxSize:MAX_QUEUE_SIZE},timestamp:Date.now(),sessionId:'debug-session',runId:'runtime',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      // 오래된 항목 제거 (최신 5000개만 유지)
      const itemsToKeep = this.queue.slice(-5000);
      this.queue.length = 0;
      this.queue.push(...itemsToKeep);
    }

    const batch = [];
    const batchSize = Math.min(this.batchSize, this.queue.length);

    // 큐에서 배치 추출
    for (let i = 0; i < batchSize; i++) {
      const item = this.queue.shift();
      if (item) {
        batch.push(item);
      }
    }

    if (batch.length === 0) {
      return;
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/dbf439ea-9874-404e-bfdd-9c97e098e02b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'workers/telemetryWorker.js:processBatch',message:'Processing batch',data:{batchSize:batch.length,queueRemaining:this.queue.length},timestamp:Date.now(),sessionId:'debug-session',runId:'runtime',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

      try {
        const processStartTime = Date.now();
        
        // DB 저장 (bulk insert)
        const dbStartTime = Date.now();
        await this.saveToDatabase(batch);
        const dbTime = Date.now() - dbStartTime;

        // CSV 저장
        const csvStartTime = Date.now();
        this.saveToCSV(batch);
        const csvTime = Date.now() - csvStartTime;

        // 브로드캐스트 버퍼에 추가
        const broadcastStartTime = Date.now();
        this.addToBroadcastBuffer(batch);
        const broadcastTime = Date.now() - broadcastStartTime;

        const totalProcessTime = Date.now() - processStartTime;
        
        // 가장 오래된 수신 시간 찾기
        const oldestReceiveTime = batch.reduce((oldest, item) => {
          const receiveTime = item.receiveStartTime || item.timestamp?.getTime() || Date.now();
          return oldest ? Math.min(oldest, receiveTime) : receiveTime;
        }, null);
        
        const endToEndTime = oldestReceiveTime ? Date.now() - oldestReceiveTime : totalProcessTime;

        console.log(`[Telemetry Worker] ✅ Processed ${batch.length} telemetry items`);
        console.log(`   Queue remaining: ${this.queue.length} items`);
        console.log(`   ⏱️  Performance:`);
        console.log(`      - DB save: ${dbTime}ms`);
        console.log(`      - CSV save: ${csvTime}ms`);
        console.log(`      - Broadcast buffer: ${broadcastTime}ms`);
        console.log(`      - Total process: ${totalProcessTime}ms`);
        console.log(`      - End-to-end: ${endToEndTime}ms ${endToEndTime < 1000 ? '✅' : '⚠️'}`);
        
        // 1초 초과 시 경고
        if (endToEndTime >= 1000) {
          console.warn(`   ⚠️  WARNING: End-to-end time exceeds 1 second!`);
        }
      } catch (error) {
        console.error('[Telemetry Worker] Error processing batch:', error);
        // 에러 발생 시 큐에 다시 추가 (선택적)
        // this.queue.unshift(...batch);
      }
  }

  /**
   * 데이터베이스에 저장 (bulk insert)
   * @param {Array} batch - 저장할 데이터 배치
   */
  async saveToDatabase(batch) {
    // Telemetry 모델이 있다고 가정
    // 실제 구현은 모델 구조에 맞게 수정 필요
    const records = [];

    for (const item of batch) {
      const { hubId, deviceId, data, timestamp } = item;
      
      // timestamp와 starttime은 BIGINT로 저장 (밀리초 단위)
      const timestampValue = data.timestamp || timestamp.getTime();
      const starttimeValue = data.starttime || null;
      
      // dataArr가 있는 경우 (문서의 telemetry 구조)
      if (data.dataArr && Array.isArray(data.dataArr)) {
        for (const sample of data.dataArr) {
          records.push({
            hub_address: hubId,
            device_address: deviceId,
            timestamp: timestampValue,
            starttime: starttimeValue,
            ir: sample.ir || null,
            red: sample.red || null,
            green: sample.green || null,
            spo2: sample.spo2 || null,
            hr: sample.hr || null,
            temp: sample.temp || null,
            battery: sample.battery || null,
            created_at: new Date(),
            updated_at: new Date()
          });
        }
      } else {
        // 단일 샘플인 경우
        records.push({
          hub_address: hubId,
          device_address: deviceId,
          timestamp: timestampValue,
          starttime: starttimeValue,
          ir: data.ir || null,
          red: data.red || null,
          green: data.green || null,
          spo2: data.spo2 || null,
          hr: data.hr || null,
          temp: data.temp || null,
          battery: data.battery || null,
          created_at: new Date(),
          updated_at: new Date()
        });
      }
    }

    // Bulk insert (Sequelize bulkCreate 사용)
    if (records.length > 0 && db.Telemetry) {
      await db.Telemetry.bulkCreate(records, {
        ignoreDuplicates: true,
        validate: false // 성능을 위해 검증 생략
      });
    }
  }

  /**
   * CSV 파일에 저장 (허브에서 받은 250개 배치 데이터)
   * 
   * 데이터 형식:
   * {
   *   device_mac_address: "AA:BB:CC:DD:EE",
   *   sampling_rate: 50,
   *   spo2: 98,
   *   hr: 75,
   *   temp: 38.5,
   *   data: ["123456,654321,123456", ...], // 250개
   *   start_time: "HH:mm:ss:SSS"
   * }
   * 
   * @param {Array} batch - 저장할 데이터 배치
   */
  async saveToCSV(batch) {
    try {
      const db = require('../models');
      
      for (const item of batch) {
        const { hubId, deviceId, data } = item;
        
        // ✅ 배치 데이터 형식 (250개 샘플)
        if (data.device_mac_address && data.data && Array.isArray(data.data) && data.data.length > 0) {
          // 디바이스 정보 조회하여 CSV 세션 시작 확인
          try {
            const device = await db.Device.findOne({
              where: { address: data.device_mac_address },
              include: [{ model: db.Pet, as: 'Pet' }],
            });

            // CSV 저장은 디바이스가 허브에 연결되어 있고 펫이 연결된 경우에만
            if (device && device.user_email) {
              const userEmail = device.user_email;
              const petName = device.Pet?.name || 'Unknown';
              
              // 펫이 연결된 경우에만 CSV 저장
              if (device.Pet) {
                // CSV 세션이 없으면 시작
                if (!this.csvWriter.hasActiveSession(data.device_mac_address)) {
                  const startTime = data.start_time || '000000000';
                  const samplingRate = data.sampling_rate || 50;
                  this.csvWriter.startSession(data.device_mac_address, userEmail, petName, startTime, samplingRate);
                  console.log(`[Telemetry Worker] Started CSV session for ${data.device_mac_address}`);
                }
                
                // CSV Writer에 배치 데이터 전달
                await this.csvWriter.writeBatch(data);
              }
            }
          } catch (error) {
            console.error(`[Telemetry Worker] Error processing CSV for device ${data.device_mac_address}:`, error);
          }
        }
        // ✅ 단일 샘플 형식 (문자열 파싱된 데이터: device_mac_address-sampling_rate, hr, spo2, temp, battery)
        else if (data.device_mac_address && data.dataArr && Array.isArray(data.dataArr) && data.dataArr.length > 0) {
          // 디바이스 정보 조회하여 CSV 세션 시작 확인
          try {
            const device = await db.Device.findOne({
              where: { address: data.device_mac_address },
              include: [{ model: db.Pet, as: 'Pet' }],
            });

            // CSV 저장은 디바이스가 허브에 연결되어 있고 펫이 연결된 경우에만
            if (device && device.user_email) {
              const userEmail = device.user_email;
              const petName = device.Pet?.name || 'Unknown';
              
              // 펫이 연결된 경우에만 CSV 저장
              if (device.Pet) {
                // CSV 세션이 없으면 시작
                if (!this.csvWriter.hasActiveSession(data.device_mac_address)) {
                  const startTime = data.start_time || '000000000';
                  const samplingRate = data.sampling_rate || 50;
                  this.csvWriter.startSession(data.device_mac_address, userEmail, petName, startTime, samplingRate);
                  console.log(`[Telemetry Worker] Started CSV session for ${data.device_mac_address} (single sample)`);
                }
                
                // 단일 샘플을 배치 형식으로 변환하여 CSV 저장
                const batchData = {
                  device_mac_address: data.device_mac_address,
                  sampling_rate: data.sampling_rate || 50,
                  data: ['0,0,0'], // ir, red, green은 없으므로 0으로 채움
                  dataArr: data.dataArr,
                  hr: data.hr || 0,
                  spo2: data.spo2 || 0,
                  temp: data.temp || 0,
                  battery: data.battery || 0,
                  start_time: data.start_time || '000000000',
                };
                
                await this.csvWriter.writeBatch(batchData);
                console.log(`[Telemetry Worker] ✅ Single sample saved to CSV for ${data.device_mac_address}`, {
                  hr: data.hr,
                  spo2: data.spo2,
                  temp: data.temp,
                  battery: data.battery,
                });
              }
            }
          } catch (error) {
            console.error(`[Telemetry Worker] Error processing CSV for device ${data.device_mac_address}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('[Telemetry Worker] CSV 저장 오류:', error);
    }
  }

  /**
   * 브로드캐스트 버퍼에 추가 (신호처리 적용)
   * 
   * 원본 데이터는 신호처리를 거쳐 안정화된 HR만 프론트엔드에 전달한다.
   * CSV 저장과는 완전히 분리되어 있다.
   * 
   * @param {Array} batch - 추가할 데이터 배치
   */
  addToBroadcastBuffer(batch) {
    for (const item of batch) {
      const { hubId, deviceId, data, publishStartTime } = item;
      const key = `${hubId}:${deviceId}`;

      // 신호처리 수행
      let processedData = { ...data };
      
      // 배터리 값 처리: 0이 아닐 때만 캐시 업데이트
      const currentBattery = data.battery || 0;
      let batteryToUse = currentBattery;
      
      if (currentBattery === 0) {
        // 0이면 캐시된 값 사용
        if (this.batteryCache.has(deviceId)) {
          batteryToUse = this.batteryCache.get(deviceId);
        }
      } else {
        // 0이 아니면 캐시 업데이트
        this.batteryCache.set(deviceId, currentBattery);
      }
      
      // 원시 PPG 데이터가 있는 경우 신호처리 적용
      if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        try {
          const hrResult = processHeartRate(deviceId, {
            sampling_rate: data.sampling_rate || 20,
            data: data.data,
            spo2: data.spo2 || null,
            temp: data.temp || null,
            start_time: data.start_time || data.timestamp || Date.now()
          });

          if (hrResult && hrResult.hr !== null && hrResult.hr !== undefined) {
            // 안정화된 HR로 교체
            processedData = {
              ...data,
              processedHR: hrResult.hr, // 신호처리된 HR
              originalHR: data.hr, // 원본 HR (참고용)
              sqi: hrResult.sqi,
              pi: hrResult.pi,
              status: hrResult.status,
              statusMessage: hrResult.message,
              // dataArr 형식으로 변환 (프론트엔드 호환)
              dataArr: [{
                ir: null, // 원시 데이터는 전송하지 않음 (CSV에만 저장)
                red: null,
                green: null,
                hr: hrResult.hr, // 안정화된 HR
                spo2: data.spo2 || hrResult.spo2 || null, // 원본 SpO2 우선 사용
                temp: data.temp || hrResult.temp || null, // 원본 Temp 우선 사용
                battery: batteryToUse
              }]
            };
          } else {
            // HR 계산 실패 시 원본 데이터 유지하되 상태 정보 추가
            processedData = {
              ...data,
              processedHR: null,
              originalHR: data.hr,
              sqi: hrResult?.sqi || 0,
              status: hrResult?.status || 'error',
              statusMessage: hrResult?.message || '신호처리 중...',
              dataArr: [{
                ir: null,
                red: null,
                green: null,
                hr: null, // HR 없음
                spo2: data.spo2 || null,
                temp: data.temp || null,
                battery: batteryToUse
              }]
            };
          }
        } catch (error) {
          console.error(`[Telemetry Worker] Signal processing error for ${deviceId}:`, error);
          // 에러 발생 시 원본 데이터 사용
          processedData = {
            ...data,
            processedHR: null,
            originalHR: data.hr,
            sqi: 0,
            status: 'error',
            statusMessage: '신호처리 오류',
            dataArr: data.dataArr || [{
              ir: null,
              red: null,
              green: null,
              hr: data.hr || null,
              spo2: data.spo2 || null,
              temp: data.temp || null,
              battery: batteryToUse
            }]
          };
        }
      }

      if (!this.broadcastBuffer.has(key)) {
        this.broadcastBuffer.set(key, []);
      }

      // 최신 데이터만 유지 (메모리 절약)
      const buffer = this.broadcastBuffer.get(key);
      buffer.push({
        ...processedData,
        hubId,
        deviceId,
        timestamp: item.timestamp instanceof Date ? item.timestamp.toISOString() : item.timestamp,
        receiveStartTime: item.receiveStartTime || (item.timestamp instanceof Date ? item.timestamp.getTime() : Date.now()),
        publishStartTime: publishStartTime || null
      });

      // 버퍼 크기 제한 (최근 100개만 유지)
      if (buffer.length > 100) {
        buffer.shift();
      }
    }
  }

  /**
   * 버퍼된 데이터를 Socket.IO로 브로드캐스트
   */
  async broadcastBuffered() {
    if (!this.io || this.broadcastBuffer.size === 0) {
      return;
    }

    const broadcastStartTime = Date.now();
    let broadcastCount = 0;

    for (const [key, dataArray] of this.broadcastBuffer.entries()) {
      if (dataArray.length === 0) continue;

      const [hubId, deviceId] = key.split(':');
      
      // 최신 데이터만 전송 (10~30Hz로 제한)
      const latestData = dataArray[dataArray.length - 1];
      
      // Downsampling: dataArr가 있으면 일부만 전송
      let telemetryData = latestData;
      if (latestData.dataArr && Array.isArray(latestData.dataArr)) {
        // 50개 샘플 중 10개만 선택 (10Hz로 다운샘플링)
        const step = Math.max(1, Math.floor(latestData.dataArr.length / 10));
        telemetryData = {
          ...latestData,
          dataArr: latestData.dataArr.filter((_, i) => i % step === 0)
        };
      }

      // 성능 측정: 수신 시간부터 현재까지
      const receiveTime = latestData.receiveStartTime || Date.now();
      const endToEndTime = Date.now() - receiveTime;
      
      // 전체 처리 시간: publishStartTime부터 현재까지 (CSV 저장 포함)
      const publishStartTime = latestData.publishStartTime;
      const totalProcessingTime = publishStartTime ? Date.now() - publishStartTime : null;

      // ✅ 허브 소유자에게만 TELEMETRY 이벤트 전송
      const telemetryPayload = {
        type: 'sensor_data',
        hubId,
        deviceId,
        data: telemetryData,
        timestamp: new Date().toISOString(),
        performance: {
          endToEndTime: endToEndTime, // MQTT 수신부터 프론트 전송까지
          receivedAt: receiveTime,
          totalProcessingTime: totalProcessingTime, // 발행부터 프론트 수신까지 (CSV 저장 포함)
          publishStartTime: publishStartTime // 발행 시작 시간
        }
      };
      
      try {
        const hub = await db.Hub.findByPk(hubId);
        console.log(`[Telemetry Worker] 🔍 Emitting TELEMETRY`, {
          hubId,
          deviceId,
          hubFound: !!hub,
          hubUserEmail: hub?.user_email || 'N/A',
          roomName: hub?.user_email ? `user:${hub.user_email}` : 'N/A',
          socketIORooms: this.io ? Object.keys(this.io.sockets.adapter.rooms || {}).length : 0,
          payload: JSON.stringify(telemetryPayload, null, 2),
        });
        
        if (hub && hub.user_email) {
          const roomName = `user:${hub.user_email}`;
          const room = this.io.sockets.adapter.rooms.get(roomName);
          const socketCount = room ? room.size : 0;
          
          // ✅ 모든 rooms 확인 (디버깅용)
          const allRooms = Array.from(this.io.sockets.adapter.rooms.keys());
          const userRooms = allRooms.filter(r => r.startsWith('user:'));
          
          console.log(`[Telemetry Worker] 📤 Emitting to room "${roomName}"`, {
            roomExists: !!room,
            socketCount,
            allRoomsCount: allRooms.length,
            userRoomsCount: userRooms.length,
            userRooms: userRooms.slice(0, 10), // 처음 10개만
            targetRoom: roomName,
            payloadSize: JSON.stringify(telemetryPayload).length,
            hr: telemetryData.hr,
            spo2: telemetryData.spo2,
            temp: telemetryData.temp,
            battery: telemetryData.battery,
          });
          
          // ✅ emit 전송 및 확인
          try {
            this.io.to(roomName).emit('TELEMETRY', telemetryPayload);
            
            // ✅ emit 후 즉시 확인 (Socket.IO는 비동기이므로 완벽하지 않지만 참고용)
            const roomAfterEmit = this.io.sockets.adapter.rooms.get(roomName);
            const socketCountAfter = roomAfterEmit ? roomAfterEmit.size : 0;
            
            console.log(`[Telemetry Worker] ✅ TELEMETRY emitted to user ${hub.user_email}`, {
              hubId,
              deviceId,
              roomName,
              socketCount,
              socketCountAfter,
              hr: telemetryData.hr,
              spo2: telemetryData.spo2,
              temp: telemetryData.temp,
              battery: telemetryData.battery,
              timestamp: telemetryPayload.timestamp,
            });
          } catch (emitError) {
            console.error(`[Telemetry Worker] ❌ Error during emit:`, emitError);
            throw emitError;
          }
        } else {
          // 허브 정보를 찾을 수 없으면 모든 클라이언트에 브로드캐스트 (fallback)
          const connectedSockets = this.io.sockets.sockets.size;
          console.log(`[Telemetry Worker] ⚠️ Hub not found, broadcasting to all ${connectedSockets} sockets`, {
            hubId,
            payload: JSON.stringify(telemetryPayload, null, 2),
          });
          this.io.emit('TELEMETRY', telemetryPayload);
          console.log(`[Telemetry Worker] ⚠️ TELEMETRY broadcasted (hub not found) for hub ${hubId}`);
        }
      } catch (error) {
        console.error(`[Telemetry Worker] ❌ Error emitting TELEMETRY for hub ${hubId}:`, error);
        console.error(`[Telemetry Worker] Error stack:`, error.stack);
        // 에러 발생 시 fallback으로 브로드캐스트
        try {
          console.log(`[Telemetry Worker] 🔄 Attempting fallback broadcast`);
          this.io.emit('TELEMETRY', telemetryPayload);
          console.log(`[Telemetry Worker] ✅ Fallback broadcast successful`);
        } catch (emitError) {
          console.error(`[Telemetry Worker] ❌ Failed to broadcast TELEMETRY:`, emitError);
          console.error(`[Telemetry Worker] Broadcast error stack:`, emitError.stack);
        }
      }

      broadcastCount++;

      // 전송한 데이터는 버퍼에서 제거
      this.broadcastBuffer.set(key, []);
    }

    if (broadcastCount > 0) {
      const broadcastTime = Date.now() - broadcastStartTime;
      console.log(`[Telemetry Worker] 📡 Broadcasted ${broadcastCount} devices to frontend (${broadcastTime}ms)`);
    }
  }

  /**
   * 최신 Telemetry 데이터 조회 (HTTP API용)
   * @param {string} deviceId - 디바이스 ID (선택사항)
   * @returns {Object} 최신 데이터
   */
  getLatestTelemetry(deviceId = null) {
    const result = {};
    
    for (const [key, dataArray] of this.broadcastBuffer.entries()) {
      const [hubId, devId] = key.split(':');
      
      if (deviceId && devId !== deviceId) {
        continue;
      }
      
      if (dataArray.length > 0) {
        const latestData = dataArray[dataArray.length - 1];
        
        // Downsampling: dataArr가 있으면 일부만 전송
        let telemetryData = latestData;
        if (latestData.dataArr && Array.isArray(latestData.dataArr)) {
          const step = Math.max(1, Math.floor(latestData.dataArr.length / 10));
          telemetryData = {
            ...latestData,
            dataArr: latestData.dataArr.filter((_, i) => i % step === 0)
          };
        }
        
        result[devId] = {
          type: 'sensor_data',
          hubId,
          deviceId: devId,
          data: telemetryData,
          timestamp: new Date().toISOString()
        };
      }
    }
    
    return deviceId ? result[deviceId] || null : result;
  }

  /**
   * 큐 상태 확인
   */
  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      bufferSize: this.broadcastBuffer.size,
      isRunning: this.isRunning
    };
  }

  /**
   * 최근 데이터 조회 (CSV에서)
   * @param {string} deviceAddress - 디바이스 MAC 주소
   * @param {number} limit - 최대 행 수
   * @returns {Array} 최근 데이터 배열
   */
  getRecentData(deviceAddress, limit = 100) {
    return this.csvWriter.readRecentData(deviceAddress, limit);
  }

  /**
   * 모든 디바이스의 최근 데이터 조회
   * @param {number} limit - 디바이스당 최대 행 수
   * @returns {Object} 디바이스별 데이터 맵
   */
  getAllRecentData(limit = 100) {
    return this.csvWriter.readAllRecentData(limit);
  }
}

module.exports = TelemetryWorker;

