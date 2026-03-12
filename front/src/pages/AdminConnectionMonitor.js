import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import AdminNav from '../components/AdminNav';
import { useSocket } from '../hooks/useSocket';
import LoadingSpinner from '../components/LoadingSpinner';
import './AdminConnectionMonitor.css';

export default function AdminConnectionMonitor() {
  const { isConnected, on, off, emit } = useSocket();
  const [data, setData] = useState({ users: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasJoinedRef = useRef(false);
  const socketRef = useRef({ on, off, emit });
  socketRef.current = { on, off, emit };

  useEffect(() => {
    if (!isConnected) {
      setLoading(true);
      return;
    }
    const { emit: emitFn, on: onFn, off: offFn } = socketRef.current;
    if (!hasJoinedRef.current) {
      hasJoinedRef.current = true;
      emitFn('join-admin-connection-status');
    }
    const handleStatus = (payload) => {
      if (payload && typeof payload === 'object' && Array.isArray(payload.users)) {
        setData({ users: payload.users });
        setError(null);
      }
      setLoading(false);
    };
    onFn('admin-connection-status', handleStatus);
    return () => offFn('admin-connection-status', handleStatus);
  }, [isConnected]); // on/off/emit 제외 → 렌더마다 effect 재실행 방지, 연결됐을 때 한 번만 join

  const formatLastSeen = (ts) => {
    if (ts == null) return '-';
    const d = new Date(ts);
    return isNaN(d.getTime()) ? '-' : d.toLocaleTimeString();
  };

  if (loading && data.users.length === 0) {
    return (
      <>
        <AdminNav />
        <div className="admin-connection-monitor">
          <LoadingSpinner />
        </div>
      </>
    );
  }

  return (
    <div className="admin-connection-monitor">
      <AdminNav />
      <main className="admin-connection-monitor__main">
        <h1>연결 상태 모니터링</h1>
        <nav className="admin-connection-monitor__nav">
          <Link to="/admin/system-logs">시스템 로그</Link>
          <Link to="/admin/system-health">시스템 상태</Link>
          <Link to="/admin/connection-status">연결 상태</Link>
          <Link to="/admin/csv-files">CSV 파일</Link>
        </nav>
        <p className="admin-connection-monitor__hint">
          사용자별 허브 연결 상태, 디바이스 연결 상태, 측정 여부를 Socket.IO로 실시간 갱신합니다. 진입 시 모든 허브에 state:hub 요청을 보내 현재 연결된 디바이스를 불러옵니다.
        </p>
        {error && <p className="admin-connection-monitor__error">{error}</p>}
        {data.users.length === 0 && !error ? (
          <p className="admin-connection-monitor__empty">등록된 허브/유저가 없습니다.</p>
        ) : (
          <section className="admin-connection-monitor__users">
            {data.users.map((user) => (
              <div key={user.email} className="admin-connection-monitor__user">
                <h2 className="admin-connection-monitor__user-title">
                  {user.name || user.email} <span className="admin-connection-monitor__user-email">({user.email})</span>
                </h2>
                <div className="admin-connection-monitor__hubs">
                  {user.hubs.map((hub) => (
                    <div key={hub.address} className="admin-connection-monitor__hub">
                      <div className="admin-connection-monitor__hub-header">
                        <span className="admin-connection-monitor__hub-name">{hub.name || hub.address}</span>
                        <span className={`admin-connection-monitor__hub-status ${hub.online ? 'online' : 'offline'}`}>
                          {hub.online ? '온라인' : '오프라인'}
                        </span>
                        <span className="admin-connection-monitor__hub-last">마지막 활동: {formatLastSeen(hub.lastSeen)}</span>
                      </div>
                      <ul className="admin-connection-monitor__devices">
                        {hub.devices.length === 0 ? (
                          <li className="admin-connection-monitor__device admin-connection-monitor__device--empty">등록된 디바이스 없음</li>
                        ) : (
                          hub.devices.map((dev) => (
                            <li key={dev.address} className="admin-connection-monitor__device">
                              <span className="admin-connection-monitor__device-name">{dev.name || dev.address}</span>
                              <span className={`admin-connection-monitor__device-badge ${dev.connected ? 'connected' : 'disconnected'}`}>
                                {dev.connected ? '연결됨' : '끊김'}
                              </span>
                              {dev.measuring && (
                                <span className="admin-connection-monitor__device-badge measuring">측정 중</span>
                              )}
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
