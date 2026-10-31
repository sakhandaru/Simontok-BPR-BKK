<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class GrantDocumentArchiveToBranchLegalSeeder extends Seeder
{
    public function run(): void
    {
        $permissionId = DB::table('permissions')->where('code', 'documents.archive.view')->value('id');
        $roleId = DB::table('roles')->where('code', 'admin_legal_cabang')->value('id');

        if (! $permissionId || ! $roleId) {
            throw new RuntimeException('Permission documents.archive.view atau role admin_legal_cabang belum tersedia.');
        }

        DB::table('role_permissions')->insertOrIgnore([
            'role_id' => $roleId,
            'permission_id' => $permissionId,
        ]);
    }
}
