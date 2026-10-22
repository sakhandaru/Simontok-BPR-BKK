import { Link, usePage } from '@inertiajs/react';
import { ArrowLeft, ArrowRight, Bell, Ellipsis, FileText, LayoutGrid, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useCanGoBack } from '@/hooks/use-can-go-back';
import { cn } from '@/lib/utils';

export function MobileBottomNav() {
    const { auth } = usePage<{ auth: { permissions?: string[] } }>().props;
    // Disimpan setelah mount agar render awal identik dengan SSR
    // (window.location tidak ada di server).
    const [currentPath, setCurrentPath] = useState('');
    const canGoBack = useCanGoBack();

    useEffect(() => {
        setCurrentPath(window.location.pathname);
    }, []);

    const can = (permission: string) => auth.permissions?.includes(permission) ?? false;
    const items = [
        can('dashboard.view') && { label: 'Dashboard', href: '/dashboard', icon: LayoutGrid },
        can('orders.view') && { label: 'Order', href: '/orders', icon: FileText },
        can('notifications.view') && { label: 'Notifikasi', href: '/notifications', icon: Bell },
    ].filter(Boolean) as { label: string; href: string; icon: typeof LayoutGrid }[];

    return <nav className="fixed bottom-4 left-1/2 z-50 flex h-14 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-full border border-zinc-300/80 bg-zinc-200/90 p-1.5 shadow-[0_8px_30px_rgb(0_0_0/0.12)] backdrop-blur-xl supports-[backdrop-filter]:bg-zinc-200/75 dark:border-zinc-700/70 dark:bg-zinc-900/70 dark:shadow-[0_8px_30px_rgb(0_0_0/0.35)] dark:supports-[backdrop-filter]:bg-zinc-900/55 lg:hidden" aria-label="Navigasi mobile">
        <div className="flex items-center gap-0.5 rounded-full p-0.5">
            <Button variant="ghost" size="icon" className="size-9 rounded-full text-muted-foreground" onClick={() => window.history.back()} disabled={!canGoBack} aria-label="Halaman sebelumnya"><ArrowLeft className="size-4" /></Button>
            <Button variant="ghost" size="icon" className="size-9 rounded-full text-muted-foreground" onClick={() => window.history.forward()} aria-label="Halaman berikutnya"><ArrowRight className="size-4" /></Button>
            {items.map((item) => {
                const active = currentPath === item.href || currentPath.startsWith(`${item.href}/`);

                return <Link key={item.href} href={item.href} aria-label={item.label} className={cn('flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-zinc-200/70 hover:text-foreground dark:hover:bg-zinc-700/70', active && 'bg-zinc-50/90 text-foreground shadow-sm dark:bg-zinc-700/80')}>
                    <item.icon className="size-5" />
                </Link>;
            })}
            <SidebarTrigger className="size-10 justify-center rounded-full text-muted-foreground" aria-label="Menu lainnya"><Ellipsis className="size-5" /></SidebarTrigger>
        </div>
        {can('orders.create') && <Button asChild size="icon" className="size-10 shrink-0 rounded-full shadow-sm" aria-label="Buat order"><Link href="/orders/create"><Plus className="size-5" /></Link></Button>}
    </nav>;
}
