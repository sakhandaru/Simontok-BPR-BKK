<?php

namespace App\Http\Controllers\Simontok;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Notary;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class NotaryController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('simontok/masters/notaries', [
            'branches' => Branch::orderBy('name')->get(['id', 'code', 'name']),
            'notaries' => Notary::query()
                ->with(['branches:id,code,name', 'users:id,notary_id,name,email,is_active'])
                ->latest()
                ->paginate(15)->withQueryString(),
        ]);
    }

    public function createPortalAccount(Request $request, Notary $notary): RedirectResponse
    {
        abort_unless($notary->is_active, 422);
        abort_if($notary->users()->exists(), 422, 'Notaris ini sudah memiliki akun portal.');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
        ]);

        $user = User::create([
            ...$data,
            'notary_id' => $notary->id,
            'is_active' => true,
        ]);

        Audit::record($request, 'users', $user, 'create_notary_portal_account', 'Akun portal notaris dibuat.', [
            'notary_id' => $notary->id,
            'after' => $user->only(['name', 'email', 'notary_id', 'is_active']),
        ]);

        return back()->with('success', 'Akun portal notaris berhasil dibuat.');
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'address' => ['nullable', 'string'],
            'branch_ids' => ['array'],
            'branch_ids.*' => ['integer', 'exists:branches,id'],
        ]);

        $notary = Notary::create([
            'name' => $data['name'],
            'email' => $data['email'] ?? null,
            'phone' => $data['phone'] ?? null,
            'address' => $data['address'] ?? null,
            'is_active' => true,
        ]);
        $notary->branches()->syncWithPivotValues($data['branch_ids'] ?? [], ['is_active' => true]);

        Audit::record($request, 'masters', $notary, 'create_notary', 'Notaris ditambahkan.', [
            'after' => $notary->only(['name', 'email', 'phone', 'is_active']),
            'branch_ids' => $data['branch_ids'] ?? [],
        ]);

        return back()->with('success', 'Notaris ditambahkan.');
    }

    public function update(Request $request, Notary $notary): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'address' => ['nullable', 'string'],
            'branch_ids' => ['array'],
            'branch_ids.*' => ['integer', 'exists:branches,id'],
            'is_active' => ['boolean'],
        ]);

        $notary->update(collect($data)->only(['name', 'email', 'phone', 'address', 'is_active'])->all());
        $notary->branches()->syncWithPivotValues($data['branch_ids'] ?? [], ['is_active' => true]);

        Audit::record($request, 'masters', $notary, 'update_notary', 'Informasi notaris diperbarui.', [
            'after' => $notary->only(['name', 'email', 'phone', 'address', 'is_active']),
            'branch_ids' => $data['branch_ids'] ?? [],
        ]);

        return back()->with('success', 'Notaris diperbarui.');
    }
}
