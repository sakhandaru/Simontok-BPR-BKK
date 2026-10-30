import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    Building2,
    CalendarDays,
    FileCheck2,
    FileText,
    Filter,
    RotateCcw,
    Users,
} from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SimPageHeader } from '@/components/sim-page-header';
import { SimKpiCard } from '@/components/sim-kpi-card';
import { SimSelect } from '@/components/sim-select';
import { SimStatusBadge, toneForStatus } from '@/components/sim-status-badge';
import { SimTable } from '@/components/sim-table';
import { SimPagination, type SimPaginationLink } from '@/components/sim-pagination';

type Option = { id: number; code?: string; name: string };
type ReportTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
type PaginatedRows<T> = { data: T[]; links: SimPaginationLink[] };

export default function ReportsIndex({
    filters,
    branches,
    notaries,
    reportKpis,
    byBranch,
    byNotary,
    covernoteReport,
    outstandingOrders,
    documentValidation,
}: {
    filters: {
        branch_id: string;
        notary_id: string;
        date_from: string;
        date_to: string;
    };
    branches: Option[];
    notaries: Option[];
    reportKpis: {
        completion_rate: number;
        validation_rate: number;
        covernote_attention: number;
        overdue_sla: number;
    };
    byBranch: PaginatedRows<{
        code: string;
        name: string;
        total_orders: number;
        completed_orders: number;
        risk_orders: number;
    }>;
    byNotary: PaginatedRows<{
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
}) {
    const { data, setData } = useForm(filters);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        router.get('/reports', data, { preserveState: true, replace: true });
    };

    return (
        <>
            <Head title="Laporan" />
            <div className="sim-workspace">
                <SimPageHeader
                    title="Laporan"
                    description="Ringkasan pekerjaan notaris berdasarkan posisi, risiko, covernote, dan dokumen."
                />

                <section className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
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
                        note="Kedaluwarsa atau mendekati jatuh tempo"
                        icon={CalendarDays}
                        tone="warning"
                        href="/orders?covernote=expired"
                        linkLabel="Buka covernote perlu perhatian"
                    />
                    <SimKpiCard
                        label="SLA terlambat"
                        value={reportKpis.overdue_sla}
                        note="Order melewati batas SLA"
                        icon={AlertTriangle}
                        tone="danger"
                        href="/orders?sla=overdue"
                        linkLabel="Buka SLA terlambat"
                    />
                </section>

                <form onSubmit={submit} className="sim-panel overflow-hidden">
                    <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-3 md:px-5">
                        <Filter
                            className="size-4 text-muted-foreground"
                            aria-hidden="true"
                        />
                        <div>
                            <h2 className="text-sm font-semibold">
                                Periode dan cakupan laporan
                            </h2>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                Gunakan filter untuk memeriksa beban kerja
                                tertentu.
                            </p>
                        </div>
                    </div>
                    <div className="grid gap-3 p-4 md:grid-cols-2 md:p-5 xl:grid-cols-[1.25fr_1.25fr_0.8fr_0.8fr_auto] xl:items-end">
                        <ReportField label="Cabang">
                            <SimSelect
                                value={data.branch_id}
                                onChange={(value) =>
                                    setData('branch_id', value)
                                }
                                options={branches.map((branch) => ({
                                    value: String(branch.id),
                                    label: `${branch.code} - ${branch.name}`,
                                }))}
                                placeholder="Semua cabang"
                            />
                        </ReportField>
                        <ReportField label="Notaris">
                            <SimSelect
                                value={data.notary_id}
                                onChange={(value) =>
                                    setData('notary_id', value)
                                }
                                options={notaries.map((notary) => ({
                                    value: String(notary.id),
                                    label: notary.name,
                                }))}
                                placeholder="Semua notaris"
                            />
                        </ReportField>
                        <ReportField label="Mulai">
                            <Input
                                aria-label="Tanggal mulai"
                                type="date"
                                value={data.date_from}
                                onChange={(event) =>
                                    setData('date_from', event.target.value)
                                }
                            />
                        </ReportField>
                        <ReportField label="Sampai">
                            <Input
                                aria-label="Tanggal akhir"
                                type="date"
                                value={data.date_to}
                                onChange={(event) =>
                                    setData('date_to', event.target.value)
                                }
                            />
                        </ReportField>
                        <div className="flex gap-2 md:col-span-2 xl:col-span-1">
                            <Button type="submit">
                                <Filter className="size-4" />
                                Terapkan
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => router.get('/reports')}
                            >
                                <RotateCcw className="size-4" />
                                Reset
                            </Button>
                        </div>
                    </div>
                </form>

                <div className="grid items-start gap-4 xl:grid-cols-12">
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
                        className="xl:col-span-6 xl:h-[32rem]"
                        title="Per cabang"
                        subtitle="Beban, penyelesaian, dan risiko per cabang."
                        icon={Building2}
                    >
                        <DistributionTable
                            rows={byBranch}
                            firstLabel="Cabang"
                            firstValue={(row) => `${row.code} - ${row.name}`}
                        />
                    </ReportPanel>

                    <ReportPanel
                        className="xl:col-span-6 xl:h-[32rem]"
                        title="Per notaris"
                        subtitle="Beban, penyelesaian, dan risiko per notaris."
                        icon={Users}
                    >
                        <DistributionTable
                            rows={byNotary}
                            firstLabel="Notaris"
                            firstValue={(row) => row.name}
                        />
                    </ReportPanel>

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
                </div>
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

function DistributionTable({
    rows,
    firstLabel,
    firstValue,
}: {
    rows: PaginatedRows<any>;
    firstLabel: string;
    firstValue: (row: any) => string;
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
                            <th className="text-right">Selesai</th>
                            <th className="text-right">Risiko</th>
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
                                    {row.completed_orders}
                                </td>
                                <td
                                    className={`text-right tabular-nums ${row.risk_orders > 0 ? 'font-semibold text-[var(--status-danger)]' : 'text-muted-foreground'}`}
                                >
                                    {row.risk_orders}
                                </td>
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
                        <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
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
                                label="Risiko"
                                value={row.risk_orders}
                                tone={
                                    row.risk_orders > 0 ? 'danger' : 'neutral'
                                }
                            />
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
    value: number;
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

ReportsIndex.layout = {
    breadcrumbs: [{ title: 'Laporan', href: '/reports' }],
};
