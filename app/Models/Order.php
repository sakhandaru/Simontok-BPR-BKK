<?php

namespace App\Models;

use App\Enums\TrackAStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Builder;

class Order extends Model
{
    use HasFactory;

    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->branchScopeId() !== null) {
            $query->where('branch_id', $user->branchScopeId());
        } elseif ($user->notary_id) {
            $query->where('notary_id', $user->notary_id);
        }

        return $query;
    }

    public function isVisibleTo(User $user): bool
    {
        return ($user->branchScopeId() === null || $this->branch_id === $user->branchScopeId())
            && (! $user->notary_id || $this->notary_id === $user->notary_id);
    }

    protected $fillable = [
        'order_no', 'branch_id', 'notary_id', 'legacy_id', 'customer_name',
        'no_rekening', 'tgl_realisasi', 'plafon', 'baki_debet', 'kolek',
        'stat_kred', 'tgl_masuk_notaris', 'nominal', 'skema_pembayaran',
        'status', 'risk_flag', 'sla_due_at', 'keterangan', 'created_by',
        'checked_by', 'checked_at', 'sent_to_notary_at',
        'notary_agreement_archive_id', 'notary_agreement_acknowledged_at', 'notary_agreement_acknowledged_by',
        'komitmen_penyelesaian', 'covernote_submitted_at', 'covernote_approved_at', 'covernote_approved_by', 'final_submitted_at',
        'covernote_no', 'covernote_start', 'covernote_end', 'covernote_file_path',
    ];

    protected function casts(): array
    {
        return [
            'tgl_realisasi' => 'date',
            'tgl_masuk_notaris' => 'date',
            'plafon' => 'decimal:2',
            'baki_debet' => 'decimal:2',
            'nominal' => 'decimal:2',
            'status' => TrackAStatus::class,
            'risk_flag' => 'boolean',
            'sla_due_at' => 'datetime',
            'checked_at' => 'datetime',
            'sent_to_notary_at' => 'datetime',
            'notary_agreement_acknowledged_at' => 'datetime',
            'komitmen_penyelesaian' => 'date',
            'covernote_submitted_at' => 'datetime',
            'covernote_approved_at' => 'datetime',
            'covernote_start' => 'date',
            'covernote_end' => 'date',
            'final_submitted_at' => 'datetime',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function notary(): BelongsTo
    {
        return $this->belongsTo(Notary::class);
    }

    public function maker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function collaterals(): HasMany
    {
        return $this->hasMany(OrderCollateral::class);
    }

    public function statusHistories(): HasMany
    {
        return $this->hasMany(OrderStatusHistory::class);
    }

    public function progress(): HasMany
    {
        return $this->hasMany(OrderProgress::class);
    }

    public function revisions(): HasMany
    {
        return $this->hasMany(OrderRevision::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(OrderDocument::class);
    }

    public function documentRequests(): HasMany
    {
        return $this->hasMany(DocumentRequest::class);
    }

    public function handovers(): HasMany
    {
        return $this->hasMany(OrderHandover::class);
    }

    public function paymentRequest(): HasOne
    {
        return $this->hasOne(PaymentRequest::class);
    }

    public function stepFees(): HasMany
    {
        return $this->hasMany(OrderStepFee::class);
    }

    public function notaryAgreement(): BelongsTo
    {
        return $this->belongsTo(DocumentArchive::class, 'notary_agreement_archive_id');
    }

    public function stepFeesTotal(): float
    {
        return (float) $this->stepFees()->sum('amount');
    }

    public function totalServiceFee(): float
    {
        return (float) ($this->nominal ?? 0) + $this->stepFeesTotal();
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }
}
