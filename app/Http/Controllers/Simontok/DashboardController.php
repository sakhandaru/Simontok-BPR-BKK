<?php

namespace App\Http\Controllers\Simontok;

use App\Enums\TrackAStatus;
use App\Enums\TrackBDocStatus;
use App\Enums\TrackCCovernoteStatus;
use App\Enums\TrackDPaymentStatus;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderCollateral;
use App\Models\OrderStatusHistory;
use App\Models\PaymentRequest;
use App\Models\User;
use App\Support\OrderStages;
use Carbon\CarbonInterface;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $closedStatuses = OrderStages::closedStatuses();
        $visibleOrders = Order::query()->visibleTo($request->user());
        $visibleCollaterals = OrderCollateral::whereHas('order', fn ($query) => $query->visibleTo($request->user()));
        $activeOrders = (clone $visibleOrders)->whereNotIn('status', $closedStatuses);
        $totalOrders = (clone $visibleOrders)->count();
        $completedOrders = (clone $visibleOrders)->where('status', TrackAStatus::Selesai->value)->count();
        $finalValidated = (clone $visibleCollaterals)->where('doc_status', TrackBDocStatus::FinalDivalidasi->value)->count();
        $totalCollaterals = (clone $visibleCollaterals)->count();

        return Inertia::render('dashboard', [
            'stats' => [
                'active_orders' => (clone $activeOrders)->count(),
                'risk_orders' => (clone $visibleOrders)->where('risk_flag', true)->count(),
                'submitted_orders' => (clone $visibleOrders)->whereIn('status', [TrackAStatus::Diajukan->value, TrackAStatus::MenungguApproval->value, TrackAStatus::DisetujuiKepalaCabang->value])->count(),
                'completed_orders' => $completedOrders,
                'overdue_sla' => (clone $visibleCollaterals)->whereNotNull('sla_due_at')->where('sla_due_at', '<', now())->whereHas('order', fn ($query) => $query->whereNotIn('status', $closedStatuses))->count(),
                'due_soon_sla' => (clone $visibleCollaterals)->whereBetween('sla_due_at', [now(), now()->addDays(7)])->whereHas('order', fn ($query) => $query->whereNotIn('status', $closedStatuses))->count(),
                'expired_covernotes' => (clone $visibleCollaterals)->where('covernote_status', TrackCCovernoteStatus::Kedaluwarsa->value)->whereHas('order', fn ($query) => $query->whereNotIn('status', $closedStatuses))->count(),
                'pending_handovers' => (clone $visibleCollaterals)->where('doc_status', TrackBDocStatus::FinalDivalidasi->value)->whereDoesntHave('handovers')->whereHas('order', fn ($query) => $query->whereNotIn('status', $closedStatuses))->count(),
                'pending_final_validation' => (clone $visibleCollaterals)->where('doc_status', TrackBDocStatus::FinalDiunggah->value)->count(),
                'total_orders' => $totalOrders,
                'completion_rate' => $totalOrders > 0 ? round(($completedOrders / $totalOrders) * 100) : 0,
                'final_validation_rate' => $totalCollaterals > 0 ? round(($finalValidated / $totalCollaterals) * 100) : 0,
                'total_collaterals' => $totalCollaterals,
                'final_validated' => $finalValidated,
            ],
            'workflow' => collect(OrderStages::groups())
                ->map(fn (array $group, string $key) => [
                    'key' => $key,
                    'label' => $group['label'],
                    'value' => (clone $visibleOrders)->whereIn('status', $group['statuses'])->count(),
                ])
                ->values()
                ->all(),
            'deltas' => [
                'active' => $this->stockDelta(
                    (clone $activeOrders)->count(),
                    $this->activeOrdersAt($request->user(), now()->subDays(7), $closedStatuses),
                ),
                'completed' => $this->stockDelta(
                    $completedOrders,
                    $this->completedOrdersAt($request->user(), now()->subDays(7)),
                ),
                'period' => 'vs 7 hari lalu',
            ],
            'riskItems' => [
                'expiredCovernotes' => $this->riskCollaterals(fn ($query) => $query
                    ->where('covernote_status', TrackCCovernoteStatus::Kedaluwarsa->value)
                    ->whereHas('order', fn ($orderQuery) => $orderQuery->whereNotIn('status', $closedStatuses)), $request->user()),
                'overdueSla' => $this->riskCollaterals(fn ($query) => $query->whereNotNull('sla_due_at')->where('sla_due_at', '<', now())->whereHas('order', fn ($orderQuery) => $orderQuery->whereNotIn('status', $closedStatuses)), $request->user()),
                'pendingHandovers' => $this->riskCollaterals(fn ($query) => $query->where('doc_status', TrackBDocStatus::FinalDivalidasi->value)->whereDoesntHave('handovers')->whereHas('order', fn ($orderQuery) => $orderQuery->whereNotIn('status', $closedStatuses)), $request->user()),
            ],
            'notaryPerformance' => (clone $visibleOrders)
                ->select('notaries.id', 'notaries.name')
                ->selectRaw('COUNT(orders.id) as total_orders')
                ->selectRaw('SUM(CASE WHEN orders.status = ? THEN 1 ELSE 0 END) as completed_orders', [TrackAStatus::Selesai->value])
                ->selectRaw('SUM(CASE WHEN orders.risk_flag = 1 THEN 1 ELSE 0 END) as risk_orders')
                ->join('notaries', 'notaries.id', '=', 'orders.notary_id')
                ->groupBy('notaries.id', 'notaries.name')
                ->orderByDesc('total_orders')
                ->get()
                ->map(fn ($item) => [
                    'id' => $item->id,
                    'name' => $item->name,
                    'total_orders' => (int) $item->total_orders,
                    'completed_orders' => (int) $item->completed_orders,
                    'risk_orders' => (int) $item->risk_orders,
                ]),
            'branchMonitoring' => (clone $visibleOrders)
                ->select('branches.id', 'branches.code', 'branches.name')
                ->selectRaw('COUNT(orders.id) as total_orders')
                ->selectRaw('SUM(CASE WHEN orders.status NOT IN (?, ?, ?) THEN 1 ELSE 0 END) as active_orders', $closedStatuses)
                ->selectRaw('SUM(CASE WHEN orders.risk_flag = 1 THEN 1 ELSE 0 END) as risk_orders')
                ->join('branches', 'branches.id', '=', 'orders.branch_id')
                ->groupBy('branches.id', 'branches.code', 'branches.name')
                ->orderByDesc('active_orders')
                ->get()
                ->map(fn ($item) => [
                    'id' => $item->id,
                    'code' => $item->code,
                    'name' => $item->name,
                    'total_orders' => (int) $item->total_orders,
                    'active_orders' => (int) $item->active_orders,
                    'risk_orders' => (int) $item->risk_orders,
                ]),
            'recentOrders' => (clone $visibleOrders)
                ->with(['branch:id,code,name', 'notary:id,name'])
                ->latest()
                ->limit(8)
                ->get(['id', 'order_no', 'branch_id', 'notary_id', 'customer_name', 'no_rekening', 'status', 'created_at'])
                ->map(fn (Order $order) => [
                    'id' => $order->id,
                    'order_no' => $order->order_no,
                    'customer_name' => $order->customer_name,
                    'no_rekening' => $order->no_rekening,
                    'status' => $this->trackAStatus($order->status)->label(),
                    'branch' => $order->branch?->name,
                    'notary' => $order->notary?->name,
                    'created_at' => $order->created_at?->format('d M Y'),
                ]),
            'statusDistribution' => (clone $visibleOrders)
                ->select('status', DB::raw('COUNT(*) as total'))
                ->groupBy('status')
                ->orderByDesc('total')
                ->get()
                ->map(fn ($item) => [
                    'status' => $this->trackAStatus($item->status)->label(),
                    'value' => $item->status,
                    'total' => (int) $item->total,
                ]),
            'analytics' => [
                'agingByStage' => $this->agingByStage($closedStatuses, $request->user()),
                'covernoteCalendar' => $this->covernoteCalendar($closedStatuses, $request->user()),
                'paymentFunnel' => $this->paymentFunnel($request->user()),
                'weeklyTrend' => $this->weeklyTrend($request->user()),
            ],
        ]);
    }

    /**
     * Delta stok antara posisi sekarang dan posisi $period sebelumnya.
     * pct null ketika pembanding nol, supaya UI menampilkan perubahan absolut, bukan persentase karangan.
     */
    private function stockDelta(int $current, int $previous): array
    {
        return [
            'now' => $current,
            'previous' => $previous,
            'change' => $current - $previous,
            'pct' => $previous > 0 ? round((($current - $previous) / $previous) * 100, 1) : null,
        ];
    }

    /**
     * Rekonstruksi jumlah order aktif pada waktu $at dari jejak riwayat status:
     * order dibuat <= $at dan belum tercatat masuk status tertutup pada <= $at.
     * Order tertutup tanpa riwayat status (data impor tanpa riwayat) diasumsikan
     * tertutup pada waktu perubahan terakhir (updated_at); nol kasus di data dev.
     * Asumsi kedua: status tertutup bersifat terminal, tidak dibuka kembali
     * (diverifikasi dari data: nol riwayat dari status terminal).
     */
    private function activeOrdersAt(User $user, CarbonInterface $at, array $closedStatuses): int
    {
        $visible = Order::query()->visibleTo($user);

        $createdByAt = (clone $visible)
            ->where('created_at', '<=', $at)
            ->count();

        $closedByAt = (clone $visible)
            ->where('created_at', '<=', $at)
            ->whereHas('statusHistories', fn ($query) => $query
                ->where('track', 'A')
                ->whereIn('to_status', $closedStatuses)
                ->where('created_at', '<=', $at))
            ->count()
            + (clone $visible)
                ->where('created_at', '<=', $at)
                ->whereIn('status', $closedStatuses)
                ->whereDoesntHave('statusHistories', fn ($query) => $query
                    ->where('track', 'A')
                    ->whereIn('to_status', $closedStatuses))
                ->where('updated_at', '<=', $at)
                ->count();

        return max(0, $createdByAt - $closedByAt);
    }

    /**
     * Jumlah order yang sudah berstatus Selesai pada waktu $at, dari riwayat
     * penutupan; fallback updated_at untuk order selesai tanpa riwayat serupa.
     */
    private function completedOrdersAt(User $user, CarbonInterface $at): int
    {
        $visible = Order::query()->visibleTo($user);
        $selesai = TrackAStatus::Selesai->value;

        return (clone $visible)
            ->whereHas('statusHistories', fn ($query) => $query
                ->where('track', 'A')
                ->where('to_status', $selesai)
                ->where('created_at', '<=', $at))
            ->count()
            + (clone $visible)
                ->where('status', $selesai)
                ->where('created_at', '<=', $at)
                ->where('updated_at', '<=', $at)
                ->whereDoesntHave('statusHistories', fn ($query) => $query
                    ->where('track', 'A')
                    ->where('to_status', $selesai))
                ->count();
    }

    private function weeklyTrend(User $user): array
    {
        $start = now()->startOfWeek()->subWeeks(7);
        $end = now()->endOfWeek();
        $orders = Order::query()
            ->visibleTo($user)
            ->whereBetween('created_at', [$start, $end])
            ->get(['risk_flag', 'created_at']);
        // Penyelesaian dihitung dari waktu riwayat penutupan, bukan updated_at,
        // supaya order yang disentuh setelah selesai tetap masuk minggu yang benar.
        $completions = OrderStatusHistory::query()
            ->where('track', 'A')
            ->where('to_status', TrackAStatus::Selesai->value)
            ->whereHas('order', fn ($query) => $query->visibleTo($user))
            ->whereBetween('created_at', [$start, $end])
            ->get(['order_id', 'created_at']);

        return collect(range(0, 7))->map(function (int $week) use ($orders, $completions, $start) {
            $weekStart = $start->copy()->addWeeks($week);
            $weekEnd = $weekStart->copy()->endOfWeek();
            $weeklyOrders = $orders->filter(fn (Order $order) => $order->created_at->between($weekStart, $weekEnd, true));

            return [
                'label' => $weekStart->format('d M'),
                'incoming' => $weeklyOrders->count(),
                'completed' => $completions
                    ->filter(fn (OrderStatusHistory $history) => $history->created_at->between($weekStart, $weekEnd, true))
                    ->count(),
                'risk' => $weeklyOrders->where('risk_flag', true)->count(),
            ];
        })->all();
    }

    private function agingByStage(array $closedStatuses, User $user): array
    {
        $stages = OrderStages::activeGroups();

        $rows = Order::query()
            ->visibleTo($user)
            ->whereNotIn('status', $closedStatuses)
            ->get(['status', 'created_at']);

        return collect($stages)->map(function (array $group, string $key) use ($rows) {
            $bucket = ['0-7' => 0, '8-14' => 0, '15-30' => 0, '>30' => 0];

            $rows
                ->filter(fn (Order $order) => in_array($order->status->value, $group['statuses'], true))
                ->each(function (Order $order) use (&$bucket) {
                    $age = (int) $order->created_at->diffInDays(now());

                    if ($age <= 7) {
                        $bucket['0-7']++;
                    } elseif ($age <= 14) {
                        $bucket['8-14']++;
                    } elseif ($age <= 30) {
                        $bucket['15-30']++;
                    } else {
                        $bucket['>30']++;
                    }
                });

            return [
                'key' => $key,
                'stage' => $group['label'],
                'total' => array_sum($bucket),
                'buckets' => $bucket,
            ];
        })->values()->all();
    }

    private function covernoteCalendar(array $closedStatuses, User $user): array
    {
        $now = now();

        return [
            [
                'label' => 'Kedaluwarsa',
                'total' => OrderCollateral::where('covernote_end', '<', $now)->whereHas('order', fn ($query) => $query->visibleTo($user)->whereNotIn('status', $closedStatuses))->count(),
            ],
            [
                'label' => '0-7 hari',
                'total' => OrderCollateral::whereBetween('covernote_end', [$now, $now->copy()->addDays(7)])->whereHas('order', fn ($query) => $query->visibleTo($user)->whereNotIn('status', $closedStatuses))->count(),
            ],
            [
                'label' => '8-14 hari',
                'total' => OrderCollateral::whereBetween('covernote_end', [$now->copy()->addDays(8), $now->copy()->addDays(14)])->whereHas('order', fn ($query) => $query->visibleTo($user)->whereNotIn('status', $closedStatuses))->count(),
            ],
            [
                'label' => '15-30 hari',
                'total' => OrderCollateral::whereBetween('covernote_end', [$now->copy()->addDays(15), $now->copy()->addDays(30)])->whereHas('order', fn ($query) => $query->visibleTo($user)->whereNotIn('status', $closedStatuses))->count(),
            ],
        ];
    }

    private function paymentFunnel(User $user): array
    {
        return [
            ['label' => 'Diajukan', 'total' => PaymentRequest::where('status', TrackDPaymentStatus::Diajukan->value)->whereHas('order', fn ($query) => $query->visibleTo($user))->count()],
            ['label' => 'Diverifikasi', 'total' => PaymentRequest::where('status', TrackDPaymentStatus::DiverifikasiAdmin->value)->whereHas('order', fn ($query) => $query->visibleTo($user))->count()],
            ['label' => 'Disetujui', 'total' => PaymentRequest::where('status', TrackDPaymentStatus::Disetujui->value)->whereHas('order', fn ($query) => $query->visibleTo($user))->count()],
            ['label' => 'Dibayar', 'total' => PaymentRequest::where('status', TrackDPaymentStatus::Dibayar->value)->whereHas('order', fn ($query) => $query->visibleTo($user))->count()],
        ];
    }

    private function riskCollaterals(callable $constraint, User $user)
    {
        return OrderCollateral::query()
            ->whereHas('order', fn ($query) => $query->visibleTo($user))
            ->with(['order:id,order_no,customer_name,no_rekening,branch_id,notary_id,status', 'order.branch:id,code,name', 'order.notary:id,name', 'jobType:id,name'])
            ->tap($constraint)
            ->latest('updated_at')
            ->limit(5)
            ->get()
            ->map(fn (OrderCollateral $collateral) => [
                'id' => $collateral->id,
                'order_id' => $collateral->order_id,
                'order_no' => $collateral->order?->order_no,
                'customer_name' => $collateral->order?->customer_name,
                'branch' => $collateral->order?->branch?->name,
                'notary' => $collateral->order?->notary?->name,
                'job_type' => $collateral->jobType?->name,
                'doc_status' => $collateral->doc_status?->value,
                'covernote_status' => $collateral->covernote_status?->value,
                'sla_due_at' => $collateral->sla_due_at?->format('d M Y'),
                'covernote_end' => $collateral->covernote_end?->format('d M Y'),
            ]);
    }

    private function trackAStatus(TrackAStatus|string $status): TrackAStatus
    {
        return $status instanceof TrackAStatus ? $status : TrackAStatus::from($status);
    }
}
