import { Head, useForm } from '@inertiajs/react';
import { Edit3, Plus, UserPlus, UsersRound, X } from 'lucide-react';
import { FormEvent, useState } from 'react';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { SimSelect } from '@/components/sim-select';
import { SimPageHeader } from '@/components/sim-page-header';
import { SimStatusBadge } from '@/components/sim-status-badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SimTable, SimTableHead, SimTableHeader, SimTableSortHeader, useSimTableSort } from '@/components/sim-table';
import { SimPagination, type SimPaginationLink } from '@/components/sim-pagination';

type Position = { id: number; code?: string; name: string; role?: { code?: string; name: string } };
type BranchUser = { id: number; name: string; email: string; sso_employee_id?: string | null; is_active: boolean; job_position?: Position | null; role?: { code?: string; name: string } | null };
type Branch = { id: number; code: string; name: string; address?: string | null; latitude?: string | null; longitude?: string | null; is_active: boolean; users?: BranchUser[] };

export default function Branches({ branches, positions }: { branches: { data: Branch[]; links: SimPaginationLink[] }; positions: Position[] }) {
    const { data, setData, post, put, processing, reset, errors } = useForm({ code: '', name: '', address: '', is_active: true });
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const { sortedRows, sort, toggleSort } = useSimTableSort(branches.data, 'name');
    const [managedBranch, setManagedBranch] = useState<Branch | null>(null);
    const [accountBranch, setAccountBranch] = useState<Branch | null>(null);
    const [editingUser, setEditingUser] = useState<BranchUser | null>(null);
    const [userFormOpen, setUserFormOpen] = useState(false);
    const internalForm = useForm({ sso_employee_id: '', job_position_id: '', is_active: true });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const options = { onSuccess: () => { reset(); setEditingId(null); setFormOpen(false); } };
        editingId ? put(`/branches/${editingId}`, options) : post('/branches', options);
    };

    const editBranch = (branch: Branch) => { setEditingId(branch.id); setData({ code: branch.code, name: branch.name, address: branch.address ?? '', is_active: branch.is_active }); setFormOpen(true); };
    const openCreate = () => { reset(); setEditingId(null); setFormOpen(true); };
    const cancelEdit = () => { reset(); setEditingId(null); setFormOpen(false); };
    const openManageUsers = (branch: Branch) => setManagedBranch(branch);
    const openAddUser = (branch: Branch) => { setManagedBranch(null); setAccountBranch(branch); setEditingUser(null); internalForm.setData({ sso_employee_id: '', job_position_id: '', is_active: true }); setUserFormOpen(true); };
    const openEditUser = (branch: Branch, user: BranchUser) => { setManagedBranch(null); setAccountBranch(branch); setEditingUser(user); internalForm.setData({ sso_employee_id: user.sso_employee_id ?? '', job_position_id: user.job_position?.id ? String(user.job_position.id) : '', is_active: user.is_active }); setUserFormOpen(true); };
    const closeUserForm = () => { setUserFormOpen(false); setAccountBranch(null); setEditingUser(null); internalForm.reset(); };
    const submitUser = (event: FormEvent) => { event.preventDefault(); if (!accountBranch) return; const options = { onSuccess: closeUserForm }; editingUser ? internalForm.put(`/branches/${accountBranch.id}/internal-account/${editingUser.id}`, options) : internalForm.post(`/branches/${accountBranch.id}/internal-account`, options); };

    return (
        <>
            <Head title="Kantor Cabang" />
            <div className="sim-workspace">
                <SimPageHeader title="Kantor Cabang" description="Kelola kantor, alamat, dan lokasi layanan." actions={<Button type="button" onClick={openCreate}><Plus className="size-4" />Tambah kantor cabang</Button>} />
                <SimPagination links={branches.links} />
                <div className="hidden md:block"><SimTable minWidth="560px">
                <SimTableHead><tr><SimTableSortHeader active={sort.key === 'code'} direction={sort.direction} onClick={() => toggleSort('code')}>Kode</SimTableSortHeader><SimTableSortHeader active={sort.key === 'name'} direction={sort.direction} onClick={() => toggleSort('name')}>Nama</SimTableSortHeader><SimTableSortHeader active={sort.key === 'is_active'} direction={sort.direction} onClick={() => toggleSort('is_active')}>Status</SimTableSortHeader><SimTableHeader className="text-right">Aksi</SimTableHeader></tr></SimTableHead><tbody>
                    {sortedRows.map((branch) => (
                        <tr key={branch.id} className="border-t">
                            <td className="px-4 py-3 font-medium">{branch.code}</td><td className="px-4 py-3"><div>{branch.name}</div><div className="mt-1 max-w-md text-xs text-muted-foreground">{branch.address ?? 'Alamat belum diisi'}</div></td><td className="px-4 py-3"><SimStatusBadge label={branch.is_active ? 'Aktif' : 'Nonaktif'} tone={branch.is_active ? 'success' : 'neutral'} /></td><td className="px-4 py-3"><div className="flex flex-wrap justify-end gap-1"><Button type="button" variant="ghost" size="sm" onClick={() => editBranch(branch)}><Edit3 className="size-4" />Edit</Button><Button type="button" variant="outline" size="sm" onClick={() => openManageUsers(branch)}><UsersRound className="size-4" />Kelola pengguna</Button></div></td>
                        </tr>
                    ))}
                </tbody></SimTable></div>
                <div className="space-y-3 md:hidden">
                    {sortedRows.map((branch) => <article key={branch.id} className="space-y-4 border border-border bg-card p-4">
                        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-lg font-medium leading-6">{branch.name}</div><div className="mt-1 text-sm text-muted-foreground">{branch.code}</div></div><SimStatusBadge label={branch.is_active ? 'Aktif' : 'Nonaktif'} tone={branch.is_active ? 'success' : 'neutral'} /></div>
                        <div className="text-sm"><div className="text-xs text-muted-foreground">Alamat</div><div className="mt-1 leading-5">{branch.address ?? 'Alamat belum diisi'}</div></div>
                        <div className="flex gap-2"><Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => editBranch(branch)}><Edit3 className="size-4" />Edit kantor cabang</Button><Button type="button" size="sm" className="flex-1" onClick={() => openManageUsers(branch)}><UsersRound className="size-4" />Pengguna</Button></div>
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
                <Dialog open={Boolean(managedBranch)} onOpenChange={(open) => !open && setManagedBranch(null)}>
                    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                        <DialogHeader><DialogTitle>Kelola pengguna cabang</DialogTitle><DialogDescription>{managedBranch?.name} · pegawai internal yang terhubung ke cabang ini.</DialogDescription></DialogHeader>
                        <div className="grid gap-3">
                            {managedBranch?.users?.length ? managedBranch.users.map((user) => <div key={user.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3"><div className="min-w-0"><div className="truncate font-medium">{user.name}</div><div className="truncate text-sm text-muted-foreground">{user.sso_employee_id || user.email}</div><div className="mt-1 text-xs text-muted-foreground">{user.job_position?.name || 'Posisi belum diatur'}</div></div><div className="flex shrink-0 items-center gap-2"><SimStatusBadge label={user.is_active ? 'Aktif' : 'Nonaktif'} tone={user.is_active ? 'success' : 'neutral'} /><Button type="button" variant="ghost" size="sm" onClick={() => openEditUser(managedBranch, user)}><Edit3 className="size-4" />Edit</Button></div></div>) : <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">Belum ada akun internal untuk kantor cabang ini.</div>}
                        </div>
                        <DialogFooter><Button type="button" variant="outline" onClick={() => setManagedBranch(null)}>Tutup</Button><Button type="button" disabled={!managedBranch?.is_active} onClick={() => managedBranch && openAddUser(managedBranch)}><UserPlus className="size-4" />Tambah pegawai SSO</Button></DialogFooter>
                    </DialogContent>
                </Dialog>
                <Dialog open={userFormOpen} onOpenChange={(open) => { if (!open) closeUserForm(); }}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader><DialogTitle>{editingUser ? 'Edit pengguna cabang' : 'Tambah pegawai SSO'}</DialogTitle><DialogDescription>{accountBranch?.name} · akun menggunakan identitas dan password SSO.</DialogDescription></DialogHeader>
                        <form onSubmit={submitUser} className="grid gap-4">
                            <Field label="ID pegawai SSO" error={internalForm.errors.sso_employee_id}><Input value={internalForm.data.sso_employee_id} disabled={Boolean(editingUser)} onChange={(event) => internalForm.setData('sso_employee_id', event.target.value)} placeholder="Contoh: 102-119" /></Field>
                            <Field label="Posisi" error={internalForm.errors.job_position_id}><SimSelect value={internalForm.data.job_position_id} onChange={(value) => internalForm.setData('job_position_id', value)} options={positions.map((position) => ({ value: String(position.id), label: `${position.name}${position.role?.name ? ` · ${position.role.name}` : ''}` }))} placeholder="Pilih posisi" /></Field>
                            {editingUser && <label className="flex items-center gap-3 text-sm"><Checkbox checked={internalForm.data.is_active} onCheckedChange={(checked) => internalForm.setData('is_active', checked === true)} />Akun aktif dan boleh login</label>}
                            <DialogFooter><Button type="button" variant="outline" onClick={closeUserForm}><X className="size-4" />Batal</Button><Button type="submit" disabled={internalForm.processing}>{editingUser ? <Edit3 className="size-4" /> : <UserPlus className="size-4" />}{editingUser ? 'Simpan perubahan' : 'Tambah pegawai'}</Button></DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return <div className="grid gap-2"><Label>{label}</Label>{children}<InputError message={error} /></div>;
}

Branches.layout = { breadcrumbs: [{ title: 'Kantor Cabang', href: '/branches' }] };
