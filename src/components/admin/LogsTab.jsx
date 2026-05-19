import React, { useEffect, useCallback } from 'react';
import { db } from '../../firebase';
import { collection, query, getDocs, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { CATEGORY_CONFIG, ACTION_LABELS, formatRelativeTime, formatAbsoluteTime } from './constants';

export default function LogsTab({
  activityLogs,
  setActivityLogs,
  logsLoading,
  setLogsLoading,
  logsLoaded,
  setLogsLoaded,
  logFilterUser,
  setLogFilterUser,
  logFilterCategory,
  setLogFilterCategory
}) {
  const fetchLogs = useCallback(async (isRefresh = false) => {
    setLogsLoading(true);
    try {
      const q = query(
        collection(db, 'activityLogs'),
        orderBy('timestamp', 'desc'),
        limit(300)
      );

      if (isRefresh) {
        const snap = await getDocs(q);
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setActivityLogs(docs);
        setLogsLoading(false);
        setLogsLoaded(true);
      } else {
        const unsub = onSnapshot(q, (snap) => {
          const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setActivityLogs(docs);
          setLogsLoading(false);
          setLogsLoaded(true);
        }, (err) => {
          console.error('Logs error:', err);
          setLogsLoading(false);
        });
        return unsub;
      }
    } catch (err) {
      console.error('Fetch logs error:', err);
      setLogsLoading(false);
    }
  }, [setActivityLogs, setLogsLoading, setLogsLoaded]);

  useEffect(() => {
    if (!logsLoaded) {
      let unsub;
      const setupSubscription = async () => {
        unsub = await fetchLogs(false);
      };
      setupSubscription();
      return () => {
        if (unsub && typeof unsub === 'function') {
          unsub();
        }
      };
    }
  }, [logsLoaded, fetchLogs]);

  const filteredLogs = activityLogs.filter(log => {
    if (logFilterUser !== 'all' && log.uid !== logFilterUser) return false;
    if (logFilterCategory !== 'all' && log.category !== logFilterCategory) return false;
    return true;
  });

  const uniqueUsers = Array.from(
    new Map(activityLogs.map(l => [l.uid, { uid: l.uid, name: l.userName }])).values()
  ).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'cs'));

  return (
    <div>
      {/* Filter Bar */}
      <div className="mobile-stack" style={{
        background: 'white', borderRadius: '12px', padding: '1rem',
        marginBottom: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', width: '100%' }}>
          {/* User filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1', minWidth: '200px' }}>
            <span style={{ fontSize: '0.8rem', color: '#888', fontWeight: 600, whiteSpace: 'nowrap' }}>Uživatel:</span>
            <select
              value={logFilterUser}
              onChange={e => setLogFilterUser(e.target.value)}
              style={{
                padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid #e0e0e0',
                fontSize: '0.85rem', background: '#fafafa', cursor: 'pointer', width: '100%'
              }}
            >
              <option value="all">Všichni</option>
              {uniqueUsers.map(u => (
                <option key={u.uid} value={u.uid}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Category filter pills */}
          <div style={{
            display: 'flex',
            gap: '0.4rem',
            flexWrap: 'nowrap',
            overflowX: 'auto',
            paddingBottom: '0.25rem',
            width: '100%',
            msOverflowStyle: 'none',
            scrollbarWidth: 'none'
          }} className="hide-scrollbar">
            {[{ id: 'all', label: 'Vše', icon: '🔍' }, ...Object.entries(CATEGORY_CONFIG).map(([k, v]) => ({ id: k, label: v.label, icon: v.icon }))]
              .map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setLogFilterCategory(cat.id)}
                  style={{
                    padding: '0.35rem 0.75rem', borderRadius: '20px', fontSize: '0.78rem',
                    fontWeight: logFilterCategory === cat.id ? 700 : 500,
                    border: `1px solid ${logFilterCategory === cat.id ? (CATEGORY_CONFIG[cat.id]?.border || '#aaa') : '#e0e0e0'}`,
                    background: logFilterCategory === cat.id ? (CATEGORY_CONFIG[cat.id]?.bg || '#eee') : 'white',
                    color: logFilterCategory === cat.id ? (CATEGORY_CONFIG[cat.id]?.color || '#333') : '#666',
                    cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  {cat.icon} {cat.label}
                </button>
              ))
            }
          </div>
        </div>

        {/* Actions (Refresh) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'space-between', width: '100%', marginTop: '0.5rem', borderTop: '1px solid #f0f0f0', paddingTop: '0.75rem' }} className="mobile-only-border-top">
          <button
            onClick={() => {
              fetchLogs(true);
            }}
            disabled={logsLoading}
            style={{
              background: 'white', border: '1px solid #e0e0e0', borderRadius: '8px',
              padding: '0.4rem 0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
              fontSize: '0.8rem', color: '#555', transition: 'all 0.2s',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
            onMouseOver={e => { e.currentTarget.style.background = '#f9f9f9'; e.currentTarget.style.borderColor = '#ccc'; }}
            onMouseOut={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#e0e0e0'; }}
          >
            <span style={{
              display: 'inline-block',
              animation: logsLoading ? 'spin 1s linear infinite' : 'none',
              fontSize: '0.9rem'
            }}>
              🔄
            </span>
            <span className="d-desktop-only">Obnovit</span>
          </button>

          {/* Count */}
          <span style={{ fontSize: '0.75rem', color: '#aaa', whiteSpace: 'nowrap' }}>
            {filteredLogs.length} <span className="d-desktop-only">záznamů</span>
          </span>
        </div>
      </div>

      {/* Log List */}
      {logsLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
          Načítám záznamy...
        </div>
      ) : filteredLogs.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '3rem', color: '#bbb',
          background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📭</div>
          <div style={{ fontWeight: 600, color: '#999', marginBottom: '0.3rem' }}>Žádné záznamy</div>
          <div style={{ fontSize: '0.82rem' }}>Změňte filtry nebo počkejte, až nějaká akce proběhne.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filteredLogs.map((log, idx) => {
            const cat = CATEGORY_CONFIG[log.category] || { label: log.category, color: '#555', bg: '#f5f5f5', border: '#ddd', icon: '•' };
            const actionLabel = ACTION_LABELS[log.action] || log.action;
            const initials = log.userName ? log.userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';

            return (
              <div
                key={log.id || idx}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                  background: 'white', borderRadius: '10px',
                  padding: '0.75rem 1rem',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  borderLeft: `4px solid ${cat.border}`,
                  transition: 'box-shadow 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 3px 12px rgba(0,0,0,0.1)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'}
              >
                {/* Avatar */}
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                  background: cat.bg, border: `2px solid ${cat.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: cat.color, fontWeight: 700, fontSize: '0.72rem'
                }}>
                  {initials}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#222' }}>{log.userName}</span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                      fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem',
                      borderRadius: '12px', background: cat.bg, color: cat.color, border: `1px solid ${cat.border}`
                    }}>
                      {cat.icon} {actionLabel}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#555', lineHeight: 1.45 }}>
                    {log.detail}
                  </p>
                </div>

                {/* Timestamp */}
                <div style={{ textAlign: 'right', flexShrink: 0, minWidth: '70px', alignSelf: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: '#888', fontWeight: 600 }}>
                    {formatRelativeTime(log.timestamp)}
                  </div>
                  <div className="d-desktop-only" style={{ fontSize: '0.65rem', color: '#bbb', marginTop: '0.15rem' }}>
                    {formatAbsoluteTime(log.timestamp)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
