import { Head, Link } from '@inertiajs/react';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, FileCheck2, FileText, Handshake, Landmark, TimerReset } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { dashboard } from '@/routes';
import type { OrderListItem } from '@/types';

type RiskItem = { id: number; order_id: number; order_no: string; customer_name: string; branch: string; notary: string; job_type: string; sla_due_at?: string; covernote_end?: string };
type DashboardProps = {
    stats: { active_orders: number; risk_orders: number; submitted_orders: number; completed_orders: number; overdue_sla: number; due_soon_sla: number; expired_covernotes: number; pending_handovers: number; total_orders: number; completion_rate: number; final_validation_rate: number };
    workflow: { label: string; value: number }[];
    riskItems: { expiredCovernotes: RiskItem[]; overdueSla: RiskItem[]; pendingHandovers: RiskItem[] };
    recentOrders: OrderListItem[];
    analytics: { agingByStage: { stage: string; total: number; buckets: Record<string, number> }[]; covernoteCalendar: { label: string; total: number }[]; paymentFunnel: { label: string; total: number }[]; weeklyTrend: { label: string; incoming: number; completed: number; risk: number }[] };
};

export default function Dashboard({ stats, workflow, riskItems, recentOrders, analytics }: DashboardProps) {
    const queue = [
        ...riskItems.overdueSla.map((item) => ({ ...item, kind: 'SLA terlambat', due: item.sla_due_at, tone: 'danger' as const })),
        ...riskItems.expiredCovernotes.map((item) => ({ ...item, kind: 'Covernote kedaluwarsa', due: item.covernote_end, tone: 'danger' as const })),
        ...riskItems.pendingHandovers.map((item) => ({ ...item, kind: 'Belum handover', due: item.sla_due_at, tone: 'warning' as const })),
    ].slice(0, 8);
    const totalPipeline = workflow.reduce((sum, item) => sum + item.value, 0);

    return <>
        <Head title="Dashboard SIMONTOK" />
        <div className="sim-workspace gap-6">
            <header className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-end md:justify-between">
                <div><p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Overview operasional</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">Dashboard</h1><p className="mt-1 text-sm text-muted-foreground">Ringkasan pengajuan dan pekerjaan yang membutuhkan perhatian.</p></div>
                <div className="flex gap-2"><Button variant="outline" asChild><Link href="/reports">Lihat laporan <ArrowRight className="ml-2 size-4" /></Link></Button><Button asChild><Link href="/orders?create=1">Buat order</Link></Button></div>
            </header>

            <section className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Order aktif" value={stats.active_orders} note={stats.total_orders + ' total order'} icon={Clock3} href="/orders" tone="info" />
                <Metric label="Perlu perhatian" value={stats.risk_orders} note={stats.overdue_sla + ' SLA terlambat'} icon={AlertTriangle} href="/orders?risk=1" tone="danger" />
                <Metric label="Selesai" value={stats.completed_orders} note={stats.completion_rate + '% completion rate'} icon={CheckCircle2} href="/orders?status=selesai" tone="success" />
                <Metric label="Baru masuk" value={stats.submitted_orders} note="Menunggu proses awal" icon={FileCheck2} href="/orders?status=diajukan" tone="warning" />
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
                <Card className="gap-0 py-0"><CardHeader className="border-b px-4 py-4 sm:px-5"><div className="flex items-start justify-between gap-4"><div><CardTitle className="text-base">Antrian tindakan</CardTitle><CardDescription className="mt-1">Prioritas yang perlu ditangani terlebih dahulu.</CardDescription></div><Badge variant="outline" className="shrink-0 tabular-nums">{queue.length} tampil</Badge></div></CardHeader><CardContent className="p-0">{queue.length === 0 ? <EmptyState title="Tidak ada antrian kritis" description="Semua pekerjaan prioritas berada dalam kondisi terkendali." /> : <div className="divide-y">{queue.map((item) => <Link key={item.kind + item.id} href={'/orders/' + item.order_id} className="group grid gap-3 px-4 py-4 transition-colors hover:bg-muted/30 sm:grid-cols-[minmax(0,1fr)_170px_auto] sm:items-center sm:px-5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{item.order_no}</span><RiskBadge tone={item.tone}>{item.kind}</RiskBadge></div><p className="mt-1 truncate text-sm text-muted-foreground">{item.customer_name} <span className="text-border">/</span> {item.job_type}</p></div><div className="text-sm sm:text-right"><div className="text-muted-foreground">Tenggat</div><div className="font-medium">{item.due ?? 'Tidak tersedia'}</div></div><ArrowRight className="hidden size-4 text-muted-foreground transition-transform group-hover:translate-x-1 sm:block" /></Link>)}</div>}</CardContent></Card>
                <Card className="gap-0 py-0"><CardHeader className="border-b px-4 py-4"><CardTitle className="text-base">SLA & dokumen</CardTitle><CardDescription className="mt-1">Hal yang perlu dipantau hari ini.</CardDescription></CardHeader><CardContent className="space-y-1 p-3"><ActionRow label="SLA terlambat" value={stats.overdue_sla} href="/orders?sla=overdue" tone="danger" icon={AlertTriangle} /><ActionRow label="SLA H-7" value={stats.due_soon_sla} href="/orders?sla=due_soon" tone="warning" icon={TimerReset} /><ActionRow label="Covernote kedaluwarsa" value={stats.expired_covernotes} href="/orders?risk=1" tone="danger" icon={FileText} /><ActionRow label="Belum handover" value={stats.pending_handovers} href="/reports" icon={Handshake} /></CardContent></Card>
            </section>

            <Card className="gap-0 py-0"><CardHeader className="border-b px-4 py-4 sm:px-5"><div className="flex items-center justify-between gap-4"><div><CardTitle className="text-base">Pipeline pengajuan</CardTitle><CardDescription className="mt-1">Distribusi order aktif berdasarkan node proses.</CardDescription></div><span className="text-sm tabular-nums text-muted-foreground">{totalPipeline} aktif</span></div></CardHeader><CardContent className="overflow-x-auto p-4 sm:p-5"><div className="grid min-w-[840px] grid-cols-7 gap-3">{workflow.map((item) => <PipelineStep key={item.label} label={item.label} value={item.value} total={totalPipeline} />)}</div></CardContent></Card>

            <section className="grid gap-6 lg:grid-cols-2">
                <Card className="gap-0 py-0"><CardHeader className="border-b px-4 py-4 sm:px-5"><CardTitle className="text-base">Pergerakan 8 minggu</CardTitle><CardDescription className="mt-1">Order masuk, selesai, dan yang ditandai risiko.</CardDescription></CardHeader><CardContent className="p-4 sm:p-5"><TrendChart rows={analytics.weeklyTrend} /></CardContent></Card>
                <Card className="gap-0 py-0"><CardHeader className="border-b px-4 py-4 sm:px-5"><CardTitle className="text-base">Order terbaru</CardTitle><CardDescription className="mt-1">Aktivitas terakhir yang masuk ke sistem.</CardDescription></CardHeader><CardContent className="divide-y p-0">{recentOrders.length === 0 ? <EmptyState title="Belum ada order" description="Order baru akan muncul di sini." /> : recentOrders.slice(0, 6).map((order) => <Link key={order.id} href={'/orders/' + order.id} className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-muted/30 sm:px-5"><div className="min-w-0"><div className="truncate font-medium">{order.order_no}</div><div className="mt-0.5 truncate text-xs text-muted-foreground">{order.customer_name} · {order.status}</div></div><ArrowRight className="size-4 shrink-0 text-muted-foreground" /></Link>)}</CardContent></Card>
            </section>

            <section className="grid gap-6 lg:grid-cols-2"><MonitorPanel title="Covernote jatuh tempo" description="Distribusi dokumen berdasarkan jarak jatuh tempo." rows={analytics.covernoteCalendar} /><MonitorPanel title="Funnel pembayaran" description="Posisi pengajuan pembayaran dari notaris." rows={analytics.paymentFunnel} /></section>
        </div>
    </>;
}

function Metric({ label, value, note, icon: Icon, href, tone = 'neutral' }: { label: string; value: number; note: string; icon: typeof AlertTriangle; href: string; tone?: 'neutral' | 'danger' | 'success' | 'info' | 'warning' }) {
    const color = tone === 'danger' ? 'text-status-danger' : tone === 'success' ? 'text-status-success' : tone === 'info' ? 'text-status-info' : tone === 'warning' ? 'text-status-warning' : 'text-muted-foreground';
    const accent = tone === 'danger' ? 'border-t-status-danger' : tone === 'success' ? 'border-t-status-success' : tone === 'info' ? 'border-t-status-info' : tone === 'warning' ? 'border-t-status-warning' : 'border-t-transparent';
    return <Link href={href} className={'group border-t-2 bg-card p-4 transition-colors hover:bg-muted/30 sm:p-5 ' + accent}><div className="flex items-center justify-between gap-3"><span className="text-sm text-muted-foreground">{label}</span><Icon className={'size-4 ' + color} /></div><div className={'mt-3 text-3xl font-semibold tabular-nums tracking-tight ' + (tone !== 'neutral' ? color : '')}>{value}</div><div className="mt-1 text-xs text-muted-foreground">{note}</div></Link>;
}
function ActionRow({ label, value, href, icon: Icon, tone = 'neutral' }: { label: string; value: number; href: string; icon: typeof AlertTriangle; tone?: 'neutral' | 'danger' | 'warning' }) {
    const color = tone === 'danger' ? 'text-status-danger' : tone === 'warning' ? 'text-status-warning' : 'text-muted-foreground';
    return <Link href={href} className="flex items-center justify-between gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-muted/50"><span className="flex items-center gap-2.5 text-sm"><Icon className={'size-4 ' + color} />{label}</span><span className={'font-semibold tabular-nums ' + (value > 0 ? color : '')}>{value}</span></Link>;
}
function RiskBadge({ children, tone }: { children: React.ReactNode; tone: 'danger' | 'warning' }) { return <span className={'rounded-full border px-2 py-0.5 text-[11px] font-medium ' + (tone === 'danger' ? 'border-status-danger/30 text-status-danger' : 'border-status-warning/40 text-status-warning')}>{children}</span>; }
function PipelineStep({ label, value, total }: { label: string; value: number; total: number }) { const percentage = total ? Math.round((value / total) * 100) : 0; return <div className="min-w-0"><div className="flex items-baseline justify-between gap-2"><span className="truncate text-xs text-muted-foreground">{label}</span><span className="font-semibold tabular-nums">{value}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-foreground/70" style={{ width: percentage + '%' }} /></div><div className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">{percentage}%</div></div>; }
function TrendChart({ rows }: { rows: DashboardProps['analytics']['weeklyTrend'] }) { const max = Math.max(1, ...rows.flatMap((row) => [row.incoming, row.completed, row.risk])); if (!rows.length) return <EmptyState title="Belum ada tren" description="Data tren akan tampil setelah aktivitas tercatat." />; return <div className="space-y-4"><div className="flex gap-4 text-[11px] text-muted-foreground"><Legend color="bg-foreground/70" label="Masuk" /><Legend color="bg-status-success" label="Selesai" /><Legend color="bg-status-danger" label="Risiko" /></div>{rows.map((row) => <div key={row.label} className="grid grid-cols-[42px_1fr_96px] items-center gap-3 text-xs"><span className="text-muted-foreground">{row.label}</span><div className="flex h-7 items-end gap-1"><Bar value={row.incoming} max={max} className="bg-foreground/70" /><Bar value={row.completed} max={max} className="bg-status-success" /><Bar value={row.risk} max={max} className="bg-status-danger" /></div><span className="text-right tabular-nums text-muted-foreground">{row.incoming} masuk</span></div>)}</div>; }
function Legend({ color, label }: { color: string; label: string }) { return <span className="flex items-center gap-1.5"><span className={'size-2 rounded-full ' + color} />{label}</span>; }
function Bar({ value, max, className }: { value: number; max: number; className: string }) { return <div className={'min-h-1 flex-1 rounded-sm ' + className} style={{ height: Math.max(8, (value / max) * 100) + '%' }} title={String(value)} />; }
function MonitorPanel({ title, description, rows }: { title: string; description: string; rows: { label: string; total: number }[] }) { const max = Math.max(1, ...rows.map((row) => row.total)); return <Card className="gap-0 py-0"><CardHeader className="border-b px-4 py-4 sm:px-5"><CardTitle className="text-base">{title}</CardTitle><CardDescription className="mt-1">{description}</CardDescription></CardHeader><CardContent className="grid gap-4 p-4 sm:p-5">{rows.length ? rows.map((row) => <div key={row.label} className="grid grid-cols-[110px_1fr_32px] items-center gap-3 text-sm"><span className="truncate text-muted-foreground">{row.label}</span><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-foreground/70" style={{ width: (row.total / max) * 100 + '%' }} /></div><span className="text-right font-medium tabular-nums">{row.total}</span></div>) : <EmptyState title="Belum ada data" description="Data akan tampil setelah aktivitas tercatat." />}</CardContent></Card>; }
function EmptyState({ title, description }: { title: string; description: string }) { return <div className="flex min-h-28 flex-col items-center justify-center px-4 py-6 text-center"><Landmark className="mb-2 size-5 text-muted-foreground" /><div className="text-sm font-medium">{title}</div><div className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</div></div>; }
Dashboard.layout = { breadcrumbs: [{ title: 'Dashboard', href: dashboard() }] };
