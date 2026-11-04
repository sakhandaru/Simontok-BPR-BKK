<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('core_staged_accounts', function (Blueprint $table): void {
            $table->id();
            $table->string('account_id', 100)->unique();
            $table->string('account_number', 50)->index();
            $table->string('customer_id', 100)->index();
            $table->string('customer_name')->index();
            $table->decimal('loan_amount', 18, 2)->nullable();
            $table->date('realization_date')->nullable();
            $table->string('branch_code', 20)->index();
            $table->string('branch_name');
            $table->string('source_provider', 50);
            $table->timestamp('synced_at')->index();
            $table->timestamp('expires_at')->nullable()->index();
            $table->timestamps();
        });

        Schema::create('core_staged_collaterals', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('core_staged_account_id')->constrained()->cascadeOnDelete();
            $table->string('collateral_id', 100);
            $table->string('collateral_code', 100)->nullable();
            $table->string('type_code', 100)->nullable();
            $table->string('type_name');
            $table->text('description')->nullable();
            $table->boolean('is_primary')->nullable();
            $table->string('status', 50)->nullable();
            $table->timestamps();
            $table->unique(['core_staged_account_id', 'collateral_id'], 'core_staged_collateral_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('core_staged_collaterals');
        Schema::dropIfExists('core_staged_accounts');
    }
};
