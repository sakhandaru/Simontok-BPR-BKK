export type JourneyStage = { label: string; keys: string[] };

export const orderJourneyStages: JourneyStage[] = [
    { label: 'Persiapan order', keys: ['draft', 'perlu_perbaikan_order'] },
    { label: 'Persetujuan cabang', keys: ['diajukan', 'menunggu_approval', 'disetujui_kepala_cabang'] },
    { label: 'Verifikasi notaris', keys: ['menunggu_verifikasi_notaris', 'perbaikan_dokumen', 'perlu_pengalihan_notaris'] },
    { label: 'Persiapan & proses pekerjaan', keys: ['persiapan_pekerjaan', 'menunggu_approval_covernote', 'menunggu_approval_covernote_kepala_cabang', 'perbaikan_covernote', 'covernote_disetujui', 'dokumen_valid', 'proses_akta', 'proses_bpn_samsat'] },
    { label: 'Dokumen final', keys: ['draft_diunggah', 'menunggu_validasi_bpr', 'dokumen_final_diunggah'] },
    { label: 'Fisik & pembayaran', keys: ['dokumen_fisik_diterima'] },
    { label: 'Selesai', keys: ['selesai'] },
];

const labelToStatus: Record<string, string> = {
    Draft: 'draft',
    'Diajukan': 'diajukan',
    'Menunggu approval': 'menunggu_approval',
    'Perlu perbaikan order': 'perlu_perbaikan_order',
    'Disetujui Kepala Cabang': 'disetujui_kepala_cabang',
    'Menunggu verifikasi notaris': 'menunggu_verifikasi_notaris',
    'Perbaikan dokumen': 'perbaikan_dokumen',
    'Perlu pengalihan notaris': 'perlu_pengalihan_notaris',
    'Persiapan pekerjaan notaris': 'persiapan_pekerjaan',
    'Menunggu approval biaya & covernote': 'menunggu_approval_covernote',
    'Menunggu approval biaya & covernote Kepala Cabang': 'menunggu_approval_covernote_kepala_cabang',
    'Perbaikan biaya & covernote': 'perbaikan_covernote',
    'Covernote disetujui': 'covernote_disetujui',
    'Dokumen valid': 'dokumen_valid',
    'Proses akta': 'proses_akta',
    'Proses BPN/Samsat': 'proses_bpn_samsat',
    'Draft diunggah': 'draft_diunggah',
    'Menunggu validasi BPR': 'menunggu_validasi_bpr',
    'Dokumen final diunggah': 'dokumen_final_diunggah',
    'Dokumen fisik diterima': 'dokumen_fisik_diterima',
    Selesai: 'selesai',
    'Ditolak notaris': 'ditolak_notaris',
    Dibatalkan: 'dibatalkan',
};

export function journeyStatusValue(value?: unknown): string {
    if (value && typeof value === 'object' && 'value' in value) return String((value as { value: string }).value);
    const raw = value == null ? '' : String(value);
    return labelToStatus[raw] ?? raw.toLowerCase();
}

export function resolveOrderJourney(status?: unknown) {
    const normalized = journeyStatusValue(status);
    const blocked = ['ditolak_notaris', 'dibatalkan'].includes(normalized);
    const activeIndex = Math.max(0, orderJourneyStages.findIndex((stage) => stage.keys.includes(normalized)));

    return orderJourneyStages.map((stage, index) => ({
        ...stage,
        active: index === activeIndex,
        done: index < activeIndex,
        blocked: blocked && index === activeIndex,
    }));
}
