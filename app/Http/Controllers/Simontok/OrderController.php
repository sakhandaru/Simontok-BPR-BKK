<?php

namespace App\Http\Controllers\Simontok;

use App\Enums\TrackAStatus;
use App\Enums\TrackBDocStatus;
use App\Enums\TrackCCovernoteStatus;
use App\Enums\TrackDPaymentStatus;
use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\DocumentChecklist;
use App\Models\JobType;
use App\Models\Notary;
use App\Models\Order;
use App\Models\SlaPolicy;
use App\Support\Audit;
use App\Support\InAppNotification;
use App\Support\OrderStages;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class OrderController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'string', Rule::in(array_map(fn (TrackAStatus $status) => $status->value, TrackAStatus::cases()))],
            'risk' => ['nullable', Rule::in(['1'])],
            'sla' => ['nullable', Rule::in(['due_soon', 'overdue'])],
            'payment' => ['nullable', Rule::in(['none', 'requested', 'verified', 'approved', 'paid'])],
            'active' => ['nullable', Rule::in(['1'])],
            'stage' => ['nullable', 'string', Rule::in(OrderStages::keys())],
            'age' => ['nullable', Rule::in(['0-7', '8-14', '15-30', 'gt-30'])],
            'covernote' => ['nullable', Rule::in(['expired', 'due7', 'due14', 'due30'])],
            'handover' => ['nullable', Rule::in(['pending'])],
            'doc' => ['nullable', 'string', Rule::in(array_map(fn (TrackBDocStatus $status) => $status->value, TrackBDocStatus::cases()))],
        ]);
        $closedStatuses = OrderStages::closedStatuses();

        $visibleOrders = Order::query()->visibleTo($request->user());

        return Inertia::render('simontok/orders/index', [
            'orders' => Order::query()
                ->visibleTo($request->user())
                ->with(['branch:id,code,name', 'notary:id,name', 'paymentRequest:id,order_id,status'])
                ->withCount(['collaterals', 'documents', 'handovers'])
                ->when($filters['search'] ?? null, function ($query, string $search) {
                    $query->where(function ($query) use ($search) {
                        $query->where('order_no', 'like', "%{$search}%")
                            ->orWhere('customer_name', 'like', "%{$search}%")
                            ->orWhere('no_rekening', 'like', "%{$search}%");
                    });
                })
                ->when($filters['status'] ?? null, fn ($query, string $status) => $query->where('status', $status))
                ->when($filters['risk'] ?? null, fn ($query) => $query->where('risk_flag', true))
                ->when(($filters['sla'] ?? null) === 'due_soon', fn ($query) => $query->whereHas('collaterals', fn ($query) => $query->whereBetween('sla_due_at', [now(), now()->addDays(7)])))
                ->when(($filters['sla'] ?? null) === 'overdue', fn ($query) => $query->whereHas('collaterals', fn ($query) => $query->whereNotNull('sla_due_at')->where('sla_due_at', '<', now())))
                ->when(($filters['payment'] ?? null) === 'none', fn ($query) => $query->doesntHave('paymentRequest'))
                ->when(($filters['payment'] ?? null) === 'requested', fn ($query) => $query->whereHas('paymentRequest', fn ($query) => $query->where('status', 'diajukan')))
                ->when(($filters['payment'] ?? null) === 'verified', fn ($query) => $query->whereHas('paymentRequest', fn ($query) => $query->where('status', 'diverifikasi_admin')))
                ->when(($filters['payment'] ?? null) === 'approved', fn ($query) => $query->whereHas('paymentRequest', fn ($query) => $query->where('status', 'disetujui')))
                ->when(($filters['payment'] ?? null) === 'paid', fn ($query) => $query->whereHas('paymentRequest', fn ($query) => $query->where('status', 'dibayar')))
                ->when($filters['active'] ?? null, fn ($query) => $query->whereNotIn('status', $closedStatuses))
                ->when($filters['stage'] ?? null, fn ($query, string $stage) => $query->whereIn('status', OrderStages::statuses($stage)))
                // Rentang umur mengikuti matriks aging dashboard: umur = hari penuh sejak order dibuat.
                ->when(($filters['age'] ?? null) === '0-7', fn ($query) => $query->where('created_at', '>', now()->subDays(8)))
                ->when(($filters['age'] ?? null) === '8-14', fn ($query) => $query->where('created_at', '<=', now()->subDays(8))->where('created_at', '>', now()->subDays(15)))
                ->when(($filters['age'] ?? null) === '15-30', fn ($query) => $query->where('created_at', '<=', now()->subDays(15))->where('created_at', '>', now()->subDays(31)))
                ->when(($filters['age'] ?? null) === 'gt-30', fn ($query) => $query->where('created_at', '<=', now()->subDays(31)))
                // Filter covernote/handover dibatasi order aktif agar jumlah daftar sama dengan angka panel dashboard.
                ->when(($filters['covernote'] ?? null) === 'expired', fn ($query) => $query->whereHas('collaterals', fn ($query) => $query->where('covernote_status', TrackCCovernoteStatus::Kedaluwarsa->value))->whereNotIn('status', $closedStatuses))
                ->when(($filters['covernote'] ?? null) === 'due7', fn ($query) => $query->whereHas('collaterals', fn ($query) => $query->whereBetween('covernote_end', [now(), now()->addDays(7)]))->whereNotIn('status', $closedStatuses))
                ->when(($filters['covernote'] ?? null) === 'due14', fn ($query) => $query->whereHas('collaterals', fn ($query) => $query->whereBetween('covernote_end', [now()->addDays(8), now()->addDays(14)]))->whereNotIn('status', $closedStatuses))
                ->when(($filters['covernote'] ?? null) === 'due30', fn ($query) => $query->whereHas('collaterals', fn ($query) => $query->whereBetween('covernote_end', [now()->addDays(15), now()->addDays(30)]))->whereNotIn('status', $closedStatuses))
                ->when(($filters['handover'] ?? null) === 'pending', fn ($query) => $query->whereHas('collaterals', fn ($query) => $query->where('doc_status', TrackBDocStatus::FinalDivalidasi->value)->whereDoesntHave('handovers'))->whereNotIn('status', $closedStatuses))
                ->when($filters['doc'] ?? null, fn ($query, string $docStatus) => $query->whereHas('collaterals', fn ($query) => $query->where('doc_status', $docStatus)))
                ->latest()
                ->paginate(15)
                ->withQueryString()
                ->through(fn (Order $order) => [
                    'id' => $order->id,
                    'order_no' => $order->order_no,
                    'customer_name' => $order->customer_name,
                    'no_rekening' => $order->no_rekening,
                    'status' => $order->status->label(),
                    'branch' => $order->branch?->name,
                    'notary' => $order->notary?->name,
                    'created_at' => $order->created_at?->format('d M Y'),
                    'sent_to_notary_at' => $order->sent_to_notary_at?->format('d M Y H:i'),
                    'risk_flag' => $order->risk_flag,
                    'payment_status' => $order->paymentRequest?->status?->label() ?? 'Belum invoice',
                    'collaterals_count' => $order->collaterals_count,
                    'documents_count' => $order->documents_count,
                    'handovers_count' => $order->handovers_count,
                ]),
            'filters' => [
                'search' => $filters['search'] ?? '',
                'status' => $filters['status'] ?? '',
                'risk' => $filters['risk'] ?? '',
                'sla' => $filters['sla'] ?? '',
                'payment' => $filters['payment'] ?? '',
                'active' => $filters['active'] ?? '',
                'stage' => $filters['stage'] ?? '',
                'age' => $filters['age'] ?? '',
                'covernote' => $filters['covernote'] ?? '',
                'handover' => $filters['handover'] ?? '',
                'doc' => $filters['doc'] ?? '',
            ],
            'statuses' => collect(TrackAStatus::cases())->map(fn (TrackAStatus $status) => [
                'value' => $status->value,
                'label' => $status->label(),
            ]),
            'stages' => collect(OrderStages::groups())
                ->map(fn (array $group, string $key) => ['value' => $key, 'label' => $group['label']])
                ->values()
                ->all(),
            'orderSummary' => [
                'total' => (clone $visibleOrders)->count(),
                'active' => (clone $visibleOrders)->whereNotIn('status', $closedStatuses)->count(),
                'risk' => (clone $visibleOrders)->where('risk_flag', true)->count(),
                'invoice_queue' => (clone $visibleOrders)->whereHas('paymentRequest', fn ($query) => $query->whereIn('status', ['diajukan', 'diverifikasi_admin', 'disetujui']))->count(),
            ],
            'createOptions' => [
                'branches' => Branch::where('is_active', true)->orderBy('name')->get(['id', 'code', 'name']),
                'notaries' => Notary::availableForOrders()->whereHas('users', fn ($query) => $query->where('is_active', true))->orderBy('name')->get(['id', 'name']),
                'jobTypes' => JobType::where('is_active', true)->orderBy('name')->get(['id', 'code', 'name']),
            ],
        ]);
    }

    public function create(Request $request): Response
    {
        $branchId = $this->userBranchScope($request);

        return Inertia::render('simontok/orders/create', [
            'branches' => Branch::where('is_active', true)->when($branchId, fn ($query) => $query->whereKey($branchId))->orderBy('name')->get(['id', 'code', 'name']),
            'notaries' => Notary::availableForOrders()
                ->whereHas('users', fn ($query) => $query->where('is_active', true))
                ->when($branchId, fn ($query) => $query->whereHas('branches', fn ($query) => $query->whereKey($branchId)->where('branch_notary.is_active', true)))
                ->orderBy('name')->get(['id', 'name']),
            'jobTypes' => JobType::where('is_active', true)->orderBy('name')->get(['id', 'code', 'name']),
            'slaPolicies' => $this->slaPolicies(),
            'defaultBranchId' => $branchId,
            'branchLocked' => $branchId !== null,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validatedDraftData($request);
        $this->authorizeBranchAssignment($request, (int) $data['branch_id']);

        $order = DB::transaction(function () use ($data, $request) {
            $order = Order::create([
                ...collect($data)->except('collaterals')->all(),
                'order_no' => $this->makeOrderNo(),
                'status' => TrackAStatus::Draft,
                'created_by' => $request->user()->id,
            ]);

            foreach ($data['collaterals'] as $collateralData) {
                if (! ($collateralData['job_type_id'] ?? null)) {
                    continue;
                }
                $sla = $this->resolveSla($collateralData, (int) $data['branch_id'], $data['tgl_masuk_notaris'] ?? null);
                $collateral = $order->collaterals()->create([
                    ...collect($collateralData)->except(['id', 'sla_days', 'sla_override_reason'])->all(),
                    'doc_status' => TrackBDocStatus::MenungguVerifikasi,
                    'covernote_status' => null,
                    ...$sla,
                ]);

                $this->seedOrderChecklists($order, $collateral, (int) $collateralData['job_type_id']);
            }

            $order->statusHistories()->create([
                'track' => 'A',
                'to_status' => TrackAStatus::Draft->value,
                'actor_type' => 'user',
                'actor_id' => $request->user()->id,
                'reason' => 'Draft order dibuat oleh admin legal.',
            ]);

            Audit::record($request, 'orders', $order, 'create', 'Order dibuat.', [
                'after' => $order->only(['order_no', 'branch_id', 'notary_id', 'customer_name', 'no_rekening', 'status']),
            ]);

            return $order;
        });

        return to_route('orders.show', $order)->with('success', 'Order dibuat.');
    }

    public function show(Request $request, Order $order): Response
    {
        $this->authorizeVisibleOrder($request, $order);
        $order->load([
            'branch:id,code,name',
            'notary:id,name,email,phone',
            'maker:id,name',
            'collaterals.jobType:id,code,name',
            'collaterals.checklists.documentChecklist:id,name',
            'collaterals.checklists.orderDocument:id,display_name,original_name,file_size,version,order_collateral_id',
            'collaterals.documents.uploader:id,name',
            'collaterals.handovers',
            'collaterals.covernoteExtensions',
            'collaterals.progress.user:id,name',
            'progress.collateral.jobType:id,name',
            'progress.user:id,name',
            'documentRequests.requester:id,name',
            'documentRequests.document:id,original_name,file_size,stored_path',
            'documents.uploader:id,name',
            'documents.collateral.jobType:id,name',
            'handovers.collateral.jobType:id,name',
            'paymentRequest.verifier:id,name',
            'paymentRequest.approver:id,name',
            'paymentRequest.rejecter:id,name',
            'paymentRequest.payments.uploader:id,name',
            'statusHistories.actor.jobPosition.role',
            'statusHistories.actor.notary:id,name',
            'statusHistories' => fn ($query) => $query->latest('created_at'),
        ]);

        $paymentBlockers = $this->paymentBlockers($order);

        return Inertia::render('simontok/orders/show', [
            'order' => $order,
            'canEdit' => $request->user()->hasPermission('orders.manage') && $this->canEditDraft($order),
            'canSubmitApproval' => $request->user()->hasPermission('orders.manage') && $this->canEditDraft($order),
            'canApproveOrder' => $request->user()->hasPermission('orders.approve') && $order->status === TrackAStatus::MenungguApproval,
            'branches' => Branch::where('is_active', true)->orderBy('name')->get(['id', 'code', 'name']),
            'notaries' => Notary::availableForOrders()->whereHas('users', fn ($query) => $query->where('is_active', true))->orderBy('name')->get(['id', 'name']),
            'jobTypes' => JobType::where('is_active', true)->orderBy('name')->get(['id', 'code', 'name']),
            'slaPolicies' => $this->slaPolicies((int) $order->branch_id),
            'paymentBlockers' => $paymentBlockers,
            'canVerifyPayment' => $request->user()->hasPermission('payments.verify') && $order->paymentRequest?->status?->value === 'diajukan' && $paymentBlockers === [],
            'canApprovePayment' => false,
            'canUploadPaymentProof' => $request->user()->hasPermission('payments.pay') && $order->paymentRequest?->status?->value === 'disetujui' && $order->status === TrackAStatus::DokumenFisikDiterima,
            'canValidateDocuments' => $request->user()->hasPermission('documents.validate'),
            'canManageHandovers' => $request->user()->hasPermission('handovers.manage') && $order->status === TrackAStatus::DokumenFinalDiunggah,
            'canManageOrder' => $request->user()->hasPermission('orders.manage'),
            'canCancelOrder' => $request->user()->hasPermission('orders.cancel') && ! in_array($order->status, [TrackAStatus::Selesai, TrackAStatus::Dibatalkan], true),
            'canCloseOrder' => $request->user()->hasPermission('orders.manage') && $order->status === TrackAStatus::DokumenFisikDiterima,
            'canManageCovernote' => $request->user()->hasPermission('covernotes.manage'),
            'canApproveCovernote' => $request->user()->hasPermission('covernotes.approve')
                && ($order->status === TrackAStatus::MenungguApprovalCovernote
                    || ($order->status === TrackAStatus::MenungguApprovalCovernoteKepalaCabang
                        && in_array($request->user()->roleCode(), ['kepala_cabang', 'kadiv_operasional'], true))),
            'canApproveCovernoteExtension' => $request->user()->hasPermission('covernotes.approve')
                && $order->collaterals->contains(fn ($collateral) => $collateral->covernoteExtensions->contains('status', 'menunggu_approval')),
            'canEscalateCovernote' => $request->user()->roleCode() === 'legal_admin' && $order->status === TrackAStatus::MenungguApprovalCovernote,
            'documentTypes' => [
                ['value' => 'dokumen_awal', 'label' => 'Dokumen awal'],
                ['value' => 'draft', 'label' => 'Draft'],
                ['value' => 'resi_bpn', 'label' => 'Resi BPN'],
                ['value' => 'final', 'label' => 'Dokumen final'],
                ['value' => 'lainnya', 'label' => 'Lainnya'],
            ],
            'handoverMethods' => [
                ['value' => 'kurir', 'label' => 'Kurir'],
                ['value' => 'titip', 'label' => 'Titip'],
                ['value' => 'ambil_sendiri', 'label' => 'Ambil sendiri'],
            ],
        ]);
    }

    public function edit(Request $request, Order $order): Response
    {
        $this->authorizeVisibleOrder($request, $order);
        abort_unless($this->canEditDraft($order), 403);
        $order->load('collaterals');

        return Inertia::render('simontok/orders/edit', [
            'order' => $order,
            'branches' => Branch::where('is_active', true)->orderBy('name')->get(['id', 'code', 'name']),
            'notaries' => Notary::availableForOrders()->orderBy('name')->get(['id', 'name']),
            'jobTypes' => JobType::where('is_active', true)->orderBy('name')->get(['id', 'code', 'name']),
            'slaPolicies' => $this->slaPolicies((int) $order->branch_id),
        ]);
    }

    public function update(Request $request, Order $order): RedirectResponse
    {
        $this->authorizeVisibleOrder($request, $order);
        abort_unless($this->canEditDraft($order), 403);

        $data = $this->validatedDraftData($request);
        $this->authorizeBranchAssignment($request, (int) $data['branch_id']);

        DB::transaction(function () use ($data, $request, $order) {
            $before = $order->load('collaterals')->toArray();

            $order->update(collect($data)->except('collaterals')->all());

            $submittedCollateralIds = collect($data['collaterals'])
                ->pluck('id')
                ->filter()
                ->map(fn ($id) => (int) $id);
            $order->collaterals()
                ->whereNotIn('id', $submittedCollateralIds)
                ->whereDoesntHave('documents')
                ->whereDoesntHave('progress')
                ->whereDoesntHave('handovers')
                ->delete();

            foreach ($data['collaterals'] as $collateralData) {
                if (! ($collateralData['job_type_id'] ?? null)) {
                    continue;
                }
                $collateral = ! empty($collateralData['id'])
                    ? $order->collaterals()->findOrFail($collateralData['id'])
                    : $order->collaterals()->create([
                        ...collect($collateralData)->except(['id', 'sla_days', 'sla_override_reason'])->all(),
                        'doc_status' => TrackBDocStatus::MenungguVerifikasi,
                        'covernote_status' => null,
                        ...$this->resolveSla($collateralData, (int) $data['branch_id'], $data['tgl_masuk_notaris'] ?? null),
                    ]);

                $collateral->update([
                    ...collect($collateralData)->except(['id', 'sla_days', 'sla_override_reason'])->all(),
                    ...$this->resolveSla($collateralData, (int) $data['branch_id'], $data['tgl_masuk_notaris'] ?? null),
                ]);
                if (! $collateral->checklists()->exists()) {
                    $this->seedOrderChecklists($order, $collateral, (int) $collateralData['job_type_id']);
                }
            }

            Audit::record($request, 'orders', $order, 'update', 'Draft order diperbarui.', [
                'before' => $before,
                'after' => $order->fresh('collaterals')->toArray(),
            ]);
        });

        $response = to_route('orders.show', $order);

        return $request->boolean('silent_save') || $request->header('X-Silent-Save') === 'true'
            ? $response
            : $response->with('success', 'Order diperbarui.');
    }

    public function send(Request $request, Order $order): RedirectResponse
    {
        $this->authorizeVisibleOrder($request, $order);
        abort_unless($order->status === TrackAStatus::DisetujuiKepalaCabang && $order->sent_to_notary_at === null, 403);
        $this->ensureReadyToSend($order);

        DB::transaction(function () use ($request, $order) {
            $before = $order->only(['status', 'sent_to_notary_at']);

            $order->update([
                'status' => TrackAStatus::MenungguVerifikasiNotaris,
                'sent_to_notary_at' => now(),
            ]);

            $order->statusHistories()->create([
                'track' => 'A',
                'from_status' => TrackAStatus::DisetujuiKepalaCabang->value,
                'to_status' => TrackAStatus::MenungguVerifikasiNotaris->value,
                'actor_type' => 'user',
                'actor_id' => $request->user()->id,
                'reason' => 'Order dikirim ke notaris.',
            ]);

            Audit::record($request, 'orders', $order, 'send', 'Order dikirim ke notaris.', [
                'before' => $before,
                'after' => $order->only(['status', 'sent_to_notary_at']),
            ]);

            InAppNotification::forNotary(
                $order,
                'Order baru diterima',
                "Order {$order->order_no} untuk {$order->customer_name} menunggu verifikasi dokumen.",
            );
        });

        return back()->with('success', 'Order dikirim ke notaris.');
    }

    public function submitForApproval(Request $request, Order $order): RedirectResponse
    {
        $this->authorizeVisibleOrder($request, $order);
        abort_unless($this->canEditDraft($order), 403);
        $this->ensureReadyToSend($order);

        $fromStatus = $order->status->value;
        $isResubmission = $order->status === TrackAStatus::PerluPerbaikanOrder;
        $order->update(['status' => TrackAStatus::MenungguApproval]);
        $order->statusHistories()->create([
            'track' => 'A',
            'from_status' => $fromStatus,
            'to_status' => TrackAStatus::MenungguApproval->value,
            'actor_type' => 'user',
            'actor_id' => $request->user()->id,
            'reason' => $isResubmission
                ? 'Order diperbaiki dan diajukan ulang untuk approval cabang.'
                : 'Order diajukan untuk approval cabang.',
        ]);
        Audit::record($request, 'orders', $order, 'submit_approval', 'Order diajukan untuk approval.', []);
        InAppNotification::forBranchApprovers($order, 'Order menunggu approval', "Order {$order->order_no} menunggu review approver cabang.");

        return back()->with('success', 'Order diajukan untuk approval cabang.');
    }

    public function approve(Request $request, Order $order): RedirectResponse
    {
        $this->authorizeVisibleOrder($request, $order);
        abort_unless($request->user()?->hasPermission('orders.approve'), 403);

        $approvedOrder = DB::transaction(function () use ($request, $order) {
            // Lock the row and re-check the stage inside the transaction so that
            // simultaneous approvals resolve to exactly one successful action.
            $lockedOrder = Order::query()
                ->whereKey($order->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedOrder->status !== TrackAStatus::MenungguApproval) {
                return null;
            }

            $this->ensureReadyToSend($lockedOrder);
            $before = $lockedOrder->only(['status', 'sent_to_notary_at']);
            $approvedAt = now();
            $roleName = $request->user()->role()?->name ?? 'Approver cabang';
            $reason = "Order disetujui oleh {$request->user()->name} ({$roleName}) dan dikirim ke notaris.";
            $customSlaCount = $lockedOrder->collaterals()->where('sla_source', 'override')->count();
            if ($customSlaCount > 0) {
                $reason .= " {$customSlaCount} SLA khusus ikut disetujui.";
            }

            $lockedOrder->update([
                'status' => TrackAStatus::MenungguVerifikasiNotaris,
                'sent_to_notary_at' => $approvedAt,
                'checked_by' => $request->user()->id,
                'checked_at' => $approvedAt,
            ]);
            $lockedOrder->statusHistories()->create([
                'track' => 'A',
                'from_status' => TrackAStatus::MenungguApproval->value,
                'to_status' => TrackAStatus::MenungguVerifikasiNotaris->value,
                'actor_type' => 'user',
                'actor_id' => $request->user()->id,
                'reason' => $reason,
            ]);
            Audit::record($request, 'orders', $lockedOrder, 'approve_and_send', $reason, [
                'before' => $before,
                'after' => $lockedOrder->only(['status', 'sent_to_notary_at', 'checked_by', 'checked_at']),
            ]);

            return $lockedOrder->fresh();
        });

        if ($approvedOrder === null) {
            return back()->with('error', 'Order sudah diproses oleh approver lain. Approval hanya dapat dilakukan satu kali.');
        }

        InAppNotification::forNotary($approvedOrder, 'Order baru diterima', "Order {$approvedOrder->order_no} untuk {$approvedOrder->customer_name} menunggu verifikasi dokumen.");

        return back()->with('success', 'Order disetujui dan dikirim ke notaris.');
    }

    public function returnForRevision(Request $request, Order $order): RedirectResponse
    {
        $this->authorizeVisibleOrder($request, $order);
        abort_unless($request->user()?->hasPermission('orders.approve'), 403);
        abort_unless($order->status === TrackAStatus::MenungguApproval, 403);

        $data = $request->validate(['reason' => ['required', 'string', 'max:2000']]);
        $order->update(['status' => TrackAStatus::PerluPerbaikanOrder]);
        $order->statusHistories()->create([
            'track' => 'A',
            'from_status' => TrackAStatus::MenungguApproval->value,
            'to_status' => TrackAStatus::PerluPerbaikanOrder->value,
            'actor_type' => 'user',
            'actor_id' => $request->user()->id,
            'reason' => $data['reason'],
        ]);
        Audit::record($request, 'orders', $order, 'return_revision', 'Order dikembalikan untuk perbaikan.', ['reason' => $data['reason']]);
        InAppNotification::forUser($order->maker, 'Order perlu perbaikan', "Order {$order->order_no} perlu diperbaiki sebelum approval.");
        InAppNotification::forInternalUsers('Order perlu direvisi', "Order {$order->order_no} dikembalikan Pimpinan Cabang untuk perbaikan: {$data['reason']}", "/orders/{$order->id}");

        return back()->with('success', 'Order dikembalikan untuk perbaikan.');
    }

    public function cancel(Request $request, Order $order): RedirectResponse
    {
        $this->authorizeVisibleOrder($request, $order);
        abort_unless($request->user()?->hasPermission('orders.cancel'), 403);
        abort_unless(! in_array($order->status, [TrackAStatus::Selesai, TrackAStatus::Dibatalkan], true), 422, 'Order yang sudah ditutup tidak dapat dibatalkan.');
        $data = $request->validate(['reason' => ['required', 'string', 'max:2000']]);
        $before = $order->status;
        $order->update(['status' => TrackAStatus::Dibatalkan]);
        $order->statusHistories()->create([
            'track' => 'A',
            'from_status' => $before->value,
            'to_status' => TrackAStatus::Dibatalkan->value,
            'actor_type' => 'user',
            'actor_id' => $request->user()->id,
            'reason' => $data['reason'],
        ]);
        Audit::record($request, 'orders', $order, 'cancel', 'Order dibatalkan.', ['reason' => $data['reason'], 'from_status' => $before->value]);
        InAppNotification::forNotary($order, 'Order dibatalkan', "Order {$order->order_no} dibatalkan oleh internal.");

        return back()->with('success', 'Order dibatalkan.');
    }

    public function reassignNotary(Request $request, Order $order): RedirectResponse
    {
        $this->authorizeVisibleOrder($request, $order);
        abort_unless($request->user()?->hasPermission('orders.manage'), 403);
        abort_unless($order->status === TrackAStatus::PerluPengalihanNotaris, 422, 'Pengalihan hanya tersedia setelah notaris menolak order.');
        $data = $request->validate([
            'notary_id' => ['required', 'integer', 'exists:notaries,id'],
            'reason' => ['required', 'string', 'max:2000'],
        ]);
        abort_unless(DB::table('branch_notary')->where('branch_id', $order->branch_id)->where('notary_id', $data['notary_id'])->where('is_active', true)->exists(), 422, 'Notaris belum terdaftar sebagai rekanan cabang ini.');
        $beforeNotary = $order->notary_id;
        $order->update(['notary_id' => $data['notary_id'], 'status' => TrackAStatus::MenungguApproval]);
        $order->statusHistories()->create(['track' => 'A', 'from_status' => TrackAStatus::PerluPengalihanNotaris->value, 'to_status' => TrackAStatus::MenungguApproval->value, 'actor_type' => 'user', 'actor_id' => $request->user()->id, 'reason' => $data['reason']]);
        Audit::record($request, 'orders', $order, 'reassign_notary', 'Notaris order dialihkan.', ['from_notary_id' => $beforeNotary, 'to_notary_id' => $data['notary_id'], 'reason' => $data['reason']]);
        InAppNotification::forBranchApprovers($order, 'Order menunggu approval ulang', "Order {$order->order_no} dialihkan ke notaris baru dan menunggu approval.");

        return back()->with('success', 'Notaris berhasil dialihkan. Order menunggu approval Kepala Cabang.');
    }

    public function close(Request $request, Order $order): RedirectResponse
    {
        $this->authorizeVisibleOrder($request, $order);
        abort_unless($request->user()?->hasPermission('orders.manage'), 403);
        abort_unless($order->status === TrackAStatus::DokumenFisikDiterima, 422, 'Order belum memenuhi tahap penutupan.');
        $order->loadMissing('collaterals', 'paymentRequest');
        abort_unless($order->collaterals->every(fn ($collateral) => $collateral->doc_status === TrackBDocStatus::FinalDivalidasi), 422, 'Seluruh dokumen final harus disetujui.');
        abort_unless($order->paymentRequest?->status === TrackDPaymentStatus::Dibayar, 422, 'Pembayaran belum selesai.');
        abort_unless(! $order->risk_flag, 422, 'Order berisiko belum dapat ditutup.');

        $order->update(['status' => TrackAStatus::Selesai]);
        $order->statusHistories()->create(['track' => 'A', 'from_status' => TrackAStatus::DokumenFisikDiterima->value, 'to_status' => TrackAStatus::Selesai->value, 'actor_type' => 'user', 'actor_id' => $request->user()->id, 'reason' => 'Seluruh kewajiban order selesai dan order ditutup.']);
        Audit::record($request, 'orders', $order, 'close', 'Order ditutup setelah seluruh kewajiban selesai.');

        return back()->with('success', 'Order ditutup.');
    }

    public function updateChecklist(Request $request, Order $order): RedirectResponse
    {
        $data = $request->validate([
            'checklists' => ['array'],
            'checklists.*' => ['boolean'],
        ]);

        DB::transaction(function () use ($data, $request, $order) {
            $order->load('collaterals.checklists');

            foreach ($order->collaterals as $collateral) {
                foreach ($collateral->checklists as $checklist) {
                    $checked = (bool) ($data['checklists'][$checklist->id] ?? false) && $checklist->order_document_id !== null;
                    $checklist->update([
                        'is_checked' => $checked,
                        'checked_by' => $checked ? $request->user()->id : null,
                        'checked_at' => $checked ? now() : null,
                    ]);
                }
            }

            Audit::record($request, 'orders', $order, 'checklist_update', 'Checklist dokumen awal diperbarui.', [
                'checked_ids' => collect($data['checklists'] ?? [])->filter()->keys()->all(),
            ]);
        });

        return back()->with('success', 'Checklist diperbarui.');
    }

    private function validatedOrderData(Request $request): array
    {
        $data = $request->validate([
            'branch_id' => ['required', 'integer', 'exists:branches,id'],
            'notary_id' => ['required', 'integer', 'exists:notaries,id'],
            'customer_name' => ['required', 'string', 'max:255'],
            'no_rekening' => ['required', 'string', 'max:30'],
            'tgl_realisasi' => ['nullable', 'date'],
            'tgl_masuk_notaris' => ['nullable', 'date'],
            'plafon' => ['nullable', 'numeric', 'min:0'],
            'nominal' => ['nullable', 'numeric', 'min:0'],
            'skema_pembayaran' => ['nullable', 'string', 'max:30'],
            'keterangan' => ['nullable', 'string'],
            'collaterals' => ['required', 'array', 'min:1'],
            'collaterals.*.job_type_id' => ['required', 'integer', 'exists:job_types,id'],
            'collaterals.*.agunan_id' => ['nullable', 'string', 'max:50'],
            'collaterals.*.deskripsi_agunan' => ['required', 'string'],
        ]);

        $isBranchNotary = DB::table('branch_notary')
            ->where('branch_id', $data['branch_id'])
            ->where('notary_id', $data['notary_id'])
            ->where('is_active', true)
            ->exists();

        if (! $isBranchNotary) {
            throw ValidationException::withMessages([
                'notary_id' => 'Notaris ini belum terdaftar sebagai rekanan cabang yang dipilih.',
            ]);
        }

        if (! Notary::availableForOrders()->whereKey($data['notary_id'])->exists()) {
            throw ValidationException::withMessages([
                'notary_id' => 'Legalitas kemitraan kantor notaris belum lengkap atau sudah berakhir.',
            ]);
        }

        return $data;
    }

    private function validatedDraftData(Request $request): array
    {
        $data = $request->validate([
            'branch_id' => ['required', 'integer', 'exists:branches,id'],
            'notary_id' => ['required', 'integer', 'exists:notaries,id'],
            'customer_name' => ['required', 'string', 'max:255'],
            'no_rekening' => ['required', 'string', 'max:30'],
            'tgl_realisasi' => ['nullable', 'date'],
            'tgl_masuk_notaris' => ['nullable', 'date'],
            'plafon' => ['nullable', 'numeric', 'min:0'],
            'nominal' => ['nullable', 'numeric', 'min:0'],
            'skema_pembayaran' => ['nullable', 'string', 'max:30'],
            'keterangan' => ['nullable', 'string'],
            'collaterals' => ['nullable', 'array'],
            'collaterals.*.job_type_id' => ['nullable', 'integer', 'exists:job_types,id'],
            'collaterals.*.id' => ['nullable', 'integer', 'exists:order_collaterals,id'],
            'collaterals.*.agunan_id' => ['nullable', 'string', 'max:50'],
            'collaterals.*.deskripsi_agunan' => ['nullable', 'string'],
            'collaterals.*.sla_days' => ['nullable', 'integer', 'min:1', 'max:365'],
            'collaterals.*.sla_override_reason' => ['nullable', 'string', 'max:2000'],
        ]);

        $this->authorizeBranchAssignment($request, (int) $data['branch_id']);

        if (! Notary::availableForOrders()->whereKey($data['notary_id'])->exists()) {
            throw ValidationException::withMessages([
                'notary_id' => 'Legalitas kemitraan kantor notaris belum lengkap atau sudah berakhir.',
            ]);
        }

        foreach ($data['collaterals'] ?? [] as $index => $collateralData) {
            if (! ($collateralData['job_type_id'] ?? null)) {
                continue;
            }
            $sla = $this->resolveSla($collateralData, (int) $data['branch_id'], $data['tgl_masuk_notaris'] ?? null);
            if ($sla['sla_source'] === 'override' && blank($collateralData['sla_override_reason'] ?? null)) {
                throw ValidationException::withMessages([
                    "collaterals.{$index}.sla_override_reason" => 'Alasan wajib diisi jika SLA diubah dari nilai standar.',
                ]);
            }
        }

        return [...$data, 'collaterals' => $data['collaterals'] ?? []];
    }

    private function ensureReadyToSend(Order $order): void
    {
        $order->loadMissing('collaterals.checklists');
        $missing = [];

        foreach (['branch_id' => 'cabang', 'notary_id' => 'notaris', 'customer_name' => 'nama nasabah', 'no_rekening' => 'nomor rekening', 'tgl_realisasi' => 'tanggal akad'] as $field => $label) {
            if (blank($order->{$field})) {
                $missing[] = $label;
            }
        }

        if ($order->collaterals->isEmpty() || $order->collaterals->contains(fn ($collateral) => blank($collateral->job_type_id) || blank($collateral->deskripsi_agunan))) {
            $missing[] = 'data agunan lengkap';
        }

        if ($order->collaterals->contains(fn ($collateral) => $collateral->checklists->contains(fn ($checklist) => ! $checklist->is_checked || ! $checklist->order_document_id))) {
            $missing[] = 'dokumen checklist lengkap';
        }

        if ($order->collaterals->contains(fn ($collateral) => $collateral->sla_source === 'override' && blank($collateral->sla_override_reason))) {
            $missing[] = 'alasan perubahan SLA';
        }

        if ($missing !== []) {
            throw ValidationException::withMessages([
                'order' => 'Lengkapi terlebih dahulu: '.implode(', ', $missing).'.',
            ]);
        }
    }

    private function seedOrderChecklists(Order $order, $collateral, int $jobTypeId): void
    {
        DocumentChecklist::query()
            ->where(function ($query) use ($jobTypeId) {
                $query->whereNull('job_type_id')->orWhere('job_type_id', $jobTypeId);
            })
            ->where('is_active', true)
            ->get()
            ->each(fn (DocumentChecklist $checklist) => $collateral->checklists()->create([
                'order_id' => $order->id,
                'document_checklist_id' => $checklist->id,
            ]));
    }

    private function canEditDraft(Order $order): bool
    {
        return in_array($order->status, [TrackAStatus::Draft, TrackAStatus::Diajukan, TrackAStatus::PerluPerbaikanOrder], true)
            && $order->sent_to_notary_at === null;
    }

    private function authorizeVisibleOrder(Request $request, Order $order): void
    {
        abort_unless($order->isVisibleTo($request->user()), 404);
    }

    private function authorizeBranchAssignment(Request $request, int $branchId): void
    {
        $scopedBranchId = $this->userBranchScope($request);

        abort_unless($scopedBranchId === null || $scopedBranchId === $branchId, 403);
    }

    private function userBranchScope(Request $request): ?int
    {
        $user = $request->user();

        if (! $user || $user->roleCode() === 'it_admin' || ! $user->branch_id) {
            return null;
        }

        return (int) $user->branch_id;
    }

    private function paymentBlockers(Order $order): array
    {
        $blockers = [];

        if ($order->collaterals->contains(fn ($collateral) => $collateral->doc_status !== TrackBDocStatus::FinalDivalidasi)) {
            $blockers[] = 'Seluruh dokumen final harus tervalidasi.';
        }

        if ($order->collaterals->contains(fn ($collateral) => $collateral->covernote_status === TrackCCovernoteStatus::Kedaluwarsa)) {
            $blockers[] = 'Covernote kedaluwarsa harus diperpanjang.';
        }

        if ($order->risk_flag) {
            $blockers[] = 'Order masih ditandai risiko tinggi.';
        }

        return $blockers;
    }

    private function makeOrderNo(): string
    {
        return 'ORD-'.now()->format('Ymd').'-'.str_pad((string) (Order::whereDate('created_at', today())->count() + 1), 4, '0', STR_PAD_LEFT);
    }

    private function slaPolicies(?int $branchId = null): array
    {
        return SlaPolicy::query()
            ->where('is_active', true)
            ->when($branchId, fn ($query) => $query->where(fn ($query) => $query->where('branch_id', $branchId)->orWhereNull('branch_id')))
            ->get()
            ->groupBy('job_type_id')
            ->map(fn ($policies) => $policies->sortBy(fn ($item) => $item->branch_id === $branchId ? 0 : 1)->first())
            ->mapWithKeys(fn ($item) => [$item->job_type_id => ['days' => $item->days, 'source' => $item->branch_id ? 'cabang' : 'global']])
            ->all();
    }

    private function resolveSla(array $collateralData, int $branchId, ?string $startDate): array
    {
        $jobTypeId = (int) ($collateralData['job_type_id'] ?? 0);
        $standard = SlaPolicy::query()
            ->where('job_type_id', $jobTypeId)
            ->where('is_active', true)
            ->where(fn ($query) => $query->where('branch_id', $branchId)->orWhereNull('branch_id'))
            ->orderByRaw('branch_id is null')
            ->first();
        $standardDays = $standard?->days;
        $requestedDays = filled($collateralData['sla_days'] ?? null) ? (int) $collateralData['sla_days'] : $standardDays;
        $isOverride = $requestedDays !== null && $requestedDays !== $standardDays;

        return [
            'sla_days' => $requestedDays,
            'sla_source' => $isOverride ? 'override' : 'standard',
            'sla_override_reason' => $isOverride ? ($collateralData['sla_override_reason'] ?? null) : null,
            'sla_due_at' => $startDate && $requestedDays ? Carbon::parse($startDate)->addDays($requestedDays) : null,
        ];
    }
}
