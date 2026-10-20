<?php

namespace App\Http\Middleware;

use App\Support\Audit;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePermission
{
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        if (! $request->user()?->hasPermission($permission)) {
            Audit::security($request, 'permission_denied', 'Akses ditolak karena permission tidak tersedia.', payload: [
                'permission' => $permission,
            ]);

            abort(403);
        }

        return $next($request);
    }
}
