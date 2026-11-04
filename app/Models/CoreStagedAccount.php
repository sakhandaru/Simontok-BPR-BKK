<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CoreStagedAccount extends Model
{
    use HasFactory;

    protected $table = 'core_staged_accounts';

    protected $fillable = [
        'account_id', 'account_number', 'customer_id', 'customer_name', 'loan_amount',
        'realization_date', 'branch_code', 'branch_name', 'source_provider', 'synced_at', 'expires_at',
    ];

    protected $casts = [
        'realization_date' => 'date:Y-m-d',
        'synced_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    public function collaterals(): HasMany
    {
        return $this->hasMany(CoreStagedCollateral::class);
    }
}
