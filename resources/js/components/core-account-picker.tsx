import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type CoreAccount = {
    account_id: string;
    account_number: string;
    customer_id: string;
    customer_name: string;
    customer_marital_status?: string | null;
    customer?: { customer_id: string; name: string; marital_status?: string | null };
    credit: { loan_amount: number | string | null };
    branch: { code: string; name: string };
    collaterals: { collateral_id: string; type_name: string; description: string | null }[];
};
type Candidate = Omit<CoreAccount, 'collaterals'> & { collateral_count?: number };

export function CoreAccountPicker({ selected, initialQuery = '', disabled = false, canReplace = true, isDummy, error, onSelect }: {
    selected: { customer_name: string; account_number: string } | null;
    initialQuery?: string;
    disabled?: boolean;
    canReplace?: boolean;
    isDummy: boolean;
    error?: string;
    onSelect: (account: CoreAccount) => void;
}) {
    const id = useId();
    const [query, setQuery] = useState(initialQuery);
    const [editing, setEditing] = useState(!selected);
    const [results, setResults] = useState<Candidate[]>([]);
    const [loading, setLoading] = useState(false);
    const [choosing, setChoosing] = useState(false);
    const [searched, setSearched] = useState(false);
    const [message, setMessage] = useState('');
    const [active, setActive] = useState(-1);
    const [retry, setRetry] = useState(0);
    const detailRequest = useRef<AbortController | null>(null);
    useEffect(() => () => detailRequest.current?.abort(), []);

    useEffect(() => {
        const controller = new AbortController();
        const value = query.trim();
        setResults([]);
        setActive(-1);
        setSearched(false);
        setMessage('');
        if (!editing || value.length < 3) {
            setLoading(false);
            return;
        }
        setLoading(true);
        const timer = window.setTimeout(async () => {
            try {
                const response = await fetch(`/core/accounts?query=${encodeURIComponent(value)}`, {
                    signal: controller.signal,
                    headers: { Accept: 'application/json' },
                });
                if (!response.ok) throw new Error('Pencarian gagal. Coba lagi.');
                const payload = await response.json() as { data: Candidate[] };
                if (!controller.signal.aborted) {
                    setResults(payload.data);
                    setSearched(true);
                }
            } catch {
                if (!controller.signal.aborted) setMessage('Data rekening belum dapat dimuat. Coba lagi.');
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }, 300);
        return () => { window.clearTimeout(timer); controller.abort(); };
    }, [query, editing, retry]);

    const choose = async (candidate: Candidate) => {
        if (choosing || disabled) return;
        detailRequest.current?.abort();
        const controller = new AbortController();
        detailRequest.current = controller;
        setChoosing(true);
        setMessage('');
        try {
            const response = await fetch(`/core/accounts/${encodeURIComponent(candidate.account_id)}?account_number=${encodeURIComponent(candidate.account_number)}`, {
                signal: controller.signal,
                headers: { Accept: 'application/json' },
            });
            if (!response.ok) throw new Error('Detail rekening gagal dimuat.');
            const payload = await response.json() as { data: CoreAccount };
            if (controller.signal.aborted) return;
            onSelect(payload.data);
            setEditing(false);
        } catch (error) {
            if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Detail rekening gagal dimuat. Coba lagi.');
        } finally {
            if (!controller.signal.aborted) setChoosing(false);
        }
    };

    return <div className="border-b p-4">
        <Label htmlFor={id}>Cari nasabah atau rekening</Label>
        <p id={`${id}-hint`} className="mt-1 text-sm text-muted-foreground">
            Ketik minimal 3 karakter, lalu pilih rekening yang sesuai. {isDummy && 'Data simulasi UAT.'}
        </p>
        {!editing && selected ? <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
            <div className="min-w-0 text-sm"><span className="font-medium">{selected.customer_name}</span><span className="ml-2 break-all text-muted-foreground">{selected.account_number}</span></div>
            {canReplace && <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => { setQuery(''); setEditing(true); }}>Ganti rekening</Button>}
        </div> : <div className="mt-3">
            <Input id={id} role="combobox" autoComplete="off" value={query} placeholder="Contoh: Budi atau 001234567890"
                aria-autocomplete="list" aria-expanded={results.length > 0} aria-controls={`${id}-results`}
                aria-describedby={`${id}-hint`} aria-activedescendant={active >= 0 ? `${id}-result-${active}` : undefined}
                disabled={disabled || choosing}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault();
                        setActive((index) => Math.max(0, Math.min(results.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
                    } else if (event.key === 'Enter') {
                        event.preventDefault();
                        if (results[active]) void choose(results[active]);
                    } else if (event.key === 'Escape') {
                        setResults([]);
                        setActive(-1);
                        if (selected) setEditing(false);
                    }
                }} />
            <div aria-live="polite" className="mt-2 text-sm text-muted-foreground">
                {loading ? 'Mencari rekening...' : choosing ? 'Mengambil data rekening dan agunan...' : searched && results.length === 0 && !message ? 'Rekening tidak ditemukan. Periksa nama atau nomor rekening.' : ''}
            </div>
            {results.length > 0 && <div id={`${id}-results`} role="listbox" aria-label="Hasil pencarian rekening" className="mt-2 max-h-64 overflow-y-auto rounded-md border">
                {results.map((result, index) => <button id={`${id}-result-${index}`} key={result.account_id} type="button" role="option" aria-selected={active === index}
                    disabled={disabled || choosing} onClick={() => void choose(result)}
                    className={`block min-h-12 w-full border-b p-3 text-left text-sm last:border-b-0 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 ${active === index ? 'bg-muted' : ''}`}>
                    <span className="font-medium">{result.customer_name}</span><span className="ml-2 break-all">{result.account_number}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{result.branch.code} - {result.branch.name}{typeof result.collateral_count === 'number' ? ` · ${result.collateral_count} agunan` : ''}</span>
                </button>)}
            </div>}
            {selected && <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setEditing(false)} disabled={choosing}>Batal ganti rekening</Button>}
        </div>}
        {(message || error) && <p role="alert" className="mt-2 text-sm text-destructive">{message || error}</p>}
        {message && editing && <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setRetry((value) => value + 1)}>Coba lagi</Button>}
    </div>;
}
