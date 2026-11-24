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
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function export(Request $request): StreamedResponse
    {
        $user = $request->user();
        $branchScopeId = $user->branchScopeId();
        if ($branchScopeId !== null) {
            $request->merge(['branch_id' => $branchScopeId]);
        }

        $filters = $request->validate([
            'type' => ['required', 'in:overall,branches,notaries'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'notary_id' => ['nullable', 'integer', 'exists:notaries,id'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
        ]);
        $orders = $this->filteredOrders($filters, $user);
        $notaryBranches = $filters['type'] === 'notaries'
            ? Notary::with('branches:id,code,name')->get()->keyBy('id')
            : collect();
        $filename = sprintf('laporan-%s-%s.csv', $filters['type'], now()->format('Ymd-His'));

        return response()->streamDownload(function () use ($orders, $filters, $user, $notaryBranches): void {
            $output = fopen('php://output', 'w');
            fwrite($output, "\xEF\xBB\xBF");
            if ($filters['type'] === 'overall') {
                $closedStatuses = [TrackAStatus::Selesai->value, TrackAStatus::Dibatalkan->value, TrackAStatus::DitolakNotaris->value];
                $total = (clone $orders)->count();
                $completed = (clone $orders)->where('status', TrackAStatus::Selesai->value)->count();
                $active = (clone $orders)->whereNotIn('status', $closedStatuses)->count();
                $risk = (clone $orders)->where('risk_flag', true)->count();
                $finalUploaded = OrderCollateral::whereIn('doc_status', [TrackBDocStatus::FinalDiunggah->value, TrackBDocStatus::FinalDivalidasi->value])->whereHas('order', fn ($query) => $this->applyOrderFilters($query, $filters, $user))->count();
                $finalValidated = OrderCollateral::where('doc_status', TrackBDocStatus::FinalDivalidasi->value)->whereHas('order', fn ($query) => $this->applyOrderFilters($query, $filters, $user))->count();
                $covernoteAttention = OrderCollateral::whereIn('covernote_status', [TrackCCovernoteStatus::Kedaluwarsa->value, TrackCCovernoteStatus::MendekatiJatuhTempo->value])->whereHas('order', fn ($query) => $this->applyOrderFilters($query, $filters, $user))->count();
                $overdue = OrderCollateral::whereNotNull('sla_due_at')->where('sla_due_at', '<', now())->whereHas('order', function ($query) use ($filters, $closedStatuses, $user): void { $this->applyOrderFilters($query, $filters, $user); $query->whereNotIn('status', $closedStatuses); })->count();
                fputcsv($output, ['Indikator', 'Nilai'], ';');
                foreach ([['Total order', $total], ['Order aktif', $active], ['Order selesai', $completed], ['Order berisiko', $risk], ['Rasio penyelesaian', ($total > 0 ? round(($completed / $total) * 100) : 0).'%'], ['Dokumen final diunggah', $finalUploaded], ['Dokumen final tervalidasi', $finalValidated], ['Covernote perhatian', $covernoteAttention], ['SLA terlambat', $overdue]] as $row) fputcsv($output, $row, ';');
            } elseif ($filters['type'] === 'branches' || $filters['type'] === 'notaries') {
                $closedStatuses = [TrackAStatus::Selesai->value, TrackAStatus::Dibatalkan->value, TrackAStatus::DitolakNotaris->value];
                $table = $filters['type'] === 'branches' ? 'branches' : 'notaries';
                $nameColumn = $table.'.name as name';
                $joinColumn = $filters['type'] === 'branches' ? 'branch_id' : 'notary_id';
                fputcsv($output, $filters['type'] === 'notaries' ? ['ID Notaris', 'Nama', 'Cabang rekanan', 'Total order', 'Order selesai', 'Order aktif', 'Order berisiko', 'Rasio selesai'] : ['Nama', 'Total order', 'Order selesai', 'Order aktif', 'Order berisiko', 'Rasio selesai'], ';');
                $selects = $filters['type'] === 'notaries' ? [$table.'.id as entity_id', $table.'.legacy_id', $nameColumn] : [$nameColumn];
                $groupBy = [$table.'.id', $table.'.name'];
                if ($filters['type'] === 'notaries') $groupBy[] = $table.'.legacy_id';
                (clone $orders)->select($selects)->selectRaw('COUNT(orders.id) as total_orders')->selectRaw('SUM(CASE WHEN orders.status = ? THEN 1 ELSE 0 END) as completed_orders', [TrackAStatus::Selesai->value])->selectRaw('SUM(CASE WHEN orders.status NOT IN (?, ?, ?) THEN 1 ELSE 0 END) as active_orders', $closedStatuses)->selectRaw('SUM(CASE WHEN orders.risk_flag = 1 THEN 1 ELSE 0 END) as risk_orders')->join($table, $table.'.id', '=', 'orders.'.$joinColumn)->groupBy(...$groupBy)->orderBy($table.'.name')->get()->each(function ($row) use ($output, $filters, $notaryBranches): void { $ratio = $row->total_orders > 0 ? round(($row->completed_orders / $row->total_orders) * 100) : 0; $values = [$row->name, $row->total_orders, $row->completed_orders, $row->active_orders, $row->risk_orders, $ratio.'%']; if ($filters['type'] === 'notaries') { $branches = $notaryBranches->get($row->entity_id)?->branches->map(fn ($branch) => $branch->code.' - '.$branch->name)->implode(', ') ?: '-'; array_splice($values, 0, 0, [$row->legacy_id ?: $row->entity_id, $branches]); } fputcsv($output, $values, ';'); });
            } elseif ($filters['type'] === 'summary') {
                fputcsv($output, ['Nomor order', 'Debitur', 'Nomor rekening', 'Cabang', 'Notaris', 'Status', 'Risiko', 'Tanggal masuk'], ';');
                $orders->with(['branch:id,name', 'notary:id,name'])->orderBy('orders.created_at')->chunk(500, function ($rows) use ($output): void {
                    foreach ($rows as $order) {
                        fputcsv($output, [$order->order_no, $order->customer_name, $order->no_rekening, $order->branch?->name, $order->notary?->name, $order->status->label(), $order->risk_flag ? 'Ya' : 'Tidak', $order->created_at?->format('d/m/Y H:i')], ';');
                    }
                });
            } else {
                $closedStatuses = [TrackAStatus::Selesai->value, TrackAStatus::Dibatalkan->value, TrackAStatus::DitolakNotaris->value];
                fputcsv($output, ['Tipe', 'Nama', 'Total order', 'Order selesai', 'Order aktif', 'Order berisiko', 'Rasio selesai'], ';');
                (clone $orders)->select('branches.name as name')->selectRaw('COUNT(orders.id) as total_orders')->selectRaw('SUM(CASE WHEN orders.status = ? THEN 1 ELSE 0 END) as completed_orders', [TrackAStatus::Selesai->value])->selectRaw('SUM(CASE WHEN orders.status NOT IN (?, ?, ?) THEN 1 ELSE 0 END) as active_orders', $closedStatuses)->selectRaw('SUM(CASE WHEN orders.risk_flag = 1 THEN 1 ELSE 0 END) as risk_orders')->join('branches', 'branches.id', '=', 'orders.branch_id')->groupBy('branches.id', 'branches.name')->orderBy('branches.name')->get()->each(function ($row) use ($output): void {
                    $ratio = $row->total_orders > 0 ? round(($row->completed_orders / $row->total_orders) * 100) : 0;
                    fputcsv($output, ['Cabang', $row->name, $row->total_orders, $row->completed_orders, $row->active_orders, $row->risk_orders, $ratio.'%'], ';');
                });
                (clone $orders)->select('notaries.name as name')->selectRaw('COUNT(orders.id) as total_orders')->selectRaw('SUM(CASE WHEN orders.status = ? THEN 1 ELSE 0 END) as completed_orders', [TrackAStatus::Selesai->value])->selectRaw('SUM(CASE WHEN orders.status NOT IN (?, ?, ?) THEN 1 ELSE 0 END) as active_orders', $closedStatuses)->selectRaw('SUM(CASE WHEN orders.risk_flag = 1 THEN 1 ELSE 0 END) as risk_orders')->join('notaries', 'notaries.id', '=', 'orders.notary_id')->groupBy('notaries.id', 'notaries.name')->orderBy('notaries.name')->get()->each(function ($row) use ($output): void {
                    $ratio = $row->total_orders > 0 ? round(($row->completed_orders / $row->total_orders) * 100) : 0;
                    fputcsv($output, ['Notaris', $row->name, $row->total_orders, $row->completed_orders, $row->active_orders, $row->risk_orders, $ratio.'%'], ';');
                });
            }
            fclose($output);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

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
            ->where('status', '!=', TrackAStatus::PerluPengalihanNotaris->value)
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
            'initialTab' => $request->string('view')->value() === 'progress' ? 'progress' : 'actions',
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
                ->select('branches.id as branch_id', 'branches.code', 'branches.name')
                ->selectRaw('COUNT(orders.id) as total_orders')
                ->selectRaw('SUM(CASE WHEN orders.status NOT IN (?, ?, ?) THEN 1 ELSE 0 END) as active_orders', $closedStatuses)
                ->selectRaw('SUM(CASE WHEN orders.status = ? THEN 1 ELSE 0 END) as completed_orders', [TrackAStatus::Selesai->value])
                ->selectRaw('SUM(CASE WHEN orders.risk_flag = 1 THEN 1 ELSE 0 END) as risk_orders')
                ->join('branches', 'branches.id', '=', 'orders.branch_id')
                ->groupBy('branches.id', 'branches.code', 'branches.name')
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
                ->select('notaries.id as notary_id', 'notaries.name')
                ->selectRaw('COUNT(orders.id) as total_orders')
                ->selectRaw('SUM(CASE WHEN orders.status = ? THEN 1 ELSE 0 END) as completed_orders', [TrackAStatus::Selesai->value])
                ->selectRaw('SUM(CASE WHEN orders.risk_flag = 1 THEN 1 ELSE 0 END) as risk_orders')
                ->join('notaries', 'notaries.id', '=', 'orders.notary_id')
                ->groupBy('notaries.id', 'notaries.name')
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
            ->where('status', '!=', TrackAStatus::PerluPengalihanNotaris->value)
            ->when($filters['branch_id'] ?? null, fn ($query, int $branchId) => $query->where('branch_id', $branchId))
            ->when($filters['notary_id'] ?? null, fn ($query, int $notaryId) => $query->where('notary_id', $notaryId))
            ->when($filters['date_from'] ?? null, fn ($query, string $date) => $query->whereDate('orders.created_at', '>=', $date))
            ->when($filters['date_to'] ?? null, fn ($query, string $date) => $query->whereDate('orders.created_at', '<=', $date));
    }

    private function filteredOrders(array $filters, User $user)
    {
        return Order::query()->submitted()->visibleTo($user)
            ->where('status', '!=', TrackAStatus::PerluPengalihanNotaris->value)
            ->when($filters['branch_id'] ?? null, fn ($query, int $branchId) => $query->where('branch_id', $branchId))
            ->when($filters['notary_id'] ?? null, fn ($query, int $notaryId) => $query->where('notary_id', $notaryId))
            ->when($filters['date_from'] ?? null, fn ($query, string $date) => $query->whereDate('orders.created_at', '>=', $date))
            ->when($filters['date_to'] ?? null, fn ($query, string $date) => $query->whereDate('orders.created_at', '<=', $date));
    }
}
