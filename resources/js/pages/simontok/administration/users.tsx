import { Head, router, useForm } from '@inertiajs/react';
import { Ban, CircleCheck, Edit3, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import InputError from '@/components/input-error';
import { SimPageHeader } from '@/components/sim-page-header';
import { SimStatusBadge } from '@/components/sim-status-badge';
import { SimSelect } from '@/components/sim-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    SimTable,
    SimTableHead,
    SimTableHeader,
    SimTableSortHeader,
    useSimTableSort,
} from '@/components/sim-table';
import {
    SimPagination,
    type SimPaginationLink,
} from '@/components/sim-pagination';

type Option = {
    id: number;
    name: string;
    code?: string;
    role?: { code?: string; name: string };
};
type User = {
    id: number;
    name: string;
    email: string;
    sso_employee_id?: string | null;
    is_active: boolean;
    branch?: Option;
    notary?: Option;
    job_position?: Option;
};
type AccountType = 'sso' | 'local';

const BRANCH_ROLE_CODES = ['pimpinan_cabang', 'kabid_ops_cabang', 'admin_legal_cabang'];
const GLOBAL_ROLE_CODES = ['direksi_pusat', 'kadiv_ops_pusat', 'admin_legal_pusat', 'auditor', 'it_admin'];

function branchRequiredRole(roleCode?: string) {
    return BRANCH_ROLE_CODES.includes(roleCode ?? '');
}

function isGlobalRole(roleCode?: string) {
    return GLOBAL_ROLE_CODES.includes(roleCode ?? '');
}

export default function Users({
    users,
    branches,
    positions,
    branchLocked,
    actorBranch,
    actorUserId,
    filters,
}: {
    users: { data: User[]; links: SimPaginationLink[] };
    branches: Option[];
    positions: Option[];
    branchLocked: boolean;
    actorBranch: Option | null;
    actorUserId: number;
    filters: { search: string; type: string; branch_id: string; position_id: string; status: string };
}) {
    const { data, setData, post, put, processing, reset, errors } = useForm({
        name: '',
        email: '',
        sso_employee_id: '',
        password: '',
        branch_id: '',
        job_position_id: '',
        is_active: true,
    });
    const filterForm = useForm({ ...filters });
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [accountType, setAccountType] = useState<AccountType>('sso');
    const [statusProcessingId, setStatusProcessingId] = useState<number | null>(null);
    const [pendingStatusUser, setPendingStatusUser] = useState<User | null>(null);
    const [deleteProcessingId, setDeleteProcessingId] = useState<number | null>(null);
    const [pendingDeleteUser, setPendingDeleteUser] = useState<User | null>(null);
    const filterInitialized = useRef(false);
    const skipNextFilterRequest = useRef(false);
    const { sortedRows, sort, toggleSort } = useSimTableSort(
        users.data,
        'name',
    );
    const selectedPosition = positions.find(
        (position) => String(position.id) === data.job_position_id,
    );
    const availablePositions = positions.filter(
        (position) => accountType === 'sso' || position.role?.code !== 'it_admin',
    );
    const branchRequired = branchRequiredRole(selectedPosition?.role?.code);
    const branchHidden = !selectedPosition || isGlobalRole(selectedPosition.role?.code);
    const changePosition = (positionId: string) => {
        const nextPosition = positions.find((position) => String(position.id) === positionId);
        const nextRoleCode = nextPosition?.role?.code;
        setData('job_position_id', positionId);

        if (branchLocked && branchRequiredRole(nextRoleCode)) {
            setData('branch_id', String(actorBranch?.id ?? ''));
        } else if (!nextRoleCode || isGlobalRole(nextRoleCode)) {
            setData('branch_id', '');
        }
    };
    const submit = (event: FormEvent) => {
        event.preventDefault();
        const options = {
            onSuccess: () => {
                reset();
                setEditingId(null);
                setFormOpen(false);
            },
        };
        if (editingId) {
            put(`/users/${editingId}`, options);
        } else {
            post('/users', options);
        }
    };
    const editUser = (user: User) => {
        if (user.notary) return;

        setEditingId(user.id);
        setData({
            name: user.name,
            email: user.email,
            sso_employee_id: user.sso_employee_id ?? '',
            password: '',
            branch_id: user.branch?.id ? String(user.branch.id) : '',
            job_position_id: user.job_position?.id
                ? String(user.job_position.id)
                : '',
            is_active: user.is_active,
        });
        setAccountType(user.sso_employee_id ? 'sso' : 'local');
        setFormOpen(true);
    };
    const cancelEdit = () => {
        reset();
        setEditingId(null);
        setAccountType('sso');
        setFormOpen(false);
    };
    const addUser = () => {
        reset();
        if (branchLocked && actorBranch) setData('branch_id', String(actorBranch.id));
        setEditingId(null);
        setAccountType('sso');
        setFormOpen(true);
    };
    const changeUserStatus = (user: User) => {
        setPendingStatusUser(user);
    };
    const confirmUserStatusChange = () => {
        if (!pendingStatusUser) return;
        const user = pendingStatusUser;
        const nextActive = !user.is_active;

        setStatusProcessingId(user.id);
        setPendingStatusUser(null);
        router.patch(`/users/${user.id}/status`, { is_active: nextActive }, {
            preserveScroll: true,
            onFinish: () => setStatusProcessingId(null),
        });
    };
    const confirmUserDelete = () => {
        if (!pendingDeleteUser) return;
        const user = pendingDeleteUser;

        setDeleteProcessingId(user.id);
        setPendingDeleteUser(null);
        router.delete(`/users/${user.id}`, {
            preserveScroll: true,
            onFinish: () => setDeleteProcessingId(null),
        });
    };
    const resetFilters = () => {
        const emptyFilters = { search: '', type: '', branch_id: '', position_id: '', status: '' };
        skipNextFilterRequest.current = true;
        filterForm.setData(emptyFilters);
        router.get('/users', emptyFilters, { preserveState: true, preserveScroll: true, replace: true });
    };
    useEffect(() => {
        if (!filterInitialized.current) {
            filterInitialized.current = true;
            return;
        }

        if (skipNextFilterRequest.current) {
            skipNextFilterRequest.current = false;
            return;
        }

        const timeout = window.setTimeout(() => {
            filterForm.get('/users', { preserveState: true, preserveScroll: true, replace: true });
        }, 300);

        return () => window.clearTimeout(timeout);
    }, [filterForm.data.search, filterForm.data.type, filterForm.data.branch_id, filterForm.data.position_id, filterForm.data.status]);
    return (
        <>
            <Head title="Manajemen Pengguna" />
            <div className="sim-workspace">
                <SimPageHeader
                    title="Manajemen Pengguna"
                    description="Direktori akses global untuk akun internal dan portal notaris."
                    actions={<Button type="button" onClick={addUser}><Plus className="size-4" /> Tambah pengguna</Button>}
                />
                <div className="sim-panel grid gap-3 p-4 md:grid-cols-[minmax(220px,1.4fr)_repeat(4,minmax(140px,1fr))_auto] md:items-end">
                    <div className="grid gap-2"><Label htmlFor="user-search">Cari pengguna</Label><div className="relative"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="user-search" className="pl-9" value={filterForm.data.search} onChange={(event) => filterForm.setData('search', event.target.value)} placeholder="Nama, ID SSO, email" /></div></div>
                    <FilterSelect label="Tipe akun" value={filterForm.data.type} onChange={(value) => filterForm.setData('type', value)} options={[{ value: '', label: 'Semua tipe' }, { value: 'internal', label: 'Pegawai internal' }, { value: 'notary', label: 'Portal notaris' }]} />
                    <FilterSelect label="Cabang" value={filterForm.data.branch_id} onChange={(value) => filterForm.setData('branch_id', value)} options={[{ value: '', label: 'Semua cabang' }, ...branches.map((branch) => ({ value: String(branch.id), label: `${branch.code ? `${branch.code} · ` : ''}${branch.name}` }))]} />
                    <FilterSelect label="Posisi" value={filterForm.data.position_id} onChange={(value) => filterForm.setData('position_id', value)} options={[{ value: '', label: 'Semua posisi' }, ...positions.map((position) => ({ value: String(position.id), label: position.name }))]} />
                    <FilterSelect label="Status" value={filterForm.data.status} onChange={(value) => filterForm.setData('status', value)} options={[{ value: '', label: 'Semua status' }, { value: 'active', label: 'Aktif' }, { value: 'inactive', label: 'Nonaktif' }]} />
                    <Button type="button" variant="outline" onClick={resetFilters}><RotateCcw className="size-4" />Reset</Button>
                </div>
                <div className="hidden md:block">
                    <SimTable minWidth="800px">
                        <SimTableHead>
                            <tr>
                                <SimTableSortHeader
                                    active={sort.key === 'name'}
                                    direction={sort.direction}
                                    onClick={() => toggleSort('name')}
                                >
                                    Pengguna
                                </SimTableSortHeader>
                                <SimTableSortHeader
                                    onClick={() => toggleSort('job_position')}
                                >
                                    Posisi / role
                                </SimTableSortHeader>
                                <SimTableSortHeader
                                    onClick={() => toggleSort('branch')}
                                >
                                    Unit
                                </SimTableSortHeader>
                                <SimTableSortHeader
                                    active={sort.key === 'is_active'}
                                    direction={sort.direction}
                                    onClick={() => toggleSort('is_active')}
                                >
                                    Status
                                </SimTableSortHeader>
                                <SimTableHeader>Aksi</SimTableHeader>
                            </tr>
                        </SimTableHead>
                        <tbody>
                            {sortedRows.map((user) => (
                                <tr key={user.id} className="border-t">
                                    <td className="px-4 py-3">
                                        <div className="font-medium">
                                            {user.name}
                                        </div>
                                        <div className="text-muted-foreground">
                                            {user.email}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {user.sso_employee_id
                                                ? `SSO: ${user.sso_employee_id}`
                                                : 'Login lokal'}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {user.job_position?.name ??
                                            (user.notary
                                                ? 'Mitra Notaris'
                                                : '-')}
                                        <div className="text-xs text-muted-foreground">
                                            {user.job_position?.role?.name ??
                                                ''}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {user.branch?.name ??
                                            user.notary?.name ??
                                            '-'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <SimStatusBadge
                                            label={
                                                user.is_active
                                                    ? 'Aktif'
                                                    : 'Nonaktif'
                                            }
                                            tone={
                                                user.is_active
                                                    ? 'success'
                                                    : 'neutral'
                                            }
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        {user.notary ? (
                                            <span className="text-xs text-muted-foreground">
                                                Kelola di Notaris
                                            </span>
                                        ) : (
                                            <div className="flex flex-wrap items-center gap-1">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => editUser(user)}
                                                >
                                                    <Edit3 className="size-4" />
                                                    Edit
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    disabled={statusProcessingId === user.id || (user.id === actorUserId && user.is_active)}
                                                    title={user.id === actorUserId && user.is_active ? 'Akun yang sedang digunakan tidak dapat dinonaktifkan.' : undefined}
                                                    onClick={() => changeUserStatus(user)}
                                                >
                                                    {user.is_active ? <Ban className="size-4" /> : <CircleCheck className="size-4" />}
                                                    {user.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-destructive hover:text-destructive"
                                                    disabled={deleteProcessingId === user.id}
                                                    onClick={() => setPendingDeleteUser(user)}
                                                >
                                                    <Trash2 className="size-4" />
                                                    Hapus
                                                </Button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </SimTable>
                </div>
                <div className="space-y-3 md:hidden">
                    {sortedRows.map((user) => (
                        <article
                            key={user.id}
                            className="space-y-4 border border-border bg-card p-4"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="text-lg leading-6 font-medium">
                                        {user.name}
                                    </div>
                                    <div className="mt-1 truncate text-sm text-muted-foreground">
                                        {user.email}
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        {user.sso_employee_id
                                            ? `SSO: ${user.sso_employee_id}`
                                            : 'Login lokal'}
                                    </div>
                                </div>
                                <SimStatusBadge
                                    label={
                                        user.is_active ? 'Aktif' : 'Nonaktif'
                                    }
                                    tone={
                                        user.is_active ? 'success' : 'neutral'
                                    }
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-4 text-sm">
                                <div>
                                    <div className="text-xs text-muted-foreground">
                                        Posisi
                                    </div>
                                    <div className="mt-1 leading-5">
                                        {user.job_position?.name ??
                                            (user.notary
                                                ? 'Mitra Notaris'
                                                : '-')}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-muted-foreground">
                                        Role
                                    </div>
                                    <div className="mt-1 leading-5">
                                        {user.job_position?.role?.name ?? '-'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">
                                        Unit
                                    </div>
                                    <div className="mt-1 leading-5">
                                        {user.branch?.name ??
                                            user.notary?.name ??
                                            '-'}
                                    </div>
                                </div>
                            </div>
                            {user.notary ? (
                                <div className="border-t border-border pt-3 text-center text-xs text-muted-foreground">
                                    Kelola akun dari menu Notaris
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => editUser(user)}
                                    >
                                        <Edit3 className="size-4" />
                                        Edit
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={statusProcessingId === user.id || (user.id === actorUserId && user.is_active)}
                                        title={user.id === actorUserId && user.is_active ? 'Akun yang sedang digunakan tidak dapat dinonaktifkan.' : undefined}
                                        onClick={() => changeUserStatus(user)}
                                    >
                                        {user.is_active ? <Ban className="size-4" /> : <CircleCheck className="size-4" />}
                                        {user.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="text-destructive hover:text-destructive"
                                        disabled={deleteProcessingId === user.id}
                                        onClick={() => setPendingDeleteUser(user)}
                                    >
                                        <Trash2 className="size-4" />
                                        Hapus
                                    </Button>
                                </div>
                            )}
                        </article>
                    ))}
                </div>
                <SimPagination links={users.links} />
                <Dialog
                    open={formOpen}
                    onOpenChange={(open) => {
                        if (!open) cancelEdit();
                    }}
                >
                    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                        <DialogHeader>
                                <DialogTitle>
                                {editingId ? 'Edit pengguna' : 'Tambah pengguna'}
                            </DialogTitle>
                            <DialogDescription>
                                Atur identitas, posisi, unit, dan akun pengguna.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={submit} className="grid gap-4">
                            <div className="grid grid-cols-2 gap-1 rounded-full border border-border bg-muted/20 p-1">
                                <button
                                    type="button"
                                    className={`rounded-full border px-3 py-2 text-sm font-medium transition-colors ${accountType === 'sso' ? 'border-border bg-muted text-foreground shadow-sm' : 'border-transparent text-muted-foreground hover:border-border/70 hover:text-foreground'}`}
                                    onClick={() => {
                                        setAccountType('sso');
                                        setData('email', '');
                                        setData('password', '');
                                    }}
                                >
                                    Pegawai internal (SSO)
                                </button>
                                <button
                                    type="button"
                                    className={`rounded-full border px-3 py-2 text-sm font-medium transition-colors ${accountType === 'local' ? 'border-border bg-muted text-foreground shadow-sm' : 'border-transparent text-muted-foreground hover:border-border/70 hover:text-foreground'}`}
                                    onClick={() => {
                                        setAccountType('local');
                                        setData('sso_employee_id', '');
                                        if (selectedPosition?.role?.code === 'it_admin') {
                                            setData('job_position_id', '');
                                            setData('branch_id', '');
                                        }
                                    }}
                                >
                                    Akun lokal
                                </button>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {accountType === 'sso'
                                    ? 'Pegawai login dengan ID dan password SSO. Role, cabang, dan status akses tetap diatur di SIMONTOK.'
                                    : 'Akun lokal memakai username dan password yang dikelola SIMONTOK. Akun akses darurat IT dibuat terpisah oleh petugas IT.'}
                            </p>
                            {accountType === 'sso' ? (
                                <>
                                    <Field
                                        label="ID pegawai SSO"
                                        error={errors.sso_employee_id}
                                    >
                                        <Input
                                            value={data.sso_employee_id}
                                            onChange={(e) =>
                                                setData(
                                                    'sso_employee_id',
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="Contoh: 102-119"
                                        />
                                    </Field>
                                    <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                                        Nama dan email akan diambil dari SSO
                                        saat pegawai login pertama kali.
                                    </div>
                                </>
                            ) : (
                                <>
                                    <Field label="Nama" error={errors.name}>
                                        <Input
                                            value={data.name}
                                            onChange={(e) =>
                                                setData('name', e.target.value)
                                            }
                                        />
                                    </Field>
                                    <Field
                                        label="Email / username"
                                        error={errors.email}
                                    >
                                        <Input
                                            type="email"
                                            value={data.email}
                                            onChange={(e) =>
                                                setData('email', e.target.value)
                                            }
                                        />
                                    </Field>
                                    <Field
                                        label="Password awal"
                                        error={errors.password}
                                    >
                                        <Input
                                            type="password"
                                            value={data.password}
                                            onChange={(e) =>
                                                setData(
                                                    'password',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    </Field>
                                </>
                            )}
                            <SelectField
                                label="Posisi (wajib)"
                                value={data.job_position_id}
                                onChange={changePosition}
                                options={availablePositions}
                                error={errors.job_position_id}
                            />
                            {!branchHidden && branchRequired && branchLocked && actorBranch ? (
                                <Field label="Cabang (wajib)" error={errors.branch_id}>
                                    <SimSelect
                                        value={String(actorBranch.id)}
                                        onChange={() => undefined}
                                        options={[{ value: String(actorBranch.id), label: `${actorBranch.code ? `${actorBranch.code} · ` : ''}${actorBranch.name}` }]}
                                        disabled
                                    />
                                    <p className="text-xs text-muted-foreground">Cabang mengikuti akun Anda.</p>
                                </Field>
                            ) : !branchHidden && branchRequired ? (
                                <SelectField
                                    label="Cabang (wajib)"
                                    value={data.branch_id}
                                    onChange={(v) => setData('branch_id', v)}
                                    options={branches}
                                    error={errors.branch_id}
                                />
                            ) : null}
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={cancelEdit}
                                >
                                    <X className="size-4" />
                                    Batal
                                </Button>
                                <Button type="submit" disabled={processing}>
                                    {editingId ? <Edit3 className="size-4" /> : <Plus className="size-4" />}
                                    {editingId ? 'Simpan perubahan' : 'Tambah pengguna'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
                <Dialog
                    open={pendingStatusUser !== null}
                    onOpenChange={(open) => {
                        if (!open) setPendingStatusUser(null);
                    }}
                >
                    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>
                                {pendingStatusUser?.is_active ? 'Nonaktifkan akun?' : 'Aktifkan kembali akun?'}
                            </DialogTitle>
                            <DialogDescription>
                                {pendingStatusUser?.is_active
                                    ? `Akun ${pendingStatusUser.name} tidak dapat digunakan untuk login setelah dinonaktifkan. Riwayat order dan audit tetap tersimpan.`
                                    : `Akun ${pendingStatusUser?.name} akan dapat digunakan kembali setelah diaktifkan.`}
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setPendingStatusUser(null)}>
                                Batal
                            </Button>
                            <Button
                                type="button"
                                variant={pendingStatusUser?.is_active ? 'destructive' : 'default'}
                                onClick={confirmUserStatusChange}
                            >
                                {pendingStatusUser?.is_active ? 'Nonaktifkan akun' : 'Aktifkan akun'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                <Dialog
                    open={pendingDeleteUser !== null}
                    onOpenChange={(open) => {
                        if (!open) setPendingDeleteUser(null);
                    }}
                >
                    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Hapus pengguna?</DialogTitle>
                            <DialogDescription>
                                Akun {pendingDeleteUser?.name} akan dihapus permanen. Tindakan ini tidak dapat dibatalkan. Jika akun sudah dipakai pada order atau dokumen, penghapusan akan ditolak dan akun dapat dinonaktifkan sebagai gantinya.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setPendingDeleteUser(null)}>
                                Batal
                            </Button>
                            <Button type="button" variant="destructive" onClick={confirmUserDelete}>
                                <Trash2 className="size-4" />
                                Hapus permanen
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
}
function Field({
    label,
    error,
    children,
}: {
    label: string;
    error?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="grid gap-2">
            <Label>{label}</Label>
            {children}
            <InputError message={error} />
        </div>
    );
}
function SelectField({
    label,
    value,
    onChange,
    options,
    error,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: Option[];
    error?: string;
}) {
    return (
        <Field label={label} error={error}>
            <SimSelect
                value={value}
                onChange={onChange}
                placeholder="Pilih..."
                options={options.map((option) => ({
                    value: String(option.id),
                    label: `${option.name}${option.role ? ` - ${option.role.name}` : ''}`,
                }))}
            />
        </Field>
    );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
    return <div className="min-w-0 grid gap-2"><Label>{label}</Label><SimSelect value={value} onChange={onChange} placeholder="Pilih..." options={options} /></div>;
}
Users.layout = {
    breadcrumbs: [{ title: 'Manajemen Pengguna', href: '/users' }],
};
