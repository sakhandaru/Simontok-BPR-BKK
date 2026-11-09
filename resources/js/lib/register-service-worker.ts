import { toast } from 'sonner';

const updateToastId = 'simontok-pwa-update';

function showUpdate(worker: ServiceWorker): void {
    toast('Pembaruan SIMONTOK tersedia', {
        id: updateToastId,
        description:
            'Muat ulang untuk memakai versi terbaru setelah pekerjaan Anda tersimpan.',
        duration: Infinity,
        action: {
            label: 'Muat ulang',
            onClick: () => {
                worker.postMessage({ type: 'SKIP_WAITING' });
            },
        },
    });
}

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
            .then((registration) => {
                if (registration.waiting) {
                    showUpdate(registration.waiting);
                }

                registration.addEventListener('updatefound', () => {
                    const worker = registration.installing;

                    worker?.addEventListener('statechange', () => {
                        if (
                            worker.state === 'installed' &&
                            navigator.serviceWorker.controller
                        ) {
                            showUpdate(worker);
                        }
                    });
                });
            })
            .catch(() => {
                // The web application remains available when PWA registration fails.
            });
    });
}
