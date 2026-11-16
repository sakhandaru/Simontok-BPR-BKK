import { Head, Link, router } from '@inertiajs/react';
import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import type { Paginated } from '@/types';
import { SimTable } from '@/components/sim-table';
import { SimStatusBadge, toneForStatus } from '@/components/sim-status-badge';
import { SimTableToolbar } from '@/components/sim-table-toolbar';
import { SimSelect } from '@/components/sim-select';

type NotaryOrder = {
    id: number;
    order_no: string;
    customer_name: string;
    no_rekening: string;
    status: string;
    branch: string | null;
    sent_to_notary_at: string | null;
};
type CovernoteAlert = { id: number; order_id: number; order_no: string | null; nama_agunan: string | null; covernote_end: string | null; days_left: number };
type StatusSummary = { key: string; label: string; value: number };

export default function NotaryOrdersIndex({ orders, isNotaryUser, isMonitor, filters, statusOptions, statusSummary, covernoteAlerts }: { orders: Paginated<NotaryOrder>; isNotaryUser: boolean; isMonitor: boolean; filters: { search: string; status: string }; statusOptions: { value: string; label: string }[]; statusSummary: StatusSummary[]; covernoteAlerts: CovernoteAlert[] }) {
    const [search, setSearch] = useState(filters.search);
    const [status, setStatus] = useState(filters.status);

    return (
        <>
            <Head title="Portal Notaris" />
            <div className="flex h-full flex-1 flex-col gap-5 p-4 md:p-6">
                <div>
                    <h1 className="text-2xl font-semibold">Portal Notaris</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Daftar pekerjaan yang sudah dikirim oleh BPR untuk ditindaklanjuti.</p>
                </div>

                {covernoteAlerts.length > 0 && (
                    <section className="rounded-lg border border-amber-300/70 bg-amber-50 p-3 text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-100 md:p-4">
                        <div className="flex items-start gap-3">
                            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-300" />
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                    <h2 className="font-semibold">Covernote mendekati jatuh tempo ({covernoteAlerts.length})</h2>
                                    <span className="text-xs font-medium uppercase tracking-wide opacity-70">Perlu ditindaklanjuti</span>
                                </div>
                                <p className="mt-1 text-sm opacity-90">Mohon ajukan perpanjangan sebelum masa berlaku berakhir.</p>
                                <div className="mt-3 grid gap-2 md:grid-cols-3">
                                    {covernoteAlerts.slice(0, 3).map((item) => (
                                        <Link key={item.id} href={`/notary/orders/${item.order_id}`} className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-amber-300/60 bg-background/80 px-3 py-2 text-sm text-foreground hover:bg-background dark:border-amber-700/50">
                                            <span className="min-w-0 truncate"><span className="font-medium">{item.order_no}</span> · {item.nama_agunan || 'Agunan'}</span>
                                            <span className="shrink-0 font-semibold text-amber-700 dark:text-amber-300">H-{item.days_left}</span>
                                        </Link>
                                    ))}
                                </div>
                                {covernoteAlerts.length > 3 && <p className="mt-2 text-xs opacity-80">+{covernoteAlerts.length - 3} covernote lainnya perlu ditindaklanjuti.</p>}
                            </div>
                        </div>
                    </section>
                )}

                <div className="grid grid-cols-2 divide-x divide-border overflow-hidden rounded-lg border border-border bg-card md:grid-cols-4">
                    {statusSummary.map((item) => (
                        <div key={item.key} className="min-w-0 px-4 py-3 md:px-5">
                            <div className="text-xs text-muted-foreground">{item.label}</div>
                            <div className="mt-1 text-xl font-semibold tracking-tight">{item.value.toLocaleString('id-ID')}</div>
                        </div>
                    ))}
                </div>

                <SimTableToolbar search={search} searchPlaceholder="No. order, nasabah, atau rekening" onSearchChange={setSearch} onSubmit={() => router.get('/notary/orders', { search, status }, { preserveState: true, replace: true })} onReset={() => { setSearch(''); setStatus(''); router.get('/notary/orders'); }}>
                    <SimSelect value={status} onChange={setStatus} options={statusOptions} placeholder="Semua status" />
                </SimTableToolbar>

                <div className="rounded-lg border">
                    {isMonitor && (
                        <div className="border-b bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                            Mode pantau pusat. Daftar ini mencakup order yang sudah dikirim ke notaris dari seluruh cabang; tindakan portal tetap dilakukan oleh akun notaris.
                        </div>
                    )}
                    <div className="hidden md:block"><SimTable raw>
                        <table className="sim-table w-full min-w-[780px] text-sm">
                            <thead className="bg-muted/50 text-left text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 font-medium">No order</th>
                                    <th className="px-4 py-3 font-medium">Nasabah</th>
                                    <th className="px-4 py-3 font-medium">Cabang</th>
                                    <th className="px-4 py-3 font-medium">Status</th>
                                    <th className="px-4 py-3 font-medium">Dikirim</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                                            Belum ada pekerjaan yang dikirim ke akun notaris ini.
                                        </td>
                                    </tr>
                                ) : (
                                    orders.data.map((order) => (
                                        <tr key={order.id} className="border-t">
                                            <td className="px-4 py-3">
                                                <Link href={`/notary/orders/${order.id}`} className="font-medium underline-offset-4 hover:underline">
                                                    {order.order_no}
                                                </Link>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium">{order.customer_name}</div>
                                                <div className="text-muted-foreground">{order.no_rekening}</div>
                                            </td>
                                            <td className="px-4 py-3">{order.branch}</td>
                                            <td className="px-4 py-3"><SimStatusBadge label={order.status} tone={toneForStatus(order.status)} /></td>
                                            <td className="px-4 py-3">{order.sent_to_notary_at}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </SimTable></div>
                    <div className="space-y-3 p-3 md:hidden">
                        {orders.data.length === 0 ? (
                            <div className="px-1 py-8 text-center text-sm text-muted-foreground">Belum ada pekerjaan yang dikirim ke akun notaris ini.</div>
                        ) : orders.data.map((order) => (
                            <article key={order.id} className="space-y-4 border border-border bg-card p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0"><Link href={`/notary/orders/${order.id}`} className="text-lg font-medium leading-6 underline-offset-4 hover:underline">{order.order_no}</Link><div className="mt-1 text-sm text-muted-foreground">{order.customer_name}</div><div className="text-xs text-muted-foreground">{order.no_rekening}</div></div>
                                    <SimStatusBadge label={order.status} tone={toneForStatus(order.status)} />
                                </div>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-4 text-sm">
                                    <div><div className="text-xs text-muted-foreground">Cabang</div><div className="mt-1 leading-5">{order.branch || '-'}</div></div>
                                    <div className="text-right"><div className="text-xs text-muted-foreground">Dikirim</div><div className="mt-1 leading-5">{order.sent_to_notary_at || '-'}</div></div>
                                </div>
                                <Link href={`/notary/orders/${order.id}`} className="flex h-10 items-center justify-center border border-border text-sm font-medium hover:bg-muted">Buka detail</Link>
                            </article>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}

NotaryOrdersIndex.layout = {
    breadcrumbs: [{ title: 'Portal Notaris', href: '/notary/orders' }],
};
