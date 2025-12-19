import { useState, useEffect } from 'react'
import Header from '../components/Header'
import recordsService from '../api/recordsService'
import petService from '../api/petService'
import deviceService from '../api/deviceService'
import './Records.css'

function Records() {
  const [records, setRecords] = useState([])
  const [patients, setPatients] = useState([])
  const [devices, setDevices] = useState([])
  const [sortBy, setSortBy] = useState('date') // date, patient, device
  const [selectedRecords, setSelectedRecords] = useState([])
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedPatient, setSelectedPatient] = useState('')
  const [patientSearch, setPatientSearch] = useState('')
  const [selectedDevice, setSelectedDevice] = useState('')
  const [loading, setLoading] = useState(true)

  // 데이터 로드
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [csvFilesData, patientsData, devicesData] = await Promise.all([
        recordsService.getCsvFiles(),
        petService.getPets(),
        deviceService.getDevices()
      ])
      
      // CSV 파일 데이터를 Records 형식으로 변환
      const recordsData = csvFilesData.map((file, index) => {
        // 파일명에서 시작 시간 추출 (예: e1_fa_51_49_1a_9a-000527074.csv)
        const timeMatch = file.filename.match(/-(\d{9})\.csv$/)
        const startTimeStr = timeMatch ? timeMatch[1] : null
        let startTime = null
        if (startTimeStr) {
          try {
            const hours = parseInt(startTimeStr.substring(0, 2))
            const minutes = parseInt(startTimeStr.substring(2, 4))
            const seconds = parseInt(startTimeStr.substring(4, 6))
            const milliseconds = parseInt(startTimeStr.substring(6, 9))
            const today = new Date()
            today.setHours(hours, minutes, seconds, milliseconds)
            startTime = today.toISOString()
          } catch (e) {
            console.warn('Failed to parse start time:', e)
          }
        }
        
        // 디바이스 이름 찾기
        const device = devicesData.find(d => {
          const normalizeMac = (mac) => mac.replace(/[:-]/g, '_').toLowerCase()
          return normalizeMac(d.address) === normalizeMac(file.device)
        })
        const deviceName = device?.name || file.device
        
        // 환자 이름 찾기
        const patient = patientsData.find(p => p.name === file.pet)
        const patientName = patient?.name || file.pet
        
        // 파일 크기 포맷팅
        const formatFileSize = (bytes) => {
          if (bytes < 1024) return `${bytes} B`
          if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
          return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
        }
        
        return {
          id: index + 1,
          fileName: file.filename,
          relativePath: file.relativePath,
          date: file.date,
          deviceAddress: file.device,
          deviceName: deviceName,
          patientName: patientName,
          startTime: startTime,
          endTime: file.mtime ? new Date(file.mtime).toISOString() : null,
          fileSize: formatFileSize(file.size),
          recordCount: '-', // CSV 파일에서 레코드 수를 읽어야 함 (나중에 구현 가능)
          size: file.size,
          mtime: file.mtime
        }
      })
      
      setRecords(recordsData)
      setPatients(patientsData)
      setDevices(devicesData)
    } catch (error) {
      console.error('Failed to load data:', error)
      alert('CSV 파일 목록을 불러오는데 실패했습니다: ' + (error.message || '알 수 없는 오류'))
    } finally {
      setLoading(false)
    }
  }

  // 필터링 및 정렬된 레코드
  let filteredRecords = [...records]

  // 날짜 필터
  if (sortBy === 'date' && selectedDate) {
    filteredRecords = filteredRecords.filter(record => {
      return record.date === selectedDate
    })
  }

  // 환자 필터
  if (sortBy === 'patient') {
    if (selectedPatient) {
      const patient = patients.find(p => p.id === parseInt(selectedPatient))
      if (patient) {
        filteredRecords = filteredRecords.filter(record => 
          record.patientName === patient.name
        )
      }
    }
    if (patientSearch) {
      filteredRecords = filteredRecords.filter(record =>
        record.patientName && record.patientName.toLowerCase().includes(patientSearch.toLowerCase())
      )
    }
  }

  // 디바이스 필터
  if (sortBy === 'device' && selectedDevice) {
    filteredRecords = filteredRecords.filter(record => 
      record.deviceAddress === selectedDevice
    )
  }

  // 정렬 (최신순으로 고정)
  const sortedRecords = filteredRecords.sort((a, b) => {
    let comparison = 0
    if (sortBy === 'date') {
      // 날짜가 같으면 mtime으로 정렬
      const dateComparison = a.date.localeCompare(b.date)
      if (dateComparison === 0 && a.mtime && b.mtime) {
        comparison = new Date(a.mtime) - new Date(b.mtime)
      } else {
        comparison = dateComparison
      }
    } else if (sortBy === 'patient') {
      comparison = (a.patientName || '').localeCompare(b.patientName || '')
    } else if (sortBy === 'device') {
      comparison = (a.deviceName || '').localeCompare(b.deviceName || '')
    }
    return -comparison // 최신순 (desc)
  })

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedRecords(sortedRecords.map(r => r.id))
    } else {
      setSelectedRecords([])
    }
  }

  const handleSelectRecord = (recordId) => {
    if (selectedRecords.includes(recordId)) {
      setSelectedRecords(selectedRecords.filter(id => id !== recordId))
    } else {
      setSelectedRecords([...selectedRecords, recordId])
    }
  }

  const handleDownload = async (record) => {
    try {
      if (record.relativePath) {
        await recordsService.downloadCsvFile(record.relativePath)
      } else {
        // 레거시 지원
        await recordsService.downloadFile(record.fileName)
      }
    } catch (error) {
      alert('다운로드 실패: ' + (error.message || '알 수 없는 오류'))
    }
  }

  const handleDownloadSelected = async () => {
    try {
      for (const recordId of selectedRecords) {
        const record = sortedRecords.find(r => r.id === recordId)
        if (record) {
          if (record.relativePath) {
            await recordsService.downloadCsvFile(record.relativePath)
          } else {
            // 레거시 지원
            await recordsService.downloadFile(record.fileName)
          }
        }
      }
      setSelectedRecords([])
    } catch (error) {
      alert('다운로드 실패: ' + (error.message || '알 수 없는 오류'))
    }
  }

  const handleDelete = async (fileName) => {
    if (!confirm('이 파일을 삭제하시겠습니까?')) return

    try {
      await recordsService.deleteFile(fileName)
      loadData()
    } catch (error) {
      alert('삭제 실패: ' + (error.message || '알 수 없는 오류'))
    }
  }

  if (loading) {
    return (
      <div className="records-page">
        <Header />
        <div className="records-container">
          <div className="loading">데이터를 불러오는 중...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="records-page">
      <Header />
      <div className="records-container">
        <div className="records-header">
          {selectedRecords.length > 0 && (
            <button className="btn-primary" onClick={handleDownloadSelected}>
              선택한 파일 다운로드 ({selectedRecords.length})
            </button>
          )}
        </div>

        <div className="records-controls">
          <div className="sort-controls">
            <label>정렬 기준:</label>
            <select value={sortBy} onChange={(e) => {
              setSortBy(e.target.value)
              setSelectedDate('')
              setSelectedPatient('')
              setPatientSearch('')
              setSelectedDevice('')
            }}>
              <option value="date">날짜</option>
              <option value="patient">환자</option>
              <option value="device">디바이스</option>
            </select>
            
            {/* 날짜 선택 시 달력 표시 */}
            {sortBy === 'date' && (
              <div className="filter-control">
                <label>날짜 선택:</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="date-input"
                />
              </div>
            )}

            {/* 환자 선택 시 환자 select와 검색창 표시 */}
            {sortBy === 'patient' && (
              <>
                <div className="filter-control">
                  <label>환자 선택:</label>
                  <select 
                    value={selectedPatient} 
                    onChange={(e) => setSelectedPatient(e.target.value)}
                    className="patient-select"
                  >
                    <option value="">전체</option>
                    {patients.filter(p => p.device_address).map(patient => (
                      <option key={patient.id} value={patient.id}>
                        {patient.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="filter-control">
                  <label>검색:</label>
                  <input
                    type="text"
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    placeholder="환자명 검색"
                    className="search-input"
                  />
                </div>
              </>
            )}

            {/* 디바이스 선택 시 디바이스 select 표시 */}
            {sortBy === 'device' && (
              <div className="filter-control">
                <label>디바이스 선택:</label>
                <select 
                  value={selectedDevice} 
                  onChange={(e) => setSelectedDevice(e.target.value)}
                  className="device-select"
                >
                  <option value="">전체</option>
                  {devices.map(device => (
                    <option key={device.address} value={device.address}>
                      {device.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="records-table-container">
          <table className="records-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectedRecords.length === sortedRecords.length && sortedRecords.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th>파일명</th>
                <th>환자</th>
                <th>디바이스</th>
                <th>시작 시간</th>
                <th>종료 시간</th>
                <th>파일 크기</th>
                <th>레코드 수</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {sortedRecords.map(record => (
                <tr key={record.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedRecords.includes(record.id)}
                      onChange={() => handleSelectRecord(record.id)}
                    />
                  </td>
                  <td>{record.fileName}</td>
                  <td>{record.patientName || '-'}</td>
                  <td>{record.deviceName || record.deviceAddress}</td>
                  <td>{record.startTime ? new Date(record.startTime).toLocaleString('ko-KR') : '-'}</td>
                  <td>{record.endTime ? new Date(record.endTime).toLocaleString('ko-KR') : '-'}</td>
                  <td>{record.fileSize}</td>
                  <td>{record.recordCount}</td>
                  <td>
                    <div className="action-buttons">
                      <button 
                        className="btn-download"
                        onClick={() => handleDownload(record)}
                      >
                        다운로드
                      </button>
                      <button 
                        className="btn-delete"
                        onClick={() => handleDelete(record.fileName)}
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sortedRecords.length === 0 && (
          <div className="no-data">기록이 없습니다.</div>
        )}
      </div>
    </div>
  )
}

export default Records
