<?php

namespace App\Http\Controllers\Simontok;

use App\Enums\HandoverMethod;
use App\Enums\TrackAStatus;
use App\Enums\TrackBDocStatus;
use App\Enums\TrackCCovernoteStatus;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Support\Audit;
use App\Support\InAppNotification;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class OrderHandoverController extends Controller
{
    public function store(Request $request, Order $order): RedirectResponse
    {
        abort_unless($order->isVisibleTo($request->user()), 404);
        $order->loadMissing('collaterals');
        abort_unless($order->status === TrackAStatus::DokumenFinalDiunggah, 422, 'Handover hanya dapat dicatat setelah dokumen final selesai divalidasi.');
        abort_unless($order->collaterals->every(fn ($collateral) => $collateral->doc_status === TrackBDocStatus::FinalDivalidasi), 422, 'Seluruh dokumen final harus tervalidasi sebelum handover.');
        $data = $request->validate([
            'order_collateral_id' => ['required', 'integer', 'exists:order_collaterals,id'],
            'receiver_name' => ['required', 'string', 'max:255'],
            'method' => ['required', Rule::in(array_map(fn (HandoverMethod $method) => $method->value, HandoverMethod::cases()))],
            'handed_over_at' => ['required', 'date'],
            'receipt' => ['nullable', 'file', 'mimes:pdf', 'max:10240'],
            'catatan' => ['nullable', 'string', 'max:2000'],
        ]);

        abort_unless($order->collaterals()->whereKey($data['order_collateral_id'])->exists(), 403);

        DB::transaction(function () use ($request, $order, $data) {
            $path = $request->file('receipt')?->store("documents/{$order->order_no}/handover", 'local');
            $handover = $order->handovers()->create([
                'order_collateral_id' => $data['order_collateral_id'],
                'receiver_name' => $data['receiver_name'],
                'method' => HandoverMethod::from($data['method']),
                'handed_over_at' => $data['handed_over_at'],
                'receipt_path' => $path,
                'catatan' => $data['catatan'] ?? null,
                'maker_id' => $request->user()->id,
                'made_at' => now(),
            ]);

            $collateral = $order->collaterals()->findOrFail($data['order_collateral_id']);
            $collateral->update(['covernote_status' => TrackCCovernoteStatus::DigantiSertifikat]);

            $allHandedOver = $order->collaterals()
                ->whereDoesntHave('handovers')
                ->doesntExist();

            if ($allHandedOver) {
                $before = $order->status;
                $order->update(['status' => TrackAStatus::DokumenFisikDiterima]);
                $order->statusHistories()->create([
                    'track' => 'A',
                    'from_status' => $before->value,
                    'to_status' => TrackAStatus::DokumenFisikDiterima->value,
                    'actor_type' => 'user',
                    'actor_id' => $request->user()->id,
                    'reason' => 'Seluruh dokumen fisik diterima.',
                ]);
            }

            Audit::record($request, 'handovers', $order, 'create', 'Handover dokumen fisik dicatat.', [
                'handover_id' => $handover->id,
                'collateral_id' => $data['order_collateral_id'],
            ]);

            InAppNotification::forNotary(
                $order,
                'Handover dokumen fisik dicatat',
                "Handover dokumen fisik order {$order->order_no} sudah dicatat BPR.",
            );
        });

        return back()->with('success', 'Handover dicatat.');
    }
}
