import { Head, useForm } from '@inertiajs/react';
import { Edit3, Plus, X } from 'lucide-react';
import { FormEvent, useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SimPageHeader } from '@/components/sim-page-header';
import { SimStatusBadge } from '@/components/sim-status-badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SimTable, SimTableHead, SimTableHeader, SimTableSortHeader, useSimTableSort } from '@/components/sim-table';

type JobType = { id: number; code: string; name: string; is_active: boolean; steps: { id: number; name: string; sort_order: number }[] };

export default function JobTypes({ jobTypes }: { jobTypes: JobType[] }) {
    const { data, setData, post, put, processing, reset, errors } = useForm({ code: '', name: '', steps: '', is_active: true });
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const { sortedRows, sort, toggleSort } = useSimTableSort(jobTypes, 'name');

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const options = { onSuccess: () => { reset(); setEditingId(null); setFormOpen(false); } };
        editingId ? put(`/job-types/${editingId}`, options) : post('/job-types', options);
    };
    const editJobType = (jobType: JobType) => { setEditingId(jobType.id); setData({ code: jobType.code, name: jobType.name, steps: jobType.steps.map((step) => step.name).join('\n'), is_active: jobType.is_active }); setFormOpen(true); };
    const openCreate = () => { reset(); setEditingId(null); setFormOpen(true); };
    const cancelEdit = () => { reset(); setEditingId(null); setFormOpen(false); };

    return (
        <>
            <Head title="Jenis Pekerjaan" />
            <div className="sim-workspace">
                <SimPageHeader title="Jenis pekerjaan" description="Kelola jenis pengikatan dan alur proses per jenis." actions={<Button type="button" onClick={openCreate}><Plus className="size-4" />Tambah jenis</Button>} />
                <SimTable minWidth="760px">
                            <SimTableHead><tr><SimTableSortHeader active={sort.key === 'code'} direction={sort.direction} onClick={() => toggleSort('code')}>Kode</SimTableSortHeader><SimTableSortHeader active={sort.key === 'name'} direction={sort.direction} onClick={() => toggleSort('name')}>Nama</SimTableSortHeader><SimTableSortHeader onClick={() => toggleSort('steps')}>Langkah</SimTableSortHeader><SimTableSortHeader active={sort.key === 'is_active'} direction={sort.direction} onClick={() => toggleSort('is_active')}>Status</SimTableSortHeader><SimTableHeader>Aksi</SimTableHeader></tr></SimTableHead>
                            <tbody>
                                {sortedRows.map((jobType) => (
                                    <tr key={jobType.id} className="border-t align-top">
                                        <td className="px-4 py-3 font-medium">{jobType.code}</td><td className="px-4 py-3">{jobType.name}</td><td className="px-4 py-3 text-muted-foreground">{jobType.steps.map((step) => step.name).join(' -> ') || '-'}</td><td className="px-4 py-3"><SimStatusBadge label={jobType.is_active ? 'Aktif' : 'Nonaktif'} tone={jobType.is_active ? 'success' : 'neutral'} /></td><td className="px-4 py-3"><Button type="button" variant="ghost" size="sm" onClick={() => editJobType(jobType)}><Edit3 className="size-4" />Edit</Button></td>
                                    </tr>
                                ))}
                            </tbody>
                </SimTable>
                <Dialog open={formOpen} onOpenChange={(open) => { if (!open) cancelEdit(); }}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{editingId ? 'Edit jenis pekerjaan' : 'Tambah jenis pekerjaan'}</DialogTitle><DialogDescription>Atur kode, nama, dan langkah proses untuk jenis pekerjaan ini.</DialogDescription></DialogHeader><form onSubmit={submit} className="grid gap-4">
                        <Field label="Kode" error={errors.code}><Input value={data.code} onChange={(e) => setData('code', e.target.value)} /></Field>
                        <Field label="Nama" error={errors.name}><Input value={data.name} onChange={(e) => setData('name', e.target.value)} /></Field>
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
