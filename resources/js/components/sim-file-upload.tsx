import { FileText, FileUp, Image as ImageIcon, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { cn } from '@/lib/utils';

export function SimFileUpload({ value, onChange, accept = 'application/pdf', label = 'Pilih file PDF', maxSizeMb = 10 }: { value?: File | null; onChange: (file: File | null) => void; accept?: string; label?: string; maxSizeMb?: number }) {
    const id = useId();
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!value) {
            setPreviewUrl(null);
            return;
        }

        const url = URL.createObjectURL(value);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [value]);

    const isImage = value?.type.startsWith('image/');

    return <div className={cn('min-w-0 max-w-full overflow-hidden rounded-md border border-dashed border-input bg-muted/20 transition-colors hover:border-ring hover:bg-accent/40', value && 'border-primary/50 bg-primary/5')}>
        <label htmlFor={id} className="flex min-h-16 cursor-pointer items-center gap-3 px-3 py-2.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/30">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">{value ? (isImage ? <ImageIcon className="size-4" /> : <FileText className="size-4" />) : <FileUp className="size-4" />}</span>
            <span className="min-w-0 flex-1 text-sm">
                <span className="block truncate font-medium">{value?.name ?? label}</span>
                <span className="block truncate text-xs text-muted-foreground">{value ? `${formatBytes(value.size)} - siap diunggah` : `PDF, maksimal ${maxSizeMb} MB per file`}</span>
            </span>
            {value && <button type="button" aria-label="Hapus file" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={(event) => { event.preventDefault(); onChange(null); }}><X className="size-4" /></button>}
            <input id={id} type="file" accept={accept} className="sr-only" onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                if (file && file.size > maxSizeMb * 1024 * 1024) {
                    setError(`Ukuran file melebihi batas ${maxSizeMb} MB.`);
                    onChange(null);
                    event.currentTarget.value = '';
                    return;
                }
                setError(null);
                onChange(file);
            }} />
        </label>
        {value && previewUrl && <div className="border-t px-3 pb-3 pt-2">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Preview</div>
            {isImage ? <img src={previewUrl} alt={`Preview ${value.name}`} className="max-h-96 max-w-full rounded border object-contain" /> : <iframe title={`Preview ${value.name}`} src={previewUrl} className="block h-[min(65vh,34rem)] w-full rounded border bg-background" />}
        </div>}
        {error && <div className="px-3 pb-3 text-xs font-medium text-destructive">{error}</div>}
    </div>;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
