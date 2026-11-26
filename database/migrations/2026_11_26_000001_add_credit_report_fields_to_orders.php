<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->string('status_kredit', 80)->nullable()->after('stat_kred');
            $table->date('tgl_jatuh_tempo')->nullable()->after('tgl_realisasi');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropColumn(['status_kredit', 'tgl_jatuh_tempo']);
        });
    }
};
