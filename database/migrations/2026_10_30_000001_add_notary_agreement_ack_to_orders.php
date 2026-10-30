<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->foreignId('notary_agreement_archive_id')->nullable()->after('sent_to_notary_at')->constrained('document_archives')->nullOnDelete();
            $table->timestamp('notary_agreement_acknowledged_at')->nullable()->after('notary_agreement_archive_id');
            $table->foreignId('notary_agreement_acknowledged_by')->nullable()->after('notary_agreement_acknowledged_at')->constrained('users')->nullOnDelete();
        });

        Schema::create('order_step_fees', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('order_collateral_id')->constrained('order_collaterals')->cascadeOnDelete();
            $table->foreignId('job_type_step_id')->nullable()->constrained('job_type_steps')->nullOnDelete();
            $table->string('step_name');
            $table->decimal('amount', 18, 2)->default(0);
            $table->foreignId('entered_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['order_collateral_id', 'job_type_step_id'], 'order_step_fee_step_unique');
            $table->index(['order_id', 'order_collateral_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_step_fees');
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('notary_agreement_acknowledged_by');
            $table->dropConstrainedForeignId('notary_agreement_archive_id');
            $table->dropColumn('notary_agreement_acknowledged_at');
        });
    }
};
