export type TemporaryOrderDocument = {
    id: string;
    coreAccountId: string;
    collateralKey: string;
    checklistMasterId: number | null;
    jobTypeId: number | null;
    displayName: string;
    originalName: string;
    fileSize: number;
    expiresAt: string;
    previewUrl: string;
};

export function collateralDocumentKey(collateral: { agunan_id?: string; id?: string; draft_key?: string }): string {
    if (collateral.agunan_id) return `agunan:${collateral.agunan_id}`;
    return collateral.id ? `saved:${collateral.id}` : `draft:${collateral.draft_key ?? ''}`;
}

export async function temporaryDocumentRequest<T>(url: string, method: 'POST' | 'DELETE', body?: FormData): Promise<T> {
    const csrfCookie = document.cookie.split('; ').find((cookie) => cookie.startsWith('XSRF-TOKEN='));
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 90_000);
    try {
        const response = await fetch(url, {
            method,
            body,
            credentials: 'same-origin',
            signal: controller.signal,
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                ...(csrfCookie ? { 'X-XSRF-TOKEN': decodeURIComponent(csrfCookie.slice('XSRF-TOKEN='.length)) } : {}),
            },
        });
        const payload = response.headers.get('content-type')?.includes('application/json') ? await response.json() : null;
        if (!response.ok) {
            const errors = Object.values(payload?.errors ?? {}).flat().filter((error): error is string => typeof error === 'string' && !error.startsWith('validation.'));
            const fallback = response.status === 419 ? 'Sesi kedaluwarsa. Muat ulang halaman, lalu coba lagi.'
                : response.status === 413 ? 'Ukuran file terlalu besar. Maksimal 10 MB.'
                : response.status >= 500 ? 'Server gagal menyimpan dokumen. Silakan coba lagi.'
                : 'Dokumen gagal diproses. Periksa file dan coba lagi.';
            throw new Error(errors.length ? [...new Set(errors)].join(' ') : (response.status < 500 && payload?.message && !payload.message.startsWith('validation.') ? payload.message : fallback));
        }
        if (!payload) throw new Error('Sesi tidak tersedia. Muat ulang halaman, lalu coba lagi.');
        return payload as T;
    } catch (error) {
        if (controller.signal.aborted) throw new Error('Waktu unggah habis. Coba lagi; file sebelumnya tetap tersedia.');
        if (error instanceof TypeError) throw new Error('Koneksi terputus. Periksa koneksi lalu coba lagi.');
        throw error;
    } finally {
        window.clearTimeout(timeout);
    }
}
