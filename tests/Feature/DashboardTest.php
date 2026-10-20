<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Permission;
use App\Models\Role;
use App\Models\JobPosition;
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
}
