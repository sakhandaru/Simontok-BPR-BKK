<?php

namespace Database\Seeders;

use App\Models\JobPosition;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class EmergencyAccountSeeder extends Seeder
{
    public function run(): void
    {
        $login = config('services.sso.emergency_login');
        if (! is_string($login) || trim($login) === '') {
            throw new \RuntimeException('SSO_EMERGENCY_LOGIN wajib diisi untuk membuat akun darurat.');
        }

        $role = Role::query()->where('code', 'it_admin')->first();
        $position = JobPosition::query()
            ->where('code', 'IT_ADMIN')
            ->where('role_id', $role?->id)
            ->first();
        if (! $role || ! $position) {
            throw new \RuntimeException('Role atau posisi IT Administrator belum tersedia.');
        }

        $user = User::query()->where('email', $login)->first();
        if ($user) {
            if ($user->sso_employee_id || $user->notary_id || $user->roleCode() !== 'it_admin') {
                throw new \RuntimeException("Login darurat {$login} sudah dipakai akun lain.");
            }

            return;
        }

        $password = env('EMERGENCY_ACCOUNT_PASSWORD');
        if (! is_string($password) || Str::length($password) < 16) {
            throw new \RuntimeException('EMERGENCY_ACCOUNT_PASSWORD wajib diisi dan minimal 16 karakter saat membuat akun darurat.');
        }

        User::query()->create([
            'name' => 'Akses Darurat IT',
            'email' => $login,
            'password' => $password,
            'sso_employee_id' => null,
            'branch_id' => null,
            'notary_id' => null,
            'job_position_id' => $position->id,
            'is_active' => true,
        ]);
    }
}
