<?php

namespace App\Http\Controllers\Simontok;

use App\Http\Controllers\Controller;
use App\Models\DocumentChecklist;
use App\Models\Order;
use App\Models\TemporaryOrderDocument;
use App\Support\TemporaryOrderDocuments;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class TemporaryOrderDocumentController extends Controller
{
    public function index(Request $request, Order $order): JsonResponse
    {
        TemporaryOrderDocuments::authorize($request, $order);
        $documents = TemporaryOrderDocuments::pending($order)->orderByDesc('updated_at')->get();

        return response()->json([
            'documents' => $documents->map->forClient()->values(),
            'draftContext' => $documents->first()?->draft_context,
        ])->header('Cache-Control', 'private, no-store');
    }

    public function store(Request $request, Order $order): JsonResponse
    {
        TemporaryOrderDocuments::authorize($request, $order);
        $data = $request->validate([
            'id' => ['required', 'uuid'],
            'file' => ['required', 'file', 'mimes:pdf', 'max:10240'],
            'checklist_master_id' => ['nullable', 'integer', 'exists:document_checklists,id'],
            'job_type_id' => ['nullable', 'integer', 'exists:job_types,id'],
            'display_name' => ['nullable', 'string', 'max:255'],
            'collateral_index' => ['required', 'integer', 'min:0'],
            'draft_context' => ['required', 'json', 'max:65536'],
        ], [
            'file.required' => 'Pilih file PDF terlebih dahulu.',
            'file.mimes' => 'Dokumen harus berupa PDF.',
            'file.max' => 'Ukuran PDF maksimal 10 MB.',
        ]);
        $context = json_decode($data['draft_context'], true);
        $context = validator(['context' => $context], [
            'context' => ['required', 'array'],
            'context.core_account_id' => ['nullable', 'string', 'max:100'],
            'context.collaterals' => ['required', 'array', 'max:100'],
            'context.collaterals.*' => ['array'],
            'context.collaterals.*.agunan_id' => ['nullable', 'string', 'max:50'],
            'context.collaterals.*.id' => ['nullable', 'integer'],
            'context.collaterals.*.draft_key' => ['nullable', 'uuid'],
        ])->validate()['context'];
        $context = Arr::only($context, ['core_account_id', 'branch_id', 'notary_id', 'customer_name', 'no_rekening', 'tgl_masuk_notaris', 'tgl_realisasi', 'plafon', 'nominal', 'skema_pembayaran', 'keterangan', 'collaterals', 'customer_marital_status']);
        $collateral = $context['collaterals'][$data['collateral_index']] ?? null;
        if (! $collateral || TemporaryOrderDocuments::collateralKey($collateral) === 'draft:') {
            throw ValidationException::withMessages(['file' => 'Pilih agunan untuk dokumen ini terlebih dahulu.']);
        }
        $key = TemporaryOrderDocuments::collateralKey($collateral);
        $checklist = ! empty($data['checklist_master_id']) ? DocumentChecklist::where('is_active', true)->findOrFail($data['checklist_master_id']) : null;
        if ($checklist && (int) $checklist->job_type_id !== (int) ($data['job_type_id'] ?? null)) {
            throw ValidationException::withMessages(['file' => 'Checklist tidak sesuai dengan jenis pekerjaan.']);
        }
        if (! $checklist && blank($data['display_name'] ?? null)) {
            throw ValidationException::withMessages(['display_name' => 'Isi nama dokumen pendukung.']);
        }
        if (! $checklist && ! empty($data['job_type_id'])) {
            throw ValidationException::withMessages(['file' => 'Pilih checklist untuk dokumen pekerjaan ini.']);
        }

        $path = null;
        $oldPath = null;
        try {
            $temporary = DB::transaction(function () use ($request, $order, $data, $context, $key, $checklist, &$path, &$oldPath) {
                $lockedOrder = Order::whereKey($order->id)->lockForUpdate()->firstOrFail();
                TemporaryOrderDocuments::authorize($request, $lockedOrder);
                $temporary = TemporaryOrderDocument::whereKey($data['id'])->lockForUpdate()->first();
                if ($temporary) {
                    $this->authorizeDocument($request, $order, $temporary);
                    abort_unless($temporary->core_account_id === (string) ($context['core_account_id'] ?? '')
                        && $temporary->collateral_key === $key
                        && (int) $temporary->checklist_master_id === (int) ($data['checklist_master_id'] ?? null)
                        && (int) $temporary->job_type_id === (int) ($data['job_type_id'] ?? null), 422, 'Identitas dokumen berubah. Muat ulang halaman.');
                } elseif ($checklist) {
                    $temporary = TemporaryOrderDocument::where('order_id', $order->id)
                        ->where('core_account_id', $context['core_account_id'] ?? '')->where('collateral_key', $key)
                        ->where('checklist_master_id', $checklist->id)->where('job_type_id', $data['job_type_id'] ?? null)
                        ->whereNull('promoted_at')->lockForUpdate()->first();
                }
                $file = $request->file('file');
                $path = $file->store("documents/{$order->order_no}/staged", 'local');
                if (! $path || ! Storage::disk('local')->exists($path)) {
                    throw ValidationException::withMessages(['file' => 'File gagal disimpan. Silakan coba lagi.']);
                }
                $oldPath = $temporary?->stored_path;
                $temporary ??= new TemporaryOrderDocument(['id' => $data['id']]);
                $temporary->fill([
                    'order_id' => $order->id,
                    'uploaded_by' => $request->user()->id,
                    'core_account_id' => $context['core_account_id'] ?? '',
                    'collateral_key' => $key,
                    'checklist_master_id' => $checklist?->id,
                    'job_type_id' => $data['job_type_id'] ?? null,
                    'display_name' => $checklist?->name ?? $data['display_name'],
                    'original_name' => $file->getClientOriginalName(),
                    'stored_path' => $path,
                    'mime_type' => $file->getMimeType(),
                    'file_size' => $file->getSize(),
                    'draft_context' => $context,
                    'expires_at' => now()->addDays(max(1, config('temporary_documents.retention_days'))),
                ])->save();

                TemporaryOrderDocument::where('order_id', $order->id)
                    ->whereNull('promoted_at')
                    ->update(['draft_context' => $context]);

                return $temporary;
            });
        } catch (\Throwable $exception) {
            if ($path) {
                Storage::disk('local')->delete($path);
            }
            throw $exception;
        }
        if ($oldPath) {
            Storage::disk('local')->delete($oldPath);
        }

        return response()->json(['document' => $temporary->forClient()])->header('Cache-Control', 'private, no-store');
    }

    public function preview(Request $request, Order $order, TemporaryOrderDocument $temporaryDocument)
    {
        TemporaryOrderDocuments::authorize($request, $order);
        $this->authorizeDocument($request, $order, $temporaryDocument);
        abort_if($temporaryDocument->expires_at->isPast(), 410, 'Dokumen sementara sudah kedaluwarsa.');
        abort_unless(Storage::disk('local')->exists($temporaryDocument->stored_path), 404, 'File tidak tersedia. Unggah ulang dokumen.');

        return response()->file(Storage::disk('local')->path($temporaryDocument->stored_path), [
            'Content-Type' => 'application/pdf',
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function destroy(Request $request, Order $order, TemporaryOrderDocument $temporaryDocument): JsonResponse
    {
        TemporaryOrderDocuments::authorize($request, $order);
        $path = DB::transaction(function () use ($request, $order, $temporaryDocument) {
            $lockedOrder = Order::whereKey($order->id)->lockForUpdate()->firstOrFail();
            TemporaryOrderDocuments::authorize($request, $lockedOrder);
            $temporary = TemporaryOrderDocument::whereKey($temporaryDocument->id)->lockForUpdate()->firstOrFail();
            $this->authorizeDocument($request, $order, $temporary);
            $path = $temporary->stored_path;
            $temporary->delete();

            return $path;
        });
        Storage::disk('local')->delete($path);

        return response()->json(['deleted' => true]);
    }

    private function authorizeDocument(Request $request, Order $order, TemporaryOrderDocument $document): void
    {
        abort_unless($document->order_id === (int) $order->id && $document->promoted_at === null, 404);
    }
}
