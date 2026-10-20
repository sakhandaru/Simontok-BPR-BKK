import { Head, useForm } from '@inertiajs/react';
import { Edit3, FormInput, X } from 'lucide-react';
import { FormEvent, useState } from 'react';
import InputError from '@/components/input-error';
import { SimPageHeader } from '@/components/sim-page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SimTable, SimTableHead, SimTableHeader, SimTableSortHeader, useSimTableSort } from '@/components/sim-table';

type Permission = { id: number; code: string; name: string; module: string };
type Role = { id: number; code: string; name: string; description?: string; permissions: Permission[] };
export default function Roles({ roles, permissions }: { roles: Role[]; permissions: Permission[] }) {
    const { data, setData, post, put, processing, reset, errors } = useForm<{ code: string; name: string; description: string; permissions: number[] }>({ code: '', name: '', description: '', permissions: [] });
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const { sortedRows, sort, toggleSort } = useSimTableSort(roles, 'name');
    const submit = (event: FormEvent) => { event.preventDefault(); const options = { onSuccess: () => { reset(); setEditingId(null); setFormOpen(false); } }; editingId ? put(`/roles/${editingId}`, options) : post('/roles', options); };
    const editRole = (role: Role) => { setEditingId(role.id); setData({ code: role.code, name: role.name, description: role.description ?? '', permissions: role.permissions.map(permission => permission.id) }); setFormOpen(true); };
    const openCreate = () => { reset(); setEditingId(null); setFormOpen(true); };
    const cancelEdit = () => { reset(); setEditingId(null); setFormOpen(false); };
    const toggle = (id: number) => setData('permissions', data.permissions.includes(id) ? data.permissions.filter(item => item !== id) : [...data.permissions, id]);
    return <><Head title="Manajemen Role" /><div className="sim-workspace"><SimPageHeader title="Manajemen Role" description="Tentukan kelompok akses berdasarkan kebutuhan kerja." actions={<Button type="button" onClick={openCreate}><FormInput className="size-4" />Tambah role</Button>} /><SimTable minWidth="760px"><SimTableHead><tr><SimTableSortHeader active={sort.key === 'name'} direction={sort.direction} onClick={() => toggleSort('name')}>Role</SimTableSortHeader><SimTableSortHeader active={sort.key === 'description'} direction={sort.direction} onClick={() => toggleSort('description')}>Deskripsi</SimTableSortHeader><SimTableSortHeader onClick={() => toggleSort('permissions')}>Permission</SimTableSortHeader><SimTableHeader>Aksi</SimTableHeader></tr></SimTableHead><tbody>{sortedRows.map(role => <tr key={role.id} className="border-t align-top"><td className="px-4 py-3"><div className="font-medium">{role.name}</div><div className="text-xs text-muted-foreground">{role.code}</div></td><td className="px-4 py-3 text-muted-foreground">{role.description || '-'}</td><td className="px-4 py-3"><div className="flex flex-wrap gap-1">{role.permissions.map(permission => <span key={permission.id} className="rounded border px-2 py-1 text-xs">{permission.code}</span>)}</div></td><td className="px-4 py-3"><Button type="button" variant="ghost" size="sm" onClick={() => editRole(role)}><Edit3 className="size-4" />Edit</Button></td></tr>)}</tbody></SimTable>
        <Dialog open={formOpen} onOpenChange={(open) => { if (!open) cancelEdit(); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{editingId ? 'Edit role' : 'Tambah role'}</DialogTitle><DialogDescription>Atur identitas role dan permission yang dapat digunakan.</DialogDescription></DialogHeader><form onSubmit={submit} className="grid gap-4"><Field label="Kode" error={errors.code}><Input placeholder="contoh: supervisor" value={data.code} onChange={e => setData('code', e.target.value)} /></Field><Field label="Nama role" error={errors.name}><Input value={data.name} onChange={e => setData('name', e.target.value)} /></Field><Field label="Deskripsi" error={errors.description}><Input value={data.description} onChange={e => setData('description', e.target.value)} /></Field><div className="grid gap-2"><Label>Permission</Label><div className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-3">{permissions.map(permission => <label key={permission.id} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={data.permissions.includes(permission.id)} onChange={() => toggle(permission.id)} className="mt-0.5" /><span><span className="block">{permission.name}</span><span className="text-xs text-muted-foreground">{permission.code}</span></span></label>)}</div><InputError message={errors.permissions} /></div><DialogFooter><Button type="button" variant="outline" onClick={cancelEdit}><X className="size-4" />Batal</Button><Button type="submit" disabled={processing}><FormInput className="size-4" />{editingId ? 'Simpan perubahan' : 'Tambah role'}</Button></DialogFooter></form></DialogContent></Dialog>
    </div></>;
}
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <div className="grid gap-2"><Label>{label}</Label>{children}<InputError message={error} /></div>; }
Roles.layout = { breadcrumbs: [{ title: 'Manajemen Role', href: '/roles' }] };
