<?php

namespace App\Support;

use App\Models\Notification;
use App\Models\NotificationDelivery;
use App\Models\Order;
use App\Models\User;
use Illuminate\Support\Collection;

class InAppNotification
{
    public static function forUser(User $user, string $title, string $message, ?string $linkUrl = null, string $priority = 'normal'): void
    {
        self::create('user', $user->id, $title, $message, $linkUrl, $priority);
    }

    public static function forNotary(Order $order, string $title, string $message, ?string $linkUrl = null): void
    {
        self::create('notary', $order->notary_id, $title, $message, $linkUrl ?? "/notary/orders/{$order->id}");
    }

    public static function forOrderMaker(Order $order, string $title, string $message, ?string $linkUrl = null): void
    {
        if (! $order->created_by) {
            return;
        }

        self::create('user', $order->created_by, $title, $message, $linkUrl ?? "/orders/{$order->id}");
    }

    public static function forInternalUsers(string $title, string $message, ?string $linkUrl = null): void
    {
        User::whereNull('notary_id')
            ->where('is_active', true)
            ->get()
            ->each(fn (User $user) => self::forUser($user, $title, $message, $linkUrl));
    }

    public static function forBranchApprovers(Order $order, string $title, string $message, ?string $linkUrl = null): void
    {
        User::where('branch_id', $order->branch_id)
            ->where('is_active', true)
            ->whereHas('jobPosition.role', fn ($query) => $query->where('code', 'kabid_ops_cabang'))
            ->get()
            ->each(fn (User $user) => self::forUser($user, $title, $message, $linkUrl ?? "/orders/{$order->id}"));
    }

    public static function unreadFor(User $user): Collection
    {
        return Notification::query()
            ->where(fn ($query) => $query
                ->where(fn ($query) => $query->where('recipient_type', 'user')->where('recipient_id', $user->id))
                ->orWhere(fn ($query) => $user->notary_id
                    ? $query->where('recipient_type', 'notary')->where('recipient_id', $user->notary_id)
                    : $query->whereRaw('1 = 0')
                )
            )
            ->where('is_read', false)
            ->latest('created_at')
            ->limit(8)
            ->get();
    }

    public static function forOperationalActivity(Order $order, User $actor, string $description, string $action): void
    {
        $priority = self::priorityFor($action);
        $recipients = User::query()
            ->whereNull('notary_id')
            ->where('is_active', true)
            ->where('id', '!=', $actor->id)
            ->where(function ($query) use ($order): void {
                $query->whereHas('jobPosition.role', fn ($role) => $role->whereIn('code', ['admin_legal_pusat', 'kadiv_ops_pusat', 'direksi_pusat']))
                    ->orWhere(function ($query) use ($order): void {
                        $query->where('branch_id', $order->branch_id)
                            ->whereHas('jobPosition.role', fn ($role) => $role->whereIn('code', ['pimpinan_cabang', 'kabid_ops_cabang', 'admin_legal_cabang']));
                    });
            })
            ->get();

        foreach ($recipients as $recipient) {
            self::create('user', $recipient->id, 'Aktivitas order '.$order->order_no, $description, "/orders/{$order->id}", $priority);
        }
    }

    private static function create(string $recipientType, int $recipientId, string $title, string $message, ?string $linkUrl, string $priority = 'normal'): void
    {
        $notification = Notification::create([
            'recipient_type' => $recipientType,
            'recipient_id' => $recipientId,
            'title' => $title,
            'message' => $message,
            'link_url' => $linkUrl,
            'priority' => $priority,
        ]);

        NotificationDelivery::create([
            'notification_id' => $notification->id,
            'channel' => 'whatsapp',
            'event' => 'in_app_notification',
            'status' => 'pending',
            'next_attempt_at' => now(),
        ]);
    }

    private static function priorityFor(string $action): string
    {
        $action = strtolower($action);

        if (str_contains($action, 'overdue') || str_contains($action, 'expired') || str_contains($action, 'reject') || str_contains($action, 'cancel')) {
            return 'critical';
        }

        if (str_contains($action, 'create') || str_contains($action, 'submit') || str_contains($action, 'approve') || str_contains($action, 'validate') || str_contains($action, 'payment') || str_contains($action, 'handover') || str_contains($action, 'revision')) {
            return 'important';
        }

        return 'normal';
    }
}
