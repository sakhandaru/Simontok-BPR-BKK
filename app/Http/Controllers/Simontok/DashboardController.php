<?php

namespace App\Http\Controllers\Simontok;

use App\Enums\TrackAStatus;
use App\Enums\TrackBDocStatus;
use App\Enums\TrackCCovernoteStatus;
use App\Enums\TrackDPaymentStatus;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderCollateral;
use App\Models\PaymentRequest;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $closedStatuses = [TrackAStatus::Selesai->value, TrackAStatus::Dibatalkan->value, TrackAStatus::DitolakNotaris->value];
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
                'expired_covernotes' => (clone $visibleCollaterals)->where('covernote_status', TrackCCovernoteStatus::Kedaluwarsa->value)->count(),
                'pending_handovers' => (clone $visibleCollaterals)->where('doc_status', TrackBDocStatus::FinalDivalidasi->value)->whereDoesntHave('handovers')->whereHas('order', fn ($query) => $query->whereNotIn('status', $closedStatuses))->count(),
                'total_orders' => $totalOrders,
                'completion_rate' => $totalOrders > 0 ? round(($completedOrders / $totalOrders) * 100) : 0,
                'final_validation_rate' => $totalCollaterals > 0 ? round(($finalValidated / $totalCollaterals) * 100) : 0,
            ],
            'workflow' => [
                ['label' => 'Draft', 'value' => (clone $visibleOrders)->whereIn('status', [TrackAStatus::Draft->value, TrackAStatus::PerluPerbaikanOrder->value])->count()],
                ['label' => 'Persetujuan order', 'value' => (clone $visibleOrders)->whereIn('status', [TrackAStatus::Diajukan->value, TrackAStatus::MenungguApproval->value, TrackAStatus::DisetujuiKepalaCabang->value])->count()],
                ['label' => 'Verifikasi notaris', 'value' => (clone $visibleOrders)->whereIn('status', [TrackAStatus::MenungguVerifikasiNotaris->value, TrackAStatus::PerbaikanDokumen->value])->count()],
                ['label' => 'Proses akta', 'value' => (clone $visibleOrders)->whereIn('status', [TrackAStatus::DokumenValid->value, TrackAStatus::ProsesAkta->value, TrackAStatus::ProsesBpnSamsat->value])->count()],
                ['label' => 'Validasi BPR', 'value' => (clone $visibleOrders)->whereIn('status', [TrackAStatus::DraftDiunggah->value, TrackAStatus::MenungguValidasiBpr->value, TrackAStatus::DokumenFinalDiunggah->value])->count()],
                ['label' => 'Fisik & bayar', 'value' => (clone $visibleOrders)->where('status', TrackAStatus::DokumenFisikDiterima->value)->count()],
                ['label' => 'Selesai', 'value' => $completedOrders],
            ],
            'riskItems' => [
                'expiredCovernotes' => $this->riskCollaterals(fn ($query) => $query->where('covernote_status', TrackCCovernoteStatus::Kedaluwarsa->value), $request->user()),
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
                ->limit(6)
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
                ->limit(6)
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

    private function weeklyTrend(User $user): array
    {
        $start = now()->startOfWeek()->subWeeks(7);
        $end = now()->endOfWeek();
        $orders = Order::query()
            ->visibleTo($user)
            ->whereBetween('created_at', [$start, $end])
            ->get(['status', 'risk_flag', 'created_at', 'updated_at']);

        return collect(range(0, 7))->map(function (int $week) use ($orders, $start) {
            $weekStart = $start->copy()->addWeeks($week);
            $weekEnd = $weekStart->copy()->endOfWeek();
            $weeklyOrders = $orders->filter(fn (Order $order) => $order->created_at->between($weekStart, $weekEnd, true));

            return [
                'label' => $weekStart->format('d M'),
                'incoming' => $weeklyOrders->count(),
                'completed' => $orders
                    ->filter(fn (Order $order) => $order->updated_at->between($weekStart, $weekEnd, true) && $this->trackAStatus($order->status) === TrackAStatus::Selesai)
                    ->count(),
                'risk' => $weeklyOrders->where('risk_flag', true)->count(),
            ];
        })->all();
    }

    private function agingByStage(array $closedStatuses, User $user): array
    {
        $stages = [
            'Draft' => [TrackAStatus::Draft->value, TrackAStatus::PerluPerbaikanOrder->value],
            'Persetujuan order' => [TrackAStatus::Diajukan->value, TrackAStatus::MenungguApproval->value, TrackAStatus::DisetujuiKepalaCabang->value],
            'Verifikasi notaris' => [TrackAStatus::MenungguVerifikasiNotaris->value, TrackAStatus::PerbaikanDokumen->value],
            'Proses akta' => [TrackAStatus::DokumenValid->value, TrackAStatus::ProsesAkta->value, TrackAStatus::ProsesBpnSamsat->value],
            'Validasi BPR' => [TrackAStatus::DraftDiunggah->value, TrackAStatus::MenungguValidasiBpr->value, TrackAStatus::DokumenFinalDiunggah->value],
            'Fisik & bayar' => [TrackAStatus::DokumenFisikDiterima->value],
        ];

        $rows = Order::query()
            ->visibleTo($user)
            ->whereNotIn('status', $closedStatuses)
            ->get(['status', 'created_at']);

        return collect($stages)->map(function (array $statuses, string $label) use ($rows) {
            $bucket = ['0-7' => 0, '8-14' => 0, '15-30' => 0, '>30' => 0];

            $rows
                ->filter(fn (Order $order) => in_array($this->trackAStatus($order->status)->value, $statuses, true))
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
                'stage' => $label,
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
