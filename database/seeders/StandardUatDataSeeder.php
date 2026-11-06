<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\CoreDummyAccount;
use App\Models\CoreStagedAccount;
use App\Models\Notary;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class StandardUatDataSeeder extends Seeder
{
    public function run(): void
    {
        if (! (app()->environment(['local', 'testing', 'staging']) || config('uat.enabled')) || config('core.provider') !== 'dummy') {
            throw new \RuntimeException('Reset data UAT hanya boleh dijalankan pada environment UAT dengan CORE_PROVIDER=dummy.');
        }

        $this->resetDummyOperationalData();
        $this->call(DatabaseSeeder::class);
        $this->call(CoreAccountSeeder::class);
        Artisan::call('core:sync-staging');
    }

    private function resetDummyOperationalData(): void
    {
        $operationalTables = [
            'payments', 'payment_requests', 'order_handovers', 'order_documents',
            'order_checklists', 'order_progress', 'order_revisions', 'order_status_histories',
            'order_step_fees', 'order_collateral_jobs', 'order_collaterals', 'covernote_extensions',
            'document_requests', 'notification_deliveries', 'notifications', 'announcement_reads',
            'document_archives', 'audit_logs', 'announcements', 'branch_notary', 'notary_agreement_versions',
            'orders',
        ];

        Schema::disableForeignKeyConstraints();
        try {
            foreach ($operationalTables as $table) {
                if (Schema::hasTable($table)) {
                    DB::table($table)->delete();
                }
            }
        } finally {
            Schema::enableForeignKeyConstraints();
        }

        CoreStagedAccount::query()->delete();
        CoreDummyAccount::query()->delete();

        $emergencyLogin = config('services.sso.emergency_login');
        User::query()
            ->when($emergencyLogin, fn ($query) => $query->where('email', '!=', $emergencyLogin))
            ->get()
            ->each->delete();

        Notary::withTrashed()->get()->each->forceDelete();
        Branch::withTrashed()->get()->each->forceDelete();

        foreach ([
            'sla_policies', 'document_checklists', 'job_type_steps', 'job_types',
            'collateral_types', 'bank_names', 'payment_scheme_options',
        ] as $table) {
            if (Schema::hasTable($table)) {
                DB::table($table)->delete();
            }
        }
    }
}
