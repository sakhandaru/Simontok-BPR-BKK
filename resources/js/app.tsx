import { createInertiaApp } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { initializeTheme } from '@/hooks/use-appearance';
import AppLayout from '@/layouts/app-layout';
import AuthLayout from '@/layouts/auth-layout';
import SettingsLayout from '@/layouts/settings/layout';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

/**
 * Wraps every page so the Toaster renders inside the Inertia page context.
 * The Toaster reads flash/validation state with `usePage()`, and `withApp()`
 * wraps the Inertia app from the outside, where that context does not exist.
 */
const RootLayout = ({ children }: { children?: ReactNode }) => (
    <>
        {children}
        <Toaster />
    </>
);

void createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    layout: (name) => {
        switch (true) {
            case name === 'welcome':
                return RootLayout;
            case name.startsWith('auth/'):
                return [RootLayout, AuthLayout];
            case name.startsWith('settings/'):
                return [RootLayout, AppLayout, SettingsLayout];
            default:
                return [RootLayout, AppLayout];
        }
    },
    strictMode: true,
    withApp(app) {
        return <TooltipProvider delayDuration={0}>{app}</TooltipProvider>;
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();
