import { Head, Link, router } from '@inertiajs/react';
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

export default function NotaryOrdersIndex({ orders, isNotaryUser, isMonitor, filters, statusOptions }: { orders: Paginated<NotaryOrder>; isNotaryUser: boolean; isMonitor: boolean; filters: { search: string; status: string }; statusOptions: { value: string; label: string }[] }) {
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
