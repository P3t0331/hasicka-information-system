import { useState, useEffect, useRef, useCallback } from 'react';

const THRESHOLD = 65;
const MAX_PULL = 120;

export function usePullToRefresh(onRefresh) {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pullProgress, setPullProgress] = useState(0);

    const startYRef = useRef(0);
    const isPullingRef = useRef(false);
    const pullDistanceRef = useRef(0);
    const isRefreshingRef = useRef(false);
    const onRefreshRef = useRef(onRefresh);

    useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

    const triggerRefresh = useCallback(() => {
        if (isRefreshingRef.current) return;
        isRefreshingRef.current = true;
        setIsRefreshing(true);
        setPullProgress(0);

        const timeout = new Promise(resolve => setTimeout(resolve, 2000));
        Promise.race([
            Promise.resolve(onRefreshRef.current?.()),
            timeout
        ]).finally(() => {
            isRefreshingRef.current = false;
            setIsRefreshing(false);
        });
    }, []);

    useEffect(() => {
        const onTouchStart = (e) => {
            if (window.scrollY !== 0) return;
            startYRef.current = e.touches[0].clientY;
            isPullingRef.current = true;
            pullDistanceRef.current = 0;
        };

        const onTouchMove = (e) => {
            if (!isPullingRef.current) return;
            if (window.scrollY > 0) {
                isPullingRef.current = false;
                pullDistanceRef.current = 0;
                setPullProgress(0);
                return;
            }

            const distance = Math.max(0, Math.min(e.touches[0].clientY - startYRef.current, MAX_PULL));
            pullDistanceRef.current = distance;

            if (distance > 0) {
                e.preventDefault();
                setPullProgress(distance / THRESHOLD > 1 ? 1 : distance / THRESHOLD);
            }
        };

        const onTouchEnd = () => {
            if (!isPullingRef.current) return;
            isPullingRef.current = false;

            if (pullDistanceRef.current >= THRESHOLD && !isRefreshingRef.current) {
                triggerRefresh();
            } else {
                setPullProgress(0);
            }
            pullDistanceRef.current = 0;
        };

        window.addEventListener('touchstart', onTouchStart, { passive: true });
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onTouchEnd, { passive: true });

        return () => {
            window.removeEventListener('touchstart', onTouchStart);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onTouchEnd);
        };
    }, [triggerRefresh]);

    return { isRefreshing, pullProgress };
}

export { THRESHOLD };
