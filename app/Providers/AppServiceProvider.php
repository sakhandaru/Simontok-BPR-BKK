<?php

namespace App\Providers;

use App\Contracts\CoreAccountProvider;
use App\Models\User;
use App\Services\Core\DummyCoreAccountProvider;
use App\Services\Core\StagedCoreAccountProvider;
use App\Support\Audit;
use App\Support\EmergencyAccessNotifier;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use Laravel\Fortify\Events\TwoFactorAuthenticationFailed;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(CoreAccountProvider::class, function () {
            if (config('core.read_model') === 'staging') {
                return new StagedCoreAccountProvider;
            }

            return match (config('core.provider')) {
                'dummy' => new DummyCoreAccountProvider,
                default => throw new \RuntimeException('Provider BU Core belum tersedia: '.config('core.provider')),
            };
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();

        // Production must always use the compiled manifest, even if a stale
        // Vite hot file was left behind by a local development process.
        if ($this->app->isProduction()) {
            Vite::useHotFile(storage_path('framework/vite.hot.production-disabled'));
        }

        Event::listen(Login::class, function (Login $event): void {
            Audit::security(request(), 'login_success', 'Pengguna berhasil masuk.', $event->user);

            $isEmergencyAccount = $event->user instanceof User
                && filled(config('services.sso.emergency_login'))
                && $event->user->email === config('services.sso.emergency_login')
                && $event->user->roleCode() === 'it_admin'
                && ! $event->user->sso_employee_id;
            if ($isEmergencyAccount) {
                Audit::security(request(), 'emergency_login', 'Akun darurat IT digunakan melalui login lokal.', $event->user);
                EmergencyAccessNotifier::notify('login digunakan', $event->user, [
                    'alamat_ip' => (string) request()->ip(),
                ]);
            }
        });

        Event::listen(Failed::class, function (Failed $event): void {
            if (filled(config('services.sso.emergency_login'))
                && data_get($event->credentials, 'email') === config('services.sso.emergency_login')) {
                Audit::security(request(), 'emergency_login_failed', 'Login lokal akun darurat IT gagal.');
            }
        });

        Event::listen(Logout::class, function (Logout $event): void {
            Audit::security(request(), 'logout', 'Pengguna keluar.', $event->user);
        });

        Event::listen(TwoFactorAuthenticationFailed::class, function (TwoFactorAuthenticationFailed $event): void {
            $isEmergencyAccount = $event->user instanceof User
                && filled(config('services.sso.emergency_login'))
                && $event->user->email === config('services.sso.emergency_login')
                && $event->user->roleCode() === 'it_admin';
            if ($isEmergencyAccount) {
                Audit::security(request(), 'emergency_login_failed', 'Verifikasi dua faktor akun darurat IT gagal.', $event->user);
            }
        });
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}
