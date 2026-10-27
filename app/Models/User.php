<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Laravel\Fortify\Contracts\PasskeyUser;
use Laravel\Fortify\PasskeyAuthenticatable;
use Laravel\Fortify\TwoFactorAuthenticatable;

/**
 * @property int $id
 * @property string $name
 * @property string $email
 * @property string|null $sso_employee_id
 * @property Carbon|null $email_verified_at
 * @property string $password
 * @property string|null $two_factor_secret
 * @property string|null $two_factor_recovery_codes
 * @property Carbon|null $two_factor_confirmed_at
 * @property string|null $remember_token
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'email', 'sso_employee_id', 'password', 'branch_id', 'notary_id', 'job_position_id', 'is_active'])]
#[Hidden(['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token'])]
class User extends Authenticatable implements PasskeyUser
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, PasskeyAuthenticatable, TwoFactorAuthenticatable;

    protected static function booted(): void
    {
        static::saving(function (User $user) {
            $user->leadership_slot = self::leadershipSlotFor($user->job_position_id, (bool) $user->is_active);
        });
    }

    public static function leadershipSlotFor(?int $positionId, bool $isActive): ?string
    {
        if (! $positionId || ! $isActive) {
            return null;
        }

        $roleCode = JobPosition::with('role:id,code')->find($positionId)?->role?->code;

        return in_array($roleCode, ['kepala_cabang', 'kadiv_operasional'], true) ? $roleCode : null;
    }

    public function jobPosition(): BelongsTo
    {
        return $this->belongsTo(JobPosition::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function notary(): BelongsTo
    {
        return $this->belongsTo(Notary::class);
    }

    public function role(): ?Role
    {
        if ($this->notary_id) {
            return Role::where('code', 'notaris')->first();
        }

        return $this->jobPosition?->role;
    }

    public function roleCode(): ?string
    {
        return $this->role()?->code;
    }

    public function isOperationallyActive(): bool
    {
        if (! $this->is_active) {
            return false;
        }

        // Emergency IT access remains available even if its assigned branch is inactive.
        if ($this->roleCode() === 'it_admin') {
            return true;
        }

        if ($this->notary_id) {
            return (bool) $this->notary?->is_active;
        }

        if ($this->branch_id) {
            return (bool) $this->branch?->is_active;
        }

        return true;
    }

    public function hasPermission(string $permission): bool
    {
        if (! $this->isOperationallyActive()) {
            return false;
        }

        // IT administrator is the operational superuser and must not depend on a stale permission sync.
        if ($this->roleCode() === 'it_admin') {
            return true;
        }

        return $this->role()?->permissions()->where('code', $permission)->exists() ?? false;
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }
}
