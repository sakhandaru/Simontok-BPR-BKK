<?php

namespace Tests\Feature;

use App\Enums\TrackAStatus;
use App\Models\Branch;
use App\Models\CoreDummyAccount;
use App\Models\CoreDummyCollateral;
use App\Models\CoreStagedAccount;
use App\Models\Notary;
use App\Models\Order;
use App\Models\User;
use App\Services\Core\DummyCoreAccountProvider;
use App\Services\Core\StagedCoreAccountProvider;
use Database\Seeders\CoreAccountSeeder;
use Database\Seeders\KudusUatAccountSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CoreAccountSeederTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['core.provider' => 'dummy']);
    }

    public function test_reseeding_preserves_master_data_orders_users_and_unrelated_dummy_accounts(): void
    {
        $branch = Branch::create(['code' => '002', 'name' => 'Nama cabang dari master', 'is_active' => false]);
        $deletedBranch = Branch::create(['code' => '010', 'name' => 'Cabang dihapus', 'is_active' => true]);
        $deletedBranch->delete();
        $user = User::factory()->create();
        $notary = Notary::create(['name' => 'Notaris existing', 'is_active' => true]);
        $otherAccount = CoreDummyAccount::create([
            'account_id' => 'CUSTOM-UAT-ACCOUNT', 'account_number' => '011123456789',
            'customer_id' => 'CUSTOM-UAT-CUSTOMER', 'customer_name' => 'Nasabah uji manual',
            'branch_code' => '011', 'branch_name' => 'Cabang uji lain', 'plafon' => 42_000_000,
        ]);
        $otherAccountAttributes = $otherAccount->fresh()->getRawOriginal();

        $this->seed(CoreAccountSeeder::class);
        $originalAccount = CoreDummyAccount::where('account_id', 'DUMMY-ACCOUNT-001')->firstOrFail();
        $collateral = $originalAccount->collaterals()->sole();
        $collateralCount = CoreDummyCollateral::count();
        $snapshot = (new DummyCoreAccountProvider)->find($originalAccount->account_id);
        $order = Order::create([
            'order_no' => 'UAT-EXISTING-ORDER',
            'branch_id' => Branch::where('code', '001')->value('id'),
            'notary_id' => $notary->id,
            'customer_name' => $originalAccount->customer_name,
            'no_rekening' => $originalAccount->account_number,
            'plafon' => $originalAccount->plafon,
            'core_account_id' => $originalAccount->account_id,
            'core_snapshot' => $snapshot,
            'status' => TrackAStatus::Draft,
            'created_by' => $user->id,
        ]);
        $orderAttributes = $order->fresh()->getRawOriginal();
        $userAttributes = $user->fresh()->getRawOriginal();

        $this->seed(CoreAccountSeeder::class);

        $this->assertDatabaseCount('core_dummy_accounts', 211);
        $this->assertDatabaseCount('core_dummy_collaterals', $collateralCount);
        $this->assertSame($collateral->id, $originalAccount->collaterals()->sole()->id);
        $this->assertSame('001234567890', $originalAccount->fresh()->account_number);
        $this->assertSame($otherAccountAttributes, $otherAccount->fresh()->getRawOriginal());
        $this->assertSame('Nama cabang dari master', $branch->fresh()->name);
        $this->assertFalse($branch->fresh()->is_active);
        $this->assertTrue($deletedBranch->fresh()->trashed());
        $this->assertSame($branch->name, CoreDummyAccount::where('account_id', 'UAT-ACCOUNT-002-001')->value('branch_name'));
        $this->assertDatabaseCount('branches', 10);
        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseCount('notaries', 1);
        $this->assertDatabaseCount('orders', 1);
        $this->assertSame($orderAttributes, $order->fresh()->getRawOriginal());
        $this->assertSame($userAttributes, $user->fresh()->getRawOriginal());
    }

    public function test_all_ten_branches_have_searchable_scenarios_after_staging_sync(): void
    {
        $this->seed(CoreAccountSeeder::class);
        $this->artisan('core:sync-staging')->assertSuccessful();
        $this->artisan('core:sync-staging')->assertSuccessful();

        $this->assertDatabaseCount('core_staged_accounts', 210);
        $this->assertSame(210, CoreStagedAccount::distinct()->count('account_number'));
        $this->assertDatabaseCount('core_staged_collaterals', CoreDummyCollateral::count());
        $provider = new StagedCoreAccountProvider;
        foreach (range(1, 10) as $number) {
            $code = sprintf('%03d', $number);
            $results = $provider->search($code.'990', $code);
            $this->assertCount(20, $results);
            $this->assertSame([$code], array_values(array_unique(array_column(array_column($results, 'branch'), 'code'))));
        }

        $first = $provider->find('UAT-ACCOUNT-010-001', '010');
        $second = $provider->find('UAT-ACCOUNT-010-002', '010');
        $namesake = $provider->find('UAT-ACCOUNT-010-020', '010');
        $this->assertSame('010990000001', $first['account_number']);
        $this->assertSame($first['customer_id'], $second['customer_id']);
        $this->assertNotSame($first['account_number'], $second['account_number']);
        $this->assertSame($first['customer_name'], $namesake['customer_name']);
        $this->assertNotSame($first['customer_id'], $namesake['customer_id']);
        $this->assertSame('married', $first['customer']['marital_status']);
        $this->assertSame('single', $namesake['customer']['marital_status']);
        $this->assertNull($provider->find('UAT-ACCOUNT-010-013', '010')['customer']['marital_status']);
        $this->assertSame(150_000_000.0, (float) $first['credit']['loan_amount']);
        $this->assertCount(1, $first['collaterals']);
        $this->assertCount(2, $second['collaterals']);
        $this->assertCount(0, $provider->find('UAT-ACCOUNT-010-003', '010')['collaterals']);
        $this->assertCount(3, $provider->find('UAT-ACCOUNT-010-011', '010')['collaterals']);
        $this->assertNull($provider->find('UAT-ACCOUNT-010-001', '009'));
        $this->assertSame([], $provider->search('010990', '009'));
    }

    public function test_api_provider_skips_dummy_seed_data(): void
    {
        config(['core.provider' => 'api']);

        $this->seed(CoreAccountSeeder::class);

        $this->assertDatabaseCount('core_dummy_accounts', 0);
        $this->assertDatabaseCount('core_dummy_collaterals', 0);
        $this->assertDatabaseCount('branches', 0);
    }

    public function test_kudus_seeder_and_scoped_sync_leave_other_branches_unchanged(): void
    {
        $other = CoreDummyAccount::create([
            'account_id' => 'UAT-ACCOUNT-001-001', 'account_number' => '001990000001',
            'customer_id' => 'UAT-CUSTOMER-001-001', 'customer_name' => 'Nasabah cabang lain',
            'branch_code' => '001', 'branch_name' => 'Cabang lain', 'plafon' => 123_000_000,
        ]);
        $this->artisan('core:sync-staging')->assertSuccessful();
        $otherStaged = CoreStagedAccount::sole();
        $otherStaged->update(['expires_at' => now()->subDay()]);
        $original = $other->fresh()->getRawOriginal();
        $stagedOriginal = $otherStaged->fresh()->getRawOriginal();

        $this->seed(KudusUatAccountSeeder::class);
        $this->artisan('core:sync-staging', ['--branch' => '002', '--ttl' => 1440])->assertSuccessful();
        $this->seed(KudusUatAccountSeeder::class);
        $this->artisan('core:sync-staging', ['--branch' => '002', '--ttl' => 1440])->assertSuccessful();

        $this->assertDatabaseCount('core_dummy_accounts', 21);
        $this->assertDatabaseCount('core_staged_accounts', 21);
        $this->assertDatabaseCount('branches', 1);
        $this->assertDatabaseHas('branches', ['code' => '002', 'name' => 'KC. Kudus']);
        $this->assertSame($original, $other->fresh()->getRawOriginal());
        $this->assertSame($stagedOriginal, $otherStaged->fresh()->getRawOriginal());
        $this->assertSame(20, CoreStagedAccount::where('branch_code', '002')->where('expires_at', '>', now()->addHours(23))->count());
        $provider = new StagedCoreAccountProvider;
        $this->assertCount(20, $provider->search('002990', '002'));
        $this->assertSame('KC. Kudus', $provider->find('UAT-ACCOUNT-002-001', '002')['branch']['name']);
    }

    public function test_invalid_branch_filter_does_not_sync_all_accounts(): void
    {
        $this->seed(KudusUatAccountSeeder::class);

        $this->artisan('core:sync-staging', ['--branch' => '2'])->assertFailed();
        $this->artisan('core:sync-staging', ['--branch' => ''])->assertFailed();

        $this->assertDatabaseCount('core_staged_accounts', 0);
    }
}
