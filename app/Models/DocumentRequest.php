<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentRequest extends Model
{
    protected $fillable = ['order_id', 'order_collateral_id', 'requested_by', 'fulfilled_by', 'name', 'reason', 'status', 'order_document_id'];

    public function order(): BelongsTo { return $this->belongsTo(Order::class); }
    public function collateral(): BelongsTo { return $this->belongsTo(OrderCollateral::class, 'order_collateral_id'); }
    public function requester(): BelongsTo { return $this->belongsTo(User::class, 'requested_by'); }
    public function fulfiller(): BelongsTo { return $this->belongsTo(User::class, 'fulfilled_by'); }
    public function document(): BelongsTo { return $this->belongsTo(OrderDocument::class, 'order_document_id'); }
}
