import { useState } from 'react'
import Header from '../components/Header'
import { dummyRecords, dummyPatients, dummyDevices } from '../data/dummyData'
import './Records.css'

function Records() {
  const [records] = useState(dummyRecords)
  const [sortBy, setSortBy] = useState('date') // date, patient, device
  const [selectedRecords, setSelectedRecords] = useState([])
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedPatient, setSelectedPatient] = useState('')
  const [patientSearch, setPatientSearch] = useState('')
  const [selectedDevice, setSelectedDevice] = useState('')

  // 필터링 및 정렬된 레코드
  let filteredRecords = [...records]

  // 날짜 필터
  if (sortBy === 'date' && selectedDate) {
    filteredRecords = filteredRecords.filter(record => {
      const recordDate = record.createdAt.split(' ')[0]
      return recordDate === selectedDate
    })
  }

  // 환자 필터
  if (sortBy === 'patient') {
    if (selectedPatient) {
      const patient = dummyPatients.find(p => p.id === selectedPatient)
      if (patient) {
        filteredRecords = filteredRecords.filter(record => 
          record.patientName === patient.name
        )
      }
    }
    if (patientSearch) {
      filteredRecords = filteredRecords.filter(record =>
        record.patientName.toLowerCase().includes(patientSearch.toLowerCase())
      )
    }
  }

  // 디바이스 필터
  if (sortBy === 'device' && selectedDevice) {
    const device = dummyDevices.find(d => d.id === selectedDevice)
    if (device) {
      filteredRecords = filteredRecords.filter(record => 
        record.deviceName === device.name
      )
    }
  }

  // 정렬 (최신순으로 고정)
  const sortedRecords = filteredRecords.sort((a, b) => {
    let comparison = 0
    if (sortBy === 'date') {
      comparison = new Date(a.createdAt) - new Date(b.createdAt)
    } else if (sortBy === 'patient') {
      comparison = a.patientName.localeCompare(b.patientName)
    } else if (sortBy === 'device') {
      comparison = a.deviceName.localeCompare(b.deviceName)
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

  const handleDownload = (recordId) => {
    // 더미: 다운로드 처리
    console.log('Download:', recordId)
  }

  const handleDownloadSelected = () => {
    // 더미: 선택된 파일 다운로드
    console.log('Download selected:', selectedRecords)
  }

  const handleDelete = (recordId) => {
    // 더미: 삭제 처리
    console.log('Delete:', recordId)
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
              // 정렬 기준 변경 시 필터 초기화
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
                    {dummyPatients.map(patient => (
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
                  {dummyDevices.map(device => (
                    <option key={device.id} value={device.id}>
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
                  <td>{record.patientName}</td>
                  <td>{record.deviceName}</td>
                  <td>{record.startDate}</td>
                  <td>{record.endDate}</td>
                  <td>{record.fileSize}</td>
                  <td>
                    <div className="action-buttons">
                      <button 
                        className="btn-download"
                        onClick={() => handleDownload(record.id)}
                      >
                        다운로드
                      </button>
                      <button 
                        className="btn-delete"
                        onClick={() => handleDelete(record.id)}
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

