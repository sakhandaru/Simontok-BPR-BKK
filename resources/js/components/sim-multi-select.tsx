import { ChevronsUpDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';

type Option = { value: string; label: string };

export function SimMultiSelect({ value, onChange, options, placeholder = 'Pilih...' }: { value: string[]; onChange: (value: string[]) => void; options: Option[]; placeholder?: string }) {
    const [search, setSearch] = useState('');
    const selected = options.filter((option) => value.includes(option.value));
    const label = selected.length === 0 ? placeholder : selected.length === 1 ? selected[0].label : `${selected.length} cabang dipilih`;
    const visibleOptions = useMemo(() => {
        const needle = search.trim().toLowerCase();
        return [...options]
            .filter((option) => needle === '' || option.label.toLowerCase().includes(needle))
            .sort((left, right) => {
                const leftCode = Number(left.label.match(/^\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER);
                const rightCode = Number(right.label.match(/^\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER);
                return leftCode - rightCode || left.label.localeCompare(right.label, 'id');
            });
    }, [options, search]);

    return (
        <DropdownMenu onOpenChange={(open) => { if (!open) setSearch(''); }}>
            <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-between font-normal">
                    <span className="truncate">{label}</span>
                    <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] p-2">
                <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    onKeyDown={(event) => event.stopPropagation()}
                    placeholder="Cari kode atau nama cabang"
                    aria-label="Cari cabang"
                    className="mb-2"
                />
                <div className="max-h-64 overflow-y-auto">
                    {visibleOptions.length > 0 ? visibleOptions.map((option) => (
                        <DropdownMenuCheckboxItem key={option.value} checked={value.includes(option.value)} onCheckedChange={(checked) => onChange(checked ? [...value, option.value] : value.filter((item) => item !== option.value))}>
                            {option.label}
                        </DropdownMenuCheckboxItem>
                    )) : <p className="px-2 py-3 text-sm text-muted-foreground">Cabang tidak ditemukan.</p>}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
