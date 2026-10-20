<?php

namespace App\Http\Middleware;

use App\Support\InAppNotification;
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
        $unreadNotifications = $request->user()
            ? InAppNotification::unreadFor($request->user())
            : collect();
        $permissions = $user?->role()?->permissions()
            ->pluck('code')
            ->values()
            ->all() ?? [];

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $user,
                'role' => $user?->roleCode(),
                'permissions' => $permissions,
            ],
            'notifications' => fn () => $request->user() ? [
                'unread_count' => $unreadNotifications->count(),
                'items' => $unreadNotifications->map(fn ($notification) => [
                    'id' => $notification->id,
                    'title' => $notification->title,
                    'message' => $notification->message,
                    'link_url' => $notification->link_url,
                    'created_at' => $notification->created_at?->diffForHumans(),
                ]),
            ] : ['unread_count' => 0, 'items' => []],
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
