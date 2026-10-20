<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class JobPosition extends Model
{
    protected $fillable = ['code', 'name', 'role_id'];

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }
}
