<?php

namespace App\Console\Commands;

use App\Models\DocumentArchive;
use App\Models\Notary;
use App\Models\Order;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ClearSimontokNotaries extends Command
{
    protected $signature = 'simontok:clear-notaries {--force : Jalankan tanpa meminta konfirmasi}';

    protected $description = 'Hapus seluruh notaris tanpa menghapus pengguna dan cabang';

    public function handle(): int
    {
        if (Order::query()->exists()) {
            $this->error('Masih ada order yang memakai notaris. Jalankan simontok:clear-orders terlebih dahulu.');

            return self::FAILURE;
        }

        $notaries = Notary::withTrashed();
        $count = $notaries->count();

        if ($count === 0) {
            $this->info('Tidak ada notaris yang perlu dibersihkan.');

            return self::SUCCESS;
        }

        $this->warn("Akan menghapus {$count} notaris beserta relasi cabang dan arsip perjanjiannya.");
        $this->line('Pengguna dan cabang tetap dipertahankan. Akun pengguna yang terhubung akan dilepas dari notaris.');

        if (! $this->option('force') && ! $this->confirm('Lanjutkan penghapusan notaris?')) {
            $this->info('Dibatalkan.');

            return self::SUCCESS;
        }

        DB::transaction(function () use ($notaries): void {
            $ids = $notaries->pluck('id');

            User::query()->whereIn('notary_id', $ids)->update(['notary_id' => null]);
            DB::table('branch_notary')->whereIn('notary_id', $ids)->delete();
            DB::table('notary_agreement_versions')->whereIn('notary_id', $ids)->delete();
            DocumentArchive::query()
                ->where('documentable_type', Notary::class)
                ->whereIn('documentable_id', $ids)
                ->delete();

            $notaries->each(fn (Notary $notary): bool => (bool) $notary->forceDelete());
        });

        $this->info("{$count} notaris berhasil dibersihkan.");

        return self::SUCCESS;
    }
}
