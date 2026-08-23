import { useState, useEffect } from 'react';
import { APP_VERSION, CHANGELOG } from '../changelog';

const STORAGE_KEY = 'seenAppVersion';

function getNewEntries(seenVersion) {
  if (!seenVersion) return CHANGELOG;
  const seenIdx = CHANGELOG.findIndex(e => e.version === seenVersion);
  if (seenIdx === -1) return CHANGELOG;
  return CHANGELOG.slice(0, seenIdx);
}

export default function ChangelogModal() {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (seen === APP_VERSION) return;
    const newEntries = getNewEntries(seen);
    if (newEntries.length > 0) setEntries(newEntries);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, APP_VERSION);
    setEntries([]);
  };

  if (entries.length === 0) return null;

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.2s',
      }}
    >
      <div
        className="card"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '480px', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        <h2 style={{ margin: '0 0 0.2rem', fontSize: '1.15rem' }}>🚀 Co je nového</h2>
        <p style={{ margin: '0 0 1.25rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Verze {APP_VERSION}</p>

        <div style={{ overflowY: 'auto', flex: 1, marginBottom: '1.25rem' }}>
          {entries.map(entry => (
            <div key={entry.version} style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>v{entry.version}</span>
                <span style={{ color: 'var(--text-subtle)', fontSize: '0.8rem' }}>{entry.date}</span>
              </div>
              {entry.sections
                ? entry.sections.map(section => (
                    <div key={section.label} style={{ marginBottom: '0.75rem' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--danger-deep)', marginBottom: '0.3rem' }}>
                        {section.label}
                      </div>
                      <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                        {section.changes.map((change, i) => (
                          <li key={i} style={{ marginBottom: '0.35rem', fontSize: '0.9rem', lineHeight: 1.45 }}>
                            {change}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                : (
                    <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                      {entry.changes.map((change, i) => (
                        <li key={i} style={{ marginBottom: '0.35rem', fontSize: '0.9rem', lineHeight: 1.45 }}>
                          {change}
                        </li>
                      ))}
                    </ul>
                  )
              }
            </div>
          ))}
        </div>

        <button className="btn btn-primary" onClick={dismiss} style={{ alignSelf: 'flex-end' }}>
          Rozumím
        </button>
      </div>
    </div>
  );
}
