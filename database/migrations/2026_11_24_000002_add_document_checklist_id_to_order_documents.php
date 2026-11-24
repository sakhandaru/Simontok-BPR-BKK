<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_documents', function (Blueprint $table): void {
            $table->foreignId('document_checklist_id')->nullable()->after('order_id')->constrained('document_checklists')->nullOnDelete();
            $table->index(['order_id', 'document_checklist_id']);
        });
    }

    public function down(): void
    {
        Schema::table('order_documents', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('document_checklist_id');
        });
    }
};
