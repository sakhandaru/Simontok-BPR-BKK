import { usePage } from '@inertiajs/react';

export default function AppLogo() {
    const { name } = usePage().props;

    return (
        <div className="flex w-full min-w-0 items-center overflow-hidden">
            <img
                src="/logo_web2.svg"
                alt={name || 'SIMONTOK'}
                className="h-auto min-w-0 w-[124px] max-w-full object-contain object-left group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:max-w-none group-data-[collapsible=icon]:shrink-0"
            />
        </div>
    );
}
