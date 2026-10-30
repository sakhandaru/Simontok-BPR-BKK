<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('document_archives')
            ->select('documentable_type', 'documentable_id', 'document_type', 'document_key')
            ->groupBy('documentable_type', 'documentable_id', 'document_type', 'document_key')
            ->get()
            ->each(function (object $stream): void {
                $archives = DB::table('document_archives')
                    ->where('documentable_type', $stream->documentable_type)
                    ->where('documentable_id', $stream->documentable_id)
                    ->where('document_type', $stream->document_type)
                    ->where('document_key', $stream->document_key)
                    ->orderBy('id')
                    ->get(['id']);

                foreach ($archives as $index => $archive) {
                    $isLatest = $index === $archives->count() - 1;
                    DB::table('document_archives')->where('id', $archive->id)->update([
                        'version' => $index + 1,
                        'status' => $isLatest ? 'active' : 'archived',
                        'archived_at' => $isLatest ? null : now(),
                    ]);
                }
            });
    }

    public function down(): void
    {
        // Version sequence correction is intentionally not reverted.
    }
};
