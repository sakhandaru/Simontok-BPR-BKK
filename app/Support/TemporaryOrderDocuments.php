<?php

namespace App\Support;

use App\Enums\OrderDocumentType;
use App\Enums\TrackAStatus;
use App\Models\Order;
use App\Models\OrderChecklist;
use App\Models\TemporaryOrderDocument;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class TemporaryOrderDocuments
{
    public static function authorize(Request $request, Order $order): void
    {
        abort_unless($request->user() && ! $request->user()->notary_id && $order->isVisibleTo($request->user()), 404);
        abort_unless(in_array($order->status, [TrackAStatus::Draft, TrackAStatus::Diajukan, TrackAStatus::PerluPerbaikanOrder], true)
            && $order->sent_to_notary_at === null, 409, 'Order sudah diajukan. Muat ulang halaman.');
    }

    public static function pending(Order $order, ?int $userId = null)
    {
        return TemporaryOrderDocument::where('order_id', $order->id)
            ->when($userId !== null, fn ($query) => $query->where('uploaded_by', $userId))
            ->whereNull('promoted_at')->where('expires_at', '>', now());
    }

    public static function collateralKey(array $collateral): string
    {
        if (filled($collateral['agunan_id'] ?? null)) {
            return 'agunan:'.$collateral['agunan_id'];
        }

        return filled($collateral['id'] ?? null)
            ? 'saved:'.$collateral['id']
            : 'draft:'.($collateral['draft_key'] ?? '');
    }

    // Called while the order is locked by submitForApproval. A rollback also restores temporary status.
    public function promote(Request $request, Order $order, array $ids, array $savedCollaterals, array $submitted): void
    {
        $documents = self::pending($order)->whereIn('id', $ids)->lockForUpdate()->get()->keyBy('id');
        if ($documents->count() !== count($ids)) {
            throw ValidationException::withMessages(['temporary_document_ids' => 'Dokumen sementara tidak tersedia atau sudah kedaluwarsa. Muat ulang dan unggah kembali dokumen yang diperlukan.']);
        }

        foreach ($ids as $id) {
            $temporary = $documents[$id];
            $index = collect($submitted)->search(fn ($item) => self::collateralKey($item) === $temporary->collateral_key);
            $collateral = $index !== false ? ($savedCollaterals[$index] ?? null) : null;
            if (! $collateral || $temporary->core_account_id !== (string) $order->core_account_id) {
                throw ValidationException::withMessages(['temporary_document_ids' => 'Dokumen sementara tidak sesuai dengan rekening atau agunan pengajuan.']);
            }
            $job = $temporary->job_type_id ? $collateral->jobs()->where('job_type_id', $temporary->job_type_id)->first() : null;
            $checklist = $temporary->checklist_master_id ? OrderChecklist::where('order_id', $order->id)
                ->where('order_collateral_id', $collateral->id)
                ->where('document_checklist_id', $temporary->checklist_master_id)
                ->where('order_collateral_job_id', $job?->id)->first() : null;
            if (($temporary->checklist_master_id && ! $checklist) || ($temporary->job_type_id && ! $job)) {
                throw ValidationException::withMessages(['temporary_document_ids' => 'Checklist dokumen tidak sesuai dengan pekerjaan agunan.']);
            }
            if (! Storage::disk('local')->exists($temporary->stored_path)) {
                throw ValidationException::withMessages(['temporary_document_ids' => 'File '.$temporary->original_name.' tidak tersedia. Unggah ulang sebelum mengajukan.']);
            }
            $type = $checklist ? OrderDocumentType::DokumenAwal : OrderDocumentType::Lainnya;
            $document = $order->documents()->create([
                'order_collateral_id' => $collateral->id,
                'order_collateral_job_id' => $job?->id,
                'document_type' => $type,
                'display_name' => $temporary->display_name,
                'version' => ((int) $collateral->documents()->where('document_type', $type->value)->max('version')) + 1,
                'original_name' => $temporary->original_name,
                'stored_name' => basename($temporary->stored_path),
                'stored_path' => $temporary->stored_path,
                'mime_type' => $temporary->mime_type,
                'file_size' => $temporary->file_size,
                'uploaded_by' => $temporary->uploaded_by,
            ]);
            $checklist?->update(['order_document_id' => $document->id, 'is_checked' => true, 'checked_by' => $request->user()->id, 'checked_at' => now()]);
            $temporary->update(['promoted_at' => now(), 'order_document_id' => $document->id, 'draft_context' => null]);
            DocumentArchiveService::archiveOrderDocument($request, $document);
            Audit::record($request, 'documents', $order, 'upload', 'Dokumen sementara disahkan bersama pengajuan.', ['document_id' => $document->id, 'temporary_document_id' => $temporary->id]);
        }
    }
}
