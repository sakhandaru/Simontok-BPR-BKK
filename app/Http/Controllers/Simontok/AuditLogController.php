<?php

namespace App\Http\Controllers\Simontok;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\JobPosition;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class AuditLogController extends Controller
{
    public function index(Request $request): Response
    {
        abort_if($request->user()?->notary_id, 403);

        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'type' => ['nullable', Rule::in(['internal', 'notary'])],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'position_id' => ['nullable', 'integer', 'exists:job_positions,id'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);

        $actorFiltersApplied = filled($filters['search'] ?? null)
            || filled($filters['type'] ?? null)
            || filled($filters['branch_id'] ?? null)
            || filled($filters['position_id'] ?? null)
            || filled($filters['status'] ?? null);

        $actorIds = User::query()
            ->when(($filters['type'] ?? null) === 'internal', fn ($query) => $query->whereNull('notary_id'))
            ->when(($filters['type'] ?? null) === 'notary', fn ($query) => $query->whereNotNull('notary_id'))
            ->when($filters['branch_id'] ?? null, fn ($query, $branchId) => $query->where('branch_id', $branchId))
            ->when($filters['position_id'] ?? null, fn ($query, $positionId) => $query->where('job_position_id', $positionId))
            ->when(($filters['status'] ?? null) === 'active', fn ($query) => $query->where('is_active', true))
            ->when(($filters['status'] ?? null) === 'inactive', fn ($query) => $query->where('is_active', false))
            ->when($filters['search'] ?? null, function ($query, string $search) {
                $query->where(function ($query) use ($search) {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('sso_employee_id', 'like', "%{$search}%");
                });
            })
            ->select('id');

        $logs = AuditLog::query()
            ->when($actorFiltersApplied, fn ($query) => $query->whereIn('actor_id', $actorIds))
            ->latest('created_at');

        return Inertia::render('simontok/audit/index', [
            'filters' => [
                'search' => $filters['search'] ?? '',
                'type' => $filters['type'] ?? '',
                'branch_id' => (string) ($filters['branch_id'] ?? ''),
                'position_id' => (string) ($filters['position_id'] ?? ''),
                'status' => $filters['status'] ?? '',
            ],
            'branches' => Branch::query()->where('is_active', true)->orderBy('name')->get(['id', 'code', 'name']),
            'positions' => JobPosition::with('role:id,code,name')
                ->whereHas('role', fn ($query) => $query->where('code', '!=', 'notaris'))
                ->orderBy('name')->get(['id', 'code', 'name', 'role_id']),
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
