<?php

use App\Models\Notary;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_archives', function (Blueprint $table): void {
            $table->id();
            $table->string('documentable_type');
            $table->unsignedBigInteger('documentable_id');
            $table->string('document_type', 60);
            $table->string('category', 60);
            $table->unsignedInteger('version');
            $table->string('title');
            $table->string('original_name');
            $table->string('storage_disk', 30)->default('local');
            $table->string('file_path');
            $table->unsignedBigInteger('file_size')->nullable();
            $table->string('file_hash', 64)->nullable();
            $table->string('status', 20)->default('active');
            $table->json('metadata')->nullable();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('change_note')->nullable();
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();
            $table->unique(['documentable_type', 'documentable_id', 'document_type', 'version'], 'document_archive_version_unique');
            $table->index(['documentable_type', 'documentable_id', 'document_type', 'status'], 'document_archive_lookup_index');
            $table->index(['category', 'status']);
        });

        DB::table('notary_agreement_versions')->orderBy('id')->each(function (object $version): void {
            DB::table('document_archives')->insert([
                'documentable_type' => Notary::class,
                'documentable_id' => $version->notary_id,
                'document_type' => 'notary_agreement',
                'document_key' => 'default',
                'category' => 'legalitas_rekanan',
                'version' => $version->version,
                'title' => 'Perjanjian notaris',
                'original_name' => $version->file_name,
                'storage_disk' => 'local',
                'file_path' => $version->file_path,
                'file_size' => $version->file_size,
                'file_hash' => $version->file_hash,
                'status' => $version->status,
                'metadata' => json_encode([
                    'agreement_type' => $version->agreement_type,
                    'pks_no' => $version->pks_no,
                    'pks_start' => $version->pks_start,
                    'pks_end' => $version->pks_end,
                ]),
                'uploaded_by' => $version->uploaded_by,
                'change_note' => $version->change_note,
                'archived_at' => $version->archived_at,
                'created_at' => $version->created_at,
                'updated_at' => $version->updated_at,
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_archives');
    }
};
