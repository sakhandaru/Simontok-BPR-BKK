<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_progress', function (Blueprint $table) {
            $table->timestamp('completed_at')->nullable()->after('komitmen_penyelesaian');
            $table->string('evidence_path')->nullable()->after('completed_at');
        });
    }

    public function down(): void
    {
        Schema::table('order_progress', fn (Blueprint $table) => $table->dropColumn(['completed_at', 'evidence_path']));
    }
};
