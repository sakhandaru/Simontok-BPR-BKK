<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CoreDummyCollateral extends Model
{
    use HasFactory;

    protected $table = 'core_dummy_collaterals';

    protected $fillable = ['core_dummy_account_id', 'collateral_id', 'type_name', 'description'];

    public function account(): BelongsTo
    {
        return $this->belongsTo(CoreDummyAccount::class, 'core_dummy_account_id');
    }
}
