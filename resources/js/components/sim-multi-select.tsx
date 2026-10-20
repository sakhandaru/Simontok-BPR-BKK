import { ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

type Option = { value: string; label: string };

export function SimMultiSelect({ value, onChange, options, placeholder = 'Pilih...' }: { value: string[]; onChange: (value: string[]) => void; options: Option[]; placeholder?: string }) {
    const selected = options.filter((option) => value.includes(option.value));
    const label = selected.length === 0 ? placeholder : selected.length === 1 ? selected[0].label : `${selected.length} cabang dipilih`;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-between font-normal">
                    <span className="truncate">{label}</span>
                    <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                {options.map((option) => (
                    <DropdownMenuCheckboxItem key={option.value} checked={value.includes(option.value)} onCheckedChange={(checked) => onChange(checked ? [...value, option.value] : value.filter((item) => item !== option.value))}>
                        {option.label}
                    </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
