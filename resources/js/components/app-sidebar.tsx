import { Link, usePage } from '@inertiajs/react';
import { BarChart3, Bell, BriefcaseBusiness, Building2, ClipboardList, FileText, KeyRound, LayoutGrid, Scale, UserCheck, UserRoundCog, Users } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
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
    { title: 'Manajemen Pengguna', href: '/users', icon: Users },
    { title: 'Manajemen Role', href: '/roles', icon: KeyRound },
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
    const operations = [
        ...(can('dashboard.view') ? [operationsNavItems[0]] : []),
        ...(can('orders.view') ? [operationsNavItems[1]] : []),
        ...(can('reports.view') ? [operationsNavItems[2]] : []),
    ];

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
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
