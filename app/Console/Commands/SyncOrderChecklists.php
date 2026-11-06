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
        $defaultsAdded = $this->ensureDefaultChecklists();
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
        if ($defaultsAdded > 0) {
            $this->line("{$defaultsAdded} master checklist default dipastikan tersedia.");
        }

        return self::SUCCESS;
    }

    private function ensureDefaultChecklists(): int
    {
        $defaults = [
            ['name' => 'KTP debitur', 'is_required' => true],
            ['name' => 'KTP pemilik agunan', 'is_required' => true],
            ['name' => 'Kartu keluarga', 'is_required' => true],
            ['name' => 'Sertifikat/BPKB asli', 'is_required' => true],
            ['name' => 'SPPT PBB', 'is_required' => true],
            ['name' => 'KTP pasangan', 'is_required' => false],
            ['name' => 'Surat nikah', 'is_required' => false],
            ['name' => 'NPWP', 'is_required' => false],
            ['name' => 'NIB', 'is_required' => false],
            ['name' => 'Dokumen pendukung lain', 'is_required' => false],
        ];
        $added = 0;

        foreach ($defaults as $default) {
            $checklist = DocumentChecklist::query()->firstOrCreate(
                ['name' => $default['name'], 'job_type_id' => null],
                ['is_active' => true, 'is_required' => $default['is_required']],
            );

            if ($checklist->wasRecentlyCreated) {
                $added++;
            } elseif (! $checklist->is_active) {
                $checklist->update(['is_active' => true, 'is_required' => $default['is_required']]);
            }
        }

        return $added;
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
            ->where('is_active', true)
            ->where(fn ($query) => $query->whereNull('job_type_id')->orWhereIn('job_type_id', $jobTypeIds))
            ->get();

        foreach ($order->collaterals as $collateral) {
            foreach ($checklists as $checklist) {
                if ($checklist->job_type_id && ! $collateral->jobs->contains('job_type_id', $checklist->job_type_id)) {
                    continue;
                }

                $job = $checklist->job_type_id
                    ? $collateral->jobs->firstWhere('job_type_id', $checklist->job_type_id)
                    : null;

                $existing = $collateral->checklists()->where('document_checklist_id', $checklist->id)->exists();
                if ($existing) {
                    continue;
                }

                $collateral->checklists()->create([
                    'order_id' => $order->id,
                    'document_checklist_id' => $checklist->id,
                    'order_collateral_job_id' => $job?->id,
                ]);
                $created++;
            }
        }

        return $created;
    }
}
