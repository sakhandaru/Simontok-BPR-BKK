import { Filter, Search, SlidersHorizontal } from 'lucide-react';
import { FormEvent, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';

export type SimQuickFilter = { label: string; onSelect: () => void; active?: boolean };

type SimFilterBarProps = {
    search: string;
    searchPlaceholder?: string;
    onSearchChange: (value: string) => void;
    onApply: () => void;
    onReset: () => void;
    activeFilterCount?: number;
    quickFilters?: SimQuickFilter[];
    children: ReactNode;
};

export function SimFilterBar({ search, searchPlaceholder = 'Cari...', onSearchChange, onApply, onReset, activeFilterCount = 0, quickFilters = [], children }: SimFilterBarProps) {
    return <form onSubmit={(event) => { event.preventDefault(); onApply(); }} className="border-b border-border pb-4">
        <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder={searchPlaceholder} />
            </div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="icon" className="relative shrink-0" aria-label="Buka filter" title="Buka filter">
                        <SlidersHorizontal className="size-4" />
                        {activeFilterCount > 0 && <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">{activeFilterCount}</span>}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[min(320px,calc(100vw-2rem))] p-3" onCloseAutoFocus={(event) => event.preventDefault()}>
                    <div className="mb-3"><p className="text-sm font-semibold">Filter order</p></div>
                    <div className="grid gap-3">{children}</div>
                    {quickFilters.length > 0 && <div className="mt-3 border-t pt-3"><p className="mb-2 text-xs font-medium text-muted-foreground">Filter cepat</p><div className="flex flex-wrap gap-1.5">{quickFilters.map((filter) => <Button key={filter.label} type="button" size="sm" variant={filter.active ? 'default' : 'outline'} onClick={filter.onSelect}>{filter.label}</Button>)}</div></div>}
                    <div className="mt-3 flex justify-end gap-2 border-t pt-3">
                        <Button type="button" size="sm" variant="outline" onClick={onReset}><Filter className="size-3.5" />Reset</Button>
                        <Button type="button" size="sm" onClick={onApply}>Terapkan</Button>
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    </form>;
}
