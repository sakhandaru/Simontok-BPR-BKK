import { router, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useRef } from 'react';
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
    const skipNextFlashProps = useRef(false);

    const showFlash = useCallback((value?: FlashProps['flash']) => {
        if (!value) return;

        if (value.toast) {
            const id = `flash:${value.toast.type}:${value.toast.message}`;
            toast[value.toast.type](value.toast.message, { id });
            return;
        }

        if (value.success) {
            toast.success(value.success, { id: `flash:success:${value.success}` });
        } else if (value.error) {
            toast.error(value.error, { id: `flash:error:${value.error}` });
        } else if (value.warning) {
            toast.warning(value.warning, { id: `flash:warning:${value.warning}` });
        } else if (value.info) {
            toast.info(value.info, { id: `flash:info:${value.info}` });
        }
    }, []);

    useEffect(() => {
        return router.on('success', (event) => {
            const pageFlash = (event.detail.page.props as FlashProps).flash;
            if (pageFlash) {
                showFlash(pageFlash);
                skipNextFlashProps.current = true;
            }
        });
    }, [showFlash]);

    useEffect(() => {
        if (skipNextFlashProps.current) {
            skipNextFlashProps.current = false;
            return;
        }

        showFlash(flash);
    }, [flash, showFlash]);

    useEffect(() => {
        const firstError = Object.values(errors ?? {})[0];

        if (firstError) {
            toast.error(firstError);
        }
    }, [errors]);
}
