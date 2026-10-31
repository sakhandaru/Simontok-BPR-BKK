<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class GrantNotaryPortalMonitorToCentralLegalSeeder extends Seeder
{
    public function run(): void
    {
        $permissionId = DB::table('permissions')->where('code', 'notary.portal')->value('id');
        $roleId = DB::table('roles')->where('code', 'admin_legal_pusat')->value('id');

        if (! $permissionId || ! $roleId) {
            throw new RuntimeException('Permission notary.portal atau role admin_legal_pusat belum tersedia.');
        }

        DB::table('role_permissions')->insertOrIgnore([
            'role_id' => $roleId,
            'permission_id' => $permissionId,
        ]);
    }
}
