<?php

namespace App\Http\Controllers\Simontok;

use App\Enums\OrderDocumentType;
use App\Enums\TrackAStatus;
use App\Enums\TrackBDocStatus;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderCollateral;
use App\Models\OrderDocument;
use App\Support\Audit;
use App\Support\InAppNotification;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class OrderDocumentController extends Controller
{
    public function update(Request $request, Order $order, OrderDocument $document): RedirectResponse
    {
        $this->authorizeDocumentAccess($request, $order);
        abort_unless(! $request->user()?->notary_id && $document->order_id === $order->id, 403);
        abort_unless(in_array($order->status, [TrackAStatus::Draft, TrackAStatus::Diajukan, TrackAStatus::PerluPerbaikanOrder], true), 422, 'Dokumen terkunci setelah order masuk tahap berikutnya.');
        $data = $request->validate(['display_name' => ['nullable', 'string', 'max:255'], 'file' => ['nullable', 'file', 'mimes:pdf', 'max:10240']]);
        if ($document->document_type === OrderDocumentType::Lainnya) {
            validator($data, ['display_name' => ['required', 'string', 'max:255']], ['display_name.required' => 'Nama dokumen pendukung wajib diisi.'])->validate();
        }
        DB::transaction(function () use ($request, $order, $document, $data) {
            $changes = ['display_name' => $data['display_name'] ?? $document->display_name];
            if ($request->hasFile('file')) {
                $file = $request->file('file');
                $path = $file->store("documents/{$order->order_no}", 'local');
                $changes += ['version' => $document->version + 1, 'original_name' => $file->getClientOriginalName(), 'stored_name' => basename($path), 'stored_path' => $path, 'mime_type' => $file->getMimeType(), 'file_size' => $file->getSize(), 'uploaded_by' => $request->user()->id];
            }
            $document->update($changes);
            Audit::record($request, 'documents', $order, 'update', 'Dokumen diperbarui.', ['document_id' => $document->id]);
        });
        return back()->with('success', 'Dokumen diperbarui.');
    }

    public function destroy(Request $request, Order $order, OrderDocument $document): RedirectResponse
    {
        $this->authorizeDocumentAccess($request, $order);
        abort_unless(! $request->user()?->notary_id && $document->order_id === $order->id, 403);
        abort_unless(in_array($order->status, [TrackAStatus::Draft, TrackAStatus::Diajukan, TrackAStatus::PerluPerbaikanOrder], true), 422, 'Dokumen terkunci setelah order masuk tahap berikutnya.');
        DB::transaction(function () use ($request, $order, $document) {
            \App\Models\OrderChecklist::where('order_document_id', $document->id)->update(['order_document_id' => null, 'is_checked' => false, 'checked_by' => null, 'checked_at' => null]);
            Storage::disk('local')->delete($document->stored_path);
            $document->delete();
            Audit::record($request, 'documents', $order, 'delete', 'Dokumen dihapus.', ['document_id' => $document->id]);
        });
        return back()->with('success', 'Dokumen dihapus.');
    }

    public function storeBatch(Request $request, Order $order): RedirectResponse
    {
        $this->authorizeDocumentAccess($request, $order);
        abort_unless(! $request->user()?->notary_id, 403);
        abort_unless(in_array($order->status, [TrackAStatus::Draft, TrackAStatus::Diajukan, TrackAStatus::PerluPerbaikanOrder], true), 422, 'Dokumen awal hanya dapat diunggah saat order masih dalam tahap persiapan.');

        $data = $request->validate([
            'order_collateral_id' => ['required', 'integer', 'exists:order_collaterals,id'],
            'documents' => ['required', 'array', 'min:1'],
            'documents.*.checklist_id' => ['nullable', 'integer', 'exists:order_checklists,id'],
            'documents.*.display_name' => ['nullable', 'string', 'max:255'],
            'documents.*.file' => ['required', 'file', 'mimes:pdf', 'max:10240'],
        ]);

        abort_unless($order->collaterals()->whereKey($data['order_collateral_id'])->exists(), 403);
        $checklistIds = collect($data['documents'])->pluck('checklist_id')->filter()->values();
        if ($checklistIds->isNotEmpty()) {
            abort_unless($order->collaterals()->whereKey($data['order_collateral_id'])->whereHas('checklists', fn ($query) => $query->whereIn('id', $checklistIds))->exists(), 403);
        }

        DB::transaction(function () use ($request, $order, $data) {
            foreach ($data['documents'] as $index => $item) {
                $file = $request->file("documents.$index.file");
                $isChecklist = ! empty($item['checklist_id']);
                $type = $isChecklist ? OrderDocumentType::DokumenAwal : OrderDocumentType::Lainnya;
                $checklist = $isChecklist
                    ? \App\Models\OrderChecklist::with('documentChecklist')->whereKey($item['checklist_id'])->where('order_id', $order->id)->firstOrFail()
                    : null;
                if (! $isChecklist) {
                    validator($item, ['display_name' => ['required', 'string', 'max:255']], ['display_name.required' => 'Nama dokumen pendukung wajib diisi.'])->validate();
                }
                $version = OrderDocument::where('order_id', $order->id)->where('order_collateral_id', $data['order_collateral_id'])->where('document_type', $type->value)->max('version') + 1;
                $path = $file->store("documents/{$order->order_no}", 'local');
                $document = $order->documents()->create([
                    'order_collateral_id' => $data['order_collateral_id'],
                    'document_type' => $type,
                    'display_name' => $item['display_name'] ?? $checklist?->documentChecklist?->name,
                    'version' => $version,
                    'original_name' => $file->getClientOriginalName(),
                    'stored_name' => basename($path),
                    'stored_path' => $path,
                    'mime_type' => $file->getMimeType(),
                    'file_size' => $file->getSize(),
                    'uploaded_by' => $request->user()->id,
                ]);
                if ($isChecklist) {
                    $checklist->update(['order_document_id' => $document->id, 'is_checked' => true, 'checked_by' => $request->user()->id, 'checked_at' => now()]);
                }
                Audit::record($request, 'documents', $order, 'upload', 'Dokumen awal diunggah.', ['document_id' => $document->id, 'document_type' => $type->value, 'collateral_id' => $data['order_collateral_id']]);
            }
        });

        return back()->with('success', 'Seluruh dokumen agunan berhasil diunggah.');
    }

    public function store(Request $request, Order $order): RedirectResponse
    {
        $this->authorizeDocumentAccess($request, $order);

        $data = $request->validate([
            'order_collateral_id' => ['nullable', 'integer', 'exists:order_collaterals,id'],
            'order_checklist_id' => ['nullable', 'integer', 'exists:order_checklists,id'],
            'document_type' => ['required', Rule::in(array_map(fn (OrderDocumentType $type) => $type->value, OrderDocumentType::cases()))],
            'display_name' => ['nullable', 'string', 'max:255'],
            'file' => ['required', 'file', 'mimes:pdf', 'max:10240'],
        ]);

        if ($request->user()?->notary_id) {
            $progressComplete = $this->allProgressComplete($order);
            $allowedTypes = match ($order->status) {
                TrackAStatus::DokumenValid, TrackAStatus::ProsesAkta, TrackAStatus::ProsesBpnSamsat => ['draft', 'resi_bpn'],
                TrackAStatus::DraftDiunggah, TrackAStatus::MenungguValidasiBpr => ['final'],
                default => [],
            };
            abort_unless(in_array($data['document_type'], $allowedTypes, true), 422, 'Jenis dokumen belum tersedia pada tahap order ini.');
            if ($data['document_type'] === OrderDocumentType::Final->value) {
                abort_unless($this->allProgressComplete($order), 422, 'Seluruh langkah progres harus selesai sebelum dokumen final diajukan.');
            }
        } else {
            abort_unless(in_array($order->status, [TrackAStatus::Draft, TrackAStatus::Diajukan, TrackAStatus::PerluPerbaikanOrder], true), 422, 'Dokumen awal hanya dapat diunggah saat order masih dalam tahap persiapan.');
            abort_unless(in_array($data['document_type'], [OrderDocumentType::DokumenAwal->value, OrderDocumentType::Lainnya->value], true), 422, 'Pada tahap ini hanya dokumen awal yang dapat diunggah.');
            if ($data['document_type'] === OrderDocumentType::Lainnya->value) {
                validator($data, ['display_name' => ['required', 'string', 'max:255']], ['display_name.required' => 'Nama dokumen pendukung wajib diisi.'])->validate();
            }
        }

        if ($data['order_collateral_id'] ?? null) {
            abort_unless($order->collaterals()->whereKey($data['order_collateral_id'])->exists(), 403);
        }
        if ($data['order_checklist_id'] ?? null) {
            abort_unless($order->collaterals()->whereHas('checklists', fn ($query) => $query->whereKey($data['order_checklist_id']))->exists(), 403);
        }

        DB::transaction(function () use ($request, $order, $data) {
            $file = $request->file('file');
            $type = OrderDocumentType::from($data['document_type']);
            $version = OrderDocument::where('order_id', $order->id)
                ->where('order_collateral_id', $data['order_collateral_id'] ?? null)
                ->where('document_type', $type->value)
                ->max('version') + 1;
            $path = $file->store("documents/{$order->order_no}", 'local');

            $document = $order->documents()->create([
                'order_collateral_id' => $data['order_collateral_id'] ?? null,
                'document_type' => $type,
                'display_name' => $data['display_name'] ?? null,
                'version' => $version,
                'original_name' => $file->getClientOriginalName(),
                'stored_name' => basename($path),
                'stored_path' => $path,
                'mime_type' => $file->getMimeType(),
                'file_size' => $file->getSize(),
                'uploaded_by' => $request->user()->id,
            ]);

            if (! empty($data['order_checklist_id'])) {
                $checklist = \App\Models\OrderChecklist::whereKey($data['order_checklist_id'])->where('order_id', $order->id)->firstOrFail();
                $checklist->update(['order_document_id' => $document->id, 'is_checked' => true, 'checked_by' => $request->user()->id, 'checked_at' => now()]);
            }

            $this->applyUploadStatus($request, $order, $data['order_collateral_id'] ?? null, $type);

            Audit::record($request, 'documents', $order, 'upload', 'Dokumen diunggah.', [
                'document_id' => $document->id,
                'document_type' => $type->value,
                'collateral_id' => $data['order_collateral_id'] ?? null,
            ]);
        });

        return back()->with('success', 'Dokumen diunggah.');
    }

    public function validateFinal(Request $request, Order $order, OrderDocument $document): RedirectResponse
    {
        $this->authorizeDocumentAccess($request, $order);
        abort_unless($document->order_id === $order->id, 404);
        abort_unless($document->document_type === OrderDocumentType::Final, 422);

        DB::transaction(function () use ($request, $order, $document) {
            $document->update([
                'validated_by' => $request->user()->id,
                'validated_at' => now(),
            ]);

            if ($document->order_collateral_id) {
                OrderCollateral::whereKey($document->order_collateral_id)->update([
                    'doc_status' => TrackBDocStatus::FinalDivalidasi,
                ]);
            }

            $allFinal = $order->collaterals()
                ->where('doc_status', '!=', TrackBDocStatus::FinalDivalidasi->value)
                ->doesntExist();

            if ($allFinal) {
                $before = $order->status;
                $order->update(['status' => TrackAStatus::DokumenFinalDiunggah]);
                $order->statusHistories()->create([
                    'track' => 'A',
                    'from_status' => $before->value,
                    'to_status' => TrackAStatus::DokumenFinalDiunggah->value,
                    'actor_type' => 'user',
                    'actor_id' => $request->user()->id,
                    'reason' => 'Semua dokumen final tervalidasi.',
                ]);
            }

            Audit::record($request, 'documents', $order, 'validate_final', 'Dokumen final divalidasi.', [
                'document_id' => $document->id,
            ]);
        });

        return back()->with('success', 'Dokumen final divalidasi.');
    }

    public function submitFinal(Request $request, Order $order): RedirectResponse
    {
        $this->authorizeDocumentAccess($request, $order);
        abort_unless($request->user()?->notary_id, 403);
        abort_unless($order->status === TrackAStatus::DraftDiunggah, 422, 'Dokumen final belum siap diajukan.');
        $order->loadMissing('collaterals');
        abort_unless($order->collaterals->every(fn ($collateral) => $collateral->doc_status === TrackBDocStatus::FinalDiunggah), 422, 'Seluruh dokumen final wajib diunggah sebelum diajukan.');
        $order->update(['status' => TrackAStatus::MenungguValidasiBpr, 'final_submitted_at' => now()]);
        $order->statusHistories()->create(['track' => 'B', 'from_status' => TrackAStatus::DraftDiunggah->value, 'to_status' => TrackAStatus::MenungguValidasiBpr->value, 'actor_type' => 'notary', 'actor_id' => $request->user()->id, 'reason' => 'Paket dokumen final diajukan untuk approval Admin Legal.']);
        Audit::record($request, 'documents', $order, 'submit_final', 'Paket dokumen final diajukan.', []);
        InAppNotification::forOrderMaker($order, 'Dokumen final menunggu approval', "Dokumen final order {$order->order_no} menunggu approval Admin Legal.");
        return back()->with('success', 'Dokumen final diajukan untuk approval.');
    }

    public function download(Request $request, Order $order, OrderDocument $document): StreamedResponse
    {
        $this->authorizeDocumentAccess($request, $order);
        abort_unless($document->order_id === $order->id, 404);

        Audit::record($request, 'documents', $order, 'download', 'Dokumen diunduh.', [
            'document_id' => $document->id,
        ]);

        return Storage::disk('local')->download($document->stored_path, $document->original_name);
    }

    public function returnFinalRevision(Request $request, Order $order, OrderDocument $document): RedirectResponse
    {
        $this->authorizeDocumentAccess($request, $order);
        abort_unless($document->order_id === $order->id, 404);
        abort_unless($document->document_type === OrderDocumentType::Final, 422);
        $data = $request->validate(['reason' => ['required', 'string', 'max:2000']]);

        $document->update(['validated_by' => null, 'validated_at' => null]);
        if ($document->order_collateral_id) {
            OrderCollateral::whereKey($document->order_collateral_id)->update(['doc_status' => TrackBDocStatus::PerluPerbaikan]);
        }
        $before = $order->status;
        $order->update(['status' => TrackAStatus::DraftDiunggah]);
        $order->statusHistories()->create([
            'track' => 'B',
            'order_collateral_id' => $document->order_collateral_id,
            'from_status' => $before->value,
            'to_status' => TrackAStatus::DraftDiunggah->value,
            'actor_type' => 'user',
            'actor_id' => $request->user()->id,
            'reason' => $data['reason'],
        ]);
        Audit::record($request, 'documents', $order, 'return_final_revision', 'Dokumen final dikembalikan untuk perbaikan.', ['document_id' => $document->id, 'reason' => $data['reason']]);
        InAppNotification::forNotary($order, 'Dokumen final perlu diperbaiki', "Dokumen final order {$order->order_no} perlu diperbaiki.");

        return back()->with('success', 'Dokumen final dikembalikan untuk perbaikan.');
    }

    private function applyUploadStatus(Request $request, Order $order, ?int $collateralId, OrderDocumentType $type): void
    {
        if (! $request->user()?->notary_id) {
            return;
        }

        if (! $collateralId) {
            return;
        }

        $collateral = OrderCollateral::find($collateralId);
        if (! $collateral) {
            return;
        }

        $fromDoc = $collateral->doc_status;
        $toDoc = match ($type) {
            OrderDocumentType::Draft, OrderDocumentType::ResiBpn => TrackBDocStatus::DraftDiunggah,
            OrderDocumentType::Final => TrackBDocStatus::FinalDiunggah,
            default => null,
        };

        if (! $toDoc) {
            return;
        }

        $collateral->update(['doc_status' => $toDoc]);
        $order->statusHistories()->create([
            'order_collateral_id' => $collateral->id,
            'track' => 'B',
            'from_status' => $fromDoc->value,
            'to_status' => $toDoc->value,
            'actor_type' => $request->user()->notary_id ? 'notary' : 'user',
            'actor_id' => $request->user()->id,
            'reason' => 'Dokumen '.$type->value.' diunggah.',
        ]);

        $fromOrder = $order->status;
        $toOrder = match ($type) {
            OrderDocumentType::Draft, OrderDocumentType::ResiBpn => TrackAStatus::DraftDiunggah,
            OrderDocumentType::Final => TrackAStatus::DraftDiunggah,
            default => null,
        };

        if ($toOrder && $order->status !== TrackAStatus::MenungguValidasiBpr) {
            $order->update(['status' => $toOrder]);
            $order->statusHistories()->create([
                'track' => 'A',
                'from_status' => $fromOrder->value,
                'to_status' => $toOrder->value,
                'actor_type' => $request->user()->notary_id ? 'notary' : 'user',
                'actor_id' => $request->user()->id,
                'reason' => 'Upload dokumen '.$type->value.'.',
            ]);
        }
    }

    private function authorizeDocumentAccess(Request $request, Order $order): void
    {
        $user = $request->user();

        if ($user?->notary_id) {
            abort_unless($order->notary_id === $user->notary_id && $order->sent_to_notary_at !== null, 403);
            return;
        }

        abort_unless($user && $order->isVisibleTo($user), 404);
    }

    private function allProgressComplete(Order $order): bool
    {
        $order->loadMissing('collaterals.jobType.steps', 'collaterals.progress');

        return $order->collaterals->every(function ($collateral) {
            $required = $collateral->jobType->steps->where('is_active', true)->count();
            $completed = $collateral->progress->whereNotNull('completed_at')->pluck('status')->unique()->count();

            return $required > 0 && $completed >= $required;
        });
    }
}
