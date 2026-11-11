<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ClearSimontokUsers extends Command
{
    protected $signature = 'simontok:clear-users
        {--except=sakhandaru : Nilai email pengguna yang dipertahankan}
        {--force : Jalankan tanpa meminta konfirmasi}';

    protected $description = 'Hapus pengguna aplikasi kecuali akun yang ditentukan';

    public function handle(): int
    {
        if (Order::query()->exists()) {
            $this->error('Masih ada order. Jalankan simontok:clear-orders terlebih dahulu agar relasi pengguna aman.');

            return self::FAILURE;
        }

        $except = (string) $this->option('except');
        $users = User::query()->where('email', '!=', $except);
        $count = $users->count();

        if ($count === 0) {
            $this->info("Tidak ada pengguna selain {$except} yang perlu dibersihkan.");

            return self::SUCCESS;
        }

        $this->warn("Akan menghapus {$count} pengguna, kecuali {$except}.");
        $this->line('Notaris, cabang, order, dan pengguna yang dikecualikan tidak akan dihapus.');

        if (! $this->option('force') && ! $this->confirm('Lanjutkan penghapusan pengguna?')) {
            $this->info('Dibatalkan.');

            return self::SUCCESS;
        }

        DB::transaction(function () use ($users): void {
            $users->eachById(fn (User $user): bool => (bool) $user->delete());
        });

        $this->info("{$count} pengguna berhasil dibersihkan.");

        return self::SUCCESS;
    }
}
