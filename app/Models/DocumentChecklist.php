<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class DocumentChecklist extends Model
{
    use SoftDeletes;

    protected $fillable = ['name', 'job_type_id', 'is_active', 'is_required'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'is_required' => 'boolean'];
    }

    public function jobType(): BelongsTo
    {
        return $this->belongsTo(JobType::class);
    }
}
