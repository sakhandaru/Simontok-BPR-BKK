<?php

namespace App\Http\Controllers\Simontok;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\JobPosition;
use App\Models\Notary;
use App\Models\DocumentArchive;
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
            'bankNames' => Notary::query()
                ->whereNotNull('bank_name')
                ->where('bank_name', '<>', '')
                ->select('bank_name')
                ->distinct()
                ->orderBy('bank_name')
                ->pluck('bank_name')
                ->values(),
            'notaries' => Notary::query()
                ->with(['branches:id,code,name', 'users:id,notary_id,name,email,is_active'])
                ->latest()
                ->paginate(10)->withQueryString()
                ->through(fn (Notary $notary) => [
                    ...$notary->toArray(),
                    'partnership_status' => $notary->partnershipStatus(),
                ]),
        ]);
    }

    public function createPortalAccount(Request $request, Notary $notary): RedirectResponse
    {
        abort_unless($notary->hasActivePartnership(), 422, 'Akun portal hanya dapat dibuat untuk notaris dengan legalitas kemitraan yang aktif.');
        abort_if($notary->users()->exists(), 422, 'Notaris ini sudah memiliki akun portal. Gunakan Edit untuk mengubah akun yang ada.');

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

    public function updatePortalAccount(Request $request, Notary $notary, User $user): RedirectResponse
    {
        abort_unless($user->notary_id === $notary->id, 404);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['nullable', 'string', 'min:8'],
            'is_active' => ['required', 'boolean'],
        ]);

        if (blank($data['password'] ?? null)) {
            unset($data['password']);
        }

        $user->update($data);
        Audit::record($request, 'users', $user, 'update_notary_portal_account', 'Akun portal notaris diperbarui.', [
            'notary_id' => $notary->id,
            'after' => $user->fresh()->only(['name', 'email', 'notary_id', 'is_active']),
        ]);

        return back()->with('success', 'Akun portal notaris diperbarui.');
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'bank_name' => ['nullable', 'string', 'max:100'],
            'bank_account_number' => ['nullable', 'string', 'max:50'],
            'bank_account_name' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string'],
            'agreement_type' => ['nullable', Rule::in(['PKS', 'MoU'])],
            'pks_no' => ['nullable', 'required_with:pks_start,pks_end', 'string', 'max:100'],
            'pks_start' => ['nullable', 'required_with:pks_no,pks_end', 'date'],
            'pks_end' => ['nullable', 'required_with:pks_no,pks_start', 'date', 'after_or_equal:pks_start'],
            'agreement_file' => ['nullable', 'file', 'mimes:pdf', 'max:10240'],
            'branch_ids' => ['array'],
            'branch_ids.*' => ['integer', 'exists:branches,id'],
        ], [
            'pks_no.required_with' => 'Nomor perjanjian wajib diisi jika tanggal perjanjian diisi.',
            'pks_start.required_with' => 'Tanggal mulai wajib diisi jika data perjanjian diisi.',
            'pks_end.required_with' => 'Tanggal selesai wajib diisi jika data perjanjian diisi.',
            'pks_end.after_or_equal' => 'Berlaku sampai tidak boleh sebelum berlaku mulai.',
        ]);

        $agreement = $this->agreementData($request, $data);
        $notary = Notary::create([
            'name' => $data['name'],
            'email' => $data['email'] ?? null,
            'phone' => $data['phone'] ?? null,
            'bank_name' => $data['bank_name'] ?? null,
            'bank_account_number' => $data['bank_account_number'] ?? null,
            'bank_account_name' => $data['bank_account_name'] ?? null,
            'address' => $data['address'] ?? null,
            'agreement_type' => $data['agreement_type'] ?? null,
            'pks_no' => $data['pks_no'] ?? null,
            'pks_start' => $data['pks_start'] ?? null,
            'pks_end' => $data['pks_end'] ?? null,
            ...$agreement,
            'is_active' => true,
        ]);
        $notary->branches()->syncWithPivotValues($data['branch_ids'] ?? [], ['is_active' => true]);

        if ($notary->agreement_file_path) {
            $this->createAgreementVersion($request, $notary, 'Dokumen perjanjian awal diunggah.');
        }

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
            'bank_name' => ['nullable', 'string', 'max:100'],
            'bank_account_number' => ['nullable', 'string', 'max:50'],
            'bank_account_name' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string'],
            'agreement_type' => ['nullable', Rule::in(['PKS', 'MoU'])],
            'pks_no' => ['nullable', 'required_with:pks_start,pks_end', 'string', 'max:100'],
            'pks_start' => ['nullable', 'required_with:pks_no,pks_end', 'date'],
            'pks_end' => ['nullable', 'required_with:pks_no,pks_start', 'date', 'after_or_equal:pks_start'],
            'agreement_file' => ['nullable', 'file', 'mimes:pdf', 'max:10240'],
            'branch_ids' => ['array'],
            'branch_ids.*' => ['integer', 'exists:branches,id'],
            'is_active' => ['boolean'],
        ], [
            'pks_no.required_with' => 'Nomor perjanjian wajib diisi jika tanggal perjanjian diisi.',
            'pks_start.required_with' => 'Tanggal mulai wajib diisi jika data perjanjian diisi.',
            'pks_end.required_with' => 'Tanggal selesai wajib diisi jika data perjanjian diisi.',
            'pks_end.after_or_equal' => 'Berlaku sampai tidak boleh sebelum berlaku mulai.',
        ]);

        $hasNewAgreementFile = $request->hasFile('agreement_file');
        $agreement = $this->agreementData($request, $data, $notary);
        $notary->update([
            ...collect($data)->only(['name', 'email', 'phone', 'bank_name', 'bank_account_number', 'bank_account_name', 'address', 'is_active', 'agreement_type', 'pks_no', 'pks_start', 'pks_end'])->all(),
            ...$agreement,
        ]);
        $notary->branches()->syncWithPivotValues($data['branch_ids'] ?? [], ['is_active' => true]);

        if ($hasNewAgreementFile) {
            $this->createAgreementVersion($request, $notary, 'Dokumen perjanjian diperbarui.');
        }

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

        $file = $request->file('agreement_file');
        $path = $file->store('notary-agreements', 'local');

        return [
            'agreement_file_path' => $path,
            'agreement_file_name' => $file->getClientOriginalName(),
        ];
    }

    private function createAgreementVersion(Request $request, Notary $notary, string $description): void
    {
        DocumentArchive::query()
            ->where('documentable_type', Notary::class)
            ->where('documentable_id', $notary->id)
            ->where('document_type', 'notary_agreement')
            ->where('status', 'active')
            ->update(['status' => 'archived', 'archived_at' => now()]);

        $disk = Storage::disk('local');
        $path = $disk->path($notary->agreement_file_path);
        $version = DocumentArchive::create([
            'documentable_type' => Notary::class,
            'documentable_id' => $notary->id,
            'document_type' => 'notary_agreement',
            'document_key' => 'default',
            'category' => 'legalitas_rekanan',
            'version' => ((int) DocumentArchive::query()->where('documentable_type', Notary::class)->where('documentable_id', $notary->id)->where('document_type', 'notary_agreement')->max('version')) + 1,
            'title' => 'Perjanjian notaris',
            'original_name' => $notary->agreement_file_name ?: basename($notary->agreement_file_path),
            'storage_disk' => 'local',
            'file_path' => $notary->agreement_file_path,
            'file_size' => $disk->exists($notary->agreement_file_path) ? $disk->size($notary->agreement_file_path) : null,
            'file_hash' => is_file($path) ? hash_file('sha256', $path) : null,
            'status' => 'active',
            'metadata' => [
                'agreement_type' => $notary->agreement_type,
                'pks_no' => $notary->pks_no,
                'pks_start' => $notary->pks_start?->format('Y-m-d'),
                'pks_end' => $notary->pks_end?->format('Y-m-d'),
            ],
            'uploaded_by' => $request->user()?->id,
            'change_note' => $description,
        ]);

        Audit::record($request, 'documents', $notary, 'upload_notary_agreement', $description, [
            'version_id' => $version->id,
            'version' => $version->version,
            'file_name' => $version->original_name,
            'file_hash' => $version->file_hash,
            'notary_id' => $notary->id,
        ]);
    }
}
