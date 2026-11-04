<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use App\Models\JobPosition;
use App\Models\Role;
use App\Models\SystemSetting;
use App\Models\User;
use App\Support\EmergencyAccessNotifier;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class ProvisionEmergencyItAccount extends Command
{
    protected $signature = 'simontok:emergency-account {--rotate : Ganti kata sandi akun yang sudah ada} {--generate : Buat kata sandi acak dan tampilkan sekali}';

    protected $description = 'Buat atau rotasi akun akses darurat IT SIMONTOK secara aman.';

    public function handle(): int
    {
        $login = config('services.sso.emergency_login');
        if (! is_string($login) || trim($login) === '') {
            $this->error('Tetapkan SSO_EMERGENCY_LOGIN pada environment sebelum menjalankan perintah ini.');

            return self::FAILURE;
        }

        $role = Role::query()->where('code', 'it_admin')->first();
        $position = JobPosition::query()->where('code', 'IT_ADMIN')->where('role_id', $role?->id)->first();
        if (! $role || ! $position) {
            $this->error('Role IT Administrator belum tersedia. Jalankan migrasi dan seeder terlebih dahulu.');

            return self::FAILURE;
        }

        $user = User::query()->where('email', $login)->first();
        if ($user && ($user->sso_employee_id || $user->notary_id || $user->roleCode() !== 'it_admin')) {
            $this->error('ID login sudah dipakai akun lain. Pilih SSO_EMERGENCY_LOGIN yang unik.');

            return self::FAILURE;
        }
        if (! $user && $this->option('rotate')) {
            $this->error('Akun belum ada, jadi kata sandinya belum dapat dirotasi. Jalankan perintah tanpa --rotate untuk membuat akun.');

            return self::FAILURE;
        }
        if ($user && ! $this->option('rotate')) {
            $this->error('Akun sudah ada. Tambahkan --rotate jika memang perlu mengganti kata sandinya.');

            return self::FAILURE;
        }

        $password = $this->option('generate')
            ? Str::random(48)
            : $this->secret('Masukkan kata sandi baru');
        if (! is_string($password) || $password === '') {
            $this->error('Kata sandi wajib diisi.');

            return self::FAILURE;
        }
        if (! $this->option('generate') && $password !== $this->secret('Ulangi kata sandi baru')) {
            $this->error('Konfirmasi kata sandi tidak cocok.');

            return self::FAILURE;
        }
        if ($user && Hash::check($password, $user->password)) {
            $this->error('Gunakan kata sandi yang berbeda dari kata sandi saat ini.');

            return self::FAILURE;
        }

        $isNewAccount = ! $user;
        $user ??= new User;
        $user->forceFill([
            'name' => 'Akses Darurat IT',
            'email' => $login,
            'password' => Hash::make($password),
            'sso_employee_id' => null,
            'branch_id' => null,
            'notary_id' => null,
            'job_position_id' => $position->id,
            'is_active' => true,
        ])->save();

        SystemSetting::updateOrCreate(
            ['key' => 'emergency_password_rotated_at'],
            ['value' => now()->toDateTimeString(), 'updated_by' => $user->id],
        );

        AuditLog::create([
            'actor_type' => 'system',
            'actor_name' => 'Deployment CLI',
            'role_code' => 'it_admin',
            'module' => 'security',
            'entity_type' => 'User',
            'entity_id' => $user->id,
            'action' => $isNewAccount ? 'emergency_account_provisioned' : 'emergency_password_rotated',
            'description' => $isNewAccount ? 'Akun akses darurat IT dibuat melalui CLI.' : 'Kata sandi akses darurat IT dirotasi melalui CLI.',
            'route' => 'artisan simontok:emergency-account',
            'method' => 'CLI',
            'payload' => [],
        ]);

        EmergencyAccessNotifier::notify($isNewAccount ? 'akun dibuat' : 'kata sandi dirotasi melalui CLI', $user);
        $this->components->info($isNewAccount ? 'Akun akses darurat IT berhasil dibuat.' : 'Kata sandi akun akses darurat IT berhasil dirotasi.');
        if ($this->option('generate')) {
            $this->line('ID login: '.$login);
            $this->line('Kata sandi baru (tampilkan sekali, simpan di password vault): '.$password);
        } else {
            $this->line('Rahasiakan kata sandi dan simpan di password vault. Nilainya tidak ditampilkan ulang.');
        }

        return self::SUCCESS;
    }
}
