import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminNav from '../components/AdminNav';
import { getAdminHealth } from '../api/adminService';
import LoadingSpinner from '../components/LoadingSpinner';
import './AdminSystemHealth.css';

export default function AdminSystemHealth() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = () => {
      getAdminHealth()
        .then((res) => {
          if (mounted && res.success && res.data) setHealth(res.data);
        })
        .catch((e) => mounted && setError(e?.message || '로드 실패'))
        .finally(() => mounted && setLoading(false));
    };
    load();
    const interval = setInterval(load, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (loading && !health) return <><AdminNav /><div className="admin-health"><LoadingSpinner /></div></>;
  if (error) return <><AdminNav /><div className="admin-health"><p className="admin-health__error">{error}</p></div></>;

  const d = health || {};
  const mqtt = d.mqtt || {};
  const socket = d.socket || {};
  const queue = d.queue || {};

  return (
    <div className="admin-system-health">
      <AdminNav />
      <main className="admin-health__main">
        <h1>시스템 상태</h1>
        <nav className="admin-health__nav">
          <Link to="/admin/system-logs">시스템 로그 (에러)</Link>
          <Link to="/admin/connection-status">연결 상태</Link>
          <Link to="/admin/csv-files">CSV 파일</Link>
        </nav>
        <section className="admin-health__cards">
          <div className="health-card">
            <span className="health-card__label">MQTT</span>
            <span className={`health-card__value ${mqtt.connected ? 'ok' : 'fail'}`}>
              {mqtt.connected ? '연결됨' : '끊김'}
            </span>
          </div>
          <div className="health-card">
            <span className="health-card__label">Socket 연결 수</span>
            <span className="health-card__value">{socket.connectionCount ?? 0}</span>
          </div>
          <div className="health-card">
            <span className="health-card__label">Queue 길이</span>
            <span className="health-card__value">{queue.length ?? 0}</span>
          </div>
          <div className="health-card">
            <span className="health-card__label">Uptime (초)</span>
            <span className="health-card__value">{d.uptimeSeconds ?? 0}</span>
          </div>
        </section>
        <p className="admin-health__hint">5초마다 자동 갱신</p>
      </main>
    </div>
  );
}
