import { Head, useForm } from '@inertiajs/react';
import { ChevronDown, ChevronUp, Edit3, FileText, KeyRound, Mail, Phone, Plus, UserPlus, UsersRound, X } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
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
type Notary = { id: number; name: string; email?: string; phone?: string; address?: string; bank_name?: string; bank_account_number?: string; bank_account_name?: string; is_active: boolean; agreement_type?: 'PKS' | 'MoU' | null; agreement_file_name?: string | null; pks_no?: string | null; pks_start?: string | null; pks_end?: string | null; partnership_status?: string; branches: Option[]; users?: PortalUser[] };

export default function Notaries({ notaries, branches, bankNames }: { notaries: { data: Notary[]; links: SimPaginationLink[] }; branches: Option[]; bankNames: string[] }) {
    const { data, setData, post, processing, reset, errors, transform } = useForm({
        name: '',
        email: '',
        phone: '',
        bank_name: '',
        bank_account_number: '',
        bank_account_name: '',
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
    const [agreementPreviewUrl, setAgreementPreviewUrl] = useState<string | null>(null);
    const [accountNotary, setAccountNotary] = useState<Notary | null>(null);
    const [editingAccount, setEditingAccount] = useState<PortalUser | null>(null);
    const [accountFormOpen, setAccountFormOpen] = useState(false);
    const accountForm = useForm({ name: '', email: '', password: '', is_active: true });

    useEffect(() => {
        if (!data.agreement_file) {
            setAgreementPreviewUrl(null);
            return;
        }
        const url = URL.createObjectURL(data.agreement_file);
        setAgreementPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [data.agreement_file]);

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

    const editNotary = (notary: Notary) => { setEditingId(notary.id); setData({ name: notary.name, email: notary.email ?? '', phone: notary.phone ?? '', bank_name: notary.bank_name ?? '', bank_account_number: notary.bank_account_number ?? '', bank_account_name: notary.bank_account_name ?? '', address: notary.address ?? '', agreement_type: notary.agreement_type ?? 'PKS', pks_no: notary.pks_no ?? '', pks_start: notary.pks_start?.slice(0, 10) ?? '', pks_end: notary.pks_end?.slice(0, 10) ?? '', agreement_file: null, branch_ids: notary.branches.map((branch) => branch.id), is_active: notary.is_active }); setFormOpen(true); };
    const openCreate = () => { reset(); setEditingId(null); setFormOpen(true); };
    const cancelEdit = () => { reset(); setEditingId(null); setFormOpen(false); };
    const openManageAccounts = (notary: Notary) => {
        const portalUser = notary.users?.[0];
        if (portalUser) {
            openEditAccount(notary, portalUser);
            return;
        }
        openAddAccount(notary);
    };
    const openAddAccount = (notary: Notary) => { setManagedNotary(null); setAccountNotary(notary); setEditingAccount(null); accountForm.setData({ name: '', email: '', password: '', is_active: true }); setAccountFormOpen(true); };
    const openEditAccount = (notary: Notary, user: PortalUser) => { setManagedNotary(null); setAccountNotary(notary); setEditingAccount(user); accountForm.setData({ name: user.name, email: user.email, password: '', is_active: user.is_active }); setAccountFormOpen(true); };
    const closeAccountForm = () => { setAccountFormOpen(false); setAccountNotary(null); setEditingAccount(null); accountForm.reset(); };
    const submitAccount = (event: FormEvent) => { event.preventDefault(); if (!accountNotary) return; const options = { onSuccess: closeAccountForm }; editingAccount ? accountForm.put(`/notaries/${accountNotary.id}/portal-account/${editingAccount.id}`, options) : accountForm.post(`/notaries/${accountNotary.id}/portal-account`, options); };

    return (
        <>
            <Head title="Notaris" />
            <div className="sim-workspace">
                <SimPageHeader title="Notaris" description="Kelola identitas notaris, legalitas, akun portal, dan cabang rekanan." actions={<Button type="button" onClick={openCreate}><Plus className="size-4" />Tambah notaris</Button>} />
                <div className="hidden md:block"><SimTable minWidth="720px">
                            <SimTableHead><tr><SimTableSortHeader active={sort.key === 'name'} direction={sort.direction} onClick={() => toggleSort('name')}>Nama</SimTableSortHeader><SimTableSortHeader onClick={() => toggleSort('email')}>Kontak</SimTableSortHeader><SimTableSortHeader onClick={() => toggleSort('branches')}>Cabang</SimTableSortHeader><SimTableSortHeader active={sort.key === 'is_active'} direction={sort.direction} onClick={() => toggleSort('is_active')}>Status</SimTableSortHeader><SimTableHeader>Aksi</SimTableHeader></tr></SimTableHead>
                            <tbody>{sortedRows.map((notary) => (
                                <tr key={notary.id} className="border-t"><td className="px-4 py-3"><div className="font-medium">{notary.name}</div><div className="mt-1 text-xs text-muted-foreground">{notary.address || 'Alamat belum diisi'}</div></td><td className="px-4 py-3 text-muted-foreground"><div className="inline-flex items-center gap-1"><Mail className="size-3.5" />{notary.email || '-'}</div><br /><div className="inline-flex items-center gap-1"><Phone className="size-3.5" />{notary.phone || '-'}</div></td><td className="px-4 py-3">{notary.branches.map((branch) => branch.code).join(', ') || '-'}</td><td className="px-4 py-3"><div className="flex flex-wrap items-center gap-2"><SimStatusBadge label={notary.partnership_status ?? 'Belum lengkap'} tone={notary.partnership_status === 'Aktif' || notary.partnership_status === 'Akan berakhir' ? 'success' : notary.partnership_status === 'Berakhir' ? 'danger' : 'warning'} /><SimStatusBadge label={notary.users?.some((user) => user.is_active) ? 'Portal aktif' : 'Belum ada akun'} tone={notary.users?.some((user) => user.is_active) ? 'success' : 'warning'} /></div></td><td className="px-4 py-3"><div className="flex flex-nowrap gap-2"><Button type="button" variant="outline" size="icon" className="size-9 bg-background" aria-label="Edit notaris" title="Edit notaris" onClick={() => editNotary(notary)}><Edit3 className="size-4" /></Button><Button type="button" variant="outline" size="icon" className="size-9 bg-background" aria-label="Akun portal" title="Akun portal" onClick={() => openManageAccounts(notary)}><UsersRound className="size-4" /></Button></div></td></tr>
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
                                <Button type="button" variant="outline" size="icon" className="size-9 flex-1 bg-background" aria-label="Edit notaris" title="Edit notaris" onClick={() => editNotary(notary)}><Edit3 className="size-4" /></Button>
                                <Button type="button" variant="outline" size="icon" className="size-9 flex-1 bg-background" aria-label="Akun portal" title="Akun portal" onClick={() => openManageAccounts(notary)}><UsersRound className="size-4" /></Button>
                            </div>
                        </article>
                    ))}
                </div>
                <NotaryProfileDialog open={formOpen} editingId={editingId} data={data} errors={errors} processing={processing} branches={branches} bankNames={bankNames} notaries={notaries.data} agreementPreviewUrl={agreementPreviewUrl} setData={setData} onSubmit={submit} onClose={cancelEdit} />
                <Dialog open={false} onOpenChange={(open) => { if (!open) cancelEdit(); }}><DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-5xl md:overflow-visible"><DialogHeader><DialogTitle>{editingId ? 'Edit notaris' : 'Tambah notaris'}</DialogTitle><DialogDescription>Atur identitas, kontak, legalitas, dan cabang rekanan notaris.</DialogDescription></DialogHeader><form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
                        <Field label="Nama notaris" error={errors.name}><Input value={data.name} onChange={(e) => setData('name', e.target.value)} /></Field>
                        <Field label="Email" error={errors.email}><Input value={data.email} onChange={(e) => setData('email', e.target.value)} /></Field>
                        <Field label="Telepon" error={errors.phone}><Input value={data.phone} onChange={(e) => setData('phone', e.target.value)} /></Field>
                        <div className="md:col-span-2"><Field label="Alamat"><textarea className="min-h-20 rounded-md border border-input bg-background px-4 py-2 text-sm" value={data.address} onChange={(e) => setData('address', e.target.value)} /></Field></div>
                        <div className="grid gap-3 border-t border-border pt-3 md:col-span-2 md:grid-cols-3">
                            <div className="md:col-span-3"><div className="font-medium">Rekening pembayaran</div><p className="mt-1 text-sm text-muted-foreground">Digunakan sebagai referensi pembayaran jasa notaris.</p></div>
                            <Field label="Nama bank" error={errors.bank_name}><Input value={data.bank_name} onChange={(e) => setData('bank_name', e.target.value)} placeholder="Contoh: BRI" /></Field>
                            <Field label="Nomor rekening" error={errors.bank_account_number}><Input value={data.bank_account_number} onChange={(e) => setData('bank_account_number', e.target.value)} /></Field>
                            <Field label="Nama pemilik rekening" error={errors.bank_account_name}><Input value={data.bank_account_name} onChange={(e) => setData('bank_account_name', e.target.value)} /></Field>
                        </div>
                        <div className="border-t border-border pt-4"><div className="mb-3"><div className="font-medium">Legalitas kemitraan</div><p className="mt-1 text-sm text-muted-foreground">Tidak perlu approval di aplikasi. Lengkapi PKS atau MoU agar notaris dapat menerima order.</p></div><div className="grid gap-4 md:grid-cols-2">
                            <Field label="Jenis perjanjian" error={errors.agreement_type}><SimSelect value={data.agreement_type} onChange={(value) => setData('agreement_type', value as 'PKS' | 'MoU')} options={[{ value: 'PKS', label: 'PKS' }, { value: 'MoU', label: 'MoU' }]} placeholder="Pilih jenis" /></Field>
                            <Field label="Nomor perjanjian" error={errors.pks_no}><Input value={data.pks_no} onChange={(e) => setData('pks_no', e.target.value)} placeholder="Contoh: 012/PKS/2026" /></Field>
                            <Field label="Berlaku mulai" error={errors.pks_start}><Input type="date" value={data.pks_start} onChange={(e) => setData('pks_start', e.target.value)} /></Field>
                            <Field label="Berlaku sampai" error={errors.pks_end}><Input type="date" value={data.pks_end} onChange={(e) => setData('pks_end', e.target.value)} /></Field>
                        </div><div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] md:items-start"><div className="grid gap-2"><Label>File perjanjian (PDF)</Label><Input type="file" accept="application/pdf,.pdf" onChange={(e) => setData('agreement_file', e.target.files?.[0] ?? null)} />{data.agreement_file && <p className="text-sm text-foreground">File baru: {data.agreement_file.name}</p>}{editingId && data.agreement_file === null && <p className="text-xs text-muted-foreground">File tersimpan tidak berubah jika tidak memilih file baru.</p>}<p className="text-xs text-muted-foreground">Maksimal 10 MB. Status aktif hanya jika data perjanjian dan file sudah lengkap.</p><InputError message={errors.agreement_file} /></div>{(agreementPreviewUrl || (editingId && notaries.data.find((item) => item.id === editingId)?.agreement_file_name)) && <div className="overflow-hidden rounded-md border bg-muted/20"><div className="flex items-center justify-between gap-2 border-b px-3 py-2 text-sm"><span className="flex min-w-0 items-center gap-2"><FileText className="size-4 shrink-0" /><span className="truncate">{data.agreement_file?.name ?? notaries.data.find((item) => item.id === editingId)?.agreement_file_name}</span></span>{editingId && <a className="shrink-0 underline underline-offset-4" href={`/notaries/${editingId}/agreement/preview`} target="_blank" rel="noreferrer">Buka</a>}</div><iframe title="Preview file perjanjian" src={agreementPreviewUrl ?? (editingId ? `/notaries/${editingId}/agreement/preview` : undefined)} className="h-44 w-full bg-white" /></div>}</div></div>
                        <div className="md:border-l md:border-border md:pl-6"><div className="grid gap-2">
                            <Label>Cabang rekanan</Label>
                            <SimMultiSelect value={data.branch_ids.map(String)} onChange={(values) => setData('branch_ids', values.map(Number))} options={branches.map((branch) => ({ value: String(branch.id), label: `${branch.code} - ${branch.name}` }))} placeholder="Pilih cabang rekanan" />
                        </div></div>
                        <label className="flex items-center gap-3 text-sm"><Checkbox checked={data.is_active} onCheckedChange={(checked) => setData('is_active', checked === true)} />Notaris aktif dan dapat menerima order baru</label>
                        <DialogFooter><Button type="button" variant="outline" onClick={cancelEdit}><X className="size-4" />Batal</Button><Button type="submit" disabled={processing}>{editingId ? <Edit3 className="size-4" /> : <Plus className="size-4" />}{editingId ? 'Simpan perubahan' : 'Tambah notaris'}</Button></DialogFooter>
                    </form></DialogContent></Dialog>
                <SimPagination links={notaries.links} />
            </div>
            <Dialog open={Boolean(managedNotary)} onOpenChange={(open) => !open && setManagedNotary(null)}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Kelola akun portal</DialogTitle>
                    <DialogDescription>{managedNotary?.name} · akun portal milik notaris ini.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3">
                        {managedNotary?.users?.length ? managedNotary.users.map((user) => (
                            <div key={user.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                                <div className="min-w-0"><div className="truncate font-medium">{user.name}</div><div className="truncate text-sm text-muted-foreground">{user.email}</div></div>
                                <div className="flex shrink-0 items-center gap-2"><SimStatusBadge label={user.is_active ? 'Aktif' : 'Nonaktif'} tone={user.is_active ? 'success' : 'neutral'} /><Button type="button" variant="ghost" size="sm" onClick={() => openEditAccount(managedNotary, user)}><Edit3 className="size-4" />Edit</Button></div>
                            </div>
                        )) : <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">Belum ada akun portal untuk notaris ini.</div>}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setManagedNotary(null)}>Tutup</Button>
                        {!managedNotary?.users?.length && <Button type="button" disabled={managedNotary?.partnership_status !== 'Aktif' && managedNotary?.partnership_status !== 'Akan berakhir'} onClick={() => managedNotary && openAddAccount(managedNotary)}><UserPlus className="size-4" />Buat akun portal</Button>}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={accountFormOpen} onOpenChange={(open) => { if (!open) closeAccountForm(); }}>
                <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{editingAccount ? 'Edit akun portal' : 'Buat akun portal'}</DialogTitle><DialogDescription>{accountNotary?.name} · satu akun portal untuk satu notaris.</DialogDescription></DialogHeader><form onSubmit={submitAccount} className="grid gap-4"><Field label="Nama pengguna" error={accountForm.errors.name}><Input value={accountForm.data.name} onChange={(event) => accountForm.setData('name', event.target.value)} /></Field><Field label="Email login" error={accountForm.errors.email}><Input type="email" value={accountForm.data.email} onChange={(event) => accountForm.setData('email', event.target.value)} /></Field><Field label={editingAccount ? 'Password baru (opsional)' : 'Password awal'} error={accountForm.errors.password}><Input type="password" value={accountForm.data.password} onChange={(event) => accountForm.setData('password', event.target.value)} /></Field><div className="flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3 text-sm"><button type="button" role="switch" aria-checked={accountForm.data.is_active} aria-label="Aktifkan akun portal" onClick={() => accountForm.setData('is_active', !accountForm.data.is_active)} className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${accountForm.data.is_active ? 'bg-primary' : 'bg-muted-foreground/40'}`}><span className={`pointer-events-none block size-5 rounded-full bg-white shadow-sm transition-transform ${accountForm.data.is_active ? 'translate-x-5' : 'translate-x-0'}`} /></button><span>Akun aktif</span></div><DialogFooter className="mt-0"><Button type="button" variant="outline" onClick={closeAccountForm}>Batal</Button><Button type="submit" disabled={accountForm.processing}>{editingAccount ? <Edit3 className="size-4" /> : <KeyRound className="size-4" />}{editingAccount ? 'Simpan perubahan' : 'Buat akun'}</Button></DialogFooter></div></form></DialogContent>
            </Dialog>
        </>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return <div className="grid gap-2"><Label>{label}</Label>{children}<InputError message={error} /></div>;
}

function BankCombobox({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
    const [open, setOpen] = useState(false);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const filteredOptions = options.filter((option) => option.toLowerCase().includes(value.toLowerCase()));

    const closeLater = () => {
        closeTimer.current = setTimeout(() => setOpen(false), 120);
    };

    const choose = (option: string) => {
        if (closeTimer.current) clearTimeout(closeTimer.current);
        onChange(option);
        setOpen(false);
    };

    return (
        <div className="relative">
            <div className={`flex h-10 w-full items-center rounded-md border bg-background px-3 ring-offset-background transition-colors ${open ? 'border-ring ring-2 ring-ring/30' : 'border-input'}`}>
                <input value={value} onChange={(event) => { onChange(event.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={closeLater} placeholder="Pilih atau ketik nama bank" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
                <button type="button" tabIndex={-1} aria-label={open ? 'Tutup pilihan bank' : 'Buka pilihan bank'} onMouseDown={(event) => event.preventDefault()} onClick={() => setOpen((current) => !current)} className="ml-2 text-muted-foreground">
                    {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </button>
            </div>
            {open && <div className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
                {filteredOptions.length ? filteredOptions.map((option) => <button key={option} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)} className="flex w-full items-center rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground">{option}</button>) : <div className="px-3 py-2 text-sm text-muted-foreground">Belum ada bank yang cocok. Lanjutkan mengetik untuk nama baru.</div>}
            </div>}
        </div>
    );
}

function NotaryProfileDialog({ open, editingId, data, errors, processing, branches, bankNames, notaries, agreementPreviewUrl, setData, onSubmit, onClose }: any) {
    const existingFileName = editingId ? notaries.find((item: Notary) => item.id === editingId)?.agreement_file_name : null;
    const previewSource = agreementPreviewUrl ?? (editingId && existingFileName ? `/notaries/${editingId}/agreement/preview` : null);

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
            <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-5xl">
                <DialogHeader className="-mx-6 -mt-6 border-b border-border bg-muted/30 px-6 py-5 pr-14">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <DialogTitle>{editingId ? 'Edit notaris' : 'Tambah notaris'}</DialogTitle>
                            <DialogDescription>Lengkapi profil notaris agar mudah ditemukan dan siap menerima order.</DialogDescription>
                        </div>
                        <SimStatusBadge label={data.is_active ? 'Aktif' : 'Nonaktif'} tone={data.is_active ? 'success' : 'warning'} />
                    </div>
                </DialogHeader>

                <form onSubmit={onSubmit} className="grid gap-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <section className="grid content-start gap-4 rounded-lg border border-border bg-card p-4">
                            <div>
                                <h3 className="font-medium">Identitas & kontak</h3>
                                <p className="mt-1 text-sm text-muted-foreground">Data utama untuk komunikasi dan administrasi.</p>
                            </div>
                            <Field label="Nama notaris" error={errors.name}><Input autoFocus value={data.name} onChange={(event) => setData('name', event.target.value)} placeholder="Contoh: Notaris Budi Santoso, S.H." /></Field>
                            <Field label="Email" error={errors.email}><Input type="email" value={data.email} onChange={(event) => setData('email', event.target.value)} placeholder="email@kantor-notaris.id" /></Field>
                            <Field label="Telepon / WhatsApp" error={errors.phone}><Input value={data.phone} onChange={(event) => setData('phone', event.target.value)} placeholder="Contoh: 0812xxxxxxxx" /></Field>
                            <Field label="Alamat kantor"><textarea className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" value={data.address} onChange={(event) => setData('address', event.target.value)} placeholder="Alamat lengkap kantor notaris" /></Field>

                            <div className="border-t border-border pt-4">
                                <h3 className="font-medium">Rekening pembayaran</h3>
                                <p className="mt-1 text-sm text-muted-foreground">Referensi pembayaran jasa notaris.</p>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field label="Nama bank" error={errors.bank_name}><BankCombobox value={data.bank_name} options={bankNames} onChange={(value) => setData('bank_name', value)} /></Field>
                                <Field label="Nomor rekening" error={errors.bank_account_number}><Input value={data.bank_account_number} onChange={(event) => setData('bank_account_number', event.target.value)} placeholder="Nomor rekening" /></Field>
                                <div className="sm:col-span-2"><Field label="Nama pemilik rekening" error={errors.bank_account_name}><Input value={data.bank_account_name} onChange={(event) => setData('bank_account_name', event.target.value)} placeholder="Sesuai buku rekening" /></Field></div>
                            </div>
                        </section>

                        <section className="grid content-start gap-4 rounded-lg border border-border bg-card p-4">
                            <div>
                                <h3 className="font-medium">Legalitas & cabang rekanan</h3>
                                <p className="mt-1 text-sm text-muted-foreground">Perjanjian menentukan kelengkapan dan status kemitraan.</p>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field label="Jenis perjanjian" error={errors.agreement_type}><SimSelect value={data.agreement_type} onChange={(value) => setData('agreement_type', value as 'PKS' | 'MoU')} options={[{ value: 'PKS', label: 'PKS' }, { value: 'MoU', label: 'MoU' }]} placeholder="Pilih jenis" /></Field>
                                <Field label="Nomor perjanjian" error={errors.pks_no}><Input value={data.pks_no} onChange={(event) => setData('pks_no', event.target.value)} placeholder="Contoh: 012/PKS/2026" /></Field>
                                <Field label="Berlaku mulai" error={errors.pks_start}><Input type="date" max={data.pks_end || undefined} value={data.pks_start} onChange={(event) => setData('pks_start', event.target.value)} /></Field>
                                <Field label="Berlaku sampai" error={errors.pks_end}><Input type="date" min={data.pks_start || undefined} value={data.pks_end} onChange={(event) => setData('pks_end', event.target.value)} /></Field>
                            </div>

                            <Field label="Cabang rekanan" error={errors.branch_ids}><SimMultiSelect value={data.branch_ids.map(String)} onChange={(values) => setData('branch_ids', values.map(Number))} options={branches.map((branch: Option) => ({ value: String(branch.id), label: `${branch.code} - ${branch.name}` }))} placeholder="Pilih cabang rekanan" /></Field>

                            <div className="border-t border-border pt-4">
                                <div className="mb-3 flex items-start justify-between gap-3">
                                    <div><h3 className="font-medium">File perjanjian</h3><p className="mt-1 text-sm text-muted-foreground">PDF maksimal 10 MB. File lama tetap digunakan jika tidak diganti.</p></div>
                                    {editingId && <a href={`/document-archives?notary_id=${editingId}`} className="shrink-0 text-sm font-medium text-primary underline underline-offset-4">Lihat arsip</a>}
                                </div>
                                <div className="grid gap-3">
                                    <Input type="file" accept="application/pdf,.pdf" onChange={(event) => setData('agreement_file', event.target.files?.[0] ?? null)} />
                                    {data.agreement_file && <p className="text-sm text-foreground">File baru: {data.agreement_file.name}</p>}
                                    {previewSource && <div className="overflow-hidden rounded-md border border-border bg-muted/20"><div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-sm"><span className="flex min-w-0 items-center gap-2"><FileText className="size-4 shrink-0" /><span className="truncate">{data.agreement_file?.name ?? existingFileName}</span></span>{editingId && <a className="shrink-0 underline underline-offset-4" href={`/notaries/${editingId}/agreement/preview`} target="_blank" rel="noreferrer">Buka</a>}</div><iframe title="Preview file perjanjian" src={previewSource} className="h-48 w-full bg-white" /></div>}
                                    <InputError message={errors.agreement_file} />
                                </div>
                            </div>
                        </section>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3 text-sm">
                            <button type="button" role="switch" aria-checked={data.is_active} aria-label="Aktifkan notaris" onClick={() => setData('is_active', !data.is_active)} className={`relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${data.is_active ? 'bg-primary' : 'bg-muted-foreground/40'}`}>
                                <span className={`pointer-events-none block size-5 rounded-full bg-white shadow-sm transition-transform ${data.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                            <label className="cursor-pointer" onClick={() => setData('is_active', !data.is_active)}><span className="font-medium">Notaris aktif</span><span className="block text-muted-foreground">Dapat menerima order baru jika legalitasnya lengkap.</span></label>
                        </div>
                        <DialogFooter className="mt-0"><Button type="button" variant="outline" onClick={onClose}><X className="size-4" />Batal</Button><Button type="submit" disabled={processing}>{editingId ? <Edit3 className="size-4" /> : <Plus className="size-4" />}{editingId ? 'Simpan perubahan' : 'Tambah notaris'}</Button></DialogFooter>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

Notaries.layout = { breadcrumbs: [{ title: 'Notaris', href: '/notaries' }] };
