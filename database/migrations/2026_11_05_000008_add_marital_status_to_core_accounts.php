<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('core_dummy_accounts', function (Blueprint $table): void {
            $table->string('marital_status', 30)->nullable()->after('customer_name');
        });

        Schema::table('core_staged_accounts', function (Blueprint $table): void {
            $table->string('marital_status', 30)->nullable()->after('customer_name');
        });
    }

    public function down(): void
    {
        Schema::table('core_staged_accounts', fn (Blueprint $table) => $table->dropColumn('marital_status'));
        Schema::table('core_dummy_accounts', fn (Blueprint $table) => $table->dropColumn('marital_status'));
    }
};
