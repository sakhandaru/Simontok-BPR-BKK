<?php

namespace App\Models;

use App\Enums\OrderDocumentType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderDocument extends Model
{
    protected $fillable = [
        'order_id',
        'order_collateral_id',
        'document_type',
        'display_name',
        'version',
        'original_name',
        'stored_name',
        'stored_path',
        'mime_type',
        'file_size',
        'uploaded_by',
        'validated_by',
        'validated_at',
    ];

    protected function casts(): array
    {
        return [
            'document_type' => OrderDocumentType::class,
            'validated_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function collateral(): BelongsTo
    {
        return $this->belongsTo(OrderCollateral::class, 'order_collateral_id');
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
