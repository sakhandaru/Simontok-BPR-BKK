<?php

use App\Models\Notary;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notary_agreement_versions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('notary_id')->constrained('notaries')->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->string('agreement_type', 10)->nullable();
            $table->string('pks_no')->nullable();
            $table->date('pks_start')->nullable();
            $table->date('pks_end')->nullable();
            $table->string('file_path');
            $table->string('file_name');
            $table->unsignedBigInteger('file_size')->nullable();
            $table->string('file_hash', 64)->nullable();
            $table->string('status', 20)->default('active');
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('change_note')->nullable();
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();
            $table->unique(['notary_id', 'version']);
            $table->index(['notary_id', 'status']);
        });

        Notary::query()->whereNotNull('agreement_file_path')->each(function (Notary $notary): void {
            $disk = Storage::disk('local');
            $absolutePath = $disk->path($notary->agreement_file_path);

            DB::table('notary_agreement_versions')->insert([
                'notary_id' => $notary->id,
                'version' => 1,
                'agreement_type' => $notary->agreement_type,
                'pks_no' => $notary->pks_no,
                'pks_start' => $notary->pks_start?->format('Y-m-d'),
                'pks_end' => $notary->pks_end?->format('Y-m-d'),
                'file_path' => $notary->agreement_file_path,
                'file_name' => $notary->agreement_file_name ?: basename($notary->agreement_file_path),
                'file_size' => $disk->exists($notary->agreement_file_path) ? $disk->size($notary->agreement_file_path) : null,
                'file_hash' => is_file($absolutePath) ? hash_file('sha256', $absolutePath) : null,
                'status' => 'active',
                'change_note' => 'Migrasi dokumen perjanjian yang sudah tersimpan.',
                'created_at' => $notary->created_at ?? now(),
                'updated_at' => $notary->updated_at ?? now(),
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notary_agreement_versions');
    }
};
