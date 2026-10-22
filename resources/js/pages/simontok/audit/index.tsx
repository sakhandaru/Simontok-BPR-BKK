import { Head, router, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    entity_id?: number | null;
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

    const submit = (event: FormEvent) => {
        event.preventDefault();
        router.get('/audit-logs', data, { preserveState: true, replace: true });
    };

    return (
        <>
            <Head title="Audit Log" />
            <div className="flex h-full flex-1 flex-col gap-5 p-4 md:p-6">
                <div>
                    <h1 className="text-2xl font-semibold">Audit Log</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Jejak aktivitas append-only untuk pemeriksaan internal.</p>
                </div>

                <form onSubmit={submit} className="grid gap-3 rounded-lg border p-3 xl:grid-cols-[1fr_180px_180px_160px_160px_auto]">
                    <Input value={data.search} onChange={(event) => setData('search', event.target.value)} placeholder="Cari pelaku, deskripsi, entitas" />
                    <SimSelect value={data.module} onChange={(value) => setData('module', value)} options={modules.map((module) => ({ value: module, label: module }))} placeholder="Semua modul" />
                    <SimSelect value={data.action} onChange={(value) => setData('action', value)} options={actions.map((action) => ({ value: action, label: action }))} placeholder="Semua aksi" />
                    <Input type="date" value={data.date_from} onChange={(event) => setData('date_from', event.target.value)} />
                    <Input type="date" value={data.date_to} onChange={(event) => setData('date_to', event.target.value)} />
                    <div className="flex gap-2">
                        <Button type="submit">Filter</Button>
                        <Button type="button" variant="outline" onClick={() => router.get('/audit-logs')}>Reset</Button>
                    </div>
                </form>

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
                                        <td className="px-4 py-3">{log.entity_type ?? '-'} {log.entity_id ?? ''}</td>
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
                            <div className="grid gap-3 border-t border-border px-4 py-3 text-sm"><div><div className="text-xs text-muted-foreground">Objek</div><div className="mt-1">{entityLabel(log.entity_type)} {String(log.entity_id ?? '')}</div></div><div><div className="text-xs text-muted-foreground">Permintaan</div><div className="mt-1">{log.method ?? '-'} {log.route ?? '-'}</div></div><div><div className="text-xs text-muted-foreground">Alamat IP</div><div className="mt-1">{log.ip_address ?? '-'}</div></div>{Boolean(log.payload) && <pre className="max-h-48 overflow-auto border border-border bg-muted/20 p-3 text-xs whitespace-pre-wrap">{String(JSON.stringify(log.payload, null, 2))}</pre>}</div>
                        </details>
                    ))}
                </div>
            </div>
        </>
    );
}

function actionLabel(action: string): string {
    const labels: Record<string, string> = { create: 'Dibuat', update: 'Diperbarui', send: 'Dikirim ke notaris', submit_approval: 'Diajukan untuk persetujuan', approve_and_send: 'Disetujui dan dikirim', return_revision: 'Dikembalikan untuk perbaikan', cancel: 'Dibatalkan', close: 'Ditutup', upload: 'Dokumen diunggah', upload_final: 'Dokumen final diunggah', validate_final: 'Dokumen final divalidasi', request_invoice: 'Invoice diajukan', verify_invoice: 'Invoice diverifikasi', reject_invoice_admin: 'Invoice dikembalikan', mark_read: 'Ditandai sudah dibaca', mark_all_read: 'Semua notifikasi dibaca' };
    return labels[action] ?? action.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function moduleLabel(module?: string | null): string { return module ? module.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Aktivitas sistem'; }
function actorLabel(actorType: string): string { return ({ user: 'Pengguna', notary: 'Notaris', system: 'Sistem' } as Record<string, string>)[actorType] ?? actorType; }
function entityLabel(entityType?: string | null): string { return entityType ? entityType.split('\\').pop()?.replaceAll('_', ' ') ?? entityType : 'Tidak ada objek'; }

AuditIndex.layout = {
    breadcrumbs: [{ title: 'Audit Log', href: '/audit-logs' }],
};
