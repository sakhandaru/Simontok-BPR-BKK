<?php

use App\Models\OrderChecklist;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('document_archives')->whereIn('category', ['dokumen_agunan', 'hasil_pekerjaan'])->orderBy('id')->each(function (object $archive): void {
            $documentId = data_get(json_decode($archive->metadata, true), 'order_document_id');
            if (! $documentId) {
                return;
            }

            $checklistName = OrderChecklist::query()->where('order_document_id', $documentId)->with('documentChecklist')->first()?->documentChecklist?->name;
            if (! $checklistName) {
                return;
            }

            $documentKey = Str::limit(Str::slug($checklistName, '_'), 96, '');
            if ($documentKey === '') {
                return;
            }

            DB::table('document_archives')->where('id', $archive->id)->update([
                'title' => $checklistName,
                'document_key' => $documentKey,
            ]);
        });
    }

    public function down(): void
    {
        // Display names are an improvement to migrated metadata and do not affect stored files.
    }
};
