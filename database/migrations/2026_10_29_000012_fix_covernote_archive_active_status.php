<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('document_archives')->where('category', 'covernote')->update(['status' => 'archived', 'archived_at' => now()]);
        DB::table('document_archives')->select('documentable_type', 'documentable_id', 'document_type', 'document_key')->where('category', 'covernote')->groupBy('documentable_type', 'documentable_id', 'document_type', 'document_key')->get()->each(function (object $stream): void {
            $latestId = DB::table('document_archives')->where('documentable_type', $stream->documentable_type)->where('documentable_id', $stream->documentable_id)->where('document_type', $stream->document_type)->where('document_key', $stream->document_key)->where('category', 'covernote')->max('id');
            DB::table('document_archives')->where('id', $latestId)->update(['status' => 'active', 'archived_at' => null]);
        });
    }

    public function down(): void
    {
        // Status normalization is safe to keep when rolling back this migration.
    }
};
