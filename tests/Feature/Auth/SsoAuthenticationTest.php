<?php

namespace Tests\Feature\Auth;

use App\Models\Branch;
use App\Models\JobPosition;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class SsoAuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_employee_can_login_through_sso_and_profile_is_synced(): void
    {
        $role = Role::create(['code' => 'legal_admin', 'name' => 'Admin Legal']);
        $position = JobPosition::create([
            'code' => 'LEGAL',
            'name' => 'Admin Legal',
            'role_id' => $role->id,
        ]);
        $branch = Branch::create(['code' => '000', 'name' => 'Kantor Pusat']);
        User::factory()->create([
            'email' => 'pegawai@example.com',
            'sso_employee_id' => '102-119',
            'job_position_id' => $position->id,
            'branch_id' => $branch->id,
            'is_active' => true,
        ]);

        config([
            'services.sso.enabled' => true,
            'services.sso.url' => 'https://apisso.test',
            'services.sso.app' => 'monbis',
        ]);

        Http::fake([
            'https://apisso.test/api/auth/login' => Http::response([
                'status' => 200,
                'data' => ['token' => 'sso-token'],
            ]),
            'https://apisso.test/api/auth/whoami' => Http::response([
                'status' => 200,
                'data' => [
                    'employee_id' => '102-119',
                    'full_name' => 'Nama Pegawai',
                    'branch_code' => '000',
                    'branch_name' => 'Kantor Pusat',
                    'job_position_code' => 'LEGAL',
                    'job_position' => 'Admin Legal',
                ],
            ]),
        ]);

        $response = $this->post(route('login.store'), [
            'email' => '102-119',
            'password' => 'password-sso',
        ]);

        $response->assertRedirect(route('dashboard', absolute: false));
        $this->assertAuthenticated();
        $this->assertDatabaseHas('users', [
            'sso_employee_id' => '102-119',
            'name' => 'Nama Pegawai',
            'branch_id' => $branch->id,
            'job_position_id' => $position->id,
            'is_active' => true,
        ]);

        Http::assertSent(fn ($request) => $request->url() === 'https://apisso.test/api/auth/login'
            && $request['id_peg'] === '102-119'
            && $request['app'] === 'monbis');
        Http::assertSent(fn ($request) => $request->url() === 'https://apisso.test/api/auth/whoami'
            && $request->hasHeader('Authorization', 'Bearer sso-token'));
    }

    public function test_sso_rejects_an_authenticated_employee_without_a_simontok_user(): void
    {
        $role = Role::create(['code' => 'legal_admin', 'name' => 'Admin Legal']);
        JobPosition::create([
            'code' => 'LEGAL',
            'name' => 'Admin Legal',
            'role_id' => $role->id,
        ]);
        Branch::create(['code' => '000', 'name' => 'Kantor Pusat']);

        config([
            'services.sso.enabled' => true,
            'services.sso.url' => 'https://apisso.test',
        ]);
        Http::fake([
            'https://apisso.test/api/auth/login' => Http::response([
                'data' => ['token' => 'sso-token'],
            ]),
            'https://apisso.test/api/auth/whoami' => Http::response([
                'data' => [
                    'employee_id' => '102-120',
                    'full_name' => 'Belum Diaktifkan',
                ],
            ]),
        ]);

        $this->from(route('login'))
            ->post(route('login.store'), [
                'email' => '102-120',
                'password' => 'password-sso',
            ])
            ->assertRedirect(route('login'))
            ->assertSessionHasErrors('email');

        $this->assertGuest();
        $this->assertDatabaseCount('users', 0);
    }

    public function test_sso_rejects_an_account_without_application_access(): void
    {
        config([
            'services.sso.enabled' => true,
            'services.sso.url' => 'https://apisso.test',
        ]);

        Http::fake([
            'https://apisso.test/api/auth/login' => Http::response(['status' => 403], 403),
        ]);

        $this->from(route('login'))
            ->post(route('login.store'), [
                'email' => '102-119',
                'password' => 'password-sso',
            ])
            ->assertRedirect(route('login'))
            ->assertSessionHasErrors('email');

        $this->assertGuest();
        $this->assertDatabaseCount('users', 0);
    }

    public function test_emergency_it_admin_can_login_locally_while_sso_is_enabled(): void
    {
        $role = Role::create(['code' => 'it_admin', 'name' => 'IT Administrator']);
        $position = JobPosition::create([
            'code' => 'IT_ADMIN',
            'name' => 'IT Administrator',
            'role_id' => $role->id,
        ]);
        $user = User::factory()->create([
            'email' => 'admin',
            'password' => 'emergency-password',
            'job_position_id' => $position->id,
            'sso_employee_id' => null,
        ]);

        config([
            'services.sso.enabled' => true,
            'services.sso.emergency_login' => 'admin',
        ]);

        $this->post(route('login.store'), [
            'email' => $user->email,
            'password' => 'emergency-password',
        ]);

        $this->assertAuthenticatedAs($user);
        Http::assertNothingSent();
    }

    public function test_regular_internal_local_account_cannot_bypass_sso(): void
    {
        $role = Role::create(['code' => 'legal_admin', 'name' => 'Admin Legal']);
        $position = JobPosition::create([
            'code' => 'LEGAL',
            'name' => 'Admin Legal',
            'role_id' => $role->id,
        ]);
        $user = User::factory()->create([
            'email' => 'legal',
            'password' => 'local-password',
            'job_position_id' => $position->id,
            'sso_employee_id' => null,
        ]);

        config([
            'services.sso.enabled' => true,
            'services.sso.emergency_login' => 'admin',
        ]);
        Http::fake([
            '*/api/auth/login' => Http::response(['status' => 401], 401),
        ]);

        $this->post(route('login.store'), [
            'email' => $user->email,
            'password' => 'local-password',
        ]);

        $this->assertGuest();
        Http::assertSent(fn ($request) => $request['id_peg'] === 'legal');
    }

    public function test_local_mode_keeps_existing_login_flow(): void
    {
        config(['services.sso.enabled' => false]);
        $user = User::factory()->create();

        $this->post(route('login.store'), [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $this->assertAuthenticatedAs($user);
        Http::assertNothingSent();
    }
}
