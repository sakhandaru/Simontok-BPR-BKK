import { Head, useForm } from '@inertiajs/react';
import { Edit3, MapPin, Plus, X } from 'lucide-react';
import { FormEvent, useState } from 'react';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SimPageHeader } from '@/components/sim-page-header';
import { SimStatusBadge } from '@/components/sim-status-badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SimTable, SimTableHead, SimTableHeader, SimTableSortHeader, useSimTableSort } from '@/components/sim-table';
import { SimPagination, type SimPaginationLink } from '@/components/sim-pagination';

type Branch = { id: number; code: string; name: string; address?: string | null; latitude?: string | null; longitude?: string | null; is_active: boolean };

export default function Branches({ branches }: { branches: { data: Branch[]; links: SimPaginationLink[] } }) {
    const { data, setData, post, put, processing, reset, errors } = useForm({ code: '', name: '', address: '', is_active: true });
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const { sortedRows, sort, toggleSort } = useSimTableSort(branches.data, 'name');

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const options = { onSuccess: () => { reset(); setEditingId(null); setFormOpen(false); } };
        editingId ? put(`/branches/${editingId}`, options) : post('/branches', options);
    };

    const editBranch = (branch: Branch) => { setEditingId(branch.id); setData({ code: branch.code, name: branch.name, address: branch.address ?? '', is_active: branch.is_active }); setFormOpen(true); };
    const openCreate = () => { reset(); setEditingId(null); setFormOpen(true); };
    const cancelEdit = () => { reset(); setEditingId(null); setFormOpen(false); };

    return (
        <>
            <Head title="Kantor Cabang" />
            <div className="sim-workspace">
                <SimPageHeader title="Kantor Cabang" description="Kelola kantor, alamat, dan lokasi layanan." actions={<Button type="button" onClick={openCreate}><Plus className="size-4" />Tambah kantor cabang</Button>} />
                <SimPagination links={branches.links} />
                <div className="hidden md:block"><SimTable minWidth="560px">
                <SimTableHead><tr><SimTableSortHeader active={sort.key === 'code'} direction={sort.direction} onClick={() => toggleSort('code')}>Kode</SimTableSortHeader><SimTableSortHeader active={sort.key === 'name'} direction={sort.direction} onClick={() => toggleSort('name')}>Nama</SimTableSortHeader><SimTableSortHeader active={sort.key === 'is_active'} direction={sort.direction} onClick={() => toggleSort('is_active')}>Status</SimTableSortHeader><SimTableHeader>Aksi</SimTableHeader></tr></SimTableHead><tbody>
                    {sortedRows.map((branch) => (
                        <tr key={branch.id} className="border-t">
                            <td className="px-4 py-3 font-medium">{branch.code}</td><td className="px-4 py-3"><div>{branch.name}</div><div className="mt-1 max-w-md text-xs text-muted-foreground">{branch.address ?? 'Alamat belum diisi'}</div></td><td className="px-4 py-3"><SimStatusBadge label={branch.is_active ? 'Aktif' : 'Nonaktif'} tone={branch.is_active ? 'success' : 'neutral'} /></td><td className="px-4 py-3"><Button type="button" variant="ghost" size="sm" onClick={() => editBranch(branch)}><Edit3 className="size-4" />Edit</Button></td>
                        </tr>
                    ))}
                </tbody></SimTable></div>
                <div className="space-y-3 md:hidden">
                    {sortedRows.map((branch) => <article key={branch.id} className="space-y-4 border border-border bg-card p-4">
                        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-lg font-medium leading-6">{branch.name}</div><div className="mt-1 text-sm text-muted-foreground">{branch.code}</div></div><SimStatusBadge label={branch.is_active ? 'Aktif' : 'Nonaktif'} tone={branch.is_active ? 'success' : 'neutral'} /></div>
                        <div className="text-sm"><div className="text-xs text-muted-foreground">Alamat</div><div className="mt-1 leading-5">{branch.address ?? 'Alamat belum diisi'}</div></div>
                        <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => editBranch(branch)}><Edit3 className="size-4" />Edit kantor cabang</Button>
                    </article>)}
                </div>
                <Dialog open={formOpen} onOpenChange={(open) => { if (!open) cancelEdit(); }}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{editingId ? 'Edit kantor cabang' : 'Tambah kantor cabang'}</DialogTitle><DialogDescription>Atur identitas dan alamat kantor cabang.</DialogDescription></DialogHeader><form onSubmit={submit} className="grid gap-4">
                        <div className="grid gap-2">
                            <Label>Kode</Label>
                            <Input value={data.code} onChange={(e) => setData('code', e.target.value)} />
                            <InputError message={errors.code} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Nama cabang</Label>
                            <Input value={data.name} onChange={(e) => setData('name', e.target.value)} />
                            <InputError message={errors.name} />
                        </div>
                        <div className="grid gap-2"><Label>Alamat <span className="font-normal text-muted-foreground">(opsional)</span></Label><textarea className="min-h-24 rounded-md border border-input bg-background px-4 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" value={data.address} onChange={(e) => setData('address', e.target.value)} placeholder="Alamat kantor cabang" /></div>
                        <DialogFooter><Button type="button" variant="outline" onClick={cancelEdit}><X className="size-4" />Batal</Button><Button type="submit" disabled={processing}>{editingId ? <Edit3 className="size-4" /> : <Plus className="size-4" />}{editingId ? 'Simpan perubahan' : 'Tambah cabang'}</Button></DialogFooter>
                    </form></DialogContent></Dialog>
            </div>
        </>
    );
}

Branches.layout = { breadcrumbs: [{ title: 'Kantor Cabang', href: '/branches' }] };
