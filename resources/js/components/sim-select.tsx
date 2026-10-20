import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type SimSelectOption = { value: string; label: string };

export function SimSelect({ value, onChange, options, placeholder = 'Pilih...' }: { value: string; onChange: (value: string) => void; options: SimSelectOption[]; placeholder?: string }) {
    return <Select value={value || undefined} onValueChange={(next) => onChange(next === '__empty__' ? '' : next)}>
        <SelectTrigger className="w-full bg-background !pr-5">
            <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
            <SelectItem value="__empty__">{placeholder}</SelectItem>
            {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
    </Select>;
}
