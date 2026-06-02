import React, { useEffect, useCallback, useState, useRef } from 'react';
import { db } from '../../firebase';
import { collection, query, getDocs, orderBy, limit, onSnapshot, startAfter, where } from 'firebase/firestore';
import { CATEGORY_CONFIG, ACTION_LABELS, formatRelativeTime, formatAbsoluteTime } from './constants';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import PullToRefreshIndicator from '../PullToRefreshIndicator';

const PAGE_SIZE = 300;

const LogEntry = React.memo(function LogEntry({ id, category, action, userName, detail, timestamp }) {
  const cat = CATEGORY_CONFIG[category] || { label: category, color: '#555', bg: '#f5f5f5', border: '#ddd', icon: '•' };
  const actionLabel = ACTION_LABELS[action] || action;
  const initials = userName ? userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';

  return (
    <div
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
          <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#222' }}>{userName}</span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
            fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem',
            borderRadius: '12px', background: cat.bg, color: cat.color, border: `1px solid ${cat.border}`
          }}>
            {cat.icon} {actionLabel}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '0.82rem', color: '#555', lineHeight: 1.45 }}>
          {detail}
        </p>
      </div>

      {/* Timestamp */}
      <div style={{ textAlign: 'right', flexShrink: 0, minWidth: '70px', alignSelf: 'center' }}>
        <div style={{ fontSize: '0.72rem', color: '#888', fontWeight: 600 }}>
          {formatRelativeTime(timestamp)}
        </div>
        <div className="d-desktop-only" style={{ fontSize: '0.65rem', color: '#bbb', marginTop: '0.15rem' }}>
          {formatAbsoluteTime(timestamp)}
        </div>
      </div>
    </div>
  );
});

export default function LogsTab({
  allUsers,
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
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [indexError, setIndexError] = useState(null);
  const unsubRef = useRef(null);

  // We need to keep track of filters to refetch when they change
  const buildQuery = useCallback((lastDocSnap = null) => {
    const constraints = [];
    if (logFilterUser !== 'all') {
      constraints.push(where('uid', '==', logFilterUser));
    }
    if (logFilterCategory !== 'all') {
      constraints.push(where('category', '==', logFilterCategory));
    }
    constraints.push(orderBy('timestamp', 'desc'));
    if (lastDocSnap) {
      constraints.push(startAfter(lastDocSnap));
    }
    constraints.push(limit(PAGE_SIZE));
    
    return query(collection(db, 'activityLogs'), ...constraints);
  }, [logFilterUser, logFilterCategory]);

  const fetchLogs = useCallback(async (isRefresh = false) => {
    setLogsLoading(true);
    setIndexError(null);
    try {
      const q = buildQuery();

      if (isRefresh) {
        if (unsubRef.current) {
          unsubRef.current();
          unsubRef.current = null;
        }
        const snap = await getDocs(q);
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setActivityLogs(docs);
        setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
        setHasMore(snap.docs.length === PAGE_SIZE);
        setLogsLoading(false);
        setLogsLoaded(true);
      } else {
        if (unsubRef.current) unsubRef.current();
        const unsub = onSnapshot(q, (snap) => {
          const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setActivityLogs(docs);
          setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
          setHasMore(snap.docs.length === PAGE_SIZE);
          setLogsLoading(false);
          setLogsLoaded(true);
        }, (err) => {
          console.error('Logs error:', err);
          if (err.message && err.message.includes('requires an index')) {
            setIndexError(err.message);
          }
          setLogsLoading(false);
        });
        unsubRef.current = unsub;
      }
    } catch (err) {
      console.error('Fetch logs error:', err);
      if (err.message && err.message.includes('requires an index')) {
        setIndexError(err.message);
      }
      setLogsLoading(false);
    }
  }, [buildQuery, setActivityLogs, setLogsLoading, setLogsLoaded]);

  const loadMoreLogs = async () => {
    if (!lastDoc || loadingMore) return;
    setLoadingMore(true);
    try {
      const q = buildQuery(lastDoc);
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setActivityLogs(prev => [...prev, ...docs]);
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (err) {
      console.error('Load more logs error:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Refetch when filters change
  useEffect(() => {
    fetchLogs(true);
  }, [logFilterUser, logFilterCategory, fetchLogs]);

  useEffect(() => {
    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, []);

  const { isRefreshing, pullProgress } = usePullToRefresh(() => fetchLogs(true));

  const uniqueUsersMap = new Map();
  (allUsers || []).forEach(u => {
    uniqueUsersMap.set(u.uid, { uid: u.uid, name: `${u.lastName} ${u.firstName || ''}`.trim() });
  });
  // We keep pulling from activityLogs as well in case deleted users have logs
  activityLogs.forEach(l => {
    if (l.uid && !uniqueUsersMap.has(l.uid)) {
      uniqueUsersMap.set(l.uid, { uid: l.uid, name: l.userName || 'Neznámý uživatel' });
    }
  });
  const uniqueUsers = Array.from(uniqueUsersMap.values())
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'cs'));

  return (
    <div>
      <PullToRefreshIndicator isRefreshing={isRefreshing} pullProgress={pullProgress} />
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
            {activityLogs.length} <span className="d-desktop-only">záznamů</span>
          </span>
        </div>
      </div>

      {/* Index Error Warning */}
      {indexError && (
        <div style={{
          padding: '1.25rem', marginBottom: '1.5rem',
          background: '#FFF3E0', border: '1px solid #FFB74D',
          borderRadius: '10px', color: '#E65100'
        }}>
          <h4 style={{ margin: '0 0 0.5rem' }}>⚠️ Chybí databázový index</h4>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem' }}>
            Pro filtrování na serveru je potřeba vytvořit v databázi index. Klikněte na odkaz níže (otevře se Firebase Console) a klikněte na "Vytvořit index".
          </p>
          <div style={{ wordBreak: 'break-all', fontSize: '0.75rem', background: '#fff', padding: '0.5rem', borderRadius: '4px', border: '1px solid #FFE0B2' }}>
            {(() => {
              const urlMatch = indexError.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
              if (urlMatch) {
                return <a href={urlMatch[0]} target="_blank" rel="noreferrer" style={{ color: '#1565C0', textDecoration: 'underline' }}>{urlMatch[0]}</a>;
              }
              return indexError;
            })()}
          </div>
        </div>
      )}

      {/* Log List */}
      {logsLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
          Načítám záznamy...
        </div>
      ) : activityLogs.length === 0 ? (
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
          {activityLogs.map((log, idx) => (
            <LogEntry
              key={log.id || idx}
              id={log.id}
              category={log.category}
              action={log.action}
              userName={log.userName}
              detail={log.detail}
              timestamp={log.timestamp}
            />
          ))}

          {hasMore && (
            <button
              onClick={loadMoreLogs}
              disabled={loadingMore}
              style={{
                marginTop: '0.5rem',
                padding: '0.65rem 1.25rem',
                background: 'white',
                border: '1px solid #e0e0e0',
                borderRadius: '10px',
                cursor: loadingMore ? 'default' : 'pointer',
                fontSize: '0.85rem',
                color: '#555',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                width: '100%'
              }}
            >
              <span style={{ animation: loadingMore ? 'spin 1s linear infinite' : 'none', display: 'inline-block' }}>
                {loadingMore ? '🔄' : '⬇️'}
              </span>
              {loadingMore ? 'Načítám...' : `Načíst dalších ${PAGE_SIZE}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
