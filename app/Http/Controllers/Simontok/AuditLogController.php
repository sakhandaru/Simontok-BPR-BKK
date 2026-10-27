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
                'entity_type_label' => $this->entityTypeLabel($log->entity_type),
                'entity_id' => $log->entity_id,
                'entity_name' => $this->entityName($log),
                'route' => $log->route,
                'method' => $log->method,
                'ip_address' => $log->ip_address,
                'created_at' => $log->created_at?->format('d M Y H:i:s'),
                'payload' => $log->payload,
            ]),
        ]);
    }

    private function entityName(AuditLog $log): ?string
    {
        $snapshot = collect(['name', 'order_no', 'invoice_no', 'title', 'display_name', 'code'])
            ->map(fn (string $key) => data_get($log->payload, "after.{$key}"))
            ->first(fn ($value) => filled($value));

        if (filled($snapshot)) {
            return (string) $snapshot;
        }

        $modelClass = [
            'User' => \App\Models\User::class,
            'Branch' => \App\Models\Branch::class,
            'Notary' => \App\Models\Notary::class,
            'Order' => \App\Models\Order::class,
            'JobType' => \App\Models\JobType::class,
            'Role' => \App\Models\Role::class,
            'PaymentRequest' => \App\Models\PaymentRequest::class,
            'OrderDocument' => \App\Models\OrderDocument::class,
            'OrderCollateral' => \App\Models\OrderCollateral::class,
            'OrderHandover' => \App\Models\OrderHandover::class,
            'Notification' => \App\Models\Notification::class,
        ][$log->entity_type ?? ''] ?? null;

        if (! $modelClass || ! $log->entity_id) {
            return null;
        }

        $entity = $modelClass::query()->find($log->entity_id);

        if (! $entity) {
            return null;
        }

        $name = collect(match ($log->entity_type) {
            'Order' => [$entity->order_no, $entity->customer_name],
            'PaymentRequest' => [$entity->invoice_no],
            'OrderDocument' => [$entity->display_name, $entity->original_name],
            'OrderCollateral' => [$entity->deskripsi_agunan, $entity->agunan_id],
            'OrderHandover' => [$entity->receiver_name],
            'Notification' => [$entity->title],
            default => [$entity->name, $entity->code],
        })->first(fn ($value) => filled($value));

        return filled($name) ? (string) $name : null;
    }

    private function entityTypeLabel(?string $entityType): string
    {
        return [
            'User' => 'Pengguna',
            'Branch' => 'Kantor cabang',
            'Notary' => 'Kantor notaris',
            'Order' => 'Order',
            'JobType' => 'Jenis pekerjaan',
            'Role' => 'Role',
            'PaymentRequest' => 'Permintaan pembayaran',
            'OrderDocument' => 'Dokumen order',
            'OrderCollateral' => 'Agunan order',
            'OrderHandover' => 'Handover dokumen',
            'Notification' => 'Notifikasi',
        ][$entityType ?? ''] ?? 'Objek';
    }
}
