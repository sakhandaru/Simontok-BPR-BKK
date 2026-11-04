<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('core_dummy_accounts')) {
            Schema::create('core_dummy_accounts', function (Blueprint $table): void {
                $table->id();
                $table->string('account_id', 100)->unique();
                $table->string('account_number', 50)->index();
                $table->string('customer_id', 100);
                $table->string('customer_name')->index();
                $table->string('branch_code', 20)->index();
                $table->string('branch_name');
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('core_dummy_collaterals')) {
            Schema::create('core_dummy_collaterals', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('core_dummy_account_id')->constrained()->cascadeOnDelete();
                $table->string('collateral_id', 100);
                $table->string('type_name');
                $table->text('description')->nullable();
                $table->timestamps();
            });
        }

        $hasExpectedUniqueIndex = collect(Schema::getIndexes('core_dummy_collaterals'))
            ->contains(fn (array $index): bool => $index['name'] === 'core_dummy_collateral_account_unique');

        if (! $hasExpectedUniqueIndex) {
            Schema::table('core_dummy_collaterals', function (Blueprint $table): void {
                $table->unique(['core_dummy_account_id', 'collateral_id'], 'core_dummy_collateral_account_unique');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('core_dummy_collaterals');
        Schema::dropIfExists('core_dummy_accounts');
    }
};
