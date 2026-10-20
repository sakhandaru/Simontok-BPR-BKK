import { Head, Link, router } from '@inertiajs/react';
import { ArrowRight, Search, SlidersHorizontal } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SimEmptyState } from '@/components/sim-empty-state';
import { SimPageHeader } from '@/components/sim-page-header';
import { SimProgress } from '@/components/sim-progress';
import { SimStatusBadge, toneForStatus } from '@/components/sim-status-badge';
import type { Paginated } from '@/types';
import { SimTable } from '@/components/sim-table';

type TrackingOrder = {
    id: number;
    order_no: string;
    customer_name: string;
    no_rekening: string;
    branch: string | null;
    notary: string | null;
    status_label: string;
    current_node: string;
    progress: number;
    risk_flag: boolean;
    payment_status: string;
    created_at: string | null;
};

export default function TrackingIndex({ orders, filters }: { orders: Paginated<TrackingOrder>; filters: { search: string } }) {
    const [search, setSearch] = useState(filters.search ?? '');

    const submit = (event: FormEvent) => {
        event.preventDefault();
        router.get('/tracking-orders', { search }, { preserveState: true, replace: true });
    };

    return (
        <>
            <Head title="Lacak Order" />
            <div className="sim-workspace gap-6">
                <SimPageHeader title="Lacak Order" description="Pantau posisi pengajuan dari dibuat sampai selesai." actions={<Button variant="outline" onClick={() => router.reload({ only: ['orders'] })}>Muat ulang</Button>} />

                <form onSubmit={submit} className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari no. order, nasabah, atau rekening..." />
                    </div>
                    <Button type="submit" variant="outline"><SlidersHorizontal className="size-4" /> Filter</Button>
                </form>

                <SimTable raw>
                        <table className="sim-table min-w-[980px]">
                            <thead>
                                <tr>
                                    <th>Order</th>
                                    <th>Nasabah</th>
                                    <th>Cabang / notaris</th>
                                    <th>Status</th>
                                    <th>Progress</th>
                                    <th className="text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.data.length === 0 ? (
                                    <tr><td colSpan={6}><SimEmptyState title="Tidak ada order yang cocok" description="Coba ubah kata kunci pencarian." /></td></tr>
                                ) : orders.data.map((order) => (
                                    <tr key={order.id}>
                                        <td>
                                            <div className="font-medium">{order.order_no}</div>
                                            <div className="text-xs text-muted-foreground">{order.created_at ?? '-'}</div>
                                        </td>
                                        <td>
                                            <div className="font-medium">{order.customer_name}</div>
                                            <div className="max-w-64 truncate text-xs text-muted-foreground">{order.no_rekening}</div>
                                        </td>
                                        <td>
                                            <div>{order.branch ?? '-'}</div>
                                            <div className="text-xs text-muted-foreground">{order.notary ?? '-'}</div>
                                        </td>
                                        <td>
                                            <div className="flex flex-wrap gap-2">
                                                <SimStatusBadge label={order.current_node} tone={order.risk_flag ? 'danger' : toneForStatus(order.current_node)} />
                                                <SimStatusBadge label={order.payment_status} tone={toneForStatus(order.payment_status)} />
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <SimProgress value={order.progress} className="w-40" />
                                            </div>
                                        </td>
                                        <td className="text-right">
                                            <Button variant="outline" size="sm" asChild>
                                                <Link href={`/tracking-orders/${order.id}`}>Lacak <ArrowRight className="size-4" /></Link>
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                </SimTable>
                    <div className="flex flex-wrap gap-2 border-t p-4">
                        {orders.links.map((link) => (
                            <Button key={link.label} variant={link.active ? 'default' : 'outline'} size="sm" disabled={!link.url} asChild={Boolean(link.url)}>
                                {link.url ? <Link href={link.url} dangerouslySetInnerHTML={{ __html: link.label }} /> : <span dangerouslySetInnerHTML={{ __html: link.label }} />}
                            </Button>
                        ))}
                    </div>
            </div>
        </>
    );
}

TrackingIndex.layout = {
    breadcrumbs: [{ title: 'Lacak Order', href: '/tracking-orders' }],
};
