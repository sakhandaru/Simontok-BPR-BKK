<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // FR-AUTH-01/02, FR-MST-03: tambah kolom domain ke users bawaan
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('branch_id')->nullable()->after('password')->constrained('branches');       // kode_kantor
            $table->foreignId('notary_id')->nullable()->after('branch_id')->constrained('notaries');      // akun notaris (multi-user per kantor: [KONFIRMASI soal 3])
            $table->foreignId('job_position_id')->nullable()->after('notary_id')->constrained('job_positions'); // mapping SSO -> role
            $table->boolean('is_active')->default(true)->after('job_position_id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('job_position_id');
            $table->dropConstrainedForeignId('notary_id');
            $table->dropConstrainedForeignId('branch_id');
            $table->dropColumn('is_active');
        });
    }
};
