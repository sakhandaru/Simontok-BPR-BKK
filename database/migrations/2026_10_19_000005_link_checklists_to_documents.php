<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_checklists', function (Blueprint $table) {
            $table->foreignId('order_document_id')->nullable()->after('document_checklist_id')->constrained('order_documents')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('order_checklists', function (Blueprint $table) {
            $table->dropForeign(['order_document_id']);
            $table->dropColumn('order_document_id');
        });
    }
};
