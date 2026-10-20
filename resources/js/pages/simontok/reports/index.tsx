import { Head, Link, router, useForm } from '@inertiajs/react';
import { Filter, RotateCcw } from 'lucide-react';
import { FormEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SimPageHeader } from '@/components/sim-page-header';
import { SimTable } from '@/components/sim-table';
import { SimSelect } from '@/components/sim-select';
import { SimStatusBadge, toneForStatus } from '@/components/sim-status-badge';

type Option = { id: number; code?: string; name: string };

export default function ReportsIndex({
    filters,
    branches,
    notaries,
    summary,
    byBranch,
    byNotary,
    covernoteReport,
    outstandingOrders,
    documentValidation,
}: {
    filters: { branch_id: string; notary_id: string; date_from: string; date_to: string };
    branches: Option[];
    notaries: Option[];
    summary: { total_orders: number; active_orders: number; completed_orders: number; risk_orders: number };
    byBranch: { code: string; name: string; total_orders: number; completed_orders: number; risk_orders: number }[];
    byNotary: { name: string; total_orders: number; completed_orders: number; risk_orders: number }[];
    covernoteReport: { status: string; total: number }[];
    outstandingOrders: any[];
    documentValidation: { final_validated: number; final_uploaded: number };
}) {
    const { data, setData } = useForm(filters);
    const submit = (event: FormEvent) => {
        event.preventDefault();
        router.get('/reports', data, { preserveState: true, replace: true });
    };

    return (
        <>
            <Head title="Laporan SIMONTOK" />
            <div className="flex h-full flex-1 flex-col gap-5 p-4 md:p-6">
                <SimPageHeader title="Laporan pekerjaan" description="Pantau pekerjaan, dokumen, covernote, dan pembayaran berdasarkan periode yang dipilih." />

                <form onSubmit={submit} className="sim-panel grid gap-3 p-3 lg:grid-cols-[1fr_1fr_160px_160px_auto]">
                    <SimSelect value={data.branch_id} onChange={(value) => setData('branch_id', value)} options={branches.map((branch) => ({ value: String(branch.id), label: `${branch.code} - ${branch.name}` }))} placeholder="Semua cabang" />
                    <SimSelect value={data.notary_id} onChange={(value) => setData('notary_id', value)} options={notaries.map((notary) => ({ value: String(notary.id), label: notary.name }))} placeholder="Semua notaris" />
                    <Input aria-label="Tanggal mulai" type="date" value={data.date_from} onChange={(event) => setData('date_from', event.target.value)} />
                    <Input aria-label="Tanggal akhir" type="date" value={data.date_to} onChange={(event) => setData('date_to', event.target.value)} />
                    <div className="flex flex-wrap gap-2">
                        <Button type="submit"><Filter className="size-4" />Filter</Button>
                        <Button type="button" variant="outline" onClick={() => router.get('/reports')}><RotateCcw className="size-4" />Reset</Button>
                    </div>
                </form>

                <section className="sim-panel overflow-hidden">
                    <div className="border-b px-4 py-3">
                        <h2 className="font-medium">Ringkasan pekerjaan</h2>
                        <p className="mt-1 text-sm text-muted-foreground">Jumlah pekerjaan dalam rentang dan filter yang dipilih.</p>
                    </div>
                    <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 xl:divide-x">
                        <Summary label="Total pekerjaan" value={summary.total_orders} />
                        <Summary label="Masih berjalan" value={summary.active_orders} />
                        <Summary label="Sudah selesai" value={summary.completed_orders} />
                        <Summary label="Perlu perhatian" value={summary.risk_orders} />
                    </div>
                </section>

                <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                    <section className="sim-panel">
                        <div className="border-b px-4 py-3">
                            <h2 className="font-medium">Covernote</h2>
                            <p className="mt-1 text-sm text-muted-foreground">Kondisi covernote pada pekerjaan yang dipilih.</p>
                        </div>
                        <div className="divide-y">
                            {covernoteReport.length === 0 ? (
                                <div className="px-4 py-6 text-sm text-muted-foreground">Belum ada data covernote.</div>
                            ) : (
                                covernoteReport.map((item) => (
                                    <div key={item.status} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                                        <span>{item.status}</span>
                                        <span className="font-medium tabular-nums">{item.total}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                    <section className="sim-panel">
                        <div className="border-b px-4 py-3">
                            <h2 className="font-medium">Dokumen final</h2>
                            <p className="mt-1 text-sm text-muted-foreground">Perbandingan dokumen final yang sudah dikirim dan diperiksa.</p>
                        </div>
                        <div className="grid gap-3 p-4 sm:grid-cols-2">
                            <Summary label="Sudah diunggah" value={documentValidation.final_uploaded} />
                            <Summary label="Sudah divalidasi" value={documentValidation.final_validated} />
                        </div>
                    </section>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                    <ReportTable title="Per cabang" rows={byBranch} firstHeader="Cabang" firstValue={(row) => `${row.code} - ${row.name}`} />
                    <ReportTable title="Per notaris" rows={byNotary} firstHeader="Notaris" firstValue={(row) => row.name} />
                </div>

                <section className="sim-panel">
                    <div className="border-b px-4 py-3">
                        <h2 className="font-medium">Pekerjaan yang masih berjalan</h2>
                        <p className="mt-1 text-sm text-muted-foreground">Daftar pekerjaan yang belum selesai dan mungkin membutuhkan tindak lanjut.</p>
                    </div>
                    <SimTable raw className="hidden md:block">
                        <table className="sim-table w-full min-w-[840px] text-sm">
                            <thead className="bg-muted/50 text-left text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 font-medium">No order</th>
                                    <th className="px-4 py-3 font-medium">Nasabah</th>
                                    <th className="px-4 py-3 font-medium">Cabang</th>
                                    <th className="px-4 py-3 font-medium">Notaris</th>
                                    <th className="px-4 py-3 font-medium">Status</th>
                                    <th className="px-4 py-3 font-medium">Tanggal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {outstandingOrders.length === 0 ? (
                                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Tidak ada outstanding order.</td></tr>
                                ) : outstandingOrders.map((order) => (
                                    <tr key={order.id} className="border-t">
                                        <td className="px-4 py-3"><Link className="font-medium underline-offset-4 hover:underline" href={`/orders/${order.id}`}>{order.order_no}</Link></td>
                                        <td className="px-4 py-3"><div className="font-medium">{order.customer_name}</div><div className="text-muted-foreground">{order.no_rekening}</div></td>
                                        <td className="px-4 py-3">{order.branch}</td>
                                        <td className="px-4 py-3">{order.notary}</td>
                                        <td className="px-4 py-3"><SimStatusBadge label={order.status} tone={order.risk_flag ? 'danger' : toneForStatus(order.status)} /></td>
                                        <td className="px-4 py-3">{order.created_at}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </SimTable>
                    <div className="divide-y md:hidden">
                        {outstandingOrders.length === 0 ? (
                            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Tidak ada outstanding order.</div>
                        ) : outstandingOrders.map((order) => (
                            <article key={order.id} className="space-y-3 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div><Link className="font-medium underline-offset-4 hover:underline" href={`/orders/${order.id}`}>{order.order_no}</Link><div className="mt-1 text-sm text-muted-foreground">{order.customer_name}</div></div>
                                    <SimStatusBadge label={order.status} tone={order.risk_flag ? 'danger' : toneForStatus(order.status)} />
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-sm"><div><div className="text-xs text-muted-foreground">Cabang</div><div className="mt-1 truncate">{order.branch}</div></div><div><div className="text-xs text-muted-foreground">Notaris</div><div className="mt-1 truncate">{order.notary}</div></div><div><div className="text-xs text-muted-foreground">Tanggal</div><div className="mt-1">{order.created_at}</div></div></div>
                                <Button variant="outline" size="sm" className="w-full" asChild><Link href={`/orders/${order.id}`}>Buka detail</Link></Button>
                            </article>
                        ))}
                    </div>
                </section>
            </div>
        </>
    );
}

function Summary({ label, value, icon: Icon, tone = 'neutral' }: { label: string; value: number; icon?: LucideIcon; tone?: 'neutral' | 'info' | 'success' | 'danger' }) {
    const toneClass = { neutral: 'text-foreground', info: 'text-sky-600 dark:text-sky-400', success: 'text-[var(--track-success)]', danger: 'text-amber-600 dark:text-amber-400' }[tone];

    return (
        <div className="sim-metric">
            <div className="flex items-center justify-between gap-3"><div className="text-sm text-muted-foreground">{label}</div>{Icon && <Icon className={`size-4 ${toneClass}`} />}</div>
            <div className={`mt-2 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
        </div>
    );
}

function ReportTable({ title, rows, firstHeader, firstValue }: { title: string; rows: any[]; firstHeader: string; firstValue: (row: any) => string }) {
    return (
        <section className="sim-panel">
            <div className="border-b px-4 py-3 font-medium">{title}</div>
            <SimTable raw minWidth="520px">
                <table className="sim-table w-full min-w-[520px]">
                    <thead className="bg-muted/50 text-left text-muted-foreground">
                        <tr>
                            <th className="px-4 py-3 font-medium">{firstHeader}</th>
                            <th className="px-4 py-3 text-right font-medium">Total</th>
                            <th className="px-4 py-3 text-right font-medium">Selesai</th>
                            <th className="px-4 py-3 text-right font-medium">Risiko</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Tidak ada data.</td></tr>
                        ) : rows.map((row) => (
                            <tr key={firstValue(row)} className="border-t">
                                <td className="px-4 py-3 font-medium">{firstValue(row)}</td>
                                <td className="px-4 py-3 text-right">{row.total_orders}</td>
                                <td className="px-4 py-3 text-right">{row.completed_orders}</td>
                                <td className="px-4 py-3 text-right">{row.risk_orders}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </SimTable>
        </section>
    );
}

ReportsIndex.layout = {
    breadcrumbs: [{ title: 'Laporan', href: '/reports' }],
};
