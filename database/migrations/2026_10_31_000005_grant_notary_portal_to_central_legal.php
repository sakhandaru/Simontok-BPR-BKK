<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        $permissionId = DB::table('permissions')->where('code', 'notary.portal')->value('id');
        $roleId = DB::table('roles')->where('code', 'admin_legal_pusat')->value('id');

        if ($permissionId && $roleId) {
            DB::table('role_permissions')->insertOrIgnore([
                'role_id' => $roleId,
                'permission_id' => $permissionId,
            ]);
        }
    }

    public function down(): void
    {
        $permissionId = DB::table('permissions')->where('code', 'notary.portal')->value('id');
        $roleId = DB::table('roles')->where('code', 'admin_legal_pusat')->value('id');

        if ($permissionId && $roleId) {
            DB::table('role_permissions')
                ->where('role_id', $roleId)
                ->where('permission_id', $permissionId)
                ->delete();
        }
    }
};
