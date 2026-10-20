import { Head, Link } from '@inertiajs/react';
import { Badge } from '@/components/ui/badge';
import type { Paginated } from '@/types';
import { SimTable } from '@/components/sim-table';

type NotaryOrder = {
    id: number;
    order_no: string;
    customer_name: string;
    no_rekening: string;
    status: string;
    branch: string | null;
    sent_to_notary_at: string | null;
};

export default function NotaryOrdersIndex({ orders, isNotaryUser }: { orders: Paginated<NotaryOrder>; isNotaryUser: boolean }) {
    return (
        <>
            <Head title="Portal Notaris" />
            <div className="flex h-full flex-1 flex-col gap-5 p-4 md:p-6">
                <div>
                    <h1 className="text-2xl font-semibold">Portal Notaris</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Daftar pekerjaan yang sudah dikirim oleh BPR untuk ditindaklanjuti.</p>
                </div>

                <div className="rounded-lg border">
                    {!isNotaryUser && (
                        <div className="border-b bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                            Portal ini hanya menampilkan pekerjaan untuk akun yang terhubung ke master notaris. Login dengan akun notaris demo untuk mencoba alur ini.
                        </div>
                    )}
                    <SimTable raw>
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
                                            <td className="px-4 py-3"><Badge variant="secondary">{order.status}</Badge></td>
                                            <td className="px-4 py-3">{order.sent_to_notary_at}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </SimTable>
                </div>
            </div>
        </>
    );
}

NotaryOrdersIndex.layout = {
    breadcrumbs: [{ title: 'Portal Notaris', href: '/notary/orders' }],
};
