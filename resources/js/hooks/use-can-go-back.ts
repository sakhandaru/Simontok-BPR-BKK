import { useEffect, useState } from 'react';

/**
 * Whether browser history has a previous entry to go back to.
 *
 * Resolved after mount: reading `window.history` during the first render would
 * make the server and client output differ (SSR hydration mismatch), so the
 * initial value is `false` and the real value arrives on mount.
 */
export function useCanGoBack(): boolean {
    const [canGoBack, setCanGoBack] = useState(false);

    useEffect(() => {
        setCanGoBack(window.history.length > 1);
    }, []);

    return canGoBack;
}
