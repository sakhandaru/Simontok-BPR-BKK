<?php

namespace App\Console\Commands;

use App\Models\NotificationDelivery;
use Illuminate\Console\Command;

class RetrySimontokNotifications extends Command
{
    protected $signature = 'simontok:retry-notifications {--limit=100}';

    protected $description = 'Memproses antrian notifikasi SIMONTOK yang tertunda.';

    public function handle(): int
    {
        $deliveries = NotificationDelivery::query()
            ->where('channel', 'whatsapp')
            ->whereIn('status', ['pending', 'failed'])
            ->where(fn ($query) => $query->whereNull('next_attempt_at')->orWhere('next_attempt_at', '<=', now()))
            ->with('notification')
            ->limit((int) $this->option('limit'))
            ->get();

        foreach ($deliveries as $delivery) {
            $delivery->increment('attempts');
            $delivery->update([
                'status' => 'pending',
                'last_error' => 'WhatsApp API provider belum dikonfigurasi.',
                'next_attempt_at' => now()->addMinutes(15),
            ]);
        }

        $this->info("Antrian diproses: {$deliveries->count()}. Status aplikasi tidak terpengaruh oleh kegagalan kanal eksternal.");
        return self::SUCCESS;
    }
}
