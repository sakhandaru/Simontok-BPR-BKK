import { usePage } from '@inertiajs/react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

type LiveNotification = {
    id: number;
    title: string;
    message: string;
    link_url?: string | null;
    priority: 'normal' | 'important' | 'critical';
    created_at?: string | null;
};

type PageProps = {
    auth?: {
        role?: string | null;
        user?: { notary_id?: number | null } | null;
    };
    systemSettings?: {
        early_warning_enabled?: boolean;
        notification_poll_interval?: number;
        sound_priority?: 'important' | 'critical';
        quiet_hours_enabled?: boolean;
        quiet_start?: string;
        quiet_end?: string;
    } | null;
};

export function useLiveNotifications(): void {
    const { auth, systemSettings } = usePage<PageProps>().props;
    const since = useRef(new Date().toISOString());
    const audio = useRef<HTMLAudioElement | null>(null);
    const canReceive = Boolean(auth?.user && !auth.user.notary_id && auth.role !== 'auditor' && systemSettings?.early_warning_enabled !== false);

    useEffect(() => {
        if (!canReceive) return;

        audio.current = new Audio('/sounds/notif.mp3');
        audio.current.volume = 0.65;

        const poll = async () => {
            try {
                const response = await fetch(`/notifications/poll?since=${encodeURIComponent(since.current)}`, {
                    headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                    credentials: 'same-origin',
                });
                if (!response.ok) return;

                const payload = await response.json() as { notifications?: LiveNotification[] };
                for (const notification of payload.notifications ?? []) {
                    if (notification.created_at) since.current = notification.created_at;

                    const show = notification.priority === 'critical' ? toast.error : notification.priority === 'important' ? toast.warning : toast.info;
                    show(notification.title, {
                        id: `activity:${notification.id}`,
                        description: notification.message,
                        duration: notification.priority === 'critical' ? 7000 : 4500,
                        action: notification.link_url ? {
                            label: 'Buka',
                            onClick: () => { window.location.href = notification.link_url as string; },
                        } : undefined,
                    });

                    const inQuietHours = systemSettings?.quiet_hours_enabled && isQuietHours(systemSettings.quiet_start ?? '22:00', systemSettings.quiet_end ?? '06:00');
                    const soundAllowed = notification.priority !== 'normal' && (systemSettings?.sound_priority === 'critical' ? notification.priority === 'critical' : true) && !inQuietHours;
                    if (soundAllowed) audio.current?.play().catch(() => undefined);
                }
            } catch {
                // Persistent notifications remain available if polling is temporarily unavailable.
            }
        };

        const interval = window.setInterval(poll, (systemSettings?.notification_poll_interval ?? 15) * 1000);
        return () => {
            window.clearInterval(interval);
            audio.current = null;
        };
    }, [canReceive, systemSettings?.notification_poll_interval, systemSettings?.sound_priority, systemSettings?.quiet_hours_enabled, systemSettings?.quiet_start, systemSettings?.quiet_end]);
}

function isQuietHours(start: string, end: string): boolean {
    const now = new Date();
    const current = now.getHours() * 60 + now.getMinutes();
    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);
    const from = startHour * 60 + startMinute;
    const to = endHour * 60 + endMinute;
    return from <= to ? current >= from && current < to : current >= from || current < to;
}
