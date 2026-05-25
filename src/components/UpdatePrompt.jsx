import { useRegisterSW } from 'virtual:pwa-register/react';

export default function UpdatePrompt() {
    const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();

    if (!needRefresh) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '1rem',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#1E1E1E',
            color: 'white',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            zIndex: 9999,
            fontSize: '0.9rem',
            whiteSpace: 'nowrap'
        }}>
            <span>🔄 Dostupná nová verze</span>
            <button
                onClick={() => updateServiceWorker(true)}
                style={{
                    background: '#B71C1C',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.35rem 0.75rem',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                }}
            >
                Aktualizovat
            </button>
        </div>
    );
}
