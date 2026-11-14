<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('temporary_order_documents', function (Blueprint $table): void {
            $table->index(['order_id', 'promoted_at'], 'temporary_documents_order_status_index');
        });
    }

    public function down(): void
    {
        Schema::table('temporary_order_documents', function (Blueprint $table): void {
            $table->dropIndex('temporary_documents_order_status_index');
        });
    }
};
