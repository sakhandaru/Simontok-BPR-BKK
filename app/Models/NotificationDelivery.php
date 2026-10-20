<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationDelivery extends Model
{
    protected $fillable = [
        'notification_id', 'channel', 'recipient', 'event', 'status', 'attempts', 'last_error', 'sent_at', 'next_attempt_at',
    ];

    protected function casts(): array
    {
        return ['sent_at' => 'datetime', 'next_attempt_at' => 'datetime'];
    }

    public function notification(): BelongsTo
    {
        return $this->belongsTo(Notification::class);
    }
}
