<?php

namespace App\Http\Controllers\Simontok;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AuditLogController extends Controller
{
    public function index(Request $request): Response
    {
        abort_if($request->user()?->notary_id, 403);

        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'module' => ['nullable', 'string', 'max:30'],
            'action' => ['nullable', 'string', 'max:50'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
        ]);

        $logs = AuditLog::query()
            ->when($filters['search'] ?? null, function ($query, string $search) {
                $query->where(function ($query) use ($search) {
                    $query->where('actor_name', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%")
                        ->orWhere('entity_type', 'like', "%{$search}%")
                        ->orWhere('entity_id', $search);
                });
            })
            ->when($filters['module'] ?? null, fn ($query, string $module) => $query->where('module', $module))
            ->when($filters['action'] ?? null, fn ($query, string $action) => $query->where('action', $action))
            ->when($filters['date_from'] ?? null, fn ($query, string $date) => $query->whereDate('created_at', '>=', $date))
            ->when($filters['date_to'] ?? null, fn ($query, string $date) => $query->whereDate('created_at', '<=', $date))
            ->latest('created_at');

        return Inertia::render('simontok/audit/index', [
            'filters' => [
                'search' => $filters['search'] ?? '',
                'module' => $filters['module'] ?? '',
                'action' => $filters['action'] ?? '',
                'date_from' => $filters['date_from'] ?? '',
                'date_to' => $filters['date_to'] ?? '',
            ],
            'modules' => AuditLog::query()->whereNotNull('module')->distinct()->orderBy('module')->pluck('module'),
            'actions' => AuditLog::query()->distinct()->orderBy('action')->pluck('action'),
            'logs' => $logs->paginate(20)->withQueryString()->through(fn (AuditLog $log) => [
                'id' => $log->id,
                'actor_name' => $log->actor_name,
                'actor_type' => $log->actor_type,
                'module' => $log->module,
                'action' => $log->action,
                'description' => $log->description,
                'entity_type' => $log->entity_type,
                'entity_id' => $log->entity_id,
                'route' => $log->route,
                'method' => $log->method,
                'ip_address' => $log->ip_address,
                'created_at' => $log->created_at?->format('d M Y H:i:s'),
                'payload' => $log->payload,
            ]),
        ]);
    }
}
