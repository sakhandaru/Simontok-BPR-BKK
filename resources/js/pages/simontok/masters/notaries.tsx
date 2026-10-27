import { Head, useForm } from '@inertiajs/react';
import { Edit3, FileText, KeyRound, Mail, Phone, Plus, UserPlus, UsersRound, X } from 'lucide-react';
import { FormEvent, useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import type { Option } from '@/types';
import { SimPageHeader } from '@/components/sim-page-header';
import { SimStatusBadge } from '@/components/sim-status-badge';
import { SimMultiSelect } from '@/components/sim-multi-select';
import { SimSelect } from '@/components/sim-select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SimTable, SimTableHead, SimTableHeader, SimTableSortHeader, useSimTableSort } from '@/components/sim-table';
import { SimPagination, type SimPaginationLink } from '@/components/sim-pagination';

type PortalUser = { id: number; name: string; email: string; is_active: boolean };
type Notary = { id: number; name: string; email?: string; phone?: string; address?: string; is_active: boolean; agreement_type?: 'PKS' | 'MoU' | null; agreement_file_name?: string | null; pks_no?: string | null; pks_start?: string | null; pks_end?: string | null; partnership_status?: string; branches: Option[]; users?: PortalUser[] };

export default function Notaries({ notaries, branches }: { notaries: { data: Notary[]; links: SimPaginationLink[] }; branches: Option[] }) {
    const { data, setData, post, processing, reset, errors, transform } = useForm({
        name: '',
        email: '',
        phone: '',
        address: '',
        agreement_type: 'PKS',
        pks_no: '',
        pks_start: '',
        pks_end: '',
        agreement_file: null as File | null,
        branch_ids: [] as number[],
        is_active: true,
    });
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const { sortedRows, sort, toggleSort } = useSimTableSort(notaries.data, 'name');
    const [managedNotary, setManagedNotary] = useState<Notary | null>(null);
    const [accountNotary, setAccountNotary] = useState<Notary | null>(null);
    const [editingAccount, setEditingAccount] = useState<PortalUser | null>(null);
    const [accountFormOpen, setAccountFormOpen] = useState(false);
    const accountForm = useForm({ name: '', email: '', password: '', is_active: true });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const options = { onSuccess: () => { reset(); setEditingId(null); setFormOpen(false); } };
        const requestOptions = { ...options, forceFormData: true };
        if (editingId) {
            transform((formData) => ({ ...formData, _method: 'put' }));
            post(`/notaries/${editingId}`, requestOptions);
        } else {
            transform((formData) => formData);
            post('/notaries', requestOptions);
        }
    };

    const editNotary = (notary: Notary) => { setEditingId(notary.id); setData({ name: notary.name, email: notary.email ?? '', phone: notary.phone ?? '', address: notary.address ?? '', agreement_type: notary.agreement_type ?? 'PKS', pks_no: notary.pks_no ?? '', pks_start: notary.pks_start?.slice(0, 10) ?? '', pks_end: notary.pks_end?.slice(0, 10) ?? '', agreement_file: null, branch_ids: notary.branches.map((branch) => branch.id), is_active: notary.is_active }); setFormOpen(true); };
    const openCreate = () => { reset(); setEditingId(null); setFormOpen(true); };
    const cancelEdit = () => { reset(); setEditingId(null); setFormOpen(false); };
    const openManageAccounts = (notary: Notary) => setManagedNotary(notary);
    const openAddAccount = (notary: Notary) => { setManagedNotary(null); setAccountNotary(notary); setEditingAccount(null); accountForm.setData({ name: '', email: '', password: '', is_active: true }); setAccountFormOpen(true); };
    const openEditAccount = (notary: Notary, user: PortalUser) => { setManagedNotary(null); setAccountNotary(notary); setEditingAccount(user); accountForm.setData({ name: user.name, email: user.email, password: '', is_active: user.is_active }); setAccountFormOpen(true); };
    const closeAccountForm = () => { setAccountFormOpen(false); setAccountNotary(null); setEditingAccount(null); accountForm.reset(); };
    const submitAccount = (event: FormEvent) => { event.preventDefault(); if (!accountNotary) return; const options = { onSuccess: closeAccountForm }; editingAccount ? accountForm.put(`/notaries/${accountNotary.id}/portal-account/${editingAccount.id}`, options) : accountForm.post(`/notaries/${accountNotary.id}/portal-account`, options); };

    return (
        <>
            <Head title="Kantor Notaris" />
            <div className="sim-workspace">
                <SimPageHeader title="Kantor Notaris" description="Kelola kantor notaris, kontak, dan cabang rekanan." actions={<Button type="button" onClick={openCreate}><Plus className="size-4" />Tambah kantor notaris</Button>} />
                <SimPagination links={notaries.links} />
                <div className="hidden md:block"><SimTable minWidth="720px">
                            <SimTableHead><tr><SimTableSortHeader active={sort.key === 'name'} direction={sort.direction} onClick={() => toggleSort('name')}>Nama</SimTableSortHeader><SimTableSortHeader onClick={() => toggleSort('email')}>Kontak</SimTableSortHeader><SimTableSortHeader onClick={() => toggleSort('branches')}>Cabang</SimTableSortHeader><SimTableSortHeader active={sort.key === 'is_active'} direction={sort.direction} onClick={() => toggleSort('is_active')}>Status</SimTableSortHeader><SimTableHeader>Aksi</SimTableHeader></tr></SimTableHead>
                            <tbody>{sortedRows.map((notary) => (
                                <tr key={notary.id} className="border-t"><td className="px-4 py-3"><div className="font-medium">{notary.name}</div><div className="mt-1 text-xs text-muted-foreground">{notary.address || 'Alamat belum diisi'}</div></td><td className="px-4 py-3 text-muted-foreground"><div className="inline-flex items-center gap-1"><Mail className="size-3.5" />{notary.email || '-'}</div><br /><div className="inline-flex items-center gap-1"><Phone className="size-3.5" />{notary.phone || '-'}</div></td><td className="px-4 py-3">{notary.branches.map((branch) => branch.code).join(', ') || '-'}</td><td className="px-4 py-3"><div className="flex flex-wrap items-center gap-2"><SimStatusBadge label={notary.partnership_status ?? 'Belum lengkap'} tone={notary.partnership_status === 'Aktif' || notary.partnership_status === 'Akan berakhir' ? 'success' : notary.partnership_status === 'Berakhir' ? 'danger' : 'warning'} /><SimStatusBadge label={notary.users?.some((user) => user.is_active) ? 'Portal aktif' : 'Belum ada akun'} tone={notary.users?.some((user) => user.is_active) ? 'success' : 'warning'} /></div></td><td className="px-4 py-3"><div className="flex flex-wrap gap-1"><Button type="button" variant="ghost" size="sm" onClick={() => editNotary(notary)}><Edit3 className="size-4" />Edit</Button><Button type="button" variant="outline" size="sm" onClick={() => openManageAccounts(notary)}><UsersRound className="size-4" />Kelola akun</Button></div></td></tr>
                            ))}</tbody>
                </SimTable></div>
                <div className="space-y-3 md:hidden">
                    {sortedRows.map((notary) => (
                        <article key={notary.id} className="space-y-4 border border-border bg-card p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0"><div className="text-lg font-medium leading-6">{notary.name}</div><div className="mt-1 text-sm text-muted-foreground">{notary.address || 'Alamat belum diisi'}</div></div>
                                <div className="flex flex-col items-end gap-1"><SimStatusBadge label={notary.partnership_status ?? 'Belum lengkap'} tone={notary.partnership_status === 'Aktif' || notary.partnership_status === 'Akan berakhir' ? 'success' : notary.partnership_status === 'Berakhir' ? 'danger' : 'warning'} /><SimStatusBadge label={notary.is_active ? 'Kantor aktif' : 'Kantor nonaktif'} tone={notary.is_active ? 'neutral' : 'warning'} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-4 text-sm">
                                <div className="min-w-0"><div className="text-xs text-muted-foreground">Email</div><div className="mt-1 truncate">{notary.email || '-'}</div></div>
                                <div className="min-w-0"><div className="text-xs text-muted-foreground">Telepon</div><div className="mt-1 truncate">{notary.phone || '-'}</div></div>
                                <div className="min-w-0"><div className="text-xs text-muted-foreground">Cabang</div><div className="mt-1 truncate">{notary.branches.map((branch) => branch.code).join(', ') || '-'}</div></div>
                                <div><div className="text-xs text-muted-foreground">Portal</div><div className="mt-1"><SimStatusBadge label={notary.users?.some((user) => user.is_active) ? 'Aktif' : 'Belum ada akun'} tone={notary.users?.some((user) => user.is_active) ? 'success' : 'warning'} /></div></div>
                                <div className="col-span-2"><div className="text-xs text-muted-foreground">Perjanjian</div><div className="mt-1">{notary.agreement_type && notary.pks_no ? `${notary.agreement_type} · ${notary.pks_no}` : 'Belum dicatat'}</div></div>
                            </div>
                            <div className="flex gap-2 border-t border-border pt-3">
                                <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => editNotary(notary)}><Edit3 className="size-4" />Edit</Button>
                                <Button type="button" size="sm" className="flex-1" onClick={() => openManageAccounts(notary)}><UsersRound className="size-4" />Kelola akun</Button>
                            </div>
                        </article>
                    ))}
                </div>
                <Dialog open={formOpen} onOpenChange={(open) => { if (!open) cancelEdit(); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{editingId ? 'Edit kantor notaris' : 'Tambah kantor notaris'}</DialogTitle><DialogDescription>Atur identitas, kontak, alamat, dan cabang rekanan kantor notaris.</DialogDescription></DialogHeader><form onSubmit={submit} className="grid gap-4">
                        <Field label="Nama" error={errors.name}><Input value={data.name} onChange={(e) => setData('name', e.target.value)} /></Field>
                        <Field label="Email" error={errors.email}><Input value={data.email} onChange={(e) => setData('email', e.target.value)} /></Field>
                        <Field label="Telepon" error={errors.phone}><Input value={data.phone} onChange={(e) => setData('phone', e.target.value)} /></Field>
                        <Field label="Alamat"><textarea className="min-h-20 rounded-md border border-input bg-background px-4 py-2 text-sm" value={data.address} onChange={(e) => setData('address', e.target.value)} /></Field>
                        <div className="border-t border-border pt-4"><div className="mb-3"><div className="font-medium">Legalitas kemitraan</div><p className="mt-1 text-sm text-muted-foreground">Tidak perlu approval di aplikasi. Lengkapi PKS atau MoU agar kantor notaris dapat menerima order.</p></div><div className="grid gap-4 md:grid-cols-2">
                            <Field label="Jenis perjanjian" error={errors.agreement_type}><SimSelect value={data.agreement_type} onChange={(value) => setData('agreement_type', value as 'PKS' | 'MoU')} options={[{ value: 'PKS', label: 'PKS' }, { value: 'MoU', label: 'MoU' }]} placeholder="Pilih jenis" /></Field>
                            <Field label="Nomor perjanjian" error={errors.pks_no}><Input value={data.pks_no} onChange={(e) => setData('pks_no', e.target.value)} placeholder="Contoh: 012/PKS/2026" /></Field>
                            <Field label="Berlaku mulai" error={errors.pks_start}><Input type="date" value={data.pks_start} onChange={(e) => setData('pks_start', e.target.value)} /></Field>
                            <Field label="Berlaku sampai" error={errors.pks_end}><Input type="date" value={data.pks_end} onChange={(e) => setData('pks_end', e.target.value)} /></Field>
                        </div><div className="mt-4 grid gap-2"><Label>File perjanjian (PDF)</Label><Input type="file" accept="application/pdf,.pdf" onChange={(e) => setData('agreement_file', e.target.files?.[0] ?? null)} />{editingId && notaries.data.find((item) => item.id === editingId)?.agreement_file_name && data.agreement_file === null && <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/20 p-3 text-sm"><div className="flex min-w-0 items-center gap-2"><FileText className="size-4 shrink-0 text-muted-foreground" /><span className="truncate">{notaries.data.find((item) => item.id === editingId)?.agreement_file_name}</span></div><a className="shrink-0 underline underline-offset-4" href={`/notaries/${editingId}/agreement/preview`} target="_blank" rel="noreferrer">Lihat preview</a></div>}{data.agreement_file && <p className="text-sm text-foreground">File baru: {data.agreement_file.name}</p>}<p className="text-xs text-muted-foreground">Maksimal 10 MB. Status aktif hanya jika data perjanjian dan file sudah lengkap.</p>{editingId && data.agreement_file === null && <p className="text-xs text-muted-foreground">File tersimpan tidak berubah jika tidak memilih file baru.</p>}<InputError message={errors.agreement_file} /></div></div>
                        <div className="grid gap-2">
                            <Label>Cabang rekanan</Label>
                            <SimMultiSelect value={data.branch_ids.map(String)} onChange={(values) => setData('branch_ids', values.map(Number))} options={branches.map((branch) => ({ value: String(branch.id), label: `${branch.code} - ${branch.name}` }))} placeholder="Pilih cabang rekanan" />
                        </div>
                        <label className="flex items-center gap-3 text-sm"><Checkbox checked={data.is_active} onCheckedChange={(checked) => setData('is_active', checked === true)} />Kantor notaris aktif dan dapat menerima order baru</label>
                        <DialogFooter><Button type="button" variant="outline" onClick={cancelEdit}><X className="size-4" />Batal</Button><Button type="submit" disabled={processing}>{editingId ? <Edit3 className="size-4" /> : <Plus className="size-4" />}{editingId ? 'Simpan perubahan' : 'Tambah kantor notaris'}</Button></DialogFooter>
                    </form></DialogContent></Dialog>
            </div>
            <Dialog open={Boolean(managedNotary)} onOpenChange={(open) => !open && setManagedNotary(null)}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Kelola akun portal</DialogTitle>
                        <DialogDescription>{managedNotary?.name} · semua akun portal yang terhubung ke kantor ini.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3">
                        {managedNotary?.users?.length ? managedNotary.users.map((user) => (
                            <div key={user.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                                <div className="min-w-0"><div className="truncate font-medium">{user.name}</div><div className="truncate text-sm text-muted-foreground">{user.email}</div></div>
                                <div className="flex shrink-0 items-center gap-2"><SimStatusBadge label={user.is_active ? 'Aktif' : 'Nonaktif'} tone={user.is_active ? 'success' : 'neutral'} /><Button type="button" variant="ghost" size="sm" onClick={() => openEditAccount(managedNotary, user)}><Edit3 className="size-4" />Edit</Button></div>
                            </div>
                        )) : <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">Belum ada akun portal untuk kantor notaris ini.</div>}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setManagedNotary(null)}>Tutup</Button>
                        <Button type="button" disabled={managedNotary?.partnership_status !== 'Aktif' && managedNotary?.partnership_status !== 'Akan berakhir'} onClick={() => managedNotary && openAddAccount(managedNotary)}><UserPlus className="size-4" />Tambah akun notaris</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={accountFormOpen} onOpenChange={(open) => { if (!open) closeAccountForm(); }}>
                <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{editingAccount ? 'Edit akun notaris' : 'Tambah akun notaris'}</DialogTitle><DialogDescription>{accountNotary?.name} · akun portal kantor notaris.</DialogDescription></DialogHeader><form onSubmit={submitAccount} className="grid gap-4"><Field label="Nama pengguna" error={accountForm.errors.name}><Input value={accountForm.data.name} onChange={(event) => accountForm.setData('name', event.target.value)} /></Field><Field label="Email login" error={accountForm.errors.email}><Input type="email" value={accountForm.data.email} onChange={(event) => accountForm.setData('email', event.target.value)} /></Field><Field label={editingAccount ? 'Password baru (opsional)' : 'Password awal'} error={accountForm.errors.password}><Input type="password" value={accountForm.data.password} onChange={(event) => accountForm.setData('password', event.target.value)} /></Field><label className="flex items-center gap-3 text-sm"><Checkbox checked={accountForm.data.is_active} onCheckedChange={(checked) => accountForm.setData('is_active', checked === true)} />Akun aktif dan boleh login</label><DialogFooter><Button type="button" variant="outline" onClick={closeAccountForm}>Batal</Button><Button type="submit" disabled={accountForm.processing}>{editingAccount ? <Edit3 className="size-4" /> : <KeyRound className="size-4" />}{editingAccount ? 'Simpan perubahan' : 'Tambah akun'}</Button></DialogFooter></form></DialogContent>
            </Dialog>
        </>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return <div className="grid gap-2"><Label>{label}</Label>{children}<InputError message={error} /></div>;
}

Notaries.layout = { breadcrumbs: [{ title: 'Kantor Notaris', href: '/notaries' }] };
