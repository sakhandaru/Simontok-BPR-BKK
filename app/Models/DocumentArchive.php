<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class DocumentArchive extends Model
{
    protected $fillable = [
        'documentable_type', 'documentable_id', 'document_type', 'document_key', 'category', 'version', 'title',
        'original_name', 'storage_disk', 'file_path', 'file_size', 'file_hash', 'status', 'metadata',
        'uploaded_by', 'change_note', 'archived_at',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'archived_at' => 'datetime',
        ];
    }

    public function documentable(): MorphTo
    {
        return $this->morphTo();
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
