import { Head, router, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Paginated } from '@/types';
import { SimSelect } from '@/components/sim-select';
import { SimTable } from '@/components/sim-table';

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

                <SimTable raw>
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
                                        <td className="px-4 py-3"><Badge variant="outline">{log.action}</Badge></td>
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
                </SimTable>
            </div>
        </>
    );
}

AuditIndex.layout = {
    breadcrumbs: [{ title: 'Audit Log', href: '/audit-logs' }],
};
