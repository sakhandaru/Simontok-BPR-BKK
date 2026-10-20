<?php

namespace App\Http\Controllers\Simontok;

use App\Enums\OrderDocumentType;
use App\Http\Controllers\Controller;
use App\Models\DocumentRequest;
use App\Models\Order;
use App\Support\Audit;
use App\Support\InAppNotification;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DocumentRequestController extends Controller
{
    public function store(Request $request, Order $order): RedirectResponse
    {
        abort_unless($request->user()?->notary_id && $order->notary_id === $request->user()->notary_id, 403);
        $data = $request->validate([
            'order_collateral_id' => ['nullable', 'integer', 'exists:order_collaterals,id'],
            'name' => ['required', 'string', 'max:255'],
            'reason' => ['required', 'string', 'max:2000'],
        ]);
        if ($data['order_collateral_id'] ?? null) abort_unless($order->collaterals()->whereKey($data['order_collateral_id'])->exists(), 403);
        abort_unless(! $order->documentRequests()->where('name', $data['name'])->whereIn('status', ['diminta', 'diunggah'])->exists(), 422, 'Permintaan dokumen yang sama masih terbuka.');
        $documentRequest = $order->documentRequests()->create([...$data, 'requested_by' => $request->user()->id, 'status' => 'diminta']);
        Audit::record($request, 'document_requests', $order, 'request', 'Notaris meminta dokumen susulan.', ['request_id' => $documentRequest->id]);
        InAppNotification::forOrderMaker($order, 'Permintaan dokumen susulan', "Notaris meminta dokumen {$data['name']} untuk order {$order->order_no}.");
        return back()->with('success', 'Permintaan dokumen susulan dikirim ke Admin Legal.');
    }

    public function fulfill(Request $request, Order $order, DocumentRequest $documentRequest): RedirectResponse
    {
        abort_unless(! $request->user()?->notary_id && $order->isVisibleTo($request->user()), 403);
        abort_unless($documentRequest->order_id === $order->id && $documentRequest->status === 'diminta', 422);
        $data = $request->validate(['file' => ['required', 'file', 'mimes:pdf', 'max:10240']]);
        DB::transaction(function () use ($request, $order, $documentRequest, $data) {
            $file = $data['file'];
            $path = $file->store("documents/{$order->order_no}/susulan", 'local');
            $document = $order->documents()->create([
                'order_collateral_id' => $documentRequest->order_collateral_id,
                'document_type' => OrderDocumentType::Lainnya,
                'display_name' => $documentRequest->name,
                'version' => 1,
                'original_name' => $file->getClientOriginalName(),
                'stored_name' => basename($path),
                'stored_path' => $path,
                'mime_type' => $file->getMimeType(),
                'file_size' => $file->getSize(),
                'uploaded_by' => $request->user()->id,
            ]);
            $documentRequest->update(['status' => 'diunggah', 'fulfilled_by' => $request->user()->id, 'order_document_id' => $document->id]);
            Audit::record($request, 'document_requests', $order, 'fulfill', 'Admin Legal mengunggah dokumen susulan.', ['request_id' => $documentRequest->id, 'document_id' => $document->id]);
            InAppNotification::forNotary($order, 'Dokumen susulan tersedia', "Dokumen {$documentRequest->name} untuk order {$order->order_no} sudah diunggah Admin Legal.");
        });
        return back()->with('success', 'Dokumen susulan berhasil diunggah.');
    }
}
