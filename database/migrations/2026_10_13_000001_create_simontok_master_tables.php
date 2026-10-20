<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // FR-MST-01: master cabang (kode_kantor)
        Schema::create('branches', function (Blueprint $table) {
            $table->id();
            $table->string('code', 10)->unique();   // kode_kantor dari SSO/core bank
            $table->string('name');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        // FR-MST-01: master jenis pekerjaan (migrasi dari tabel_pekerjaan_notaris)
        Schema::create('job_types', function (Blueprint $table) {
            $table->id();
            $table->string('code', 20)->unique();   // PK, APHT, SKMHT, FID, LEGALISASI, ...
            $table->string('name');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        // SLA per jenis pekerjaan (opsional per cabang; null = semua cabang)
        Schema::create('sla_policies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('job_type_id')->constrained('job_types');
            $table->foreignId('branch_id')->nullable()->constrained('branches');
            $table->unsignedSmallInteger('days');            // hari kerja [KONFIRMASI: kalender kerja]
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['job_type_id', 'branch_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sla_policies');
        Schema::dropIfExists('job_types');
        Schema::dropIfExists('branches');
    }
};
