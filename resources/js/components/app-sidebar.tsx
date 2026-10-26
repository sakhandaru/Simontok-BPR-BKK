import { Link, usePage } from '@inertiajs/react';
import { ArrowLeft, ArrowRight, BarChart3, Bell, BriefcaseBusiness, Building2, ClipboardList, FileText, KeyRound, LayoutGrid, Monitor, Moon, Scale, Sun, UserCheck, UserRoundCog, Users } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { useCanGoBack } from '@/hooks/use-can-go-back';
import { useAppearance } from '@/hooks/use-appearance';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { dashboard } from '@/routes';
import type { NavItem } from '@/types';

const operationsNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: dashboard(),
        icon: LayoutGrid,
    },
    { title: 'Order', href: '/orders', icon: FileText },
    { title: 'Laporan', href: '/reports', icon: BarChart3 },
];

const referenceNavItems: NavItem[] = [
    { title: 'Cabang', href: '/branches', icon: Building2 },
    { title: 'Notaris', href: '/notaries', icon: Scale },
    { title: 'Jenis Pekerjaan', href: '/job-types', icon: BriefcaseBusiness },
];

const administrationNavItems: NavItem[] = [
    {
        title: 'Portal Notaris',
        href: '/notary/orders',
        icon: UserCheck,
    },
    { title: 'Notifikasi', href: '/notifications', icon: Bell },
    { title: 'Audit Log', href: '/audit-logs', icon: ClipboardList },
    { title: 'Pengguna', href: '/users', icon: Users },
    { title: 'Role', href: '/roles', icon: KeyRound },
];

const footerNavItems: NavItem[] = [
    {
        title: 'Pengaturan Akun',
        href: '/settings/profile',
        icon: UserRoundCog,
    },
];

function useVisibleItems(items: NavItem[], permission: string) {
    const { auth } = usePage<{ auth: { permissions?: string[] } }>().props;
    return auth.permissions?.includes(permission) ? items : [];
}

export function AppSidebar() {
    const { auth } = usePage<{ auth: { permissions?: string[] } }>().props;
    const can = (permission: string) => auth.permissions?.includes(permission) ?? false;
    const canGoBack = useCanGoBack();
    const { appearance, resolvedAppearance, updateAppearance } = useAppearance();
    const operations = [
        ...(can('dashboard.view') ? [operationsNavItems[0]] : []),
        ...(can('orders.view') ? [operationsNavItems[1]] : []),
        ...(can('reports.view') ? [operationsNavItems[2]] : []),
    ];

    return (
        <Sidebar collapsible="icon" variant="sidebar">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <div className="mx-auto flex w-full items-center">
                            <div className="flex items-center gap-0.5">
                                <SidebarMenuButton tooltip="Halaman sebelumnya" className="size-8 flex-none justify-center group-data-[collapsible=icon]:hidden" onClick={() => window.history.back()} disabled={!canGoBack} aria-label="Halaman sebelumnya">
                                    <ArrowLeft />
                                </SidebarMenuButton>
                                <SidebarMenuButton tooltip="Halaman berikutnya" className="size-8 flex-none justify-center group-data-[collapsible=icon]:hidden" onClick={() => window.history.forward()} aria-label="Halaman berikutnya">
                                    <ArrowRight />
                                </SidebarMenuButton>
                            </div>
                            <div className="flex h-8 items-center gap-0.5 rounded-full bg-sidebar-accent p-0.5 group-data-[collapsible=icon]:hidden" role="group" aria-label="Pilihan tema">
                                {[
                                    { value: 'system' as const, label: 'Ikuti sistem', icon: Monitor },
                                    { value: 'light' as const, label: 'Mode terang', icon: Sun },
                                    { value: 'dark' as const, label: 'Mode gelap', icon: Moon },
                                ].map(({ value, label, icon: Icon }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        title={label}
                                        aria-label={label}
                                        aria-pressed={appearance === value}
                                        onClick={() => updateAppearance(value)}
                                        className="flex size-7 items-center justify-center rounded-full text-sidebar-foreground/60 transition-colors hover:bg-sidebar hover:text-sidebar-foreground aria-pressed:bg-sidebar aria-pressed:text-sidebar-foreground"
                                    >
                                        <Icon className="size-4" />
                                    </button>
                                ))}
                            </div>
                            <SidebarMenuButton tooltip="Ganti tema" className="hidden size-8 flex-none justify-center group-data-[collapsible=icon]:flex" onClick={() => updateAppearance(resolvedAppearance === 'dark' ? 'light' : 'dark')} aria-label="Ganti tema">
                                {resolvedAppearance === 'dark' ? <Sun /> : <Moon />}
                            </SidebarMenuButton>
                        </div>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={operations} label="Operasional" />
                <NavMain items={useVisibleItems(referenceNavItems, 'masters.manage')} label="Referensi" />
                <NavMain items={administrationNavItems.filter((item) => {
                    if (item.href === '/notary/orders') return can('notary.portal');
                    if (item.href === '/audit-logs') return can('audit.view');
                    if (item.href === '/users') return can('users.manage');
                    if (item.href === '/roles') return can('roles.manage');
                    return false;
                })} label="Administrasi" />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
