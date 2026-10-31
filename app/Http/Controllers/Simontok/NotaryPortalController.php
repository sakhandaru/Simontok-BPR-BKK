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
use App\Models\DocumentArchive;
use App\Models\OrderStepFee;
use App\Models\Notary;
use App\Support\Audit;
use App\Support\DocumentArchiveService;
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
        $isMonitor = in_array($request->user()?->roleCode(), ['it_admin', 'admin_legal_pusat'], true);
        abort_unless($notaryId || $isMonitor, 403);
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'string', 'max:50'],
        ]);
        $status = TrackAStatus::tryFrom($filters['status'] ?? '');

        return Inertia::render('simontok/notary/index', [
            'orders' => Order::query()
                ->with(['branch:id,code,name'])
                ->when(! $isMonitor, fn ($query) => $query->where('notary_id', $notaryId))
                ->whereNotNull('sent_to_notary_at')
                ->when($filters['search'] ?? null, fn ($query, string $search) => $query->where(fn ($query) => $query->where('order_no', 'like', "%{$search}%")->orWhere('customer_name', 'like', "%{$search}%")->orWhere('no_rekening', 'like', "%{$search}%")))
                ->when($status, fn ($query) => $query->where('status', $status->value))
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
            'filters' => [
                'search' => $filters['search'] ?? '',
                'status' => $status?->value ?? '',
            ],
            'statusOptions' => array_map(fn (TrackAStatus $status) => ['value' => $status->value, 'label' => $status->label()], TrackAStatus::cases()),
            'isNotaryUser' => (bool) $notaryId,
            'isMonitor' => $isMonitor,
        ]);
    }

    public function show(Request $request, Order $order): Response|RedirectResponse
    {
        $this->authorizeOrder($request, $order);

        if (in_array($order->status, [
            TrackAStatus::PersiapanPekerjaan,
            TrackAStatus::MenungguApprovalCovernote,
            TrackAStatus::PerbaikanCovernote,
        ], true)) {
            return to_route('notary.orders.transition', $order);
        }

        $order->load([
            'branch:id,code,name',
            'notary:id,name,agreement_type,agreement_file_path,agreement_file_name',
            'notaryAgreement:id,original_name,version,file_path,file_size,metadata,created_at',
            'stepFees' => fn ($query) => $query->orderBy('order_collateral_id')->orderBy('sort_order')->orderBy('id'),
            'collaterals.jobType.steps:id,job_type_id,name,sort_order',
            'collaterals.jobs.jobType:id,name,code',
            'collaterals.checklists.documentChecklist:id,name,is_active,is_required',
            'collaterals.checklists.orderDocument:id,display_name,original_name,file_size,version,order_collateral_id,uploaded_by,created_at,mime_type',
            'collaterals.checklists.orderDocument.uploader:id,name',
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
        if (! $order->notary_agreement_acknowledged_at) {
            $paymentBlockers[] = 'PKS notaris harus dibaca dan disetujui sebelum invoice diajukan.';
        }
        $canAct = $this->canAct($request);
        $agreement = $order->notaryAgreement ?: DocumentArchive::query()
            ->where('documentable_type', Notary::class)
            ->where('documentable_id', $order->notary_id)
            ->where('document_type', 'notary_agreement')
            ->where('status', 'active')
            ->latest('version')
            ->first();
        $initialDocumentsComplete = $order->collaterals->isNotEmpty()
            && $order->collaterals->every(fn ($collateral) => $collateral->checklists->filter(fn ($checklist) => $checklist->documentChecklist?->is_active !== false && $checklist->documentChecklist?->is_required !== false)->isNotEmpty()
                && $collateral->checklists->filter(fn ($checklist) => $checklist->documentChecklist?->is_active !== false && $checklist->documentChecklist?->is_required !== false)->every(fn ($checklist) => $checklist->is_checked && $checklist->order_document_id));
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
        $covernoteComplete = filled($order->covernote_no) && $order->covernote_end !== null
            && (filled($order->covernote_file_path) || $covernoteApprovedStage);
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
            'canRequestInvoice' => $canAct && (bool) $order->notary_agreement_acknowledged_at && in_array($order->status, [TrackAStatus::DokumenFinalDiunggah, TrackAStatus::DokumenFisikDiterima], true) && $order->paymentRequest === null && $paymentBlockers === [],
            'canAddProgress' => $canAddProgress,
            'canRequestAdditionalDocuments' => $canAct && $covernoteApprovedStage,
            'canSubmitFinal' => $canAct && $progressComplete && $order->status === TrackAStatus::DraftDiunggah && $order->documents()->where('document_type', 'final')->exists(),
            'canExtendCovernote' => $canExtendCovernote,
            'isMonitor' => in_array($request->user()?->roleCode(), ['it_admin', 'admin_legal_pusat'], true),
            'paymentBlockers' => $paymentBlockers,
            'agreement' => $agreement ? [
                'id' => $agreement->id,
                'version' => $agreement->version,
                'original_name' => $agreement->original_name,
                'file_size' => $agreement->file_size,
                'agreement_type' => data_get($agreement->metadata, 'agreement_type'),
                'pks_no' => data_get($agreement->metadata, 'pks_no'),
                'pks_start' => data_get($agreement->metadata, 'pks_start'),
                'pks_end' => data_get($agreement->metadata, 'pks_end'),
                'acknowledged' => (bool) $order->notary_agreement_acknowledged_at,
                'acknowledged_at' => $order->notary_agreement_acknowledged_at?->format('d M Y H:i'),
            ] : null,
            'serviceFee' => [
                'main' => (float) ($order->nominal ?? 0),
                'steps' => (float) $order->stepFees->sum('amount'),
                'total' => (float) ($order->nominal ?? 0) + (float) $order->stepFees->sum('amount'),
            ],
            'stepFees' => $order->stepFees->map(fn (OrderStepFee $fee) => [
                'id' => $fee->id,
                'order_collateral_id' => $fee->order_collateral_id,
                'job_type_step_id' => $fee->job_type_step_id,
                'step_name' => $fee->step_name,
                'amount' => (float) $fee->amount,
                'sort_order' => $fee->sort_order,
            ])->values()->all(),
        ]);
    }

    public function transition(Request $request, Order $order): Response|RedirectResponse
    {
        $this->authorizeOrder($request, $order);

        if (! in_array($order->status, [
            TrackAStatus::PersiapanPekerjaan,
            TrackAStatus::MenungguApprovalCovernote,
            TrackAStatus::PerbaikanCovernote,
        ], true)) {
            return to_route('notary.orders.show', $order);
        }

        $order->load([
            'branch:id,code,name',
            'notary:id,name,agreement_type,agreement_file_path,agreement_file_name',
            'notaryAgreement:id,original_name,version,file_path,file_size,metadata,created_at',
            'stepFees' => fn ($query) => $query->orderBy('order_collateral_id')->orderBy('sort_order')->orderBy('id'),
            'collaterals.jobType.steps:id,job_type_id,name,sort_order,is_active',
            'collaterals.jobs.jobType:id,name,code',
            'statusHistories' => fn ($query) => $query->latest('created_at'),
        ]);

        $agreement = $order->notaryAgreement ?: DocumentArchive::query()
            ->where('documentable_type', Notary::class)
            ->where('documentable_id', $order->notary_id)
            ->where('document_type', 'notary_agreement')
            ->where('status', 'active')
            ->latest('version')
            ->first();
        $stepFees = $order->stepFees;
        $covernoteComplete = filled($order->covernote_no) && $order->covernote_start !== null && $order->covernote_end !== null && filled($order->covernote_file_path);
        $revision = $order->statusHistories->first(fn ($history) => $history->to_status === TrackAStatus::PerbaikanCovernote->value);

        return Inertia::render('simontok/notary/transition', [
            'order' => $order,
            'agreement' => $agreement ? [
                'id' => $agreement->id,
                'version' => $agreement->version,
                'original_name' => $agreement->original_name,
                'file_size' => $agreement->file_size,
                'agreement_type' => data_get($agreement->metadata, 'agreement_type'),
                'pks_no' => data_get($agreement->metadata, 'pks_no'),
                'pks_start' => data_get($agreement->metadata, 'pks_start'),
                'pks_end' => data_get($agreement->metadata, 'pks_end'),
                'acknowledged' => (bool) $order->notary_agreement_acknowledged_at,
                'acknowledged_at' => $order->notary_agreement_acknowledged_at?->format('d M Y H:i'),
            ] : null,
            'stepFees' => $stepFees->map(fn (OrderStepFee $fee) => [
                'id' => $fee->id,
                'order_collateral_id' => $fee->order_collateral_id,
                'job_type_step_id' => $fee->job_type_step_id,
                'step_name' => $fee->step_name,
                'amount' => (float) $fee->amount,
                'sort_order' => $fee->sort_order,
            ])->values()->all(),
            'serviceFee' => [
                'main' => (float) ($order->nominal ?? 0),
                'steps' => (float) $order->stepFees->sum('amount'),
                'total' => (float) ($order->nominal ?? 0) + (float) $order->stepFees->sum('amount'),
            ],
            'canEditTransition' => $request->user()?->roleCode() === 'notaris'
                && in_array($order->status, [TrackAStatus::PersiapanPekerjaan, TrackAStatus::PerbaikanCovernote], true),
            'revisionReason' => $revision?->reason,
        ]);
    }

    public function agreementPreview(Request $request, Order $order): BinaryFileResponse
    {
        $this->authorizeOrder($request, $order);
        $agreement = $order->notaryAgreement ?: DocumentArchive::query()
            ->where('documentable_type', Notary::class)
            ->where('documentable_id', $order->notary_id)
            ->where('document_type', 'notary_agreement')
            ->where('status', 'active')
            ->latest('version')
            ->firstOrFail();
        abort_unless(Storage::disk($agreement->storage_disk)->exists($agreement->file_path), 404);

        return response()->file(Storage::disk($agreement->storage_disk)->path($agreement->file_path), [
            'Content-Disposition' => 'inline; filename="'.addslashes($agreement->original_name).'"',
        ]);
    }

    public function acknowledgeAgreement(Request $request, Order $order): RedirectResponse
    {
        $this->authorizeOrder($request, $order);
        abort_unless($request->user()?->roleCode() === 'notaris' && $this->canAct($request), 403);
        $agreement = DocumentArchive::query()
            ->where('documentable_type', Notary::class)
            ->where('documentable_id', $order->notary_id)
            ->where('document_type', 'notary_agreement')
            ->where('status', 'active')
            ->latest('version')
            ->firstOrFail();

        $order->update([
            'notary_agreement_archive_id' => $order->notary_agreement_archive_id ?: $agreement->id,
            'notary_agreement_acknowledged_at' => now(),
            'notary_agreement_acknowledged_by' => $request->user()->id,
        ]);
        Audit::record($request, 'notary_portal', $order, 'acknowledge_agreement', 'Notaris menyetujui PKS yang berlaku sebelum mengisi biaya langkah pekerjaan.', [
            'agreement_archive_id' => $agreement->id,
            'agreement_version' => $agreement->version,
        ]);

        return back()->with('success', 'PKS disetujui. Langkah dan biaya pekerjaan sekarang dapat diisi.');
    }

    public function saveStepFees(Request $request, Order $order): RedirectResponse
    {
        $this->authorizeOrder($request, $order);
        abort_unless($request->user()?->roleCode() === 'notaris' && $this->canAct($request), 403);
        abort_unless(in_array($order->status, [TrackAStatus::PersiapanPekerjaan, TrackAStatus::PerbaikanCovernote], true), 422, 'Biaya langkah hanya dapat diubah pada halaman persiapan pekerjaan.');
        abort_unless($order->notary_agreement_acknowledged_at, 422, 'Baca dan setujui PKS terlebih dahulu.');
        $data = $request->validate([
            'fees' => ['required', 'array', 'min:1'],
            'fees.*.id' => ['nullable', 'integer'],
            'fees.*.order_collateral_id' => ['required', 'integer'],
            'fees.*.job_type_step_id' => ['nullable', 'integer'],
            'fees.*.step_name' => ['required', 'string', 'max:255'],
            'fees.*.amount' => ['required', 'numeric', 'min:0'],
        ]);

        DB::transaction(function () use ($request, $order, $data): void {
            $retainedIds = [];
            foreach ($data['fees'] as $index => $fee) {
                $collateral = $order->collaterals()->with('jobType.steps')->findOrFail($fee['order_collateral_id']);
                $stepId = $fee['job_type_step_id'] ?? null;
                if ($stepId !== null) {
                    $step = $collateral->jobType->steps->firstWhere('id', (int) $stepId);
                    abort_unless($step && $step->is_active, 422, 'Langkah pekerjaan bawaan tidak valid untuk agunan ini.');
                }
                $attributes = [
                    'order_id' => $order->id,
                    'order_collateral_id' => $collateral->id,
                    'job_type_step_id' => $stepId,
                    'step_name' => trim($fee['step_name']),
                    'amount' => $fee['amount'],
                    'sort_order' => $index,
                    'entered_by' => $request->user()->id,
                ];
                if (! empty($fee['id'])) {
                    $saved = $order->stepFees()->findOrFail($fee['id']);
                    $saved->update($attributes);
                } else {
                    $saved = $stepId !== null
                        ? $order->stepFees()->where('order_collateral_id', $collateral->id)->where('job_type_step_id', $stepId)->first()
                        : null;
                    if ($saved) {
                        $saved->update($attributes);
                    } else {
                        $saved = $order->stepFees()->create($attributes);
                    }
                }
                $retainedIds[] = $saved->id;
            }
            $order->stepFees()->whereNotIn('id', $retainedIds)->delete();
            Audit::record($request, 'payments', $order, 'update_step_fees', 'Notaris memperbarui biaya tambahan per langkah pekerjaan.', [
                'step_fee_total' => $order->stepFees()->sum('amount'),
                'service_fee_total' => (float) ($order->nominal ?? 0) + (float) $order->stepFees()->sum('amount'),
            ]);
        });

        return back()->with('success', 'Draft biaya langkah pekerjaan disimpan.');
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
        $order->loadMissing('collaterals.checklists.documentChecklist');
        abort_unless(
            $order->collaterals->isNotEmpty()
                && $order->collaterals->every(fn ($collateral) => $collateral->checklists->filter(fn ($checklist) => $checklist->documentChecklist?->is_active !== false && $checklist->documentChecklist?->is_required !== false)->isNotEmpty()
                    && $collateral->checklists->filter(fn ($checklist) => $checklist->documentChecklist?->is_active !== false && $checklist->documentChecklist?->is_required !== false)->every(fn ($checklist) => $checklist->is_checked && $checklist->order_document_id)),
            422,
            'Dokumen checklist belum lengkap. Periksa dokumen atau minta perbaikan terlebih dahulu.',
        );

        DB::transaction(function () use ($request, $order) {
            $before = $order->status;

            $order->update([
                'status' => TrackAStatus::PersiapanPekerjaan,
                'tgl_masuk_notaris' => $order->tgl_masuk_notaris ?? today(),
            ]);
            $order->collaterals()->update(['doc_status' => TrackBDocStatus::DokumenValid]);

            $this->recordStatus($request, $order, 'A', $before->value, TrackAStatus::PersiapanPekerjaan->value, 'Order diterima notaris; notaris melanjutkan ke persiapan biaya dan covernote.');

            foreach ($order->collaterals as $collateral) {
                $this->recordStatus($request, $order, 'B', TrackBDocStatus::MenungguVerifikasi->value, TrackBDocStatus::DokumenValid->value, 'Dokumen agunan valid.', $collateral);
            }

            Audit::record($request, 'notary_portal', $order, 'accept_documents', 'Notaris menerima dokumen awal.');

            InAppNotification::forOrderMaker(
                $order,
                'Order diterima notaris',
                "Order {$order->order_no} masuk ke persiapan biaya dan covernote.",
            );
        });

        return to_route('notary.orders.transition', $order)->with('success', 'Dokumen awal diterima. Lengkapi biaya langkah dan covernote.');
    }

    public function submitCovernote(Request $request, Order $order): RedirectResponse
    {
        $this->authorizeOrder($request, $order);
        abort_unless($request->user()?->roleCode() === 'notaris' && $this->canAct($request), 403);
        abort_unless(in_array($order->status, [TrackAStatus::PersiapanPekerjaan, TrackAStatus::PerbaikanCovernote], true), 422, 'Covernote hanya dapat diubah pada halaman persiapan pekerjaan.');

        $data = $request->validate([
            'covernote_no' => ['required', 'string', 'max:255'],
            'covernote_start' => ['required', 'date'],
            'covernote_end' => ['required', 'date', 'after_or_equal:covernote_start'],
            'komitmen_penyelesaian' => ['required', 'date', 'after_or_equal:today'],
            'file' => ['required', 'file', 'mimes:pdf', 'max:10240'],
        ]);
        $path = $request->file('file')->store("documents/{$order->order_no}/covernote", 'local');

        DB::transaction(function () use ($request, $order, $data, $path) {
            $order->update([
                'covernote_no' => $data['covernote_no'],
                'covernote_start' => $data['covernote_start'],
                'covernote_end' => $data['covernote_end'],
                'covernote_file_path' => $path,
                'komitmen_penyelesaian' => $data['komitmen_penyelesaian'],
            ]);
            DocumentArchiveService::archiveFile($request, Order::class, $order->id, 'covernote', 'covernote', 'covernote', 'Covernote', basename($path), $path, $request->file('file')->getSize(), [
                'order_id' => $order->id,
                'covernote_no' => $data['covernote_no'],
                'covernote_start' => $data['covernote_start'],
                'covernote_end' => $data['covernote_end'],
            ], 'Draft covernote disimpan.');
            Audit::record($request, 'notary_portal', $order, 'save_covernote_draft', 'Notaris menyimpan satu draft covernote untuk seluruh order.');
        });

        return back()->with('success', 'Draft covernote disimpan. Ajukan setelah semua covernote dan biaya langkah lengkap.');
    }

    public function submitTransition(Request $request, Order $order): RedirectResponse
    {
        $this->authorizeOrder($request, $order);
        abort_unless($request->user()?->roleCode() === 'notaris' && $this->canAct($request), 403);
        abort_unless(in_array($order->status, [TrackAStatus::PersiapanPekerjaan, TrackAStatus::PerbaikanCovernote], true), 422, 'Pengajuan biaya dan covernote belum tersedia pada tahap ini.');
        abort_unless($order->notary_agreement_acknowledged_at, 422, 'Baca dan setujui PKS terlebih dahulu.');

        $order->load(['collaterals.jobType.steps', 'stepFees']);
        abort_unless($order->collaterals->every(fn ($collateral) => $order->stepFees->contains(fn (OrderStepFee $fee) => $fee->order_collateral_id === $collateral->id)), 422, 'Tambahkan minimal satu langkah untuk setiap agunan.');
        abort_unless($order->stepFees->every(fn (OrderStepFee $fee) => filled($fee->step_name)), 422, 'Nama langkah pekerjaan belum lengkap.');
        abort_unless(filled($order->covernote_no) && $order->covernote_start !== null && $order->covernote_end !== null && filled($order->covernote_file_path), 422, 'Simpan covernote order terlebih dahulu.');
        abort_unless($order->komitmen_penyelesaian !== null, 422, 'Isi tanggal komitmen penyelesaian pada covernote terlebih dahulu.');

        DB::transaction(function () use ($request, $order): void {
            $before = $order->status;
            $order->update([
                'status' => TrackAStatus::MenungguApprovalCovernote,
                'covernote_submitted_at' => now(),
            ]);
            $this->recordStatus($request, $order, 'A', $before->value, TrackAStatus::MenungguApprovalCovernote->value, 'Notaris mengajukan biaya per langkah dan covernote untuk approval Admin Legal.');
            Audit::record($request, 'notary_portal', $order, 'submit_transition', 'Notaris mengajukan biaya per langkah dan covernote secara bersamaan.', [
                'step_fee_total' => $order->stepFees()->sum('amount'),
                'service_fee_total' => (float) ($order->nominal ?? 0) + (float) $order->stepFees()->sum('amount'),
            ]);
            InAppNotification::forOrderMaker($order, 'Biaya & covernote menunggu approval', "Biaya dan covernote order {$order->order_no} menunggu approval Admin Legal.");
        });

        return to_route('notary.orders.transition', $order)->with('success', 'Biaya dan covernote diajukan untuk approval Admin Legal.');
    }

    public function approveCovernote(Request $request, Order $order): RedirectResponse
    {
        $this->authorizeOrder($request, $order);
        abort_unless($request->user()->hasPermission('covernotes.approve'), 403);
        abort_unless(in_array($order->status, [TrackAStatus::MenungguApprovalCovernote, TrackAStatus::MenungguApprovalCovernoteKepalaCabang], true), 422);
        if ($order->status === TrackAStatus::MenungguApprovalCovernoteKepalaCabang) {
            abort_unless(in_array($request->user()->roleCode(), ['kabid_ops_cabang', 'kadiv_ops_pusat'], true), 403);
        }
        $order->load(['collaterals.jobType.steps', 'stepFees']);
        abort_unless($order->collaterals->every(fn ($collateral) => $order->stepFees->contains(fn (OrderStepFee $fee) => $fee->order_collateral_id === $collateral->id)), 422, 'Biaya belum lengkap untuk setiap agunan.');
        abort_unless($order->stepFees->every(fn (OrderStepFee $fee) => filled($fee->step_name)), 422, 'Nama langkah pekerjaan belum lengkap.');
        abort_unless(filled($order->covernote_no) && $order->covernote_start !== null && $order->covernote_end !== null && filled($order->covernote_file_path), 422, 'Covernote order belum lengkap.');
        $before = $order->status;
        $order->update(['status' => TrackAStatus::CovernoteDisetujui, 'covernote_approved_at' => now(), 'covernote_approved_by' => $request->user()->id]);
        $order->collaterals()->update([
            'covernote_no' => $order->covernote_no,
            'covernote_start' => $order->covernote_start,
            'covernote_end' => $order->covernote_end,
            'covernote_file_path' => $order->covernote_file_path,
            'covernote_status' => TrackCCovernoteStatus::Aktif,
        ]);
        $this->recordStatus($request, $order, 'A', $before->value, TrackAStatus::CovernoteDisetujui->value, 'Biaya per langkah dan covernote disetujui Admin Legal.');
        Audit::record($request, 'covernotes', $order, 'approve', 'Biaya per langkah dan covernote disetujui dalam satu approval.', [
            'step_fee_total' => $order->stepFees()->sum('amount'),
            'service_fee_total' => (float) ($order->nominal ?? 0) + (float) $order->stepFees()->sum('amount'),
        ]);
        InAppNotification::forNotary($order, 'Biaya & covernote disetujui', "Biaya dan covernote order {$order->order_no} disetujui. Detail order dapat dilanjutkan.");
        return back()->with('success', 'Biaya dan covernote disetujui.');
    }

    public function escalateCovernote(Request $request, Order $order): RedirectResponse
    {
        $this->authorizeOrder($request, $order);
        abort_unless(in_array($request->user()->roleCode(), ['admin_legal_pusat', 'admin_legal_cabang'], true), 403);
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
        abort_unless(in_array($order->status, [TrackAStatus::MenungguApprovalCovernote, TrackAStatus::MenungguApprovalCovernoteKepalaCabang], true), 422);
        $data = $request->validate(['reason' => ['required', 'string', 'max:2000']]);
        $before = $order->status;
        $order->update(['status' => TrackAStatus::PerbaikanCovernote]);
        $this->recordStatus($request, $order, 'A', $before->value, TrackAStatus::PerbaikanCovernote->value, $data['reason']);
        Audit::record($request, 'covernotes', $order, 'return_revision', 'Biaya per langkah dan covernote dikembalikan untuk perbaikan.', ['reason' => $data['reason']]);
        InAppNotification::forNotary($order, 'Biaya & covernote perlu diperbaiki', "Biaya dan covernote order {$order->order_no} perlu diperbaiki.");
        return back()->with('success', 'Biaya dan covernote dikembalikan untuk perbaikan.');
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
        $steps = $collateral->stepFees;
        if ($steps->isEmpty()) {
            $steps = $collateral->jobType->steps->where('is_active', true)->sortBy('sort_order')->values();
        }
        $stepNames = $steps->pluck($steps->first() instanceof OrderStepFee ? 'step_name' : 'name')->all();
        abort_unless(in_array($data['status'], $stepNames, true), 422, 'Langkah progres tidak tersedia untuk order ini.');
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
                    DocumentArchiveService::archiveOrderDocument($request, $document);
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
            $required = $collateral->stepFees()->count();
            if ($required === 0) {
                $required = $collateral->jobType?->steps->where('is_active', true)->count() ?? 0;
            }
            $completed = $collateral->progress->whereNotNull('completed_at')->pluck('status')->unique()->count();

            return $required > 0 && $completed >= $required;
        });
    }
}
