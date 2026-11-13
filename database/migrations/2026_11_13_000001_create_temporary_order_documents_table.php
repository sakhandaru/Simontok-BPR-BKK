<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('temporary_order_documents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('uploaded_by')->constrained('users');
            $table->string('core_account_id', 100)->default('');
            $table->string('collateral_key', 160);
            $table->foreignId('checklist_master_id')->nullable()->constrained('document_checklists');
            $table->foreignId('job_type_id')->nullable()->constrained('job_types');
            $table->string('display_name');
            $table->string('original_name');
            $table->string('stored_path');
            $table->string('mime_type');
            $table->unsignedBigInteger('file_size');
            $table->json('draft_context')->nullable();
            $table->timestamp('expires_at')->index();
            $table->timestamp('promoted_at')->nullable();
            $table->foreignId('order_document_id')->nullable()->constrained('order_documents')->nullOnDelete();
            $table->timestamps();
            $table->index(['order_id', 'uploaded_by', 'promoted_at'], 'temporary_documents_owner_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('temporary_order_documents');
    }
};
