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
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
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
                ->paginate(15)->withQueryString()
                ->through(fn (Notary $notary) => [
                    ...$notary->toArray(),
                    'partnership_status' => $notary->partnershipStatus(),
                ]),
        ]);
    }

    public function createPortalAccount(Request $request, Notary $notary): RedirectResponse
    {
        abort_unless($notary->hasActivePartnership(), 422, 'Akun portal hanya dapat dibuat untuk kantor notaris dengan legalitas kemitraan yang aktif.');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
        ]);

        $user = User::create([
            ...$data,
            'notary_id' => $notary->id,
            'job_position_id' => JobPosition::where('code', 'NOTARIS')->value('id'),
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
            'agreement_type' => ['nullable', Rule::in(['PKS', 'MoU'])],
            'pks_no' => ['nullable', 'string', 'max:100'],
            'pks_start' => ['nullable', 'date'],
            'pks_end' => ['nullable', 'date', 'after_or_equal:pks_start'],
            'agreement_file' => ['nullable', 'file', 'mimes:pdf', 'max:10240'],
            'branch_ids' => ['array'],
            'branch_ids.*' => ['integer', 'exists:branches,id'],
        ]);

        $agreement = $this->agreementData($request, $data);
        $notary = Notary::create([
            'name' => $data['name'],
            'email' => $data['email'] ?? null,
            'phone' => $data['phone'] ?? null,
            'address' => $data['address'] ?? null,
            ...$agreement,
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
            'agreement_type' => ['nullable', Rule::in(['PKS', 'MoU'])],
            'pks_no' => ['nullable', 'string', 'max:100'],
            'pks_start' => ['nullable', 'date'],
            'pks_end' => ['nullable', 'date', 'after_or_equal:pks_start'],
            'agreement_file' => ['nullable', 'file', 'mimes:pdf', 'max:10240'],
            'branch_ids' => ['array'],
            'branch_ids.*' => ['integer', 'exists:branches,id'],
            'is_active' => ['boolean'],
        ]);

        $agreement = $this->agreementData($request, $data, $notary);
        $notary->update([
            ...collect($data)->only(['name', 'email', 'phone', 'address', 'is_active', 'agreement_type', 'pks_no', 'pks_start', 'pks_end'])->all(),
            ...$agreement,
        ]);
        $notary->branches()->syncWithPivotValues($data['branch_ids'] ?? [], ['is_active' => true]);

        Audit::record($request, 'masters', $notary, 'update_notary', 'Informasi notaris diperbarui.', [
            'after' => $notary->only(['name', 'email', 'phone', 'address', 'is_active']),
            'branch_ids' => $data['branch_ids'] ?? [],
        ]);

        return back()->with('success', 'Notaris diperbarui.');
    }

    public function previewAgreement(Notary $notary)
    {
        abort_unless($notary->agreement_file_path && Storage::disk('local')->exists($notary->agreement_file_path), 404);

        return response()->file(Storage::disk('local')->path($notary->agreement_file_path), [
            'Content-Disposition' => 'inline; filename="'.addslashes($notary->agreement_file_name ?: 'perjanjian-notaris.pdf').'"',
        ]);
    }

    private function agreementData(Request $request, array $data, ?Notary $notary = null): array
    {
        if (! $request->hasFile('agreement_file')) {
            return [];
        }

        if ($notary?->agreement_file_path) {
            Storage::disk('local')->delete($notary->agreement_file_path);
        }

        $file = $request->file('agreement_file');
        $path = $file->store('notary-agreements', 'local');

        return [
            'agreement_file_path' => $path,
            'agreement_file_name' => $file->getClientOriginalName(),
        ];
    }
}
