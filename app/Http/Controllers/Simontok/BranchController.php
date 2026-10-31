<?php

namespace App\Http\Controllers\Simontok;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\JobPosition;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class BranchController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);

        return Inertia::render('simontok/masters/branches', [
            'branches' => Branch::query()
                ->with(['users' => fn ($query) => $query->whereNull('notary_id')->with('jobPosition.role:id,code,name')->orderBy('name')])
            ->when($filters['search'] ?? null, fn ($query, string $search) => $query->where(fn ($query) => $query->where('code', 'like', "%{$search}%")->orWhere('name', 'like', "%{$search}%")->orWhere('address', 'like', "%{$search}%")))
            ->when(($filters['status'] ?? null) === 'active', fn ($query) => $query->where('is_active', true))
            ->when(($filters['status'] ?? null) === 'inactive', fn ($query) => $query->where('is_active', false))
            ->latest()->paginate(10)->withQueryString()->through(fn (Branch $branch) => [
                    ...$branch->only(['id', 'code', 'name', 'address', 'latitude', 'longitude', 'is_active']),
                    'users' => $branch->users->map(fn (User $user) => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'sso_employee_id' => $user->sso_employee_id,
                        'is_active' => $user->is_active,
                        'job_position' => $user->jobPosition?->only(['id', 'name', 'code']),
                        'role' => $user->jobPosition?->role?->only(['code', 'name']),
                    ])->values()->all(),
                ]),
            'filters' => [
                'search' => $filters['search'] ?? '',
                'status' => $filters['status'] ?? '',
            ],
            'positions' => JobPosition::with('role:id,code,name')
                ->whereHas('role', fn ($query) => $query->whereIn('code', ['pimpinan_cabang', 'kabid_ops_cabang', 'admin_legal_cabang']))
                ->orderBy('name')->get(['id', 'code', 'name', 'role_id']),
        ]);
    }

    public function createInternalAccount(Request $request, Branch $branch): RedirectResponse
    {
        abort_unless($branch->is_active, 422, 'Akun internal hanya dapat ditambahkan ke kantor cabang aktif.');

        $data = $request->validate([
            'sso_employee_id' => ['required', 'string', 'max:50', 'unique:users,sso_employee_id'],
            'job_position_id' => ['required', 'integer', 'exists:job_positions,id'],
        ]);
        $this->validateBranchPosition((int) $data['job_position_id']);
        $this->validateUniqueLeadership($branch, (int) $data['job_position_id']);

        $user = User::create([
            'name' => 'Pegawai SSO '.$data['sso_employee_id'],
            'email' => $data['sso_employee_id'].'@pending.sso.local',
            'sso_employee_id' => $data['sso_employee_id'],
            'password' => Str::random(64),
            'branch_id' => $branch->id,
            'job_position_id' => $data['job_position_id'],
            'is_active' => true,
        ]);

        Audit::record($request, 'users', $user, 'create_branch_internal_account', 'Akun internal cabang ditambahkan.', [
            'branch_id' => $branch->id,
            'after' => $user->only(['name', 'email', 'sso_employee_id', 'branch_id', 'job_position_id', 'is_active']),
        ]);

        return back()->with('success', 'Akun internal cabang ditambahkan.');
    }

    public function updateInternalAccount(Request $request, Branch $branch, User $user): RedirectResponse
    {
        abort_unless($user->branch_id === $branch->id && $user->notary_id === null && $user->sso_employee_id !== null, 404);

        $data = $request->validate([
            'job_position_id' => ['required', 'integer', 'exists:job_positions,id'],
            'is_active' => ['required', 'boolean'],
        ]);
        $this->validateBranchPosition((int) $data['job_position_id']);
        $this->validateUniqueLeadership($branch, (int) $data['job_position_id'], $user->id, (bool) $data['is_active']);

        $user->update($data);
        Audit::record($request, 'users', $user, 'update_branch_internal_account', 'Akun internal cabang diperbarui.', [
            'branch_id' => $branch->id,
            'after' => $user->fresh()->only(['name', 'email', 'sso_employee_id', 'branch_id', 'job_position_id', 'is_active']),
        ]);

        return back()->with('success', 'Akun internal cabang diperbarui.');
    }

    private function validateBranchPosition(int $positionId): void
    {
        $position = JobPosition::with('role:id,code')->findOrFail($positionId);

        if (! in_array($position->role?->code, ['pimpinan_cabang', 'kabid_ops_cabang', 'admin_legal_cabang'], true)) {
            throw ValidationException::withMessages([
                'job_position_id' => 'Posisi ini tidak dapat dikelola sebagai akun internal cabang.',
            ]);
        }
    }

    public function store(Request $request): RedirectResponse
    {
        $branch = Branch::create($request->validate([
            'code' => ['required', 'string', 'max:10', 'unique:branches,code'],
            'name' => ['required', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:1000'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'is_active' => ['boolean'],
        ]));

        Audit::record($request, 'masters', $branch, 'create_branch', 'Cabang ditambahkan.', [
            'after' => $branch->only(['code', 'name', 'is_active']),
        ]);

        return back()->with('success', 'Cabang ditambahkan.');
    }

    public function update(Request $request, Branch $branch): RedirectResponse
    {
        $branch->update($request->validate([
            'code' => ['required', 'string', 'max:10', 'unique:branches,code,'.$branch->id],
            'name' => ['required', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:1000'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'is_active' => ['boolean'],
        ]));

        Audit::record($request, 'masters', $branch, 'update_branch', 'Informasi cabang diperbarui.', [
            'after' => $branch->only(['code', 'name', 'address', 'is_active']),
        ]);

        return back()->with('success', 'Cabang diperbarui.');
    }

    private function validateUniqueLeadership(Branch $branch, int $positionId, ?int $exceptUserId = null, bool $isActive = true): void
    {
        $slot = User::leadershipSlotFor($positionId, $isActive);

        if (! $slot) {
            return;
        }

        $exists = User::query()
            ->where('branch_id', $branch->id)
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
