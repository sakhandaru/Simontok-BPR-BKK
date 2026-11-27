<?php

namespace App\Console\Commands;

use App\Enums\TrackAStatus;
use App\Models\DocumentChecklist;
use App\Models\Order;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SyncOrderChecklists extends Command
{
    protected $signature = 'simontok:sync-order-checklists {--order= : Sinkronkan satu ID order saja}';

    protected $description = 'Menambahkan checklist dokumen aktif yang belum terpasang pada order yang masih dapat diedit.';

    public function handle(): int
    {
        $statuses = [
            TrackAStatus::Draft->value,
            TrackAStatus::Diajukan->value,
            TrackAStatus::PerluPerbaikanOrder->value,
        ];
        $created = 0;
        $orders = 0;

        Order::query()
            ->when($this->option('order'), fn ($query, $orderId) => $query->whereKey($orderId))
            ->whereIn('status', $statuses)
            ->with(['collaterals.jobs'])
            ->chunkById(100, function ($batch) use (&$created, &$orders): void {
                foreach ($batch as $order) {
                    $createdForOrder = DB::transaction(fn (): int => $this->syncOrder($order));
                    $created += $createdForOrder;
                    $orders++;

                    if ($createdForOrder > 0) {
                        $this->line("Order {$order->order_no}: {$createdForOrder} checklist ditambahkan.");
                    }
                }
            });

        $this->info("Selesai. {$orders} order diperiksa, {$created} checklist ditambahkan.");
        return self::SUCCESS;
    }

    private function syncOrder(Order $order): int
    {
        $created = 0;
        $jobTypeIds = $order->collaterals
            ->flatMap(fn ($collateral) => $collateral->jobs->pluck('job_type_id'))
            ->filter()
            ->unique()
            ->values()
            ->all();

        $checklists = DocumentChecklist::query()
            ->with(['jobTypes' => fn ($query) => $query->whereIn('job_types.id', $jobTypeIds)])
            ->where('is_active', true)
            ->where(function ($query) use ($jobTypeIds): void {
                $query->whereNull('job_type_id')
                    ->orWhereHas('jobTypes', fn ($jobQuery) => $jobQuery->whereIn('job_types.id', $jobTypeIds))
                    ->orWhereIn('job_type_id', $jobTypeIds);
            })
            ->get();

        foreach ($order->collaterals as $collateral) {
            foreach ($checklists as $checklist) {
                $matchingJobs = $collateral->jobs->filter(function ($job) use ($checklist): bool {
                    if ((int) $checklist->job_type_id === (int) $job->job_type_id && $checklist->job_type_id !== null) {
                        return true;
                    }

                    return $checklist->jobTypes->contains('id', $job->job_type_id);
                });
                if ($checklist->job_type_id === null && $checklist->jobTypes->isEmpty() && $matchingJobs->isEmpty()) {
                    $matchingJobs = collect([null]);
                }
                if ($matchingJobs->isEmpty()) {
                    continue;
                }

                $existing = $collateral->checklists()->where('document_checklist_id', $checklist->id)->exists();
                if ($existing) {
                    continue;
                }

                $required = $checklist->is_required || $matchingJobs->contains(function ($job) use ($checklist): bool {
                    return $job !== null
                        && (bool) $checklist->jobTypes->firstWhere('id', $job->job_type_id)?->pivot?->is_required;
                });

                $collateral->checklists()->create([
                    'order_id' => $order->id,
                    'document_checklist_id' => $checklist->id,
                    'order_collateral_job_id' => $matchingJobs->first()?->id,
                    'is_required' => $required,
                ]);
                $created++;
            }
        }

        return $created;
    }
}
