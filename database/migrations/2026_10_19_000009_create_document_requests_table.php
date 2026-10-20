<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('order_collateral_id')->nullable()->constrained('order_collaterals')->nullOnDelete();
            $table->foreignId('requested_by')->constrained('users');
            $table->foreignId('fulfilled_by')->nullable()->constrained('users');
            $table->string('name');
            $table->text('reason')->nullable();
            $table->string('status', 30)->default('diminta');
            $table->foreignId('order_document_id')->nullable()->constrained('order_documents')->nullOnDelete();
            $table->timestamps();
            $table->index(['order_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_requests');
    }
};
