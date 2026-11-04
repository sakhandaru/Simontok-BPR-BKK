<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\CoreDummyAccount;
use App\Models\CoreStagedAccount;
use App\Models\Notary;
use App\Models\Order;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class StandardUatDataSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing', 'staging']) || config('core.provider') !== 'dummy') {
            throw new \RuntimeException('Reset data UAT hanya boleh dijalankan pada environment local/testing/staging dengan CORE_PROVIDER=dummy.');
        }

        $this->resetDummyOperationalData();
        $this->call(DatabaseSeeder::class);
        $this->call(DemoFullDataSeeder::class);
        $this->call(CoreAccountSeeder::class);
        Artisan::call('core:sync-staging');
    }

    private function resetDummyOperationalData(): void
    {
        Order::query()->get()->each->delete();

        foreach (['document_archives', 'announcements', 'notifications', 'audit_logs'] as $table) {
            if (Schema::hasTable($table)) {
                DB::table($table)->delete();
            }
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
