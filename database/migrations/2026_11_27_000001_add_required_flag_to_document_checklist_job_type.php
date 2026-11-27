<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_checklist_job_type', function (Blueprint $table): void {
            $table->boolean('is_required')->default(false)->after('job_type_id');
        });
    }

    public function down(): void
    {
        Schema::table('document_checklist_job_type', function (Blueprint $table): void {
            $table->dropColumn('is_required');
        });
    }
};
