<?php

namespace Database\Seeders;

use App\Models\Order;
use App\Models\OrderCollateral;
use App\Models\OrderHandover;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

class ProductionUsersAndOrdersResetSeeder extends Seeder
{
    private const CONFIRMATION = 'DELETE_USERS_AND_ORDERS';

    public function run(): void
    {
        if (! app()->environment('production')) {
            throw new RuntimeException('Seeder ini hanya boleh dijalankan pada APP_ENV=production.');
        }

        if (env('PRODUCTION_RESET_CONFIRM') !== self::CONFIRMATION) {
            throw new RuntimeException('Tetapkan PRODUCTION_RESET_CONFIRM='.self::CONFIRMATION.' untuk mengonfirmasi penghapusan.');
        }

        $emergencyLogin = trim((string) config('services.sso.emergency_login'));
        if ($emergencyLogin === '') {
            throw new RuntimeException('SSO_EMERGENCY_LOGIN wajib diisi.');
        }

        $emergency = User::query()->where('email', $emergencyLogin)->first();
        if (! $emergency || $emergency->roleCode() !== 'it_admin' || ! $emergency->is_active) {
            throw new RuntimeException('Akun IT Darurat aktif tidak ditemukan; reset dibatalkan.');
        }

        $this->command?->info('Akun yang dipertahankan: '.$emergency->email.' (ID '.$emergency->id.')');
        $this->command?->info('User yang dihapus: '.User::query()->where('id', '<>', $emergency->id)->count());
        $this->command?->info('Order yang dihapus: '.Order::query()->count());

        if (filter_var(env('PRODUCTION_RESET_DRY_RUN', false), FILTER_VALIDATE_BOOLEAN)) {
            $this->command?->warn('DRY RUN aktif; tidak ada data yang dihapus.');

            return;
        }

        DB::transaction(function () use ($emergency): void {
            Schema::disableForeignKeyConstraints();
            try {
                $this->deleteOrderArtifacts();

                User::query()
                    ->where('id', '<>', $emergency->id)
                    ->delete();
            } finally {
                Schema::enableForeignKeyConstraints();
            }
        });

        $this->command?->info('Reset production selesai. Akun IT Darurat tetap dipertahankan.');
    }

    private function deleteOrderArtifacts(): void
    {
        foreach ([
            'payments', 'payment_requests', 'order_handovers', 'order_documents',
            'order_checklists', 'order_progress', 'order_revisions', 'order_status_histories',
            'order_step_fees', 'order_collateral_jobs', 'order_collaterals', 'covernote_extensions',
            'document_requests', 'notification_deliveries', 'notifications', 'orders',
        ] as $table) {
            if (Schema::hasTable($table)) {
                DB::table($table)->delete();
            }
        }

        if (Schema::hasTable('document_archives')) {
            DB::table('document_archives')
                ->whereIn('documentable_type', [
                    Order::class,
                    OrderCollateral::class,
                    OrderHandover::class,
                    Payment::class,
                ])
                ->delete();
        }
    }
}
