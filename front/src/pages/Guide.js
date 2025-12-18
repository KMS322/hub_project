import { Link } from 'react-router-dom'

function Guide() {
  return (
    <div style={{ padding: '40px', background: '#f5f6f8', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '28px', marginBottom: '32px' }}>시스템 사용 가이드</h1>

      {/* STEP 1 : HUB */}
      <section style={sectionStyle}>
        <div style={svgBoxStyle}>
          <HubSVG />
        </div>

        <div style={contentStyle}>
          <h2>1. 허브 등록</h2>
          <ul>
            <li>허브를 <b>USB로 컴퓨터에 연결</b>합니다.</li>
            <li>Wi-Fi ID와 비밀번호를 입력하여 허브를 등록합니다.</li>
            <li>등록이 완료되면 <b>USB를 분리</b>합니다.</li>
            <li>이후에는 <b>전원만 연결</b>하면 Wi-Fi로 자동 동작합니다.</li>
          </ul>

          <Link to="/hardware?tab=hub" target="_blank">
            허브 관리 페이지 이동 →
          </Link>
        </div>
      </section>

      {/* STEP 2 : DEVICE */}
      <section style={sectionStyle}>
        <div style={svgBoxStyle}>
          <DeviceSVG />
        </div>

        <div style={contentStyle}>
          <h2>2. 디바이스 등록</h2>
          <ul>
            <li>
              디바이스 버튼을 <b>3초간 길게 누르면 초록불</b>이 켜집니다.
            </li>
            <li>
              이후 버튼을 <b>두 번 누르면 파란불이 깜빡이며 등록 대기 상태</b>가 됩니다.
            </li>
            <li>
              디바이스 검색 시 <b>목록에 나타난 기기를 선택하여 등록</b>합니다.
            </li>
            <li>
              디바이스 찾기 기능 실행 시 <b>하얀불이 10초간 깜빡입니다.</b>
            </li>
          </ul>

          <Link to="/hardware?tab=device" target="_blank">
            디바이스 관리 페이지 이동 →
          </Link>
        </div>
      </section>

      {/* STEP 3 : PATIENT */}
      <section style={sectionStyle}>
        <div style={contentStyle}>
          <h2>3. 환자 등록</h2>
          <ul>
            <li>환자 정보를 등록합니다.</li>
            <li>등록된 디바이스를 환자에게 연결합니다.</li>
          </ul>

          <Link to="/patients" target="_blank">
            환자 관리 페이지 이동 →
          </Link>
        </div>
      </section>
    </div>
  )
}

/* =========================
   SVG : DEVICE
========================= */
function DeviceSVG() {
  return (
    <svg width="180" height="150" viewBox="0 0 180 360">
      {/* Body */}
      <rect x="40" y="20" width="100" height="100" rx="18" fill="#e0e3e8" />

      {/* Button (왼쪽 상단) */}
      <circle cx="50" cy="50" r="6" fill="#333" />
      <text x="10" y="55" fontSize="12">버튼</text>

      {/* LED (왼쪽 측면 상단 20%) */}
      <circle cx="40" cy="84" r="5" fill="green" />
      <text x="5" y="90" fontSize="12">LED</text>

      {/* Charging Port (오른쪽 측면 하단 20%) */}
      <rect x="140" y="260" width="8" height="20" rx="2" fill="#555" />
      <text x="95" y="290" fontSize="12">충전단자</text>
    </svg>
  )
}

/* =========================
   SVG : HUB
========================= */
function HubSVG() {
  return (
    <svg width="200" height="320" viewBox="0 0 200 320">
      {/* Body */}
      <rect x="60" y="20" width="80" height="260" rx="10" fill="#dde1e6" />

      {/* LED */}
      <circle cx="100" cy="60" r="6" fill="#4caf50" />
      <text x="110" y="65" fontSize="12">LED</text>

      {/* Button */}
      <circle cx="100" cy="120" r="8" fill="#555" />
      <text x="110" y="125" fontSize="12">버튼</text>

      {/* USB */}
      <rect x="85" y="280" width="30" height="20" rx="3" fill="#333" />
      <text x="70" y="315" fontSize="12">USB</text>
    </svg>
  )
}

/* =========================
   Inline Styles
========================= */
const sectionStyle = {
  display: 'flex',
  gap: '32px',
  background: '#fff',
  padding: '24px',
  borderRadius: '12px',
  marginBottom: '32px',
  alignItems: 'center'
}

const svgBoxStyle = {
  minWidth: '220px',
  display: 'flex',
  justifyContent: 'center'
}

const contentStyle = {
  flex: 1,
  fontSize: '15px',
  lineHeight: 1.6
}

export default Guide
