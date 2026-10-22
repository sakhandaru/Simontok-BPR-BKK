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
use Tests\TestCase;

class OrderFilterTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $permission = Permission::create(['code' => 'orders.view', 'name' => 'Lihat order', 'module' => 'orders']);
        $role = Role::create(['code' => 'test_role', 'name' => 'Test role']);
        $role->permissions()->attach($permission);
        $position = JobPosition::create(['code' => 'TEST', 'name' => 'Test', 'role_id' => $role->id]);
        $this->user = User::factory()->create(['job_position_id' => $position->id, 'is_active' => true]);
    }

    private function makeOrder(string $orderNo, string $status, \DateTimeInterface $createdAt): Order
    {
        $branch = Branch::create(['code' => strtoupper(substr($orderNo, -4)), 'name' => "Cabang $orderNo"]);
        $notary = Notary::create(['name' => "Notaris $orderNo"]);
        $order = Order::create([
            'order_no' => $orderNo,
            'branch_id' => $branch->id,
            'notary_id' => $notary->id,
            'customer_name' => "Nasabah $orderNo",
            'no_rekening' => '001',
            'status' => $status,
            'created_by' => $this->user->id,
        ]);
        $order->created_at = $createdAt;
        $order->save();

        return $order;
    }

    private function addCollateral(Order $order, string $docStatus, string $covernoteStatus, ?string $covernoteEnd): OrderCollateral
    {
        $jobType = JobType::first() ?? JobType::create(['code' => 'PK', 'name' => 'Perjanjian Kredit']);

        return OrderCollateral::create([
            'order_id' => $order->id,
            'job_type_id' => $jobType->id,
            'doc_status' => $docStatus,
            'covernote_status' => $covernoteStatus,
            'covernote_end' => $covernoteEnd,
        ]);
    }

    public function test_stage_filter_returns_only_orders_in_that_stage()
    {
        $inStage = $this->makeOrder('ORD-STG-1', TrackAStatus::ProsesAkta->value, now()->subDays(3));
        $this->makeOrder('ORD-STG-2', TrackAStatus::Draft->value, now()->subDays(3));

        $response = $this->actingAs($this->user)->get(route('orders.index', ['stage' => 'akta']));
        $response->assertOk();

        $rows = $response->original->getData()['page']['props']['orders']['data'];
        $this->assertSame([$inStage->order_no], array_column($rows, 'order_no'));
    }

    public function test_age_filter_follows_the_dashboard_aging_buckets()
    {
        $fresh = $this->makeOrder('ORD-AGE-07', TrackAStatus::Draft->value, now()->subDays(3));
        $old = $this->makeOrder('ORD-AGE-31', TrackAStatus::Draft->value, now()->subDays(40));

        $this->actingAs($this->user)
            ->get(route('orders.index', ['age' => '0-7']))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->has('orders.data', 1)->where('orders.data.0.order_no', $fresh->order_no));

        $this->actingAs($this->user)
            ->get(route('orders.index', ['age' => 'gt-30']))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->has('orders.data', 1)->where('orders.data.0.order_no', $old->order_no));
    }

    public function test_doc_and_covernote_filters_match_dashboard_numbers()
    {
        $finalValidated = $this->makeOrder('ORD-DOC-01', TrackAStatus::ProsesAkta->value, now()->subDays(2));
        $this->addCollateral($finalValidated, TrackBDocStatus::FinalDivalidasi->value, TrackCCovernoteStatus::Aktif->value, now()->addDays(10)->toDateString());
        $draft = $this->makeOrder('ORD-DOC-02', TrackAStatus::Draft->value, now()->subDays(2));
        $this->addCollateral($draft, TrackBDocStatus::MenungguVerifikasi->value, TrackCCovernoteStatus::Aktif->value, now()->addDays(20)->toDateString());

        $this->actingAs($this->user)
            ->get(route('orders.index', ['doc' => TrackBDocStatus::FinalDivalidasi->value]))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->has('orders.data', 1)->where('orders.data.0.order_no', $finalValidated->order_no));

        $expired = $this->makeOrder('ORD-CVN-01', TrackAStatus::ProsesAkta->value, now()->subDays(2));
        $this->addCollateral($expired, TrackBDocStatus::DokumenValid->value, TrackCCovernoteStatus::Kedaluwarsa->value, now()->subDays(1)->toDateString());

        $this->actingAs($this->user)
            ->get(route('orders.index', ['covernote' => 'expired']))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->has('orders.data', 1)->where('orders.data.0.order_no', $expired->order_no));
    }

    public function test_active_filter_excludes_closed_orders_and_stage_payload_is_available()
    {
        $active = $this->makeOrder('ORD-ACT-01', TrackAStatus::ProsesAkta->value, now()->subDays(1));
        $this->makeOrder('ORD-ACT-02', TrackAStatus::Selesai->value, now()->subDays(1));

        $response = $this->actingAs($this->user)->get(route('orders.index', ['active' => '1']));
        $response->assertOk();

        $props = $response->original->getData()['page']['props'];
        $this->assertSame([$active->order_no], array_column($props['orders']['data'], 'order_no'));
        $this->assertSame(7, count($props['stages']));
        $this->assertSame('akta', $props['stages'][3]['value']);
    }

    public function test_invalid_filter_values_are_rejected()
    {
        $this->actingAs($this->user)
            ->get(route('orders.index', ['stage' => 'bukan-tahap', 'age' => '99-999']))
            ->assertSessionHasErrors(['stage', 'age']);
    }
}
