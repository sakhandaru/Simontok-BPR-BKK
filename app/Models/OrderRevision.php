<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderRevision extends Model
{
    protected $fillable = [
        'order_id',
        'order_collateral_id',
        'revision_no',
        'requested_by',
        'alasan',
        'status',
        'fixed_by',
        'fixed_at',
        'catatan_admin',
    ];

    protected function casts(): array
    {
        return [
            'fixed_at' => 'datetime',
        ];
    }

    public function collateral(): BelongsTo
    {
        return $this->belongsTo(OrderCollateral::class, 'order_collateral_id');
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }
}
