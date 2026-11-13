<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class TemporaryOrderDocument extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'order_id' => 'integer',
            'uploaded_by' => 'integer',
            'checklist_master_id' => 'integer',
            'job_type_id' => 'integer',
            'file_size' => 'integer',
            'draft_context' => 'array',
            'expires_at' => 'datetime',
            'promoted_at' => 'datetime',
        ];
    }

    public function forClient(): array
    {
        return [
            'id' => $this->id,
            'coreAccountId' => $this->core_account_id,
            'collateralKey' => $this->collateral_key,
            'checklistMasterId' => $this->checklist_master_id,
            'jobTypeId' => $this->job_type_id,
            'displayName' => $this->display_name,
            'originalName' => $this->original_name,
            'fileSize' => $this->file_size,
            'expiresAt' => $this->expires_at->toIso8601String(),
            'previewUrl' => route('orders.temporary-documents.preview', [$this->order_id, $this->id], false),
        ];
    }
}
