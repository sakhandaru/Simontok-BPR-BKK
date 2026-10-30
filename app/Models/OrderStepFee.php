<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderStepFee extends Model
{
    protected $fillable = ['order_id', 'order_collateral_id', 'job_type_step_id', 'step_name', 'amount', 'entered_by'];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2'];
    }

    public function order(): BelongsTo { return $this->belongsTo(Order::class); }
    public function collateral(): BelongsTo { return $this->belongsTo(OrderCollateral::class, 'order_collateral_id'); }
    public function step(): BelongsTo { return $this->belongsTo(JobTypeStep::class, 'job_type_step_id'); }
}
