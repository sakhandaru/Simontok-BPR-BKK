<?php

namespace Tests\Feature;

use App\Enums\TrackAStatus;
use App\Enums\TrackBDocStatus;
use App\Enums\TrackCCovernoteStatus;
use App\Models\Branch;
use App\Models\JobPosition;
use App\Models\JobType;
use App\Models\Notary;
use App\Models\Order;
use App\Models\OrderCollateral;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ReportBranchScopeTest extends TestCase
{
    use RefreshDatabase;

    private Branch $branch;

    private Branch $otherBranch;

    protected function setUp(): void
    {
        parent::setUp();

        $this->branch = Branch::create(['code' => '025', 'name' => 'Kc. Pemalang', 'is_active' => true]);
        $this->otherBranch = Branch::create(['code' => '002', 'name' => 'Kc. Rembang', 'is_active' => true]);
    }

    public static function branchRoles(): array
    {
        return [
            'admin legal' => ['admin_legal_cabang'],
            'pimpinan' => ['pimpinan_cabang'],
            'kabid operasional' => ['kabid_ops_cabang'],
        ];
    }

    #[DataProvider('branchRoles')]
    public function test_branch_is_prefilled_and_locked_for_branch_roles(string $roleCode): void
    {
        $user = $this->makeUser($roleCode);
        $this->makeOrders($user);

        $this->actingAs($user)->get(route('reports.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('simontok/reports/index')
                ->where('branchLocked', true)
                ->where('filters.branch_id', (string) $this->branch->id)
                ->has('branches', 1)
                ->where('branches.0.id', $this->branch->id)
                ->has('notaries', 1)
                ->where('summary.total_orders', 1)
                ->where('summary.risk_orders', 0)
                ->where('reportKpis.covernote_attention', 0)
                ->where('documentValidation.final_validated', 0)
                ->where('documentValidation.final_uploaded', 1)
                ->has('byBranch.data', 1)
                ->where('byBranch.data.0.code', $this->branch->code)
                ->has('outstandingOrders.data', 1));
    }

    public function test_branch_filter_cannot_be_cleared_or_changed_through_the_url(): void
    {
        $user = $this->makeUser('admin_legal_cabang');
        $this->makeOrders($user);

        foreach (['', (string) $this->otherBranch->id] as $requestedBranch) {
            $this->actingAs($user)->get(route('reports.index', ['branch_id' => $requestedBranch]))
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->where('branchLocked', true)
                    ->where('filters.branch_id', (string) $this->branch->id)
                    ->where('summary.total_orders', 1)
                    ->where('summary.risk_orders', 0)
                    ->where('byBranch.data.0.code', $this->branch->code));
        }
    }

    public function test_reset_clears_other_filters_but_keeps_the_account_branch(): void
    {
        $user = $this->makeUser('admin_legal_cabang');
        $this->makeOrders($user);

        $this->actingAs($user)->get(route('reports.index', [
            'notary_id' => Order::where('branch_id', $this->branch->id)->value('notary_id'),
            'date_from' => now()->addDay()->toDateString(),
            'date_to' => now()->addDays(2)->toDateString(),
        ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('summary.total_orders', 0));

        $this->get(route('reports.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('branchLocked', true)
                ->where('filters.branch_id', (string) $this->branch->id)
                ->where('filters.date_from', '')
                ->where('filters.date_to', '')
                ->where('filters.notary_id', '')
                ->where('summary.total_orders', 1));
    }

    public function test_central_user_can_select_another_branch_or_all_branches(): void
    {
        $user = $this->makeUser('admin_legal_pusat');
        $this->makeOrders($user);

        $this->actingAs($user)->get(route('reports.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('branchLocked', false)
                ->where('filters.branch_id', '')
                ->has('branches', 2)
                ->where('summary.total_orders', 2));

        $this->get(route('reports.index', ['branch_id' => $this->otherBranch->id]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('branchLocked', false)
                ->where('filters.branch_id', (string) $this->otherBranch->id)
                ->where('summary.total_orders', 1)
                ->where('summary.risk_orders', 1)
                ->where('byBranch.data.0.code', $this->otherBranch->code));

        $this->get(route('reports.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.branch_id', '')
                ->where('summary.total_orders', 2));
    }

    private function makeUser(string $roleCode): User
    {
        $permission = Permission::create(['code' => 'reports.view', 'name' => 'Lihat laporan', 'module' => 'reports']);
        $role = Role::create(['code' => $roleCode, 'name' => $roleCode]);
        $role->permissions()->attach($permission);
        $position = JobPosition::create(['code' => 'TEST_REPORT', 'name' => 'Test laporan', 'role_id' => $role->id]);

        return User::factory()->create([
            'branch_id' => $this->branch->id,
            'job_position_id' => $position->id,
            'is_active' => true,
        ]);
    }

    private function makeOrders(User $user): void
    {
        $jobType = JobType::create(['code' => 'APHT', 'name' => 'APHT']);

        foreach ([$this->branch, $this->otherBranch] as $branch) {
            $isOtherBranch = $branch->is($this->otherBranch);
            $notary = Notary::create(['name' => 'Notaris '.$branch->code, 'is_active' => true]);
            $notary->branches()->attach($branch->id, ['is_active' => true]);
            $order = Order::create([
                'order_no' => 'REPORT-'.$branch->code,
                'branch_id' => $branch->id,
                'notary_id' => $notary->id,
                'customer_name' => 'Nasabah '.$branch->code,
                'no_rekening' => $branch->code.'000000001',
                'status' => TrackAStatus::ProsesAkta,
                'risk_flag' => $isOtherBranch,
                'created_by' => $user->id,
            ]);
            OrderCollateral::create([
                'order_id' => $order->id,
                'job_type_id' => $jobType->id,
                'doc_status' => $isOtherBranch ? TrackBDocStatus::FinalDivalidasi : TrackBDocStatus::FinalDiunggah,
                'covernote_status' => $isOtherBranch ? TrackCCovernoteStatus::Kedaluwarsa : TrackCCovernoteStatus::Aktif,
            ]);
        }
    }
}
