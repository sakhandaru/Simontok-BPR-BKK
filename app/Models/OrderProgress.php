<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderProgress extends Model
{
    protected $table = 'order_progress';

    protected $fillable = [
        'order_id',
        'order_collateral_id',
        'status',
        'catatan',
        'komitmen_penyelesaian',
        'completed_at',
        'evidence_path',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'komitmen_penyelesaian' => 'date',
            'completed_at' => 'datetime',
        ];
    }

    public function collateral(): BelongsTo
    {
        return $this->belongsTo(OrderCollateral::class, 'order_collateral_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
