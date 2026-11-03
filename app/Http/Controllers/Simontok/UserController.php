<?php

namespace App\Http\Controllers\Simontok;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\JobPosition;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'type' => ['nullable', Rule::in(['internal', 'notary'])],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'position_id' => ['nullable', 'integer', 'exists:job_positions,id'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);

        $user = $request->user();
        $users = User::with(['jobPosition.role', 'branch', 'notary'])
            ->when($user->isBranchScopedUser(), fn ($query) => $query->where('branch_id', $user->branchScopeId())->whereNull('notary_id'))
            ->when(filled(config('services.sso.emergency_login')), fn ($query) => $query->where('email', '!=', config('services.sso.emergency_login')))
            ->where(fn ($query) => $query->whereNotNull('sso_employee_id')->orWhereDoesntHave('jobPosition.role', fn ($role) => $role->where('code', 'it_admin')))
            ->when(($filters['type'] ?? null) === 'internal', fn ($query) => $query->whereNull('notary_id'))
            ->when(($filters['type'] ?? null) === 'notary', fn ($query) => $query->whereNotNull('notary_id'))
            ->when($filters['branch_id'] ?? null, fn ($query, $branchId) => $query->where('branch_id', $branchId))
            ->when($filters['position_id'] ?? null, fn ($query, $positionId) => $query->where('job_position_id', $positionId))
            ->when(($filters['status'] ?? null) === 'active', fn ($query) => $query->where('is_active', true))
            ->when(($filters['status'] ?? null) === 'inactive', fn ($query) => $query->where('is_active', false))
            ->when($filters['search'] ?? null, function ($query, string $search) {
                $query->where(function ($query) use ($search) {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('sso_employee_id', 'like', "%{$search}%");
                });
            })
            ->orderBy('name')->paginate(15)->withQueryString();

        return Inertia::render('simontok/administration/users', [
            'users' => $users,
            'actorUserId' => $user->id,
            'branches' => Branch::query()->where('is_active', true)->when($user->branchScopeId(), fn ($query, int $branchId) => $query->whereKey($branchId))->orderBy('name')->get(['id', 'code', 'name']),
            'branchLocked' => $user->isBranchScopedUser(),
            'actorBranch' => $user->isBranchScopedUser() ? $user->branch?->only(['id', 'code', 'name']) : null,
            'positions' => JobPosition::with('role:id,code,name')
                ->whereHas('role', fn ($query) => $query->where('code', '!=', 'notaris')
                    ->when($user->isBranchScopedUser(), fn ($roleQuery) => $roleQuery->whereIn('code', ['pimpinan_cabang', 'kabid_ops_cabang', 'admin_legal_cabang'])))
                ->orderBy('name')->get(['id', 'code', 'name', 'role_id']),
            'filters' => [
                'search' => $filters['search'] ?? '',
                'type' => $filters['type'] ?? '',
                'branch_id' => (string) ($filters['branch_id'] ?? ''),
                'position_id' => (string) ($filters['position_id'] ?? ''),
                'status' => $filters['status'] ?? '',
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => [Rule::requiredIf(fn () => blank($request->input('sso_employee_id'))), 'nullable', 'string', 'max:255'],
            'email' => ['nullable', 'string', 'max:255', 'unique:users,email'],
            'sso_employee_id' => ['nullable', 'string', 'max:50', 'unique:users,sso_employee_id'],
            'password' => [Rule::requiredIf(fn () => blank($request->input('sso_employee_id'))), 'nullable', 'string', 'min:8'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'job_position_id' => ['required', 'integer', 'exists:job_positions,id'],
            'notary_id' => ['prohibited'],
            'is_active' => ['boolean'],
        ]);

        abort_if(filled(config('services.sso.emergency_login')) && ($data['email'] ?? null) === config('services.sso.emergency_login'), 422, 'Identitas akses darurat dikelola melalui Pengaturan Sistem.');

        $data = $this->restrictBranchScope($request, $data);

        $this->validateOrganizationalAssignment($data);
        $this->validateUniqueBranchLeadership($data);

        if (filled($data['sso_employee_id'] ?? null)) {
            $data['name'] = filled($data['name'] ?? null) ? $data['name'] : 'Pegawai SSO '.$data['sso_employee_id'];
            $data['email'] ??= $data['sso_employee_id'].'@pending.sso.local';
            $data['password'] ??= Str::random(64);
        }

        $user = User::create($data);
        Audit::record($request, 'users', $user, 'create_user', 'Pengguna ditambahkan.', [
            'after' => $user->only(['name', 'email', 'sso_employee_id', 'branch_id', 'job_position_id', 'notary_id', 'is_active']),
        ]);

        return back()->with('success', 'Pengguna ditambahkan.');
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        abort_if(filled(config('services.sso.emergency_login')) && $user->email === config('services.sso.emergency_login'), 403, 'Akun akses darurat dikelola melalui Pengaturan Sistem.');
        $this->authorizeManagedUser($request, $user);
        $data = $request->validate([
            'name' => [Rule::requiredIf(fn () => blank($request->input('sso_employee_id'))), 'nullable', 'string', 'max:255'],
            'email' => ['nullable', 'string', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'sso_employee_id' => ['nullable', 'string', 'max:50', Rule::unique('users', 'sso_employee_id')->ignore($user->id)],
            'password' => [Rule::requiredIf(fn () => blank($request->input('sso_employee_id')) && ! $user->sso_employee_id), 'nullable', 'string', 'min:8'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'job_position_id' => ['required', 'integer', 'exists:job_positions,id'],
            'notary_id' => ['prohibited'],
            'is_active' => ['boolean'],
        ]);

        abort_if(filled(config('services.sso.emergency_login')) && ($data['email'] ?? null) === config('services.sso.emergency_login'), 422, 'Identitas akses darurat tidak dapat digunakan oleh akun biasa.');

        $data = $this->restrictBranchScope($request, $data);

        $assignment = array_merge([
            'branch_id' => $user->branch_id,
            'job_position_id' => $user->job_position_id,
            'sso_employee_id' => $user->sso_employee_id,
            'is_active' => $user->is_active,
        ], $data);
        $this->validateOrganizationalAssignment($assignment);
        $this->validateUniqueBranchLeadership($assignment, $user->id);

        if (blank($data['password'] ?? null)) {
            unset($data['password']);
        }

        if (filled($data['sso_employee_id'] ?? null) && blank($data['name'] ?? null)) {
            $data['name'] = $user->name ?: 'Pegawai SSO '.$data['sso_employee_id'];
        }

        $user->update($data);
        Audit::record($request, 'users', $user, 'update_user', 'Pengguna diperbarui.', [
            'after' => $user->fresh()->only(['name', 'email', 'sso_employee_id', 'branch_id', 'job_position_id', 'notary_id', 'is_active']),
        ]);

        return back()->with('success', 'Pengguna diperbarui.');
    }

    public function updateStatus(Request $request, User $user): RedirectResponse
    {
        $this->authorizeManagedUser($request, $user);
        abort_if($user->notary_id !== null, 403, 'Akun portal notaris dikelola dari menu Notaris.');
        abort_if(filled(config('services.sso.emergency_login')) && $user->email === config('services.sso.emergency_login'), 403, 'Akun akses darurat dikelola melalui Pengaturan Sistem.');

        $data = $request->validate([
            'is_active' => ['required', 'boolean'],
        ]);
        $isActive = (bool) $data['is_active'];

        if (! $isActive && $request->user()->is($user)) {
            throw ValidationException::withMessages([
                'is_active' => 'Akun yang sedang digunakan tidak dapat dinonaktifkan.',
            ]);
        }

        if ($isActive) {
            $this->validateUniqueBranchLeadership([
                'branch_id' => $user->branch_id,
                'job_position_id' => $user->job_position_id,
                'is_active' => true,
            ], $user->id);
        }

        $wasActive = (bool) $user->is_active;
        $user->update(['is_active' => $isActive]);
        Audit::record(
            $request,
            'users',
            $user,
            $isActive ? 'activate_user' : 'deactivate_user',
            $isActive ? 'Pengguna diaktifkan.' : 'Pengguna dinonaktifkan.',
            ['before' => ['is_active' => $wasActive], 'after' => ['is_active' => $isActive]],
        );

        return back()->with('success', $isActive ? 'Pengguna diaktifkan.' : 'Pengguna dinonaktifkan.');
    }

    private function validateOrganizationalAssignment(array $data): void
    {
        $position = ! empty($data['job_position_id'])
            ? JobPosition::with('role:id,code')->find($data['job_position_id'])
            : null;
        $roleCode = $position?->role?->code;

        if (in_array($roleCode, ['pimpinan_cabang', 'kabid_ops_cabang', 'admin_legal_cabang'], true)) {
            validator($data, [
                'branch_id' => ['required', 'integer', 'exists:branches,id'],
            ], [
                'branch_id.required' => 'Cabang wajib dipilih untuk posisi ini.',
            ])->validate();
        }

        if (in_array($roleCode, ['it_admin', 'direksi_pusat', 'kadiv_ops_pusat', 'admin_legal_pusat', 'auditor'], true) && ! empty($data['branch_id'])) {
            throw ValidationException::withMessages([
                'branch_id' => 'Admin IT tidak perlu dibatasi ke cabang tertentu.',
            ]);
        }

        if ($roleCode === 'notaris') {
            throw ValidationException::withMessages([
                'job_position_id' => 'Akun portal notaris dibuat dari menu Notaris.',
            ]);
        }

        if ($roleCode === 'it_admin' && blank($data['sso_employee_id'] ?? null)) {
            throw ValidationException::withMessages([
                'job_position_id' => 'Akun IT lokal hanya dapat dibuat atau dipulihkan melalui prosedur akses darurat IT.',
            ]);
        }
    }

    private function authorizeManagedUser(Request $request, User $user): void
    {
        $actor = $request->user();
        if ($actor->isBranchScopedUser()) {
            abort_unless($user->branch_id === $actor->branchScopeId() && $user->notary_id === null, 403);
        }
    }

    private function restrictBranchScope(Request $request, array $data): array
    {
        $actor = $request->user();
        if (! $actor->isBranchScopedUser()) {
            return $data;
        }

        if (filled($data['branch_id'] ?? null) && (int) $data['branch_id'] !== $actor->branchScopeId()) {
            throw ValidationException::withMessages(['branch_id' => 'Admin Legal Cabang hanya dapat mengelola user di cabangnya sendiri.']);
        }

        $data['branch_id'] = $actor->branchScopeId();
        return $data;
    }

    private function validateUniqueBranchLeadership(array $data, ?int $exceptUserId = null): void
    {
        $slot = User::leadershipSlotFor($data['job_position_id'] ?? null, (bool) ($data['is_active'] ?? true));

        if (! $slot || empty($data['branch_id'])) {
            return;
        }

        $exists = User::query()
            ->where('branch_id', $data['branch_id'])
            ->where('leadership_slot', $slot)
            ->when($exceptUserId, fn ($query) => $query->where('id', '!=', $exceptUserId))
            ->exists();

        if ($exists) {
            $label = $slot === 'pimpinan_cabang' ? 'Pimpinan Cabang' : 'Kabid Operasional';
            throw ValidationException::withMessages([
                'job_position_id' => "Cabang ini sudah memiliki {$label} aktif.",
            ]);
        }
    }
}
