<?php

namespace App\Models;

use App\Enums\TrackBDocStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderCollateralJob extends Model
{
    protected $fillable = [
        'order_collateral_id', 'job_type_id', 'deskripsi_pekerjaan', 'sla_days', 'sla_source',
        'sla_override_reason', 'sla_due_at', 'status',
    ];

    protected function casts(): array
    {
        return [
            'sla_days' => 'integer',
            'sla_due_at' => 'datetime',
            'status' => TrackBDocStatus::class,
        ];
    }

    public function collateral(): BelongsTo
    {
        return $this->belongsTo(OrderCollateral::class, 'order_collateral_id');
    }

    public function jobType(): BelongsTo
    {
        return $this->belongsTo(JobType::class);
    }
}
