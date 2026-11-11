<?php

namespace App\Console\Commands;

use App\Models\DocumentArchive;
use App\Models\Order;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ClearSimontokOrders extends Command
{
    protected $signature = 'simontok:clear-orders {--force : Jalankan tanpa meminta konfirmasi}';

    protected $description = 'Hapus seluruh order UAT beserta data turunannya tanpa menghapus master data';

    public function handle(): int
    {
        $count = Order::query()->count();

        if ($count === 0) {
            $this->info('Tidak ada order yang perlu dibersihkan.');

            return self::SUCCESS;
        }

        $this->warn("Akan menghapus {$count} order beserta data turunannya.");
        $this->line('Pengguna, notaris, cabang, dan konfigurasi tidak akan dihapus.');

        if (! $this->option('force') && ! $this->confirm('Lanjutkan penghapusan order?')) {
            $this->info('Dibatalkan.');

            return self::SUCCESS;
        }

        DB::transaction(function (): void {
            DocumentArchive::query()
                ->whereIn('documentable_type', [Order::class, 'App\\Models\\OrderCollateral', 'App\\Models\\OrderHandover'])
                ->delete();

            Order::query()->delete();
        });

        $this->info("{$count} order berhasil dibersihkan.");

        return self::SUCCESS;
    }
}
