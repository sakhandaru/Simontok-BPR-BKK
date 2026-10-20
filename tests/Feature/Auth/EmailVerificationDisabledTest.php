<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use App\Models\Permission;
use App\Models\Role;
use App\Models\JobPosition;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EmailVerificationDisabledTest extends TestCase
{
    use RefreshDatabase;

    public function test_unverified_users_can_access_authenticated_pages(): void
    {
        $permission = Permission::create(['code' => 'dashboard.view', 'name' => 'Lihat dashboard', 'module' => 'dashboard']);
        $role = Role::create(['code' => 'test_role', 'name' => 'Test role']);
        $role->permissions()->attach($permission);
        $position = JobPosition::create(['code' => 'TEST', 'name' => 'Test', 'role_id' => $role->id]);
        $user = User::factory()->unverified()->create(['job_position_id' => $position->id, 'is_active' => true]);

        $this->actingAs($user)
            ->get(route('dashboard'))
            ->assertOk();

        $this->actingAs($user)
            ->get(route('appearance.edit'))
            ->assertOk();
    }
}
