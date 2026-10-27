import { Input } from '@/components/ui/input';
import type { ComponentProps } from 'react';

type RupiahInputProps = Omit<ComponentProps<typeof Input>, 'type' | 'value' | 'onChange'> & {
    value: string | number | null | undefined;
    onChange: (value: string) => void;
};

export function formatRupiahInput(value: string | number | null | undefined): string {
    const rawValue = String(value ?? '').trim();
    const databaseDecimal = /^\d+\.\d+$/.test(rawValue)
        ? rawValue.split('.')[0]
        : rawValue;
    const digits = databaseDecimal.replace(/\D/g, '');
    return digits ? new Intl.NumberFormat('id-ID').format(Number(digits)) : '';
}

export function RupiahInput({ value, onChange, ...props }: RupiahInputProps) {
    return <Input {...props} type="text" inputMode="numeric" value={formatRupiahInput(value)} onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))} />;
}
