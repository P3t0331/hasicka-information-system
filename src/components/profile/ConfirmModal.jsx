import React from 'react';

export default function ConfirmModal({ message, onConfirm, onCancel }) {
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1100,
            background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center'
        }} onClick={onCancel}>
            <div className="card" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%', animation: 'fadeIn 0.2s' }}>
                <h3 className="mb-2">Potvrzení akce</h3>
                <p className="mb-4">{message}</p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary" onClick={onCancel}>Zrušit</button>
                    <button className="btn btn-primary" onClick={() => {
                        onConfirm();
                        onCancel();
                    }}>Potvrdit</button>
                </div>
            </div>
        </div>
    );
}
