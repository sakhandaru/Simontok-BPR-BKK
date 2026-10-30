<?php

namespace App\Support;

use App\Models\AuditLog;
use App\Models\Order;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class Audit
{
    public static function record(Request $request, string $module, Model $entity, string $action, string $description, array $payload = []): void
    {
        $user = $request->user();

        AuditLog::create([
            'actor_type' => 'user',
            'actor_id' => $user?->id,
            'actor_name' => $user?->name,
            'role_code' => $user?->roleCode(),
            'module' => $module,
            'entity_type' => class_basename($entity),
            'entity_id' => $entity->getKey(),
            'action' => $action,
            'description' => $description,
            'route' => $request->path(),
            'method' => $request->method(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'payload' => $payload,
        ]);

        if ($entity instanceof Order && in_array($module, ['orders', 'documents', 'covernotes', 'payments', 'handover', 'notary_portal'], true) && $user) {
            InAppNotification::forOperationalActivity($entity, $user, $description, $action);
        }
    }

    public static function security(Request $request, string $action, string $description, ?Model $actor = null, array $payload = []): void
    {
        $user = $actor ?? $request->user();

        AuditLog::create([
            'actor_type' => $user ? 'user' : 'guest',
            'actor_id' => $user?->getKey(),
            'actor_name' => $user?->getAttribute('name'),
            'role_code' => method_exists($user, 'roleCode') ? $user->roleCode() : null,
            'module' => 'security',
            'entity_type' => $user ? class_basename($user) : null,
            'entity_id' => $user?->getKey(),
            'action' => $action,
            'description' => $description,
            'route' => $request->path(),
            'method' => $request->method(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'payload' => $payload,
        ]);
    }
}
