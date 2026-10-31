import { router } from '@inertiajs/react';

export function saveBankName(name: string): Promise<void> {
    return new Promise((resolve, reject) => {
        router.post('/bank-names', { name }, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => resolve(),
            onError: () => reject(new Error('Nama bank gagal disimpan.')),
        });
    });
}
