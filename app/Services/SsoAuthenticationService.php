<?php

namespace App\Services;

use App\Models\Branch;
use App\Models\JobPosition;
use App\Models\User;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SsoAuthenticationService
{
    public function authenticate(string $identifier, string $password): ?User
    {
        if (! config('services.sso.enabled')) {
            return $this->authenticateLocally($identifier, $password);
        }

        $localUser = User::query()
            ->where('email', $identifier)
            ->whereNotNull('notary_id')
            ->first();

        if ($localUser && Hash::check($password, $localUser->password)) {
            return $localUser->is_active ? $localUser : null;
        }

        try {
            $login = Http::baseUrl(config('services.sso.url'))
                ->acceptJson()
                ->asJson()
                ->timeout((int) config('services.sso.timeout', 10))
                ->post('/api/auth/login', [
                    'id_peg' => $identifier,
                    'password' => $password,
                    'app' => config('services.sso.app', 'monbis'),
                ]);
        } catch (ConnectionException) {
            throw ValidationException::withMessages([
                'email' => 'Layanan SSO sedang tidak dapat dihubungi. Coba lagi beberapa saat lagi.',
            ]);
        }

        if ($login->status() === 401) {
            return null;
        }

        if ($login->status() === 403) {
            throw ValidationException::withMessages([
                'email' => 'Akun Anda belum memiliki akses ke aplikasi SIMONTOK.',
            ]);
        }

        if ($login->failed()) {
            throw ValidationException::withMessages([
                'email' => 'Login SSO gagal. Hubungi administrator jika masalah berlanjut.',
            ]);
        }

        $token = $login->json('data.token');

        if (! is_string($token) || $token === '') {
            throw ValidationException::withMessages([
                'email' => 'Respons login SSO tidak lengkap. Hubungi administrator.',
            ]);
        }

        try {
            $profile = Http::baseUrl(config('services.sso.url'))
                ->acceptJson()
                ->withToken($token)
                ->timeout((int) config('services.sso.timeout', 10))
                ->get('/api/auth/whoami');
        } catch (ConnectionException) {
            throw ValidationException::withMessages([
                'email' => 'Profil SSO tidak dapat diambil. Coba lagi beberapa saat lagi.',
            ]);
        }

        if ($profile->failed()) {
            throw ValidationException::withMessages([
                'email' => 'Profil akun SSO tidak dapat diverifikasi. Hubungi administrator.',
            ]);
        }

        return $this->syncUser($profile->json('data', []));
    }

    private function authenticateLocally(string $identifier, string $password): ?User
    {
        $user = User::query()->where('email', $identifier)->first();

        return $user && $user->is_active && Hash::check($password, $user->password)
            ? $user
            : null;
    }

    /** @param array<string, mixed> $profile */
    private function syncUser(array $profile): User
    {
        $employeeId = $profile['employee_id'] ?? null;
        $name = $profile['full_name'] ?? null;
        $jobPositionCode = $profile['job_position_code'] ?? null;
        $jobPositionName = $profile['job_position'] ?? null;
        $branchCode = $profile['branch_code'] ?? null;
        $branchName = $profile['branch_name'] ?? null;

        if (! is_string($employeeId) || $employeeId === '' || ! is_string($name) || $name === '') {
            throw ValidationException::withMessages([
                'email' => 'Data profil SSO tidak lengkap. Hubungi administrator.',
            ]);
        }

        $jobPosition = JobPosition::query()
            ->when($jobPositionCode, fn ($query) => $query->where('code', $jobPositionCode))
            ->when(! $jobPositionCode && $jobPositionName, fn ($query) => $query->where('name', $jobPositionName))
            ->first();

        if (! $jobPosition || ! $jobPosition->role_id) {
            throw ValidationException::withMessages([
                'email' => 'Jabatan akun Anda belum dipetakan ke role SIMONTOK. Hubungi administrator.',
            ]);
        }

        $branch = Branch::query()
            ->when($branchCode, fn ($query) => $query->where('code', $branchCode))
            ->when(! $branchCode && $branchName, fn ($query) => $query->where('name', $branchName))
            ->first();

        if (! $branch) {
            throw ValidationException::withMessages([
                'email' => 'Cabang akun Anda belum dipetakan di SIMONTOK. Hubungi administrator.',
            ]);
        }

        $email = is_string($profile['email'] ?? null) && $profile['email'] !== ''
            ? $profile['email']
            : $employeeId.'@sso.local';

        $user = User::query()->where('sso_employee_id', $employeeId)->first();

        if (! $user) {
            $user = User::query()->where('email', $email)->first();
        }

        if ($user && $user->sso_employee_id && $user->sso_employee_id !== $employeeId) {
            throw ValidationException::withMessages([
                'email' => 'Email akun SSO sudah terhubung ke pegawai lain. Hubungi administrator.',
            ]);
        }

        if ($user?->notary_id) {
            throw ValidationException::withMessages([
                'email' => 'Email akun SSO bertabrakan dengan akun notaris. Hubungi administrator.',
            ]);
        }

        $user ??= new User;
        $user->fill([
            'sso_employee_id' => $employeeId,
            'name' => $name,
            'email' => $email,
            'branch_id' => $branch->id,
            'job_position_id' => $jobPosition->id,
            'is_active' => true,
        ]);

        if (! $user->exists) {
            $user->password = Str::random(64);
        }

        $user->save();

        return $user;
    }
}
