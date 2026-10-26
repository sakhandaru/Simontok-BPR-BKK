import { Head, useForm } from '@inertiajs/react';
import { Edit3, UserPlus, X } from 'lucide-react';
import { FormEvent, useState } from 'react';
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
    role?: { name: string };
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

export default function Users({
    users,
    branches,
    positions,
    notaries,
}: {
    users: { data: User[]; links: SimPaginationLink[] };
    branches: Option[];
    positions: Option[];
    notaries: Option[];
}) {
    const { data, setData, post, put, processing, reset, errors } = useForm({
        name: '',
        email: '',
        sso_employee_id: '',
        password: '',
        branch_id: '',
        job_position_id: '',
        notary_id: '',
        is_active: true,
    });
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [accountType, setAccountType] = useState<AccountType>('sso');
    const { sortedRows, sort, toggleSort } = useSimTableSort(
        users.data,
        'name',
    );
    const selectedPosition = positions.find(
        (position) => String(position.id) === data.job_position_id,
    );
    const selectedRole = selectedPosition?.role?.name ?? '';
    const branchRequired = [
        'Pimpinan Cabang',
        'Kadiv Operasional Cabang',
        'Admin Legal',
    ].includes(selectedRole);
    const branchHidden = selectedRole === 'IT Administrator';
    const submit = (event: FormEvent) => {
        event.preventDefault();
        const options = {
            onSuccess: () => {
                reset();
                setEditingId(null);
                setFormOpen(false);
            },
        };
        editingId
            ? put(`/users/${editingId}`, options)
            : post('/users', options);
    };
    const editUser = (user: User) => {
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
            notary_id: user.notary?.id ? String(user.notary.id) : '',
            is_active: user.is_active,
        });
        setAccountType(user.sso_employee_id ? 'sso' : 'local');
        setFormOpen(true);
    };
    const openCreate = () => {
        reset();
        setEditingId(null);
        setAccountType('sso');
        setFormOpen(true);
    };
    const cancelEdit = () => {
        reset();
        setEditingId(null);
        setAccountType('sso');
        setFormOpen(false);
    };
    return (
        <>
            <Head title="Manajemen Pengguna" />
            <div className="sim-workspace">
                <SimPageHeader
                    title="Manajemen Pengguna"
                    description="Atur akun internal, posisi, dan akses portal notaris."
                    actions={
                        <Button type="button" onClick={openCreate}>
                            <UserPlus className="size-4" />
                            Tambah pengguna
                        </Button>
                    }
                />
                <SimPagination links={users.links} />
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
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => editUser(user)}
                                        >
                                            <Edit3 className="size-4" />
                                            Edit
                                        </Button>
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
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => editUser(user)}
                            >
                                <Edit3 className="size-4" />
                                Edit pengguna
                            </Button>
                        </article>
                    ))}
                </div>
                <Dialog
                    open={formOpen}
                    onOpenChange={(open) => {
                        if (!open) cancelEdit();
                    }}
                >
                    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>
                                {editingId
                                    ? 'Edit pengguna'
                                    : 'Tambah pengguna'}
                            </DialogTitle>
                            <DialogDescription>
                                Atur identitas, posisi, unit, dan akun pengguna.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={submit} className="grid gap-4">
                            <div className="grid grid-cols-2 rounded-md border bg-muted/20 p-1">
                                <button
                                    type="button"
                                    className={`rounded-sm px-3 py-2 text-sm font-medium transition-colors ${accountType === 'sso' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                    onClick={() => {
                                        setAccountType('sso');
                                        setData('email', '');
                                        setData('password', '');
                                        setData('notary_id', '');
                                    }}
                                >
                                    Pegawai internal (SSO)
                                </button>
                                <button
                                    type="button"
                                    className={`rounded-sm px-3 py-2 text-sm font-medium transition-colors ${accountType === 'local' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                    onClick={() => {
                                        setAccountType('local');
                                        setData('sso_employee_id', '');
                                    }}
                                >
                                    Akun lokal
                                </button>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {accountType === 'sso'
                                    ? 'Pegawai login dengan ID dan password SSO. Role, cabang, dan status akses tetap diatur di SIMONTOK.'
                                    : 'Akun lokal memakai username dan password yang dikelola SIMONTOK.'}
                            </p>
                            <Field label="Nama" error={errors.name}>
                                <Input
                                    value={data.name}
                                    onChange={(e) =>
                                        setData('name', e.target.value)
                                    }
                                />
                            </Field>
                            {accountType === 'sso' ? (
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
                                    <p className="text-xs text-muted-foreground">
                                        ID ini menjadi kunci akun SSO. Nama dan
                                        email akan disegarkan saat login
                                        pertama.
                                    </p>
                                </Field>
                            ) : (
                                <>
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
                                label="Posisi"
                                value={data.job_position_id}
                                onChange={(v) => setData('job_position_id', v)}
                                options={positions}
                                error={errors.job_position_id}
                            />
                            {!branchHidden && (
                                <SelectField
                                    label={`Cabang${branchRequired ? ' (wajib)' : ' (opsional)'}`}
                                    value={data.branch_id}
                                    onChange={(v) => setData('branch_id', v)}
                                    options={branches}
                                    error={errors.branch_id}
                                />
                            )}
                            {accountType === 'local' && (
                                <SelectField
                                    label="Mitra notaris (opsional)"
                                    value={data.notary_id}
                                    onChange={(v) => setData('notary_id', v)}
                                    options={notaries}
                                    error={errors.notary_id}
                                />
                            )}
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
                                    {editingId ? (
                                        <Edit3 className="size-4" />
                                    ) : (
                                        <UserPlus className="size-4" />
                                    )}
                                    {editingId
                                        ? 'Simpan perubahan'
                                        : 'Tambah pengguna'}
                                </Button>
                            </DialogFooter>
                        </form>
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
Users.layout = {
    breadcrumbs: [{ title: 'Manajemen Pengguna', href: '/users' }],
};
