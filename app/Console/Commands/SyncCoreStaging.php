<?php

namespace App\Console\Commands;

use App\Models\CoreDummyAccount;
use App\Models\CoreStagedAccount;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SyncCoreStaging extends Command
{
    protected $signature = 'core:sync-staging {--ttl=60 : Masa berlaku data staging dalam menit}';

    protected $description = 'Sinkronkan data rekening Core ke read model staging SIMONTOK';

    public function handle(): int
    {
        if (config('core.provider') !== 'dummy') {
            $this->error('Adapter sinkronisasi BU Core produksi belum dikonfigurasi.');

            return self::FAILURE;
        }

        $syncedAt = now();
        $expiresAt = $syncedAt->copy()->addMinutes(max(1, (int) $this->option('ttl')));
        $count = 0;

        CoreDummyAccount::query()->with('collaterals')->chunkById(100, function ($accounts) use ($syncedAt, $expiresAt, &$count): void {
            foreach ($accounts as $source) {
                DB::transaction(function () use ($source, $syncedAt, $expiresAt, &$count): void {
                    $staged = CoreStagedAccount::updateOrCreate(
                        ['account_id' => $source->account_id],
                        [
                            'account_number' => $source->account_number,
                            'customer_id' => $source->customer_id,
                            'customer_name' => $source->customer_name,
                            'marital_status' => $source->marital_status,
                            'loan_amount' => $source->plafon,
                            'branch_code' => $source->branch_code,
                            'branch_name' => $source->branch_name,
                            'source_provider' => config('core.provider'),
                            'synced_at' => $syncedAt,
                            'expires_at' => $expiresAt,
                        ],
                    );
                    $staged->collaterals()->delete();
                    $staged->collaterals()->createMany($source->collaterals->map(fn ($item) => [
                        'collateral_id' => $item->collateral_id,
                        'type_name' => $item->type_name,
                        'description' => $item->description,
                    ])->all());
                    $count++;
                });
            }
        });

        $this->info("Staging Core tersinkron: {$count} rekening; berlaku sampai {$expiresAt->toDateTimeString()}.");

        return self::SUCCESS;
    }
}
