import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    Building2,
    CalendarDays,
    Download,
    Printer,
    FileCheck2,
    FileText,
    Filter,
    RotateCcw,
    TimerReset,
    Users,
} from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SimPageHeader } from '@/components/sim-page-header';
import { SimKpiCard } from '@/components/sim-kpi-card';
import { SimSelect } from '@/components/sim-select';
import { SimStatusBadge, toneForStatus } from '@/components/sim-status-badge';
import { SimTable } from '@/components/sim-table';
import { SimPagination, type SimPaginationLink } from '@/components/sim-pagination';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Option = { id: number; code?: string; name: string };
type ReportTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
type PaginatedRows<T> = { data: T[]; links: SimPaginationLink[] };
type ExportType = 'overall' | 'branches' | 'notaries';

const reportTrendConfig = {
    incoming: { label: 'Masuk', color: 'var(--status-info)' },
    completed: { label: 'Selesai', color: 'var(--track-success)' },
} satisfies ChartConfig;

export default function ReportsIndex({
    filters,
    initialTab,
    branchLocked,
    branches,
    notaries,
    summary,
    reportKpis,
    byBranch,
    byNotary,
    covernoteReport,
    outstandingOrders,
    documentValidation,
    stageSummary,
    monthlyTrend,
    stalledOrders,
}: {
    initialTab: 'actions' | 'progress';
    branchLocked: boolean;
    filters: {
        branch_id: string;
        notary_id: string;
        date_from: string;
        date_to: string;
    };
    branches: Option[];
    notaries: Option[];
    summary: {
        total_orders: number;
        active_orders: number;
        completed_orders: number;
        risk_orders: number;
    };
    reportKpis: {
        completion_rate: number;
        validation_rate: number;
        covernote_attention: number;
        overdue_sla: number;
    };
    byBranch: PaginatedRows<{
        branch_id: number;
        code: string;
        name: string;
        total_orders: number;
        completed_orders: number;
        risk_orders: number;
    }>;
    byNotary: PaginatedRows<{
        notary_id: number;
        name: string;
        total_orders: number;
        completed_orders: number;
        risk_orders: number;
    }>;
    covernoteReport: { status: string; total: number }[];
    outstandingOrders: PaginatedRows<{
        id: number;
        order_no: string;
        customer_name: string;
        no_rekening: string;
        branch: string | null;
        notary: string | null;
        status: string;
        risk_flag: boolean;
        created_at: string;
    }>;
    documentValidation: { final_validated: number; final_uploaded: number };
    stageSummary: { key: string; label: string; total: number }[];
    monthlyTrend: { month: string; total_orders: number; completed_orders: number }[];
    stalledOrders: {
        id: number;
        order_no: string;
        customer_name: string;
        branch: string | null;
        notary: string | null;
        status: string;
        risk_flag: boolean;
        updated_at: string;
    }[];
}) {
    const { data, setData } = useForm(filters);
    const [activeTab, setActiveTab] = useState<'actions' | 'progress' | 'performance'>(initialTab);
    const [previewType, setPreviewType] = useState<ExportType | null>(null);
    const selectedBranch = branches.find((branch) => String(branch.id) === filters.branch_id);
    const scopeLabel = branchLocked
        ? `Cabang ${selectedBranch?.name ?? 'akun Anda'}`
        : filters.branch_id && selectedBranch
          ? `Cabang ${selectedBranch.name}`
          : 'Seluruh cabang';

    const submit = (event: FormEvent) => {
        event.preventDefault();
        router.get('/reports', data, { preserveState: true, replace: true });
    };
    const exportUrl = (type: ExportType) => {
        const params = new URLSearchParams({ type });
        if (data.branch_id) params.set('branch_id', data.branch_id);
        if (data.notary_id) params.set('notary_id', data.notary_id);
        if (data.date_from) params.set('date_from', data.date_from);
        if (data.date_to) params.set('date_to', data.date_to);
        return `/reports/export?${params.toString()}`;
    };

    return (
        <>
            <Head title="Laporan" />
            <div className="sim-workspace">
                <SimPageHeader
                    title="Laporan operasional"
                    description="Pantau pekerjaan yang perlu ditindaklanjuti, progres notaris, dan performa cabang."
                    actions={<div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={() => setPreviewType('overall')}><Download className="size-4" />Ringkasan keseluruhan</Button><Button type="button" variant="outline" size="sm" onClick={() => setPreviewType('branches')}><Download className="size-4" />Rekap cabang</Button><Button type="button" variant="outline" size="sm" onClick={() => setPreviewType('notaries')}><Download className="size-4" />Rekap notaris</Button></div>}
                />

                <Dialog open={previewType !== null} onOpenChange={(open) => !open && setPreviewType(null)}>
                    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-5xl">
                        <DialogHeader><DialogTitle>{previewType ? exportTitle(previewType) : 'Preview laporan'}</DialogTitle><DialogDescription>Periksa isi laporan sebelum dicetak atau diunduh.</DialogDescription></DialogHeader>
                        {previewType && <div id="report-export-preview" className="rounded-md border border-border bg-background p-4"><ExportPreview type={previewType} summary={summary} reportKpis={reportKpis} byBranch={byBranch.data} byNotary={byNotary.data} scopeLabel={scopeLabel} filters={filters} /></div>}
                        <DialogFooter><Button type="button" variant="outline" onClick={() => previewType && printReport(previewType)}><Printer className="size-4" />Cetak</Button>{previewType && <Button asChild><a href={exportUrl(previewType)}><Download className="size-4" />Unduh CSV untuk Excel</a></Button>}</DialogFooter>
                    </DialogContent>
                </Dialog>

                <div className="sim-panel mb-4 flex flex-col gap-1 px-4 py-3 md:px-5">
                    <div className="text-sm font-medium text-muted-foreground">Cakupan laporan</div>
                    <div className="text-lg font-semibold">{scopeLabel}</div>
                    <p className="text-sm text-muted-foreground">
                        {branchLocked ? 'Data mengikuti cabang yang terdaftar pada akun Anda.' : 'Data dapat mencakup satu cabang atau seluruh cabang.'}
                    </p>
                </div>

                <form onSubmit={submit} className="sim-panel mb-4 overflow-hidden">
                    <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-3 md:px-5">
                        <Filter className="size-4 text-muted-foreground" aria-hidden="true" />
                        <div>
                            <h2 className="text-base font-semibold">Atur laporan</h2>
                            <p className="mt-0.5 text-sm text-muted-foreground">Pilih periode, cabang, atau notaris yang ingin dilihat.</p>
                        </div>
                    </div>
                    <div className="grid gap-3 p-4 md:grid-cols-2 md:p-5 xl:grid-cols-[1.25fr_1.25fr_0.8fr_0.8fr_auto] xl:items-end">
                        <ReportField label="Cabang">
                            <SimSelect value={branchLocked ? filters.branch_id : data.branch_id} disabled={branchLocked} onChange={(value) => setData('branch_id', value)} options={branches.map((branch) => ({ value: String(branch.id), label: `${branch.code} - ${branch.name}` }))} placeholder={branchLocked ? 'Cabang akun' : 'Semua cabang'} />
                        </ReportField>
                        <ReportField label="Notaris">
                            <SimSelect value={data.notary_id} onChange={(value) => setData('notary_id', value)} options={notaries.map((notary) => ({ value: String(notary.id), label: notary.name }))} placeholder="Semua notaris" />
                        </ReportField>
                        <ReportField label="Mulai"><Input aria-label="Tanggal mulai" type="date" value={data.date_from} onChange={(event) => setData('date_from', event.target.value)} /></ReportField>
                        <ReportField label="Sampai"><Input aria-label="Tanggal akhir" type="date" value={data.date_to} onChange={(event) => setData('date_to', event.target.value)} /></ReportField>
                        <div className="flex gap-2 md:col-span-2 xl:col-span-1">
                            <Button type="submit"><Filter className="size-4" />Terapkan</Button>
                            <Button type="button" variant="outline" onClick={() => router.get('/reports')}><RotateCcw className="size-4" />Reset</Button>
                        </div>
                    </div>
                </form>

                <nav aria-label="Bagian laporan" className="mb-5 grid grid-cols-3 border-b border-border">
                    <ReportTab active={activeTab === 'actions'} onClick={() => setActiveTab('actions')}>Perlu tindakan</ReportTab>
                    <ReportTab active={activeTab === 'progress'} onClick={() => setActiveTab('progress')}>Progres pekerjaan</ReportTab>
                    <ReportTab active={activeTab === 'performance'} onClick={() => setActiveTab('performance')}>Performa</ReportTab>
                </nav>

                {activeTab === 'actions' && <>
                <section className="mb-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
                    <SimKpiCard label="Total order" value={summary.total_orders} note="Seluruh order pada cakupan laporan" icon={FileText} tone="info" />
                    <SimKpiCard label="Sedang diproses" value={summary.active_orders} note="Order yang belum selesai" icon={TimerReset} tone="info" />
                    <SimKpiCard label="Order selesai" value={summary.completed_orders} note="Order yang sudah ditutup" icon={FileCheck2} tone="success" />
                    <SimKpiCard label="Order berisiko" value={summary.risk_orders} note="Perlu perhatian operasional" icon={AlertTriangle} tone="danger" />
                </section>

                <section className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                    <SimKpiCard
                        label="Penyelesaian"
                        value={`${reportKpis.completion_rate}%`}
                        note="Order selesai dari total periode terpilih"
                        icon={FileText}
                        tone="success"
                        href="/orders?status=selesai"
                        linkLabel="Buka order selesai"
                    />
                    <SimKpiCard
                        label="Validasi final"
                        value={`${reportKpis.validation_rate}%`}
                        note="Dokumen final yang sudah tervalidasi"
                        icon={FileCheck2}
                        tone="success"
                        href="/orders?doc=final_divalidasi"
                        linkLabel="Buka dokumen final tervalidasi"
                    />
                    <SimKpiCard
                        label="Covernote perhatian"
                        value={reportKpis.covernote_attention}
                        note="Jumlah agunan kedaluwarsa atau mendekati jatuh tempo"
                        icon={CalendarDays}
                        tone="warning"
                        href="/orders?covernote=expired"
                        linkLabel="Buka covernote perlu perhatian"
                    />
                    <SimKpiCard
                        label="SLA terlambat"
                        value={reportKpis.overdue_sla}
                        note="Jumlah agunan melewati batas SLA"
                        icon={AlertTriangle}
                        tone="danger"
                        href="/orders?sla=overdue"
                        linkLabel="Buka SLA terlambat"
                    />
                </section>

                </>}

                {activeTab === 'progress' && <div className="grid items-start gap-4 xl:grid-cols-12">
                    <ReportPanel
                        className="xl:col-span-7 xl:h-full"
                        title="Covernote"
                        subtitle="Posisi covernote pada agunan yang masuk dalam laporan."
                        icon={FileCheck2}
                    >
                        {covernoteReport.length === 0 ? (
                            <EmptyReport message="Belum ada data covernote pada cakupan ini." />
                        ) : (
                            <div className="flex flex-1 flex-col divide-y divide-border">
                                {covernoteReport.map((item) => (
                                    <div
                                        key={item.status}
                                        className="flex flex-1 items-center justify-between gap-3 px-4 py-3"
                                    >
                                        <SimStatusBadge
                                            label={covernoteStatusLabel(
                                                item.status,
                                            )}
                                            tone={toneForStatus(
                                                covernoteStatusLabel(
                                                    item.status,
                                                ),
                                            )}
                                        />

                                        <span className="text-lg font-semibold tabular-nums">
                                            {item.total}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ReportPanel>

                    <ReportPanel
                        className="xl:col-span-5 xl:h-full"
                        title="Dokumen final"
                        subtitle="Perbandingan dokumen yang diunggah dan divalidasi."
                        icon={FileCheck2}
                    >
                        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] divide-y divide-border">
                            <div className="flex min-h-0 items-center justify-between gap-4 px-4 py-3">
                                <div>
                                    <div className="text-sm text-muted-foreground">Diunggah</div>
                                    <div className="mt-1 text-xs text-muted-foreground">Dokumen final yang masuk</div>
                                </div>
                                <div className="text-2xl font-semibold tabular-nums text-[var(--status-info)]">{documentValidation.final_uploaded}</div>
                            </div>
                            <div className="flex min-h-0 items-center justify-between gap-4 px-4 py-3">
                                <div>
                                    <div className="text-sm text-muted-foreground">Divalidasi</div>
                                    <div className="mt-1 text-xs text-muted-foreground">Dokumen final yang lolos pemeriksaan</div>
                                </div>
                                <div className="text-2xl font-semibold tabular-nums text-[var(--track-success)]">{documentValidation.final_validated}</div>
                            </div>
                        </div>
                    </ReportPanel>

                    <ReportPanel
                        className="xl:col-span-5 xl:h-[26rem]"
                        title="Tahap pekerjaan aktif"
                        subtitle="Distribusi order yang masih berjalan di pipeline."
                        icon={TimerReset}
                    >
                        <div className="divide-y divide-border overflow-y-auto">
                            {stageSummary.map((stage) => (
                                <div key={stage.key} className="flex items-center justify-between gap-4 px-4 py-3">
                                    <span className="text-sm">{stage.label}</span>
                                    <span className="text-lg font-semibold tabular-nums">{stage.total}</span>
                                </div>
                            ))}
                        </div>
                    </ReportPanel>

                    <ReportPanel
                        className="xl:col-span-7 xl:h-[26rem]"
                        title="Tren order"
                        subtitle="Perbandingan order masuk dan selesai per bulan."
                        icon={CalendarDays}
                    >
                        {monthlyTrend.length === 0 ? <EmptyReport message="Belum ada tren pada cakupan ini." /> : (
                            <div className="p-4">
                                <ChartContainer config={reportTrendConfig} className="h-64 w-full">
                                    <LineChart data={monthlyTrend.map((month) => ({
                                        label: formatMonth(month.month),
                                        incoming: month.total_orders,
                                        completed: month.completed_orders,
                                    }))} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                                        <CartesianGrid vertical={false} stroke="var(--border)" />
                                        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 12 }} />
                                        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={32} allowDecimals={false} />
                                        <ChartTooltip content={<ChartTooltipContent />} />
                                        <Line dataKey="incoming" stroke="var(--color-incoming)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
                                        <Line dataKey="completed" stroke="var(--color-completed)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
                                        <ChartLegend content={<ChartLegendContent />} />
                                    </LineChart>
                                </ChartContainer>
                            </div>
                        )}
                    </ReportPanel>

                    <ReportPanel
                        className="xl:col-span-12"
                        title={filters.notary_id ? `Debitur yang ditangani ${notaries.find((notary) => String(notary.id) === filters.notary_id)?.name ?? 'notaris'}` : filters.branch_id ? `Debitur pada ${selectedBranch?.name ?? 'cabang ini'}` : 'Debitur dan order yang sedang berjalan'}
                        subtitle={filters.notary_id || filters.branch_id ? 'Daftar ini mengikuti cakupan dan periode yang dipilih.' : 'Pilih Lihat debitur pada tab Performa untuk melihat pekerjaan satu cabang atau notaris.'}
                        icon={Users}
                    >
                        {filters.notary_id || filters.branch_id ? (
                            <div className="overflow-x-auto">
                                <table className="sim-table min-w-[720px]">
                                    <thead className="bg-muted/20 text-left text-xs text-muted-foreground">
                                        <tr><th>Debitur</th><th>Order</th><th>Status</th><th>Terakhir diperbarui</th><th className="text-right">Aksi</th></tr>
                                    </thead>
                                    <tbody>
                                        {outstandingOrders.data.length === 0 ? (
                                            <tr><td colSpan={5}><EmptyReport message="Tidak ada order aktif pada cakupan yang dipilih." /></td></tr>
                                        ) : outstandingOrders.data.map((order) => (
                                            <tr key={order.id} className="border-t">
                                                <td><div className="font-medium">{order.customer_name}</div><div className="text-sm text-muted-foreground">{order.no_rekening}</div></td>
                                                <td>{order.order_no}</td>
                                                <td><SimStatusBadge label={order.status} tone={order.risk_flag ? 'danger' : toneForStatus(order.status)} /></td>
                                                <td>{order.created_at}</td>
                                                <td className="text-right"><Button variant="outline" size="sm" asChild><Link href={`/orders/${order.id}`}>Buka order</Link></Button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : <EmptyReport message="Pilih cabang atau notaris dari tab Performa untuk melihat debiturnya." />}
                        {(filters.notary_id || filters.branch_id) && <SimPagination links={outstandingOrders.links} />}
                    </ReportPanel>

                </div>}

                {activeTab === 'performance' && <div className="grid items-start gap-4 xl:grid-cols-12">
                    <ReportPanel
                        className="xl:col-span-6"
                        title="Performa cabang"
                        subtitle="Bandingkan beban kerja, penyelesaian, dan risiko per cabang."
                        icon={Building2}
                    >
                        <DistributionTable
                            rows={byBranch}
                            firstLabel="Cabang"
                            firstValue={(row) => `${row.code} - ${row.name}`}
                            action={(row) => <Button variant="outline" size="sm" asChild><Link href={`/reports?branch_id=${row.branch_id}&view=progress`}>Lihat debitur</Link></Button>}
                        />
                    </ReportPanel>

                    <ReportPanel
                        className="xl:col-span-6"
                        title="Performa notaris"
                        subtitle="Lihat beban kerja, penyelesaian, dan risiko setiap notaris."
                        icon={Users}
                    >
                        <DistributionTable
                            rows={byNotary}
                            firstLabel="Notaris"
                            firstValue={(row) => row.name}
                            action={(row) => <Button variant="outline" size="sm" asChild><Link href={`/reports?notary_id=${row.notary_id}&view=progress`}>Lihat debitur</Link></Button>}
                        />
                    </ReportPanel>

                </div>}

                {activeTab === 'actions' && <div className="grid items-start gap-4 xl:grid-cols-12">
                    <ReportPanel
                        className="xl:col-span-12"
                        title="Pekerjaan yang masih berjalan"
                        subtitle="Order aktif yang perlu dipantau atau ditindaklanjuti."
                        icon={AlertTriangle}
                    >
                        <SimTable
                            raw
                            className="!rounded-none !border-0 !bg-transparent !shadow-none"
                        >
                            <table className="sim-table min-w-[840px]">
                                <thead className="bg-muted/30 text-left text-xs text-muted-foreground">
                                    <tr>
                                        <th>Order</th>
                                        <th>Nasabah</th>
                                        <th>Cabang / Notaris</th>
                                        <th>Status</th>
                                        <th>Tanggal</th>
                                        <th className="text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {outstandingOrders.data.length === 0 ? (
                                        <tr>
                                            <td colSpan={6}>
                                                <EmptyReport message="Tidak ada pekerjaan yang masih berjalan." />
                                            </td>
                                        </tr>
                                    ) : (
                                        outstandingOrders.data.map((order) => (
                                            <tr
                                                key={order.id}
                                                className={`border-t align-top ${order.risk_flag ? 'border-l-2 border-l-[var(--status-danger)]' : ''}`}
                                            >
                                                <td>
                                                    <Link
                                                        className="font-medium underline-offset-4 hover:underline"
                                                        href={`/orders/${order.id}`}
                                                    >
                                                        {order.order_no}
                                                    </Link>
                                                    {order.risk_flag && (
                                                        <div className="mt-2">
                                                            <SimStatusBadge
                                                                label="Risiko"
                                                                tone="danger"
                                                            />
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <div className="font-medium">
                                                        {order.customer_name}
                                                    </div>
                                                    <div className="text-muted-foreground">
                                                        {order.no_rekening}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div>
                                                        {order.branch ?? '-'}
                                                    </div>
                                                    <div className="text-muted-foreground">
                                                        {order.notary ?? '-'}
                                                    </div>
                                                </td>
                                                <td>
                                                    <SimStatusBadge
                                                        label={order.status}
                                                        tone={
                                                            order.risk_flag
                                                                ? 'danger'
                                                                : toneForStatus(
                                                                      order.status,
                                                                  )
                                                        }
                                                    />
                                                </td>
                                                <td>{order.created_at}</td>
                                                <td className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        asChild
                                                    >
                                                        <Link
                                                            href={`/orders/${order.id}`}
                                                        >
                                                            Buka
                                                        </Link>
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </SimTable>
                        <div className="space-y-3 p-3 md:hidden">
                            {outstandingOrders.data.length === 0 ? (
                                <EmptyReport message="Tidak ada pekerjaan yang masih berjalan." />
                            ) : (
                                outstandingOrders.data.map((order) => (
                                    <article
                                        key={order.id}
                                        className={`space-y-4 border border-border bg-card p-4 ${order.risk_flag ? 'border-l-2 border-l-[var(--status-danger)]' : ''}`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <Link
                                                    className="font-medium underline-offset-4 hover:underline"
                                                    href={`/orders/${order.id}`}
                                                >
                                                    {order.order_no}
                                                </Link>
                                                <div className="mt-1 truncate text-sm text-muted-foreground">
                                                    {order.customer_name}
                                                </div>
                                            </div>
                                            <SimStatusBadge
                                                label={order.status}
                                                tone={
                                                    order.risk_flag
                                                        ? 'danger'
                                                        : toneForStatus(
                                                              order.status,
                                                          )
                                                }
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <ReportValue
                                                label="Cabang"
                                                value={order.branch ?? '-'}
                                            />
                                            <ReportValue
                                                label="Notaris"
                                                value={order.notary ?? '-'}
                                            />
                                            <ReportValue
                                                label="Tanggal"
                                                value={order.created_at}
                                            />
                                        </div>
                                        <Button
                                            variant="outline"
                                            className="w-full"
                                            asChild
                                        >
                                            <Link href={`/orders/${order.id}`}>
                                                Buka detail
                                            </Link>
                                        </Button>
                                    </article>
                                ))
                            )}
                        </div>
                        <SimPagination links={outstandingOrders.links} />
                    </ReportPanel>

                    <ReportPanel
                        className="xl:col-span-12"
                        title="Order tidak bergerak lebih dari 7 hari"
                        subtitle="Order aktif yang tidak mengalami pembaruan terbaru."
                        icon={TimerReset}
                    >
                        {stalledOrders.length === 0 ? <EmptyReport message="Tidak ada order yang terindikasi macet." /> : (
                            <div className="divide-y divide-border">
                                {stalledOrders.map((order) => (
                                    <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                                        <div className="min-w-0">
                                            <Link href={`/orders/${order.id}`} className="font-medium underline-offset-4 hover:underline">{order.order_no}</Link>
                                            <div className="mt-1 text-sm text-muted-foreground">{order.customer_name} · {order.branch ?? '-'} · {order.notary ?? '-'}</div>
                                        </div>
                                        <div className="flex items-center gap-3 text-right">
                                            <div><SimStatusBadge label={order.status} tone={order.risk_flag ? 'danger' : toneForStatus(order.status)} /><div className="mt-1 text-xs text-muted-foreground">Update {order.updated_at}</div></div>
                                            <Button variant="outline" size="sm" asChild><Link href={`/orders/${order.id}`}>Buka</Link></Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ReportPanel>
                </div>}
            </div>
        </>
    );
}

function ReportPanel({
    title,
    subtitle,
    icon: Icon,
    className = '',
    children,
}: {
    title: string;
    subtitle: string;
    icon: LucideIcon;
    className?: string;
    children: ReactNode;
}) {
    return (
        <section className={`sim-panel flex min-h-0 min-w-0 flex-col overflow-hidden ${className}`}>
            <div className="flex items-start gap-3 border-b bg-muted/30 px-4 py-3 md:px-5">
                <Icon
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                />
                <div>
                    <h2 className="text-base leading-6 font-semibold">
                        {title}
                    </h2>
                    <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                        {subtitle}
                    </p>
                </div>
            </div>
            {children}
        </section>
    );
}

function ReportTab({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`min-h-11 border-b-2 px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'}`}
        >
            {children}
        </button>
    );
}

function DistributionTable({
    rows,
    firstLabel,
    firstValue,
    action,
}: {
    rows: PaginatedRows<any>;
    firstLabel: string;
    firstValue: (row: any) => string;
    action?: (row: any) => ReactNode;
}) {
    if (rows.data.length === 0)
        return <EmptyReport message="Belum ada data pada cakupan ini." />;
    return (
        <>
            <div className="hidden max-h-[26rem] overflow-auto md:block">
                <table className="sim-table min-w-[520px]">
                    <thead className="bg-muted/20 text-left text-xs text-muted-foreground">
                        <tr>
                            <th>{firstLabel}</th>
                            <th className="text-right">Total</th>
                            <th className="text-right">Aktif</th>
                            <th className="text-right">Selesai</th>
                            <th className="text-right">Rasio</th>
                            <th className="text-right">Risiko</th>
                            {action && <th className="text-right">Aksi</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.data.map((row) => (
                            <tr key={firstValue(row)} className="border-t">
                                <td className="font-medium">
                                    {firstValue(row)}
                                </td>
                                <td className="text-right tabular-nums">
                                    {row.total_orders}
                                </td>
                                <td className="text-right tabular-nums">
                                    {row.active_orders ?? '-'}
                                </td>
                                <td className="text-right tabular-nums">
                                    {row.completed_orders}
                                </td>
                                <td className="text-right tabular-nums">
                                    {row.completion_rate ?? 0}%
                                </td>
                                <td
                                    className={`text-right tabular-nums ${row.risk_orders > 0 ? 'font-semibold text-[var(--status-danger)]' : 'text-muted-foreground'}`}
                                >
                                    {row.risk_orders}
                                </td>
                                {action && <td className="text-right">{action(row)}</td>}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="max-h-[26rem] space-y-3 overflow-y-auto p-3 md:hidden">
                {rows.data.map((row) => (
                    <article
                        key={firstValue(row)}
                        className="border border-border bg-card p-3.5"
                    >
                        <div className="font-medium">{firstValue(row)}</div>
                        <div className="mt-3 grid grid-cols-4 gap-2 text-sm">
                            <ReportMetric
                                label="Total"
                                value={row.total_orders}
                            />
                            <ReportMetric
                                label="Selesai"
                                value={row.completed_orders}
                                tone="success"
                            />
                            <ReportMetric
                                label="Rasio"
                                value={`${row.completion_rate ?? 0}%`}
                                tone="info"
                            />
                            <ReportMetric
                                label="Risiko"
                                value={row.risk_orders}
                                tone={
                                    row.risk_orders > 0 ? 'danger' : 'neutral'
                                }
                            />
                            {action && <div className="col-span-4">{action(row)}</div>}
                        </div>
                    </article>
                ))}
            </div>
            <SimPagination links={rows.links} />
        </>
    );
}

function ReportMetric({
    label,
    value,
    tone = 'neutral',
}: {
    label: string;
    value: number | string;
    tone?: ReportTone;
}) {
    return (
        <div className="sim-metric min-w-0 p-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div
                className={`mt-1 text-xl font-semibold tabular-nums ${toneText(tone)}`}
            >
                {value}
            </div>
        </div>
    );
}

function ReportField({
    label,
    children,
}: {
    label: string;
    children: ReactNode;
}) {
    return (
        <div className="grid gap-2 text-sm font-medium">
            <span>{label}</span>
            {children}
        </div>
    );
}

function ReportValue({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 truncate">{value}</div>
        </div>
    );
}

function EmptyReport({ message }: { message: string }) {
    return (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {message}
        </div>
    );
}

function toneText(tone: ReportTone) {
    return {
        neutral: 'text-foreground',
        info: 'text-[var(--status-info)]',
        success: 'text-[var(--track-success)]',
        warning: 'text-[var(--status-warning)]',
        danger: 'text-[var(--status-danger)]',
    }[tone];
}

function formatMonth(value: string) {
    const [year, month] = value.split('-');
    if (!year || !month) return value;

    return new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(new Date(Number(year), Number(month) - 1, 1));
}

function covernoteStatusLabel(status: string) {
    return (
        {
            aktif: 'Aktif',
            mendekati_jatuh_tempo: 'Mendekati jatuh tempo',
            diperpanjang: 'Diperpanjang',
            diganti_sertifikat: 'Diganti sertifikat',
            kedaluwarsa: 'Kedaluwarsa',
            belum_ada: 'Belum ada covernote',
        }[status] ?? 'Status tidak diketahui'
    );
}

function exportTitle(type: ExportType) {
    return ({ overall: 'Preview ringkasan keseluruhan', branches: 'Preview rekap cabang', notaries: 'Preview rekap notaris' })[type];
}

function ExportPreview({ type, summary, reportKpis, byBranch, byNotary, scopeLabel, filters }: { type: ExportType; summary: { total_orders: number; active_orders: number; completed_orders: number; risk_orders: number }; reportKpis: { completion_rate: number; validation_rate: number; covernote_attention: number; overdue_sla: number }; byBranch: { code: string; name: string; total_orders: number; completed_orders: number; active_orders?: number; risk_orders: number }[]; byNotary: { name: string; notary_id: number; total_orders: number; completed_orders: number; active_orders?: number; risk_orders: number }[]; scopeLabel: string; filters: { date_from: string; date_to: string } }) {
    const period = filters.date_from || filters.date_to ? `${filters.date_from || 'awal'} s.d. ${filters.date_to || 'sekarang'}` : 'Semua periode';
    if (type === 'overall') return <div className="space-y-4"><div><div className="text-lg font-semibold">Ringkasan keseluruhan</div><div className="text-sm text-muted-foreground">{scopeLabel} · {period}</div></div><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[['Total order', summary.total_orders], ['Order aktif', summary.active_orders], ['Order selesai', summary.completed_orders], ['Order berisiko', summary.risk_orders], ['Penyelesaian', `${reportKpis.completion_rate}%`], ['Validasi final', `${reportKpis.validation_rate}%`], ['Covernote perhatian', reportKpis.covernote_attention], ['SLA terlambat', reportKpis.overdue_sla]].map(([label, value]) => <div key={String(label)} className="rounded-md border border-border p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-xl font-semibold">{value}</div></div>)}</div></div>;
    const rows = type === 'branches' ? byBranch.map((row) => [row.code, row.name, row.total_orders, row.completed_orders, row.active_orders ?? row.total_orders - row.completed_orders, row.risk_orders, `${row.total_orders ? Math.round((row.completed_orders / row.total_orders) * 100) : 0}%`]) : byNotary.map((row) => [row.notary_id, row.name, '—', row.total_orders, row.completed_orders, row.active_orders ?? row.total_orders - row.completed_orders, row.risk_orders, `${row.total_orders ? Math.round((row.completed_orders / row.total_orders) * 100) : 0}%`]);
    const headers = type === 'branches' ? ['Kode', 'Cabang', 'Total', 'Selesai', 'Aktif', 'Risiko', 'Rasio'] : ['ID', 'Notaris', 'Cabang rekanan', 'Total', 'Selesai', 'Aktif', 'Risiko', 'Rasio'];
    return <div><div className="mb-3"><div className="text-lg font-semibold">{type === 'branches' ? 'Rekap cabang' : 'Rekap notaris'}</div><div className="text-sm text-muted-foreground">{scopeLabel} · {period}</div></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b text-xs text-muted-foreground">{headers.map((header) => <th key={header} className="px-3 py-2 font-medium">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-b last:border-0">{row.map((value, cellIndex) => <td key={cellIndex} className="px-3 py-2">{value}</td>)}</tr>)}</tbody></table>{rows.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">Belum ada data pada filter ini.</div>}</div></div>;
}

function printReport(title: string) {
    const content = document.getElementById('report-export-preview')?.innerHTML;
    if (!content) return;
    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) return;
    printWindow.document.write(`<html><head><title>${title}</title><style>body{font-family:Arial,sans-serif;color:#111;padding:32px}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left;font-size:12px}.text-muted-foreground{color:#666}.text-xl{font-size:20px}.text-lg{font-size:18px}.font-semibold{font-weight:600}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.rounded-md{border:1px solid #ddd;border-radius:6px;padding:12px}.mt-1{margin-top:4px}.mb-3{margin-bottom:12px}.space-y-4>*+*{margin-top:16px}</style></head><body>${content}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 250);
}

ReportsIndex.layout = {
    breadcrumbs: [{ title: 'Laporan', href: '/reports' }],
};
