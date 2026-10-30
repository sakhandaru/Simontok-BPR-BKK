<?php

namespace App\Http\Controllers\Simontok;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Support\Audit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class NotificationController extends Controller
{
    public function markOpened(Request $request, Notification $notification): RedirectResponse
    {
        abort_unless($this->queryForUser($request)->whereKey($notification->id)->exists(), 403);

        $notification->update(['is_read' => true, 'read_at' => now()]);
        Audit::record($request, 'notifications', $notification, 'open', 'Notifikasi dibuka dari panel header.');

        return back();
    }

    public function poll(Request $request): JsonResponse
    {
        $since = $request->date('since');

        $notifications = $this->queryForUser($request)
            ->when($since, fn ($query) => $query->where('created_at', '>', $since))
            ->latest('created_at')
            ->limit(20)
            ->get()
            ->reverse()
            ->values()
            ->map(fn (Notification $notification) => [
                'id' => $notification->id,
                'title' => $notification->title,
                'message' => $notification->message,
                'link_url' => $notification->link_url,
                'priority' => $notification->priority,
                'created_at' => $notification->created_at?->toIso8601String(),
            ]);

        return response()->json(['notifications' => $notifications]);
    }

    private function queryForUser(Request $request)
    {
        $user = $request->user();

        return Notification::query()
            ->where(fn ($query) => $query
                ->where(fn ($query) => $query->where('recipient_type', 'user')->where('recipient_id', $user->id))
                ->orWhere(fn ($query) => $user->notary_id
                    ? $query->where('recipient_type', 'notary')->where('recipient_id', $user->notary_id)
                    : $query->whereRaw('1 = 0')
                )
            );
    }
}
