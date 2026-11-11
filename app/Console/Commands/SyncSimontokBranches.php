<?php

namespace App\Console\Commands;

use App\Contracts\CoreAccountProvider;
use App\Models\Branch;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SyncSimontokBranches extends Command
{
    protected $signature = 'simontok:sync-branches';

    protected $description = 'Sinkronkan master cabang dari API SIMONTOK ke cache lokal';

    public function handle(CoreAccountProvider $provider): int
    {
        if (config('core.provider') !== 'remote') {
            $this->error('Sinkronisasi cabang API hanya tersedia saat CORE_PROVIDER=remote.');

            return self::FAILURE;
        }

        $branches = $provider->branches(true);
        if ($branches === []) {
            $this->error('API SIMONTOK tidak mengembalikan cabang aktif.');

            return self::FAILURE;
        }

        $codes = [];
        DB::transaction(function () use ($branches, &$codes): void {
            foreach ($branches as $item) {
                $code = trim((string) ($item['code'] ?? ''));
                $name = trim((string) ($item['name'] ?? ''));
                if ($code === '' || $name === '') {
                    continue;
                }

                $codes[] = $code;
                Branch::withTrashed()->updateOrCreate(
                    ['code' => $code],
                    ['name' => $name, 'is_active' => (bool) ($item['is_active'] ?? true), 'deleted_at' => null],
                );
            }

            Branch::query()->whereNotIn('code', $codes)->update(['is_active' => false]);
        });

        $this->info('Cabang API tersinkron: '.count($codes).'.');

        return self::SUCCESS;
    }
}
