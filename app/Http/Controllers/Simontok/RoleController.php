<?php

namespace App\Http\Controllers\Simontok;

use App\Http\Controllers\Controller;
use App\Models\Permission;
use App\Models\Role;
use App\Support\Audit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RoleController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('simontok/administration/roles', [
            'roles' => Role::with('permissions:id,code,name,module')->orderBy('name')->get(['id', 'code', 'name', 'description']),
            'permissions' => Permission::query()->orderBy('module')->orderBy('name')->get(['id', 'code', 'name', 'module']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:50', 'alpha_dash', 'unique:roles,code'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:500'],
            'permissions' => ['array'],
            'permissions.*' => ['integer', 'exists:permissions,id'],
        ]);

        $role = Role::create([
            'code' => strtolower($data['code']),
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
        ]);
        $role->permissions()->sync($data['permissions'] ?? []);
        Audit::record($request, 'roles', $role, 'create_role', 'Role ditambahkan.', [
            'after' => $role->load('permissions')->toArray(),
        ]);

        return back()->with('success', 'Role ditambahkan.');
    }

    public function update(Request $request, Role $role): RedirectResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:50', 'alpha_dash', 'unique:roles,code,'.$role->id],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:500'],
            'permissions' => ['array'],
            'permissions.*' => ['integer', 'exists:permissions,id'],
        ]);

        $role->update(['code' => strtolower($data['code']), 'name' => $data['name'], 'description' => $data['description'] ?? null]);
        $role->permissions()->sync($data['permissions'] ?? []);
        Audit::record($request, 'roles', $role, 'update_role', 'Role diperbarui.', ['after' => $role->load('permissions')->toArray()]);

        return back()->with('success', 'Role diperbarui.');
    }
}
