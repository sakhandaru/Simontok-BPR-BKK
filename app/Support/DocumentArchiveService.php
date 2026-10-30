<?php

namespace App\Support;

use App\Models\DocumentArchive;
use App\Models\OrderDocument;
use App\Models\OrderCollateral;
use App\Models\OrderChecklist;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class DocumentArchiveService
{
    public static function archiveOrderDocument(Request $request, OrderDocument $document, string $category = 'agunan'): DocumentArchive
    {
        $checklistName = OrderChecklist::query()->where('order_document_id', $document->id)->with('documentChecklist')->first()?->documentChecklist?->name;
        $keySource = $checklistName ?: $document->display_name ?: $document->document_type->value;
        $category = $document->document_type->value === 'final' ? 'hasil_pekerjaan' : $category;
        $documentKey = Str::limit(Str::slug($keySource, '_'), 96, '');
        $documentKey = $documentKey !== '' ? $documentKey : 'dokumen';

        DocumentArchive::query()
            ->where('documentable_type', OrderCollateral::class)
            ->where('documentable_id', $document->order_collateral_id)
            ->where('document_type', 'collateral_document')
            ->where('document_key', $documentKey)
            ->where('status', 'active')
            ->update(['status' => 'archived', 'archived_at' => now()]);

        $disk = Storage::disk('local');
        $path = $disk->path($document->stored_path);
        $version = DocumentArchive::create([
            'documentable_type' => OrderCollateral::class,
            'documentable_id' => $document->order_collateral_id,
            'document_type' => 'collateral_document',
            'document_key' => $documentKey,
            'category' => $category,
            'version' => ((int) DocumentArchive::query()
                ->where('documentable_type', OrderCollateral::class)
                ->where('documentable_id', $document->order_collateral_id)
                ->where('document_type', 'collateral_document')
                ->where('document_key', $documentKey)
                ->max('version')) + 1,
            'title' => $keySource,
            'original_name' => $document->original_name,
            'storage_disk' => 'local',
            'file_path' => $document->stored_path,
            'file_size' => $document->file_size,
            'file_hash' => is_file($path) ? hash_file('sha256', $path) : null,
            'status' => 'active',
            'metadata' => [
                'order_id' => $document->order_id,
                'order_document_id' => $document->id,
                'order_collateral_id' => $document->order_collateral_id,
                'order_document_type' => $document->document_type->value,
            ],
            'uploaded_by' => $request->user()?->id,
            'change_note' => 'Dokumen agunan diunggah atau diperbarui.',
        ]);

        return $version;
    }

    public static function archiveFile(Request $request, string $documentableType, int $documentableId, string $documentType, string $documentKey, string $category, string $title, string $originalName, string $path, ?int $fileSize, array $metadata = [], string $changeNote = 'Dokumen diunggah.'): DocumentArchive
    {
        DocumentArchive::query()
            ->where('documentable_type', $documentableType)
            ->where('documentable_id', $documentableId)
            ->where('document_type', $documentType)
            ->where('document_key', $documentKey)
            ->where('status', 'active')
            ->update(['status' => 'archived', 'archived_at' => now()]);

        $disk = Storage::disk('local');
        $absolutePath = $disk->path($path);

        return DocumentArchive::create([
            'documentable_type' => $documentableType,
            'documentable_id' => $documentableId,
            'document_type' => $documentType,
            'document_key' => $documentKey,
            'category' => $category,
            'version' => ((int) DocumentArchive::query()->where('documentable_type', $documentableType)->where('documentable_id', $documentableId)->where('document_type', $documentType)->where('document_key', $documentKey)->max('version')) + 1,
            'title' => $title,
            'original_name' => $originalName,
            'storage_disk' => 'local',
            'file_path' => $path,
            'file_size' => $fileSize,
            'file_hash' => is_file($absolutePath) ? hash_file('sha256', $absolutePath) : null,
            'status' => 'active',
            'metadata' => $metadata,
            'uploaded_by' => $request->user()?->id,
            'change_note' => $changeNote,
        ]);
    }
}
