import { usePage } from '@inertiajs/react';

export default function AppLogo() {
    const { name } = usePage().props;

    return (
        <div className="flex min-w-0 items-center overflow-hidden">
            <img
                src="/logo_web.svg"
                alt={name || 'SIMONTOK'}
                className="h-9 w-auto max-w-none shrink-0 object-contain object-left group-data-[collapsible=icon]:h-9"
            />
        </div>
    );
}
