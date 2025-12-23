import { useState, useEffect } from 'react'
import Header from '../components/Header'
import recordsService from '../api/recordsService'
import HrvDetail from '../components/hrv/HrvDetail'
import './HrvAnalysis.css'

function HrvAnalysis() {
  
  // CSV 파일 관련 상태
  const [csvFiles, setCsvFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [isLoadingCsv, setIsLoadingCsv] = useState(false)
  
  // IR 데이터
  const [irData, setIrData] = useState([])
  
  // CSV 파일 목록 로드 (Records 페이지와 동일한 API 사용)
  const loadCsvFiles = async () => {
    try {
      setIsLoadingFiles(true)
      const files = await recordsService.getCsvFiles()
      setCsvFiles(files)
    } catch (error) {
      console.error('[HRV] CSV 파일 목록 로드 오류:', error)
      alert('CSV 파일 목록을 불러오는데 실패했습니다.')
    } finally {
      setIsLoadingFiles(false)
    }
  }
  
  // CSV 파일 선택 및 처리
  const handleCsvFileSelect = async (file) => {
    try {
      setIsLoadingCsv(true)
      setSelectedFile(file)
      setIrData([]) // 기존 데이터 초기화
      
      // Records API와 호환되도록 파일 다운로드
      const fileData = await fetchCsvFileContent(file.relativePath)
      
      if (!fileData || !fileData.content) {
        throw new Error('파일 내용을 가져올 수 없습니다.')
      }
      
      const content = fileData.content
      
      // CSV 파싱
      const rows = content.split('\n').filter(row => row.trim() !== '')
      
      if (rows.length === 0) {
        throw new Error('CSV 파일이 비어있습니다.')
      }
      
      // 헤더가 있는 경우 제거 (첫 번째 행이 헤더인지 확인)
      let startIndex = 0
      if (rows[0].toLowerCase().includes('time') || rows[0].toLowerCase().includes('ir')) {
        startIndex = 1
      }
      
      const parsedData = rows.slice(startIndex).map((row, index) => {
        const columns = row.split(',')
        
        const safeParseInt = (value, defaultValue = null) => {
          if (!value || value.trim() === '') return defaultValue
          const parsed = parseInt(value.trim())
          return !isNaN(parsed) && parsed !== null && parsed !== undefined ? parsed : defaultValue
        }
        
        const safeParseFloat = (value, defaultValue = null) => {
          if (!value || value.trim() === '') return defaultValue
          const parsed = parseFloat(value.trim())
          return !isNaN(parsed) && parsed !== null && parsed !== undefined ? parsed : defaultValue
        }
        
        return {
          index: index + 1,
          time: columns[0]?.trim() || '',
          cnt: safeParseInt(columns[1], null),
          ir: safeParseInt(columns[2], null),
          red: safeParseInt(columns[3], null),
          green: safeParseInt(columns[4], null),
          spo2: safeParseFloat(columns[5], null),
          hr: safeParseInt(columns[6], null),
          temp: safeParseFloat(columns[7], null),
        }
      })
      
      // IR 데이터만 추출 (유효한 IR 데이터만, 0 초과)
      const chartData = parsedData
        .filter(item => item.ir !== null && item.ir !== undefined && !isNaN(item.ir) && item.ir > 0)
        .map((item, index) => ({
          index: index + 1,
          ir: item.ir,
          time: item.time,
          cnt: item.cnt,
          red: item.red,
          green: item.green,
          spo2: item.spo2,
          hr: item.hr,
          temp: item.temp,
        }))
      
      if (chartData.length === 0) {
        throw new Error('유효한 IR 데이터가 없습니다.')
      }
      
      setIrData(chartData)
    } catch (error) {
      console.error('[HRV] CSV 파일 처리 오류:', error)
      const errorMessage = error.response?.data?.message || error.message || 'CSV 파일을 처리하는 중 오류가 발생했습니다.'
      alert(errorMessage)
    } finally {
      setIsLoadingCsv(false)
    }
  }
  
  // 초기 데이터 로드
  useEffect(() => {
    loadCsvFiles()
  }, [])
  
  // CSV 파일 내용 가져오기
  const fetchCsvFileContent = async (relativePath) => {
    try {
      const token = localStorage.getItem('auth-storage')
      let authToken = ''
      
      if (token) {
        try {
          const { state } = JSON.parse(token)
          authToken = state?.token || ''
        } catch (e) {
          console.error('Failed to parse token:', e)
        }
      }

      const { API_URL } = await import('../constants')
      const url = `${API_URL}/csv/download?path=${encodeURIComponent(relativePath)}`
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (!response.ok) {
        throw new Error('파일 다운로드 실패')
      }

      const content = await response.text()
      return { content }
    } catch (error) {
      console.error('[HRV] 파일 다운로드 오류:', error)
      throw error
    }
  }

  // 파일명 포맷팅: "디바이스 이름 - 환자명" (Records 페이지와 동일)
  const formatFileName = (file) => {
    if (!file) return ''
    // Records 페이지와 동일한 형식
    return `${file.deviceName || file.device || ''} - ${file.pet || ''}`
  }
  
  return (
    <div className="hrv-analysis-page">
      <Header />
      <div className="hrv-analysis-container">
        <div className="hrv-analysis-header">
          <h1>HRV (심박변이도) 분석</h1>
        </div>
        
        <div className="csv-mode-section">
          <div className="file-list-section">
            <div className="section-header">
              <h2>CSV 파일 목록</h2>
              <button className="btn-refresh" onClick={loadCsvFiles} disabled={isLoadingFiles}>
                {isLoadingFiles ? '로딩 중...' : '새로고침'}
              </button>
            </div>
            
            {isLoadingFiles ? (
              <div className="loading">파일 목록을 불러오는 중...</div>
            ) : csvFiles.length === 0 ? (
              <div className="no-data">저장된 CSV 파일이 없습니다.</div>
            ) : (
              <div className="file-list">
                {csvFiles.map((file, index) => (
                  <div
                    key={index}
                    className={`file-item ${selectedFile?.originalFileName === file.filename || selectedFile?.filename === file.filename ? 'selected' : ''}`}
                    onClick={() => handleCsvFileSelect(file)}
                  >
                    <div className="file-info">
                      <div className="file-name">{formatFileName(file)}</div>
                      <div className="file-meta">
                        <span>날짜: {file.date}</span>
                        <span>크기: {(file.size / 1024).toFixed(2)} KB</span>
                      </div>
                    </div>
                    {isLoadingCsv && (selectedFile?.originalFileName === file.filename || selectedFile?.filename === file.filename) && (
                      <div className="loading-indicator">처리 중...</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {selectedFile && (
            <div className="selected-file-info">
              <h3>선택된 파일: {formatFileName(selectedFile)}</h3>
              {isLoadingCsv && <p>파일을 처리하는 중...</p>}
            </div>
          )}
        </div>
        
        {/* HRV 분석 결과 */}
        {irData.length > 0 && (
          <div className="hrv-results-section">
            <HrvDetail irData={irData} />
          </div>
        )}
        
        {irData.length === 0 && !isLoadingCsv && selectedFile && (
          <div className="no-data">유효한 IR 데이터가 없습니다.</div>
        )}
      </div>
    </div>
  )
}

export default HrvAnalysis

