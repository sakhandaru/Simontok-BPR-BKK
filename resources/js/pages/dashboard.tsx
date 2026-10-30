import { Head, Link, router, usePage } from '@inertiajs/react';
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, ChevronRight, FileCheck2, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { SimEmptyState } from '@/components/sim-empty-state';
import { SimPageHeader } from '@/components/sim-page-header';
import { SimKpiCard } from '@/components/sim-kpi-card';
import { SimStatusBadge, toneForStatus } from '@/components/sim-status-badge';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';

type Delta = { now: number; previous: number; change: number; pct: number | null };

type RiskItem = {
    id: number;
    order_id: number;
    order_no: string | null;
    customer_name: string;
    branch: string | null;
    notary: string | null;
    job_type: string | null;
    doc_status: string | null;
    covernote_status: string | null;
    sla_due_at: string | null;
    covernote_end: string | null;
};

type WorkflowRow = { key: string; label: string; value: number };
type AgingRow = { key: string; stage: string; total: number; buckets: Record<string, number> };
type CalendarRow = { label: string; total: number };
type FunnelRow = { label: string; total: number };
type TrendRow = { label: string; incoming: number; completed: number; risk: number };
type BranchRow = { id: number; code: string; name: string; total_orders: number; active_orders: number; risk_orders: number };
type NotaryRow = { id: number; name: string; total_orders: number; completed_orders: number; risk_orders: number };
type RecentRow = { id: number; order_no: string; customer_name: string; no_rekening: string; status: string; branch: string | null; notary: string | null; created_at: string };
type StatusRow = { status: string; value: string; total: number };

const trendConfig = {
    incoming: { label: 'Masuk', color: 'var(--status-info)' },
    completed: { label: 'Selesai', color: 'var(--track-success)' },
    risk: { label: 'Berisiko', color: 'var(--status-danger)' },
} satisfies ChartConfig;

const calendarConfig = {
    total: { label: 'Covernote', color: 'var(--muted-foreground)' },
} satisfies ChartConfig;

const calendarColors = [
    { fill: 'var(--status-danger)', opacity: 1 },
    { fill: 'var(--status-warning)', opacity: 1 },
    { fill: 'var(--muted-foreground)', opacity: 0.9 },
    { fill: 'var(--muted-foreground)', opacity: 0.5 },
];

const calendarHrefs = ['/orders?covernote=expired', '/orders?covernote=due7', '/orders?covernote=due14', '/orders?covernote=due30'];

const docLabels: Record<string, string> = {
    menunggu_verifikasi: 'Menunggu verifikasi',
    perlu_perbaikan: 'Perlu perbaikan',
    dokumen_valid: 'Dokumen valid',
    draft_diunggah: 'Draft diunggah',
    final_diunggah: 'Final diunggah',
    final_divalidasi: 'Final divalidasi',
};

const paymentHrefs = ['/orders?payment=requested', '/orders?payment=verified', '/orders?payment=approved', '/orders?payment=paid'];
const paymentColors = ['var(--status-warning)', 'var(--status-info)', 'var(--status-success)', 'var(--track-success)'];

const ageParams: Record<string, string> = { '0-7': '0-7', '8-14': '8-14', '15-30': '15-30', '>30': 'gt-30' };

const fmt = (value: number) => value.toLocaleString('id-ID');

export default function Dashboard({
    stats,
    workflow,
    deltas,
    riskItems,
    notaryPerformance,
    branchMonitoring,
    recentOrders,
    statusDistribution,
    analytics,
}: {
    stats: {
        active_orders: number;
        risk_orders: number;
        submitted_orders: number;
        completed_orders: number;
        overdue_sla: number;
        due_soon_sla: number;
        expired_covernotes: number;
        pending_handovers: number;
        pending_final_validation: number;
        total_orders: number;
        completion_rate: number;
        final_validation_rate: number;
        total_collaterals: number;
        final_validated: number;
    };
    workflow: WorkflowRow[];
    deltas: { active: Delta; completed: Delta; period: string };
    riskItems: { overdueSla: RiskItem[]; expiredCovernotes: RiskItem[]; pendingHandovers: RiskItem[] };
    notaryPerformance: NotaryRow[];
    branchMonitoring: BranchRow[];
    recentOrders: RecentRow[];
    statusDistribution: StatusRow[];
    analytics: { agingByStage: AgingRow[]; covernoteCalendar: CalendarRow[]; paymentFunnel: FunnelRow[]; weeklyTrend: TrendRow[] };
}) {
    const { auth } = usePage<{ auth: { permissions?: string[] } }>().props;
    const canOrders = auth.permissions?.includes('orders.view') ?? false;
    const canReports = auth.permissions?.includes('reports.view') ?? false;
    const canCreate = auth.permissions?.includes('orders.create') ?? false;

    const workflowTotal = workflow.reduce((sum, row) => sum + row.value, 0);
    const statusTotal = statusDistribution.reduce((sum, row) => sum + row.total, 0);
    const funnelMax = Math.max(...analytics.paymentFunnel.map((row) => row.total), 1);
    const statusMax = Math.max(...statusDistribution.map((row) => row.total), 1);
    const trendHasData = analytics.weeklyTrend.some((row) => row.incoming > 0 || row.completed > 0 || row.risk > 0);
    const calendarHasData = analytics.covernoteCalendar.some((row) => row.total > 0);
    const funnelHasData = analytics.paymentFunnel.some((row) => row.total > 0);
    const agingHasData = analytics.agingByStage.some((row) => row.total > 0);

    const orderGroups = [
        { key: 'sla', title: 'SLA terlambat', count: stats.overdue_sla, items: riskItems.overdueSla, href: '/orders?sla=overdue', due: (item: RiskItem) => item.sla_due_at, note: (item: RiskItem) => item.job_type ?? '-', danger: true },
        { key: 'covernote', title: 'Covernote kedaluwarsa', count: stats.expired_covernotes, items: riskItems.expiredCovernotes, href: '/orders?covernote=expired', due: (item: RiskItem) => item.covernote_end, note: (item: RiskItem) => item.job_type ?? '-', danger: true },
        { key: 'handover', title: 'Handover belum tercatat', count: stats.pending_handovers, items: riskItems.pendingHandovers, href: '/orders?handover=pending', due: () => 'Menunggu handover', note: (item: RiskItem) => (item.doc_status ? (docLabels[item.doc_status] ?? item.doc_status) : '-'), danger: false },
    ].filter((group) => group.count > 0);

    return (
        <>
            <Head title="Overview" />
            <div className="sim-workspace">
                <SimPageHeader
                    title="Overview"
                    description="Posisi terkini order, dokumen, covernote, dan pembayaran yang perlu ditindaklanjuti."
                    actions={
                        <>
                            {canReports && (
                                <Button type="button" variant="outline" asChild>
                                    <Link href="/reports">
                                        Laporan
                                        <ArrowRight className="size-4" />
                                    </Link>
                                </Button>
                            )}
                            {canCreate && (
                                <Button type="button" asChild>
                                    <Link href="/orders/create">
                                        Buat order
                                        <ArrowRight className="size-4" />
                                    </Link>
                                </Button>
                            )}
                        </>
                    }
                />

                <div className="grid grid-cols-1 items-start gap-3 sm:gap-4 lg:grid-cols-12">
                    <div className="col-span-full grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-12">
                    <SimKpiCard
                        className="lg:col-span-3"
                        label="Order aktif"
                        icon={Activity}
                        value={fmt(stats.active_orders)}
                        note={`Posisi ${deltas.period}: ${fmt(deltas.active.previous)} order`}
                        href={canOrders ? '/orders?active=1' : undefined}
                        linkLabel="buka daftar order aktif"
                    >
                        <DeltaChip delta={deltas.active} period={deltas.period} tone="neutral" />
                    </SimKpiCard>

                    <SimKpiCard
                        className="lg:col-span-3"
                        label="Perlu perhatian"
                        icon={AlertTriangle}
                        value={fmt(stats.risk_orders)}
                        note={`${fmt(stats.submitted_orders)} menunggu persetujuan`}
                        href={canOrders ? '/orders?risk=1' : undefined}
                        linkLabel="buka daftar order berisiko"
                    >
                        {stats.overdue_sla > 0 ? (
                            <Chip tone="danger">{fmt(stats.overdue_sla)} SLA terlambat</Chip>
                        ) : (
                            <Chip tone="success">SLA aman</Chip>
                        )}
                    </SimKpiCard>

                    <SimKpiCard
                        className="lg:col-span-3"
                        label="Order selesai"
                        icon={CheckCircle2}
                        value={fmt(stats.completed_orders)}
                        note={`Posisi ${deltas.period}: ${fmt(deltas.completed.previous)} order`}
                        href={canOrders ? '/orders?status=selesai' : undefined}
                        linkLabel="buka daftar order selesai"
                    >
                        <div className="flex items-center gap-3">
                            <DeltaChip delta={deltas.completed} period={deltas.period} tone={deltas.completed.change > 0 ? 'success' : deltas.completed.change < 0 ? 'danger' : 'neutral'} />
                            <ChartContainer config={{ completed: { label: 'Selesai per minggu', color: 'var(--track-success)' } }} className="aspect-auto h-8 min-w-24 flex-1" aria-hidden="true">
                                <LineChart data={analytics.weeklyTrend} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                    <Line dataKey="completed" stroke="var(--color-completed)" strokeWidth={2} dot={false} isAnimationActive={false} />
                                </LineChart>
                            </ChartContainer>
                        </div>
                    </SimKpiCard>

                    <SimKpiCard
                        className="lg:col-span-3"
                        label="Dokumen final tervalidasi"
                        icon={FileCheck2}
                        value={`${fmt(stats.final_validation_rate)}%`}
                        note={`${fmt(stats.final_validated)} dari ${fmt(stats.total_collaterals)} dokumen agunan`}
                        href={canOrders ? '/orders?doc=final_divalidasi' : undefined}
                        linkLabel="buka daftar dokumen final tervalidasi"
                    >
                        {stats.pending_final_validation > 0 ? (
                            <Chip tone="warning">{fmt(stats.pending_final_validation)} menunggu validasi</Chip>
                        ) : (
                            <Chip tone="success">Semua tervalidasi</Chip>
                        )}
                    </SimKpiCard>
                    </div>

                    {/* Antrian tindakan: fokus kerja hari ini */}
                    <Panel
                        className="lg:col-span-7"
                        title="Antrian tindakan"
                        subtitle="Pekerjaan prioritas hari ini, paling mendesak di urutan atas."
                    >
                        {orderGroups.length === 0 ? (
                            <SimEmptyState title="Tidak ada antrian tindakan" description="SLA, covernote, dan handover order aktif saat ini aman." />
                        ) : (
                            <div>
                                {orderGroups.map((group) => (
                                    <div key={group.key}>
                                        <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-2">
                                            <p className="text-sm font-semibold">
                                                {group.title} <span className="font-normal text-muted-foreground">({fmt(group.count)})</span>
                                            </p>
                                            {canOrders && (
                                                <Link href={group.href} className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                                                    Lihat semua
                                                    <ArrowRight className="size-3" />
                                                </Link>
                                            )}
                                        </div>
                                        {group.items.length === 0 ? (
                                            <p className="border-b border-border px-4 py-3 text-sm text-muted-foreground">Tidak ada baris untuk ditampilkan.</p>
                                        ) : (
                                            group.items.map((item) => {
                                                const row = (
                                                    <>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-medium">{item.order_no ?? '-'}</p>
                                                            <p className="line-clamp-2 text-[13px] leading-5 text-muted-foreground">
                                                                {item.customer_name} · {item.branch ?? '-'}
                                                            </p>
                                                        </div>
                                                        <div className="shrink-0 text-right">
                                                            <p className={cn('text-sm font-medium', group.danger && 'text-[var(--status-danger)]')}>{group.due(item) ?? '-'}</p>
                                                            <p className="max-w-36 text-[13px] leading-5 text-muted-foreground">{group.note(item)}</p>
                                                        </div>
                                                    </>
                                                );
                                                return canOrders ? (
                                                    <Link key={item.id} href={`/orders/${item.order_id}`} className="flex min-h-12 items-center gap-3 border-b border-border px-4 py-2.5 transition-colors last:border-b-0 hover:bg-muted/30">
                                                        {row}
                                                    </Link>
                                                ) : (
                                                    <div key={item.id} className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0">
                                                        {row}
                                                    </div>
                                                );
                                            })
                                        )}
                                        {group.count > group.items.length && <p className="border-b border-border px-4 py-2 text-[13px] leading-5 text-muted-foreground">Menampilkan {group.items.length} terbaru dari {fmt(group.count)} baris. Buka daftar untuk melihat semua.</p>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </Panel>

                    <Panel className="lg:col-span-5 lg:h-full" title="Kontrol harian" subtitle="Empat angka yang dicek setiap hari.">
                        <div className="flex flex-1 flex-col divide-y divide-border">
                            <ControlRow label="SLA terlambat" value={stats.overdue_sla} tone={stats.overdue_sla > 0 ? 'danger' : 'neutral'} href={canOrders ? '/orders?sla=overdue' : undefined} />
                            <ControlRow label="SLA mendekati batas (H-7)" value={stats.due_soon_sla} tone={stats.due_soon_sla > 0 ? 'warning' : 'neutral'} href={canOrders ? '/orders?sla=due_soon' : undefined} />
                            <ControlRow label="Covernote kedaluwarsa" value={stats.expired_covernotes} tone={stats.expired_covernotes > 0 ? 'danger' : 'neutral'} href={canOrders ? '/orders?covernote=expired' : undefined} />
                            <ControlRow label="Handover belum tercatat" value={stats.pending_handovers} tone={stats.pending_handovers > 0 ? 'warning' : 'neutral'} href={canOrders ? '/orders?handover=pending' : undefined} />
                        </div>
                        <div className="mt-auto border-t border-border p-4">
                            <p className="text-sm font-semibold">Jatuh tempo covernote</p>
                            <p className="mb-3 text-[13px] leading-5 text-muted-foreground">Berdasarkan tanggal berlaku covernote order aktif.</p>
                            {calendarHasData ? (
                                <ChartContainer config={calendarConfig} className="aspect-auto h-32 w-full">
                                    <BarChart data={analytics.covernoteCalendar} margin={{ top: 0, right: 4, bottom: 0, left: -20 }}>
                                        <CartesianGrid vertical={false} stroke="var(--border)" />
                                        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} tick={{ fontSize: 12 }} />
                                        <YAxis hide allowDecimals={false} domain={[0, 'dataMax']} />
                                        <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: 'var(--muted)' }} />
                                        <Bar
                                            dataKey="total"
                                            radius={[4, 4, 0, 0]}
                                            isAnimationActive={false}
                                            onClick={(_data: unknown, index: number) => {
                                                if (canOrders && index >= 0) router.get(calendarHrefs[index]);
                                            }}
                                            style={{ cursor: canOrders ? 'pointer' : 'default' }}
                                        >
                                            {analytics.covernoteCalendar.map((row, index) => (
                                                <Cell key={row.label} fill={calendarColors[index]?.fill ?? 'var(--muted-foreground)'} fillOpacity={calendarColors[index]?.opacity ?? 1} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ChartContainer>
                            ) : (
                                <SimEmptyState className="min-h-32" title="Tidak ada covernote tercatat" description="Tidak ada jatuh tempo covernote pada order aktif." />
                            )}
                            <div className="mt-3 flex flex-wrap gap-1.5">
                                {analytics.covernoteCalendar.map((row, index) =>
                                    canOrders ? (
                                        <Link key={row.label} href={calendarHrefs[index]} className="inline-flex min-h-11 items-center rounded-full border border-border px-3 py-1 text-[13px] font-medium transition-colors hover:bg-muted">
                                            {row.label} · {fmt(row.total)}
                                        </Link>
                                    ) : (
                                        <span key={row.label} className="inline-flex min-h-11 items-center rounded-full border border-border px-3 py-1 text-[13px] font-medium">
                                            {row.label} · {fmt(row.total)}
                                        </span>
                                    ),
                                )}
                            </div>
                        </div>
                    </Panel>

                    <Panel className="lg:col-span-7" title="Pipeline pengajuan" subtitle="Sebaran order pada tujuh tahap pengerjaan.">
                        {workflowTotal === 0 ? (
                            <SimEmptyState title="Belum ada order" description="Order baru akan muncul di pipeline setelah dibuat." />
                        ) : (
                            <div>
                                {workflow.map((row) => {
                                    const percentage = workflowTotal > 0 ? Math.round((row.value / workflowTotal) * 100) : 0;
                                    const bar = (
                                        <>
                                            <div className="flex items-center justify-between gap-3 text-sm">
                                                <span className="truncate font-medium">{row.label}</span>
                                                <span className="tabular-nums">{fmt(row.value)} · {percentage}%</span>
                                            </div>
                                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                                                <div className={cn('h-full rounded-full', row.key === 'selesai' ? 'bg-[var(--track-success)]' : 'bg-foreground/60')} style={{ width: `${percentage}%` }} />
                                            </div>
                                        </>
                                    );
                                    return canOrders ? (
                                        <Link key={row.key} href={`/orders?stage=${row.key}`} className="block border-b border-border px-4 py-2.5 transition-colors last:border-b-0 hover:bg-muted/30">
                                            {bar}
                                        </Link>
                                    ) : (
                                        <div key={row.key} className="border-b border-border px-4 py-2.5 last:border-b-0">
                                            {bar}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Panel>

                    <Panel className="lg:col-span-5" title="Funnel pembayaran" subtitle="Posisi invoice dari diajukan sampai dibayar.">
                        {!funnelHasData ? (
                            <SimEmptyState title="Belum ada invoice" description="Invoice akan muncul di sini setelah diajukan notaris." />
                        ) : (
                            <div className="flex min-h-[23.25rem] flex-col items-center justify-center p-4">
                                <ChartContainer config={{ total: { label: 'Pembayaran', color: 'var(--status-info)' } }} className="aspect-square h-52 w-full max-w-xs">
                                    <PieChart>
                                        <ChartTooltip content={<ChartTooltipContent />} />
                                        <Pie data={analytics.paymentFunnel} dataKey="total" nameKey="label" innerRadius={52} outerRadius={82} paddingAngle={3} stroke="var(--background)" strokeWidth={3} isAnimationActive={false}>
                                            {analytics.paymentFunnel.map((row, index) => <Cell key={row.label} fill={paymentColors[index] ?? 'var(--muted-foreground)'} />)}
                                        </Pie>
                                    </PieChart>
                                </ChartContainer>
                                <div className="mt-4 grid w-full max-w-sm grid-cols-2 gap-2">
                                    {analytics.paymentFunnel.map((row, index) => {
                                        const content = <><span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: paymentColors[index] ?? 'var(--muted-foreground)' }} /><span className="min-w-0 flex-1 text-[13px] leading-5">{row.label}</span><span className="text-sm font-semibold tabular-nums">{fmt(row.total)}</span></>;
                                        return canOrders ? <Link key={row.label} href={paymentHrefs[index]} className="flex min-h-11 min-w-0 items-center gap-2 rounded-md border border-border px-2.5 py-2 transition-colors hover:bg-muted">{content}</Link> : <div key={row.label} className="flex min-h-11 min-w-0 items-center gap-2 rounded-md border border-border px-2.5 py-2">{content}</div>;
                                    })}
                                </div>
                            </div>
                        )}
                    </Panel>

                    <Panel className="lg:col-span-7" title="Kesehatan dokumen" subtitle="Umur pekerjaan aktif per tahap, dalam hari sejak order dibuat.">
                        {!agingHasData ? (
                            <SimEmptyState title="Tidak ada order aktif" description="Matriks umur terisi saat ada order dalam pengerjaan." />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="sim-table min-w-[560px]">
                                    <thead>
                                        <tr>
                                            <th>Tahap</th>
                                            <th className="text-right">0-7 hari</th>
                                            <th className="text-right">8-14 hari</th>
                                            <th className="text-right">15-30 hari</th>
                                            <th className="text-right">&gt;30 hari</th>
                                            <th className="text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {analytics.agingByStage.map((row) => (
                                            <tr key={row.key}>
                                                <td>
                                                    {canOrders && row.total > 0 ? (
                                                        <Link href={`/orders?stage=${row.key}`} className="font-medium underline-offset-4 hover:underline">
                                                            {row.stage}
                                                        </Link>
                                                    ) : (
                                                        <span className="font-medium">{row.stage}</span>
                                                    )}
                                                </td>
                                                {(['0-7', '8-14', '15-30', '>30'] as const).map((bucket) => {
                                                    const value = row.buckets[bucket] ?? 0;
                                                    const stale = bucket === '>30';
                                                    const aging = bucket === '15-30';
                                                    return (
                                                        <td key={bucket} className="text-right">
                                                            {value === 0 ? (
                                                                <span className="text-muted-foreground/70 tabular-nums">0</span>
                                                            ) : canOrders ? (
                                                                <Link href={`/orders?stage=${row.key}&age=${ageParams[bucket]}`} className={cn('tabular-nums underline-offset-4 hover:underline', stale && 'text-[var(--status-danger)] font-medium', aging && value > 0 && 'text-[var(--status-warning)] font-medium')}>
                                                                    {fmt(value)}
                                                                </Link>
                                                            ) : (
                                                                <span className={cn('tabular-nums', stale && 'text-[var(--status-danger)] font-medium', aging && 'text-[var(--status-warning)] font-medium')}>{fmt(value)}</span>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                                <td className="text-right font-semibold tabular-nums">{fmt(row.total)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Panel>

                    <Panel className="lg:col-span-5 lg:h-full" title="Pergerakan aktivitas" subtitle="Delapan minggu terakhir: masuk, selesai, berisiko.">
                        {trendHasData ? (
                            <div className="h-full p-4">
                                <ChartContainer config={trendConfig} className="aspect-auto h-full min-h-56 w-full">
                                    <LineChart data={analytics.weeklyTrend} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                                        <CartesianGrid vertical={false} stroke="var(--border)" />
                                        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 12 }} />
                                        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={36} allowDecimals={false} />
                                        <ChartTooltip content={<ChartTooltipContent />} />
                                        <Line dataKey="incoming" stroke="var(--color-incoming)" strokeWidth={2} dot={false} isAnimationActive={false} />
                                        <Line dataKey="completed" stroke="var(--color-completed)" strokeWidth={2} dot={false} isAnimationActive={false} />
                                        <Line dataKey="risk" stroke="var(--color-risk)" strokeWidth={2} dot={false} isAnimationActive={false} />
                                        <ChartLegend content={<ChartLegendContent />} />
                                    </LineChart>
                                </ChartContainer>
                            </div>
                        ) : (
                            <SimEmptyState title="Belum ada pergerakan" description="Tidak ada order masuk, selesai, atau berisiko dalam delapan minggu terakhir." />
                        )}
                    </Panel>

                    <Panel
                        className="lg:col-span-4 lg:h-full"
                        title="Performa cabang"
                        subtitle="Beban dan risiko, enam cabang teratas."
                        action={
                            canReports ? (
                                <Link href="/reports" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                                    Laporan
                                    <ArrowRight className="size-3" />
                                </Link>
                            ) : undefined
                        }
                    >
                        {branchMonitoring.length === 0 ? (
                            <SimEmptyState title="Belum ada data cabang" description="Data muncul setelah ada order yang tercatat." />
                        ) : (
                            <div className="max-h-[26rem] overflow-y-auto">
                                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-3 border-b border-border bg-muted/30 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    <span>Cabang</span>
                                    <span className="w-14 whitespace-nowrap text-right">Total</span>
                                    <span className="w-14 whitespace-nowrap text-right">Aktif</span>
                                    <span className="w-14 whitespace-nowrap text-right">Risiko</span>
                                </div>
                                {branchMonitoring.map((row) => {
                                    const body = (
                                        <>
                                            <span className="min-w-0 text-sm font-medium leading-5">
                                                {row.name} <span className="font-normal text-muted-foreground">({row.code})</span>
                                            </span>
                                            <span className="w-14 text-right text-sm tabular-nums">{fmt(row.total_orders)}</span>
                                            <span className="w-14 text-right text-sm tabular-nums">{fmt(row.active_orders)}</span>
                                            <span className={cn('w-14 text-right text-sm tabular-nums', row.risk_orders > 0 && 'font-medium text-[var(--status-danger)]')}>{fmt(row.risk_orders)}</span>
                                        </>
                                    );
                                    return canReports ? (
                                        <Link key={row.id} href={`/reports?branch_id=${row.id}`} className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-3 border-b border-border px-4 py-2.5 transition-colors last:border-b-0 hover:bg-muted/30">
                                            {body}
                                        </Link>
                                    ) : (
                                        <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0">
                                            {body}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Panel>

                    <Panel
                        className="lg:col-span-4 lg:h-full"
                        title="Performa notaris"
                        subtitle="Beban dan hasil, enam notaris teratas."
                        action={
                            canReports ? (
                                <Link href="/reports" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                                    Laporan
                                    <ArrowRight className="size-3" />
                                </Link>
                            ) : undefined
                        }
                    >
                        {notaryPerformance.length === 0 ? (
                            <SimEmptyState title="Belum ada data notaris" description="Data muncul setelah ada order yang tercatat." />
                        ) : (
                            <div className="max-h-[26rem] overflow-y-auto">
                                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-3 border-b border-border bg-muted/30 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    <span>Notaris</span>
                                    <span className="w-14 whitespace-nowrap text-right">Total</span>
                                    <span className="w-14 whitespace-nowrap text-right">Selesai</span>
                                    <span className="w-14 whitespace-nowrap text-right">Risiko</span>
                                </div>
                                {notaryPerformance.map((row) => {
                                    const body = (
                                        <>
                                            <span className="min-w-0 text-sm font-medium leading-5">{row.name}</span>
                                            <span className="w-14 text-right text-sm tabular-nums">{fmt(row.total_orders)}</span>
                                            <span className="w-14 text-right text-sm tabular-nums">{fmt(row.completed_orders)}</span>
                                            <span className={cn('w-14 text-right text-sm tabular-nums', row.risk_orders > 0 && 'font-medium text-[var(--status-danger)]')}>{fmt(row.risk_orders)}</span>
                                        </>
                                    );
                                    return canReports ? (
                                        <Link key={row.id} href={`/reports?notary_id=${row.id}`} className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-3 border-b border-border px-4 py-2.5 transition-colors last:border-b-0 hover:bg-muted/30">
                                            {body}
                                        </Link>
                                    ) : (
                                        <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0">
                                            {body}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Panel>

                    <Panel className="lg:col-span-4 lg:h-full" title="Distribusi status order" subtitle="Jumlah order menurut status terkini.">
                        {statusTotal === 0 ? (
                            <SimEmptyState title="Belum ada order" description="Distribusi status terisi setelah order pertama dibuat." />
                        ) : (
                            <div className="max-h-[26rem] overflow-y-auto">
                                {statusDistribution.map((row) => {
                                    const body = (
                                        <>
                                            <SimStatusBadge label={row.status} tone={toneForStatus(row.status)} className="h-auto min-h-7 whitespace-normal py-1 text-[13px] leading-5" />
                                            <span className="w-10 text-right text-sm font-medium tabular-nums">{fmt(row.total)}</span>
                                        </>
                                    );
                                    return canOrders ? (
                                        <Link key={row.value} href={`/orders?status=${row.value}`} className="flex min-h-12 items-center justify-between gap-3 border-b border-border px-4 py-2.5 transition-colors last:border-b-0 hover:bg-muted/30">
                                            {body}
                                        </Link>
                                    ) : (
                                        <div key={row.value} className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 last:border-b-0">
                                            {body}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Panel>

                    <Panel
                        className="lg:col-span-12"
                        title="Order terbaru"
                        subtitle="Delapan order yang terakhir tercatat."
                        action={
                            canOrders ? (
                                <Link href="/orders" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                                    Buka daftar
                                    <ArrowRight className="size-3" />
                                </Link>
                            ) : undefined
                        }
                    >
                        {recentOrders.length === 0 ? (
                            <SimEmptyState title="Belum ada order tercatat" description="Order baru akan muncul di sini setelah dibuat." />
                        ) : (
                            <div>
                                {recentOrders.map((order) => {
                                    const body = (
                                        <>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-base font-medium">{order.order_no}</span>
                                                    <SimStatusBadge label={order.status} tone={toneForStatus(order.status)} className="h-auto min-h-7 whitespace-normal py-1 text-[13px] leading-5" />
                                                </div>
                                                <p className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-muted-foreground">
                                                    {order.customer_name} · {order.no_rekening} · {order.branch ?? '-'} · {order.notary ?? '-'}
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-2 text-[13px] text-muted-foreground">
                                                <span>{order.created_at}</span>
                                                {canOrders && <ChevronRight className="size-4" />}
                                            </div>
                                        </>
                                    );
                                    return canOrders ? (
                                            <Link key={order.id} href={`/orders/${order.id}`} className="flex min-h-14 flex-col items-start gap-2 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/30 sm:flex-row sm:items-center sm:gap-3">
                                            {body}
                                        </Link>
                                    ) : (
                                        <div key={order.id} className="flex flex-col items-start gap-2 border-b border-border px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-3">
                                            {body}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Panel>
                </div>
            </div>
        </>
    );
}

function Panel({ title, subtitle, action, children, className }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
    return (
        <section className={cn('sim-panel flex min-w-0 self-start flex-col', className)}>
            <div className="sim-panel-header flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="text-base font-semibold leading-6">{title}</h2>
                    {subtitle && <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{subtitle}</p>}
                </div>
                {action}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">{children}</div>
        </section>
    );
}

function Chip({ tone, children }: { tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info'; children: React.ReactNode }) {
    const tones = {
        neutral: 'border-border bg-muted/40 text-muted-foreground',
        success: 'sim-status-success',
        warning: 'sim-status-warning',
        danger: 'sim-status-danger',
        info: 'sim-status-info',
    };
    return <span className={cn('inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-medium leading-none', tones[tone])}>{children}</span>;
}

function DeltaChip({ delta, period, tone }: { delta: Delta; period: string; tone: 'neutral' | 'success' | 'danger' }) {
    const up = delta.change > 0;
    const flat = delta.change === 0;
    const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
    const text = delta.pct === null ? `${up ? '+' : ''}${fmt(delta.change)} order` : `${up ? '+' : ''}${fmt(delta.pct)}%`;
    return (
        <Chip tone={tone} >
            <span className="inline-flex items-center gap-1" title={period}>
                <Icon className="size-3" />
                {text}
            </span>
        </Chip>
    );
}

function ControlRow({ label, value, tone, href }: { label: string; value: number; tone: 'neutral' | 'warning' | 'danger'; href?: string }) {
    const body = (
        <>
            <div className="min-w-0">
                <p className="text-sm font-medium">{label}</p>
                {value === 0 && <p className="text-[13px] leading-5 text-muted-foreground">Tidak ada tunggakan</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
                <span className={cn('text-xl font-semibold tabular-nums', tone === 'danger' && value > 0 && 'text-[var(--status-danger)]', tone === 'warning' && value > 0 && 'text-[var(--status-warning)]')}>{fmt(value)}</span>
                {href && <ChevronRight className="size-4 text-muted-foreground" />}
            </div>
        </>
    );
    const classes = 'flex flex-1 items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-muted/30';
    return href ? (
        <Link href={href} className={classes}>
            {body}
        </Link>
    ) : (
        <div className={cn(classes, 'hover:bg-transparent')}>{body}</div>
    );
}

Dashboard.layout = { breadcrumbs: [{ title: 'Dashboard', href: dashboard() }] };
