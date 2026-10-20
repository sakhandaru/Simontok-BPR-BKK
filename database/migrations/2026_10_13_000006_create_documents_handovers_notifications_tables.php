<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // FR-DOC-01..04: dokumen digital per order/agunan (migrasi dari notaris_documents)
        Schema::create('order_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('order_collateral_id')->nullable()->constrained('order_collaterals')->nullOnDelete();
            $table->string('document_type', 30)->index();   // dokumen_awal|draft|resi_bpn|final|bukti_bayar|tanda_terima|lainnya
            $table->unsignedSmallInteger('version')->default(1);      // draft -> revisi -> final (FR-DOC-06)
            $table->string('original_name');
            $table->string('stored_name');
            $table->string('stored_path');
            $table->string('mime_type', 100)->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->foreignId('uploaded_by')->constrained('users');
            $table->foreignId('validated_by')->nullable()->constrained('users'); // FR-DOC-02: validasi final, checker != pembuat order
            $table->timestamp('validated_at')->nullable();
            $table->timestamps();
            $table->index(['order_id', 'document_type']);
        });

        // FR-DOC-05: handover dokumen fisik (maker + checker, FR-CTL-01)
        Schema::create('order_handovers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('order_collateral_id')->nullable()->constrained('order_collaterals')->nullOnDelete(); // [KONFIRMASI: per order atau per agunan]
            $table->string('receiver_name');                  // penerima
            $table->string('method', 30);                     // kurir|titip|ambil_sendiri
            $table->date('handed_over_at');
            $table->string('receipt_path')->nullable();       // tanda terima (scan)
            $table->text('catatan')->nullable();
            $table->foreignId('maker_id')->constrained('users');
            $table->foreignId('checked_by')->nullable()->constrained('users');
            $table->timestamp('made_at')->nullable();
            $table->timestamp('checked_at')->nullable();
            $table->timestamps();
        });

        // FR-NOTIF-03: notifikasi in-app read/unread (migrasi dari app_notifications)
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->string('recipient_type', 20)->default('user');   // user|notary
            $table->unsignedBigInteger('recipient_id');
            $table->string('title');
            $table->text('message');
            $table->string('link_url')->nullable();
            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['recipient_type', 'recipient_id', 'is_read']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('order_handovers');
        Schema::dropIfExists('order_documents');
    }
};
