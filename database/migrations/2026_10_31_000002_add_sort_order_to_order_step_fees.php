<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_step_fees', function (Blueprint $table): void {
            $table->unsignedSmallInteger('sort_order')->default(0)->after('step_name');
        });

        DB::table('order_step_fees')->orderBy('id')->each(function (object $fee): void {
            $position = DB::table('order_step_fees')
                ->where('order_collateral_id', $fee->order_collateral_id)
                ->where('id', '<=', $fee->id)
                ->count() - 1;
            DB::table('order_step_fees')->where('id', $fee->id)->update(['sort_order' => $position]);
        });
    }

    public function down(): void
    {
        Schema::table('order_step_fees', fn (Blueprint $table) => $table->dropColumn('sort_order'));
    }
};
