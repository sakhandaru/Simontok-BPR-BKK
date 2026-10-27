import { Head, router, useForm } from '@inertiajs/react';
import { RotateCcw, Search } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { SimPageHeader } from '@/components/sim-page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Paginated } from '@/types';
import { SimSelect } from '@/components/sim-select';
import { SimTable } from '@/components/sim-table';
import { SimStatusBadge, toneForStatus } from '@/components/sim-status-badge';

type AuditItem = {
    id: number;
    actor_name?: string | null;
    actor_type: string;
    module?: string | null;
    action: string;
    description?: string | null;
    entity_type?: string | null;
    entity_type_label: string;
    entity_id?: number | null;
    entity_name?: string | null;
    route?: string | null;
    method?: string | null;
    ip_address?: string | null;
    created_at: string;
    payload?: unknown;
};

export default function AuditIndex({
    filters,
    modules,
    actions,
    logs,
}: {
    filters: { search: string; module: string; action: string; date_from: string; date_to: string };
    modules: string[];
    actions: string[];
    logs: Paginated<AuditItem>;
}) {
    const { data, setData } = useForm(filters);
    const filterInitialized = useRef(false);
    const skipNextFilterRequest = useRef(false);
    const resetFilters = () => {
        const emptyFilters = { search: '', module: '', action: '', date_from: '', date_to: '' };
        skipNextFilterRequest.current = true;
        setData(emptyFilters);
        router.get('/audit-logs', emptyFilters, { preserveState: true, preserveScroll: true, replace: true });
    };
    useEffect(() => {
        if (!filterInitialized.current) {
            filterInitialized.current = true;
            return;
        }
        if (skipNextFilterRequest.current) {
            skipNextFilterRequest.current = false;
            return;
        }
        const timeout = window.setTimeout(() => {
            router.get('/audit-logs', data, { preserveState: true, preserveScroll: true, replace: true });
        }, 300);
        return () => window.clearTimeout(timeout);
    }, [data.search, data.module, data.action, data.date_from, data.date_to]);

    return (
        <>
            <Head title="Audit Log" />
            <div className="sim-workspace">
                <SimPageHeader title="Audit Log" description="Jejak aktivitas append-only untuk pemeriksaan internal." />
                <div className="sim-panel grid gap-3 p-4 md:grid-cols-[minmax(220px,1.4fr)_repeat(4,minmax(140px,1fr))_auto] md:items-end">
                    <div className="grid gap-2"><Label htmlFor="audit-search">Cari aktivitas</Label><div className="relative"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="audit-search" className="pl-9" value={data.search} onChange={(event) => setData('search', event.target.value)} placeholder="Pelaku, deskripsi, entitas" /></div></div>
                    <FilterSelect label="Modul" value={data.module} onChange={(value) => setData('module', value)} options={modules.map((module) => ({ value: module, label: module }))} placeholder="Semua modul" />
                    <FilterSelect label="Aksi" value={data.action} onChange={(value) => setData('action', value)} options={actions.map((action) => ({ value: action, label: action }))} placeholder="Semua aksi" />
                    <DateFilter label="Dari tanggal" value={data.date_from} onChange={(value) => setData('date_from', value)} />
                    <DateFilter label="Sampai tanggal" value={data.date_to} onChange={(value) => setData('date_to', value)} />
                    <Button type="button" variant="outline" onClick={resetFilters}><RotateCcw className="size-4" />Reset</Button>
                </div>

                <div className="hidden md:block"><SimTable raw>
                        <table className="sim-table w-full min-w-[1040px] text-sm">
                            <thead className="bg-muted/50 text-left text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Waktu</th>
                                    <th className="px-4 py-3 font-medium">Pelaku</th>
                                    <th className="px-4 py-3 font-medium">Modul</th>
                                    <th className="px-4 py-3 font-medium">Aksi</th>
                                    <th className="px-4 py-3 font-medium">Deskripsi</th>
                                    <th className="px-4 py-3 font-medium">Entitas</th>
                                    <th className="px-4 py-3 font-medium">IP</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.data.length === 0 ? (
                                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Tidak ada audit log.</td></tr>
                                ) : logs.data.map((log) => (
                                    <tr key={log.id} className="border-t align-top">
                                        <td className="px-4 py-3 text-muted-foreground">{log.created_at}</td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium">{log.actor_name ?? '-'}</div>
                                            <div className="text-muted-foreground">{log.actor_type}</div>
                                        </td>
                                        <td className="px-4 py-3">{log.module ?? '-'}</td>
                                        <td className="px-4 py-3"><SimStatusBadge label={actionLabel(log.action)} tone={toneForStatus(log.action)} /></td>
                                        <td className="max-w-[320px] px-4 py-3">
                                            <div>{log.description ?? '-'}</div>
                                            <div className="mt-1 text-muted-foreground">{log.method ?? ''} {log.route ?? ''}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium">{log.entity_name ?? 'Objek tidak tersedia'}</div>
                                            <div className="text-xs text-muted-foreground">{log.entity_type_label}{log.entity_id ? ` · #${log.entity_id}` : ''}</div>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">{log.ip_address ?? '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                </SimTable></div>
                <div className="space-y-3 md:hidden">
                    {logs.data.length === 0 ? (
                        <div className="border border-border px-4 py-8 text-center text-sm text-muted-foreground">Tidak ada audit log.</div>
                    ) : logs.data.map((log) => (
                        <details key={log.id} className="group border border-border bg-card">
                            <summary className="list-none cursor-pointer space-y-3 p-4 [&::-webkit-details-marker]:hidden">
                                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="font-medium leading-5">{log.description || actionLabel(log.action)}</div><div className="mt-1 text-xs text-muted-foreground">{log.actor_name ?? 'Sistem'} · {actorLabel(log.actor_type)}</div></div><SimStatusBadge label={actionLabel(log.action)} tone={toneForStatus(log.action)} /></div>
                                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>{moduleLabel(log.module)}</span><span>{log.created_at}</span></div>
                            </summary>
                            <div className="grid gap-3 border-t border-border px-4 py-3 text-sm"><div><div className="text-xs text-muted-foreground">Objek</div><div className="mt-1 font-medium">{log.entity_name ?? 'Objek tidak tersedia'}</div><div className="text-xs text-muted-foreground">{log.entity_type_label}{log.entity_id ? ` · #${log.entity_id}` : ''}</div></div><div><div className="text-xs text-muted-foreground">Permintaan</div><div className="mt-1">{log.method ?? '-'} {log.route ?? '-'}</div></div><div><div className="text-xs text-muted-foreground">Alamat IP</div><div className="mt-1">{log.ip_address ?? '-'}</div></div>{Boolean(log.payload) && <pre className="max-h-48 overflow-auto border border-border bg-muted/20 p-3 text-xs whitespace-pre-wrap">{String(JSON.stringify(log.payload, null, 2))}</pre>}</div>
                        </details>
                    ))}
                </div>
            </div>
        </>
    );
}

function FilterSelect({ label, value, onChange, options, placeholder = 'Pilih...' }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; placeholder?: string }) {
    return <div className="min-w-0 grid gap-2"><Label>{label}</Label><SimSelect value={value} onChange={onChange} placeholder={placeholder} options={options} /></div>;
}

function DateFilter({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
    return <div className="grid gap-2"><Label>{label}</Label><Input type="date" value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

function actionLabel(action: string): string {
    const labels: Record<string, string> = { create: 'Dibuat', update: 'Diperbarui', send: 'Dikirim ke notaris', submit_approval: 'Diajukan untuk persetujuan', approve_and_send: 'Disetujui dan dikirim', return_revision: 'Dikembalikan untuk perbaikan', cancel: 'Dibatalkan', close: 'Ditutup', upload: 'Dokumen diunggah', upload_final: 'Dokumen final diunggah', validate_final: 'Dokumen final divalidasi', request_invoice: 'Invoice diajukan', verify_invoice: 'Invoice diverifikasi', reject_invoice_admin: 'Invoice dikembalikan', mark_read: 'Ditandai sudah dibaca', mark_all_read: 'Semua notifikasi dibaca' };
    return labels[action] ?? action.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function moduleLabel(module?: string | null): string { return module ? module.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Aktivitas sistem'; }
function actorLabel(actorType: string): string { return ({ user: 'Pengguna', notary: 'Notaris', system: 'Sistem' } as Record<string, string>)[actorType] ?? actorType; }
AuditIndex.layout = {
    breadcrumbs: [{ title: 'Audit Log', href: '/audit-logs' }],
};
