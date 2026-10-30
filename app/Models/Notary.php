<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Notary extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name', 'address', 'phone', 'email', 'bank_name', 'bank_account_number', 'bank_account_name', 'sk_notary', 'sk_ppat',
        'agreement_type', 'agreement_file_path', 'agreement_file_name',
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

    public function documents(): MorphMany
    {
        return $this->morphMany(DocumentArchive::class, 'documentable')->latest('version');
    }

    public function hasActivePartnership(): bool
    {
        return $this->is_active
            && filled($this->agreement_type)
            && filled($this->agreement_file_path)
            && filled($this->pks_no)
            && $this->pks_start
            && $this->pks_end
            && ! $this->pks_end->isBefore(today());
    }

    public function partnershipStatus(): string
    {
        if (! $this->is_active) {
            return 'Nonaktif';
        }

        if (! filled($this->agreement_type) || ! filled($this->agreement_file_path) || ! filled($this->pks_no) || ! $this->pks_start || ! $this->pks_end) {
            return 'Belum lengkap';
        }

        if ($this->pks_end->isBefore(today())) {
            return 'Berakhir';
        }

        return today()->diffInDays($this->pks_end) <= 30 ? 'Akan berakhir' : 'Aktif';
    }

    public function scopeAvailableForOrders($query)
    {
        return $query
            ->where('is_active', true)
            ->whereNotNull('agreement_type')
            ->whereNotNull('agreement_file_path')
            ->whereNotNull('pks_no')
            ->whereNotNull('pks_start')
            ->whereNotNull('pks_end')
            ->whereDate('pks_end', '>=', today());
    }
}
