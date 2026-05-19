import React, { useState } from 'react';
import { formatDateCZ } from '../constants';

export default function AddAbsenceModal({ existingAbsences = [], onSubmit, onClose }) {
  // Default to today's date in ISO format
  const today = new Date();
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const [startDate, setStartDate] = useState(todayISO);
  const [endDate, setEndDate] = useState(todayISO);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const checkOverlap = (start, end) => {
    for (const absence of existingAbsences) {
      if (start <= absence.endDate && end >= absence.startDate) {
        return absence;
      }
    }
    return null;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!startDate || !endDate || !reason.trim()) {
      setError('Vyplňte všechna pole.');
      return;
    }

    if (endDate < startDate) {
      setError('Datum "do" musí být po datu "od".');
      return;
    }

    const overlap = checkOverlap(startDate, endDate);
    if (overlap) {
      setError(`Již máte absenci v tomto období (${formatDateCZ(overlap.startDate)}-${formatDateCZ(overlap.endDate)}: ${overlap.reason})`);
      return;
    }

    onSubmit({
      startDate,
      endDate,
      reason: reason.trim()
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1001,
        padding: '1rem'
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '1.25rem',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <div style={{
          width: '40px',
          height: '4px',
          background: '#ddd',
          borderRadius: '2px',
          margin: '0 auto 1rem'
        }} />

        <h3 style={{ marginTop: 0, marginBottom: '1.25rem', color: '#7B1FA2', textAlign: 'center' }}>
          🚫 Přidat absenci
        </h3>

        <form onSubmit={handleSubmit}>
          <div className="form-row" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, color: '#7B1FA2', fontSize: '0.85rem' }}>
                Od
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setError('');
                  if (!endDate || e.target.value > endDate) {
                    setEndDate(e.target.value);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem 0.5rem',
                  borderRadius: '8px',
                  border: '2px solid #E1BEE7',
                  fontSize: '1rem',
                  background: '#FAFAFA',
                  boxSizing: 'border-box'
                }}
                required
              />
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              paddingBottom: '0.75rem',
              color: '#999',
              fontWeight: 500
            }}>
              →
            </div>

            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, color: '#7B1FA2', fontSize: '0.85rem' }}>
                Do
              </label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => { setEndDate(e.target.value); setError(''); }}
                style={{
                  width: '100%',
                  padding: '0.75rem 0.5rem',
                  borderRadius: '8px',
                  border: '2px solid #E1BEE7',
                  fontSize: '1rem',
                  background: '#FAFAFA',
                  boxSizing: 'border-box'
                }}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, color: '#7B1FA2', fontSize: '0.85rem' }}>
              Důvod
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError(''); }}
              placeholder="např. Dovolená, Nemoc, Školení..."
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '2px solid #E1BEE7',
                fontSize: '1rem',
                boxSizing: 'border-box',
                background: '#FAFAFA'
              }}
              required
            />
          </div>

          {error && (
            <div style={{
              padding: '0.75rem',
              background: '#FFEBEE',
              border: '1px solid #FFCDD2',
              borderRadius: '8px',
              color: '#C62828',
              fontSize: '0.85rem',
              marginBottom: '1rem'
            }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '0.85rem',
                borderRadius: '10px',
                border: '2px solid #E1BEE7',
                background: 'white',
                color: '#7B1FA2',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Zrušit
            </button>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: '0.85rem',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #9C27B0, #7B1FA2)',
                color: 'white',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(123, 31, 162, 0.3)'
              }}
            >
              Uložit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
