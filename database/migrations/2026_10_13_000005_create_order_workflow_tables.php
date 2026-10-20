<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // FR-MST-01: master checklist dokumen (migrasi dari tabel_ceklist_notaris)
        Schema::create('document_checklists', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->foreignId('job_type_id')->nullable()->constrained('job_types'); // null = umum semua jenis
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        // Checklist per order/agunan (migrasi turunan dari tabel_ceklist_history)
        Schema::create('order_checklists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('order_collateral_id')->constrained('order_collaterals')->cascadeOnDelete();
            $table->foreignId('document_checklist_id')->constrained('document_checklists');
            $table->boolean('is_checked')->default(false);
            $table->foreignId('checked_by')->nullable()->constrained('users');
            $table->timestamp('checked_at')->nullable();
            $table->text('catatan')->nullable();
            $table->timestamps();
            $table->unique(['order_collateral_id', 'document_checklist_id'], 'order_checklists_collateral_checklist_uq');
        });

        // FR-NOT-03: log progres pekerjaan dari notaris
        Schema::create('order_progress', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('order_collateral_id')->nullable()->constrained('order_collaterals')->nullOnDelete();
            $table->string('status', 40)->nullable();
            $table->text('catatan');
            $table->date('komitmen_penyelesaian')->nullable();
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();
        });

        // Jejak transisi 4 track (FR-ORD-04, FR-AUD-01)
        Schema::create('order_status_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('order_collateral_id')->nullable()->constrained('order_collaterals')->nullOnDelete();
            $table->char('track', 1);                                // A|B|C|D
            $table->string('from_status', 40)->nullable();
            $table->string('to_status', 40);
            $table->string('actor_type', 20)->default('user');       // user|notary|system
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->text('reason')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['order_id', 'track']);
        });

        // FR-NOT-02 (minta perbaikan) & inbox perbaikan admin legal
        Schema::create('order_revisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('order_collateral_id')->nullable()->constrained('order_collaterals')->nullOnDelete();
            $table->unsignedSmallInteger('revision_no')->default(1);
            $table->foreignId('requested_by')->constrained('users');  // notaris yang minta perbaikan
            $table->text('alasan');                                   // apa yang harus diperbaiki
            $table->string('status', 20)->default('diajukan');        // diajukan|diperbaiki|selesai
            $table->foreignId('fixed_by')->nullable()->constrained('users');
            $table->timestamp('fixed_at')->nullable();
            $table->text('catatan_admin')->nullable();
            $table->timestamps();
            $table->unique(['order_id', 'revision_no']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_revisions');
        Schema::dropIfExists('order_status_histories');
        Schema::dropIfExists('order_progress');
        Schema::dropIfExists('order_checklists');
        Schema::dropIfExists('document_checklists');
    }
};
