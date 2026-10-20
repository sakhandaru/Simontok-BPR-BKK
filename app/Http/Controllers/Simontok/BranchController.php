<?php

namespace App\Http\Controllers\Simontok;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Support\Audit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class BranchController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('simontok/masters/branches', [
            'branches' => Branch::query()->latest()->get(['id', 'code', 'name', 'address', 'latitude', 'longitude', 'is_active']),
        ]);
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
}
