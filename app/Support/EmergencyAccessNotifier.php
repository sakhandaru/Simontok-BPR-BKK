<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

class EmergencyAccessNotifier
{
    /** @param array<string, string> $details */
    public static function notify(string $event, User $user, array $details = []): void
    {
        $message = collect([
            "Peristiwa akses darurat IT: {$event}",
            'Akun: '.$user->email,
            'Waktu: '.now()->toDateTimeString(),
            ...collect($details)->map(fn (string $value, string $key) => ucfirst(str_replace('_', ' ', $key)).": {$value}")->all(),
        ])->implode("\n");

        Log::critical($message, ['user_id' => $user->id, 'event' => $event]);

        $recipient = config('services.sso.emergency_alert_email');
        if (! is_string($recipient) || ! filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
            return;
        }

        try {
            Mail::raw($message, function ($mail) use ($recipient, $event): void {
                $mail->to($recipient)->subject("SIMONTOK: {$event} akun darurat IT");
            });
        } catch (Throwable $exception) {
            Log::error('Notifikasi email akses darurat IT gagal dikirim.', [
                'recipient' => $recipient,
                'exception' => $exception::class,
            ]);
        }
    }
}
