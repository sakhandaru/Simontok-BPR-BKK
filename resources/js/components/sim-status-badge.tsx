import { cn } from '@/lib/utils';

type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const toneClasses: Record<StatusTone, string> = {
    neutral: 'border-foreground/35 bg-foreground/5 text-foreground',
    success: 'sim-status-success',
    warning: 'sim-status-warning',
    danger: 'sim-status-danger',
    info: 'sim-status-info',
};

export function SimStatusBadge({ label, tone = 'neutral', className }: { label: string; tone?: StatusTone; className?: string }) {
    return <span className={cn('inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-medium leading-4 tracking-normal', toneClasses[tone], className)}>{label}</span>;
}

export function toneForStatus(status?: string | null): StatusTone {
    const value = String(status ?? '').toLowerCase();

    if (value.includes('selesai') || value.includes('valid') || value.includes('dibayar') || value.includes('aktif') || value.includes('setujui') || value.includes('disetujui')) return 'success';
    if (value.includes('tunggu') || value.includes('diajukan') || value.includes('proses') || value.includes('mendekati')) return 'warning';
    if (value.includes('tolak') || value.includes('batal') || value.includes('kedaluwarsa') || value.includes('perbaikan') || value.includes('terlambat')) return 'danger';
    if (value.includes('draft') || value.includes('unggah') || value.includes('verifikasi')) return 'info';

    return 'neutral';
}
