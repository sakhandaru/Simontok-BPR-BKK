<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_progress', function (Blueprint $table) {
            $table->string('status', 120)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('order_progress', function (Blueprint $table) {
            $table->string('status', 40)->nullable()->change();
        });
    }
};
