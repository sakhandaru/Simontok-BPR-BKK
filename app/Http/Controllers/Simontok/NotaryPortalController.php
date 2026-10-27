<?php

namespace App\Http\Controllers\Simontok;

use App\Enums\TrackAStatus;
use App\Enums\TrackBDocStatus;
use App\Enums\TrackCCovernoteStatus;
use App\Enums\OrderDocumentType;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderCollateral;
use App\Models\OrderProgress;
use App\Support\Audit;
use App\Support\InAppNotification;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class NotaryPortalController extends Controller
{
    public function index(Request $request): Response
    {
        $notaryId = $request->user()?->notary_id;
        $isMonitor = $request->user()?->roleCode() === 'it_admin';
        abort_unless($notaryId || $isMonitor, 403);

        return Inertia::render('simontok/notary/index', [
            'orders' => Order::query()
                ->with(['branch:id,code,name'])
                ->when(! $isMonitor, fn ($query) => $query->where('notary_id', $notaryId))
                ->whereNotNull('sent_to_notary_at')
                ->latest('sent_to_notary_at')
                ->paginate(15)
                ->through(fn (Order $order) => [
                    'id' => $order->id,
                    'order_no' => $order->order_no,
                    'customer_name' => $order->customer_name,
                    'no_rekening' => $order->no_rekening,
                    'status' => $order->status->label(),
                    'branch' => $order->branch?->name,
                    'sent_to_notary_at' => $order->sent_to_notary_at?->format('d M Y H:i'),
                ]),
            'isNotaryUser' => true,
            'isMonitor' => $isMonitor,
        ]);
    }

    public function show(Request $request, Order $order): Response
    {
        $this->authorizeOrder($request, $order);

        $order->load([
            'branch:id,code,name',
            'collaterals.jobType.steps:id,job_type_id,name,sort_order',
            'collaterals.checklists.documentChecklist:id,name',
            'collaterals.checklists.orderDocument:id,display_name,original_name,file_size,version,order_collateral_id',
            'collaterals.progress.user:id,name',
            'collaterals.documents.uploader:id,name',
            'collaterals.covernoteExtensions',
            'documentRequests.requester:id,name',
            'documentRequests.document:id,original_name,file_size,stored_path',
            'revisions.collateral.jobType:id,name',
            'revisions.requester:id,name',
            'progress.collateral.jobType:id,name',
            'progress.user:id,name',
            'documents.uploader:id,name',
            'documents.collateral.jobType:id,name',
            'paymentRequest.payments.uploader:id,name',
            'statusHistories' => fn ($query) => $query->latest('created_at'),
        ]);

        $paymentBlockers = $this->paymentBlockers($order);
        $canAct = $this->canAct($request);
        $initialDocumentsComplete = $order->collaterals->isNotEmpty()
            && $order->collaterals->every(fn ($collateral) => $collateral->checklists->isNotEmpty()
                && $collateral->checklists->every(fn ($checklist) => $checklist->is_checked && $checklist->order_document_id));
        $covernoteApprovedStage = in_array($order->status, [
            TrackAStatus::CovernoteDisetujui,
            TrackAStatus::DokumenValid,
            TrackAStatus::ProsesAkta,
            TrackAStatus::ProsesBpnSamsat,
            TrackAStatus::DraftDiunggah,
            TrackAStatus::MenungguValidasiBpr,
            TrackAStatus::DokumenFinalDiunggah,
            TrackAStatus::DokumenFisikDiterima,
            TrackAStatus::Selesai,
        ], true);
        $covernoteComplete = $order->collaterals->isNotEmpty()
            && $order->collaterals->every(fn ($collateral) => filled($collateral->covernote_no) && $collateral->covernote_end !== null
                && (filled($collateral->covernote_file_path) || $covernoteApprovedStage));
        $missingCovernote = ! $covernoteComplete;
        $progressComplete = $this->allProgressComplete($order);
        $canViewDocuments = ! in_array($order->status, [
            TrackAStatus::MenungguVerifikasiNotaris,
            TrackAStatus::PerbaikanDokumen,
            TrackAStatus::PerluPengalihanNotaris,
        ], true);
        $canAddProgress = $canAct && $covernoteComplete && in_array($order->status, [
            TrackAStatus::CovernoteDisetujui,
            TrackAStatus::DokumenValid,
            TrackAStatus::ProsesAkta,
            TrackAStatus::ProsesBpnSamsat,
            TrackAStatus::DraftDiunggah,
        ], true);
        $canExtendCovernote = $canAct && $order->collaterals->contains(fn ($collateral) => $collateral->covernote_end !== null)
            && ! in_array($order->status, [TrackAStatus::Draft, TrackAStatus::MenungguApproval, TrackAStatus::PerluPerbaikanOrder], true);

        return Inertia::render('simontok/notary/show', [
            'order' => $order,
            'canReview' => $canAct && in_array($order->status, [
                TrackAStatus::MenungguVerifikasiNotaris,
                TrackAStatus::PerbaikanDokumen,
            ], true),
            'initialDocumentsComplete' => $initialDocumentsComplete,
            'canViewDocuments' => $canViewDocuments,
            'canRequestInvoice' => $canAct && $order->status === TrackAStatus::DokumenFinalDiunggah && $order->paymentRequest === null && $paymentBlockers === [],
            'canAddProgress' => $canAddProgress,
            'needsCovernote' => $canAct && $missingCovernote && ! in_array($order->status, [TrackAStatus::MenungguVerifikasiNotaris, TrackAStatus::PerbaikanDokumen, TrackAStatus::PerluPengalihanNotaris], true),
            'canRequestAdditionalDocuments' => $canAct && $covernoteApprovedStage,
            'canSubmitFinal' => $canAct && $progressComplete && $order->status === TrackAStatus::DraftDiunggah && $order->documents()->where('document_type', 'final')->exists(),
            'canExtendCovernote' => $canExtendCovernote,
            'isMonitor' => $request->user()?->roleCode() === 'it_admin',
            'paymentBlockers' => $paymentBlockers,
        ]);
    }

    public function progressEvidence(Request $request, Order $order, OrderProgress $progress): BinaryFileResponse
    {
        $this->authorizeOrder($request, $order);
        abort_unless($progress->order_id === $order->id && filled($progress->evidence_path), 404);

        return response()->file(Storage::disk('local')->path($progress->evidence_path), [
            'Content-Disposition' => 'inline',
        ]);
    }

    public function acceptDocuments(Request $request, Order $order): RedirectResponse
    {
        $this->authorizeOrder($request, $order);
        abort_unless($this->canAct($request) && $order->status === TrackAStatus::MenungguVerifikasiNotaris, 422, 'Order sudah diproses atau belum tersedia untuk diterima.');
        $order->loadMissing('collaterals.checklists');
        abort_unless(
            $order->collaterals->isNotEmpty()
                && $order->collaterals->every(fn ($collateral) => $collateral->checklists->isNotEmpty()
                    && $collateral->checklists->every(fn ($checklist) => $checklist->is_checked && $checklist->order_document_id)),
            422,
            'Dokumen checklist belum lengkap. Periksa dokumen atau minta perbaikan terlebih dahulu.',
        );

        DB::transaction(function () use ($request, $order) {
            $before = $order->status;

            $order->update([
                'status' => TrackAStatus::MenungguApprovalCovernote,
                'tgl_masuk_notaris' => $order->tgl_masuk_notaris ?? today(),
            ]);
            $order->collaterals()->update(['doc_status' => TrackBDocStatus::DokumenValid]);

            $this->recordStatus($request, $order, 'A', $before->value, TrackAStatus::MenungguApprovalCovernote->value, 'Order diterima notaris; menunggu covernote dan tanggal komitmen.');

            foreach ($order->collaterals as $collateral) {
                $this->recordStatus($request, $order, 'B', TrackBDocStatus::MenungguVerifikasi->value, TrackBDocStatus::DokumenValid->value, 'Dokumen agunan valid.', $collateral);
            }

            Audit::record($request, 'notary_portal', $order, 'accept_documents', 'Notaris menerima dokumen awal.');

            InAppNotification::forOrderMaker(
                $order,
                'Dokumen awal diterima',
                "Notaris menerima dokumen awal order {$order->order_no}.",
            );
        });

        return back()->with('success', 'Dokumen awal diterima.');
    }

    public function submitCovernote(Request $request, Order $order): RedirectResponse
    {
        $this->authorizeOrder($request, $order);
        abort_unless($this->canAct($request) && (in_array($order->status, [TrackAStatus::MenungguApprovalCovernote, TrackAStatus::PerbaikanCovernote], true) || ($order->status === TrackAStatus::CovernoteDisetujui && $order->collaterals()->where(fn ($query) => $query->whereNull('covernote_no')->orWhereNull('covernote_end')->orWhereNull('covernote_file_path'))->exists())), 422, 'Covernote belum dapat diajukan pada tahap ini.');

        $data = $request->validate([
            'order_collateral_id' => ['required', 'integer', 'exists:order_collaterals,id'],
            'covernote_no' => ['required', 'string', 'max:255'],
            'covernote_start' => ['required', 'date'],
            'covernote_end' => ['required', 'date', 'after_or_equal:covernote_start'],
            'komitmen_penyelesaian' => ['required', 'date', 'after_or_equal:today'],
            'file' => ['required', 'file', 'mimes:pdf', 'max:10240'],
        ]);
        $collateral = $order->collaterals()->findOrFail($data['order_collateral_id']);
        $path = $request->file('file')->store("documents/{$order->order_no}/covernote", 'local');

        DB::transaction(function () use ($request, $order, $collateral, $data, $path) {
            $collateral->update([
                'covernote_no' => $data['covernote_no'],
                'covernote_start' => $data['covernote_start'],
                'covernote_end' => $data['covernote_end'],
                'covernote_file_path' => $path,
                'covernote_status' => TrackCCovernoteStatus::Aktif,
            ]);
            $before = $order->status;
            $order->update([
                'komitmen_penyelesaian' => $data['komitmen_penyelesaian'],
                'covernote_submitted_at' => now(),
                'status' => TrackAStatus::MenungguApprovalCovernote,
            ]);
            $this->recordStatus($request, $order, 'A', $before->value, TrackAStatus::MenungguApprovalCovernote->value, 'Notaris mengajukan covernote dan tanggal komitmen.');
            Audit::record($request, 'notary_portal', $order, 'submit_covernote', 'Notaris mengajukan covernote dan tanggal komitmen.', ['collateral_id' => $collateral->id]);
            InAppNotification::forOrderMaker($order, 'Covernote menunggu approval', "Covernote order {$order->order_no} menunggu approval Admin Legal.");
        });

        return back()->with('success', 'Covernote diajukan untuk approval Admin Legal.');
    }

    public function approveCovernote(Request $request, Order $order): RedirectResponse
    {
        $this->authorizeOrder($request, $order);
        abort_unless($request->user()->hasPermission('covernotes.approve'), 403);
        abort_unless(in_array($order->status, [TrackAStatus::MenungguApprovalCovernote, TrackAStatus::MenungguApprovalCovernoteKepalaCabang], true), 422);
        if ($order->status === TrackAStatus::MenungguApprovalCovernoteKepalaCabang) {
            abort_unless(in_array($request->user()->roleCode(), ['kepala_cabang', 'kadiv_operasional'], true), 403);
        }
        $order->update(['status' => TrackAStatus::CovernoteDisetujui, 'covernote_approved_at' => now(), 'covernote_approved_by' => $request->user()->id]);
        $this->recordStatus($request, $order, 'A', TrackAStatus::MenungguApprovalCovernote->value, TrackAStatus::CovernoteDisetujui->value, 'Covernote disetujui.');
        Audit::record($request, 'covernotes', $order, 'approve', 'Covernote disetujui.', []);
        InAppNotification::forNotary($order, 'Covernote disetujui', "Covernote order {$order->order_no} disetujui. Progres pekerjaan dapat dimulai.");
        return back()->with('success', 'Covernote disetujui.');
    }

    public function escalateCovernote(Request $request, Order $order): RedirectResponse
    {
        $this->authorizeOrder($request, $order);
        abort_unless($request->user()->roleCode() === 'legal_admin', 403);
        abort_unless($order->status === TrackAStatus::MenungguApprovalCovernote, 422);
        $order->update(['status' => TrackAStatus::MenungguApprovalCovernoteKepalaCabang]);
        $this->recordStatus($request, $order, 'A', TrackAStatus::MenungguApprovalCovernote->value, TrackAStatus::MenungguApprovalCovernoteKepalaCabang->value, 'Admin Legal meminta approval Kepala Cabang.');
        Audit::record($request, 'covernotes', $order, 'escalate', 'Approval covernote dieskalasikan ke Kepala Cabang.');
        InAppNotification::forBranchApprovers($order, 'Covernote perlu approval Kepala Cabang', "Covernote order {$order->order_no} menunggu approval Kepala Cabang.");
        return back()->with('success', 'Covernote dikirim ke Kepala Cabang untuk approval.');
    }

    public function requestCovernoteRevision(Request $request, Order $order): RedirectResponse
    {
        $this->authorizeOrder($request, $order);
        abort_unless($request->user()->hasPermission('covernotes.approve'), 403);
        abort_unless($order->status === TrackAStatus::MenungguApprovalCovernote, 422);
        $data = $request->validate(['reason' => ['required', 'string', 'max:2000']]);
        $order->update(['status' => TrackAStatus::PerbaikanCovernote]);
        $this->recordStatus($request, $order, 'A', TrackAStatus::MenungguApprovalCovernote->value, TrackAStatus::PerbaikanCovernote->value, $data['reason']);
        Audit::record($request, 'covernotes', $order, 'return_revision', 'Covernote dikembalikan untuk perbaikan.', ['reason' => $data['reason']]);
        InAppNotification::forNotary($order, 'Covernote perlu diperbaiki', "Covernote order {$order->order_no} perlu diperbaiki.");
        return back()->with('success', 'Covernote dikembalikan untuk perbaikan.');
    }

    public function requestRevision(Request $request, Order $order): RedirectResponse
    {
        $this->authorizeOrder($request, $order);
        abort(422, 'Notaris tidak perlu mengajukan revisi pada tahap penerimaan dokumen.');
        abort_unless($this->canAct($request) && $order->status === TrackAStatus::MenungguVerifikasiNotaris, 422, 'Permintaan perbaikan hanya tersedia untuk order baru.');

        $data = $request->validate([
            'order_collateral_id' => ['nullable', 'integer', 'exists:order_collaterals,id'],
            'alasan' => ['required', 'string', 'max:2000'],
        ]);

        if ($data['order_collateral_id'] ?? null) {
            abort_unless($order->collaterals()->whereKey($data['order_collateral_id'])->exists(), 403);
        }

        DB::transaction(function () use ($request, $order, $data) {
            $before = $order->status;
            $revisionNo = ((int) $order->revisions()->max('revision_no')) + 1;

            $order->revisions()->create([
                'order_collateral_id' => $data['order_collateral_id'] ?? null,
                'revision_no' => $revisionNo,
                'requested_by' => $request->user()->id,
                'alasan' => $data['alasan'],
                'status' => 'diajukan',
            ]);

            $order->update(['status' => TrackAStatus::PerbaikanDokumen]);

            if ($data['order_collateral_id'] ?? null) {
                OrderCollateral::whereKey($data['order_collateral_id'])->update(['doc_status' => TrackBDocStatus::PerluPerbaikan]);
            } else {
                $order->collaterals()->update(['doc_status' => TrackBDocStatus::PerluPerbaikan]);
            }

            $this->recordStatus($request, $order, 'A', $before->value, TrackAStatus::PerbaikanDokumen->value, 'Notaris meminta perbaikan dokumen.');

            Audit::record($request, 'notary_portal', $order, 'request_revision', 'Notaris meminta perbaikan dokumen.', [
                'revision_no' => $revisionNo,
                'reason' => $data['alasan'],
            ]);

            InAppNotification::forOrderMaker(
                $order,
                'Perbaikan dokumen diminta',
                "Notaris meminta perbaikan dokumen order {$order->order_no}.",
            );
        });

        return back()->with('success', 'Permintaan perbaikan dikirim.');
    }

    public function reject(Request $request, Order $order): RedirectResponse
    {
        $this->authorizeOrder($request, $order);
        abort_unless($this->canAct($request) && $order->status === TrackAStatus::MenungguVerifikasiNotaris, 422, 'Penolakan hanya tersedia untuk order baru.');

        $data = $request->validate([
            'reason' => ['required', 'string', 'max:2000'],
        ]);

        DB::transaction(function () use ($request, $order, $data) {
            $before = $order->status;

            $order->update(['status' => TrackAStatus::PerluPengalihanNotaris]);
            $this->recordStatus($request, $order, 'A', $before->value, TrackAStatus::PerluPengalihanNotaris->value, $data['reason']);

            Audit::record($request, 'notary_portal', $order, 'reject_order', 'Notaris menolak order.', [
                'reason' => $data['reason'],
            ]);

            InAppNotification::forOrderMaker(
                $order,
                'Order ditolak notaris',
                "Order {$order->order_no} ditolak notaris.",
            );
        });

        return back()->with('success', 'Order ditolak.');
    }

    public function storeProgress(Request $request, Order $order): RedirectResponse
    {
        $this->authorizeOrder($request, $order);
        $covernoteApprovedStage = in_array($order->status, [
            TrackAStatus::CovernoteDisetujui,
            TrackAStatus::DokumenValid,
            TrackAStatus::ProsesAkta,
            TrackAStatus::ProsesBpnSamsat,
            TrackAStatus::DraftDiunggah,
        ], true);
        abort_unless($covernoteApprovedStage && $order->collaterals()->where(fn ($query) => $query
            ->whereNull('covernote_no')
            ->orWhereNull('covernote_end'))
            ->doesntExist(), 422, 'Progres pekerjaan belum tersedia sebelum covernote disetujui.');

        $data = $request->validate([
            'order_collateral_id' => ['required', 'integer', 'exists:order_collaterals,id'],
            'status' => ['required', 'string', 'max:120'],
            'catatan' => ['required', 'string', 'max:2000'],
            'komitmen_penyelesaian' => ['nullable', 'date'],
            'evidence' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],
            'final_documents' => ['nullable', 'array'],
            'final_documents.*' => ['file', 'mimes:pdf', 'max:10240'],
        ]);

        $collateral = $order->collaterals()->with('jobType.steps')->findOrFail($data['order_collateral_id']);
        $steps = $collateral->jobType->steps->where('is_active', true)->sortBy('sort_order')->values();
        $stepNames = $steps->pluck('name')->all();
        abort_unless(in_array($data['status'], $stepNames, true), 422, 'Langkah progres tidak tersedia untuk jenis pekerjaan ini.');
        $completedNames = $collateral->progress()
            ->whereNotNull('completed_at')
            ->pluck('status')
            ->filter(fn (string $status): bool => in_array($status, $stepNames, true))
            ->unique()
            ->values()
            ->all();
        $selectedIndex = array_search($data['status'], $stepNames, true);
        abort_unless($selectedIndex !== false, 422, 'Langkah progres tidak tersedia untuk jenis pekerjaan ini.');
        $isFinalStep = $selectedIndex === count($stepNames) - 1;
        $completedCount = count($completedNames);
        $isNextStep = $selectedIndex === $completedCount;
        $isExistingStep = in_array($data['status'], $completedNames, true);
        $isFinalReupload = $isFinalStep && $completedCount >= count($stepNames) - 1;
        abort_unless($isNextStep || $isExistingStep || $isFinalReupload, 422, 'Selesaikan langkah sebelumnya terlebih dahulu.');
        $finalDocuments = $request->file('final_documents', []);
        if ($isFinalStep) {
            validator(
                ['final_documents' => $finalDocuments],
                ['final_documents' => ['required', 'array', 'min:1'], 'final_documents.*' => ['file', 'mimes:pdf', 'max:10240']],
                [
                    'final_documents.required' => 'Minimal satu dokumen final wajib diunggah pada langkah terakhir.',
                    'final_documents.min' => 'Minimal satu dokumen final wajib diunggah pada langkah terakhir.',
                ],
            )->validate();
        }
        $evidencePath = $request->file('evidence')?->store("documents/{$order->order_no}/progress", 'local');

        DB::transaction(function () use ($request, $order, $data, $evidencePath, $collateral, $finalDocuments, $isFinalStep) {
            $existingFinalProgress = $collateral->progress()->where('status', $data['status'])->latest('id')->first();
            $progressData = [
                ...collect($data)->except(['evidence', 'final_documents'])->all(),
                'order_collateral_id' => $collateral->id,
                'completed_at' => now(),
                'evidence_path' => $evidencePath,
                'created_by' => $request->user()->id,
            ];
            if ($existingFinalProgress) {
                $existingFinalProgress->update($progressData);
            } else {
                $order->progress()->create($progressData);
            }

            if ($isFinalStep && $finalDocuments !== []) {
                $documentIds = [];
                foreach ($finalDocuments as $finalDocument) {
                    $path = $finalDocument->store("documents/{$order->order_no}/final", 'local');
                    $document = $order->documents()->create([
                        'order_collateral_id' => $collateral->id,
                        'document_type' => OrderDocumentType::Final,
                        'display_name' => null,
                        'version' => ((int) $order->documents()->where('order_collateral_id', $collateral->id)->where('document_type', OrderDocumentType::Final)->max('version')) + 1,
                        'original_name' => $finalDocument->getClientOriginalName(),
                        'stored_name' => basename($path),
                        'stored_path' => $path,
                        'mime_type' => $finalDocument->getMimeType(),
                        'file_size' => $finalDocument->getSize(),
                        'uploaded_by' => $request->user()->id,
                    ]);
                    $documentIds[] = $document->id;
                }
                $collateral->update(['doc_status' => TrackBDocStatus::FinalDiunggah]);
                $allFinalDocumentsUploaded = $order->collaterals()
                    ->where('doc_status', '!=', TrackBDocStatus::FinalDiunggah->value)
                    ->doesntExist();
                $before = $order->status;
                if ($allFinalDocumentsUploaded) {
                    $order->update([
                        'status' => TrackAStatus::MenungguValidasiBpr,
                        'final_submitted_at' => now(),
                    ]);
                    $order->statusHistories()->create([
                        'track' => 'B',
                        'from_status' => $before->value,
                        'to_status' => TrackAStatus::MenungguValidasiBpr->value,
                        'actor_type' => 'notary',
                        'actor_id' => $request->user()->id,
                        'reason' => 'Seluruh dokumen final otomatis diajukan untuk approval Admin Legal.',
                    ]);
                    InAppNotification::forInternalUsers(
                        'Dokumen final menunggu approval',
                        "Dokumen final order {$order->order_no} menunggu approval Admin Legal.",
                        "/orders/{$order->id}",
                    );
                } else {
                    $order->update(['status' => TrackAStatus::DraftDiunggah]);
                }
                Audit::record($request, 'documents', $order, 'upload_final', 'Dokumen final diunggah pada langkah progres terakhir.', ['document_ids' => $documentIds]);
            }

            $before = $order->status;
            if (in_array($order->status, [TrackAStatus::CovernoteDisetujui, TrackAStatus::DokumenValid], true)) {
                $order->update(['status' => TrackAStatus::ProsesAkta]);
                $this->recordStatus($request, $order, 'A', $before->value, TrackAStatus::ProsesAkta->value, 'Notaris mulai mencatat progres pekerjaan.');
            }

            Audit::record($request, 'notary_portal', $order, 'store_progress', 'Notaris menambahkan progres pekerjaan.', [
                'progress' => $data,
            ]);
        });

        return back()->with('success', 'Progres ditambahkan.');
    }

    private function notaryId(Request $request): int
    {
        abort_unless($request->user()?->notary_id, 403);

        return (int) $request->user()->notary_id;
    }

    private function authorizeOrder(Request $request, Order $order): void
    {
        $user = $request->user();

        if ($user?->roleCode() === 'notaris') {
            abort_unless($order->notary_id === $this->notaryId($request), 403);
        } elseif ($user?->roleCode() !== 'it_admin') {
            abort_unless($order->isVisibleTo($user), 403);
        }

        abort_unless($order->sent_to_notary_at !== null, 404);
    }

    private function canAct(Request $request): bool
    {
        return in_array($request->user()?->roleCode(), ['notaris', 'it_admin'], true);
    }

    private function recordStatus(Request $request, Order $order, string $track, ?string $from, string $to, string $reason, ?OrderCollateral $collateral = null): void
    {
        $order->statusHistories()->create([
            'order_collateral_id' => $collateral?->id,
            'track' => $track,
            'from_status' => $from,
            'to_status' => $to,
            'actor_type' => 'notary',
            'actor_id' => $request->user()->id,
            'reason' => $reason,
        ]);
    }

    private function paymentBlockers(Order $order): array
    {
        $blockers = [];

        if ($order->collaterals->contains(fn ($collateral) => $collateral->doc_status !== TrackBDocStatus::FinalDivalidasi)) {
            $blockers[] = 'Seluruh dokumen final harus tervalidasi oleh BPR.';
        }

        if ($order->collaterals->contains(fn ($collateral) => $collateral->covernote_status === TrackCCovernoteStatus::Kedaluwarsa)) {
            $blockers[] = 'Covernote kedaluwarsa harus diperpanjang.';
        }

        if ($order->risk_flag) {
            $blockers[] = 'Order masih ditandai risiko tinggi.';
        }

        return $blockers;
    }

    private function allProgressComplete(Order $order): bool
    {
        return $order->collaterals->every(function ($collateral) {
            $required = $collateral->jobType?->steps->where('is_active', true)->count() ?? 0;
            $completed = $collateral->progress->whereNotNull('completed_at')->pluck('status')->unique()->count();

            return $required > 0 && $completed >= $required;
        });
    }
}
