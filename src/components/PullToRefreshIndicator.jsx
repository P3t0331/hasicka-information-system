import React from 'react';
import { THRESHOLD } from '../hooks/usePullToRefresh';

const INDICATOR_HEIGHT = 44;

export default function PullToRefreshIndicator({ isRefreshing, pullProgress }) {
    const isVisible = pullProgress > 0 || isRefreshing;
    const pullPixels = pullProgress * THRESHOLD;

    const translateY = isRefreshing
        ? 12
        : pullPixels - INDICATOR_HEIGHT;

    const reachedThreshold = pullProgress >= 1;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: '50%',
                transform: `translateX(-50%) translateY(${translateY}px)`,
                transition: isRefreshing || pullProgress === 0
                    ? 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                    : 'none',
                zIndex: 9999,
                background: 'white',
                borderRadius: '22px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                padding: '0 1rem',
                height: `${INDICATOR_HEIGHT}px`,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: reachedThreshold || isRefreshing ? '#E53935' : '#888',
                pointerEvents: 'none',
                opacity: isVisible ? 1 : 0,
                userSelect: 'none',
            }}
        >
            {isRefreshing ? (
                <>
                    <span style={{
                        width: '16px', height: '16px', border: '2px solid #E53935',
                        borderTopColor: 'transparent', borderRadius: '50%',
                        display: 'inline-block',
                        animation: 'spin 0.7s linear infinite',
                        flexShrink: 0,
                    }} />
                    Obnovuji…
                </>
            ) : (
                <>
                    <span style={{
                        display: 'inline-block',
                        transform: `rotate(${reachedThreshold ? 180 : 0}deg)`,
                        transition: 'transform 0.2s ease',
                        fontSize: '1rem',
                        lineHeight: 1,
                    }}>
                        ↓
                    </span>
                    {reachedThreshold ? 'Pustit pro obnovení' : 'Táhněte dolů'}
                </>
            )}
        </div>
    );
}
