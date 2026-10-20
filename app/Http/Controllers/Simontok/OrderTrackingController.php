<?php

namespace App\Http\Controllers\Simontok;

use App\Enums\TrackAStatus;
use App\Http\Controllers\Controller;
use App\Models\Order;
use Carbon\CarbonInterface;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;

class OrderTrackingController extends Controller
{
    public function index(Request $request): RedirectResponse
    {
        return redirect()->route('orders.index', $request->query());
    }

    public function show(Request $request, Order $order): RedirectResponse
    {
        abort_unless($order->isVisibleTo($request->user()), 404);
        return redirect()->route('orders.show', $order);
    }

    private function summary(Order $order): array
    {
        $currentNode = $this->currentNode($order->status);
        $progress = $this->progress($order->status);

        return [
            'id' => $order->id,
            'order_no' => $order->order_no,
            'customer_name' => $order->customer_name,
            'no_rekening' => $order->no_rekening,
            'branch' => $order->branch?->name,
            'notary' => $order->notary?->name,
            'status' => $order->status->value,
            'status_label' => $order->status->label(),
            'current_node' => $currentNode,
            'progress' => $progress,
            'risk_flag' => $order->risk_flag,
            'payment_status' => $order->paymentRequest?->status?->label() ?? 'Belum invoice',
            'created_at' => $this->formatDate($order->created_at),
            'collaterals_count' => $order->collaterals_count ?? $order->collaterals()->count(),
            'documents_count' => $order->documents_count ?? $order->documents()->count(),
            'handovers_count' => $order->handovers_count ?? $order->handovers()->count(),
        ];
    }

    private function currentNode(TrackAStatus $status): string
    {
        return match ($status) {
            TrackAStatus::Draft => 'Draft order',
            TrackAStatus::Diajukan, TrackAStatus::MenungguApproval, TrackAStatus::PerluPerbaikanOrder, TrackAStatus::DisetujuiKepalaCabang => 'Persetujuan order',
            TrackAStatus::MenungguVerifikasiNotaris, TrackAStatus::PerbaikanDokumen => 'Verifikasi notaris',
            TrackAStatus::DokumenValid, TrackAStatus::ProsesAkta, TrackAStatus::ProsesBpnSamsat => 'Proses akta/BPN',
            TrackAStatus::DraftDiunggah, TrackAStatus::MenungguValidasiBpr, TrackAStatus::DokumenFinalDiunggah => 'Validasi BPR',
            TrackAStatus::DokumenFisikDiterima => 'Fisik & bayar',
            TrackAStatus::Selesai => 'Selesai',
            TrackAStatus::DitolakNotaris => 'Ditolak notaris',
            TrackAStatus::Dibatalkan => 'Dibatalkan',
        };
    }

    private function progress(TrackAStatus $status): int
    {
        return match ($status) {
            TrackAStatus::Draft => 4,
            TrackAStatus::Diajukan, TrackAStatus::MenungguApproval, TrackAStatus::PerluPerbaikanOrder => 12,
            TrackAStatus::DisetujuiKepalaCabang => 18,
            TrackAStatus::MenungguVerifikasiNotaris, TrackAStatus::PerbaikanDokumen => 25,
            TrackAStatus::DokumenValid => 38,
            TrackAStatus::ProsesAkta, TrackAStatus::ProsesBpnSamsat => 50,
            TrackAStatus::DraftDiunggah, TrackAStatus::MenungguValidasiBpr => 63,
            TrackAStatus::DokumenFinalDiunggah => 75,
            TrackAStatus::DokumenFisikDiterima => 88,
            TrackAStatus::Selesai => 100,
            TrackAStatus::DitolakNotaris, TrackAStatus::Dibatalkan => 100,
        };
    }

    private function formatDate(mixed $value, string $format = 'd M Y'): ?string
    {
        if ($value instanceof CarbonInterface) {
            return $value->format($format);
        }

        return filled($value) ? (string) $value : null;
    }
}
