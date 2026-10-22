<?php

namespace Tests\Feature;

use App\Models\JobPosition;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_redirected_to_the_login_page()
    {
        $response = $this->get(route('dashboard'));
        $response->assertRedirect(route('login'));
    }

    public function test_authenticated_users_can_visit_the_dashboard()
    {
        $permission = Permission::create(['code' => 'dashboard.view', 'name' => 'Lihat dashboard', 'module' => 'dashboard']);
        $role = Role::create(['code' => 'test_role', 'name' => 'Test role']);
        $role->permissions()->attach($permission);
        $position = JobPosition::create(['code' => 'TEST', 'name' => 'Test', 'role_id' => $role->id]);
        $user = User::factory()->create(['job_position_id' => $position->id, 'is_active' => true]);
        $this->actingAs($user);

        $response = $this->get(route('dashboard'));
        $response->assertOk();
    }

    public function test_dashboard_payload_contains_deltas_and_traceable_counts()
    {
        $permission = Permission::create(['code' => 'dashboard.view', 'name' => 'Lihat dashboard', 'module' => 'dashboard']);
        $role = Role::create(['code' => 'test_role', 'name' => 'Test role']);
        $role->permissions()->attach($permission);
        $position = JobPosition::create(['code' => 'TEST', 'name' => 'Test', 'role_id' => $role->id]);
        $user = User::factory()->create(['job_position_id' => $position->id, 'is_active' => true]);
        $this->actingAs($user);

        $response = $this->get(route('dashboard'));
        $response->assertOk();

        $props = $response->original->getData()['page']['props'];

        $this->assertArrayHasKey('deltas', $props);
        foreach (['active', 'completed'] as $key) {
            $this->assertArrayHasKey('now', $props['deltas'][$key]);
            $this->assertArrayHasKey('previous', $props['deltas'][$key]);
            $this->assertArrayHasKey('change', $props['deltas'][$key]);
            $this->assertArrayHasKey('pct', $props['deltas'][$key]);
            // pct null ketika pembanding nol, supaya UI tidak menampilkan persentase karangan.
            if ($props['deltas'][$key]['previous'] === 0) {
                $this->assertNull($props['deltas'][$key]['pct']);
            }
            $this->assertSame(
                $props['deltas'][$key]['now'] - $props['deltas'][$key]['previous'],
                $props['deltas'][$key]['change']
            );
        }

        $this->assertArrayHasKey('pending_final_validation', $props['stats']);
        $this->assertNotEmpty($props['workflow']);
        $this->assertSame(7, count($props['workflow']));
        if (count($props['statusDistribution']) > 0) {
            $this->assertArrayHasKey('value', $props['statusDistribution'][0]);
        }

        foreach ($props['analytics']['agingByStage'] as $row) {
            $this->assertSame(
                array_sum($row['buckets']),
                $row['total'],
                'Tiap baris aging harus menjumlah seluruh bucket-nya.'
            );
        }
    }
}
