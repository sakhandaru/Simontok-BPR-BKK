<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('order_collateral_jobs', function (Blueprint $table): void {
            $table->text('deskripsi_pekerjaan')->nullable()->after('job_type_id');
        });
    }

    public function down(): void
    {
        Schema::table('order_collateral_jobs', function (Blueprint $table): void {
            $table->dropColumn('deskripsi_pekerjaan');
        });
    }
};
