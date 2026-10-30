<?php

namespace App\Http\Middleware;

use App\Support\InAppNotification;
use App\Models\Announcement;
use App\Models\SystemSetting;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();
        $recentNotifications = $request->user()
            ? InAppNotification::unreadFor($request->user())
            : collect();
        $permissions = $user?->role()?->permissions()
            ->pluck('code')
            ->values()
            ->all() ?? [];
        $announcements = $user && ! $user->notary_id && $user->roleCode() !== 'auditor'
            ? Announcement::published()
                ->whereDoesntHave('readers', fn ($query) => $query->whereKey($user->id))
                ->with('creator:id,name')
                ->orderByDesc('priority')
                ->orderBy('published_at')
                ->limit(5)
                ->get()
                ->map(fn (Announcement $announcement) => [
                    'id' => $announcement->id,
                    'title' => $announcement->title,
                    'body' => $announcement->body,
                    'link_url' => $announcement->link_url,
                    'image_url' => $announcement->image_path ? asset('storage/'.$announcement->image_path) : null,
                    'priority' => $announcement->priority,
                    'published_at' => $announcement->published_at?->format('d M Y H:i'),
                    'created_by' => $announcement->creator?->name ?? 'Sistem',
                ])->values()->all()
            : [];

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $user,
                'role' => $user?->roleCode(),
                'permissions' => $permissions,
            ],
            'announcements' => $announcements,
            'systemSettings' => $user ? [
                'early_warning_enabled' => (bool) ((int) SystemSetting::value('early_warning_enabled', 1)),
                'notification_poll_interval' => (int) SystemSetting::value('notification_poll_interval', 15),
                'sound_priority' => SystemSetting::value('sound_priority', 'important'),
                'quiet_hours_enabled' => (bool) ((int) SystemSetting::value('quiet_hours_enabled', 0)),
                'quiet_start' => SystemSetting::value('quiet_start', '22:00'),
                'quiet_end' => SystemSetting::value('quiet_end', '06:00'),
            ] : null,
            'notifications' => fn () => $request->user() ? [
                'count' => $recentNotifications->count(),
                'items' => $recentNotifications->map(fn ($notification) => [
                    'id' => $notification->id,
                    'title' => $notification->title,
                    'message' => $notification->message,
                    'link_url' => $notification->link_url,
                    'created_at' => $notification->created_at?->diffForHumans(),
                    'priority' => $notification->priority,
                ]),
            ] : ['count' => 0, 'items' => []],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
                'warning' => fn () => $request->session()->get('warning'),
                'info' => fn () => $request->session()->get('info'),
                'toast' => fn () => $request->session()->get('toast'),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
        ];
    }
}
