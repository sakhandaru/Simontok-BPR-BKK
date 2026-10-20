<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // FR-PAY-01..03 & Track D: pengajuan invoice notaris (maker-checker-approver)
        Schema::create('payment_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->unique('order_id');                          // [KONFIRMASI: invoice per order atau per agunan]
            $table->string('invoice_no', 50)->nullable();
            $table->decimal('nominal', 18, 2);
            $table->string('skema_pembayaran', 30)->nullable();
            $table->string('status', 30)->default('diajukan')->index(); // Track D (§10)
            $table->text('catatan_notaris')->nullable();
            $table->timestamp('requested_at')->nullable();
            // level 2: verifikasi admin legal (checker)
            $table->foreignId('verified_by')->nullable()->constrained('users');
            $table->timestamp('verified_at')->nullable();
            $table->text('catatan_verifikasi')->nullable();
            // level 3: approval manajemen (approver)
            $table->foreignId('approved_by')->nullable()->constrained('users');
            $table->timestamp('approved_at')->nullable();
            $table->text('catatan_approver')->nullable();
            $table->foreignId('rejected_by')->nullable()->constrained('users');
            $table->timestamp('rejected_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
        });

        // FR-PAY-04: bukti pembayaran
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_request_id')->constrained('payment_requests');
            $table->foreignId('order_id')->constrained('orders');
            $table->date('paid_at');
            $table->decimal('nominal', 18, 2);
            $table->string('bukti_path')->nullable();
            $table->foreignId('uploaded_by')->constrained('users');
            $table->text('catatan')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
        Schema::dropIfExists('payment_requests');
    }
};
