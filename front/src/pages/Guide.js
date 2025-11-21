import { Link } from 'react-router-dom'
import './Guide.css'

function Guide() {
  return (
    <div className="guide-page">
      <div className="guide-container">
        <h1 className="guide-title">시스템 사용 가이드</h1>
        
        <div className="guide-steps">
          <div className="guide-step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h2>하드웨어 관리 페이지 - 허브 관리 탭에서 허브 등록하기</h2>
              <p>허브를 USB로 연결한 후 허브 등록 버튼을 클릭하여 허브를 등록합니다.</p>
              <Link to="/hardware?tab=hub" className="step-link" target="_blank">
                허브 관리 페이지로 이동
              </Link>
            </div>
          </div>

          <div className="guide-step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h2>하드웨어 관리 페이지 - 디바이스 관리 탭에서 디바이스 등록하기</h2>
              <p>허브를 디바이스 등록 모드로 전환한 후 디바이스를 검색하고 등록합니다.</p>
              <Link to="/hardware?tab=device" className="step-link" target="_blank">
                디바이스 관리 페이지로 이동
              </Link>
            </div>
          </div>

          <div className="guide-step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h2>환자 관리 페이지에서 환자 등록하기</h2>
              <p>입원한 환자의 정보를 등록하고 디바이스와 연결합니다.</p>
              <Link to="/patients" className="step-link" target="_blank">
                환자 관리 페이지로 이동
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Guide

