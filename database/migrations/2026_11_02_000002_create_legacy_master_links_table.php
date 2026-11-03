<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('legacy_master_links', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('batch_id')->constrained('legacy_import_batches')->cascadeOnDelete();
            $table->string('source_table', 64);
            $table->string('source_key', 120);
            $table->string('target_table', 64);
            $table->unsignedBigInteger('target_id');
            $table->string('match_type', 24);
            $table->timestamps();

            $table->unique(['batch_id', 'source_table', 'source_key'], 'legacy_master_link_source_unique');
            $table->index(['target_table', 'target_id'], 'legacy_master_link_target_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('legacy_master_links');
    }
};
