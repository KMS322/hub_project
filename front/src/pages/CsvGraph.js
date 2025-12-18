import { useState } from 'react'
import Header from '../components/Header'
import recordsService from '../api/recordsService'
import './CsvGraph.css'

function CsvGraph() {
  const [form, setForm] = useState({
    user_email: '',
    date: '',
    device_mac_address: '',
    pet_name: '',
    start_time: ''
  })

  const [data, setData] = useState([])
  const [activeSeries, setActiveSeries] = useState('ir') // ir, red, green, hr, spo2, temp
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleLoad = async () => {
    setError('')
    setData([])

    if (!form.user_email || !form.date || !form.device_mac_address || !form.pet_name || !form.start_time) {
      setError('모든 필드를 입력해주세요.')
      return
    }

    try {
      setLoading(true)
      const csvData = await recordsService.getCsvContent(form)
      setData(csvData)
      if (!csvData.length) {
        setError('CSV 데이터가 없습니다.')
      }
    } catch (err) {
      console.error('[CsvGraph] Error loading CSV:', err)
      setError(err.message || 'CSV 데이터를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const getChartData = () => {
    return data.map(d => ({
      time: d.time,
      value: d[activeSeries] || 0
    }))
  }

  const seriesOptions = [
    { key: 'ir', label: 'IR' },
    { key: 'red', label: 'RED' },
    { key: 'green', label: 'GREEN' },
    { key: 'hr', label: '심박수' },
    { key: 'spo2', label: 'SpO₂' },
    { key: 'temp', label: '온도' }
  ]

  const renderedChartData = getChartData()

  return (
    <div className="csv-graph-page">
      <Header />
      <div className="csv-graph-container">
        <h2 className="csv-graph-title">CSV 그래프 뷰어 (임시)</h2>

        <div className="csv-graph-panel">
          <div className="csv-graph-form">
            <div className="form-row">
              <label>사용자 이메일</label>
              <input
                type="text"
                name="user_email"
                value={form.user_email}
                onChange={handleChange}
                placeholder="예: a@a.com"
              />
            </div>
            <div className="form-row">
              <label>날짜</label>
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
              />
            </div>
            <div className="form-row">
              <label>디바이스 MAC</label>
              <input
                type="text"
                name="device_mac_address"
                value={form.device_mac_address}
                onChange={handleChange}
                placeholder="AA:BB:CC:DD:EE:01"
              />
            </div>
            <div className="form-row">
              <label>펫 이름</label>
              <input
                type="text"
                name="pet_name"
                value={form.pet_name}
                onChange={handleChange}
                placeholder="펫 이름"
              />
            </div>
            <div className="form-row">
              <label>시작 시간</label>
              <input
                type="text"
                name="start_time"
                value={form.start_time}
                onChange={handleChange}
                placeholder="HH:mm:ss:SSS (예: 17:36:45:163)"
              />
            </div>
            <div className="form-actions">
              <button
                className="btn-primary"
                onClick={handleLoad}
                disabled={loading}
              >
                {loading ? '불러오는 중...' : 'CSV 불러오기'}
              </button>
            </div>
            {error && <div className="csv-graph-error">{error}</div>}
          </div>

          <div className="csv-graph-chart-section">
            <div className="chart-tabs">
              {seriesOptions.map(s => (
                <button
                  key={s.key}
                  className={activeSeries === s.key ? 'chart-tab active' : 'chart-tab'}
                  onClick={() => setActiveSeries(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="chart-container">
              <div className="chart-header">
                <h3>
                  {seriesOptions.find(s => s.key === activeSeries)?.label || ''}
                </h3>
                {renderedChartData.length > 0 && (
                  <div className="current-value">
                    현재 값: {renderedChartData[renderedChartData.length - 1].value.toFixed(2)}
                  </div>
                )}
              </div>
              <div className="chart-area">
                {renderedChartData.length > 1 ? (
                  <>
                    <svg className="chart-svg" viewBox="0 0 800 300" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#6a11cb" />
                          <stop offset="50%" stopColor="#2575fc" />
                          <stop offset="100%" stopColor="#00c9ff" />
                        </linearGradient>
                      </defs>
                      <polyline
                        fill="none"
                        stroke="url(#lineGradient)"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        points={renderedChartData.map((d, i) => {
                          const x = (i / (renderedChartData.length - 1)) * 800
                          const values = renderedChartData.map(d => d.value)
                          const maxValue = Math.max(...values)
                          const minValue = Math.min(...values)
                          const range = maxValue - minValue || 1
                          const y = 280 - ((d.value - minValue) / range) * 260 + 10
                          return `${x},${y}`
                        }).join(' ')}
                      />
                    </svg>
                    <div className="chart-labels">
                      {renderedChartData.filter((_, i) => i % 20 === 0).map((d, i) => (
                        <div key={i} className="chart-label">{d.time}</div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="chart-empty">CSV 데이터를 불러오면 여기에서 그래프가 표시됩니다.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CsvGraph


