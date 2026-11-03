<?php

namespace App\Http\Controllers\Simontok;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\SystemSetting;
use App\Models\User;
use App\Support\Audit;
use App\Support\EmergencyAccessNotifier;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class SystemSettingController extends Controller
{
    public function index(Request $request): Response
    {
        $loginIdentifier = config('services.sso.emergency_login');
        $emergencyUser = filled($loginIdentifier)
            ? User::query()->with('jobPosition.role')->where('email', $loginIdentifier)->first()
            : null;
        $status = match (true) {
            blank($loginIdentifier) => 'not_configured',
            ! $emergencyUser => 'not_provisioned',
            $emergencyUser->sso_employee_id || $emergencyUser->notary_id || $emergencyUser->roleCode() !== 'it_admin' => 'misconfigured',
            ! $emergencyUser->is_active => 'inactive',
            default => 'ready',
        };
        $events = AuditLog::query()
            ->where('module', 'security')
            ->whereIn('action', ['emergency_login', 'emergency_login_failed', 'emergency_passkey_login_blocked', 'emergency_password_rotated', 'emergency_account_provisioned'])
            ->when($emergencyUser, fn ($query) => $query->where(fn ($query) => $query
                ->where('entity_id', $emergencyUser->id)
                ->orWhere('action', 'emergency_login_failed')))
            ->latest('created_at')
            ->limit(8)
            ->get();

        return Inertia::render('simontok/system-settings/index', ['settings' => [
            'early_warning_enabled' => (bool) ((int) SystemSetting::value('early_warning_enabled', 1)),
            'notification_poll_interval' => (int) SystemSetting::value('notification_poll_interval', 15),
            'sound_priority' => SystemSetting::value('sound_priority', 'important'),
            'quiet_hours_enabled' => (bool) ((int) SystemSetting::value('quiet_hours_enabled', 0)),
            'quiet_start' => SystemSetting::value('quiet_start', '22:00'),
            'quiet_end' => SystemSetting::value('quiet_end', '06:00'),
        ], 'emergencyAccess' => [
            'status' => $status,
            'loginIdentifier' => $loginIdentifier ?: null,
            'alertConfigured' => filter_var(config('services.sso.emergency_alert_email'), FILTER_VALIDATE_EMAIL) !== false
                && ! in_array(config('mail.default'), ['log', 'array'], true),
            'canRotatePassword' => $status === 'ready' && $request->user()->is($emergencyUser),
            'passwordRotatedAt' => filled(SystemSetting::value('emergency_password_rotated_at'))
                ? CarbonImmutable::parse(SystemSetting::value('emergency_password_rotated_at'))->format('d M Y H:i')
                : null,
            'events' => $events->map(fn (AuditLog $event) => [
                'id' => $event->id,
                'action' => $event->action,
                'description' => $event->description,
                'reason' => data_get($event->payload, 'reason'),
                'ipAddress' => $event->ip_address,
                'createdAt' => $event->created_at?->format('d M Y H:i'),
            ])->values(),
        ]]);
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'early_warning_enabled' => ['boolean'],
            'notification_poll_interval' => ['required', 'integer', 'in:10,15,30,60'],
            'sound_priority' => ['required', 'in:important,critical'],
            'quiet_hours_enabled' => ['boolean'],
            'quiet_start' => ['required', 'date_format:H:i'],
            'quiet_end' => ['required', 'date_format:H:i'],
        ]);
        foreach ($data as $key => $value) {
            SystemSetting::updateOrCreate(['key' => $key], ['value' => is_bool($value) ? (int) $value : $value, 'updated_by' => $request->user()->id]);
        }

        return back()->with('success', 'Pengaturan sistem disimpan.');
    }

    public function rotateEmergencyPassword(Request $request): RedirectResponse
    {
        $loginIdentifier = config('services.sso.emergency_login');
        $user = filled($loginIdentifier) ? User::query()->where('email', $loginIdentifier)->first() : null;

        abort_unless(
            $user
            && $request->user()->is($user)
            && ! $user->sso_employee_id
            && ! $user->notary_id
            && $user->roleCode() === 'it_admin',
            403,
        );

        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:16', 'different:current_password', 'confirmed'],
        ], [
            'password.min' => 'Kata sandi baru harus memiliki minimal 16 karakter.',
            'password.confirmed' => 'Konfirmasi kata sandi baru tidak cocok.',
            'password.different' => 'Kata sandi baru harus berbeda dari kata sandi saat ini.',
        ]);

        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => 'Kata sandi saat ini tidak sesuai.',
            ]);
        }

        $user->update(['password' => $data['password']]);
        SystemSetting::updateOrCreate(
            ['key' => 'emergency_password_rotated_at'],
            ['value' => now()->toDateTimeString(), 'updated_by' => $user->id],
        );
        Audit::security($request, 'emergency_password_rotated', 'Kata sandi akses darurat IT dirotasi.', $user);
        EmergencyAccessNotifier::notify('kata sandi dirotasi', $user, ['alamat_ip' => (string) $request->ip()]);

        return back()->with('success', 'Kata sandi akses darurat berhasil dirotasi.');
    }
}
