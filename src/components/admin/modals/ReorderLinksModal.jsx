import React, { useState } from 'react';
import { createPortal } from 'react-dom';

export default function ReorderLinksModal({ links, onClose, onSave }) {
  const [items, setItems] = useState(links);

  const move = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
  };

  const dirty = items.some((it, i) => it.id !== links[i].id);

  return createPortal(
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center',
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        className="card"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '480px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.2s' }}
      >
        <h3 style={{ margin: '0 0 0.25rem' }}>Změnit pořadí odkazů</h3>
        <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Použijte šipky ↑ ↓ k seřazení. Změny se uloží po stisknutí „Uložit".
        </p>

        <div style={{
          overflowY: 'auto', flex: 1, marginBottom: '1rem',
          border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--surface-sunken)'
        }}>
          {items.map((link, i) => {
            const isFirst = i === 0;
            const isLast = i === items.length - 1;
            return (
              <div
                key={link.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  padding: '0.7rem 0.75rem',
                  background: 'var(--surface)',
                  borderBottom: i === items.length - 1 ? 'none' : '1px solid var(--border)'
                }}
              >
                <span style={{
                  minWidth: '2rem', height: '2rem', display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center',
                  background: 'var(--info-bg)', color: 'var(--info-text)',
                  borderRadius: '50%', fontWeight: 700, fontSize: '0.85rem'
                }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{link.emoji || '🔗'}</span>
                <span style={{ flex: 1, fontWeight: 600, color: 'var(--text-charcoal)', fontSize: '0.95rem', wordBreak: 'break-word' }}>
                  {link.label}
                </span>
                <button
                  onClick={() => move(i, -1)}
                  disabled={isFirst}
                  aria-label="Posunout nahoru"
                  style={{
                    width: '2.5rem', height: '2.5rem',
                    background: isFirst ? 'var(--surface-alt)' : 'var(--info)',
                    color: isFirst ? 'var(--text-faint)' : 'var(--text-on-dark)',
                    border: 'none', borderRadius: '8px',
                    cursor: isFirst ? 'not-allowed' : 'pointer',
                    fontSize: '1.1rem', fontWeight: 700,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  ▲
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={isLast}
                  aria-label="Posunout dolů"
                  style={{
                    width: '2.5rem', height: '2.5rem',
                    background: isLast ? 'var(--surface-alt)' : 'var(--info)',
                    color: isLast ? 'var(--text-faint)' : 'var(--text-on-dark)',
                    border: 'none', borderRadius: '8px',
                    cursor: isLast ? 'not-allowed' : 'pointer',
                    fontSize: '1.1rem', fontWeight: 700,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  ▼
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Zrušit
          </button>
          <button
            className="btn btn-primary"
            disabled={!dirty}
            onClick={() => onSave(items)}
            style={{ opacity: dirty ? 1 : 0.5 }}
          >
            Uložit
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
