<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('core_dummy_accounts', 'plafon')) {
            Schema::table('core_dummy_accounts', function (Blueprint $table): void {
                $table->decimal('plafon', 18, 2)->nullable()->after('customer_name');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('core_dummy_accounts', 'plafon')) {
            Schema::table('core_dummy_accounts', function (Blueprint $table): void {
                $table->dropColumn('plafon');
            });
        }
    }
};
