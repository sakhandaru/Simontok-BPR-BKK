<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // FR-ORD-01..08: order pekerjaan notaris (migrasi dari tabel_form)
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_no', 30)->unique();
            $table->foreignId('branch_id')->constrained('branches');
            $table->foreignId('notary_id')->constrained('notaries');
            $table->string('legacy_id', 20)->nullable()->index();   // id_form_notaris lama

            // Snapshot data core bank saat order dibuat (FR-ORD-03)
            $table->string('customer_name');
            $table->string('no_rekening', 30)->index();
            $table->date('tgl_realisasi')->nullable();
            $table->decimal('plafon', 18, 2)->nullable();
            $table->decimal('baki_debet', 18, 2)->nullable();
            $table->unsignedTinyInteger('kolek')->nullable();
            $table->unsignedTinyInteger('stat_kred')->nullable();

            $table->date('tgl_masuk_notaris')->nullable();
            $table->decimal('nominal', 18, 2)->nullable();          // nilai jasa notaris [KONFIRMASI: manual/otomatis]
            $table->string('skema_pembayaran', 30)->nullable();     // [KONFIRMASI]

            // Track A — status pekerjaan (§10)
            $table->string('status', 40)->default('diajukan')->index();
            $table->boolean('risk_flag')->default(false);           // covernote kedaluwarsa (FR-TRK-06)
            $table->timestamp('sla_due_at')->nullable();
            $table->text('keterangan')->nullable();

            // Kolom kontrol maker-checker (FR-CTL-04)
            $table->foreignId('created_by')->constrained('users');  // maker
            $table->foreignId('checked_by')->nullable()->constrained('users');
            $table->timestamp('checked_at')->nullable();
            $table->timestamp('sent_to_notary_at')->nullable();

            $table->timestamps();
            $table->index(['branch_id', 'status']);
        });

        // FR-ORD-05: agunan per order — Track B (dokumen) & Track C (covernote) per agunan
        Schema::create('order_collaterals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('job_type_id')->constrained('job_types');
            $table->string('agunan_id', 50)->nullable();            // kode agunan dari core bank
            $table->text('deskripsi_agunan')->nullable();
            $table->string('legacy_id', 20)->nullable()->index();   // id_tabel_agunan lama

            // Track B — status dokumen per agunan
            $table->string('doc_status', 40)->default('menunggu_verifikasi')->index();

            // Track C — covernote per agunan
            $table->string('covernote_no')->nullable();
            $table->date('covernote_start')->nullable();
            $table->date('covernote_end')->nullable();
            $table->string('covernote_status', 40)->default('aktif')->index();
            $table->unsignedSmallInteger('extension_count')->default(0);

            $table->timestamp('sla_due_at')->nullable();            // FR-TRK-03: SLA per agunan

            $table->timestamps();
            $table->index(['order_id', 'doc_status']);
        });

        // FR-NOT-05: riwayat perpanjangan covernote
        Schema::create('covernote_extensions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_collateral_id')->constrained('order_collaterals')->cascadeOnDelete();
            $table->date('old_end');
            $table->date('new_end');
            $table->foreignId('extended_by')->constrained('users'); // notaris user
            $table->text('catatan')->nullable();
            $table->string('file_path')->nullable();                // surat perpanjangan (opsional)
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('covernote_extensions');
        Schema::dropIfExists('order_collaterals');
        Schema::dropIfExists('orders');
    }
};
