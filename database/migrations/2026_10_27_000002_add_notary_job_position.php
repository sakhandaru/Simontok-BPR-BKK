<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $roleId = DB::table('roles')->where('code', 'notaris')->value('id');

        if (! $roleId) {
            return;
        }

        $positionId = DB::table('job_positions')->where('code', 'NOTARIS')->value('id');

        if (! $positionId) {
            $positionId = DB::table('job_positions')->insertGetId([
                'code' => 'NOTARIS',
                'name' => 'Notaris',
                'role_id' => $roleId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        DB::table('users')
            ->whereNotNull('notary_id')
            ->whereNull('job_position_id')
            ->update(['job_position_id' => $positionId, 'updated_at' => now()]);
    }

    public function down(): void
    {
        $positionId = DB::table('job_positions')->where('code', 'NOTARIS')->value('id');

        if (! $positionId) {
            return;
        }

        DB::table('users')
            ->where('job_position_id', $positionId)
            ->whereNotNull('notary_id')
            ->update(['job_position_id' => null, 'updated_at' => now()]);

        DB::table('job_positions')->where('id', $positionId)->delete();
    }
};
