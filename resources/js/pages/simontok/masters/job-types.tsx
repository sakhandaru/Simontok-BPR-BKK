import { Head, router, useForm } from '@inertiajs/react';
import { Edit3, Plus, X } from 'lucide-react';
import { FormEvent, useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SimPageHeader } from '@/components/sim-page-header';
import { SimStatusBadge } from '@/components/sim-status-badge';
import { SimSelect } from '@/components/sim-select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SimTable, SimTableHead, SimTableHeader, SimTableSortHeader, useSimTableSort } from '@/components/sim-table';
import { SimPagination, type SimPaginationLink } from '@/components/sim-pagination';
import { SimTableToolbar } from '@/components/sim-table-toolbar';

type JobType = { id: number; code: string; name: string; is_active: boolean; sla_days?: number | null; steps: { id: number; name: string; sort_order: number }[] };

export default function JobTypes({ jobTypes, filters }: { jobTypes: { data: JobType[]; links: SimPaginationLink[] }; filters: { search: string; status: string } }) {
    const { data, setData, post, put, processing, reset, errors } = useForm({ code: '', name: '', steps: '', sla_days: '', is_active: true });
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const { sortedRows, sort, toggleSort } = useSimTableSort(jobTypes.data, 'name');
    const [search, setSearch] = useState(filters.search);
    const [status, setStatus] = useState(filters.status);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const options = { onSuccess: () => { reset(); setEditingId(null); setFormOpen(false); } };
        editingId ? put(`/job-types/${editingId}`, options) : post('/job-types', options);
    };
    const editJobType = (jobType: JobType) => { setEditingId(jobType.id); setData({ code: jobType.code, name: jobType.name, steps: jobType.steps.map((step) => step.name).join('\n'), sla_days: jobType.sla_days ? String(jobType.sla_days) : '', is_active: jobType.is_active }); setFormOpen(true); };
    const openCreate = () => { reset(); setEditingId(null); setFormOpen(true); };
    const cancelEdit = () => { reset(); setEditingId(null); setFormOpen(false); };

    return (
        <>
            <Head title="Jenis Pekerjaan" />
            <div className="sim-workspace">
                <SimPageHeader title="Jenis pekerjaan" description="Kelola jenis pengikatan dan alur proses per jenis." actions={<Button type="button" onClick={openCreate}><Plus className="size-4" />Tambah jenis</Button>} />
                <SimTableToolbar search={search} searchPlaceholder="Kode atau nama jenis pekerjaan" onSearchChange={setSearch} onSubmit={() => router.get('/job-types', { search, status }, { preserveState: true, replace: true })} onReset={() => { setSearch(''); setStatus(''); router.get('/job-types'); }}>
                    <SimSelect value={status} onChange={setStatus} options={[{ value: 'active', label: 'Aktif' }, { value: 'inactive', label: 'Nonaktif' }]} placeholder="Semua status" />
                </SimTableToolbar>
                <SimPagination links={jobTypes.links} />
                <div className="hidden md:block"><SimTable minWidth="760px">
                            <SimTableHead><tr><SimTableSortHeader active={sort.key === 'code'} direction={sort.direction} onClick={() => toggleSort('code')}>Kode</SimTableSortHeader><SimTableSortHeader active={sort.key === 'name'} direction={sort.direction} onClick={() => toggleSort('name')}>Nama</SimTableSortHeader><SimTableSortHeader onClick={() => toggleSort('sla_days')}>SLA default</SimTableSortHeader><SimTableSortHeader onClick={() => toggleSort('steps')}>Langkah</SimTableSortHeader><SimTableSortHeader active={sort.key === 'is_active'} direction={sort.direction} onClick={() => toggleSort('is_active')}>Status</SimTableSortHeader><SimTableHeader>Aksi</SimTableHeader></tr></SimTableHead>
                            <tbody>
                                {sortedRows.map((jobType) => (
                                    <tr key={jobType.id} className="border-t align-top">
                                        <td className="px-4 py-3 font-medium">{jobType.code}</td><td className="px-4 py-3">{jobType.name}</td><td className="px-4 py-3">{jobType.sla_days ? <span className="font-medium">{jobType.sla_days} hari</span> : <span className="text-muted-foreground">Belum diatur</span>}<div className="text-xs text-muted-foreground">Hari kalender</div></td><td className="px-4 py-3 text-muted-foreground">{jobType.steps.map((step) => step.name).join(' -> ') || '-'}</td><td className="px-4 py-3"><SimStatusBadge label={jobType.is_active ? 'Aktif' : 'Nonaktif'} tone={jobType.is_active ? 'success' : 'neutral'} /></td><td className="px-4 py-3"><Button type="button" variant="ghost" size="sm" onClick={() => editJobType(jobType)}><Edit3 className="size-4" />Edit</Button></td>
                                    </tr>
                                ))}
                            </tbody>
                </SimTable></div>
                <div className="space-y-3 md:hidden">
                    {sortedRows.map((jobType) => <article key={jobType.id} className="space-y-4 border border-border bg-card p-4">
                        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-lg font-medium leading-6">{jobType.name}</div><div className="mt-1 text-sm text-muted-foreground">{jobType.code}</div></div><SimStatusBadge label={jobType.is_active ? 'Aktif' : 'Nonaktif'} tone={jobType.is_active ? 'success' : 'neutral'} /></div>
                        <div className="grid grid-cols-2 gap-3 text-sm"><div><div className="text-xs text-muted-foreground">SLA default</div><div className="mt-1">{jobType.sla_days ? `${jobType.sla_days} hari kalender` : 'Belum diatur'}</div></div><div><div className="text-xs text-muted-foreground">Langkah proses</div><div className="mt-1 leading-5 text-muted-foreground">{jobType.steps.map((step) => step.name).join(' -> ') || 'Belum ada langkah'}</div></div></div>
                        <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => editJobType(jobType)}><Edit3 className="size-4" />Edit jenis pekerjaan</Button>
                    </article>)}
                </div>
                <Dialog open={formOpen} onOpenChange={(open) => { if (!open) cancelEdit(); }}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{editingId ? 'Edit jenis pekerjaan' : 'Tambah jenis pekerjaan'}</DialogTitle><DialogDescription>Atur kode, nama, dan langkah proses untuk jenis pekerjaan ini.</DialogDescription></DialogHeader><form onSubmit={submit} className="grid gap-4">
                        <Field label="Kode" error={errors.code}><Input value={data.code} onChange={(e) => setData('code', e.target.value)} /></Field>
                        <Field label="Nama" error={errors.name}><Input value={data.name} onChange={(e) => setData('name', e.target.value)} /></Field>
                        <Field label="SLA default (hari kalender)" error={errors.sla_days}><Input type="number" min="1" max="365" value={data.sla_days} onChange={(e) => setData('sla_days', e.target.value)} placeholder="Contoh: 30" /><p className="text-xs text-muted-foreground">Dipakai otomatis saat order dibuat. SLA khusus pada order tetap membutuhkan alasan.</p></Field>
                        <div className="grid gap-2">
                            <Label>Langkah proses</Label>
                            <textarea className="min-h-32 rounded-md border bg-background px-3 py-2 text-sm" value={data.steps} onChange={(e) => setData('steps', e.target.value)} placeholder="Satu langkah per baris" />
                        </div>
                        <DialogFooter><Button type="button" variant="outline" onClick={cancelEdit}><X className="size-4" />Batal</Button><Button type="submit" disabled={processing}>{editingId ? <Edit3 className="size-4" /> : <Plus className="size-4" />}{editingId ? 'Simpan perubahan' : 'Tambah jenis'}</Button></DialogFooter>
                    </form></DialogContent></Dialog>
            </div>
        </>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return <div className="grid gap-2"><Label>{label}</Label>{children}<InputError message={error} /></div>;
}

JobTypes.layout = { breadcrumbs: [{ title: 'Jenis Pekerjaan', href: '/job-types' }] };
