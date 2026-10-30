<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_collaterals', function (Blueprint $table): void {
            $table->string('nama_agunan', 255)->nullable()->after('agunan_id');
        });

        DB::table('order_collaterals')->whereNull('nama_agunan')->update([
            'nama_agunan' => DB::raw("COALESCE(NULLIF(deskripsi_agunan, ''), NULLIF(agunan_id, ''))"),
        ]);
    }

    public function down(): void
    {
        Schema::table('order_collaterals', function (Blueprint $table): void {
            $table->dropColumn('nama_agunan');
        });
    }
};
