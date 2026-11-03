<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('legacy_import_batches', function (Blueprint $table): void {
            $table->id();
            $table->string('source_file');
            $table->char('source_sha256', 64)->unique();
            $table->string('status', 20)->default('running');
            $table->unsignedInteger('record_count')->default(0);
            $table->longText('table_counts')->nullable();
            $table->timestamp('started_at')->useCurrent();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('legacy_import_records', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('batch_id')->constrained('legacy_import_batches')->cascadeOnDelete();
            $table->string('source_table', 64);
            $table->unsignedInteger('source_row_number');
            $table->string('source_key', 120)->nullable();
            $table->longText('payload');
            $table->timestamps();

            $table->unique(['batch_id', 'source_table', 'source_row_number'], 'legacy_import_row_unique');
            $table->index(['source_table', 'source_key'], 'legacy_import_source_key_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('legacy_import_records');
        Schema::dropIfExists('legacy_import_batches');
    }
};
