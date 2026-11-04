<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->string('core_account_id', 100)->nullable()->after('legacy_id')->index();
            $table->string('core_customer_id', 100)->nullable()->after('core_account_id');
            $table->json('core_snapshot')->nullable()->after('core_customer_id');
            $table->timestamp('core_synced_at')->nullable()->after('core_snapshot');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropIndex(['core_account_id']);
            $table->dropColumn(['core_account_id', 'core_customer_id', 'core_snapshot', 'core_synced_at']);
        });
    }
};
