import { router } from '@inertiajs/react';

export function savePaymentScheme(name: string): Promise<void> {
    return new Promise((resolve, reject) => {
        router.post('/payment-schemes', { name }, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => resolve(),
            onError: () => reject(new Error('Skema pembayaran gagal disimpan.')),
        });
    });
}
