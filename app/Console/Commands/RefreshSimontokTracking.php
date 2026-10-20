<?php

namespace App\Console\Commands;

use App\Enums\TrackAStatus;
use App\Enums\TrackCCovernoteStatus;
use App\Models\Order;
use App\Models\OrderCollateral;
use App\Support\InAppNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RefreshSimontokTracking extends Command
{
    protected $signature = 'simontok:refresh-tracking {--notify : Kirim notifikasi in-app untuk SLA/covernote berisiko}';

    protected $description = 'Refresh status SLA dan covernote SIMONTOK.';

    public function handle(): int
    {
        $today = today();
        $closedStatuses = [
            TrackAStatus::Selesai->value,
            TrackAStatus::Dibatalkan->value,
            TrackAStatus::DitolakNotaris->value,
        ];

        $updatedCovernotes = 0;
        $riskOrders = 0;

        DB::transaction(function () use ($today, $closedStatuses, &$updatedCovernotes, &$riskOrders) {
            OrderCollateral::query()
                ->with('order')
                ->whereNotNull('covernote_end')
                ->where('covernote_status', '!=', TrackCCovernoteStatus::DigantiSertifikat->value)
                ->whereHas('order', fn ($query) => $query->whereNotIn('status', $closedStatuses))
                ->chunkById(100, function ($collaterals) use ($today, &$updatedCovernotes) {
                    foreach ($collaterals as $collateral) {
                        $status = match (true) {
                            $collateral->covernote_end->lt($today) => TrackCCovernoteStatus::Kedaluwarsa,
                            $collateral->covernote_end->diffInDays($today) <= 7 => TrackCCovernoteStatus::MendekatiJatuhTempo,
                            default => TrackCCovernoteStatus::Aktif,
                        };

                        if ($collateral->covernote_status !== $status) {
                            $collateral->update(['covernote_status' => $status]);
                            $updatedCovernotes++;
                        }
                    }
                });

            Order::query()
                ->whereNotIn('status', $closedStatuses)
                ->chunkById(100, function ($orders) use (&$riskOrders) {
                    foreach ($orders as $order) {
                        $risk = $order->collaterals()->where('covernote_status', TrackCCovernoteStatus::Kedaluwarsa->value)->exists()
                            || $order->collaterals()->whereNotNull('sla_due_at')->where('sla_due_at', '<', now())->exists();

                        if ($order->risk_flag !== $risk) {
                            $order->update(['risk_flag' => $risk]);
                            $riskOrders++;
                        }
                    }
                });
        });

        if ($this->option('notify')) {
            $this->sendNotifications($closedStatuses);
        }

        $this->info("Covernote diperbarui: {$updatedCovernotes}. Risk flag order diperbarui: {$riskOrders}.");

        return self::SUCCESS;
    }

    private function sendNotifications(array $closedStatuses): void
    {
        $dueSoon = OrderCollateral::query()
            ->with('order')
            ->whereBetween('sla_due_at', [now(), now()->addDays(7)])
            ->whereHas('order', fn ($query) => $query->whereNotIn('status', $closedStatuses))
            ->limit(50)
            ->get();

        foreach ($dueSoon as $collateral) {
            InAppNotification::forOrderMaker(
                $collateral->order,
                'SLA mendekati jatuh tempo',
                "SLA order {$collateral->order->order_no} jatuh tempo pada {$collateral->sla_due_at?->format('d M Y')}.",
            );
        }

        $overdue = OrderCollateral::query()
            ->with('order')
            ->whereNotNull('sla_due_at')
            ->where('sla_due_at', '<', now())
            ->whereHas('order', fn ($query) => $query->whereNotIn('status', $closedStatuses))
            ->limit(50)
            ->get();

        foreach ($overdue as $collateral) {
            InAppNotification::forOrderMaker(
                $collateral->order,
                'SLA terlampaui',
                "SLA order {$collateral->order->order_no} sudah melewati jatuh tempo.",
            );
        }

        $expiredCovernotes = OrderCollateral::query()
            ->with('order')
            ->where('covernote_status', TrackCCovernoteStatus::Kedaluwarsa->value)
            ->whereHas('order', fn ($query) => $query->whereNotIn('status', $closedStatuses))
            ->limit(50)
            ->get();

        foreach ($expiredCovernotes as $collateral) {
            InAppNotification::forOrderMaker(
                $collateral->order,
                'Covernote kedaluwarsa',
                "Covernote order {$collateral->order->order_no} sudah kedaluwarsa.",
            );
        }
    }
}
