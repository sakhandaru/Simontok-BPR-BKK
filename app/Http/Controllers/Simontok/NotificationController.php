<?php

namespace App\Http\Controllers\Simontok;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Support\Audit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class NotificationController extends Controller
{
    public function index(Request $request): Response
    {
        return Inertia::render('simontok/notifications/index', [
            'notifications' => $this->queryForUser($request)
                ->latest('created_at')
                ->paginate(15)
                ->through(fn (Notification $notification) => [
                    'id' => $notification->id,
                    'title' => $notification->title,
                    'message' => $notification->message,
                    'link_url' => $notification->link_url,
                    'is_read' => $notification->is_read,
                    'created_at' => $notification->created_at?->format('d M Y H:i'),
                    'read_at' => $notification->read_at?->format('d M Y H:i'),
                ]),
        ]);
    }

    public function markRead(Request $request, Notification $notification): RedirectResponse
    {
        abort_unless($this->queryForUser($request)->whereKey($notification->id)->exists(), 403);

        $notification->update([
            'is_read' => true,
            'read_at' => now(),
        ]);

        Audit::record($request, 'notifications', $notification, 'mark_read', 'Notifikasi ditandai sudah dibaca.');

        return back()->with('success', 'Notifikasi ditandai sudah dibaca.');
    }

    public function markAllRead(Request $request): RedirectResponse
    {
        $count = $this->queryForUser($request)
            ->where('is_read', false)
            ->update([
                'is_read' => true,
                'read_at' => now(),
            ]);

        Audit::record($request, 'notifications', $request->user(), 'mark_all_read', 'Semua notifikasi ditandai sudah dibaca.', [
            'count' => $count,
        ]);

        return back()->with('success', 'Semua notifikasi ditandai sudah dibaca.');
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
