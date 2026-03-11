import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import AdminNav from '../components/AdminNav';
import { useSocket } from '../hooks/useSocket';
import { getAdminErrors, getAdminErrorStats, getAdminDeviceErrorStats } from '../api/adminService';
import LoadingSpinner from '../components/LoadingSpinner';
import './AdminSystemLogs.css';

export default function AdminSystemLogs() {
  const { isConnected, on, off, emit, socketService } = useSocket();
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({ byCode: {}, byChannel: {}, total: 0, last24h: 0 });
  const [deviceStats, setDeviceStats] = useState([]);
  const [liveErrors, setLiveErrors] = useState([]);
  const [liveLogs, setLiveLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [filters, setFilters] = useState({
    code: '',
    channel: '',
    deviceId: '',
    startDate: '',
    endDate: '',
    keyword: '',
  });
  const liveMax = 50;
  const liveErrorsRef = useRef([]);
  const liveLogsRef = useRef([]);

  // Join admin errors room + 과거 에러/로그 히스토리 수신
  useEffect(() => {
    if (!isConnected || !socketService?.getSocket) return;
    const socket = socketService.getSocket();
    if (!socket) return;
    socket.emit('join-admin-errors');

    const historyErrors = (arr) => {
      if (!Array.isArray(arr) || arr.length === 0) return;
      const list = arr.map((e) => ({ ...e, _live: true })).reverse();
      liveErrorsRef.current = list.slice(0, liveMax);
      setLiveErrors([...liveErrorsRef.current]);
    };
    const historyLogs = (arr) => {
      if (!Array.isArray(arr) || arr.length === 0) return;
      const list = arr.map((l) => ({ ...l })).reverse();
      liveLogsRef.current = list.slice(0, liveMax);
      setLiveLogs([...liveLogsRef.current]);
    };

    const errHandler = (err) => {
      if (!err || typeof err !== 'object') return;
      liveErrorsRef.current = [{ ...err, _live: true }, ...liveErrorsRef.current].slice(0, liveMax);
      setLiveErrors([...liveErrorsRef.current]);
    };
    const logHandler = (log) => {
      if (!log || typeof log !== 'object') return;
      liveLogsRef.current = [{ ...log }, ...liveLogsRef.current].slice(0, liveMax);
      setLiveLogs([...liveLogsRef.current]);
    };

    on('server-error-history', historyErrors);
    on('server-error', errHandler);
    on('server-log-history', historyLogs);
    on('server-log', logHandler);
    return () => {
      off('server-error-history', historyErrors);
      off('server-error', errHandler);
      off('server-log-history', historyLogs);
      off('server-log', logHandler);
    };
  }, [isConnected, socketService, on, off]);

  function loadList() {
    setLoading(true);
    getAdminErrors({
      page,
      limit,
      ...filters,
    })
      .then((res) => {
        if (res.success && res.data) {
          setRows(res.data.rows || []);
          setTotal(res.data.total ?? 0);
        }
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }

  function loadStats() {
    setLoadingStats(true);
    getAdminErrorStats()
      .then((res) => {
        if (res.success && res.data) setStats(res.data);
      })
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }

  useEffect(() => {
    loadList();
  }, [page, filters.code, filters.channel, filters.deviceId, filters.startDate, filters.endDate, filters.keyword]);

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    getAdminDeviceErrorStats()
      .then((res) => res.success && res.data && setDeviceStats(res.data))
      .catch(() => setDeviceStats([]));
  }, []);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="admin-system-logs">
      <AdminNav />
      <main className="admin-system-logs__main">
        <h1>시스템 로그 (에러 모니터링)</h1>
        <nav className="admin-logs__nav">
          <Link to="/admin/system-health">시스템 상태</Link>
          <Link to="/admin/connection-status">연결 상태</Link>
          <Link to="/admin/csv-files">CSV 파일</Link>
        </nav>

        {/* Stats */}
        <section className="admin-system-logs__stats">
          {loadingStats ? (
            <LoadingSpinner />
          ) : (
            <>
              <div className="stat-card">
                <span className="stat-label">전체 에러</span>
                <span className="stat-value">{stats.total}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">최근 24시간</span>
                <span className="stat-value">{stats.last24h}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">채널별</span>
                <pre className="stat-json">{JSON.stringify(stats.byChannel || {}, null, 0)}</pre>
              </div>
              <div className="stat-card">
                <span className="stat-label">코드별</span>
                <pre className="stat-json">{JSON.stringify(stats.byCode || {}, null, 0)}</pre>
              </div>
              {deviceStats.length > 0 && (
                <div className="stat-card stat-card--wide">
                  <span className="stat-label">디바이스별 에러 (상위)</span>
                  <ul className="device-stats-list">
                    {deviceStats.slice(0, 5).map((d, i) => (
                      <li key={i}>{d.device_id || '-'}: {d.count}건</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>

        {/* Live streams */}
        <section className="admin-system-logs__live">
          <div className="live-errors">
            <h2>실시간 에러 스트림 {isConnected ? '(연결됨)' : '(연결 끊김)'}</h2>
            <div className="live-list">
              {liveErrors.length === 0 ? (
                <p className="live-empty">실시간 에러가 없습니다.</p>
              ) : (
                liveErrors.map((err, i) => (
                  <div key={i} className="live-item">
                    <span className="live-time">{new Date(err.createdAt).toLocaleTimeString()}</span>
                    <span className="live-code">{err.code}</span>
                    <span className="live-channel">{err.channel}</span>
                    <span className="live-msg">{err.message}</span>
                    {err.deviceId && <span className="live-device">{err.deviceId}</span>}
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="live-logs">
            <h2>실시간 서버 로그</h2>
            <div className="live-logs__list">
              {liveLogs.length === 0 ? (
                <p className="live-logs__empty">수신된 로그가 없습니다.</p>
              ) : (
                <ul>
                  {liveLogs.map((log, idx) => (
                    <li key={idx}>
                      <span className={`log-level log-level--${log.level || 'info'}`}>
                        {log.level || 'info'}
                      </span>
                      <span className="log-time">
                        {log.timestamp ? new Date(log.timestamp * 1000).toLocaleTimeString() : ''}
                      </span>
                      <span className="log-message">{log.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="admin-system-logs__filters">
          <input
            type="text"
            placeholder="코드 (예: error-2-02)"
            value={filters.code}
            onChange={(e) => handleFilterChange('code', e.target.value)}
          />
          <select value={filters.channel} onChange={(e) => handleFilterChange('channel', e.target.value)}>
            <option value="">채널 전체</option>
            <option value="mqtt">MQTT</option>
            <option value="http">HTTP</option>
            <option value="socket">Socket</option>
            <option value="usb">USB</option>
          </select>
          <input
            type="text"
            placeholder="디바이스 ID"
            value={filters.deviceId}
            onChange={(e) => handleFilterChange('deviceId', e.target.value)}
          />
          <input
            type="datetime-local"
            value={filters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
          />
          <input
            type="datetime-local"
            value={filters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
          />
          <input
            type="text"
            placeholder="키워드 검색"
            value={filters.keyword}
            onChange={(e) => handleFilterChange('keyword', e.target.value)}
          />
          <button type="button" onClick={() => loadList()}>
            새로고침
          </button>
        </section>

        {/* Table */}
        <section className="admin-system-logs__table-wrap">
          <h2>에러 목록 (총 {total}건)</h2>
          {loading ? (
            <LoadingSpinner />
          ) : (
            <table className="admin-system-logs__table">
              <thead>
                <tr>
                  <th>시간</th>
                  <th>코드</th>
                  <th>채널</th>
                  <th>메시지</th>
                  <th>디바이스 ID</th>
                  <th>Payload Size</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.created_at ? new Date(r.created_at).toLocaleString() : '-'}</td>
                    <td><code>{r.code}</code></td>
                    <td>{r.channel}</td>
                    <td>{r.message}</td>
                    <td>{r.device_id || '-'}</td>
                    <td>{r.payload_size != null ? r.payload_size : '-'}</td>
                    <td className="detail-cell">{r.detail ? String(r.detail).slice(0, 100) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loading && rows.length === 0 && <p>데이터가 없습니다.</p>}
          <div className="admin-system-logs__pagination">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              이전
            </button>
            <span> {page} / {totalPages} </span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              다음
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
