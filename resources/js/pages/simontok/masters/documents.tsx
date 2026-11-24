import { Head, router, useForm } from '@inertiajs/react';
import { Edit3, FileText, Plus, X } from 'lucide-react';
import { FormEvent, useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SimPageHeader } from '@/components/sim-page-header';
import { SimStatusBadge } from '@/components/sim-status-badge';
import { SimSelect } from '@/components/sim-select';
import { SimPagination, type SimPaginationLink } from '@/components/sim-pagination';
import { SimTable, SimTableHead, SimTableHeader } from '@/components/sim-table';
import { SimTableToolbar } from '@/components/sim-table-toolbar';

type DocumentMaster = { id: number; name: string; is_active: boolean };

export default function Documents({ documents, filters }: { documents: { data: DocumentMaster[]; links: SimPaginationLink[] }; filters: { search: string; status: string } }) {
    const form = useForm({ name: '', is_active: true });
    const [editing, setEditing] = useState<DocumentMaster | null>(null);
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(filters.search);
    const [status, setStatus] = useState(filters.status);
    const submit = (event: FormEvent) => { event.preventDefault(); const options = { onSuccess: () => { form.reset(); setEditing(null); setOpen(false); } }; editing ? form.put(`/document-masters/${editing.id}`, options) : form.post('/document-masters', options); };
    const edit = (document: DocumentMaster) => { setEditing(document); form.setData({ name: document.name, is_active: document.is_active }); setOpen(true); };
    const resetForm = () => { form.reset(); setEditing(null); setOpen(false); };
    const refresh = () => router.get('/document-masters', { search, status }, { preserveState: true, replace: true });
    return <><Head title="Master Dokumen" /><div className="sim-workspace">
        <SimPageHeader title="Master dokumen" description="Tentukan pilihan dokumen yang tersedia saat Admin Legal melengkapi order." actions={<Button type="button" onClick={() => { form.reset(); setEditing(null); setOpen(true); }}><Plus className="size-4" />Tambah dokumen</Button>} />
        <div className="border border-border bg-muted/20 p-4 text-sm text-muted-foreground"><span className="font-medium text-foreground">Catatan:</span> dokumen aktif akan tampil sebagai kartu pilihan di setiap order. Aktif tidak berarti wajib diisi.</div>
        <SimTableToolbar search={search} searchPlaceholder="Cari nama dokumen" onSearchChange={setSearch} onSubmit={refresh} onReset={() => { setSearch(''); setStatus(''); router.get('/document-masters'); }}><SimSelect value={status} onChange={setStatus} options={[{ value: 'active', label: 'Aktif' }, { value: 'inactive', label: 'Nonaktif' }]} placeholder="Semua status" /></SimTableToolbar>
        <SimPagination links={documents.links} />
        <div className="hidden md:block"><SimTable minWidth="620px"><SimTableHead><tr><SimTableHeader>Dokumen</SimTableHeader><SimTableHeader>Status pilihan</SimTableHeader><SimTableHeader>Aksi</SimTableHeader></tr></SimTableHead><tbody>{documents.data.map((document) => <tr key={document.id} className="border-t"><td className="px-4 py-3"><div className="flex items-center gap-3"><FileText className="size-4 text-muted-foreground" /><span className="font-medium">{document.name}</span></div></td><td className="px-4 py-3"><SimStatusBadge label={document.is_active ? 'Tampil di order' : 'Disembunyikan'} tone={document.is_active ? 'success' : 'neutral'} /></td><td className="px-4 py-3"><Button type="button" variant="ghost" size="sm" onClick={() => edit(document)}><Edit3 className="size-4" />Edit</Button></td></tr>)}</tbody></SimTable></div>
        <div className="space-y-3 md:hidden">{documents.data.map((document) => <article key={document.id} className="space-y-3 border border-border bg-card p-4"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><FileText className="size-4 text-muted-foreground" /><span className="font-medium">{document.name}</span></div><SimStatusBadge label={document.is_active ? 'Aktif' : 'Nonaktif'} tone={document.is_active ? 'success' : 'neutral'} /></div><Button type="button" variant="outline" size="sm" className="w-full" onClick={() => edit(document)}><Edit3 className="size-4" />Edit dokumen</Button></article>)}</div>
        <Dialog open={open} onOpenChange={(value) => { if (!value) resetForm(); }}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{editing ? 'Edit master dokumen' : 'Tambah master dokumen'}</DialogTitle><DialogDescription>Nama ini akan muncul sebagai kartu pilihan upload di order.</DialogDescription></DialogHeader><form onSubmit={submit} className="grid gap-4"><div className="grid gap-2"><Label>Nama dokumen</Label><Input autoFocus value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} placeholder="Contoh: NPWP" /><InputError message={form.errors.name} /></div>{editing && <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={form.data.is_active} onChange={(event) => form.setData('is_active', event.target.checked)} />Tampilkan sebagai pilihan upload</label>}<DialogFooter><Button type="button" variant="outline" onClick={resetForm}><X className="size-4" />Batal</Button><Button type="submit" disabled={form.processing}>{editing ? <Edit3 className="size-4" /> : <Plus className="size-4" />}{editing ? 'Simpan perubahan' : 'Tambah dokumen'}</Button></DialogFooter></form></DialogContent></Dialog>
    </div></>;
}

Documents.layout = { breadcrumbs: [{ title: 'Master Dokumen', href: '/document-masters' }] };
