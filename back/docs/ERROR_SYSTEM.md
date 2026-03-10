# Communication Error Management & Observability (3-Tier)

## Error code format

`error-{channel}-{reason}`

- **Channel**: 0=MQTT, 1=HTTP, 2=Socket.io, 3=USB  
- **Reason**: 01=connection failed, 02=payload too large, 03=JSON parse error, 04=auth failed, 05=timeout, 06=invalid format, 07=missing field, 08=internal error, 09=DB error, 10=queue overflow, 11=device not found, 12=rate limit  

Examples: `error-0-01` (MQTT connection failed), `error-2-02` (Socket payload too large).

## 3-Tier flow (Error Framework)

All errors go through **one entry point**: `logError(serverError)`.

```
Transport (MQTT / HTTP / Socket)
  → createError(...)
  → logError(serverError)
       ├ PM2 Log   (console.error JSON)
       ├ Database  (server_errors via database/errorRepository)
       └ Realtime  (Socket.io admin/errors via core/error/errorStream)
```

## Backend layout

- `core/error/errorCodes.js` – CHANNEL_CODE, ERROR_REASON, buildCode()
- `core/error/errorFactory.js` – createError(channel, reason, message, detail, metadata)
- `core/error/errorLogger.js` – logError(serverError) → PM2 + DB + broadcastError()
- `core/error/errorStream.js` – setSocketInstance(io), broadcastError(error)
- `database/errorRepository.js` – saveError, findPaginated, findByDevice, getStats, getDeviceErrorStats, deleteOlderThanRetention (30 days)
- `admin/adminErrorController.js` – getErrors, getStats, getErrorsByDevice, getDeviceStats
- `routes/admin.js` – GET /api/admin/errors, /errors/stats, /errors/device/:id, /errors/device-stats, /health
- `middlewares/errorHandler.js` – HTTP errors → createError + logError

## PM2

- `ecosystem.config.js`: error_file, out_file, log_date_format, merge_logs
- Log rotation: `pm2 install pm2-logrotate`, then max_size 50M, retain 30, compress true

## Admin API (all require Authorization)

- GET /api/admin/errors – paginated list (code, channel, deviceId, startDate, endDate, keyword)
- GET /api/admin/errors/stats – byCode, byChannel, total, last24h
- GET /api/admin/errors/device/:deviceId – list by device
- GET /api/admin/errors/device-stats – device error counts (top 100)
- GET /api/admin/health – mqtt.connected, socket.connectionCount, queue.length, uptimeSeconds

## Frontend

- `/admin/system-logs` – 에러 목록, 필터, 통계, 디바이스별 에러, 실시간 스트림 (socket server-error)
- `/admin/system-health` – MQTT/Socket/Queue/Uptime (5초 폴링)
- `utils/errorMessages.js` – code → 사용자 메시지 매핑
