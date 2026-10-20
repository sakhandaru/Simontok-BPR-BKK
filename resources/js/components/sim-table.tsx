import { Children, isValidElement, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useMemo, useState } from 'react';

type SimTableProps = {
    children: ReactNode;
    minWidth?: string;
    className?: string;
    mobileContent?: ReactNode;
    raw?: boolean;
};

export function useSimTableSort<T extends object>(rows: T[], initialKey: keyof T, initialDirection: 'asc' | 'desc' = 'asc') {
    const [sort, setSort] = useState<{ key: keyof T; direction: 'asc' | 'desc' }>({ key: initialKey, direction: initialDirection });
    const sortedRows = useMemo(() => [...rows].sort((left, right) => {
        const leftValue = String((left as Record<string, unknown>)[sort.key as string] ?? '').toLowerCase();
        const rightValue = String((right as Record<string, unknown>)[sort.key as string] ?? '').toLowerCase();
        return leftValue.localeCompare(rightValue, undefined, { numeric: true }) * (sort.direction === 'asc' ? 1 : -1);
    }), [rows, sort]);
    const toggleSort = (key: keyof T) => setSort((current) => current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' });
    return { sortedRows, sort, toggleSort };
}

export function SimTable({ children, minWidth = '720px', className = '', mobileContent, raw = false }: SimTableProps) {
    if (raw) return <div className={`sim-panel overflow-hidden ${className}`}><div className="overflow-x-auto">{children}</div></div>;
    const parts = Children.toArray(children);
    const header = parts.find((part) => isValidElement(part) && part.type === 'thead');
    const body = parts.find((part) => isValidElement(part) && part.type === 'tbody');
    const labels = header && isValidElement(header) ? extractHeaderLabels((header as any).props.children) : [];
    const rows = body && isValidElement(body) ? Children.toArray((body as any).props.children).filter(isValidElement) : [];
    const automaticCards = rows.map((row, rowIndex) => {
        const cells = Children.toArray((row as any).props.children).filter(isValidElement);
        return <article key={row.key ?? rowIndex} className="space-y-3 p-4">{cells.map((cell, cellIndex) => <div key={cell.key ?? cellIndex} className="grid gap-1"><div className="text-xs font-medium text-muted-foreground">{labels[cellIndex] ?? `Kolom ${cellIndex + 1}`}</div><div>{(cell as any).props.children}</div></div>)}</article>;
    });
    return (
        <div className={`sim-panel overflow-hidden ${className}`}>
            <div className={mobileContent ? 'hidden md:block' : 'block'}>
                <div className="overflow-x-auto">
                <table className="sim-table w-full text-sm" style={{ minWidth }}>
                    {children}
                </table>
                </div>
            </div>
            <div className="divide-y md:hidden">{mobileContent ?? automaticCards}</div>
        </div>
    );
}

function extractHeaderLabels(headerChildren: ReactNode): string[] {
    const row = Children.toArray(headerChildren).find((child) => isValidElement(child));
    if (!row || !isValidElement(row)) return [];
    return Children.toArray((row as any).props.children).map((cell) => {
        if (!isValidElement(cell)) return '';
        const content = Children.toArray((cell as any).props.children).filter((item) => typeof item === 'string' || typeof item === 'number');
        return content.join(' ');
    });
}

export function SimTableHead({ children }: { children: ReactNode }) {
    return <thead className="bg-muted/50 text-left text-muted-foreground">{children}</thead>;
}

export function SimTableHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
    return <th className={`px-4 py-3 font-medium ${className}`}>{children}</th>;
}

export function SimTableSortHeader({ children, active, direction, onClick, className = '' }: { children: ReactNode; active?: boolean; direction?: 'asc' | 'desc'; onClick: () => void; className?: string }) {
    return <th className={`px-4 py-3 font-medium ${className}`}><button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 text-left transition-colors hover:text-foreground" aria-label={`Urutkan berdasarkan ${String(children)}`}>
        {children}{active ? direction === 'asc' ? <ArrowUp className="size-4 shrink-0" /> : <ArrowDown className="size-4 shrink-0" /> : <ArrowUpDown className="size-4 shrink-0 opacity-45" />}
    </button></th>;
}
