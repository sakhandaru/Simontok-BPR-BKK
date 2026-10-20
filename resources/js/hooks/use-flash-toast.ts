import { router, usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import type { FlashToast } from '@/types/ui';

type FlashProps = {
    flash?: {
        success?: string;
        error?: string;
        warning?: string;
        info?: string;
        toast?: FlashToast;
    };
    errors?: Record<string, string>;
};

export function useFlashToast(): void {
    const { flash, errors } = usePage<FlashProps>().props;

    useEffect(() => {
        return router.on('flash', (event) => {
            const flash = (event as CustomEvent).detail?.flash;
            const data = flash?.toast as FlashToast | undefined;

            if (!data) {
                return;
            }

            toast[data.type](data.message);
        });
    }, []);

    useEffect(() => {
        if (flash?.toast) {
            toast[flash.toast.type](flash.toast.message);
        }

        if (flash?.success) {
            toast.success(flash.success);
        }

        if (flash?.error) {
            toast.error(flash.error);
        }

        if (flash?.warning) {
            toast.warning(flash.warning);
        }

        if (flash?.info) {
            toast.info(flash.info);
        }
    }, [flash]);

    useEffect(() => {
        const firstError = Object.values(errors ?? {})[0];

        if (firstError) {
            toast.error(firstError);
        }
    }, [errors]);
}
