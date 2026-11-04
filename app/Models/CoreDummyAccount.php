<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CoreDummyAccount extends Model
{
    use HasFactory;

    protected $table = 'core_dummy_accounts';

    protected $fillable = [
        'account_id', 'account_number', 'customer_id', 'customer_name', 'plafon', 'branch_code', 'branch_name',
    ];

    public function collaterals(): HasMany
    {
        return $this->hasMany(CoreDummyCollateral::class);
    }
}
