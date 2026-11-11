<?php

namespace App\Services;

use App\Models\User;
use App\Support\Audit;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

class SsoAuthenticationService
{
    public function authenticate(string $identifier, string $password): ?User
    {
        if ($this->isEmergencyIdentifier($identifier)) {
            return $this->authenticateEmergency($identifier, $password);
        }

        if (app()->environment('local') && config('services.sso.local_bypass')) {
            return $this->authenticateLocalEmployee($identifier, $password);
        }

        if (! config('services.sso.enabled')) {
            return $this->authenticateLocally($identifier, $password);
        }

        $localUser = User::query()
            ->where('email', $identifier)
            ->first();

        if ($localUser && $this->canAuthenticateLocally($localUser) && Hash::check($password, $localUser->password)) {
            return $localUser;
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

    public function authenticateEmergency(string $identifier, string $password): ?User
    {
        if (! $this->isEmergencyIdentifier($identifier)) {
            return null;
        }

        $user = User::query()->where('email', config('services.sso.emergency_login'))->first();

        if (! $user
            || $user->sso_employee_id
            || $user->notary_id
            || $user->roleCode() !== 'it_admin'
            || ! $user->isOperationallyActive()
            || ! Hash::check($password, $user->password)) {
            return null;
        }

        return $user;
    }

    private function authenticateLocally(string $identifier, string $password): ?User
    {
        $user = User::query()->where('email', $identifier)->first();

        return $user && $user->isOperationallyActive() && Hash::check($password, $user->password)
            ? $user
            : null;
    }

    private function authenticateLocalEmployee(string $identifier, string $password): ?User
    {
        $user = User::query()
            ->with('jobPosition.role', 'branch')
            ->where('sso_employee_id', $identifier)
            ->first();

        if (! $user) {
            return $this->authenticateLocally($identifier, $password);
        }

        $localPassword = config('services.sso.local_password');
        if (! is_string($localPassword) || $localPassword === '' || ! hash_equals($localPassword, $password)) {
            return null;
        }

        $this->ensureEmployeeCanLogin($user);
        Audit::security(request(), 'sso_local_bypass', 'Login pegawai memakai bypass SSO lokal.', $user);

        return $user;
    }

    private function canAuthenticateLocally(User $user): bool
    {
        if (! $user->isOperationallyActive() || $user->sso_employee_id) {
            return false;
        }

        if ($user->notary_id || $user->roleCode() === 'auditor') {
            return true;
        }

        return false;
    }

    private function isEmergencyIdentifier(string $identifier): bool
    {
        $emergencyLogin = config('services.sso.emergency_login');

        return is_string($emergencyLogin) && $emergencyLogin !== '' && hash_equals($emergencyLogin, $identifier);
    }

    /** @param array<string, mixed> $profile */
    private function syncUser(array $profile): User
    {
        $employeeId = $profile['employee_id'] ?? null;
        $name = $profile['full_name'] ?? null;

        if (! is_string($employeeId) || $employeeId === '' || ! is_string($name) || $name === '') {
            throw ValidationException::withMessages([
                'email' => 'Data profil SSO tidak lengkap. Hubungi administrator.',
            ]);
        }

        $user = User::query()
            ->with('jobPosition.role')
            ->where('sso_employee_id', $employeeId)
            ->first();

        if (! $user) {
            throw ValidationException::withMessages([
                'email' => 'Akun SSO Anda belum diaktifkan di SIMONTOK. Hubungi administrator.',
            ]);
        }

        $this->ensureEmployeeCanLogin($user);

        $updates = ['name' => $name];
        $ssoEmail = $profile['email'] ?? null;

        if (is_string($ssoEmail) && filter_var($ssoEmail, FILTER_VALIDATE_EMAIL)) {
            $pendingEmail = $employeeId.'@pending.sso.local';
            $existingEmail = User::query()
                ->where('email', $ssoEmail)
                ->where('id', '!=', $user->id)
                ->exists();

            if ($existingEmail) {
                throw ValidationException::withMessages([
                    'email' => 'Email SSO sudah digunakan akun lain di SIMONTOK. Hubungi administrator.',
                ]);
            }

            if ($user->email === $pendingEmail || blank($user->email)) {
                $updates['email'] = $ssoEmail;
            }
        }

        $user->update($updates);

        return $user->fresh();
    }

    private function ensureEmployeeCanLogin(User $user): void
    {
        if (! $user->is_active) {
            throw ValidationException::withMessages([
                'email' => 'Akun SIMONTOK Anda sedang nonaktif. Hubungi administrator.',
            ]);
        }

        if (! $user->isOperationallyActive()) {
            throw ValidationException::withMessages([
                'email' => 'Akun Anda terhubung ke kantor yang sedang nonaktif. Hubungi administrator.',
            ]);
        }

        if ($user->notary_id) {
            throw ValidationException::withMessages([
                'email' => 'Akun SSO tidak dapat digunakan untuk akun notaris lokal.',
            ]);
        }

        if (! $user->jobPosition?->role_id) {
            throw ValidationException::withMessages([
                'email' => 'Role akun SSO belum diatur di SIMONTOK. Hubungi administrator.',
            ]);
        }

        if (in_array($user->roleCode(), ['pimpinan_cabang', 'kabid_ops_cabang', 'admin_legal_cabang'], true) && ! $user->branch_id) {
            throw ValidationException::withMessages([
                'email' => 'Cabang akun SSO belum diatur di SIMONTOK. Hubungi administrator.',
            ]);
        }
    }
}
