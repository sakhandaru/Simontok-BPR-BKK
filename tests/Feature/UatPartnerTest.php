<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\DocumentArchive;
use App\Models\JobPosition;
use App\Models\Notary;
use App\Models\Order;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\UatPartnerSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class UatPartnerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['core.provider' => 'dummy']);
        Storage::fake('local');
        $role = Role::create(['code' => 'notaris', 'name' => 'Notaris']);
        $permission = Permission::create(['code' => 'notary.portal', 'name' => 'Portal Notaris', 'module' => 'notary']);
        $role->permissions()->attach($permission);
        JobPosition::create(['code' => 'NOTARIS', 'name' => 'Notaris', 'role_id' => $role->id]);
    }

    private function admin(): User
    {
        $role = Role::create(['code' => 'it_admin', 'name' => 'IT']);
        $position = JobPosition::create(['code' => 'IT_ADMIN', 'name' => 'IT', 'role_id' => $role->id]);

        return User::factory()->create(['job_position_id' => $position->id, 'is_active' => true]);
    }

    public function test_targeted_seeder_repairs_demo_and_preserves_existing_portal_credentials(): void
    {
        $branch = Branch::create(['code' => '001', 'name' => 'Cabang UAT yang sudah ada', 'is_active' => true]);
        $notary = Notary::create(['email' => 'notaris.demo@example.com', 'name' => 'Kantor Notaris Demo', 'is_active' => true]);
        $portal = User::factory()->create(['notary_id' => $notary->id, 'is_active' => true]);
        $password = $portal->password;
        $untouched = Notary::create(['name' => 'Notaris lain', 'is_active' => false]);

        $this->seed(UatPartnerSeeder::class);
        $archive = DocumentArchive::sole();
        $this->seed(UatPartnerSeeder::class);

        $this->assertSame($password, $portal->fresh()->password);
        $this->assertSame('Cabang UAT yang sudah ada', $branch->fresh()->name);
        $this->assertFalse($untouched->fresh()->is_active);
        $this->assertTrue($notary->fresh()->hasActivePartnership());
        $this->assertSame('notaris', $portal->fresh()->roleCode());
        $this->assertSame($archive->id, DocumentArchive::sole()->id);
        $this->assertDatabaseHas('branch_notary', ['branch_id' => $branch->id, 'notary_id' => $notary->id, 'is_active' => true]);
        Storage::disk('local')->assertExists($archive->file_path);
        $this->assertStringStartsWith('%PDF-', Storage::disk('local')->get($archive->file_path));
    }

    public function test_create_order_uses_a_ready_partner_of_the_selected_branch(): void
    {
        Branch::create(['code' => '000', 'name' => 'AAA tanpa rekanan', 'is_active' => true]);
        $this->seed(UatPartnerSeeder::class);
        $branch = Branch::where('code', '001')->firstOrFail();
        $admin = $this->admin();

        $response = $this->actingAs($admin)->get(route('orders.create'));
        $response->assertRedirect();
        $order = Order::sole();
        $response->assertRedirect(route('orders.show', $order));
        $this->assertSame($branch->id, $order->branch_id);
        $this->assertTrue($order->notary->branches()->whereKey($branch->id)->where('branch_notary.is_active', true)->exists());
        $this->get(route('orders.show', $order))->assertOk();
        $order->update(['sent_to_notary_at' => now()]);
        $portal = $order->notary->users()->sole();
        $this->actingAs($portal)->get(route('notary.orders.agreement.preview', $order))->assertOk();
    }

    public function test_a_branch_user_cannot_create_an_order_with_a_partner_from_another_branch(): void
    {
        $this->seed(UatPartnerSeeder::class);
        $branch = Branch::create(['code' => '999', 'name' => 'Cabang lain', 'is_active' => true]);
        $role = Role::create(['code' => 'admin_legal_cabang', 'name' => 'Admin Cabang']);
        $permission = Permission::create(['code' => 'orders.create', 'name' => 'Buat Order', 'module' => 'orders']);
        $role->permissions()->attach($permission);
        $position = JobPosition::create(['code' => 'LEGAL_CABANG', 'name' => 'Legal Cabang', 'role_id' => $role->id]);
        $user = User::factory()->create(['branch_id' => $branch->id, 'job_position_id' => $position->id, 'is_active' => true]);

        $this->actingAs($user)->get(route('orders.create'))->assertStatus(422);
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_uat_seeder_rejects_api_mode_before_writing_data(): void
    {
        config(['core.provider' => 'api']);
        try {
            $this->seed(UatPartnerSeeder::class);
            $this->fail('Seeder UAT seharusnya ditolak.');
        } catch (\RuntimeException $exception) {
            $this->assertStringContainsString('CORE_PROVIDER=dummy', $exception->getMessage());
        }
        $this->assertDatabaseCount('notaries', 0);
    }
}
