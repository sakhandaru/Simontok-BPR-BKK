<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('order_checklists', 'order_collateral_job_id')) {
            Schema::table('order_checklists', function (Blueprint $table): void {
                $table->foreignId('order_collateral_job_id')->nullable()->after('order_collateral_id')->constrained('order_collateral_jobs')->nullOnDelete();
                $table->index('order_collateral_job_id');
            });

        }

        $indexes = collect(Schema::getIndexes('order_checklists'))->pluck('name');
        if (! $indexes->contains('order_checklists_collateral_idx')) {
            Schema::table('order_checklists', function (Blueprint $table): void {
                $table->index('order_collateral_id', 'order_checklists_collateral_idx');
            });
        }
        if ($indexes->contains('order_checklists_collateral_checklist_uq')) {
            Schema::table('order_checklists', function (Blueprint $table): void {
                $table->dropUnique('order_checklists_collateral_checklist_uq');
            });
        }
        if (! $indexes->contains('order_checklists_scope_uq')) {
            Schema::table('order_checklists', function (Blueprint $table): void {
                $table->unique(['order_collateral_id', 'order_collateral_job_id', 'document_checklist_id'], 'order_checklists_scope_uq');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('order_checklists', 'order_collateral_job_id')) {
            Schema::table('order_checklists', function (Blueprint $table): void {
                $table->dropUnique('order_checklists_scope_uq');
                $table->dropForeign(['order_collateral_job_id']);
                $table->dropIndex('order_checklists_order_collateral_job_id_index');
                $table->dropColumn('order_collateral_job_id');
                $table->dropIndex('order_checklists_collateral_idx');
                $table->unique(['order_collateral_id', 'document_checklist_id'], 'order_checklists_collateral_checklist_uq');
            });
        }
    }
};
