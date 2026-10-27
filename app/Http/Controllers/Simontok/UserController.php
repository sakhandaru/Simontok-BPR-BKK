<?php

namespace App\Http\Controllers\Simontok;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\JobPosition;
use App\Models\Notary;
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
    public function index(): Response
    {
        return Inertia::render('simontok/administration/users', [
            'users' => User::with(['jobPosition.role', 'branch', 'notary'])
                ->orderBy('name')->paginate(15)->withQueryString(),
            'branches' => Branch::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'positions' => JobPosition::with('role:id,code,name')->orderBy('name')->get(['id', 'code', 'name', 'role_id']),
            'notaries' => Notary::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
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
            'notary_id' => ['nullable', 'integer', 'exists:notaries,id'],
            'is_active' => ['boolean'],
        ]);

        $this->validateOrganizationalAssignment($data);

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
            'notary_id' => ['nullable', 'integer', 'exists:notaries,id'],
            'is_active' => ['boolean'],
        ]);

        $this->validateOrganizationalAssignment($data);

        if ($data['notary_id'] ?? null) {
            abort_if(User::where('notary_id', $data['notary_id'])->where('id', '!=', $user->id)->exists(), 422, 'Notaris tersebut sudah memiliki akun.');
        }

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

        if (in_array($roleCode, ['kepala_cabang', 'kadiv_operasional', 'legal_admin'], true)) {
            validator($data, [
                'branch_id' => ['required', 'integer', 'exists:branches,id'],
            ], [
                'branch_id.required' => 'Cabang wajib dipilih untuk posisi ini.',
            ])->validate();
        }

        if ($roleCode === 'it_admin' && ! empty($data['branch_id'])) {
            throw ValidationException::withMessages([
                'branch_id' => 'Admin IT tidak perlu dibatasi ke cabang tertentu.',
            ]);
        }

        if ($roleCode === 'notaris') {
            validator($data, [
                'notary_id' => ['required', 'integer', 'exists:notaries,id'],
                'sso_employee_id' => ['prohibited'],
            ], [
                'notary_id.required' => 'Mitra notaris wajib dipilih untuk posisi Notaris.',
                'sso_employee_id.prohibited' => 'Akun Notaris menggunakan akun lokal.',
            ])->validate();
        }

        if (! empty($data['notary_id']) && $roleCode !== 'notaris') {
            throw ValidationException::withMessages([
                'job_position_id' => 'Mitra notaris hanya dapat dipasangkan dengan posisi Notaris.',
            ]);
        }
    }
}
