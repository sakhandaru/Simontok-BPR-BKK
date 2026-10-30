<?php

namespace App\Http\Controllers\Simontok;

use App\Enums\TrackAStatus;
use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Order;
use App\Support\OrderStages;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class BranchMonitoringController extends Controller
{
    public function __invoke(Request $request): Response
    {
        abort_unless($request->user()->hasGlobalReadScope(), 403);
        $closed = OrderStages::closedStatuses();
        $rows = Branch::query()->where('is_active', true)->orderBy('name')->get()->map(function (Branch $branch) use ($closed) {
            $orders = Order::where('branch_id', $branch->id);
            return [
                'id' => $branch->id,
                'code' => $branch->code,
                'name' => $branch->name,
                'total_orders' => (clone $orders)->count(),
                'active_orders' => (clone $orders)->whereNotIn('status', $closed)->count(),
                'risk_orders' => (clone $orders)->where('risk_flag', true)->whereNotIn('status', $closed)->count(),
                'overdue_sla' => (clone $orders)->whereNotNull('sla_due_at')->where('sla_due_at', '<', now())->whereNotIn('status', $closed)->count(),
                'completed_orders' => (clone $orders)->where('status', TrackAStatus::Selesai->value)->count(),
            ];
        });

        return Inertia::render('simontok/branch-monitoring/index', [
            'summary' => [
                'branches' => $rows->count(),
                'active_orders' => $rows->sum('active_orders'),
                'risk_orders' => $rows->sum('risk_orders'),
                'overdue_sla' => $rows->sum('overdue_sla'),
            ],
            'branches' => $rows->values()->all(),
        ]);
    }
}
