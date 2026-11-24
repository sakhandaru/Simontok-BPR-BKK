<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_checklist_job_type', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('document_checklist_id')->constrained('document_checklists')->cascadeOnDelete();
            $table->foreignId('job_type_id')->constrained('job_types')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['document_checklist_id', 'job_type_id']);
        });

        DB::table('document_checklists')
            ->whereNotNull('job_type_id')
            ->select(['id', 'job_type_id'])
            ->orderBy('id')
            ->each(function (object $document): void {
                DB::table('document_checklist_job_type')->insertOrIgnore([
                    'document_checklist_id' => $document->id,
                    'job_type_id' => $document->job_type_id,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_checklist_job_type');
    }
};
