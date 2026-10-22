import { cn } from '@/lib/utils';
import { BadgeCheck, Check, CircleCheck, FilePlus2, PackageCheck, Scale, ShieldCheck } from 'lucide-react';
import { journeyStatusValue, resolveOrderJourney } from '@/lib/sim-journey';

const icons = [FilePlus2, ShieldCheck, Scale, BadgeCheck, PackageCheck, PackageCheck, CircleCheck];

export function journeyCurrentLabel(status: string): string {
    const normalized = journeyStatusValue(status);
    const journey = resolveOrderJourney(normalized);
    const activeIndex = journey.findIndex((node) => node.active);
    const isClosed = ['ditolak_notaris', 'dibatalkan'].includes(normalized);
    if (isClosed) {
        return normalized === 'dibatalkan' ? 'Dibatalkan' : normalized === 'ditolak_notaris' ? 'Ditolak notaris' : 'Order berhenti';
    }
    return journey[activeIndex]?.label ?? 'Persiapan order';
}

export function SimJourneyNodes({ status, fullWidth = false, hideLabel = false }: { status: string; fullWidth?: boolean; hideLabel?: boolean }) {
    const normalized = journeyStatusValue(status);
    const journey = resolveOrderJourney(normalized);
    const activeIndex = journey.findIndex((node) => node.active);
    const isClosed = ['ditolak_notaris', 'dibatalkan'].includes(normalized);
    const current = journeyCurrentLabel(status);

    return <div className="relative top-1 min-w-[220px] py-1.5" title={`Posisi saat ini: ${current}`}>
        <div className={cn('flex items-center', fullWidth ? 'w-full' : 'w-[172px]')} aria-label={`Posisi saat ini: ${current}`}>
            {journey.map((node, index) => { const Icon = icons[index]; return <div key={node.label} className="flex min-w-0 flex-1 items-center">
                <span title={node.label} className={cn('relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors', index < activeIndex && 'sim-track-complete', index === activeIndex && !isClosed && 'sim-track-current', index > activeIndex && 'border-border', isClosed && index === activeIndex && 'border-destructive/60 bg-muted text-foreground ring-2 ring-destructive/10')}>
                    {index < activeIndex ? <Check className="size-3" /> : <Icon className="size-3.5" />}
                </span>
                {index < journey.length - 1 && <span className={cn('h-px w-full', index < activeIndex ? 'sim-track-line' : 'bg-border')} />}
            </div>; })}
        </div>
        {!hideLabel && <div className="mt-2 flex w-[172px] items-center"><span className="whitespace-nowrap rounded-full border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">{isClosed ? 'Berhenti' : current}</span></div>}
    </div>;
}
