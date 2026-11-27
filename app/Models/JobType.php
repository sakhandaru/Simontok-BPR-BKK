<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class JobType extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = ['code', 'name', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function steps(): HasMany
    {
        return $this->hasMany(JobTypeStep::class)->orderBy('sort_order');
    }

    public function slaPolicies(): HasMany
    {
        return $this->hasMany(SlaPolicy::class);
    }

    public function checklists(): HasMany
    {
        return $this->hasMany(DocumentChecklist::class);
    }

    public function documents(): BelongsToMany
    {
        return $this->belongsToMany(DocumentChecklist::class, 'document_checklist_job_type')
            ->withPivot('is_required')
            ->withTimestamps();
    }
}
