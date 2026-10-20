<?php

namespace App\Models;

use App\Enums\TrackDPaymentStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PaymentRequest extends Model
{
    protected $fillable = [
        'order_id', 'invoice_no', 'nominal', 'skema_pembayaran', 'status',
        'catatan_notaris', 'requested_at', 'verified_by', 'verified_at',
        'catatan_verifikasi', 'approved_by', 'approved_at', 'catatan_approver',
        'rejected_by', 'rejected_at', 'paid_at',
    ];

    protected function casts(): array
    {
        return [
            'nominal' => 'decimal:2',
            'status' => TrackDPaymentStatus::class,
            'requested_at' => 'datetime',
            'verified_at' => 'datetime',
            'approved_at' => 'datetime',
            'rejected_at' => 'datetime',
            'paid_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function rejecter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rejected_by');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }
}
