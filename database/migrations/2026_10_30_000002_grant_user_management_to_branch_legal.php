<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        $permissionId = DB::table('permissions')->where('code', 'users.manage')->value('id');
        $roleIds = DB::table('roles')->whereIn('code', ['admin_legal_pusat', 'admin_legal_cabang'])->pluck('id');

        if ($permissionId) {
            foreach ($roleIds as $roleId) {
                DB::table('role_permissions')->insertOrIgnore([
                    'role_id' => $roleId,
                    'permission_id' => $permissionId,
                ]);
            }
        }
    }

    public function down(): void
    {
        $permissionId = DB::table('permissions')->where('code', 'users.manage')->value('id');
        $roleIds = DB::table('roles')->whereIn('code', ['admin_legal_pusat', 'admin_legal_cabang'])->pluck('id');

        if ($permissionId) {
            DB::table('role_permissions')
                ->whereIn('role_id', $roleIds)
                ->where('permission_id', $permissionId)
                ->delete();
        }
    }
};
