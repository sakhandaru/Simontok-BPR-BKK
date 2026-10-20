<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Notary extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name', 'address', 'phone', 'email', 'sk_notary', 'sk_ppat',
        'pks_no', 'pks_start', 'pks_end', 'is_active', 'legacy_id',
    ];

    protected function casts(): array
    {
        return [
            'pks_start' => 'date',
            'pks_end' => 'date',
            'is_active' => 'boolean',
        ];
    }

    public function branches(): BelongsToMany
    {
        return $this->belongsToMany(Branch::class)->withPivot('is_active')->withTimestamps();
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
