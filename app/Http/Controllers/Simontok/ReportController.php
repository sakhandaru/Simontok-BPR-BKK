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
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ReportController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'notary_id' => ['nullable', 'integer', 'exists:notaries,id'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
        ]);

        $orders = Order::query()->visibleTo($request->user())
            ->when($filters['branch_id'] ?? null, fn ($query, int $branchId) => $query->where('branch_id', $branchId))
            ->when($filters['notary_id'] ?? null, fn ($query, int $notaryId) => $query->where('notary_id', $notaryId))
            ->when($filters['date_from'] ?? null, fn ($query, string $date) => $query->whereDate('created_at', '>=', $date))
            ->when($filters['date_to'] ?? null, fn ($query, string $date) => $query->whereDate('created_at', '<=', $date));

        $closedStatuses = [TrackAStatus::Selesai->value, TrackAStatus::Dibatalkan->value, TrackAStatus::DitolakNotaris->value];

        return Inertia::render('simontok/reports/index', [
            'filters' => [
                'branch_id' => (string) ($filters['branch_id'] ?? ''),
                'notary_id' => (string) ($filters['notary_id'] ?? ''),
                'date_from' => $filters['date_from'] ?? '',
                'date_to' => $filters['date_to'] ?? '',
            ],
            'branches' => Branch::orderBy('name')->get(['id', 'code', 'name']),
            'notaries' => Notary::orderBy('name')->get(['id', 'name']),
            'summary' => [
                'total_orders' => (clone $orders)->count(),
                'active_orders' => (clone $orders)->whereNotIn('status', $closedStatuses)->count(),
                'completed_orders' => (clone $orders)->where('status', TrackAStatus::Selesai->value)->count(),
                'risk_orders' => (clone $orders)->where('risk_flag', true)->count(),
            ],
            'byBranch' => (clone $orders)
                ->select('branches.code', 'branches.name')
                ->selectRaw('COUNT(orders.id) as total_orders')
                ->selectRaw('SUM(CASE WHEN orders.status = ? THEN 1 ELSE 0 END) as completed_orders', [TrackAStatus::Selesai->value])
                ->selectRaw('SUM(CASE WHEN orders.risk_flag = 1 THEN 1 ELSE 0 END) as risk_orders')
                ->join('branches', 'branches.id', '=', 'orders.branch_id')
                ->groupBy('branches.code', 'branches.name')
                ->orderBy('branches.code')
                ->get(),
            'byNotary' => (clone $orders)
                ->select('notaries.name')
                ->selectRaw('COUNT(orders.id) as total_orders')
                ->selectRaw('SUM(CASE WHEN orders.status = ? THEN 1 ELSE 0 END) as completed_orders', [TrackAStatus::Selesai->value])
                ->selectRaw('SUM(CASE WHEN orders.risk_flag = 1 THEN 1 ELSE 0 END) as risk_orders')
                ->join('notaries', 'notaries.id', '=', 'orders.notary_id')
                ->groupBy('notaries.name')
                ->orderByDesc('total_orders')
                ->limit(20)
                ->get(),
            'covernoteReport' => OrderCollateral::query()
                ->select('covernote_status', DB::raw('COUNT(*) as total'))
                ->whereHas('order', fn ($query) => $this->applyOrderFilters($query, $filters))
                ->groupBy('covernote_status')
                ->get()
                ->map(fn ($item) => [
                    'status' => ($item->covernote_status instanceof TrackCCovernoteStatus
                        ? $item->covernote_status
                        : TrackCCovernoteStatus::from($item->covernote_status)
                    )->value,
                    'total' => (int) $item->total,
                ]),
            'outstandingOrders' => (clone $orders)
                ->with(['branch:id,code,name', 'notary:id,name'])
                ->whereNotIn('status', $closedStatuses)
                ->latest()
                ->limit(20)
                ->get(['id', 'order_no', 'branch_id', 'notary_id', 'customer_name', 'no_rekening', 'status', 'risk_flag', 'created_at'])
                ->map(fn (Order $order) => [
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
                'final_validated' => OrderCollateral::where('doc_status', TrackBDocStatus::FinalDivalidasi->value)->whereHas('order', fn ($query) => $this->applyOrderFilters($query, $filters))->count(),
                'final_uploaded' => OrderCollateral::where('doc_status', TrackBDocStatus::FinalDiunggah->value)->whereHas('order', fn ($query) => $this->applyOrderFilters($query, $filters))->count(),
            ],
        ]);
    }

    private function applyOrderFilters($query, array $filters): void
    {
        $query
            ->when($filters['branch_id'] ?? null, fn ($query, int $branchId) => $query->where('branch_id', $branchId))
            ->when($filters['notary_id'] ?? null, fn ($query, int $notaryId) => $query->where('notary_id', $notaryId))
            ->when($filters['date_from'] ?? null, fn ($query, string $date) => $query->whereDate('created_at', '>=', $date))
            ->when($filters['date_to'] ?? null, fn ($query, string $date) => $query->whereDate('created_at', '<=', $date));
    }
}
