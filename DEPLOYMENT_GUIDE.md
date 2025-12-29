# 배포 가이드

## 프로덕션 환경 설정

### 1. 환경 변수 설정

#### 백엔드 (.env)
```env
NODE_ENV=production
PORT=5000

# 데이터베이스
DB_USERNAME=production_user
DB_PASSWORD=strong_password_here
DB_DATABASE=hubProjectDB_prod
DB_HOST=your_db_host
DB_PORT=3306
DB_LOGGING=false

# MQTT
MQTT_BROKER_URL=mqtt://your_mqtt_broker:1883
MQTT_USERNAME=mqtt_user
MQTT_PASSWORD=mqtt_password

# JWT (반드시 강력한 키 사용)
JWT_SECRET=your_very_strong_secret_key_minimum_32_characters_long
JWT_EXPIRES_IN=24h
```

#### 프론트엔드 (.env.production)
```env
VITE_API_URL=https://your-api-domain.com
VITE_MQTT_BROKER_URL=wss://your-mqtt-broker.com:9001
```

### 2. 데이터베이스 설정

```sql
-- 프로덕션 데이터베이스 생성
CREATE DATABASE hubProjectDB_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;

-- 전용 사용자 생성
CREATE USER 'hub_user'@'%' IDENTIFIED BY 'strong_password';
GRANT ALL PRIVILEGES ON hubProjectDB_prod.* TO 'hub_user'@'%';
FLUSH PRIVILEGES;
```

### 3. 빌드

#### 프론트엔드
```bash
cd front
npm run build
```

빌드 결과물: `front/dist/`

#### 백엔드
```bash
cd back
npm install --production
```

### 4. 서버 실행

#### PM2 사용 (권장)
```bash
# PM2 설치
npm install -g pm2

# 백엔드 실행
cd back
pm2 start server.js --name hub-backend

# 프론트엔드 (Nginx 사용 시)
# Nginx 설정 참고
```

#### Nginx 설정 (프론트엔드)
```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /path/to/hub_project/front/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /socket.io {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### 5. SSL 인증서 설정 (HTTPS)

Let's Encrypt 사용:
```bash
sudo certbot --nginx -d your-domain.com
```

### 6. 방화벽 설정

```bash
# 필요한 포트만 열기
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 1883/tcp  # MQTT
sudo ufw enable
```

---

## 모니터링

### 로그 확인

**PM2 로그:**
```bash
pm2 logs hub-backend
```

**Nginx 로그:**
```bash
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### 성능 모니터링

**PM2 모니터:**
```bash
pm2 monit
```

**시스템 리소스:**
```bash
htop
df -h  # 디스크 사용량
```

---

## 백업

### 데이터베이스 백업

```bash
# 자동 백업 스크립트
mysqldump -u hub_user -p hubProjectDB_prod > backup_$(date +%Y%m%d).sql
```

### CSV 파일 백업

```bash
# CSV 파일 디렉토리 백업
tar -czf csv_backup_$(date +%Y%m%d).tar.gz /path/to/csv_files
```

---

## 업데이트

### 1. 코드 업데이트
```bash
git pull origin main
cd back && npm install
cd ../front && npm install && npm run build
pm2 restart hub-backend
```

### 2. 데이터베이스 마이그레이션
```bash
# Sequelize는 자동으로 스키마 동기화
# 프로덕션에서는 주의 필요
```

---

## 문제 해결

### 서버가 시작되지 않는 경우
1. 포트 충돌 확인: `lsof -i :5000`
2. 환경 변수 확인: `.env` 파일 검증
3. 데이터베이스 연결 확인
4. 로그 확인: `pm2 logs hub-backend`

### MQTT 연결 실패
1. MQTT 브로커 실행 상태 확인
2. 방화벽 설정 확인
3. 인증 정보 확인

### 메모리 부족
1. Telemetry 큐 크기 확인
2. PM2 메모리 제한 설정
3. 서버 리소스 확인


