<?php

namespace App\Http\Controllers\Simontok;

use App\Enums\TrackAStatus;
use App\Enums\TrackDPaymentStatus;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class WorkQueueController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $user = $request->user();
        $orders = Order::query()->visibleTo($user)->with(['branch:id,name', 'notary:id,name', 'paymentRequest:id,order_id,status']);
        $tasks = collect();

        if ($user->hasPermission('orders.approve')) {
            $this->add($tasks, (clone $orders)->whereIn('status', [TrackAStatus::Diajukan->value, TrackAStatus::MenungguApproval->value, TrackAStatus::DisetujuiKepalaCabang->value])->get(), 'Persetujuan order', 'Tinjau dan putuskan order yang menunggu persetujuan.', 'important');
        }
        if ($user->hasPermission('documents.validate')) {
            $this->add($tasks, (clone $orders)->whereIn('status', [TrackAStatus::MenungguValidasiBpr->value, TrackAStatus::DokumenFinalDiunggah->value])->get(), 'Validasi dokumen final', 'Dokumen final menunggu pemeriksaan legal.', 'important');
        }
        if ($user->hasPermission('covernotes.approve')) {
            $this->add($tasks, (clone $orders)->whereIn('status', [TrackAStatus::MenungguApprovalCovernote->value, TrackAStatus::MenungguApprovalCovernoteKepalaCabang->value])->get(), 'Persetujuan biaya & covernote', 'Biaya langkah dan covernote menunggu persetujuan.', 'important');
        }
        if ($user->hasPermission('payments.pay')) {
            $this->add($tasks, (clone $orders)->where('status', TrackAStatus::DokumenFisikDiterima->value)->whereHas('paymentRequest', fn ($query) => $query->where('status', TrackDPaymentStatus::Diajukan->value))->get(), 'Unggah bukti pembayaran', 'Invoice notaris siap dibayar setelah dokumen fisik diterima.', 'important');
        }
        if ($user->hasPermission('handovers.manage')) {
            $this->add($tasks, (clone $orders)->where('status', TrackAStatus::DokumenFinalDiunggah->value)->get(), 'Handover dokumen', 'Dokumen final siap dicatat serah terimanya.', 'normal');
        }
        if ($user->hasPermission('orders.manage')) {
            $this->add($tasks, (clone $orders)->whereIn('status', [TrackAStatus::Draft->value, TrackAStatus::PerluPerbaikanOrder->value])->get(), 'Lengkapi order', 'Order masih draft atau dikembalikan untuk diperbaiki.', 'normal');
        }

        $tasks = $tasks->unique(fn (array $task) => $task['id'].'-'.$task['title'])->sortByDesc(fn (array $task) => ($task['priority'] === 'important' ? 2 : 1).'-'.$task['created_at'])->values();

        return Inertia::render('simontok/work-queue/index', [
            'summary' => ['total' => $tasks->count(), 'important' => $tasks->where('priority', 'important')->count()],
            'tasks' => $tasks->take(60)->values()->all(),
        ]);
    }

    private function add(&$tasks, $orders, string $title, string $reason, string $priority): void
    {
        foreach ($orders as $order) {
            $tasks->push([
                'id' => $order->id,
                'order_no' => $order->order_no,
                'title' => $title,
                'reason' => $reason,
                'priority' => $priority,
                'branch' => $order->branch?->name,
                'notary' => $order->notary?->name,
                'status' => $order->status?->label() ?? $order->status,
                'created_at' => $order->created_at?->format('d M Y H:i'),
            ]);
        }
    }
}
