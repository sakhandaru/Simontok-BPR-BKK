import { RotateCcw, Search } from 'lucide-react';
import { FormEvent, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type SimTableToolbarProps = {
    search: string;
    searchPlaceholder: string;
    onSearchChange: (value: string) => void;
    onSubmit: () => void;
    onReset: () => void;
    children?: ReactNode;
};

export function SimTableToolbar({ search, searchPlaceholder, onSearchChange, onSubmit, onReset, children }: SimTableToolbarProps) {
    const submit = (event: FormEvent) => {
        event.preventDefault();
        onSubmit();
    };

    return (
        <form onSubmit={submit} className="flex flex-col gap-3 rounded-md border border-border bg-card p-3 sm:flex-row sm:items-end">
            <div className="grid min-w-0 flex-1 gap-2">
                <label htmlFor="table-search" className="text-xs font-medium text-muted-foreground">Cari</label>
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="table-search" className="pl-9" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder={searchPlaceholder} />
                </div>
            </div>
            {children && <div className="grid gap-2 sm:min-w-44"><span className="text-xs font-medium text-muted-foreground">Filter</span>{children}</div>}
            <div className="flex gap-2 sm:shrink-0">
                <Button type="submit"><Search className="size-4" />Cari</Button>
                <Button type="button" variant="outline" onClick={onReset}><RotateCcw className="size-4" />Reset</Button>
            </div>
        </form>
    );
}
