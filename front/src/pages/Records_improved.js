import { useState, useEffect, useMemo } from 'react'
import Header from '../components/Header'
import recordsService from '../api/recordsService'
import petService from '../api/petService'
import deviceService from '../api/deviceService'
import { useToast } from '../components/ToastContainer'
import LoadingSpinner from '../components/LoadingSpinner'
import { SkeletonTable } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import ConfirmModal from '../components/ConfirmModal'
import './Records.css'

function Records() {
  const { success, error: showError } = useToast()
  const [records, setRecords] = useState([])
  const [patients, setPatients] = useState([])
  const [devices, setDevices] = useState([])
  const [sortBy, setSortBy] = useState('date')
  const [sortOrder, setSortOrder] = useState('desc') // 'asc' | 'desc'
  const [sortColumn, setSortColumn] = useState(null)
  const [selectedRecords, setSelectedRecords] = useState([])
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedPatient, setSelectedPatient] = useState('')
  const [patientSearch, setPatientSearch] = useState('')
  const [selectedDevice, setSelectedDevice] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, record: null })
  const [downloading, setDownloading] = useState(false)

  // 데이터 로드
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [csvFilesData, patientsData, devicesData] = await Promise.all([
        recordsService.getCsvFiles(),
        petService.getPets(),
        deviceService.getDevices()
      ])
      
      const recordsData = csvFilesData.map((file, index) => {
        const formatFileSize = (bytes) => {
          if (bytes < 1024) return `${bytes} B`
          if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
          return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
        }
        
        const displayFileName = `${file.deviceName || file.device} - ${file.pet}`
        
        return {
          id: index + 1,
          fileName: displayFileName,
          originalFileName: file.filename,
          relativePath: file.relativePath,
          date: file.date,
          deviceAddress: file.deviceAddress || file.device,
          deviceName: file.deviceName || file.device,
          patientName: file.pet,
          startTime: file.startTime || null,
          endTime: file.endTime || null,
          fileSize: formatFileSize(file.size),
          recordCount: file.recordCount || 0,
          size: file.size,
          mtime: file.mtime
        }
      })
      
      setRecords(recordsData)
      setPatients(patientsData)
      setDevices(devicesData)
    } catch (err) {
      console.error('Failed to load data:', err)
      setError(err)
      showError('CSV 파일 목록을 불러오는데 실패했습니다: ' + (err.message || '알 수 없는 오류'))
    } finally {
      setLoading(false)
    }
  }

  // 필터링
  const filteredRecords = useMemo(() => {
    let filtered = [...records]

    if (sortBy === 'date' && selectedDate) {
      filtered = filtered.filter(record => record.date === selectedDate)
    }

    if (sortBy === 'patient') {
      if (selectedPatient) {
        const patient = patients.find(p => p.id === parseInt(selectedPatient))
        if (patient) {
          filtered = filtered.filter(record => record.patientName === patient.name)
        }
      }
      if (patientSearch) {
        filtered = filtered.filter(record =>
          record.patientName && record.patientName.toLowerCase().includes(patientSearch.toLowerCase())
        )
      }
    }

    if (sortBy === 'device' && selectedDevice) {
      filtered = filtered.filter(record => record.deviceAddress === selectedDevice)
    }

    return filtered
  }, [records, sortBy, selectedDate, selectedPatient, patientSearch, selectedDevice, patients])

  // 정렬
  const sortedRecords = useMemo(() => {
    const sorted = [...filteredRecords]
    
    if (sortColumn) {
      sorted.sort((a, b) => {
        let comparison = 0
        
        switch (sortColumn) {
          case 'fileName':
            comparison = (a.fileName || '').localeCompare(b.fileName || '')
            break
          case 'patientName':
            comparison = (a.patientName || '').localeCompare(b.patientName || '')
            break
          case 'deviceName':
            comparison = (a.deviceName || '').localeCompare(b.deviceName || '')
            break
          case 'startTime':
            comparison = (a.startTime ? new Date(a.startTime).getTime() : 0) - 
                        (b.startTime ? new Date(b.startTime).getTime() : 0)
            break
          case 'endTime':
            comparison = (a.endTime ? new Date(a.endTime).getTime() : 0) - 
                        (b.endTime ? new Date(b.endTime).getTime() : 0)
            break
          case 'fileSize':
            comparison = (a.size || 0) - (b.size || 0)
            break
          case 'recordCount':
            comparison = (a.recordCount || 0) - (b.recordCount || 0)
            break
          case 'date':
          default:
            const dateComparison = a.date.localeCompare(b.date)
            if (dateComparison === 0 && a.mtime && b.mtime) {
              comparison = new Date(a.mtime) - new Date(b.mtime)
            } else {
              comparison = dateComparison
            }
        }
        
        return sortOrder === 'asc' ? comparison : -comparison
      })
    } else {
      // 기본 정렬: 날짜 최신순
      sorted.sort((a, b) => {
        const dateComparison = a.date.localeCompare(b.date)
        if (dateComparison === 0 && a.mtime && b.mtime) {
          return new Date(b.mtime) - new Date(a.mtime)
        }
        return -dateComparison
      })
    }
    
    return sorted
  }, [filteredRecords, sortColumn, sortOrder])

  // 페이지네이션
  const totalPages = Math.ceil(sortedRecords.length / itemsPerPage)
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return sortedRecords.slice(startIndex, startIndex + itemsPerPage)
  }, [sortedRecords, currentPage, itemsPerPage])

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortOrder('asc')
    }
    setCurrentPage(1)
  }

  const getSortIcon = (column) => {
    if (sortColumn !== column) return '↕️'
    return sortOrder === 'asc' ? '↑' : '↓'
  }

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedRecords(paginatedRecords.map(r => r.id))
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
      setDownloading(true)
      if (record.relativePath) {
        await recordsService.downloadCsvFile(record.relativePath)
      } else {
        await recordsService.downloadFile(record.fileName)
      }
      success('파일이 다운로드되었습니다.')
    } catch (err) {
      showError('다운로드 실패: ' + (err.message || '알 수 없는 오류'))
    } finally {
      setDownloading(false)
    }
  }

  const handleDownloadSelected = async () => {
    if (selectedRecords.length === 0) {
      showError('다운로드할 파일을 선택해주세요.')
      return
    }

    try {
      setDownloading(true)
      let successCount = 0
      for (const recordId of selectedRecords) {
        const record = sortedRecords.find(r => r.id === recordId)
        if (record) {
          try {
            if (record.relativePath) {
              await recordsService.downloadCsvFile(record.relativePath)
            } else {
              await recordsService.downloadFile(record.fileName)
            }
            successCount++
          } catch (err) {
            console.error(`Failed to download ${record.fileName}:`, err)
          }
        }
      }
      setSelectedRecords([])
      if (successCount > 0) {
        success(`${successCount}개 파일이 다운로드되었습니다.`)
      } else {
        showError('다운로드에 실패했습니다.')
      }
    } catch (err) {
      showError('다운로드 실패: ' + (err.message || '알 수 없는 오류'))
    } finally {
      setDownloading(false)
    }
  }

  const handleDeleteClick = (record) => {
    setDeleteModal({ isOpen: true, record })
  }

  const handleDeleteConfirm = async () => {
    const { record } = deleteModal
    if (!record) return

    try {
      const fileNameToDelete = record.originalFileName || record.fileName
      await recordsService.deleteFile(fileNameToDelete)
      success('파일이 삭제되었습니다.')
      setDeleteModal({ isOpen: false, record: null })
      loadData()
    } catch (err) {
      showError('삭제 실패: ' + (err.message || '알 수 없는 오류'))
      setDeleteModal({ isOpen: false, record: null })
    }
  }

  const handleFilterReset = () => {
    setSelectedDate('')
    setSelectedPatient('')
    setPatientSearch('')
    setSelectedDevice('')
    setSortBy('date')
    setSortColumn(null)
    setSortOrder('desc')
    setCurrentPage(1)
  }

  if (loading) {
    return (
      <div className="records-page">
        <Header />
        <div className="records-container">
          <SkeletonTable rows={5} columns={9} />
        </div>
      </div>
    )
  }

  if (error && records.length === 0) {
    return (
      <div className="records-page">
        <Header />
        <div className="records-container">
          <ErrorState 
            title="데이터를 불러올 수 없습니다"
            message={error.message || '서버와의 연결에 문제가 발생했습니다.'}
            onRetry={loadData}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="records-page">
      <Header />
      <div className="records-container">
        <div className="records-header">
          <h1 className="page-title">기록 관리</h1>
          <div className="header-actions">
            {(selectedDate || selectedPatient || patientSearch || selectedDevice) && (
              <button 
                className="btn-secondary btn-reset-filter"
                onClick={handleFilterReset}
                aria-label="필터 초기화"
              >
                필터 초기화
              </button>
            )}
            {selectedRecords.length > 0 && (
              <button 
                className="btn-primary" 
                onClick={handleDownloadSelected}
                disabled={downloading}
                aria-label={`선택한 ${selectedRecords.length}개 파일 다운로드`}
              >
                {downloading ? '다운로드 중...' : `선택한 파일 다운로드 (${selectedRecords.length})`}
              </button>
            )}
          </div>
        </div>

        <div className="records-controls">
          <div className="sort-controls">
            <label htmlFor="sort-by-select">정렬 기준:</label>
            <select 
              id="sort-by-select"
              value={sortBy} 
              onChange={(e) => {
                setSortBy(e.target.value)
                setSelectedDate('')
                setSelectedPatient('')
                setPatientSearch('')
                setSelectedDevice('')
                setCurrentPage(1)
              }}
              aria-label="정렬 기준 선택"
            >
              <option value="date">날짜</option>
              <option value="patient">환자</option>
              <option value="device">디바이스</option>
            </select>
            
            {sortBy === 'date' && (
              <div className="filter-control">
                <label htmlFor="date-input">날짜 선택:</label>
                <input
                  id="date-input"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="date-input"
                  aria-label="날짜 선택"
                />
              </div>
            )}

            {sortBy === 'patient' && (
              <>
                <div className="filter-control">
                  <label htmlFor="patient-select">환자 선택:</label>
                  <select 
                    id="patient-select"
                    value={selectedPatient} 
                    onChange={(e) => {
                      setSelectedPatient(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="patient-select"
                    aria-label="환자 선택"
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
                  <label htmlFor="patient-search">검색:</label>
                  <input
                    id="patient-search"
                    type="text"
                    value={patientSearch}
                    onChange={(e) => {
                      setPatientSearch(e.target.value)
                      setCurrentPage(1)
                    }}
                    placeholder="환자명 검색"
                    className="search-input"
                    aria-label="환자명 검색"
                  />
                </div>
              </>
            )}

            {sortBy === 'device' && (
              <div className="filter-control">
                <label htmlFor="device-select">디바이스 선택:</label>
                <select 
                  id="device-select"
                  value={selectedDevice} 
                  onChange={(e) => {
                    setSelectedDevice(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="device-select"
                  aria-label="디바이스 선택"
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
          {sortedRecords.length === 0 ? (
            <EmptyState
              icon="📋"
              title="기록이 없습니다"
              message={selectedDate || selectedPatient || selectedDevice 
                ? "선택한 필터 조건에 맞는 기록이 없습니다. 필터를 변경해보세요."
                : "아직 저장된 기록이 없습니다. 첫 번째 측정을 시작해보세요!"}
              actionLabel={selectedDate || selectedPatient || selectedDevice ? "필터 초기화" : null}
              onAction={selectedDate || selectedPatient || selectedDevice ? handleFilterReset : null}
            />
          ) : (
            <>
              <div className="table-info">
                <span>총 {sortedRecords.length}개 기록</span>
                {totalPages > 1 && (
                  <span>페이지 {currentPage} / {totalPages}</span>
                )}
              </div>
              <div className="table-wrapper">
                <table className="records-table" role="table">
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={selectedRecords.length === paginatedRecords.length && paginatedRecords.length > 0}
                          onChange={handleSelectAll}
                          aria-label="전체 선택"
                        />
                      </th>
                      <th>
                        <button 
                          className="sortable-header"
                          onClick={() => handleSort('fileName')}
                          aria-label="파일명으로 정렬"
                        >
                          파일명 {getSortIcon('fileName')}
                        </button>
                      </th>
                      <th>
                        <button 
                          className="sortable-header"
                          onClick={() => handleSort('patientName')}
                          aria-label="환자명으로 정렬"
                        >
                          환자 {getSortIcon('patientName')}
                        </button>
                      </th>
                      <th>
                        <button 
                          className="sortable-header"
                          onClick={() => handleSort('deviceName')}
                          aria-label="디바이스명으로 정렬"
                        >
                          디바이스 {getSortIcon('deviceName')}
                        </button>
                      </th>
                      <th>
                        <button 
                          className="sortable-header"
                          onClick={() => handleSort('startTime')}
                          aria-label="시작 시간으로 정렬"
                        >
                          시작 시간 {getSortIcon('startTime')}
                        </button>
                      </th>
                      <th>
                        <button 
                          className="sortable-header"
                          onClick={() => handleSort('endTime')}
                          aria-label="종료 시간으로 정렬"
                        >
                          종료 시간 {getSortIcon('endTime')}
                        </button>
                      </th>
                      <th>
                        <button 
                          className="sortable-header"
                          onClick={() => handleSort('fileSize')}
                          aria-label="파일 크기로 정렬"
                        >
                          파일 크기 {getSortIcon('fileSize')}
                        </button>
                      </th>
                      <th>
                        <button 
                          className="sortable-header"
                          onClick={() => handleSort('recordCount')}
                          aria-label="레코드 수로 정렬"
                        >
                          레코드 수 {getSortIcon('recordCount')}
                        </button>
                      </th>
                      <th>작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRecords.map(record => (
                      <tr 
                        key={record.id}
                        className={selectedRecords.includes(record.id) ? 'selected' : ''}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedRecords.includes(record.id)}
                            onChange={() => handleSelectRecord(record.id)}
                            aria-label={`${record.fileName} 선택`}
                          />
                        </td>
                        <td data-label="파일명">{record.fileName}</td>
                        <td data-label="환자">{record.patientName || '-'}</td>
                        <td data-label="디바이스">{record.deviceName || '-'}</td>
                        <td data-label="종료 시간">
                          {record.endTime 
                            ? new Date(record.endTime).toLocaleString('ko-KR', { hour12: false })
                            : '-'
                          }
                        </td>
                        <td data-label="파일 크기">{record.fileSize}</td>
                        <td data-label="레코드 수">{record.recordCount || 0}</td>
                        <td data-label="작업">
                          <div className="action-buttons">
                            <button 
                              className="btn-download"
                              onClick={() => handleDownload(record)}
                              disabled={downloading}
                              aria-label={`${record.fileName} 다운로드`}
                            >
                              다운로드
                            </button>
                            <button 
                              className="btn-delete"
                              onClick={() => handleDeleteClick(record)}
                              aria-label={`${record.fileName} 삭제`}
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
              
              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    className="pagination-btn"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    aria-label="이전 페이지"
                  >
                    이전
                  </button>
                  <span className="pagination-info">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    className="pagination-btn"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    aria-label="다음 페이지"
                  >
                    다음
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <ConfirmModal
          isOpen={deleteModal.isOpen}
          title="파일 삭제"
          message={`"${deleteModal.record?.fileName || ''}" 파일을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
          onClose={() => setDeleteModal({ isOpen: false, record: null })}
          onConfirm={handleDeleteConfirm}
        />
      </div>
    </div>
  )
}

export default Records

