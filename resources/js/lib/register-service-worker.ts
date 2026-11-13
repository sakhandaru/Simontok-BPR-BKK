export function registerServiceWorker(): void {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
        return;
    }

    const buildVersion =
        document
            .querySelector<HTMLMetaElement>('meta[name="simontok-build"]')
            ?.getAttribute('content') || 'production';
    const workerUrl = new URL('/sw.js', window.location.origin);
    workerUrl.searchParams.set('v', buildVersion);

    let isReloading = false;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (isReloading) {
            return;
        }

        isReloading = true;
        window.location.reload();
    });

    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register(workerUrl.pathname + workerUrl.search, {
                scope: '/',
                updateViaCache: 'none',
            })
            .catch(() => {
                // The web application remains available when PWA registration fails.
            });
    });
}
