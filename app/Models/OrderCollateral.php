<?php

namespace App\Models;

use App\Enums\TrackBDocStatus;
use App\Enums\TrackCCovernoteStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OrderCollateral extends Model
{
    protected static function booted(): void
    {
        static::created(function (OrderCollateral $collateral): void {
            if ($collateral->job_type_id && ! $collateral->jobs()->exists()) {
                $collateral->jobs()->create([
                    'job_type_id' => $collateral->job_type_id,
                    'sla_days' => $collateral->sla_days,
                    'sla_source' => $collateral->sla_source ?? 'standard',
                    'sla_override_reason' => $collateral->sla_override_reason,
                    'sla_due_at' => $collateral->sla_due_at,
                    'status' => $collateral->doc_status?->value ?? TrackBDocStatus::MenungguVerifikasi->value,
                ]);
            }
        });
    }

    protected $fillable = [
        'order_id', 'job_type_id', 'agunan_id', 'nama_agunan', 'deskripsi_agunan', 'legacy_id',
        'doc_status', 'covernote_no', 'covernote_start', 'covernote_end',
        'covernote_file_path', 'covernote_status', 'extension_count', 'sla_due_at',
        'sla_days', 'sla_source', 'sla_override_reason',
    ];

    protected function casts(): array
    {
        return [
            'doc_status' => TrackBDocStatus::class,
            'covernote_start' => 'date',
            'covernote_end' => 'date',
            'covernote_status' => TrackCCovernoteStatus::class,
            'sla_due_at' => 'datetime',
            'sla_days' => 'integer',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function jobType(): BelongsTo
    {
        return $this->belongsTo(JobType::class);
    }

    public function jobs(): HasMany
    {
        return $this->hasMany(OrderCollateralJob::class);
    }

    public function checklists(): HasMany
    {
        return $this->hasMany(OrderChecklist::class);
    }

    public function progress(): HasMany
    {
        return $this->hasMany(OrderProgress::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(OrderDocument::class);
    }

    public function handovers(): HasMany
    {
        return $this->hasMany(OrderHandover::class);
    }

    public function covernoteExtensions(): HasMany
    {
        return $this->hasMany(CovernoteExtension::class);
    }
}
