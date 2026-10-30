<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_collateral_jobs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_collateral_id')->constrained('order_collaterals')->cascadeOnDelete();
            $table->foreignId('job_type_id')->constrained('job_types');
            $table->unsignedSmallInteger('sla_days')->nullable();
            $table->string('sla_source', 20)->default('standard');
            $table->text('sla_override_reason')->nullable();
            $table->timestamp('sla_due_at')->nullable();
            $table->string('status', 40)->default('menunggu_verifikasi');
            $table->timestamps();
            $table->unique(['order_collateral_id', 'job_type_id']);
            $table->index(['order_collateral_id', 'status']);
        });

        DB::table('order_collaterals')
            ->whereNotNull('job_type_id')
            ->orderBy('id')
            ->eachById(function (object $collateral): void {
                DB::table('order_collateral_jobs')->insert([
                    'order_collateral_id' => $collateral->id,
                    'job_type_id' => $collateral->job_type_id,
                    'sla_days' => $collateral->sla_days,
                    'sla_source' => $collateral->sla_source ?? 'standard',
                    'sla_override_reason' => $collateral->sla_override_reason,
                    'sla_due_at' => $collateral->sla_due_at,
                    'status' => $collateral->doc_status ?? 'menunggu_verifikasi',
                    'created_at' => $collateral->created_at,
                    'updated_at' => $collateral->updated_at,
                ]);
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_collateral_jobs');
    }
};
