import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { useRef, useState } from 'react';

type SimCreatableComboboxProps = {
    value: string;
    options: string[];
    onChange: (value: string) => void;
    placeholder: string;
    addLabel?: (value: string) => string;
    emptyLabel?: string;
    id?: string;
    onAdd?: (value: string) => Promise<void>;
};

export function SimCreatableCombobox({
    value,
    options,
    onChange,
    placeholder,
    addLabel = (option) => `Tambahkan “${option}”`,
    emptyLabel = 'Belum ada pilihan.',
    id,
    onAdd,
}: SimCreatableComboboxProps) {
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [adding, setAdding] = useState(false);
    const [addError, setAddError] = useState('');
    const [addedOptions, setAddedOptions] = useState<string[]>([]);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const listboxId = `${id ?? 'sim-combobox'}-options`;
    const allOptions = [...new Set([...options, ...addedOptions])];
    const filteredOptions = allOptions.filter((option) =>
        option.toLowerCase().includes(value.trim().toLowerCase()),
    );
    const newValue = value.trim();
    const canAdd = Boolean(newValue) && !allOptions.some((option) => option.toLowerCase() === newValue.toLowerCase());

    const openList = () => {
        if (closeTimer.current) clearTimeout(closeTimer.current);
        setOpen(true);
        setActiveIndex(filteredOptions.length ? 0 : -1);
    };

    const closeLater = () => {
        closeTimer.current = setTimeout(() => {
            setOpen(false);
            setActiveIndex(-1);
        }, 120);
    };

    const choose = (option: string) => {
        if (closeTimer.current) clearTimeout(closeTimer.current);
        onChange(option);
        setOpen(false);
        setActiveIndex(-1);
    };

    const addOption = async (option: string) => {
        if (!option || adding) return;
        setAddError('');
        setAdding(true);
        try {
            await onAdd?.(option);
            setAddedOptions((current) => current.some((item) => item.toLowerCase() === option.toLowerCase()) ? current : [...current, option]);
            choose(option);
        } catch {
            setAddError('Gagal menyimpan pilihan. Coba lagi.');
        } finally {
            setAdding(false);
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) {
                openList();
                return;
            }
            setActiveIndex((current) => {
                const next = event.key === 'ArrowDown' ? current + 1 : current - 1;
                return Math.max(0, Math.min(filteredOptions.length - 1, next));
            });
        }
        if (event.key === 'Enter' && open && activeIndex >= 0) {
            event.preventDefault();
            choose(filteredOptions[activeIndex]);
        } else if (event.key === 'Enter' && open && canAdd) {
            event.preventDefault();
            void addOption(newValue);
        }
        if (event.key === 'Escape') {
            setOpen(false);
            setActiveIndex(-1);
        }
    };

    return (
        <div className="relative">
            <div className={`flex h-10 w-full items-center rounded-md border bg-background px-3 ring-offset-background transition-colors ${open ? 'border-ring ring-2 ring-ring/30' : 'border-input'}`}>
                <input
                    id={id}
                    value={value}
                    role="combobox"
                    aria-autocomplete="list"
                    aria-controls={listboxId}
                    aria-expanded={open}
                    aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
                    onChange={(event) => { onChange(event.target.value); openList(); }}
                    onFocus={openList}
                    onBlur={closeLater}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <button
                    type="button"
                    tabIndex={-1}
                    aria-label={open ? 'Tutup pilihan' : 'Buka pilihan'}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => open ? setOpen(false) : openList()}
                    className="ml-2 inline-flex min-h-8 min-w-8 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </button>
            </div>
            {open && (
                <div id={listboxId} role="listbox" className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
                    {filteredOptions.map((option, index) => (
                        <button
                            key={option}
                            id={`${listboxId}-${index}`}
                            type="button"
                            role="option"
                            aria-selected={option === value}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => choose(option)}
                            className={`flex min-h-10 w-full items-center rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground ${index === activeIndex ? 'bg-accent text-accent-foreground' : ''}`}
                        >
                            {option}
                        </button>
                    ))}
                    {canAdd && (
                        <button
                            type="button"
                            role="option"
                            aria-selected="false"
                            disabled={adding}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => void addOption(newValue)}
                            className="flex min-h-10 w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:cursor-wait disabled:opacity-60"
                        >
                            <Plus className="size-4 shrink-0" />
                            {adding ? 'Menyimpan…' : addLabel(newValue)}
                        </button>
                    )}
                    {!filteredOptions.length && !canAdd && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">{emptyLabel}</div>
                    )}
                    {addError && <div role="alert" className="px-3 py-2 text-sm text-destructive">{addError}</div>}
                </div>
            )}
        </div>
    );
}
