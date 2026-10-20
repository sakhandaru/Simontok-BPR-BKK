<?php

namespace App\Models;

use App\Enums\HandoverMethod;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderHandover extends Model
{
    protected $fillable = [
        'order_id',
        'order_collateral_id',
        'receiver_name',
        'method',
        'handed_over_at',
        'receipt_path',
        'catatan',
        'maker_id',
        'checked_by',
        'made_at',
        'checked_at',
    ];

    protected function casts(): array
    {
        return [
            'method' => HandoverMethod::class,
            'handed_over_at' => 'date',
            'made_at' => 'datetime',
            'checked_at' => 'datetime',
        ];
    }

    public function collateral(): BelongsTo
    {
        return $this->belongsTo(OrderCollateral::class, 'order_collateral_id');
    }
}
