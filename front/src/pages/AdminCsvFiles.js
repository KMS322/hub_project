import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminNav from '../components/AdminNav';
import { getAdminCsvFiles, downloadAdminCsvFile } from '../api/adminService';
import LoadingSpinner from '../components/LoadingSpinner';
import './AdminCsvFiles.css';

export default function AdminCsvFiles() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedKeys, setExpandedKeys] = useState(() => new Set());

  useEffect(() => {
    let mounted = true;
    getAdminCsvFiles()
      .then((res) => {
        if (mounted && res.success && res.data && res.data.users) {
          const list = res.data.users;
          setUsers(list);
          setExpandedKeys(new Set(list.map((u) => u.userKey)));
        }
      })
      .catch((e) => mounted && setError(e?.message || 'CSV 목록 로드 실패'))
      .finally(() => mounted && setLoading(false));
  }, []);

  const toggleUser = (userKey) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(userKey)) next.delete(userKey);
      else next.add(userKey);
      return next;
    });
  };

  const handleDownload = (userKey, relativePath, filename) => {
    downloadAdminCsvFile(userKey, relativePath, filename).catch((e) => {
      console.error('Download failed:', e);
      alert('다운로드 실패: ' + (e?.message || '알 수 없음'));
    });
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatMtime = (mtime) => {
    if (!mtime) return '-';
    const d = new Date(mtime);
    return isNaN(d.getTime()) ? '-' : d.toLocaleString();
  };

  if (loading) {
    return (
      <>
        <AdminNav />
        <div className="admin-csv-files">
          <LoadingSpinner />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <AdminNav />
        <div className="admin-csv-files">
          <p className="admin-csv-files__error">{error}</p>
        </div>
      </>
    );
  }

  return (
    <div className="admin-csv-files">
      <AdminNav />
      <main className="admin-csv-files__main">
        <h1>CSV 파일 (유저별)</h1>
        <nav className="admin-csv-files__nav">
          <Link to="/admin/system-logs">시스템 로그</Link>
          <Link to="/admin/system-health">시스템 상태</Link>
          <Link to="/admin/connection-status">연결 상태</Link>
        </nav>
        <p className="admin-csv-files__hint">back/csv_files 폴더의 모든 CSV를 유저(폴더)별로 표시합니다.</p>
        {users.length === 0 ? (
          <p className="admin-csv-files__empty">CSV 파일이 없습니다.</p>
        ) : (
          <section className="admin-csv-files__list">
            {users.map(({ userKey, files }) => {
              const isExpanded = expandedKeys.has(userKey);
              return (
                <div
                  key={userKey}
                  className={`admin-csv-files__user ${!isExpanded ? '' : 'admin-csv-files__user--collapsed'}`}
                >
                  <button
                    type="button"
                    className="admin-csv-files__user-header"
                    onClick={() => toggleUser(userKey)}
                    aria-expanded={isExpanded}
                  >
                    <span className="admin-csv-files__user-chevron" aria-hidden>
                      {!isExpanded ? '▼' : '▶'}
                    </span>
                    <span className="admin-csv-files__user-title">유저: {userKey}</span>
                    <span className="admin-csv-files__user-count">{files.length}개 파일</span>
                  </button>
                  <div className="admin-csv-files__user-body">
                    <ul className="admin-csv-files__files">
                      {files.map((f) => (
                        <li key={f.relativePath} className="admin-csv-files__file">
                          <span className="admin-csv-files__file-name">{f.filename}</span>
                          <span className="admin-csv-files__file-meta">
                            {formatSize(f.size)} · {formatMtime(f.mtime)}
                          </span>
                          <button
                            type="button"
                            className="admin-csv-files__download"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(userKey, f.relativePath, f.filename);
                            }}
                          >
                            다운로드
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}
