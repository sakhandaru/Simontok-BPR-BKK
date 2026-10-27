<?php

namespace App\Http\Controllers\Simontok;

use App\Enums\TrackAStatus;
use App\Enums\TrackBDocStatus;
use App\Enums\TrackCCovernoteStatus;
use App\Enums\TrackDPaymentStatus;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\PaymentRequest;
use App\Support\Audit;
use App\Support\InAppNotification;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PaymentRequestController extends Controller
{
    public function store(Request $request, Order $order): RedirectResponse
    {
        $this->authorizeNotary($request, $order);
        $this->ensurePaymentPrerequisites($order);

        if ($order->paymentRequest()->exists()) {
            throw ValidationException::withMessages([
                'invoice' => 'Invoice untuk order ini sudah pernah diajukan.',
            ]);
        }

        $data = $request->validate([
            'invoice_no' => ['required', 'string', 'max:50'],
            'nominal' => ['required', 'numeric', 'min:1'],
            'skema_pembayaran' => ['required', 'string', 'max:30'],
            'catatan_notaris' => ['nullable', 'string', 'max:2000'],
        ]);

        if ($order->nominal !== null && (float) $data['nominal'] !== (float) $order->nominal) {
            throw ValidationException::withMessages(['nominal' => 'Nominal invoice harus sama dengan nominal jasa pada order. Ajukan perubahan nominal terlebih dahulu.']);
        }

        if (filled($order->skema_pembayaran) && $data['skema_pembayaran'] !== $order->skema_pembayaran) {
            throw ValidationException::withMessages(['skema_pembayaran' => 'Skema invoice harus sama dengan skema pembayaran pada order.']);
        }

        DB::transaction(function () use ($request, $order, $data) {
            $paymentRequest = $order->paymentRequest()->create([
                ...$data,
                'status' => TrackDPaymentStatus::Diajukan,
                'requested_at' => now(),
            ]);

            $this->recordStatus($request, $order, null, TrackDPaymentStatus::Diajukan->value, 'Invoice diajukan notaris.');

            Audit::record($request, 'payments', $paymentRequest, 'request_invoice', 'Notaris mengajukan invoice.', [
                'after' => $paymentRequest->only(['invoice_no', 'nominal', 'skema_pembayaran', 'status']),
            ]);

            InAppNotification::forInternalUsers(
                'Invoice menunggu verifikasi',
                "Invoice order {$order->order_no} diajukan notaris.",
                "/orders/{$order->id}",
            );
        });

        return back()->with('success', 'Invoice diajukan.');
    }

    public function verify(Request $request, Order $order, PaymentRequest $paymentRequest): RedirectResponse
    {
        $this->authorizeInternal($request, $order, 'payments.verify');
        $this->ensureBelongsToOrder($order, $paymentRequest);
        $this->ensurePaymentPrerequisites($order);
        abort_unless($paymentRequest->status === TrackDPaymentStatus::Diajukan, 422);

        $data = $request->validate([
            'decision' => ['required', Rule::in(['verify', 'reject'])],
            'catatan_verifikasi' => ['nullable', 'string', 'max:2000'],
        ]);

        DB::transaction(function () use ($request, $order, $paymentRequest, $data) {
            $before = $paymentRequest->status;
            $status = $data['decision'] === 'verify'
                ? TrackDPaymentStatus::DiverifikasiAdmin
                : TrackDPaymentStatus::DitolakAdmin;

            $paymentRequest->update([
                'status' => $status,
                'verified_by' => $request->user()->id,
                'verified_at' => now(),
                'catatan_verifikasi' => $data['catatan_verifikasi'] ?? null,
                'rejected_by' => $data['decision'] === 'reject' ? $request->user()->id : null,
                'rejected_at' => $data['decision'] === 'reject' ? now() : null,
            ]);

            $this->recordStatus($request, $order, $before->value, $status->value, $status === TrackDPaymentStatus::DiverifikasiAdmin ? 'Invoice diverifikasi admin.' : 'Invoice ditolak admin.');

            Audit::record($request, 'payments', $paymentRequest, $data['decision'] === 'verify' ? 'verify_invoice' : 'reject_invoice_admin', 'Admin memproses verifikasi invoice.', [
                'before' => ['status' => $before->value],
                'after' => $paymentRequest->fresh()->only(['status', 'verified_by', 'verified_at', 'catatan_verifikasi']),
            ]);

            if ($status === TrackDPaymentStatus::DitolakAdmin) {
                InAppNotification::forNotary($order, 'Invoice ditolak admin', "Invoice order {$order->order_no} ditolak admin.");
            } else {
                InAppNotification::forInternalUsers('Invoice siap dibayar', "Invoice order {$order->order_no} sudah diverifikasi Admin Legal dan siap dicatat pembayarannya.", "/orders/{$order->id}");
            }
        });

        return back()->with('success', $data['decision'] === 'verify' ? 'Invoice diverifikasi.' : 'Invoice ditolak admin.');
    }

    public function approve(Request $request, Order $order, PaymentRequest $paymentRequest): RedirectResponse
    {
        $this->authorizeInternal($request, $order, 'payments.approve');
        $this->ensureBelongsToOrder($order, $paymentRequest);
        abort_unless($paymentRequest->status === TrackDPaymentStatus::DiverifikasiAdmin, 422);

        $data = $request->validate([
            'decision' => ['required', Rule::in(['approve', 'reject'])],
            'catatan_approver' => ['nullable', 'string', 'max:2000'],
        ]);

        DB::transaction(function () use ($request, $order, $paymentRequest, $data) {
            $before = $paymentRequest->status;
            $status = $data['decision'] === 'approve'
                ? TrackDPaymentStatus::Disetujui
                : TrackDPaymentStatus::DitolakManajemen;

            $paymentRequest->update([
                'status' => $status,
                'approved_by' => $data['decision'] === 'approve' ? $request->user()->id : null,
                'approved_at' => $data['decision'] === 'approve' ? now() : null,
                'rejected_by' => $data['decision'] === 'reject' ? $request->user()->id : null,
                'rejected_at' => $data['decision'] === 'reject' ? now() : null,
                'catatan_approver' => $data['catatan_approver'] ?? null,
            ]);

            $this->recordStatus($request, $order, $before->value, $status->value, $status === TrackDPaymentStatus::Disetujui ? 'Pembayaran disetujui manajemen.' : 'Pembayaran ditolak manajemen.');

            Audit::record($request, 'payments', $paymentRequest, $data['decision'] === 'approve' ? 'approve_payment' : 'reject_payment_management', 'Manajemen memproses approval pembayaran.', [
                'before' => ['status' => $before->value],
                'after' => $paymentRequest->fresh()->only(['status', 'approved_by', 'approved_at', 'rejected_by', 'rejected_at', 'catatan_approver']),
            ]);

            InAppNotification::forNotary(
                $order,
                $status === TrackDPaymentStatus::Disetujui ? 'Pembayaran disetujui' : 'Pembayaran ditolak manajemen',
                $status === TrackDPaymentStatus::Disetujui ? "Pembayaran order {$order->order_no} disetujui." : "Pembayaran order {$order->order_no} ditolak manajemen.",
            );
        });

        return back()->with('success', $data['decision'] === 'approve' ? 'Pembayaran disetujui.' : 'Pembayaran ditolak manajemen.');
    }

    public function pay(Request $request, Order $order, PaymentRequest $paymentRequest): RedirectResponse
    {
        $this->authorizeInternal($request, $order, 'payments.pay');
        $this->ensureBelongsToOrder($order, $paymentRequest);
        abort_unless($order->status === TrackAStatus::DokumenFisikDiterima, 422, 'Pembayaran hanya dapat dicatat setelah handover dokumen fisik selesai.');
        abort_unless($paymentRequest->status === TrackDPaymentStatus::Disetujui, 422);

        $data = $request->validate([
            'paid_at' => ['required', 'date'],
            'nominal' => ['required', 'numeric', 'min:1'],
            'bukti' => ['nullable', 'file', 'mimes:pdf', 'max:10240'],
            'catatan' => ['nullable', 'string', 'max:2000'],
        ]);

        DB::transaction(function () use ($request, $order, $paymentRequest, $data) {
            $path = $request->file('bukti')?->store("payments/{$order->id}", 'local');
            $before = $paymentRequest->status;

            $paymentRequest->payments()->create([
                'order_id' => $order->id,
                'paid_at' => $data['paid_at'],
                'nominal' => $data['nominal'],
                'bukti_path' => $path,
                'uploaded_by' => $request->user()->id,
                'catatan' => $data['catatan'] ?? null,
            ]);

            $paymentRequest->update([
                'status' => TrackDPaymentStatus::Dibayar,
                'paid_at' => $data['paid_at'],
            ]);

            $this->recordStatus($request, $order, $before->value, TrackDPaymentStatus::Dibayar->value, 'Bukti pembayaran diunggah.');

            Audit::record($request, 'payments', $paymentRequest, 'upload_payment_proof', 'Bukti pembayaran diunggah.', [
                'payment' => collect($data)->except('bukti')->all(),
            ]);

            InAppNotification::forNotary($order, 'Bukti pembayaran tersedia', "Bukti pembayaran order {$order->order_no} sudah dicatat.");
        });

        return back()->with('success', 'Bukti pembayaran dicatat.');
    }

    public function downloadProof(Request $request, Order $order, PaymentRequest $paymentRequest, int $payment): mixed
    {
        $this->ensureBelongsToOrder($order, $paymentRequest);
        $this->authorizePaymentAccess($request, $order);
        $record = $paymentRequest->payments()->whereKey($payment)->firstOrFail();

        abort_if(! $record->bukti_path || ! Storage::disk('local')->exists($record->bukti_path), 404);

        Audit::record($request, 'payments', $record, 'download_payment_proof', 'Bukti pembayaran diunduh.');

        return Storage::disk('local')->download($record->bukti_path);
    }

    private function authorizeNotary(Request $request, Order $order): void
    {
        abort_unless($request->user()?->notary_id && $order->notary_id === $request->user()->notary_id, 403);
        abort_unless($order->sent_to_notary_at !== null, 404);
    }

    private function authorizeInternal(Request $request, Order $order, string $permission): void
    {
        abort_if($request->user()?->notary_id, 403);
        abort_unless($request->user() && $order->isVisibleTo($request->user()), 404);
        abort_unless($request->user()->hasPermission($permission), 403);
    }

    private function authorizePaymentAccess(Request $request, Order $order): void
    {
        $user = $request->user();

        if ($user?->notary_id) {
            abort_unless($order->notary_id === $user->notary_id, 403);
            return;
        }

        abort_unless($user && $order->isVisibleTo($user), 404);
    }

    private function ensureBelongsToOrder(Order $order, PaymentRequest $paymentRequest): void
    {
        abort_unless($paymentRequest->order_id === $order->id, 404);
    }

    private function ensurePaymentPrerequisites(Order $order): void
    {
        $order->loadMissing('collaterals');

        if (! in_array($order->status, [TrackAStatus::DokumenFinalDiunggah, TrackAStatus::DokumenFisikDiterima], true)) {
            throw ValidationException::withMessages([
                'invoice' => 'Invoice baru tersedia setelah seluruh dokumen final disetujui Admin Legal.',
            ]);
        }

        $notReady = $order->collaterals->contains(fn ($collateral) => $collateral->doc_status !== TrackBDocStatus::FinalDivalidasi);
        $expired = $order->collaterals->contains(fn ($collateral) => $collateral->covernote_status === TrackCCovernoteStatus::Kedaluwarsa);

        if ($notReady || $expired || $order->risk_flag) {
            throw ValidationException::withMessages([
                'invoice' => 'Invoice hanya dapat diajukan jika seluruh dokumen final sudah divalidasi dan tidak ada covernote kedaluwarsa.',
            ]);
        }
    }

    private function recordStatus(Request $request, Order $order, ?string $from, string $to, string $reason): void
    {
        $order->statusHistories()->create([
            'track' => 'D',
            'from_status' => $from,
            'to_status' => $to,
            'actor_type' => $request->user()?->notary_id ? 'notary' : 'user',
            'actor_id' => $request->user()->id,
            'reason' => $reason,
        ]);
    }
}
