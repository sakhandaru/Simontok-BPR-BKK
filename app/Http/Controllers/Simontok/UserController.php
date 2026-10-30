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

        $users = User::with(['jobPosition.role', 'branch', 'notary'])
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
            'branches' => Branch::query()->where('is_active', true)->orderBy('name')->get(['id', 'code', 'name']),
            'positions' => JobPosition::with('role:id,code,name')
                ->whereHas('role', fn ($query) => $query->where('code', '!=', 'notaris'))
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
            'email' => ['nullable', 'email', 'max:255', 'unique:users,email'],
            'sso_employee_id' => ['nullable', 'string', 'max:50', 'unique:users,sso_employee_id'],
            'password' => [Rule::requiredIf(fn () => blank($request->input('sso_employee_id'))), 'nullable', 'string', 'min:8'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'job_position_id' => ['nullable', 'integer', 'exists:job_positions,id'],
            'notary_id' => ['prohibited'],
            'is_active' => ['boolean'],
        ]);

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
        $data = $request->validate([
            'name' => [Rule::requiredIf(fn () => blank($request->input('sso_employee_id'))), 'nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'sso_employee_id' => ['nullable', 'string', 'max:50', Rule::unique('users', 'sso_employee_id')->ignore($user->id)],
            'password' => [Rule::requiredIf(fn () => blank($request->input('sso_employee_id')) && ! $user->sso_employee_id), 'nullable', 'string', 'min:8'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'job_position_id' => ['nullable', 'integer', 'exists:job_positions,id'],
            'notary_id' => ['prohibited'],
            'is_active' => ['boolean'],
        ]);

        $assignment = array_merge([
            'branch_id' => $user->branch_id,
            'job_position_id' => $user->job_position_id,
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
