<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\JobPosition;
use App\Models\Notary;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $seedPassword = env('SEEDER_DEFAULT_PASSWORD', app()->isProduction() ? null : 'password');

        if (app()->isProduction() && blank($seedPassword)) {
            throw new \RuntimeException('SEEDER_DEFAULT_PASSWORD wajib diisi saat menjalankan seeder di production.');
        }

        $seedPassword ??= Str::random(32);
        $branchId = Branch::query()->where('code', '001')->value('id');

        $accounts = [
            ['login' => 'direksi', 'name' => 'Direksi Pusat', 'position' => 'DIREKSI_PUSAT'],
            ['login' => 'kadiv_pusat', 'name' => 'Kadiv Operasional Pusat', 'position' => 'KADIV_OPS_PUSAT'],
            ['login' => 'legal', 'name' => 'Admin Legal Pusat', 'position' => 'LEGAL_ADMIN_PUSAT'],
            ['login' => 'legal_cabang', 'name' => 'Admin Legal Cabang', 'position' => 'LEGAL_ADMIN_CABANG'],
            ['login' => 'pimpinan', 'name' => 'Pimpinan Cabang', 'position' => 'PIMPINAN_CABANG'],
            ['login' => 'kadiv', 'name' => 'Kabid Operasional Cabang', 'position' => 'KABID_OPS_CABANG'],
            ['login' => 'auditor', 'name' => 'Auditor', 'position' => 'AUDITOR'],
        ];

        foreach ($accounts as $account) {
            if ($account['login'] === config('services.sso.emergency_login')) {
                continue;
            }

            $positionId = JobPosition::query()->where('code', $account['position'])->value('id');
            $isBranchRole = in_array($account['position'], ['PIMPINAN_CABANG', 'KABID_OPS_CABANG', 'LEGAL_ADMIN_CABANG'], true);

            if (! $positionId || ($isBranchRole && ! $branchId)) {
                throw new \RuntimeException("Master posisi atau cabang untuk akun {$account['login']} belum tersedia.");
            }

            User::updateOrCreate(['email' => $account['login']], [
                'name' => $account['name'],
                'password' => $seedPassword,
                'branch_id' => $isBranchRole ? $branchId : null,
                'job_position_id' => $positionId,
                'notary_id' => null,
                'sso_employee_id' => null,
                'is_active' => true,
            ]);
        }

        $emergencyLogin = config('services.sso.emergency_login');
        $demoNotary = Notary::query()->where('email', 'notaris.demo@example.com')->first();

        $notaryPositionId = JobPosition::query()->where('code', 'NOTARIS')->value('id');
        if ($demoNotary && $notaryPositionId && $emergencyLogin !== 'notaris') {
            User::updateOrCreate(['email' => 'notaris'], [
                'name' => 'Notaris',
                'password' => $seedPassword,
                'branch_id' => null,
                'job_position_id' => $notaryPositionId,
                'notary_id' => $demoNotary->id,
                'sso_employee_id' => null,
                'is_active' => true,
            ]);
        }
    }
}
