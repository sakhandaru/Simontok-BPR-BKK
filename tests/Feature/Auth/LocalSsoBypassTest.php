<?php

namespace Tests\Feature\Auth;

use App\Models\Branch;
use App\Models\JobPosition;
use App\Models\Notary;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class LocalSsoBypassTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(PreventRequestForgery::class);
        $this->app->instance('env', 'local');
        config([
            'services.sso.enabled' => true,
            'services.sso.local_bypass' => true,
            'services.sso.local_password' => 'local-test-password',
            'services.sso.url' => 'https://apisso.test',
            'services.sso.emergency_login' => 'emergency-it',
        ]);
        Http::preventStrayRequests();
        Http::fake();
    }

    private function employee(): User
    {
        $role = Role::create(['code' => 'admin_legal_cabang', 'name' => 'Admin Legal Cabang']);
        $position = JobPosition::create(['code' => 'LEGAL', 'name' => 'Admin Legal', 'role_id' => $role->id]);
        $branch = Branch::create(['code' => '002', 'name' => 'KC. Kudus', 'is_active' => true]);

        return User::factory()->create([
            'email' => '102-145@pending.sso.local',
            'sso_employee_id' => '102-145',
            'job_position_id' => $position->id,
            'branch_id' => $branch->id,
            'is_active' => true,
            'password' => 'existing-account-password',
        ]);
    }

    public function test_existing_employee_can_login_locally_without_changing_their_profile(): void
    {
        $user = $this->employee();
        $original = $user->fresh()->getRawOriginal();

        $this->post(route('login.store'), [
            'email' => '102-145',
            'password' => 'local-test-password',
        ])->assertRedirect(route('dashboard', absolute: false));

        $this->assertAuthenticatedAs($user);
        $this->assertSame($original, $user->fresh()->getRawOriginal());
        $this->assertDatabaseHas('audit_logs', ['action' => 'sso_local_bypass', 'actor_id' => $user->id]);
        Http::assertNothingSent();
    }

    public function test_employee_can_confirm_password_using_the_same_local_password(): void
    {
        $user = $this->employee();

        $this->actingAs($user)->post(route('password.confirm.store'), [
            'password' => 'local-test-password',
        ])->assertRedirect()->assertSessionHas('auth.password_confirmed_at');

        Http::assertNothingSent();
    }

    public function test_unknown_employee_is_not_created_or_authenticated(): void
    {
        $this->from(route('login'))->post(route('login.store'), [
            'email' => '102-999',
            'password' => 'local-test-password',
        ])->assertRedirect(route('login'))->assertSessionHasErrors('email');

        $this->assertGuest();
        $this->assertDatabaseCount('users', 0);
        Http::assertNothingSent();
    }

    public static function invalidPasswords(): array
    {
        return [
            'wrong password' => ['local-test-password', 'wrong-password'],
            'empty setting' => ['', 'local-test-password'],
            'missing setting' => [null, 'local-test-password'],
        ];
    }

    #[DataProvider('invalidPasswords')]
    public function test_local_bypass_requires_a_configured_matching_password(?string $configured, string $submitted): void
    {
        $this->employee();
        config(['services.sso.local_password' => $configured]);

        $this->from(route('login'))->post(route('login.store'), [
            'email' => '102-145', 'password' => $submitted,
        ])->assertRedirect(route('login'))->assertSessionHasErrors('email');

        $this->assertGuest();
        $this->assertDatabaseMissing('audit_logs', ['action' => 'sso_local_bypass']);
        Http::assertNothingSent();
    }

    public static function inaccessibleEmployees(): array
    {
        return [
            ['inactive_user'], ['inactive_branch'], ['missing_role'], ['missing_branch'], ['notary_account'],
        ];
    }

    #[DataProvider('inaccessibleEmployees')]
    public function test_local_bypass_preserves_employee_access_checks(string $condition): void
    {
        $user = $this->employee();
        match ($condition) {
            'inactive_user' => $user->update(['is_active' => false]),
            'inactive_branch' => $user->branch->update(['is_active' => false]),
            'missing_role' => $user->update(['job_position_id' => null]),
            'missing_branch' => $user->update(['branch_id' => null]),
            'notary_account' => $user->update(['notary_id' => Notary::create(['name' => 'Notaris', 'is_active' => true])->id]),
        };

        $this->from(route('login'))->post(route('login.store'), [
            'email' => '102-145', 'password' => 'local-test-password',
        ])->assertRedirect(route('login'))->assertSessionHasErrors('email');

        $this->assertGuest();
        Http::assertNothingSent();
    }

    public static function realSsoModes(): array
    {
        return [
            'production ignores enabled bypass' => ['production', true],
            'staging ignores enabled bypass' => ['staging', true],
            'local bypass switched off' => ['local', false],
        ];
    }

    #[DataProvider('realSsoModes')]
    public function test_real_sso_is_required_outside_local_bypass(string $environment, bool $enabled): void
    {
        $this->employee();
        $this->app->instance('env', $environment);
        config(['services.sso.local_bypass' => $enabled]);
        Http::fake(['https://apisso.test/api/auth/login' => Http::response(['status' => 401], 401)]);

        $this->from(route('login'))->post(route('login.store'), [
            'email' => '102-145', 'password' => 'local-test-password',
        ])->assertRedirect(route('login'))->assertSessionHasErrors('email');

        $this->assertGuest();
        Http::assertSent(fn ($request) => $request->url() === 'https://apisso.test/api/auth/login');
        $this->assertDatabaseMissing('audit_logs', ['action' => 'sso_local_bypass']);
    }

    public function test_emergency_account_still_requires_its_own_password(): void
    {
        $role = Role::create(['code' => 'it_admin', 'name' => 'IT Administrator']);
        $position = JobPosition::create(['code' => 'IT_ADMIN', 'name' => 'IT Administrator', 'role_id' => $role->id]);
        $user = User::factory()->create([
            'email' => 'emergency-it', 'job_position_id' => $position->id,
            'password' => 'emergency-password', 'is_active' => true,
        ]);

        $this->from(route('login'))->post(route('login.store'), [
            'email' => 'emergency-it', 'password' => 'local-test-password',
        ])->assertRedirect(route('login'))->assertSessionHasErrors('email');
        $this->assertGuest();

        $this->post(route('login.store'), [
            'email' => 'emergency-it', 'password' => 'emergency-password',
        ]);

        $this->assertAuthenticatedAs($user);
        Http::assertNothingSent();
    }

    public function test_notary_account_still_uses_its_own_local_password(): void
    {
        $notary = Notary::create(['name' => 'Notaris', 'is_active' => true]);
        $user = User::factory()->create([
            'email' => 'notaris', 'notary_id' => $notary->id,
            'password' => 'notary-password', 'is_active' => true,
        ]);

        $this->post(route('login.store'), ['email' => 'notaris', 'password' => 'notary-password']);

        $this->assertAuthenticatedAs($user);
        Http::assertNothingSent();
    }
}
