import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import './Guide.css'

function Guide() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [expandedFaq, setExpandedFaq] = useState(null)
  const [toast, setToast] = useState({ show: false, message: '' })

  const toggleFaq = (index) => {
    setExpandedFaq(expandedFaq === index ? null : index)
  }

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      setToast({ show: true, message: `${label}이(가) 복사되었습니다!` })
      setTimeout(() => {
        setToast({ show: false, message: '' })
      }, 2000)
    }).catch((err) => {
      console.error('클립보드 복사 실패:', err)
      setToast({ show: true, message: '복사에 실패했습니다.' })
      setTimeout(() => {
        setToast({ show: false, message: '' })
      }, 2000)
    })
  }

  const faqs = [
    {
      question: "허브가 인식되지 않아요.",
      answer: "USB 케이블이 끝까지 제대로 꽂혀 있는지, 데이터 전송이 가능한 케이블인지 확인하세요. 일부 충전 전용 케이블은 데이터 전송을 지원하지 않습니다."
    },
    {
      question: "디바이스 검색이 되지 않습니다.",
      answer: "디바이스의 파란색 LED가 깜빡이고 있는지 확인하세요. (스위치 2번 클릭) 허브와 디바이스 사이의 거리가 너무 멀지 않은지 확인해 주세요."
    },
    {
      question: "WiFi 연결이 실패합니다.",
      answer: "WiFi ID와 비밀번호가 정확한지 확인하세요. 2.4GHz WiFi만 지원되므로 5GHz WiFi는 사용할 수 없습니다."
    },
    {
      question: "디바이스 배터리가 빨리 닳아요.",
      answer: "디바이스가 측정 모드(초록색 LED)로 계속 켜져있는지 확인하세요. 사용하지 않을 때는 전원을 꺼주세요."
    }
  ]

  return (
    <div className="guide-page">
      <div className="guide-container">
        {/* 제목 섹션 */}
        <div className="guide-title-section">
          <h1>시스템 사용 가이드</h1>
          <p>생체 신호 모니터링 시스템을 빠르게 시작하는 방법을 안내합니다.</p>
        </div>

        {/* 빠른 시작 가이드 */}
        <div className="quick-start-section">
          <h2>빠른 시작</h2>
          <div className="quick-start-grid">
            <div className="quick-start-card">
              <div className="card-number">1</div>
              <HubSVG />
              <h3>허브 등록</h3>
              <p>데이터 수집 서버를 등록합니다</p>
              <Link to="/hardware" className="btn-link">허브 관리 →</Link>
            </div>

            <div className="quick-start-card">
              <div className="card-number">2</div>
              <DeviceSVG />
              <h3>디바이스 페어링</h3>
              <p>생체 센서를 연결합니다</p>
              <Link to="/hardware" className="btn-link">디바이스 관리 →</Link>
            </div>

            <div className="quick-start-card">
              <div className="card-number">3</div>
              <DashboardSVG />
              <h3>실시간 모니터링</h3>
              <p>대시보드에서 데이터 확인</p>
              <Link to="/dashboard" className="btn-link">대시보드 →</Link>
            </div>
          </div>
        </div>

        {/* 상세 사용법 */}
        <div className="detailed-guide-section">
          <h2>상세 사용법</h2>

          {/* 허브 등록 */}
          <div className="guide-card">
            <div className="guide-card-header">
              <div className="guide-icon hub">
                <HubIcon />
              </div>
              <div>
                <h3>허브(Hub) 등록</h3>
                <p>실시간 데이터 수집을 위한 허브 설정</p>
              </div>
            </div>

            <div className="guide-card-content">
              <div className="guide-visual">
                <HubDetailSVG />
              </div>

              <div className="guide-steps">
                <div className="guide-step">
                  <div className="step-num">1</div>
                  <div className="step-content">
                    <h4>허브 등록 안내 확인</h4>
                    <p>로그인 후 등록된 허브가 없다면 "허브 등록 필요" 알림창이 나타납니다. [동의]를 눌러 관리 페이지로 이동합니다.</p>
                  </div>
                </div>

                <div className="guide-step">
                  <div className="step-num">2</div>
                  <div className="step-content">
                    <h4>허브 물리적 연결</h4>
                    <p>준비된 허브를 <strong>USB to C-type 케이블</strong>로 PC에 연결합니다.</p>
                    <div className="tip-box warning">
                      <span>⚠️</span>
                      <span>허브 본체의 C-type 포트가 <strong>아래 방향</strong>을 향하도록 연결해 주세요.</span>
                    </div>
                  </div>
                </div>

                <div className="guide-step">
                  <div className="step-num">3</div>
                  <div className="step-content">
                    <h4>WiFi 설정 및 등록</h4>
                    <p>웹 화면의 <strong>[USB 포트 연결]</strong> 버튼을 클릭합니다.</p>
                    <p>WiFi ID와 비밀번호를 입력하여 허브를 등록합니다.</p>
                    <div className="tip-box info">
                      <span>💡</span>
                      <span>주소가 나타나지 않으면 케이블을 재연결한 후 다시 시도하세요.</span>
                    </div>
                  </div>
                </div>

                <div className="guide-step">
                  <div className="step-num">4</div>
                  <div className="step-content">
                    <h4>등록 완료</h4>
                    <p>등록이 완료되면 <strong>USB를 분리</strong>합니다.</p>
                    <p>이후에는 <strong>전원만 연결</strong>하면 WiFi로 자동 동작합니다.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 디바이스 페어링 */}
          <div className="guide-card">
            <div className="guide-card-header">
              <div className="guide-icon device">
                <DeviceIcon />
              </div>
              <div>
                <h3>디바이스 페어링 및 관리</h3>
                <p>허브와 데이터를 주고받을 생체 인식 센서 연결</p>
              </div>
            </div>

            <div className="guide-card-content">
              <div className="guide-visual">
                <DeviceDetailSVG />
              </div>

              <div className="guide-steps">
                <div className="guide-step">
                  <div className="step-num">1</div>
                  <div className="step-content">
                    <h4>디바이스 페어링 모드 진입</h4>
                    <p>등록할 디바이스의 전원을 켭니다. (버튼 3초 길게 누르기 → 초록색 LED)</p>
                    <p>측면 스위치를 <strong>빠르게 2번 클릭</strong>하면 파란색 LED가 깜빡이며 페어링 모드로 진입합니다.</p>
                  </div>
                </div>

                <div className="guide-step">
                  <div className="step-num">2</div>
                  <div className="step-content">
                    <h4>기기 스캔 및 검색</h4>
                    <p>웹 화면의 하드웨어 관리 메뉴에서 <strong>[디바이스 검색]</strong>을 클릭합니다.</p>
                    <p>"허브 응답 대기 중..." 메시지가 표시되면 잠시 기다려 주세요.</p>
                  </div>
                </div>

                <div className="guide-step">
                  <div className="step-num">3</div>
                  <div className="step-content">
                    <h4>기기 식별 및 이름 설정</h4>
                    <p>검색된 기기 리스트 중 <strong>[LED 깜빡이기]</strong>를 클릭하여 실제 내 손에 있는 기기가 맞는지 확인합니다.</p>
                    <p>체크박스를 클릭하여 원하는 이름(예: 사용자A, 센서1)으로 수정한 뒤 <strong>[등록하기]</strong>를 누릅니다.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 대시보드 활용 */}
          <div className="guide-card">
            <div className="guide-card-header">
              <div className="guide-icon dashboard">
                <DashboardIcon />
              </div>
              <div>
                <h3>통합 대시보드 활용</h3>
                <p>실시간 관제 및 데이터 분석</p>
              </div>
            </div>

            <div className="guide-card-content single-column">
              <div className="guide-steps">
                <div className="guide-step">
                  <div className="step-num">1</div>
                  <div className="step-content">
                    <h4>실시간 모니터링</h4>
                    <p>[대시보드] 메뉴에서 등록된 모든 기기의 심박수, 활동량, 스트레스 지수를 실시간으로 확인합니다.</p>
                  </div>
                </div>

                <div className="guide-step">
                  <div className="step-num">2</div>
                  <div className="step-content">
                    <h4>데이터 히스토리 조회</h4>
                    <p><strong>[신호 테스트]</strong> 및 <strong>[로그 데이터]</strong> 탭을 통해 누적된 생체 변화 수치를 그래프로 분석합니다.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* LED 상태 가이드 */}
        <div className="led-guide-section">
          <h2>LED 상태 표시 가이드</h2>
          <div className="led-grid">
            <div className="led-card">
              <div className="led-light blue"></div>
              <h4>파란색 LED (측정 모드)</h4>
              <p>파란불이 들어와있고 블루투스가 잡힌 상태 (측정 중)</p>
            </div>

            <div className="led-card">
              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginBottom: '1rem', alignItems: 'center' }}>
                <div className="led-light blue" style={{ width: '20px', height: '20px' }}></div>
                <div className="led-light green blink" style={{ width: '20px', height: '20px' }}></div>
              </div>
              <h4>파란색 + 초록색 깜빡임 (대기 모드)</h4>
              <p>파란불이 켜져있고 초록불이 깜빡이는 상태 (대기 중)</p>
            </div>

            <div className="led-card">
              <div className="led-light blue blink"></div>
              <h4>파란색 깜빡임</h4>
              <p>페어링 대기 모드</p>
            </div>

            <div className="led-card">
              <div style={{ display: 'flex', gap: '2px', justifyContent: 'center', marginBottom: '1rem' }}>
                <div className="led-light blue blink" style={{ width: '24px', height: '24px', borderRadius: '2px 0 0 2px' }}></div>
                <div className="led-light red blink" style={{ width: '24px', height: '24px', borderRadius: '0' }}></div>
                <div className="led-light green blink" style={{ width: '24px', height: '24px', borderRadius: '0 2px 2px 0' }}></div>
              </div>
              <h4>RGB 깜빡임</h4>
              <p>디바이스 찾기 실행 중 (3색 동시 깜빡임)</p>
            </div>

            <div className="led-card">
              <div className="led-light red"></div>
              <h4>빨간색 LED</h4>
              <p>배터리 부족 또는 오류</p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="faq-section">
          <h2>자주 묻는 질문 (FAQ)</h2>
          <div className="faq-list">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className={`faq-item ${expandedFaq === index ? 'open' : ''}`}
                onClick={() => toggleFaq(index)}
              >
                <div className="faq-header">
                  <h4>{faq.question}</h4>
                  <span className="faq-icon">{expandedFaq === index ? '−' : '+'}</span>
                </div>
                {expandedFaq === index && (
                  <div className="faq-body">
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 고객 지원 */}
        <div className="contact-section">
          <h3>추가 지원이 필요하신가요?</h3>
          <p>위의 가이드로 해결되지 않는 문제가 있다면 고객 지원팀에 문의해 주세요.</p>
          <div className="contact-buttons">
            <a href="mailto:support@example.com" className="btn-primary">이메일 문의</a>
            <a href="tel:1588-0000" className="btn-secondary">전화 문의</a>
          </div>
        </div>

        {/* 시작하기 버튼 */}
        <div className="guide-start-section">
          <button 
            onClick={() => {
              // 플래그 제거 후 대시보드로 이동
              if (user?.email) {
                localStorage.removeItem(`first_login_${user.email}`)
              }
              navigate('/dashboard')
            }} 
            className="btn-start"
            style={{
              padding: '12px 32px',
              fontSize: '16px',
              fontWeight: '600',
              backgroundColor: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              marginTop: '2rem'
            }}
          >
            시작하기
          </button>
        </div>
      </div>
    </div>
  )
}

// Guide 페이지 래퍼 - 첫 로그인 사용자와 일반 사용자 모두 접근 가능
function GuideWrapper() {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuthStore()
  const [shouldRender, setShouldRender] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [isFirstLogin, setIsFirstLogin] = useState(false)

  useEffect(() => {
    // user 정보가 로드될 때까지 기다림
    if (!isAuthenticated) {
      // 인증되지 않은 경우 로그인 페이지로 리다이렉트
      console.log('[Guide] Not authenticated, redirecting to login')
      navigate('/login')
      return
    }

    // user 정보가 아직 로드되지 않은 경우 잠시 대기
    if (!user?.email) {
      console.log('[Guide] Waiting for user info...')
      const timer = setTimeout(() => {
        if (!user?.email) {
          console.log('[Guide] User info not loaded, redirecting to login')
          navigate('/login')
        }
      }, 1000)
      return () => clearTimeout(timer)
    }

    // 첫 로그인 플래그 확인
    const firstLoginFlag = localStorage.getItem(`first_login_${user.email}`)
    console.log('[Guide] First login flag:', firstLoginFlag, 'for user:', user.email)
    
    if (firstLoginFlag === 'true') {
      // 첫 로그인인 경우 Guide 표시하고 플래그 표시
      console.log('[Guide] Showing guide for first login user')
      setIsFirstLogin(true)
      setShouldRender(true)
      setIsChecking(false)
    } else {
      // 첫 로그인이 아닌 경우에도 Guide 표시 (일반 사용자가 "사용 가이드 보기" 버튼을 눌렀을 때)
      console.log('[Guide] Showing guide for regular user')
      setIsFirstLogin(false)
      setShouldRender(true)
      setIsChecking(false)
    }
  }, [user, isAuthenticated, navigate])

  // 첫 로그인 사용자의 경우 Guide 컴포넌트가 언마운트될 때 플래그 제거
  useEffect(() => {
    return () => {
      if (user?.email && isFirstLogin) {
        console.log('[Guide] Removing first login flag for:', user.email)
        localStorage.removeItem(`first_login_${user.email}`)
      }
    }
  }, [user?.email, isFirstLogin])

  if (isChecking) {
    return (
      <div style={{ 
        padding: '2rem', 
        textAlign: 'center',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh'
      }}>
        <div>로딩 중...</div>
      </div>
    )
  }

  if (!shouldRender) {
    return null
  }

  return <Guide />
}

/* ==================== 아이콘 컴포넌트 ==================== */
function HubIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>
      <circle cx="12" cy="12" r="2" fill="white"/>
    </svg>
  )
}

function DeviceIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="8" y="4" width="8" height="16" rx="2" fill="currentColor"/>
      <circle cx="12" cy="17" r="1" fill="white"/>
      <rect x="10" y="7" width="4" height="0.5" rx="0.25" fill="white"/>
      <rect x="10" y="9" width="4" height="0.5" rx="0.25" fill="white"/>
    </svg>
  )
}

function DashboardIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="4" width="7" height="7" rx="1" fill="currentColor"/>
      <rect x="13" y="4" width="7" height="7" rx="1" fill="currentColor" opacity="0.6"/>
      <rect x="4" y="13" width="7" height="7" rx="1" fill="currentColor" opacity="0.6"/>
      <rect x="13" y="13" width="7" height="7" rx="1" fill="currentColor"/>
    </svg>
  )
}

/* ==================== SVG 다이어그램 ==================== */
function HubSVG() {
  return (
    <svg width="60" height="80" viewBox="0 0 100 120">
      <rect x="25" y="20" width="50" height="80" rx="4" fill="#F8C8DC" stroke="#333" strokeWidth="1.5"/>
      <rect x="40" y="15" width="20" height="6" rx="1" fill="#333"/>
      <circle cx="40" cy="70" r="4" fill="#4caf50"/>
      <circle cx="55" cy="50" r="3" fill="#555"/>
      <circle cx="55" cy="60" r="3" fill="#555"/>
      <rect x="32" y="98" width="8" height="4" rx="1" fill="#333" stroke="#555" strokeWidth="0.5"/>
      <rect x="60" y="98" width="8" height="4" rx="1" fill="#ddd" stroke="#999" strokeWidth="0.5"/>
      <line x1="32" y1="103" x2="40" y2="103" stroke="#4caf50" strokeWidth="1.5"/>
      <line x1="62" y1="100" x2="66" y2="100" stroke="#e74c3c" strokeWidth="1"/>
      <line x1="62" y1="100" x2="66" y2="100" stroke="#e74c3c" strokeWidth="1" transform="rotate(90 64 100)"/>
    </svg>
  )
}

function DeviceSVG() {
  return (
    <svg width="100" height="100" viewBox="0 0 100 120">
      <rect x="20" y="20" width="70" height="80" rx="6" fill="#e0e3e8" stroke="#333" strokeWidth="1.5"/>
      <circle cx="35" cy="35" r="7" fill="#333"/>
      <rect x="17" y="40" width="3" height="10" rx="1.5" fill="#2196f3"/>
      <rect x="90" y="75" width="3" height="12" rx="1" fill="#555"/>
    </svg>
  )
}

function DashboardSVG() {
  return (
    <svg width="60" height="60" viewBox="0 0 100 100">
      <rect x="10" y="10" width="35" height="35" rx="3" fill="#3498db" opacity="0.8"/>
      <rect x="55" y="10" width="35" height="35" rx="3" fill="#3498db" opacity="0.5"/>
      <rect x="10" y="55" width="35" height="35" rx="3" fill="#3498db" opacity="0.5"/>
      <rect x="55" y="55" width="35" height="35" rx="3" fill="#3498db" opacity="0.8"/>
    </svg>
  )
}

function HubDetailSVG() {
  return (
    <svg width="200" height="250" viewBox="0 0 100 140">
      {/* 본체 */}
      <rect x="20" y="20" width="66" height="110" rx="4" fill="#F8C8DC" stroke="#333" strokeWidth="2"/>

      {/* 안테나 */}
      <rect x="33" y="14" width="40" height="7" rx="1.5" fill="#333"/>
      <text x="52" y="10" fontSize="9" textAnchor="middle" fill="#666">안테나</text>

      {/* LED */}
      <circle cx="40" cy="100" r="5" fill="#4caf50" stroke="#333" strokeWidth="1"/>
      <text x="40" y="115" fontSize="9" textAnchor="middle" fill="#333">LED</text>
      {/* 리셋 버튼 */}
      <circle cx="65" cy="60" r="4" fill="#555" stroke="#333" strokeWidth="1"/>
      <text x="65" y="77" fontSize="9" textAnchor="middle" fill="#333">리셋</text>

      {/* 부팅 버튼 */}
      <circle cx="65" cy="85" r="4" fill="#555" stroke="#333" strokeWidth="1"/>
      <text x="65" y="100" fontSize="9" textAnchor="middle" fill="#333">부팅</text>

      {/* USB-C 포트 왼쪽 (사용) */}
      <rect x="30" y="130" width="19" height="5" rx="1" fill="#333" stroke="#555" strokeWidth="0.8"/>
      <text x="40" y="143" fontSize="8" textAnchor="middle" fill="#4caf50" fontWeight="bold">사용 ✓</text>

      {/* USB-C 포트 오른쪽 (미사용) */}
      <rect x="58" y="130" width="19" height="5" rx="1" fill="#ddd" stroke="#999" strokeWidth="0.8"/>
      <line x1="60" y1="135" x2="75" y2="130" stroke="#e74c3c" strokeWidth="1.5"/>
      <line x1="75" y1="135" x2="60" y2="130" stroke="#e74c3c" strokeWidth="1.5"/>
      <text x="68" y="143" fontSize="8" textAnchor="middle" fill="#e74c3c" fontWeight="bold">미사용 X</text>
    </svg>
  )
}

function DeviceDetailSVG() {
  return (
    <svg width="180" height="200" viewBox="0 0 100 140">
      {/* 본체 */}
      <rect x="10" y="15" width="80" height="100" rx="8" fill="#e0e3e8" stroke="#333" strokeWidth="2"/>

      {/* 버튼 */}
      <circle cx="25" cy="30" r="7" fill="#333"/>
      <text x="25" y="48" fontSize="9"textAnchor="middle" fill="#333">버튼</text>

      {/* LED (왼쪽) */}
      <rect x="6" y="40" width="4" height="13" rx="2" fill="#2196f3" stroke="#333" strokeWidth="1"/>
      <text x="-2" y="50" fontSize="9" textAnchor="middle" fill="#333">LED</text>

      {/* 충전 포트 (오른쪽) */}
      <rect x="90" y="85" width="4" height="16" rx="1.5" fill="#555" stroke="#333" strokeWidth="1"/>
      <text x="70" y="90" fontSize="9" fill="#333">충전</text>
      <text x="70" y="100" fontSize="9" fill="#333">포트</text>
    </svg>
  )
}

export default GuideWrapper
