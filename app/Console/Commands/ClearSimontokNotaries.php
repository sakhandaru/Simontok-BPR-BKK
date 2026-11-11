<?php

namespace App\Console\Commands;

use App\Models\DocumentArchive;
use App\Models\Notary;
use App\Models\Order;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ClearSimontokNotaries extends Command
{
    protected $signature = 'simontok:clear-notaries
        {--force : Jalankan tanpa meminta konfirmasi}
        {--keep-user=sakhandaru : Email pengguna yang tidak boleh ikut dihapus}';

    protected $description = 'Hapus seluruh notaris beserta akun portal notaris tanpa menghapus cabang';

    public function handle(): int
    {
        if (Order::query()->exists()) {
            $this->error('Masih ada order yang memakai notaris. Jalankan simontok:clear-orders terlebih dahulu.');

            return self::FAILURE;
        }

        $notaries = Notary::withTrashed();
        $count = $notaries->count();
        $keepUser = (string) $this->option('keep-user');
        $notaryUserCount = User::query()
            ->whereNotNull('notary_id')
            ->where('email', '!=', $keepUser)
            ->count();

        if ($count === 0) {
            $this->info('Tidak ada notaris yang perlu dibersihkan.');

            return self::SUCCESS;
        }

        $this->warn("Akan menghapus {$count} notaris beserta relasi cabang dan arsip perjanjiannya.");
        $this->line("Akun portal notaris yang terhubung ikut dihapus: {$notaryUserCount}. Pengguna {$keepUser} tetap dipertahankan.");
        $this->line('Pengguna non-notaris dan cabang tetap dipertahankan.');

        if (! $this->option('force') && ! $this->confirm('Lanjutkan penghapusan notaris?')) {
            $this->info('Dibatalkan.');

            return self::SUCCESS;
        }

        DB::transaction(function () use ($notaries, $keepUser): void {
            $ids = $notaries->pluck('id');

            User::query()
                ->whereIn('notary_id', $ids)
                ->where('email', '!=', $keepUser)
                ->eachById(fn (User $user): bool => (bool) $user->delete());
            User::query()->whereIn('notary_id', $ids)->where('email', $keepUser)->update(['notary_id' => null]);

            if (Schema::hasTable('branch_notary')) {
                DB::table('branch_notary')->whereIn('notary_id', $ids)->delete();
            }

            if (Schema::hasTable('notary_agreement_versions')) {
                DB::table('notary_agreement_versions')->whereIn('notary_id', $ids)->delete();
            }

            if (Schema::hasTable('document_archives')) {
                DocumentArchive::query()
                    ->where('documentable_type', Notary::class)
                    ->whereIn('documentable_id', $ids)
                    ->delete();
            }

            $notaries->each(fn (Notary $notary): bool => (bool) $notary->forceDelete());
        });

        $this->info("{$count} notaris berhasil dibersihkan.");

        return self::SUCCESS;
    }
}
