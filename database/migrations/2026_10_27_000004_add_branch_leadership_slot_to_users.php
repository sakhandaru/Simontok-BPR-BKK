<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('leadership_slot', 40)->nullable()->after('job_position_id');
            $table->unique(['branch_id', 'leadership_slot'], 'users_branch_leadership_slot_unique');
        });

        $positions = DB::table('job_positions')
            ->join('roles', 'roles.id', '=', 'job_positions.role_id')
            ->whereIn('roles.code', ['kepala_cabang', 'kadiv_operasional'])
            ->pluck('roles.code', 'job_positions.id');

        foreach ($positions as $positionId => $roleCode) {
            DB::table('users')
                ->where('job_position_id', $positionId)
                ->where('is_active', true)
                ->whereNotNull('branch_id')
                ->update(['leadership_slot' => $roleCode, 'updated_at' => now()]);
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique('users_branch_leadership_slot_unique');
            $table->dropColumn('leadership_slot');
        });
    }
};
