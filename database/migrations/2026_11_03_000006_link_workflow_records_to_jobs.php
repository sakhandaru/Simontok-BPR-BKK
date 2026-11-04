<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['order_progress', 'order_documents', 'order_revisions', 'order_status_histories'] as $tableName) {
            if (! Schema::hasColumn($tableName, 'order_collateral_job_id')) {
                Schema::table($tableName, function (Blueprint $table): void {
                    $table->foreignId('order_collateral_job_id')->nullable()->after('order_collateral_id')->constrained('order_collateral_jobs')->nullOnDelete();
                    $table->index('order_collateral_job_id');
                });
            }
        }
    }

    public function down(): void
    {
        foreach (['order_progress', 'order_documents', 'order_revisions', 'order_status_histories'] as $tableName) {
            if (Schema::hasColumn($tableName, 'order_collateral_job_id')) {
                Schema::table($tableName, function (Blueprint $table) use ($tableName): void {
                    $table->dropForeign(['order_collateral_job_id']);
                    $table->dropIndex($tableName.'_order_collateral_job_id_index');
                    $table->dropColumn('order_collateral_job_id');
                });
            }
        }
    }
};
