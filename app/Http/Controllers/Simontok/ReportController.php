<?php

namespace App\Http\Controllers\Simontok;

use App\Enums\TrackAStatus;
use App\Enums\TrackBDocStatus;
use App\Enums\TrackCCovernoteStatus;
use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Notary;
use App\Models\Order;
use App\Models\OrderCollateral;
use App\Models\User;
use App\Support\OrderStages;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ReportController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $branchScopeId = $user->branchScopeId();
        if ($branchScopeId !== null) {
            $request->merge(['branch_id' => $branchScopeId]);
        }

        $filters = $request->validate([
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'notary_id' => ['nullable', 'integer', 'exists:notaries,id'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
        ]);

        $orders = Order::query()->submitted()->visibleTo($request->user())
            ->when($filters['branch_id'] ?? null, fn ($query, int $branchId) => $query->where('branch_id', $branchId))
            ->when($filters['notary_id'] ?? null, fn ($query, int $notaryId) => $query->where('notary_id', $notaryId))
            ->when($filters['date_from'] ?? null, fn ($query, string $date) => $query->whereDate('orders.created_at', '>=', $date))
            ->when($filters['date_to'] ?? null, fn ($query, string $date) => $query->whereDate('orders.created_at', '<=', $date));

        $closedStatuses = [TrackAStatus::Selesai->value, TrackAStatus::Dibatalkan->value, TrackAStatus::DitolakNotaris->value];
        $totalOrders = (clone $orders)->count();
        $completedOrders = (clone $orders)->where('status', TrackAStatus::Selesai->value)->count();
        $activeOrders = (clone $orders)->whereNotIn('status', $closedStatuses)->count();
        $riskOrders = (clone $orders)->where('risk_flag', true)->count();
        $finalValidated = OrderCollateral::where('doc_status', TrackBDocStatus::FinalDivalidasi->value)
            ->whereHas('order', fn ($query) => $this->applyOrderFilters($query, $filters, $user))
            ->count();
        $finalDocuments = OrderCollateral::whereIn('doc_status', [TrackBDocStatus::FinalDiunggah->value, TrackBDocStatus::FinalDivalidasi->value])
            ->whereHas('order', fn ($query) => $this->applyOrderFilters($query, $filters, $user))
            ->count();

        return Inertia::render('simontok/reports/index', [
            'branchLocked' => $branchScopeId !== null,
            'filters' => [
                'branch_id' => (string) ($filters['branch_id'] ?? ''),
                'notary_id' => (string) ($filters['notary_id'] ?? ''),
                'date_from' => $filters['date_from'] ?? '',
                'date_to' => $filters['date_to'] ?? '',
            ],
            'branches' => Branch::when($branchScopeId, fn ($query, int $branchId) => $query->whereKey($branchId))->orderBy('name')->get(['id', 'code', 'name']),
            'notaries' => Notary::when($branchScopeId, fn ($query, int $branchId) => $query->whereHas('branches', fn ($query) => $query->whereKey($branchId)->where('branch_notary.is_active', true)))->orderBy('name')->get(['id', 'name']),
            'summary' => [
                'total_orders' => $totalOrders,
                'active_orders' => $activeOrders,
                'completed_orders' => $completedOrders,
                'risk_orders' => $riskOrders,
            ],
            'reportKpis' => [
                'completion_rate' => $totalOrders > 0 ? (int) round(($completedOrders / $totalOrders) * 100) : 0,
                'validation_rate' => $finalDocuments > 0 ? (int) round(($finalValidated / $finalDocuments) * 100) : 0,
                'covernote_attention' => OrderCollateral::whereIn('covernote_status', [TrackCCovernoteStatus::Kedaluwarsa->value, TrackCCovernoteStatus::MendekatiJatuhTempo->value])
                    ->whereHas('order', fn ($query) => $this->applyOrderFilters($query, $filters, $user))
                    ->count(),
                'overdue_sla' => OrderCollateral::whereNotNull('sla_due_at')
                    ->where('sla_due_at', '<', now())
                    ->whereHas('order', function ($query) use ($filters, $closedStatuses, $user) {
                        $this->applyOrderFilters($query, $filters, $user);
                        $query->whereNotIn('status', $closedStatuses);
                    })
                    ->count(),
            ],
            'byBranch' => (clone $orders)
                ->select('branches.code', 'branches.name')
                ->selectRaw('COUNT(orders.id) as total_orders')
                ->selectRaw('SUM(CASE WHEN orders.status NOT IN (?, ?, ?) THEN 1 ELSE 0 END) as active_orders', $closedStatuses)
                ->selectRaw('SUM(CASE WHEN orders.status = ? THEN 1 ELSE 0 END) as completed_orders', [TrackAStatus::Selesai->value])
                ->selectRaw('SUM(CASE WHEN orders.risk_flag = 1 THEN 1 ELSE 0 END) as risk_orders')
                ->join('branches', 'branches.id', '=', 'orders.branch_id')
                ->groupBy('branches.code', 'branches.name')
                ->orderBy('branches.code')
                ->paginate(10)->withQueryString()->through(function ($row) {
                    $row->total_orders = (int) $row->total_orders;
                    $row->active_orders = (int) $row->active_orders;
                    $row->completed_orders = (int) $row->completed_orders;
                    $row->risk_orders = (int) $row->risk_orders;
                    $row->completion_rate = $row->total_orders > 0 ? (int) round(($row->completed_orders / $row->total_orders) * 100) : 0;

                    return $row;
                }),
            'byNotary' => (clone $orders)
                ->select('notaries.name')
                ->selectRaw('COUNT(orders.id) as total_orders')
                ->selectRaw('SUM(CASE WHEN orders.status = ? THEN 1 ELSE 0 END) as completed_orders', [TrackAStatus::Selesai->value])
                ->selectRaw('SUM(CASE WHEN orders.risk_flag = 1 THEN 1 ELSE 0 END) as risk_orders')
                ->join('notaries', 'notaries.id', '=', 'orders.notary_id')
                ->groupBy('notaries.name')
                ->orderByDesc('total_orders')
                ->paginate(10)->withQueryString(),
            'covernoteReport' => OrderCollateral::query()
                ->select('covernote_status', DB::raw('COUNT(*) as total'))
                ->whereHas('order', fn ($query) => $this->applyOrderFilters($query, $filters, $user))
                ->groupBy('covernote_status')
                ->get()
                ->map(function ($item) {
                    $rawStatus = $item->covernote_status;
                    $status = $rawStatus instanceof TrackCCovernoteStatus
                        ? $rawStatus->value
                        : TrackCCovernoteStatus::tryFrom((string) $rawStatus)?->value;

                    return [
                        'status' => $status ?? 'belum_ada',
                        'total' => (int) $item->total,
                    ];
                }),
            'outstandingOrders' => (clone $orders)
                ->with(['branch:id,code,name', 'notary:id,name'])
                ->whereNotIn('status', $closedStatuses)
                ->latest()
                ->paginate(10, ['id', 'order_no', 'branch_id', 'notary_id', 'customer_name', 'no_rekening', 'status', 'risk_flag', 'created_at'])
                ->withQueryString()
                ->through(fn (Order $order) => [
                    'id' => $order->id,
                    'order_no' => $order->order_no,
                    'customer_name' => $order->customer_name,
                    'no_rekening' => $order->no_rekening,
                    'branch' => $order->branch?->name,
                    'notary' => $order->notary?->name,
                    'status' => $order->status->label(),
                    'risk_flag' => $order->risk_flag,
                    'created_at' => $order->created_at?->format('d M Y'),
                ]),
            'documentValidation' => [
                'final_validated' => OrderCollateral::where('doc_status', TrackBDocStatus::FinalDivalidasi->value)->whereHas('order', fn ($query) => $this->applyOrderFilters($query, $filters, $user))->count(),
                'final_uploaded' => OrderCollateral::where('doc_status', TrackBDocStatus::FinalDiunggah->value)->whereHas('order', fn ($query) => $this->applyOrderFilters($query, $filters, $user))->count(),
            ],
            'stageSummary' => collect(OrderStages::activeGroups())->map(function (array $stage, string $key) use ($orders) {
                return [
                    'key' => $key,
                    'label' => $stage['label'],
                    'total' => (clone $orders)->whereIn('status', $stage['statuses'])->count(),
                ];
            })->values()->all(),
            'monthlyTrend' => $this->monthlyTrend($orders),
            'stalledOrders' => (clone $orders)
                ->with(['branch:id,code,name', 'notary:id,name'])
                ->whereNotIn('status', $closedStatuses)
                ->where('updated_at', '<', now()->subDays(7))
                ->latest('updated_at')
                ->limit(10)
                ->get(['id', 'order_no', 'branch_id', 'notary_id', 'customer_name', 'status', 'risk_flag', 'updated_at'])
                ->map(fn (Order $order) => [
                    'id' => $order->id,
                    'order_no' => $order->order_no,
                    'customer_name' => $order->customer_name,
                    'branch' => $order->branch?->name,
                    'notary' => $order->notary?->name,
                    'status' => $order->status->label(),
                    'risk_flag' => (bool) $order->risk_flag,
                    'updated_at' => $order->updated_at?->format('d M Y'),
                ])->values()->all(),
        ]);
    }

    private function monthlyTrend($orders): array
    {
        $monthExpression = DB::connection()->getDriverName() === 'sqlite'
            ? "strftime('%Y-%m', created_at)"
            : "DATE_FORMAT(created_at, '%Y-%m')";

        return (clone $orders)
            ->selectRaw("{$monthExpression} as month")
            ->selectRaw('COUNT(*) as total_orders')
            ->selectRaw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as completed_orders', [TrackAStatus::Selesai->value])
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->map(fn ($row) => [
                'month' => $row->month,
                'total_orders' => (int) $row->total_orders,
                'completed_orders' => (int) $row->completed_orders,
            ])->all();
    }

    private function applyOrderFilters($query, array $filters, User $user): void
    {
        $query
            ->submitted()
            ->visibleTo($user)
            ->when($filters['branch_id'] ?? null, fn ($query, int $branchId) => $query->where('branch_id', $branchId))
            ->when($filters['notary_id'] ?? null, fn ($query, int $notaryId) => $query->where('notary_id', $notaryId))
            ->when($filters['date_from'] ?? null, fn ($query, string $date) => $query->whereDate('orders.created_at', '>=', $date))
            ->when($filters['date_to'] ?? null, fn ($query, string $date) => $query->whereDate('orders.created_at', '<=', $date));
    }
}
