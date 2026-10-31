import { router } from '@inertiajs/react';

export function saveCollateralType(name: string): Promise<void> {
    return new Promise((resolve, reject) => {
        router.post('/collateral-types', { name }, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => resolve(),
            onError: () => reject(new Error('Jenis agunan gagal disimpan.')),
        });
    });
}
