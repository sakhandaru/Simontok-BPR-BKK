import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { AlertTriangle, ArrowRight, FileText, Plus, ReceiptText, Save, TimerReset } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SimEmptyState } from '@/components/sim-empty-state';
import { SimPageHeader } from '@/components/sim-page-header';
import { SimStatusBadge, toneForStatus } from '@/components/sim-status-badge';
import { SimFilterBar } from '@/components/sim-filter-bar';
import { SimJourneyNodes } from '@/components/sim-journey-nodes';
import { SimSelect } from '@/components/sim-select';
import type { OrderListItem, Paginated } from '@/types';
import { SimTableSortHeader } from '@/components/sim-table';
import { SimTable } from '@/components/sim-table';
import { useSimTableSort } from '@/components/sim-table';

type StatusOption = { value: string; label: string };
type OrderItem = OrderListItem & {
    risk_flag: boolean;
    payment_status: string;
    collaterals_count: number;
    documents_count: number;
    handovers_count: number;
};

export default function OrdersIndex({
    orders,
    filters,
    statuses,
    orderSummary,
}: {
    orders: Paginated<OrderItem>;
    filters: { search: string; status: string; risk: string; sla: string; payment: string };
    statuses: StatusOption[];
    orderSummary: { total: number; active: number; risk: number; invoice_queue: number };
}) {
    const { auth } = usePage<{ auth: { permissions?: string[] } }>().props;
    const canCreate = auth.permissions?.includes('orders.create') ?? false;
    const { data, setData } = useForm(filters);
    const { sortedRows: sortedOrders, sort, toggleSort } = useSimTableSort(orders.data, 'created_at', 'desc');
    const submit = () => {
        router.get('/orders', data, { preserveState: true, replace: true });
    };

    const go = (params: Record<string, string>) => router.get('/orders', params, { preserveState: true, replace: true });

    return (
        <>
            <Head title="Order" />
            <div className="sim-workspace">
                <SimPageHeader
                    title="Order"
                    description="Daftar pekerjaan notaris dengan posisi, risiko, SLA, dan pembayaran."
                    actions={canCreate ? <Button asChild><Link href="/orders/create"><Plus className="size-4" />Buat order</Link></Button> : undefined}
                />

                <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Summary label="Total order" value={orderSummary.total} note="Seluruh order yang tercatat" icon={FileText} onClick={() => go({})} tone="info" />
                    <Summary label="Aktif" value={orderSummary.active} note="Masih dalam proses pengerjaan" icon={TimerReset} onClick={() => go({})} tone="success" />
                    <Summary label="Risiko" value={orderSummary.risk} note="Perlu perhatian atau tindak lanjut" icon={AlertTriangle} onClick={() => go({ risk: '1' })} tone="danger" />
                    <Summary label="Antrian invoice" value={orderSummary.invoice_queue} note="Menunggu pemeriksaan pembayaran" icon={ReceiptText} onClick={() => go({ payment: 'requested' })} tone="warning" />
                </section>

                <SimFilterBar search={data.search} searchPlaceholder="Cari no order, nasabah, atau rekening" onSearchChange={(value) => setData('search', value)} onApply={submit} onReset={() => router.get('/orders')} activeFilterCount={[data.status, data.risk, data.sla, data.payment].filter(Boolean).length} quickFilters={[
                    { label: 'Risiko aktif', active: data.risk === '1', onSelect: () => go({ risk: '1' }) },
                    { label: 'Menunggu notaris', active: data.status === 'menunggu_verifikasi_notaris', onSelect: () => go({ status: 'menunggu_verifikasi_notaris' }) },
                    { label: 'Validasi BPR', active: data.status === 'menunggu_validasi_bpr', onSelect: () => go({ status: 'menunggu_validasi_bpr' }) },
                    { label: 'Siap approval', active: data.payment === 'verified', onSelect: () => go({ payment: 'verified' }) },
                ]}>
                    <div className="grid gap-2"><label className="text-sm font-medium">Status order</label><SimSelect value={data.status} onChange={(value) => setData('status', value)} options={statuses.map((status) => ({ value: status.value, label: status.label }))} placeholder="Semua status" /></div>
                    <div className="grid gap-2"><label className="text-sm font-medium">SLA</label><SimSelect value={data.sla} onChange={(value) => setData('sla', value)} options={[{ value: 'due_soon', label: 'SLA H-7' }, { value: 'overdue', label: 'SLA terlampaui' }]} placeholder="Semua SLA" /></div>
                    <div className="grid gap-2"><label className="text-sm font-medium">Pembayaran</label><SimSelect value={data.payment} onChange={(value) => setData('payment', value)} options={[{ value: 'none', label: 'Belum invoice' }, { value: 'requested', label: 'Diajukan' }, { value: 'verified', label: 'Diverifikasi' }, { value: 'approved', label: 'Disetujui' }, { value: 'paid', label: 'Dibayar' }]} placeholder="Semua pembayaran" /></div>
                    <div className="grid gap-2"><label className="text-sm font-medium">Prioritas</label><SimSelect value={data.risk} onChange={(value) => setData('risk', value)} options={[{ value: '1', label: 'Risiko aktif' }]} placeholder="Semua order" /></div>
                </SimFilterBar>

                <section className="sim-panel">
                    <div className="md:block">
                    <SimTable raw className="hidden md:block">
                        <table className="sim-table min-w-[1120px]">
                            <thead className="bg-muted/30 text-left text-xs text-muted-foreground">
                                <tr>
                                    <SimTableSortHeader active={sort.key === 'order_no'} direction={sort.direction} onClick={() => toggleSort('order_no')}>Order</SimTableSortHeader>
                                    <SimTableSortHeader active={sort.key === 'customer_name'} direction={sort.direction} onClick={() => toggleSort('customer_name')}>Nasabah</SimTableSortHeader>
                                    <SimTableSortHeader active={sort.key === 'branch'} direction={sort.direction} onClick={() => toggleSort('branch')}>Cabang / Notaris</SimTableSortHeader>
                                    <SimTableSortHeader active={sort.key === 'status'} direction={sort.direction} onClick={() => toggleSort('status')}>Posisi / status</SimTableSortHeader>
                                    <SimTableSortHeader active={sort.key === 'documents_count'} direction={sort.direction} onClick={() => toggleSort('documents_count')}>Dokumen</SimTableSortHeader>
                                    <SimTableSortHeader active={sort.key === 'payment_status'} direction={sort.direction} onClick={() => toggleSort('payment_status')}>Pembayaran</SimTableSortHeader>
                                    <SimTableSortHeader active={sort.key === 'created_at'} direction={sort.direction} onClick={() => toggleSort('created_at')}>Tanggal</SimTableSortHeader>
                                    <th className="px-4 py-3 text-right font-medium">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.data.length === 0 ? (
                                    <tr><td colSpan={8}><SimEmptyState title="Tidak ada order sesuai filter" description="Coba ubah kata kunci atau hapus sebagian filter." /></td></tr>
                                ) : sortedOrders.map((order) => (
                                    <tr key={order.id} className={`border-t border-l-2 align-top ${order.risk_flag ? 'border-l-red-500/80' : toneBorder(order.status)}`}>
                                        <td className="px-4 py-3">
                                            <Link href={`/orders/${order.id}`} className="font-medium underline-offset-4 hover:underline">{order.order_no}</Link>
                                            {order.risk_flag && <div className="mt-2"><SimStatusBadge label="Risiko" tone="danger" /></div>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium">{order.customer_name}</div>
                                            <div className="text-muted-foreground">{order.no_rekening}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div>{order.branch ?? '-'}</div>
                                            <div className="text-muted-foreground">{order.notary ?? '-'}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="inline-block rounded-md px-2 py-1"><SimJourneyNodes status={order.status} /></div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div>{order.documents_count} file / {order.collaterals_count} agunan</div>
                                            <div className="mt-1 text-muted-foreground">{order.handovers_count} handover fisik</div>
                                        </td>
                                        <td className="px-4 py-3"><SimStatusBadge label={order.payment_status} tone={toneForStatus(order.payment_status)} /></td>
                                        <td className="px-4 py-3">{order.created_at}</td>
                                        <td className="px-4 py-3 text-right">
                                            <Button variant="ghost" size="sm" asChild><Link href={`/orders/${order.id}`}>Buka <ArrowRight className="size-4" /></Link></Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </SimTable>
                    </div>
                    <div className="divide-y md:hidden">
                        {orders.data.length === 0 ? (
                            <SimEmptyState title="Tidak ada order sesuai filter" description="Coba ubah kata kunci atau hapus sebagian filter." />
                        ) : sortedOrders.map((order) => (
                            <article key={order.id} className={`space-y-4 border-l-2 p-4 ${order.risk_flag ? 'border-l-red-500/80' : toneBorder(order.status)}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <Link href={`/orders/${order.id}`} className="font-medium underline-offset-4 hover:underline">{order.order_no}</Link>
                                        <div className="mt-1 truncate text-sm text-muted-foreground">{order.customer_name}</div>
                                        <div className="text-xs text-muted-foreground">{order.no_rekening}</div>
                                    </div>
                                    {order.risk_flag && <SimStatusBadge label="Risiko" tone="danger" />}
                                </div>
                                <div className="rounded-md border bg-muted/10 p-3">
                                    <div className="mb-2 text-xs font-medium text-muted-foreground">Posisi saat ini</div>
                                    <SimJourneyNodes status={order.status} />
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div><div className="text-xs text-muted-foreground">Cabang / notaris</div><div className="mt-1 truncate">{order.branch ?? '-'}</div><div className="truncate text-muted-foreground">{order.notary ?? '-'}</div></div>
                                    <div><div className="text-xs text-muted-foreground">Pembayaran</div><div className="mt-1"><SimStatusBadge label={order.payment_status} tone={toneForStatus(order.payment_status)} /></div></div>
                                    <div><div className="text-xs text-muted-foreground">Dokumen</div><div className="mt-1">{order.documents_count} file / {order.collaterals_count} agunan</div></div>
                                    <div><div className="text-xs text-muted-foreground">Tanggal</div><div className="mt-1">{order.created_at}</div></div>
                                </div>
                                <Button variant="outline" size="sm" className="w-full" asChild><Link href={`/orders/${order.id}`}>Buka detail <ArrowRight className="size-4" /></Link></Button>
                            </article>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4">
                        <p className="text-xs text-muted-foreground">Menampilkan {orders.data.length} order pada halaman ini.</p>
                        <div className="flex flex-wrap gap-2">
                            {orders.links.map((link) => (
                                <Button key={link.label} size="sm" variant={link.active ? 'default' : 'outline'} disabled={!link.url} asChild={Boolean(link.url)}>
                                    {link.url ? <Link href={link.url} dangerouslySetInnerHTML={{ __html: link.label }} /> : <span dangerouslySetInnerHTML={{ __html: link.label }} />}
                                </Button>
                            ))}
                        </div>
                    </div>
                </section>
            </div>
        </>
    );
}

function Summary({ label, value, note, icon: Icon, onClick, tone }: { label: string; value: number; note: string; icon: typeof FileText; onClick: () => void; tone: 'info' | 'success' | 'warning' | 'danger' }) {
    const labelStyles = {
        info: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
        success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        warning: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
        danger: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
    };
    return (
        <button type="button" onClick={onClick} className="sim-metric text-left transition-colors hover:bg-muted/30">
            <div className="flex items-center justify-between gap-3">
                <span className={`inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-medium ${labelStyles[tone]}`}>{label}</span>
                <Icon className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-3 text-2xl font-semibold">{value}</div>
            <div className="mt-2 text-xs leading-5 text-muted-foreground">{note}</div>
            <div className="mt-3 flex items-center gap-1 text-xs font-medium text-muted-foreground">Buka daftar <ArrowRight className="size-3.5" /></div>
        </button>
    );
}

function toneBorder(status: string): string {
    const tone = toneForStatus(status);
    return tone === 'success' ? 'border-l-emerald-500/60' : tone === 'warning' ? 'border-l-amber-500/60' : tone === 'danger' ? 'border-l-red-500/60' : tone === 'info' ? 'border-l-sky-500/60' : 'border-l-transparent';
}

OrdersIndex.layout = {
    breadcrumbs: [{ title: 'Order', href: '/orders' }],
};
