<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_archives', function (Blueprint $table): void {
            $table->string('document_key', 100)->default('default')->after('document_type');
        });

        Schema::table('document_archives', function (Blueprint $table): void {
            $table->dropUnique('document_archive_version_unique');
            $table->unique(['documentable_type', 'documentable_id', 'document_type', 'document_key', 'version'], 'document_archive_version_unique');
            $table->index(['documentable_type', 'documentable_id', 'document_type', 'document_key', 'status'], 'document_archive_stream_index');
        });
    }

    public function down(): void
    {
        Schema::table('document_archives', function (Blueprint $table): void {
            $table->dropIndex('document_archive_stream_index');
            $table->dropUnique('document_archive_version_unique');
            $table->unique(['documentable_type', 'documentable_id', 'document_type', 'version'], 'document_archive_version_unique');
            $table->dropColumn('document_key');
        });
    }
};
