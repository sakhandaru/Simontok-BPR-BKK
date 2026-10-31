<?php

namespace App\Http\Controllers\Simontok;

use App\Enums\TrackCCovernoteStatus;
use App\Enums\TrackAStatus;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderCollateral;
use App\Support\Audit;
use App\Support\DocumentArchiveService;
use App\Support\InAppNotification;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class CovernoteController extends Controller
{
    public function preview(Request $request, Order $order, OrderCollateral $collateral)
    {
        abort_unless($order->isVisibleTo($request->user()), 404);
        $filePath = $order->covernote_file_path ?: $collateral->covernote_file_path;
        abort_unless($collateral->order_id === $order->id && filled($filePath), 404);

        $disk = Storage::disk('local');
        abort_unless($disk->exists($filePath), 404);

        return response()->file($disk->path($filePath), [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="covernote-'.$order->order_no.'-'.$collateral->id.'.pdf"',
        ]);
    }

    public function previewExtension(Request $request, Order $order, OrderCollateral $collateral, \App\Models\CovernoteExtension $extension)
    {
        abort_unless($order->isVisibleTo($request->user()), 404);
        abort_unless($collateral->order_id === $order->id && $extension->order_collateral_id === $collateral->id && filled($extension->file_path), 404);

        $disk = Storage::disk('local');
        abort_unless($disk->exists($extension->file_path), 404);

        return response()->file($disk->path($extension->file_path), [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="perpanjangan-covernote-'.$order->order_no.'-'.$extension->id.'.pdf"',
        ]);
    }

    public function extend(Request $request, Order $order, OrderCollateral $collateral): RedirectResponse
    {
        $user = $request->user();
        $isAssignedNotary = $user?->notary_id && $order->notary_id === $user->notary_id;
        abort_unless($isAssignedNotary, 404);
        abort_unless($collateral->order_id === $order->id, 404);
        abort_unless($order->sent_to_notary_at !== null, 422, 'Covernote belum tersedia sebelum order dikirim ke notaris.');
        abort_unless(! in_array($order->status, [TrackAStatus::Draft, TrackAStatus::MenungguApproval, TrackAStatus::PerluPerbaikanOrder], true), 422, 'Covernote belum tersedia pada tahap order ini.');
        abort_unless($order->covernote_end !== null, 422, 'Tanggal jatuh tempo covernote belum tersedia.');
        abort_unless(! $order->collaterals()->whereHas('covernoteExtensions', fn ($query) => $query->where('status', 'menunggu_approval'))->exists(), 422, 'Masih ada pengajuan perpanjangan yang menunggu approval.');

        $data = $request->validate([
            'new_end' => ['required', 'date', 'after:'.$order->covernote_end->toDateString()],
            'catatan' => ['nullable', 'string', 'max:2000'],
            'file' => ['nullable', 'file', 'mimes:pdf', 'max:10240'],
        ]);

        DB::transaction(function () use ($request, $order, $collateral, $data) {
            $oldEnd = $order->covernote_end;
            $path = $request->file('file')?->store("documents/{$order->order_no}/covernote", 'local');

            $extension = $collateral->covernoteExtensions()->create([
                'old_end' => $oldEnd,
                'new_end' => $data['new_end'],
                'extended_by' => $request->user()->id,
                'catatan' => $data['catatan'] ?? null,
                'file_path' => $path,
                'status' => 'menunggu_approval',
                'created_at' => now(),
            ]);

            Audit::record($request, 'covernotes', $order, 'request_extension', 'Notaris mengajukan perpanjangan covernote untuk approval Admin Legal.', [
                'extension_id' => $extension->id,
                'collateral_id' => $collateral->id,
                'old_end' => $oldEnd?->toDateString(),
                'new_end' => $data['new_end'],
            ]);
            InAppNotification::forOrderMaker($order, 'Perpanjangan covernote menunggu approval', "Perpanjangan covernote order {$order->order_no} menunggu approval Admin Legal.");
        });

        return back()->with('success', 'Perpanjangan covernote diajukan untuk approval Admin Legal.');
    }

    public function approveExtension(Request $request, Order $order, OrderCollateral $collateral, \App\Models\CovernoteExtension $extension): RedirectResponse
    {
        abort_unless($order->isVisibleTo($request->user()), 404);
        abort_unless($collateral->order_id === $order->id && $extension->order_collateral_id === $collateral->id, 404);
        abort_unless($request->user()->hasPermission('covernotes.approve') && $extension->status === 'menunggu_approval', 422);

        DB::transaction(function () use ($request, $order, $collateral, $extension) {
            $extension->update(['status' => 'disetujui', 'approved_by' => $request->user()->id, 'approved_at' => now()]);
            $order->update([
                'covernote_end' => $extension->new_end,
                'covernote_file_path' => $extension->file_path ?: $order->covernote_file_path,
            ]);
            $order->collaterals()->update([
                'covernote_end' => $extension->new_end,
                'covernote_file_path' => $extension->file_path ?: $order->covernote_file_path,
                'covernote_status' => TrackCCovernoteStatus::Aktif,
            ]);
            $collateral->increment('extension_count');
            if ($extension->file_path) {
                DocumentArchiveService::archiveFile($request, OrderCollateral::class, $collateral->id, 'covernote', 'covernote', 'covernote', 'Covernote perpanjangan', basename($extension->file_path), $extension->file_path, Storage::disk('local')->size($extension->file_path), [
                    'order_id' => $order->id,
                    'collateral_id' => $collateral->id,
                    'extension_id' => $extension->id,
                    'covernote_end' => $extension->new_end?->toDateString(),
                ], 'Perpanjangan covernote disetujui.');
            }
            $order->update(['risk_flag' => $order->collaterals()->where('covernote_status', TrackCCovernoteStatus::Kedaluwarsa->value)->exists()]);
            Audit::record($request, 'covernotes', $order, 'approve_extension', 'Perpanjangan covernote disetujui Admin Legal.', ['extension_id' => $extension->id]);
            InAppNotification::forNotary($order, 'Perpanjangan covernote disetujui', "Perpanjangan covernote order {$order->order_no} disetujui Admin Legal.");
        });

        return back()->with('success', 'Perpanjangan covernote disetujui.');
    }

    public function rejectExtension(Request $request, Order $order, OrderCollateral $collateral, \App\Models\CovernoteExtension $extension): RedirectResponse
    {
        abort_unless($order->isVisibleTo($request->user()), 404);
        abort_unless($collateral->order_id === $order->id && $extension->order_collateral_id === $collateral->id, 404);
        abort_unless($request->user()->hasPermission('covernotes.approve') && $extension->status === 'menunggu_approval', 422);
        $data = $request->validate(['reason' => ['required', 'string', 'max:2000']]);
        $extension->update(['status' => 'ditolak', 'approved_by' => $request->user()->id, 'approved_at' => now(), 'rejection_reason' => $data['reason']]);
        Audit::record($request, 'covernotes', $order, 'reject_extension', 'Perpanjangan covernote dikembalikan untuk perbaikan.', ['extension_id' => $extension->id, 'reason' => $data['reason']]);
        InAppNotification::forNotary($order, 'Perpanjangan covernote perlu diperbaiki', "Perpanjangan covernote order {$order->order_no} dikembalikan Admin Legal.");
        return back()->with('success', 'Perpanjangan covernote dikembalikan untuk perbaikan.');
    }

    public function refreshRisk(Request $request, Order $order): RedirectResponse
    {
        abort_unless($order->isVisibleTo($request->user()), 404);
        DB::transaction(function () use ($request, $order) {
            $today = today();

            foreach ($order->collaterals as $collateral) {
                if (! $collateral->covernote_end || $collateral->covernote_status === TrackCCovernoteStatus::DigantiSertifikat) {
                    continue;
                }

                $status = match (true) {
                    $collateral->covernote_end->lt($today) => TrackCCovernoteStatus::Kedaluwarsa,
                    $collateral->covernote_end->diffInDays($today) <= 7 => TrackCCovernoteStatus::MendekatiJatuhTempo,
                    default => TrackCCovernoteStatus::Aktif,
                };

                $collateral->update(['covernote_status' => $status]);
            }

            $order->update(['risk_flag' => $order->collaterals()->where('covernote_status', TrackCCovernoteStatus::Kedaluwarsa->value)->exists()]);

            Audit::record($request, 'covernotes', $order, 'refresh_risk', 'Status covernote diperbarui.');
        });

        return back()->with('success', 'Status covernote diperbarui.');
    }
}
