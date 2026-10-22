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
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'job_position_id' => ['nullable', 'integer', 'exists:job_positions,id'],
            'notary_id' => ['nullable', 'integer', 'exists:notaries,id'],
            'is_active' => ['boolean'],
        ]);

        $this->validateOrganizationalAssignment($data);

        $user = User::create($data);
        Audit::record($request, 'users', $user, 'create_user', 'Pengguna ditambahkan.', [
            'after' => $user->only(['name', 'email', 'branch_id', 'job_position_id', 'notary_id', 'is_active']),
        ]);

        return back()->with('success', 'Pengguna ditambahkan.');
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['nullable', 'string', 'min:8'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'job_position_id' => ['nullable', 'integer', 'exists:job_positions,id'],
            'notary_id' => ['nullable', 'integer', 'exists:notaries,id'],
            'is_active' => ['boolean'],
        ]);

        $this->validateOrganizationalAssignment($data);

        if ($data['notary_id'] ?? null) {
            abort_if(User::where('notary_id', $data['notary_id'])->where('id', '!=', $user->id)->exists(), 422, 'Notaris tersebut sudah memiliki akun.');
            $data['job_position_id'] = null;
        }

        if (blank($data['password'] ?? null)) {
            unset($data['password']);
        }

        $user->update($data);
        Audit::record($request, 'users', $user, 'update_user', 'Pengguna diperbarui.', [
            'after' => $user->fresh()->only(['name', 'email', 'branch_id', 'job_position_id', 'notary_id', 'is_active']),
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
            throw IlluminateValidationValidationException::withMessages([
                'branch_id' => 'Admin IT tidak perlu dibatasi ke cabang tertentu.',
            ]);
        }

        if (! empty($data['notary_id']) && ! empty($data['job_position_id'])) {
            throw IlluminateValidationValidationException::withMessages([
                'job_position_id' => 'Akun notaris tidak menggunakan posisi user internal.',
            ]);
        }
    }
}
