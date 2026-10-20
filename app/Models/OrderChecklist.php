<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderChecklist extends Model
{
    protected $fillable = [
        'order_id', 'order_collateral_id', 'document_checklist_id',
        'order_document_id',
        'is_checked', 'checked_by', 'checked_at', 'catatan',
    ];

    protected function casts(): array
    {
        return [
            'is_checked' => 'boolean',
            'checked_at' => 'datetime',
        ];
    }

    public function documentChecklist(): BelongsTo
    {
        return $this->belongsTo(DocumentChecklist::class);
    }

    public function orderDocument(): BelongsTo
    {
        return $this->belongsTo(OrderDocument::class);
    }
}
