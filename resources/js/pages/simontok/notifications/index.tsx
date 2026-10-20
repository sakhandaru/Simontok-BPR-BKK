import { Head, Link, router } from '@inertiajs/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Paginated } from '@/types';

type NotificationItem = {
    id: number;
    title: string;
    message: string;
    link_url?: string | null;
    is_read: boolean;
    created_at: string;
    read_at?: string | null;
};

export default function NotificationsIndex({ notifications }: { notifications: Paginated<NotificationItem> }) {
    return (
        <>
            <Head title="Notifikasi" />
            <div className="flex h-full flex-1 flex-col gap-5 p-4 md:p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">Notifikasi</h1>
                        <p className="mt-1 text-sm text-muted-foreground">Daftar pemberitahuan pekerjaan, invoice, dan handover.</p>
                    </div>
                    <Button variant="outline" onClick={() => router.post('/notifications/read-all', {}, { preserveScroll: true })}>Tandai semua dibaca</Button>
                </div>

                <section className="rounded-lg border">
                    <div className="divide-y">
                        {notifications.data.length === 0 ? (
                            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Belum ada notifikasi.</div>
                        ) : notifications.data.map((item) => (
                            <div key={item.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto]">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="font-medium">{item.title}</h2>
                                        {!item.is_read && <Badge variant="secondary">Baru</Badge>}
                                    </div>
                                    <p className="mt-1 text-sm text-muted-foreground">{item.message}</p>
                                    <div className="mt-2 text-xs text-muted-foreground">{item.created_at}{item.read_at ? ` - dibaca ${item.read_at}` : ''}</div>
                                </div>
                                <div className="flex flex-wrap gap-2 md:justify-end">
                                    {item.link_url && <Button variant="outline" size="sm" asChild><Link href={item.link_url}>Buka</Link></Button>}
                                    {!item.is_read && <Button size="sm" onClick={() => router.post(`/notifications/${item.id}/read`, {}, { preserveScroll: true })}>Tandai dibaca</Button>}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </>
    );
}

NotificationsIndex.layout = {
    breadcrumbs: [{ title: 'Notifikasi', href: '/notifications' }],
};
