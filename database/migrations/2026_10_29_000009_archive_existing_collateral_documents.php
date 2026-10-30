<?php

use App\Models\OrderCollateral;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        $disk = Storage::disk('local');

        DB::table('order_documents')->whereNotNull('order_collateral_id')->orderBy('id')->each(function (object $document) use ($disk): void {
            $keySource = $document->display_name ?: $document->document_type;
            $documentKey = Str::limit(Str::slug($keySource, '_'), 96, '');
            $documentKey = $documentKey !== '' ? $documentKey : 'dokumen';
            $version = ((int) DB::table('document_archives')
                ->where('documentable_type', OrderCollateral::class)
                ->where('documentable_id', $document->order_collateral_id)
                ->where('document_type', 'collateral_document')
                ->where('document_key', $documentKey)
                ->max('version')) + 1;
            $absolutePath = $disk->path($document->stored_path);

            DB::table('document_archives')->where([
                'documentable_type' => OrderCollateral::class,
                'documentable_id' => $document->order_collateral_id,
                'document_type' => 'collateral_document',
                'document_key' => $documentKey,
                'status' => 'active',
            ])->update(['status' => 'archived', 'archived_at' => now()]);

            DB::table('document_archives')->insert([
                'documentable_type' => OrderCollateral::class,
                'documentable_id' => $document->order_collateral_id,
                'document_type' => 'collateral_document',
                'document_key' => $documentKey,
                'category' => $document->document_type === 'final' ? 'hasil_pekerjaan' : 'dokumen_agunan',
                'version' => $version,
                'title' => $keySource,
                'original_name' => $document->original_name,
                'storage_disk' => 'local',
                'file_path' => $document->stored_path,
                'file_size' => $document->file_size,
                'file_hash' => is_file($absolutePath) ? hash_file('sha256', $absolutePath) : null,
                'status' => 'active',
                'metadata' => json_encode(['order_id' => $document->order_id, 'order_document_id' => $document->id, 'order_document_type' => $document->document_type]),
                'uploaded_by' => $document->uploaded_by,
                'change_note' => 'Migrasi dokumen agunan yang sudah tersimpan.',
                'created_at' => $document->created_at ?? now(),
                'updated_at' => $document->updated_at ?? now(),
            ]);
        });
    }

    public function down(): void
    {
        DB::table('document_archives')->where('category', 'dokumen_agunan')->delete();
    }
};
