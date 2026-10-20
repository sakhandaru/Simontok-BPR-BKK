<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('order_collaterals', function (Blueprint $table) {
            $table->string('covernote_status', 40)->nullable()->default(null)->change();
        });
    }

    public function down(): void
    {
        Schema::table('order_collaterals', function (Blueprint $table) {
            $table->string('covernote_status', 40)->default('aktif')->nullable(false)->change();
        });
    }
};
