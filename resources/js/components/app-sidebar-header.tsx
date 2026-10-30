import { Link, router, usePage } from '@inertiajs/react';
import { Bell, ChevronRight } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarTrigger } from '@/components/ui/sidebar';
import type { BreadcrumbItem as BreadcrumbItemType } from '@/types';

export function AppSidebarHeader({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItemType[];
}) {
    const { auth, notifications } = usePage<{
        auth: { permissions?: string[] };
        notifications?: { count?: number; items?: { id: number; title: string; message: string; link_url?: string | null; priority?: string; created_at?: string | null }[] };
    }>().props;
    const notificationItems = notifications?.items ?? [];
    const notificationCount = notifications?.count ?? notificationItems.length;
    const openNotification = (item: (typeof notificationItems)[number]) => {
        router.post(`/notifications/${item.id}/open`, {}, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                if (item.link_url) router.visit(item.link_url);
            },
        });
    };

    return (
        <header className="sticky top-0 z-20 hidden min-h-14 shrink-0 items-center gap-3 border-b border-border/80 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/85 lg:flex lg:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-2">
                <SidebarTrigger className="-ml-2" />
                <Breadcrumbs breadcrumbs={breadcrumbs} />
            </div>
            <div className="flex items-center gap-3">
                {auth.permissions?.includes('orders.view') && <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="relative size-9" title="Notifikasi" aria-label={`Notifikasi${notificationCount > 0 ? `, ${notificationCount} terbaru` : ''}`}>
                            <Bell className="size-4" />
                            {notificationCount > 0 && <span className="pointer-events-none absolute right-0.5 top-0.5 z-10 flex h-3.5 min-w-3.5 items-center justify-center rounded-full border-2 border-background bg-destructive px-0 text-[8px] font-semibold leading-none text-white">{notificationCount > 99 ? '99+' : notificationCount}</span>}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
                        <div className="border-b px-4 py-3"><div className="font-medium">Notifikasi</div><div className="mt-0.5 text-xs text-muted-foreground">Aktivitas terbaru yang perlu Anda ketahui.</div></div>
                        <div className="max-h-[min(28rem,calc(100vh-8rem))] overflow-y-auto">
                            {notificationItems.length === 0 ? <div className="px-4 py-8 text-center text-sm text-muted-foreground">Belum ada notifikasi terbaru.</div> : notificationItems.map((item) => <button type="button" key={item.id} onClick={() => openNotification(item)} className="flex w-full gap-3 border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/50"><span className={`mt-1.5 size-2 shrink-0 rounded-full ${item.priority === 'critical' ? 'bg-destructive' : item.priority === 'important' ? 'bg-amber-500' : 'bg-primary'}`} /><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{item.title}</span><span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{item.message}</span><span className="mt-1 block text-[11px] text-muted-foreground">{item.created_at ?? 'Baru'}</span></span><ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" /></button>)}
                        </div>
                    </DropdownMenuContent>
                </DropdownMenu>}
                <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
                <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                <span>Operasional aktif</span>
                </div>
            </div>
        </header>
    );
}
