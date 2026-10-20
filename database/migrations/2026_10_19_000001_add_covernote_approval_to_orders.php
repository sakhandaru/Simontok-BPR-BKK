<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->date('komitmen_penyelesaian')->nullable()->after('tgl_masuk_notaris');
            $table->timestamp('covernote_submitted_at')->nullable()->after('komitmen_penyelesaian');
            $table->timestamp('covernote_approved_at')->nullable()->after('covernote_submitted_at');
            $table->foreignId('covernote_approved_by')->nullable()->after('covernote_approved_at')->constrained('users');
        });

        Schema::table('order_collaterals', function (Blueprint $table) {
            $table->string('covernote_file_path')->nullable()->after('covernote_end');
        });
    }

    public function down(): void
    {
        Schema::table('order_collaterals', fn (Blueprint $table) => $table->dropColumn('covernote_file_path'));
        Schema::table('orders', function (Blueprint $table) {
            $table->dropForeign(['covernote_approved_by']);
            $table->dropColumn(['komitmen_penyelesaian', 'covernote_submitted_at', 'covernote_approved_at', 'covernote_approved_by']);
        });
    }
};
