<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CoreStagedCollateral extends Model
{
    use HasFactory;

    protected $table = 'core_staged_collaterals';

    protected $fillable = [
        'core_staged_account_id', 'collateral_id', 'collateral_code', 'type_code', 'type_name',
        'description', 'is_primary', 'status',
    ];

    public function account(): BelongsTo
    {
        return $this->belongsTo(CoreStagedAccount::class, 'core_staged_account_id');
    }
}
