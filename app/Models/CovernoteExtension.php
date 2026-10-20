<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CovernoteExtension extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'order_collateral_id',
        'old_end',
        'new_end',
        'extended_by',
        'catatan',
        'file_path',
        'status', 'approved_by', 'approved_at', 'rejection_reason',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'old_end' => 'date',
            'new_end' => 'date',
            'created_at' => 'datetime',
            'approved_at' => 'datetime',
        ];
    }

    public function collateral(): BelongsTo
    {
        return $this->belongsTo(OrderCollateral::class, 'order_collateral_id');
    }
}
