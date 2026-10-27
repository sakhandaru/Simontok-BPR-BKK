import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowLeft,
    BadgeCheck,
    CheckCircle2,
    Circle,
    ClipboardCheck,
    Clock3,
    ChevronDown,
    Download,
    Eye,
    FileCheck2,
    FilePlus2,
    FileText,
    PackageCheck,
    Pencil,
    Plus,
    Save,
    Scale,
    Send,
    ShieldCheck,
    Trash2,
    Upload,
    WalletCards,
} from 'lucide-react';
import { FormEvent, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SimActionAlert } from '@/components/sim-action-alert';
import { SimEmptyState } from '@/components/sim-empty-state';
import { SimPageHeader } from '@/components/sim-page-header';
import { SimStatusBadge, toneForStatus } from '@/components/sim-status-badge';
import { SimFileUpload } from '@/components/sim-file-upload';
import { SimSelect } from '@/components/sim-select';
import { SimTimeline } from '@/components/sim-timeline';
import { SimJourneyNodes } from '@/components/sim-journey-nodes';
import { RupiahInput } from '@/components/rupiah-input';
import InputError from '@/components/input-error';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { orderJourneyStages } from '@/lib/sim-journey';

type Option = { value: string; label: string };
type DocumentEditor = {
    collateralId: string;
    id?: string;
    documentId?: number;
    existingName?: string;
    checklistId: string;
    displayName: string;
    file: File | null;
    kind: 'agunan' | 'pendukung';
};
type CollateralDraft = {
    id?: string;
    job_type_id: string;
    agunan_id: string;
    deskripsi_agunan: string;
    covernote_no: string;
    covernote_start: string;
    covernote_end: string;
    sla_days: string;
    sla_override_reason: string;
};
type OrderDraft = {
    branch_id: string;
    notary_id: string;
    customer_name: string;
    no_rekening: string;
    tgl_masuk_notaris: string;
    tgl_realisasi: string;
    plafon: string;
    nominal: string;
    skema_pembayaran: string;
    keterangan: string;
    collaterals: CollateralDraft[];
};

export default function OrdersShow({
    order,
    canEdit,
    documentTypes,
    handoverMethods,
    paymentBlockers,
    canVerifyPayment,
    canUploadPaymentProof,
    canValidateDocuments,
    canManageHandovers,
    canManageOrder,
    canCancelOrder,
    canCloseOrder,
    canManageCovernote,
    canApproveCovernote,
    canApproveCovernoteExtension,
    canEscalateCovernote,
    canSubmitApproval,
    canApproveOrder,
    branches,
    notaries,
    jobTypes,
    slaPolicies,
}: {
    order: any;
    canEdit: boolean;
    documentTypes: Option[];
    handoverMethods: Option[];
    paymentBlockers: string[];
    canVerifyPayment: boolean;
    canUploadPaymentProof: boolean;
    canValidateDocuments: boolean;
    canManageHandovers: boolean;
    canManageOrder: boolean;
    canCancelOrder: boolean;
    canCloseOrder: boolean;
    canManageCovernote: boolean;
    canApproveCovernote: boolean;
    canApproveCovernoteExtension: boolean;
    canEscalateCovernote: boolean;
    canSubmitApproval: boolean;
    canApproveOrder: boolean;
    branches: { id: number; code: string; name: string }[];
    notaries: { id: number; name: string }[];
    jobTypes: { id: number; code: string; name: string }[];
    slaPolicies: Record<string, { days: number; source: string }>;
}) {
    const draft = useForm<OrderDraft>({
        branch_id: String(order.branch_id ?? ''),
        notary_id: String(order.notary_id ?? ''),
        customer_name: order.customer_name ?? '',
        no_rekening: order.no_rekening ?? '',
        tgl_masuk_notaris: dateInput(order.tgl_masuk_notaris),
        tgl_realisasi: dateInput(order.tgl_realisasi),
        plafon: order.plafon ?? '',
        nominal: order.nominal ?? '',
        skema_pembayaran: order.skema_pembayaran ?? '',
        keterangan: order.keterangan ?? '',
        collaterals:
            order.collaterals?.map((item: any) => ({
                id: String(item.id ?? ''),
                job_type_id: String(item.job_type_id ?? ''),
                agunan_id: item.agunan_id ?? '',
                deskripsi_agunan: item.deskripsi_agunan ?? '',
                covernote_no: item.covernote_no ?? '',
                covernote_start: dateInput(item.covernote_start),
                covernote_end: dateInput(item.covernote_end),
                sla_days:
                    item.sla_source === 'override' && item.sla_days
                        ? String(item.sla_days)
                        : '',
                sla_override_reason: item.sla_override_reason ?? '',
            })) ?? [],
    });
    const [revisionOpen, setRevisionOpen] = useState(false);
    const [cancelOpen, setCancelOpen] = useState(false);
    const revision = useForm({ reason: '' });
    const cancellation = useForm({ reason: '' });
    const covernoteRevision = useForm({ reason: '' });
    const finalRevision = useForm({ reason: '' });
    const [finalRevisionDocument, setFinalRevisionDocument] = useState<
        number | null
    >(null);
    const [progressDocumentsPreview, setProgressDocumentsPreview] = useState<
        any[] | null
    >(null);
    const orderSentToNotary = Boolean(order.sent_to_notary_at);
    const canViewInitialDocuments = canManageOrder || canApproveOrder;
    const [draftSaveState, setDraftSaveState] = useState<
        'saved' | 'pending' | 'saving' | 'error'
    >('saved');
    const draftInitialized = useRef(false);
    const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const persistDraft = (silent = false, onSuccess?: () => void) => {
        setDraftSaveState('saving');
        draft.put(`/orders/${order.id}`, {
            preserveScroll: true,
            preserveState: true,
            only: silent ? ['order'] : undefined,
            headers: silent ? { 'X-Silent-Save': 'true' } : undefined,
            onSuccess: () => {
                draft.setDefaults();
                setDraftSaveState('saved');
                onSuccess?.();
            },
            onError: () => setDraftSaveState('error'),
        });
    };

    useEffect(() => {
        if (!canEdit) return;
        if (!draftInitialized.current) {
            draftInitialized.current = true;
            return;
        }
        if (!draft.isDirty) return;

        setDraftSaveState('pending');
        if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
        draftSaveTimer.current = setTimeout(() => {
            persistDraft(true);
        }, 1000);

        return () => {
            if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
        };
    }, [canEdit, draft.data]);

    const submitOrderApproval = () => {
        if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
        if (draft.isDirty) {
            persistDraft(true, () =>
                router.post(
                    `/orders/${order.id}/submit-approval`,
                    {},
                    { preserveScroll: true },
                ),
            );
            return;
        }

        router.post(
            `/orders/${order.id}/submit-approval`,
            {},
            { preserveScroll: true },
        );
    };
    const approveOrder = () =>
        router.post(
            `/orders/${order.id}/approve`,
            {},
            { preserveScroll: true },
        );
    const submitOrderRevision = (event: FormEvent) => {
        event.preventDefault();
        revision.post(`/orders/${order.id}/return-revision`, {
            preserveScroll: true,
            onSuccess: () => {
                revision.reset();
                setRevisionOpen(false);
            },
        });
    };
    const submitCancellation = (event: FormEvent) => {
        event.preventDefault();
        cancellation.post(`/orders/${order.id}/cancel`, {
            preserveScroll: true,
            onSuccess: () => {
                cancellation.reset();
                setCancelOpen(false);
            },
        });
    };
    const closeOrder = () =>
        router.post(`/orders/${order.id}/close`, {}, { preserveScroll: true });
    const approveCovernote = () =>
        router.post(
            `/orders/${order.id}/covernote/approve`,
            {},
            { preserveScroll: true },
        );
    const escalateCovernote = () =>
        router.post(
            `/orders/${order.id}/covernote/escalate`,
            {},
            { preserveScroll: true },
        );
    const requestCovernoteRevision = (event: FormEvent) => {
        event.preventDefault();
        covernoteRevision.post(`/orders/${order.id}/covernote/revision`, {
            preserveScroll: true,
            onSuccess: () => covernoteRevision.reset(),
        });
    };
    const approveCovernoteExtension = (
        collateralId: number,
        extensionId: number,
    ) =>
        router.post(
            `/orders/${order.id}/collaterals/${collateralId}/covernote-extensions/${extensionId}/approve`,
            {},
            { preserveScroll: true },
        );
    const rejectCovernoteExtension = (
        event: FormEvent<HTMLFormElement>,
        collateralId: number,
        extensionId: number,
    ) => {
        event.preventDefault();
        const reason = new FormData(event.currentTarget).get('reason');
        router.post(
            `/orders/${order.id}/collaterals/${collateralId}/covernote-extensions/${extensionId}/reject`,
            { reason },
            { preserveScroll: true },
        );
    };
    const submitFinalRevision = (event: FormEvent) => {
        event.preventDefault();
        if (!finalRevisionDocument) return;
        finalRevision.post(
            `/orders/${order.id}/documents/${finalRevisionDocument}/return-final-revision`,
            {
                preserveScroll: true,
                onSuccess: () => {
                    finalRevision.reset();
                    setFinalRevisionDocument(null);
                },
            },
        );
    };
    const setCollateral = (
        index: number,
        key: keyof CollateralDraft,
        value: string,
    ) => {
        const next = [...draft.data.collaterals];
        next[index] = { ...next[index], [key]: value };
        draft.setData('collaterals', next);
    };
    const canSend = Boolean(
        draft.data.branch_id &&
        draft.data.notary_id &&
        draft.data.customer_name &&
        draft.data.no_rekening &&
        draft.data.tgl_realisasi &&
        draft.data.collaterals.length > 0 &&
        draft.data.collaterals.every(
            (item) => item.job_type_id && item.deskripsi_agunan,
        ),
    );
    const incompleteFields = [
        !draft.data.branch_id && 'Cabang',
        !draft.data.notary_id && 'Notaris',
        !draft.data.customer_name && 'Nama nasabah',
        !draft.data.no_rekening && 'No rekening',
        !draft.data.tgl_realisasi && 'Tanggal akad',
        draft.data.collaterals.length === 0 && 'Minimal satu agunan',
        ...draft.data.collaterals.flatMap((item, index) => [
            !item.job_type_id && `Jenis pekerjaan agunan ${index + 1}`,
            !item.deskripsi_agunan && `Deskripsi agunan ${index + 1}`,
        ]),
        order.collaterals?.some((item: any) =>
            item.checklists?.some(
                (checklist: any) => !checklist.is_checked || !checklist.order_document_id,
            ),
        ) && 'Dokumen checklist agunan',
        draft.data.collaterals.some(
            (item) => item.sla_days && !item.sla_override_reason,
        ) && 'Alasan perubahan SLA',
    ].filter(Boolean) as string[];
    const needsOrderRevision =
        statusValue(order.status) === 'perlu_perbaikan_order';
    const latestOrderRevision = needsOrderRevision
        ? order.status_histories?.find(
              (history: any) =>
                  statusValue(history.to_status) === 'perlu_perbaikan_order',
          )
        : null;
    const upload = useForm<{
        order_collateral_id: string;
        order_checklist_id: string;
        document_type: string;
        display_name: string;
        file: File | null;
    }>({
        order_collateral_id: String(order.collaterals[0]?.id ?? ''),
        order_checklist_id: '',
        document_type: 'dokumen_awal',
        display_name: '',
        file: null,
    });
    const handover = useForm({
        order_collateral_id: String(order.collaterals[0]?.id ?? ''),
        receiver_name: '',
        method: 'kurir',
        handed_over_at: '',
        receipt: null as File | null,
        catatan: '',
    });
    const covernote = useForm({
        order_collateral_id: String(order.collaterals[0]?.id ?? ''),
        new_end: '',
        catatan: '',
        file: null as File | null,
    });
    const verification = useForm({
        decision: 'verify',
        catatan_verifikasi: '',
    });
    const paymentProof = useForm({
        paid_at: '',
        nominal: order.payment_request?.nominal ?? order.nominal ?? '',
        bukti: null as File | null,
        catatan: '',
    });
    const [documentsOpen, setDocumentsOpen] = useState(true);
    const [documentEditor, setDocumentEditor] = useState<DocumentEditor | null>(
        null,
    );

    const submitUpload = (event?: FormEvent) => {
        event?.preventDefault();
        upload.post(`/orders/${order.id}/documents`, {
            forceFormData: true,
            preserveScroll: true,
        });
    };

    const openChecklistEditor = (collateralId: string, checklistId: string) => {
        setDocumentEditor({
            collateralId,
            checklistId,
            displayName: '',
            file: null,
            kind: 'agunan',
        });
    };
    const saveDocumentEditor = () => {
        if (
            !documentEditor ||
            (!documentEditor.documentId && !documentEditor.file) ||
            (documentEditor.kind === 'pendukung' &&
                !documentEditor.displayName.trim())
        )
            return;
        if (documentEditor.documentId) {
            const formData = new FormData();
            formData.append('_method', 'patch');
            if (documentEditor.displayName)
                formData.append('display_name', documentEditor.displayName);
            if (documentEditor.file)
                formData.append('file', documentEditor.file);
            router.post(
                `/orders/${order.id}/documents/${documentEditor.documentId}`,
                formData,
                {
                    forceFormData: true,
                    preserveScroll: true,
                    onSuccess: () => setDocumentEditor(null),
                },
            );
            return;
        }
        const formData = new FormData();
        formData.append(
            'order_collateral_id',
            documentEditor.collateralId,
        );
        formData.append('document_type', documentEditor.kind === 'agunan' ? 'dokumen_awal' : 'lainnya');
        if (documentEditor.checklistId)
            formData.append('order_checklist_id', documentEditor.checklistId);
        if (documentEditor.displayName)
            formData.append('display_name', documentEditor.displayName);
        if (documentEditor.file)
            formData.append('file', documentEditor.file);
        router.post(`/orders/${order.id}/documents`, formData, {
            forceFormData: true,
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => setDocumentEditor(null),
        });
    };

    const submitHandover = (event: FormEvent) => {
        event.preventDefault();
        handover.post(`/orders/${order.id}/handovers`, {
            forceFormData: true,
            preserveScroll: true,
        });
    };

    const submitCovernote = (event: FormEvent) => {
        event.preventDefault();
        covernote.post(
            `/orders/${order.id}/collaterals/${covernote.data.order_collateral_id}/covernote-extensions`,
            { forceFormData: true, preserveScroll: true },
        );
    };
    const submitVerification = (event: FormEvent) => {
        event.preventDefault();
        if (!order.payment_request?.id) return;
        verification.post(
            `/orders/${order.id}/payment-requests/${order.payment_request.id}/verify`,
            { preserveScroll: true },
        );
    };
    const submitPaymentProof = (event: FormEvent) => {
        event.preventDefault();
        if (!order.payment_request?.id) return;
        paymentProof.post(
            `/orders/${order.id}/payment-requests/${order.payment_request.id}/pay`,
            { forceFormData: true, preserveScroll: true },
        );
    };

    return (
        <>
            <Head title={order.order_no} />
            <div className="sim-workspace">
                <SimPageHeader
                    title={order.order_no}
                    description={`${order.customer_name} - ${order.no_rekening}`}
                    eyebrow={
                        <SimStatusBadge
                            label={statusLabel(order.status)}
                            tone={toneForStatus(statusLabel(order.status))}
                        />
                    }
                    actions={
                        <>
                            {canSubmitApproval && (
                                <Button
                                    type="button"
                                    onClick={submitOrderApproval}
                                    disabled={!canSend || draft.processing}
                                >
                                    <Send className="size-4" />
                                    {needsOrderRevision
                                        ? 'Kirim ulang approval'
                                        : 'Ajukan approval'}
                                </Button>
                            )}
                            {canApproveOrder && (
                                <Button type="button" onClick={approveOrder}>
                                    <BadgeCheck className="size-4" />
                                    Setujui & kirim ke notaris
                                </Button>
                            )}
                            {canApproveOrder && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                        setRevisionOpen((value) => !value)
                                    }
                                >
                                    <AlertCircle className="size-4" />
                                    Minta perbaikan
                                </Button>
                            )}
                            {canApproveCovernote && (
                                <Button
                                    type="button"
                                    onClick={approveCovernote}
                                >
                                    <BadgeCheck className="size-4" />
                                    Setujui covernote
                                </Button>
                            )}
                            {canEscalateCovernote && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={escalateCovernote}
                                >
                                    <ShieldCheck className="size-4" />
                                    Minta approval Kepala Cabang
                                </Button>
                            )}
                            {canCancelOrder && (
                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={() =>
                                        setCancelOpen((value) => !value)
                                    }
                                >
                                    <Trash2 className="size-4" />
                                    Batalkan order
                                </Button>
                            )}
                            {canCloseOrder && (
                                <Button type="button" onClick={closeOrder}>
                                    <CheckCircle2 className="size-4" />
                                    Tutup order
                                </Button>
                            )}
                            <Button variant="outline" asChild>
                                <Link href="/orders">
                                    <ArrowLeft className="size-4" />
                                    Kembali
                                </Link>
                            </Button>
                        </>
                    }
                />

                {needsOrderRevision && (
                    <SimActionAlert
                        tone="warning"
                        title="Order dikembalikan untuk perbaikan"
                        description={
                            <>
                                <span>
                                    Catatan approver:{' '}
                                    {latestOrderRevision?.reason ||
                                        'Tidak ada catatan tambahan.'}
                                </span>
                                <span className="mt-1 block">
                                    Perbaiki data yang diminta, lalu klik{' '}
                                    <strong>Kirim ulang approval</strong> agar
                                    order kembali masuk ke antrean atasan.
                                </span>
                            </>
                        }
                    />
                )}

                {canApproveOrder && revisionOpen && (
                    <form
                        onSubmit={submitOrderRevision}
                        className="sim-panel border-destructive/40 p-4"
                    >
                        <div className="font-medium">
                            Kembalikan order untuk perbaikan
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Tuliskan alasan yang harus diperbaiki Admin Legal.
                        </p>
                        <textarea
                            className="sim-input mt-4 min-h-24 py-2"
                            value={revision.data.reason}
                            onChange={(event) =>
                                revision.setData('reason', event.target.value)
                            }
                            placeholder="Contoh: Dokumen agunan belum lengkap."
                        />
                        <InputError message={revision.errors.reason} />
                        <div className="mt-3 flex gap-2">
                            <Button
                                type="submit"
                                variant="destructive"
                                disabled={
                                    revision.processing ||
                                    !revision.data.reason.trim()
                                }
                            >
                                <Save className="size-4" />
                                Kirim perbaikan
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setRevisionOpen(false)}
                            >
                                Batal
                            </Button>
                        </div>
                    </form>
                )}

                {canApproveCovernote && (
                    <form
                        onSubmit={requestCovernoteRevision}
                        className="sim-panel border-destructive/40 p-4"
                    >
                        <div className="font-medium">
                            Covernote menunggu approval
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Setujui covernote atau kembalikan dengan alasan
                            perbaikan.
                        </p>
                        <textarea
                            className="sim-input mt-4 min-h-24 py-2"
                            value={covernoteRevision.data.reason}
                            onChange={(event) =>
                                covernoteRevision.setData(
                                    'reason',
                                    event.target.value,
                                )
                            }
                            placeholder="Alasan jika covernote perlu diperbaiki"
                        />
                        <InputError message={covernoteRevision.errors.reason} />
                        <Button
                            type="submit"
                            variant="outline"
                            className="mt-3"
                            disabled={
                                covernoteRevision.processing ||
                                !covernoteRevision.data.reason.trim()
                            }
                        >
                            <AlertCircle className="size-4" />
                            Kembalikan covernote
                        </Button>
                    </form>
                )}

                {canCancelOrder && cancelOpen && (
                    <form
                        onSubmit={submitCancellation}
                        className="sim-panel border-destructive/40 p-4"
                    >
                        <div className="font-medium">Batalkan order</div>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Pembatalan tidak dianggap sebagai selesai normal dan
                            wajib memiliki alasan.
                        </p>
                        <textarea
                            className="sim-input mt-4 min-h-24 py-2"
                            value={cancellation.data.reason}
                            onChange={(event) =>
                                cancellation.setData(
                                    'reason',
                                    event.target.value,
                                )
                            }
                            placeholder="Contoh: Akad dibatalkan oleh nasabah."
                        />
                        <InputError message={cancellation.errors.reason} />
                        <div className="mt-3 flex gap-2">
                            <Button
                                type="submit"
                                variant="destructive"
                                disabled={
                                    cancellation.processing ||
                                    !cancellation.data.reason.trim()
                                }
                            >
                                <Trash2 className="size-4" />
                                Konfirmasi pembatalan
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setCancelOpen(false)}
                            >
                                Batal
                            </Button>
                        </div>
                    </form>
                )}

                {canEdit && (
                    <DraftOrderForm
                        draft={draft}
                        branches={branches}
                        notaries={notaries}
                        jobTypes={jobTypes}
                        slaPolicies={slaPolicies}
                        setCollateral={setCollateral}
                        incompleteFields={incompleteFields}
                        saveState={draftSaveState}
                    />
                )}
                <OrderTrackingHero order={order} />

                {order.payment_request && (
                    <details className="sim-panel group">
                        <summary className="sim-panel-header flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
                            <div>
                                <h2 className="sim-panel-title">Pembayaran</h2>
                                <p className="sim-panel-subtitle">
                                    Alur invoice: notaris mengajukan, Admin
                                    Legal memverifikasi, lalu bukti bayar
                                    dicatat setelah handover dokumen fisik.
                                </p>
                            </div>
                            <ChevronDown className="mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="grid gap-4 p-4 lg:grid-cols-[1fr_1fr]">
                            <div className="grid gap-3 text-sm">
                                <Info
                                    label="Status"
                                    value={paymentStatusLabel(
                                        order.payment_request?.status,
                                    )}
                                />
                                <Info
                                    label="Nomor invoice"
                                    value={order.payment_request?.invoice_no}
                                />
                                <Info
                                    label="Nominal invoice"
                                    value={money(
                                        order.payment_request?.nominal,
                                    )}
                                />
                                <Info
                                    label="Skema pembayaran"
                                    value={
                                        order.payment_request
                                            ?.skema_pembayaran ??
                                        order.skema_pembayaran
                                    }
                                />
                                <Info
                                    label="Diajukan"
                                    value={formatTimelineDate(
                                        order.payment_request?.requested_at,
                                    )}
                                />
                                {order.payment_request &&
                                    paymentBlockers.length > 0 && (
                                        <SimActionAlert
                                            tone="danger"
                                            title="Belum memenuhi syarat pembayaran"
                                            description={
                                                <ul className="list-disc space-y-1 pl-5">
                                                    {paymentBlockers.map(
                                                        (item) => (
                                                            <li key={item}>
                                                                {item}
                                                            </li>
                                                        ),
                                                    )}
                                                </ul>
                                            }
                                        />
                                    )}
                                {!order.payment_request && (
                                    <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                                        Belum ada pengajuan pembayaran dari
                                        notaris.
                                    </div>
                                )}
                            </div>
                            <div className="grid gap-4">
                                {canVerifyPayment && (
                                    <form
                                        onSubmit={submitVerification}
                                        className="sim-metric grid gap-3"
                                    >
                                        <div className="font-medium">
                                            Verifikasi admin
                                        </div>
                                        <SimSelect
                                            value={verification.data.decision}
                                            onChange={(value) =>
                                                verification.setData(
                                                    'decision',
                                                    value,
                                                )
                                            }
                                            options={[
                                                {
                                                    value: 'verify',
                                                    label: 'Verifikasi',
                                                },
                                                {
                                                    value: 'reject',
                                                    label: 'Tolak admin',
                                                },
                                            ]}
                                        />
                                        <textarea
                                            className="sim-input min-h-20 py-2"
                                            value={
                                                verification.data
                                                    .catatan_verifikasi
                                            }
                                            onChange={(e) =>
                                                verification.setData(
                                                    'catatan_verifikasi',
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="Catatan verifikasi"
                                        />
                                        <Button
                                            className="w-fit"
                                            disabled={verification.processing}
                                        >
                                            <Save className="size-4" />
                                            Simpan verifikasi
                                        </Button>
                                    </form>
                                )}

                                {canUploadPaymentProof && (
                                    <form
                                        onSubmit={submitPaymentProof}
                                        className="sim-metric grid gap-3"
                                    >
                                        <div className="font-medium">
                                            Bukti pembayaran
                                        </div>
                                        <Input
                                            type="date"
                                            value={paymentProof.data.paid_at}
                                            onChange={(e) =>
                                                paymentProof.setData(
                                                    'paid_at',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                        <RupiahInput
                                            min="1"
                                            value={paymentProof.data.nominal}
                                            onChange={(value) =>
                                                paymentProof.setData(
                                                    'nominal',
                                                    value,
                                                )
                                            }
                                        />
                                        <SimFileUpload
                                            value={paymentProof.data.bukti}
                                            onChange={(file) =>
                                                paymentProof.setData(
                                                    'bukti',
                                                    file,
                                                )
                                            }
                                            label="Pilih bukti pembayaran"
                                        />
                                        <textarea
                                            className="sim-input min-h-20 py-2"
                                            value={paymentProof.data.catatan}
                                            onChange={(e) =>
                                                paymentProof.setData(
                                                    'catatan',
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="Catatan pembayaran"
                                        />
                                        <Button
                                            className="w-fit"
                                            disabled={paymentProof.processing}
                                        >
                                            <WalletCards className="size-4" />
                                            Catat pembayaran
                                        </Button>
                                    </form>
                                )}
                            </div>
                        </div>
                        {order.payment_request?.payments?.length > 0 && (
                            <div className="border-t px-4 py-3">
                                <div className="font-medium">
                                    Riwayat bukti bayar
                                </div>
                                <div className="mt-3 divide-y rounded-md border">
                                    {order.payment_request.payments.map(
                                        (payment: any) => (
                                            <div
                                                key={payment.id}
                                                className="flex flex-col gap-2 p-3 text-sm md:flex-row md:items-center md:justify-between"
                                            >
                                                <div>
                                                    <div>
                                                        {dateOnly(
                                                            payment.paid_at,
                                                        )}{' '}
                                                        -{' '}
                                                        {money(payment.nominal)}
                                                    </div>
                                                    <div className="text-muted-foreground">
                                                        {payment.uploader
                                                            ?.name ?? '-'}{' '}
                                                        -{' '}
                                                        {payment.catatan ?? '-'}
                                                    </div>
                                                </div>
                                                {payment.bukti_path &&
                                                    order.payment_request
                                                        ?.id && (
                                                        <a
                                                            className="font-medium underline-offset-4 hover:underline"
                                                            href={`/orders/${order.id}/payment-requests/${order.payment_request.id}/payments/${payment.id}/download`}
                                                        >
                                                            Unduh bukti
                                                        </a>
                                                    )}
                                            </div>
                                        ),
                                    )}
                                </div>
                            </div>
                        )}
                    </details>
                )}

                <details className="sim-panel group">
                    <summary className="sim-panel-header flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
                        <div>
                            <div className="sim-panel-title">Agunan</div>
                            <p className="sim-panel-subtitle">
                                Objek agunan dan kelengkapan dokumen yang
                                terkait.
                            </p>
                        </div>
                        <ChevronDown className="mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="divide-y">
                        {order.collaterals.map((item: any) => (
                            <div
                                key={item.id}
                                className="grid gap-4 p-4 md:grid-cols-[1fr_220px]"
                            >
                                <div>
                                    <div className="font-medium">
                                        {item.job_type?.name}
                                    </div>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {item.deskripsi_agunan}
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <SimStatusBadge
                                            label={`Dokumen: ${statusLabel(item.doc_status)}`}
                                            tone={toneForStatus(
                                                statusLabel(item.doc_status),
                                            )}
                                        />
                                        {item.covernote_no ||
                                        item.covernote_end ? (
                                            <SimStatusBadge
                                                label={`Covernote: ${statusLabel(item.covernote_status)}`}
                                                tone={toneForStatus(
                                                    statusLabel(
                                                        item.covernote_status,
                                                    ),
                                                )}
                                            />
                                        ) : (
                                            <SimStatusBadge
                                                label="Covernote belum tersedia"
                                                tone="warning"
                                            />
                                        )}
                                    </div>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    <div className="mb-3 rounded-md border bg-muted/20 p-3">
                                        <div className="font-medium text-foreground">
                                            SLA{' '}
                                            {item.sla_source === 'override'
                                                ? 'khusus'
                                                : 'standar'}
                                        </div>
                                        <div className="mt-1">
                                            {item.sla_days
                                                ? `${item.sla_days} hari`
                                                : 'Belum ditentukan'}{' '}
                                            · jatuh tempo{' '}
                                            {dateOnly(item.sla_due_at) ||
                                                'menunggu tanggal masuk notaris'}
                                        </div>
                                        {item.sla_source === 'override' && (
                                            <div className="mt-1 text-xs">
                                                Alasan: {item.sla_override_reason || 'Menunggu alasan'}
                                            </div>
                                        )}
                                        {item.sla_due_at && (
                                            <div className="mt-1 text-xs font-medium text-foreground">
                                                {slaState(item.sla_due_at)}
                                            </div>
                                        )}
                                    </div>
                                    {item.covernote_no || item.covernote_end ? (
                                        <>
                                            <div>
                                                No:{' '}
                                                {item.covernote_no ||
                                                    'Belum tersedia'}
                                            </div>
                                            <div>
                                                Jatuh tempo:{' '}
                                                {dateOnly(item.covernote_end) ||
                                                    'Belum tersedia'}
                                            </div>
                                        </>
                                    ) : (
                                        <div>
                                            Nomor dan tanggal jatuh tempo akan
                                            muncul setelah notaris mengajukan
                                            covernote.
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </details>

                {order.collaterals.some(
                    (item: any) => item.covernote_file_path,
                ) && (
                    <details className="sim-panel group">
                        <summary className="sim-panel-header flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
                            <div>
                                <div className="sim-panel-title">
                                    Covernote aktif
                                </div>
                                <p className="sim-panel-subtitle">
                                    File dan data covernote yang saat ini
                                    tercatat pada order.
                                </p>
                            </div>
                            <ChevronDown className="mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="divide-y">
                            {order.collaterals
                                .filter((item: any) => item.covernote_file_path)
                                .map((item: any) => (
                                    <div
                                        key={item.id}
                                        className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px]"
                                    >
                                        <div className="min-w-0">
                                            <div className="font-medium">
                                                {item.job_type?.name ??
                                                    'Agunan'}
                                            </div>
                                            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                                                <Info
                                                    label="Nomor covernote"
                                                    value={item.covernote_no}
                                                />
                                                <Info
                                                    label="Mulai berlaku"
                                                    value={
                                                        dateOnly(
                                                            item.covernote_start,
                                                        ) || '-'
                                                    }
                                                />
                                                <Info
                                                    label="Berakhir"
                                                    value={
                                                        dateOnly(
                                                            item.covernote_end,
                                                        ) || '-'
                                                    }
                                                />
                                            </div>
                                            <div className="mt-4 flex flex-wrap items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    asChild
                                                >
                                                    <a
                                                        href={`/orders/${order.id}/collaterals/${item.id}/covernote/preview`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                    >
                                                        Buka preview
                                                    </a>
                                                </Button>
                                                <SimStatusBadge
                                                    label={statusLabel(
                                                        order.status,
                                                    )}
                                                    tone={toneForStatus(
                                                        statusLabel(
                                                            order.status,
                                                        ),
                                                    )}
                                                />
                                            </div>
                                        </div>
                                        <iframe
                                            title={`Preview covernote ${item.covernote_no ?? item.id}`}
                                            src={`/orders/${order.id}/collaterals/${item.id}/covernote/preview`}
                                            className="h-56 w-full rounded-md border bg-muted"
                                        />
                                    </div>
                                ))}
                        </div>
                    </details>
                )}

                {order.collaterals.some((item: any) =>
                    item.covernote_extensions?.some(
                        (extension: any) =>
                            extension.status === 'menunggu_approval',
                    ),
                ) && (
                    <details className="sim-panel group border-warning/40">
                        <summary className="sim-panel-header flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
                            <div>
                                <div className="sim-panel-title">
                                    Perpanjangan covernote menunggu approval
                                </div>
                                <p className="sim-panel-subtitle">
                                    Notaris sudah mengajukan perubahan masa
                                    berlaku. Periksa sebelum menyetujui.
                                </p>
                            </div>
                            <ChevronDown className="mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="divide-y">
                            {order.collaterals.flatMap((item: any) =>
                                (item.covernote_extensions ?? [])
                                    .filter(
                                        (extension: any) =>
                                            extension.status ===
                                            'menunggu_approval',
                                    )
                                    .map((extension: any) => (
                                        <div
                                            key={extension.id}
                                            className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center"
                                        >
                                            <div className="text-sm">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <div className="font-medium">
                                                        {item.job_type?.name ??
                                                            'Agunan'}
                                                    </div>
                                                    <SimStatusBadge
                                                        label="Menunggu approval"
                                                        tone="warning"
                                                    />
                                                </div>
                                                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                                    <Info
                                                        label="Jatuh tempo sebelumnya"
                                                        value={dateOnly(
                                                            item.covernote_end,
                                                        )}
                                                    />
                                                    <Info
                                                        label="Jatuh tempo yang diajukan"
                                                        value={dateOnly(
                                                            extension.new_end,
                                                        )}
                                                    />
                                                </div>
                                                <div className="mt-3 text-muted-foreground">
                                                    Diajukan:{' '}
                                                    {dateOnly(
                                                        extension.created_at,
                                                    )}{' '}
                                                    oleh Notaris
                                                </div>
                                                <div className="mt-2">
                                                    <span className="font-medium">
                                                        Alasan pengajuan:
                                                    </span>{' '}
                                                    {extension.catatan ||
                                                        'Tidak ada catatan.'}
                                                </div>
                                            </div>
                                            <div className="grid gap-3">
                                                {extension.file_path && (
                                                    <iframe
                                                        title={`Preview perpanjangan ${extension.id}`}
                                                        src={`/orders/${order.id}/collaterals/${item.id}/covernote-extensions/${extension.id}/preview`}
                                                        className="h-48 w-full rounded-md border bg-muted"
                                                    />
                                                )}
                                                {canApproveCovernoteExtension ? (
                                                    <div className="flex flex-wrap gap-2">
                                                        <Button
                                                            type="button"
                                                            onClick={() =>
                                                                approveCovernoteExtension(
                                                                    item.id,
                                                                    extension.id,
                                                                )
                                                            }
                                                        >
                                                            <CheckCircle2 className="size-4" />
                                                            Setujui
                                                        </Button>
                                                        <form
                                                            onSubmit={(event) =>
                                                                rejectCovernoteExtension(
                                                                    event,
                                                                    item.id,
                                                                    extension.id,
                                                                )
                                                            }
                                                            className="grid gap-2 sm:grid-cols-[1fr_auto]"
                                                        >
                                                            <Input
                                                                name="reason"
                                                                aria-label="Alasan pengembalian"
                                                                placeholder="Alasan pengembalian"
                                                                required
                                                            />
                                                            <Button
                                                                type="submit"
                                                                variant="outline"
                                                            >
                                                                <AlertCircle className="size-4" />
                                                                Kembalikan
                                                            </Button>
                                                        </form>
                                                    </div>
                                                ) : (
                                                    <SimStatusBadge
                                                        label="Menunggu Admin Legal"
                                                        tone="warning"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    )),
                            )}
                        </div>
                    </details>
                )}

                {orderSentToNotary &&
                    order.document_requests?.some(
                        (item: any) => item.status === 'diminta',
                    ) && (
                        <details className="sim-panel group p-4">
                            <summary className="sim-panel-header flex cursor-pointer list-none items-start justify-between gap-4 px-0 pt-0 [&::-webkit-details-marker]:hidden">
                                <div>
                                    <div className="sim-panel-title">
                                        Permintaan dokumen susulan
                                    </div>
                                    <p className="sim-panel-subtitle">
                                        Unggah hanya dokumen yang diminta
                                        Notaris.
                                    </p>
                                </div>
                                <ChevronDown className="mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                            </summary>
                            <div className="divide-y rounded-md border">
                                {order.document_requests
                                    .filter(
                                        (item: any) =>
                                            item.status === 'diminta',
                                    )
                                    .map((item: any) => (
                                        <form
                                            key={item.id}
                                            onSubmit={(event) => {
                                                event.preventDefault();
                                                const form = new FormData(
                                                    event.currentTarget,
                                                );
                                                router.post(
                                                    `/orders/${order.id}/document-requests/${item.id}/fulfill`,
                                                    form,
                                                    {
                                                        forceFormData: true,
                                                        preserveScroll: true,
                                                    },
                                                );
                                            }}
                                            className="grid gap-3 p-3 md:grid-cols-[1fr_280px_auto] md:items-end"
                                        >
                                            <div className="text-sm">
                                                <div className="font-medium">
                                                    {item.name}
                                                </div>
                                                <div className="text-muted-foreground">
                                                    {item.reason}
                                                </div>
                                            </div>
                                            <Input
                                                type="file"
                                                name="file"
                                                accept="application/pdf"
                                                required
                                            />
                                            <Button disabled={!canManageOrder}>
                                                <Upload className="size-4" />
                                                Upload
                                            </Button>
                                        </form>
                                    ))}
                            </div>
                        </details>
                    )}

                {orderSentToNotary && (
                    <details className="sim-panel group">
                        <summary className="sim-panel-header flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
                            <div>
                                <h2 className="font-medium">Dokumen digital</h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Validasi dokumen final dilakukan dari daftar
                                    ini.
                                </p>
                            </div>
                            <ChevronDown className="mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="p-3 md:p-4">
                            {order.documents.length === 0 ? (
                                <div className="px-1 py-8 text-center text-sm text-muted-foreground">
                                    Belum ada dokumen.
                                </div>
                            ) : (
                                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                    {order.documents.map((document: any) => {
                                        const documentName =
                                            document.display_name ||
                                            checklistNameForDocument(
                                                order,
                                                document.id,
                                            ) ||
                                            documentTypeLabel(
                                                document.document_type,
                                            );
                                        const previewUrl = `/orders/${order.id}/documents/${document.id}/preview`;
                                        const downloadUrl = `/orders/${order.id}/documents/${document.id}/download`;

                                        return (
                                            <article
                                                key={document.id}
                                                className="group overflow-hidden rounded-md border border-border bg-card"
                                            >
                                                <a
                                                    href={previewUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="relative block h-44 overflow-hidden border-b border-border bg-muted/20"
                                                    aria-label={`Preview ${documentName}`}
                                                >
                                                    <iframe
                                                        src={previewUrl}
                                                        title={`Preview ${documentName}`}
                                                        className="pointer-events-none h-full w-full bg-white"
                                                    />
                                                    <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-background/90 px-3 py-2 text-xs font-medium text-foreground opacity-0 transition-opacity group-hover:opacity-100">
                                                        <span className="inline-flex items-center gap-1.5">
                                                            <Eye className="size-3.5" />
                                                            Buka preview
                                                        </span>
                                                        <span>
                                                            {
                                                                document.original_name
                                                            }
                                                        </span>
                                                    </span>
                                                </a>
                                                <div className="space-y-3 p-3.5">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex min-w-0 items-start gap-2.5">
                                                            <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                                            <div className="min-w-0">
                                                                <h3
                                                                    className="truncate font-medium"
                                                                    title={
                                                                        documentName
                                                                    }
                                                                >
                                                                    {
                                                                        documentName
                                                                    }
                                                                </h3>
                                                                <p className="mt-0.5 text-xs text-muted-foreground">
                                                                    {document.document_type ===
                                                                    'lainnya'
                                                                        ? 'Dokumen susulan'
                                                                        : documentTypeLabel(
                                                                              document.document_type,
                                                                          )}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                                        <div>
                                                            <div className="text-muted-foreground">
                                                                Agunan
                                                            </div>
                                                            <div className="mt-1 text-sm">
                                                                {document
                                                                    .collateral
                                                                    ?.job_type
                                                                    ?.name ??
                                                                    '-'}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="text-muted-foreground">
                                                                Versi / ukuran
                                                            </div>
                                                            <div className="mt-1 text-sm">
                                                                v
                                                                {
                                                                    document.version
                                                                }{' '}
                                                                ·{' '}
                                                                {formatBytes(
                                                                    document.file_size,
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
                                                        <span className="truncate">
                                                            {document.uploader
                                                                ?.name ??
                                                                '-'}{' '}
                                                            ·{' '}
                                                            {formatTimelineDate(
                                                                document.created_at,
                                                            )}
                                                        </span>
                                                        <a
                                                            href={downloadUrl}
                                                            title={`Unduh ${documentName}`}
                                                            aria-label={`Unduh ${documentName}`}
                                                            className="sim-icon-button"
                                                        >
                                                            <Download className="size-4" />
                                                        </a>
                                                    </div>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        {canValidateDocuments && finalRevisionDocument && (
                            <form
                                onSubmit={submitFinalRevision}
                                className="border-t p-4"
                            >
                                <div className="font-medium">
                                    Kembalikan dokumen final
                                </div>
                                <textarea
                                    className="sim-input mt-3 min-h-20 py-2"
                                    value={finalRevision.data.reason}
                                    onChange={(event) =>
                                        finalRevision.setData(
                                            'reason',
                                            event.target.value,
                                        )
                                    }
                                    placeholder="Alasan perbaikan wajib diisi"
                                />
                                <InputError
                                    message={finalRevision.errors.reason}
                                />
                                <div className="mt-3 flex gap-2">
                                    <Button
                                        type="submit"
                                        variant="destructive"
                                        disabled={
                                            finalRevision.processing ||
                                            !finalRevision.data.reason.trim()
                                        }
                                    >
                                        Kirim revisi
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() =>
                                            setFinalRevisionDocument(null)
                                        }
                                    >
                                        Batal
                                    </Button>
                                </div>
                            </form>
                        )}
                    </details>
                )}

                {canManageHandovers && (
                    <form onSubmit={submitHandover} className="sim-panel p-4">
                        <h2 className="font-medium">Handover dokumen fisik</h2>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <SimSelect
                                value={handover.data.order_collateral_id}
                                onChange={(value) =>
                                    handover.setData(
                                        'order_collateral_id',
                                        value,
                                    )
                                }
                                options={order.collaterals.map((item: any) => ({
                                    value: String(item.id),
                                    label: `${item.job_type?.name} - ${item.agunan_id || item.id}`,
                                }))}
                            />
                            <Input
                                placeholder="Nama penerima"
                                value={handover.data.receiver_name}
                                onChange={(e) =>
                                    handover.setData(
                                        'receiver_name',
                                        e.target.value,
                                    )
                                }
                            />
                            <SimSelect
                                value={handover.data.method}
                                onChange={(value) =>
                                    handover.setData('method', value)
                                }
                                options={handoverMethods.map((method) => ({
                                    value: method.value,
                                    label: method.label,
                                }))}
                            />
                            <Input
                                type="date"
                                value={handover.data.handed_over_at}
                                onChange={(e) =>
                                    handover.setData(
                                        'handed_over_at',
                                        e.target.value,
                                    )
                                }
                            />
                            <SimFileUpload
                                value={handover.data.receipt}
                                onChange={(file) =>
                                    handover.setData('receipt', file)
                                }
                                label="Pilih tanda terima"
                            />
                            <textarea
                                className="sim-input min-h-20 py-2"
                                value={handover.data.catatan}
                                onChange={(e) =>
                                    handover.setData('catatan', e.target.value)
                                }
                                placeholder="Catatan"
                            />
                        </div>
                        <Button className="mt-4" disabled={handover.processing}>
                            <ClipboardCheck className="size-4" />
                            Catat handover
                        </Button>
                    </form>
                )}

                {!orderSentToNotary && canViewInitialDocuments && (
                    <details
                        id="kelengkapan-dokumen"
                        className="sim-panel group"
                        open={documentsOpen}
                        onToggle={(event) =>
                            setDocumentsOpen(event.currentTarget.open)
                        }
                    >
                        <summary className="sim-panel-header flex cursor-pointer list-none flex-col gap-3 md:flex-row md:items-center md:justify-between [&::-webkit-details-marker]:hidden">
                            <div>
                                <h2 className="font-medium">
                                    {canManageOrder
                                        ? 'Kelengkapan dokumen awal'
                                        : 'Dokumen order'}
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {canManageOrder
                                        ? 'Upload setiap dokumen pada persyaratannya. Checklist akan lengkap otomatis setelah upload berhasil.'
                                        : 'Periksa dokumen checklist dan dokumen pendukung sebelum memberikan approval.'}
                                </p>
                            </div>
                            {canManageOrder && (
                                <div className="text-sm text-muted-foreground">
                                    Siapkan dokumen agunan dan dokumen
                                    pendukung. PDF maksimal 10 MB per file.
                                </div>
                            )}
                            <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 md:mt-0.5" />
                        </summary>
                        <div className="divide-y">
                            {order.collaterals.map((collateral: any) => (
                                <div key={collateral.id} className="p-4">
                                    <div className="font-medium">
                                        {collateral.job_type?.name ?? 'Agunan'}
                                        {collateral.agunan_id
                                            ? ` - ${collateral.agunan_id}`
                                            : ` - AGN-${collateral.id}`}
                                    </div>
                                    <div className="mt-1 text-sm text-muted-foreground">
                                        {collateral.deskripsi_agunan ||
                                            'Kelengkapan dokumen untuk agunan ini.'}
                                    </div>
                                    {canManageOrder && (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setDocumentEditor({
                                                    collateralId: String(
                                                        collateral.id,
                                                    ),
                                                    checklistId: '',
                                                    displayName: '',
                                                    file: null,
                                                    kind: 'pendukung',
                                                })
                                            }
                                        >
                                            <FilePlus2 className="size-4" />
                                            Tambah dokumen pendukung
                                        </Button>
                                        </div>
                                    )}
                                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                                        {collateral.checklists.map(
                                            (item: any) => {
                                                return (
                                                    <div
                                                        key={item.id}
                                                        className="sim-metric grid gap-3 text-sm"
                                                    >
                                                        <label className="flex items-start gap-3">
                                                            <span
                                                                className={
                                                                    item.order_document
                                                                        ? 'mt-0.5 flex size-5 items-center justify-center rounded border border-green-500 bg-green-500 text-xs text-white'
                                                                        : 'mt-0.5 flex size-5 items-center justify-center rounded border border-input text-xs text-muted-foreground'
                                                                }
                                                            >
                                                                {item.order_document
                                                                    ? '✓'
                                                                    : ''}
                                                            </span>
                                                            <span className="font-medium">
                                                                {
                                                                    item
                                                                        .document_checklist
                                                                        ?.name
                                                                }
                                                            </span>
                                                        </label>
                                                        {item.order_document ? (
                                                            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs">
                                                                <div className="min-w-0 flex-1">
                                                                    <a
                                                                        className="block truncate text-primary underline-offset-4 hover:underline"
                                                                        href={`/orders/${order.id}/documents/${item.order_document.id}/download`}
                                                                    >
                                                                        File:{' '}
                                                                        {item
                                                                            .order_document
                                                                            .display_name ??
                                                                            item
                                                                                .order_document
                                                                                .original_name}
                                                                    </a>
                                                                    <span className="text-muted-foreground">
                                                                        {formatBytes(
                                                                            item
                                                                                .order_document
                                                                                .file_size,
                                                                        )}
                                                                    </span>
                                                                </div>
                                                                {canManageOrder && (
                                                                    <span className="flex shrink-0 items-center gap-1">
                                                                    <Button
                                                                        type="button"
                                                                        size="icon"
                                                                        className="size-8 shrink-0 bg-foreground text-background hover:bg-foreground/90"
                                                                        title="Edit dokumen"
                                                                        aria-label="Edit dokumen"
                                                                        onClick={() =>
                                                                            setDocumentEditor(
                                                                                {
                                                                                    collateralId:
                                                                                        String(
                                                                                            collateral.id,
                                                                                        ),
                                                                                    documentId:
                                                                                        item
                                                                                            .order_document
                                                                                            .id,
                                                                                    existingName:
                                                                                        item
                                                                                            .order_document
                                                                                            .display_name ??
                                                                                        item
                                                                                            .order_document
                                                                                            .original_name,
                                                                                    checklistId:
                                                                                        String(
                                                                                            item.id,
                                                                                        ),
                                                                                    displayName:
                                                                                        item
                                                                                            .order_document
                                                                                            .display_name ??
                                                                                        '',
                                                                                    file: null,
                                                                                    kind: 'agunan',
                                                                                },
                                                                            )
                                                                        }
                                                                    >
                                                                        <Pencil className="size-4" />
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        size="icon"
                                                                        className="size-8 shrink-0 bg-foreground text-background hover:bg-foreground/90"
                                                                        title="Hapus dokumen"
                                                                        aria-label="Hapus dokumen"
                                                                        onClick={() =>
                                                                            router.delete(
                                                                                `/orders/${order.id}/documents/${item.order_document.id}`,
                                                                                {
                                                                                    preserveScroll: true,
                                                                                },
                                                                            )
                                                                        }
                                                                    >
                                                                        <Trash2 className="size-4" />
                                                                    </Button>
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : canManageOrder ? (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                className="h-auto justify-start p-0 text-left text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
                                                                onClick={() =>
                                                                    openChecklistEditor(
                                                                        String(
                                                                            collateral.id,
                                                                        ),
                                                                        String(
                                                                            item.id,
                                                                        ),
                                                                    )
                                                                }
                                                            >
                                                                Belum ada file.
                                                                Klik untuk input
                                                                dokumen.
                                                            </Button>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">
                                                                Belum ada file.
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            },
                                        )}
                                    </div>
                                    {(
                                        collateral.documents ?? []
                                    ).filter(
                                        (document: any) =>
                                            (document.document_type?.value ??
                                                document.document_type) ===
                                            'lainnya',
                                    ).length > 0 && (
                                        <div className="mt-4 rounded-md border border-dashed p-3">
                                            <div className="mb-2 text-sm font-medium">
                                                Dokumen pendukung
                                            </div>
                                            <div className="grid gap-2 md:grid-cols-2">
                                                {(
                                                    collateral.documents ?? []
                                                )
                                                    .filter(
                                                        (document: any) =>
                                                            (document.document_type?.value ??
                                                                document.document_type) ===
                                                            'lainnya',
                                                    )
                                                    .map((document: any) => (
                                                        <div
                                                            key={document.id}
                                                            className="flex min-w-0 items-center justify-between gap-3 rounded-md border p-3 text-sm"
                                                        >
                                                            <div className="min-w-0">
                                                                <a
                                                                    className="block truncate text-primary underline-offset-4 hover:underline"
                                                                    href={`/orders/${order.id}/documents/${document.id}/download`}
                                                                >
                                                                    {document.display_name ||
                                                                        document.original_name}
                                                                </a>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {formatBytes(
                                                                        document.file_size,
                                                                    )}
                                                                </span>
                                                            </div>
                                                            {canManageOrder && (
                                                                <span className="flex shrink-0 items-center gap-1">
                                                                <Button
                                                                    type="button"
                                                                    size="icon"
                                                                    className="size-8 bg-foreground text-background hover:bg-foreground/90"
                                                                    title="Edit dokumen pendukung"
                                                                    aria-label="Edit dokumen pendukung"
                                                                    onClick={() =>
                                                                        setDocumentEditor(
                                                                            {
                                                                                collateralId:
                                                                                    String(
                                                                                        collateral.id,
                                                                                    ),
                                                                                documentId:
                                                                                    document.id,
                                                                                existingName:
                                                                                    document.display_name ??
                                                                                    document.original_name,
                                                                                checklistId:
                                                                                    '',
                                                                                displayName:
                                                                                    document.display_name ??
                                                                                    '',
                                                                                file: null,
                                                                                kind: 'pendukung',
                                                                            },
                                                                        )
                                                                    }
                                                                >
                                                                    <Pencil className="size-4" />
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    size="icon"
                                                                    className="size-8 bg-foreground text-background hover:bg-foreground/90"
                                                                    title="Hapus dokumen pendukung"
                                                                    aria-label="Hapus dokumen pendukung"
                                                                    onClick={() =>
                                                                        router.delete(
                                                                            `/orders/${order.id}/documents/${document.id}`,
                                                                            {
                                                                                preserveScroll: true,
                                                                            },
                                                                        )
                                                                    }
                                                                >
                                                                    <Trash2 className="size-4" />
                                                                </Button>
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </details>
                )}

                <Dialog
                    open={Boolean(documentEditor)}
                    onOpenChange={(open) => !open && setDocumentEditor(null)}
                >
                    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>
                                {documentEditor?.kind === 'pendukung'
                                    ? 'Tambah dokumen pendukung'
                                    : 'Input dokumen agunan'}
                            </DialogTitle>
                            <DialogDescription>
                                Masukkan satu file untuk record ini. File akan
                                langsung disimpan saat tombol simpan ditekan.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4">
                            {documentEditor?.kind === 'pendukung' && (
                                <div className="grid gap-2">
                                    <Label>Nama dokumen</Label>
                                    <Input
                                        value={documentEditor.displayName}
                                        onChange={(event) =>
                                            setDocumentEditor((current) =>
                                                current
                                                    ? {
                                                          ...current,
                                                          displayName:
                                                              event.target
                                                                  .value,
                                                      }
                                                    : current,
                                            )
                                        }
                                        placeholder="Contoh: Surat kuasa tambahan"
                                    />
                                </div>
                            )}
                            {documentEditor?.existingName && (
                                <div className="max-w-full min-w-0 overflow-hidden rounded-md border bg-muted/20 p-3 text-sm">
                                    <div className="truncate">
                                        File saat ini:{' '}
                                        <span className="font-medium">
                                            {documentEditor.existingName}
                                        </span>
                                    </div>
                                    <iframe
                                        title={`Preview ${documentEditor.existingName}`}
                                        src={`/orders/${order.id}/documents/${documentEditor.documentId}/download`}
                                        className="mt-2 block h-[min(65vh,34rem)] w-full rounded border bg-background"
                                    />
                                </div>
                            )}
                            <SimFileUpload
                                value={documentEditor?.file ?? null}
                                onChange={(file) =>
                                    setDocumentEditor((current) =>
                                        current
                                            ? { ...current, file }
                                            : current,
                                    )
                                }
                                label={
                                    documentEditor?.documentId
                                        ? 'Pilih file pengganti (opsional)'
                                        : 'Pilih file PDF'
                                }
                            />
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setDocumentEditor(null)}
                            >
                                Batal
                            </Button>
                            <Button
                                type="button"
                                onClick={saveDocumentEditor}
                                disabled={
                                    (!documentEditor?.documentId &&
                                        !documentEditor?.file) ||
                                    (documentEditor?.kind === 'pendukung' &&
                                        !documentEditor.displayName.trim())
                                }
                            >
                                <Save className="size-4" />
                                Simpan dokumen
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {order.progress?.length > 0 && (
                    <section className="sim-panel">
                        <div className="sim-panel-header sim-panel-title">
                            Riwayat progres
                        </div>
                        <div className="divide-y">
                            {order.progress.map((item: any) => {
                                const finalDocuments =
                                    item.status === 'Selesai'
                                        ? order.documents.filter(
                                              (document: any) =>
                                                  document.document_type ===
                                                      'final' &&
                                                  document.order_collateral_id ===
                                                      item.order_collateral_id,
                                          )
                                        : [];
                                const allFinalDocumentsValidated =
                                    finalDocuments.length > 0 &&
                                    finalDocuments.every(
                                        (document: any) => document.validated_at,
                                    );

                                return (
                                    <div
                                        key={item.id}
                                        className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[145px_minmax(0,1fr)_180px] md:items-center"
                                    >
                                        <div className="flex items-center gap-2 text-xs whitespace-nowrap text-muted-foreground">
                                            <span className="size-2 shrink-0 rounded-full bg-primary" />
                                            Proses notaris
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-medium">
                                                {progressLabel(item.status)}
                                            </div>
                                            <div className="mt-1 text-xs text-muted-foreground">
                                                {item.collateral?.job_type?.name ??
                                                    'Agunan'}{' '}
                                                · Komitmen{' '}
                                                {dateOnly(
                                                    item.komitmen_penyelesaian,
                                                ) || '-'}
                                            </div>
                                            {item.catatan && (
                                                <div className="mt-1 truncate text-xs text-muted-foreground">
                                                    {item.catatan}
                                                </div>
                                            )}
                                            {finalDocuments.length > 0 && (
                                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                                    <SimStatusBadge
                                                        label={
                                                            allFinalDocumentsValidated
                                                                ? 'Tervalidasi'
                                                                : 'Menunggu validasi'
                                                        }
                                                        tone={
                                                            allFinalDocumentsValidated
                                                                ? 'success'
                                                                : 'warning'
                                                        }
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            setProgressDocumentsPreview(
                                                                finalDocuments,
                                                            )
                                                        }
                                                    >
                                                        <Eye className="size-4" />
                                                        Lihat dokumen final ({finalDocuments.length})
                                                    </Button>
                                                </div>
                                            )}
                                            <div className="mt-1 text-xs text-muted-foreground">
                                                Oleh {item.user?.name ?? 'Notaris'}
                                            </div>
                                        </div>
                                        <div className="text-xs text-muted-foreground md:text-right">
                                            {formatTimelineDate(item.created_at)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                <Dialog
                    open={Boolean(progressDocumentsPreview)}
                    onOpenChange={(open) =>
                        !open && setProgressDocumentsPreview(null)
                    }
                >
                    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>Dokumen final progres selesai</DialogTitle>
                            <DialogDescription>
                                Periksa dan validasi dokumen final dari progres ini.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2">
                            {(progressDocumentsPreview ?? []).map(
                                (document: any) => (
                                    <div
                                        key={document.id}
                                        className="flex items-center gap-3 rounded-md border p-3 text-sm"
                                    >
                                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                                        <a
                                            href={`/orders/${order.id}/documents/${document.id}/preview`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="min-w-0 flex-1 truncate font-medium hover:underline"
                                        >
                                            {document.original_name}
                                        </a>
                                        {document.validated_at ? (
                                            <SimStatusBadge
                                                label="Tervalidasi"
                                                tone="success"
                                            />
                                        ) : canValidateDocuments ? (
                                            <div className="flex shrink-0 gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                        router.post(
                                                            `/orders/${order.id}/documents/${document.id}/validate-final`,
                                                            {},
                                                            {
                                                                preserveScroll: true,
                                                                onSuccess: () =>
                                                                    setProgressDocumentsPreview(
                                                                        null,
                                                                    ),
                                                            },
                                                        )
                                                    }
                                                >
                                                    <FileCheck2 className="size-4" />
                                                    Setujui
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        setFinalRevisionDocument(
                                                            document.id,
                                                        );
                                                        setProgressDocumentsPreview(
                                                            null,
                                                        );
                                                    }}
                                                >
                                                    Revisi
                                                </Button>
                                            </div>
                                        ) : (
                                            <SimStatusBadge
                                                label="Menunggu validasi"
                                                tone="warning"
                                            />
                                        )}
                                    </div>
                                ),
                            )}
                        </div>
                    </DialogContent>
                </Dialog>

                <section className="sim-panel">
                    <div className="sim-panel-header sim-panel-title">
                        Riwayat status
                    </div>
                    <div className="divide-y">
                        {order.status_histories.length === 0 ? (
                            <SimEmptyState
                                title="Belum ada riwayat status"
                                description="Perubahan status order akan muncul di sini."
                            />
                        ) : (
                            order.status_histories.map((history: any) => (
                                <div
                                    key={history.id}
                                    className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[145px_minmax(0,1fr)_180px] md:items-center"
                                >
                                    <div className="flex items-center gap-2 text-xs whitespace-nowrap text-muted-foreground">
                                        <span className="size-2 shrink-0 rounded-full bg-primary" />
                                        {trackLabel(history.track)}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-medium">
                                            {historyEventLabel(
                                                history.to_status,
                                            )}
                                        </div>
                                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                                            {history.from_status && (
                                                <SimStatusBadge
                                                    label={statusLabel(
                                                        history.from_status,
                                                    )}
                                                    tone={toneForStatus(
                                                        statusLabel(
                                                            history.from_status,
                                                        ),
                                                    )}
                                                />
                                            )}
                                            {history.from_status && (
                                                <span
                                                    className="text-muted-foreground"
                                                    aria-hidden="true"
                                                >
                                                    →
                                                </span>
                                            )}
                                            <SimStatusBadge
                                                label={statusLabel(
                                                    history.to_status,
                                                )}
                                                tone={toneForStatus(
                                                    statusLabel(
                                                        history.to_status,
                                                    ),
                                                )}
                                            />
                                        </div>
                                        {history.reason && (
                                            <div
                                                className="mt-1 truncate text-xs text-muted-foreground"
                                                title={history.reason}
                                            >
                                                {history.reason}
                                            </div>
                                        )}
                                        <div className="mt-1 text-xs text-muted-foreground">
                                            Oleh{' '}
                                            {actorLabel(
                                                history.actor_type,
                                                history.actor,
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground md:text-right">
                                        {formatTimelineDate(history.created_at)}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            </div>
        </>
    );
}

function Info({ label, value }: { label: string; value?: string | null }) {
    return (
        <div>
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="mt-1 font-medium">{value || '-'}</div>
        </div>
    );
}

function BatchFilePreview({
    file,
    onChange,
}: {
    file: File;
    onChange: (file: File | null) => void;
}) {
    const [url, setUrl] = useState<string | null>(null);
    useEffect(() => {
        const next = URL.createObjectURL(file);
        setUrl(next);
        return () => URL.revokeObjectURL(next);
    }, [file]);

    return (
        <div className="rounded-md border bg-background p-2">
            <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-medium">{file.name}</span>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Hapus file"
                    onClick={() => onChange(null)}
                >
                    <Trash2 className="size-4" />
                </Button>
            </div>
            {url && (
                <iframe
                    title={`Preview ${file.name}`}
                    src={url}
                    className="mt-2 h-28 w-full rounded border"
                />
            )}
        </div>
    );
}

function DraftOrderForm({
    draft,
    branches,
    notaries,
    jobTypes,
    slaPolicies,
    setCollateral,
    incompleteFields,
    saveState,
}: {
    draft: any;
    branches: any[];
    notaries: any[];
    jobTypes: any[];
    slaPolicies: Record<string, { days: number; source: string }>;
    setCollateral: (
        index: number,
        key: keyof CollateralDraft,
        value: string,
    ) => void;
    incompleteFields: string[];
    saveState: 'saved' | 'pending' | 'saving' | 'error';
}) {
    return (
        <div className="sim-panel overflow-hidden">
            <div className="sim-panel-header flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="sim-panel-title">Lengkapi order</h2>
                    <p className="sim-panel-subtitle">
                        Simpan bertahap. Order belum terlihat oleh notaris
                        sampai dikirim.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                        {saveState === 'saving'
                            ? 'Menyimpan...'
                            : saveState === 'pending'
                              ? 'Perubahan akan disimpan...'
                              : saveState === 'error'
                                ? 'Gagal menyimpan'
                                : 'Semua perubahan tersimpan'}
                    </span>
                </div>
            </div>
            {incompleteFields.length > 0 && (
                <div className="border-b border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    <span className="font-medium">Belum siap dikirim.</span>{' '}
                    Lengkapi: {incompleteFields.join(', ')}.
                </div>
            )}
            <div className="grid gap-4 p-4 md:grid-cols-2">
                <DraftField
                    label="Cabang"
                    required
                    invalid={!draft.data.branch_id}
                    error={draft.errors.branch_id}
                >
                    <SimSelect
                        value={draft.data.branch_id}
                        onChange={(value) => draft.setData('branch_id', value)}
                        options={branches.map((item) => ({
                            value: String(item.id),
                            label: `${item.code} - ${item.name}`,
                        }))}
                        placeholder="Pilih cabang"
                    />
                </DraftField>
                <DraftField
                    label="Notaris"
                    required
                    invalid={!draft.data.notary_id}
                    error={draft.errors.notary_id}
                >
                    <SimSelect
                        value={draft.data.notary_id}
                        onChange={(value) => draft.setData('notary_id', value)}
                        options={notaries.map((item) => ({
                            value: String(item.id),
                            label: item.name,
                        }))}
                        placeholder="Pilih notaris"
                    />
                </DraftField>
                <DraftField
                    label="Nama nasabah"
                    required
                    invalid={!draft.data.customer_name}
                    error={draft.errors.customer_name}
                >
                    <Input
                        value={draft.data.customer_name}
                        onChange={(event) =>
                            draft.setData('customer_name', event.target.value)
                        }
                    />
                </DraftField>
                <DraftField
                    label="No rekening"
                    required
                    invalid={!draft.data.no_rekening}
                    error={draft.errors.no_rekening}
                >
                    <Input
                        value={draft.data.no_rekening}
                        onChange={(event) =>
                            draft.setData('no_rekening', event.target.value)
                        }
                    />
                </DraftField>
                <DraftField
                    label="Tanggal akad"
                    required
                    invalid={!draft.data.tgl_realisasi}
                    error={draft.errors.tgl_realisasi}
                >
                    <Input
                        type="date"
                        value={draft.data.tgl_realisasi}
                        onChange={(event) =>
                            draft.setData('tgl_realisasi', event.target.value)
                        }
                    />
                </DraftField>
                <DraftField
                    label="Tanggal masuk notaris"
                    error={draft.errors.tgl_masuk_notaris}
                >
                    <Input
                        type="date"
                        value={draft.data.tgl_masuk_notaris}
                        onChange={(event) =>
                            draft.setData(
                                'tgl_masuk_notaris',
                                event.target.value,
                            )
                        }
                    />
                    <p className="text-xs text-muted-foreground">
                        Menjadi titik awal perhitungan SLA.
                    </p>
                </DraftField>
                <DraftField label="Plafon">
                    <RupiahInput
                        value={draft.data.plafon}
                        onChange={(value) => draft.setData('plafon', value)}
                    />
                </DraftField>
                <DraftField label="Nominal jasa">
                    <RupiahInput
                        value={draft.data.nominal}
                        onChange={(value) => draft.setData('nominal', value)}
                    />
                </DraftField>
                <DraftField label="Skema pembayaran">
                    <Input
                        list="payment-schemes"
                        value={draft.data.skema_pembayaran}
                        onChange={(event) =>
                            draft.setData(
                                'skema_pembayaran',
                                event.target.value,
                            )
                        }
                        placeholder="Pilih atau ketik skema"
                    />
                    <datalist id="payment-schemes">
                        <option value="Transfer penuh" />
                        <option value="Lainnya" />
                    </datalist>
                </DraftField>
            </div>
            <div className="border-t p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                        <h3 className="font-medium">Agunan</h3>
                        <p className="text-sm text-muted-foreground">
                            Minimal satu agunan lengkap sebelum dikirim.
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            draft.setData('collaterals', [
                                ...draft.data.collaterals,
                                emptyCollateralDraft(),
                            ])
                        }
                    >
                        <Plus className="size-4" />
                        Tambah agunan
                    </Button>
                </div>
                <div className="grid gap-4">
                    {draft.data.collaterals.map(
                        (item: CollateralDraft, index: number) => (
                            <div
                                key={index}
                                className="grid gap-4 rounded-md border p-4 md:grid-cols-2"
                            >
                                <DraftField
                                    label="Jenis pekerjaan"
                                    required
                                    invalid={!item.job_type_id}
                                    error={
                                        draft.errors[
                                            `collaterals.${index}.job_type_id`
                                        ]
                                    }
                                >
                                    <SimSelect
                                        value={item.job_type_id}
                                        onChange={(value) =>
                                            setCollateral(
                                                index,
                                                'job_type_id',
                                                value,
                                            )
                                        }
                                        options={jobTypes.map((type) => ({
                                            value: String(type.id),
                                            label: type.name,
                                        }))}
                                        placeholder="Pilih jenis pekerjaan"
                                    />
                                </DraftField>
                                <DraftField label="ID agunan">
                                    <Input
                                        value={item.agunan_id}
                                        onChange={(event) =>
                                            setCollateral(
                                                index,
                                                'agunan_id',
                                                event.target.value,
                                            )
                                        }
                                    />
                                </DraftField>
                                <DraftField
                                    label="Deskripsi agunan"
                                    required
                                    invalid={!item.deskripsi_agunan}
                                    error={
                                        draft.errors[
                                            `collaterals.${index}.deskripsi_agunan`
                                        ]
                                    }
                                >
                                    <textarea
                                        className={`sim-input min-h-24 py-2 ${!item.deskripsi_agunan ? 'border-destructive/70 focus-visible:ring-destructive/30' : ''}`}
                                        value={item.deskripsi_agunan}
                                        onChange={(event) =>
                                            setCollateral(
                                                index,
                                                'deskripsi_agunan',
                                                event.target.value,
                                            )
                                        }
                                    />
                                </DraftField>
                                <DraftField
                                    label="SLA order (hari)"
                                    error={
                                        draft.errors[
                                            `collaterals.${index}.sla_days`
                                        ]
                                    }
                                >
                                    <Input
                                        type="number"
                                        min={1}
                                        max={365}
                                        value={item.sla_days}
                                        placeholder={
                                            slaPolicies[item.job_type_id]
                                                ? String(
                                                      slaPolicies[
                                                          item.job_type_id
                                                      ].days,
                                                  )
                                                : 'Otomatis dari kebijakan'
                                        }
                                        onChange={(event) =>
                                            setCollateral(
                                                index,
                                                'sla_days',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Kosongkan untuk memakai SLA standar. Isi
                                        berbeda wajib disertai alasan.
                                    </p>
                                </DraftField>
                                {item.sla_days &&
                                    slaPolicies[item.job_type_id] &&
                                    Number(item.sla_days) !==
                                        slaPolicies[item.job_type_id].days && (
                                        <DraftField
                                            label="Alasan perubahan SLA"
                                            error={
                                                draft.errors[
                                                    `collaterals.${index}.sla_override_reason`
                                                ]
                                            }
                                        >
                                            <textarea
                                                className="sim-input min-h-20 py-2"
                                                value={
                                                    item.sla_override_reason
                                                }
                                                onChange={(event) =>
                                                    setCollateral(
                                                        index,
                                                        'sla_override_reason',
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Jelaskan alasan SLA khusus"
                                            />
                                        </DraftField>
                                    )}
                                {draft.data.collaterals.length > 1 && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="w-fit"
                                        onClick={() =>
                                            draft.setData(
                                                'collaterals',
                                                draft.data.collaterals.filter(
                                                    (
                                                        _: unknown,
                                                        itemIndex: number,
                                                    ) => itemIndex !== index,
                                                ),
                                            )
                                        }
                                    >
                                        <Trash2 className="size-4" />
                                        Hapus agunan
                                    </Button>
                                )}
                            </div>
                        ),
                    )}
                </div>
            </div>
        </div>
    );
}

function DraftField({
    label,
    error,
    required = false,
    invalid = false,
    children,
}: {
    label: string;
    error?: string;
    required?: boolean;
    invalid?: boolean;
    children: ReactNode;
}) {
    return (
        <div className="grid gap-2">
            <Label className={invalid ? 'text-destructive' : undefined}>
                {label}
                {required && <span className="ml-1 text-destructive">*</span>}
            </Label>
            {children}
            <InputError message={error} />
        </div>
    );
}

function dateInput(value?: string | null) {
    return value?.slice(0, 10) ?? '';
}

function emptyCollateralDraft(): CollateralDraft {
    return {
        id: '',
        job_type_id: '',
        agunan_id: '',
        deskripsi_agunan: '',
        covernote_no: '',
        covernote_start: '',
        covernote_end: '',
        sla_days: '',
        sla_override_reason: '',
    };
}

function money(value?: string | number | null) {
    if (!value) return '-';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(Number(value));
}

function formatBytes(bytes?: number | null): string {
    if (!bytes) return 'Ukuran tidak tersedia';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function dateOnly(value?: string | null) {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);

    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(date);
}

function progressLabel(value?: string | null): string {
    if (!value) return '-';

    return value
        .replaceAll('_', ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

function slaState(value?: string | null) {
    if (!value) return 'SLA belum dimulai';
    const due = new Date(value);
    const today = new Date();
    const days = Math.ceil((due.getTime() - today.getTime()) / 86400000);
    if (days < 0) return `Terlambat ${Math.abs(days)} hari`;
    if (days <= 7) return `Mendekati batas, tersisa ${days} hari`;
    return `Aman, tersisa ${days} hari`;
}

function formatTimelineDate(value?: string | null) {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
        .format(date)
        .replace('.', ':');
}

function statusValue(status?: unknown): string {
    if (status && typeof status === 'object' && 'value' in status)
        return String((status as { value: string }).value);

    return status == null ? '' : String(status);
}

const trackAStages = orderJourneyStages;

const docStages = [
    { label: 'Verifikasi', keys: ['menunggu_verifikasi'] },
    { label: 'Valid', keys: ['dokumen_valid'] },
    { label: 'Draft', keys: ['draft_diunggah'] },
    { label: 'Final', keys: ['final_diunggah'] },
    { label: 'Divalidasi', keys: ['final_divalidasi'] },
];

const covernoteStages = [
    { label: 'Aktif', keys: ['aktif'] },
    { label: 'Hampir jatuh tempo', keys: ['mendekati_jatuh_tempo'] },
    { label: 'Diperpanjang', keys: ['diperpanjang'] },
    { label: 'Sertifikat', keys: ['diganti_sertifikat'] },
    { label: 'Kedaluwarsa', keys: ['kedaluwarsa'] },
];

const paymentStages = [
    { label: 'Belum diajukan', keys: ['belum_ajuan'] },
    { label: 'Diajukan', keys: ['diajukan'] },
    { label: 'Diverifikasi', keys: ['diverifikasi_admin'] },
    { label: 'Disetujui', keys: ['disetujui'] },
    { label: 'Dibayar', keys: ['dibayar'] },
];

function OrderTrackingHero({ order }: { order: any }) {
    const orderStatus = statusValue(order.status);
    const blockers = trackerBlockers(order);
    const history = order.status_histories ?? [];
    const stages = resolveStages(trackAStages, orderStatus);

    return (
        <section className="sim-panel overflow-hidden">
            <div className="border-b p-4 md:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <div className="text-sm font-medium">
                            {order.customer_name}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {order.branch?.name ?? '-'} ·{' '}
                            {order.notary?.name ?? '-'}
                        </p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                        Diperbarui {formatTimelineDate(history[0]?.created_at)}
                    </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    <Info label="Maker" value={order.maker?.name} />
                    <Info label="Plafon" value={money(order.plafon)} />
                    <Info label="Nominal jasa" value={money(order.nominal)} />
                    <Info
                        label="Dibuat"
                        value={formatTimelineDate(order.created_at)}
                    />
                </div>
            </div>
            {blockers.length > 0 && (
                <div className="border-t px-4 py-3 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                        Perlu perhatian:
                    </span>{' '}
                    {blockers.join(' · ')}
                </div>
            )}
            <div className="grid gap-0 lg:grid-cols-[1fr_280px]">
                <div className="border-b p-4 lg:border-r lg:border-b-0">
                    <div className="mb-3 flex items-center gap-2">
                        <Clock3 className="size-4" />
                        <h3 className="font-medium">Journey pengajuan</h3>
                    </div>
                    <SimTimeline
                        items={stages.map((stage, index) => {
                            const stageHistory = history.find((item: any) =>
                                stage.keys.includes(
                                    statusValue(item.to_status),
                                ),
                            );
                            return {
                                id: stage.label,
                                title: stage.label,
                                description: stage.active
                                    ? (stageHistory?.reason ??
                                      'Order sedang berada di tahap ini.')
                                    : stage.done
                                      ? (stageHistory?.reason ??
                                        'Tahap telah dilewati.')
                                      : 'Tahap berikutnya dalam alur pengajuan.',
                                timestamp: stageHistory?.created_at
                                    ? formatTimelineDate(
                                          stageHistory.created_at,
                                      )
                                    : stage.active
                                      ? 'Sedang berjalan'
                                      : undefined,
                                icon: [
                                    FilePlus2,
                                    ShieldCheck,
                                    Scale,
                                    BadgeCheck,
                                    PackageCheck,
                                    CheckCircle2,
                                ][index],
                                state:
                                    stage.state === 'blocked'
                                        ? ('danger' as const)
                                        : stage.active
                                          ? ('current' as const)
                                          : stage.done
                                            ? ('complete' as const)
                                            : ('waiting' as const),
                            };
                        })}
                    />
                </div>
                <div className="grid content-start gap-4 bg-zinc-950 p-4 text-white dark:bg-white dark:text-zinc-950">
                    <div>
                        <h3 className="font-medium">Ringkasan order</h3>
                        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                            Informasi utama order.
                        </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                        <Info label="Nomor order" value={order.order_no} />
                        <Info
                            label="Nama nasabah"
                            value={order.customer_name}
                        />
                        <Info label="Cabang" value={order.branch?.name} />
                        <Info label="Notaris" value={order.notary?.name} />
                        <Info
                            label="Nomor rekening"
                            value={order.no_rekening}
                        />
                        <Info label="Plafon" value={money(order.plafon)} />
                        <Info
                            label="Tanggal akad"
                            value={formatTimelineDate(order.tgl_realisasi)}
                        />
                        <Info
                            label="Update terakhir"
                            value={formatTimelineDate(history[0]?.created_at)}
                        />
                    </div>
                </div>
            </div>
        </section>
    );
}

function OrderTracker({ order }: { order: any }) {
    const orderStatus = statusValue(order.status);
    const trackA = resolveStages(trackAStages, orderStatus);
    const activeStage = trackA.find((stage) => stage.active) ?? trackA[0];
    const latestHistory = order.status_histories?.[0];
    const primaryCollateral = order.collaterals?.[0];
    const docStatus =
        weakestStatus(order.collaterals, 'doc_status', docStages) ??
        statusValue(primaryCollateral?.doc_status);
    const covernoteStatus =
        weakestStatus(order.collaterals, 'covernote_status', covernoteStages) ??
        statusValue(primaryCollateral?.covernote_status);
    const paymentStatus =
        statusValue(order.payment_request?.status) || 'belum_ajuan';
    const blockers = trackerBlockers(order);

    return (
        <section className="sim-panel">
            <div className="sim-panel-header flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h2 className="sim-panel-title">Lacak pengajuan</h2>
                    <p className="sim-panel-subtitle">
                        Posisi order, dokumen, covernote, dan pembayaran dalam
                        satu alur.
                    </p>
                </div>
                <SimStatusBadge
                    label={
                        blockers.length > 0
                            ? `${blockers.length} perhatian`
                            : 'Berjalan normal'
                    }
                    tone={blockers.length > 0 ? 'danger' : 'success'}
                />
            </div>

            <div className="grid gap-4 p-4 xl:grid-cols-[320px_1fr]">
                <div className="rounded-md border bg-muted/20 p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock3 className="size-4" />
                        Node saat ini
                    </div>
                    <div className="mt-3 text-xl font-semibold">
                        {activeStage.label}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                        Status order: {statusLabel(orderStatus)}
                    </div>
                    <div className="mt-4 grid gap-3 text-sm">
                        <Info label="Cabang" value={order.branch?.name} />
                        <Info label="Notaris" value={order.notary?.name} />
                        <Info
                            label="Update terakhir"
                            value={formatTimelineDate(
                                latestHistory?.created_at,
                            )}
                        />
                    </div>
                    {blockers.length > 0 && (
                        <div className="mt-4 rounded-md border border-red-500/50 bg-red-500/10 p-3 text-sm">
                            <div className="font-medium text-red-600 dark:text-red-400">
                                Perlu perhatian
                            </div>
                            <div className="mt-2 grid gap-1 text-muted-foreground">
                                {blockers.map((blocker) => (
                                    <div key={blocker}>{blocker}</div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="grid gap-4">
                    <SimJourneyNodes status={statusLabel(orderStatus)} />

                    <div className="grid gap-3 lg:grid-cols-3">
                        <TrackerLane
                            title="Dokumen agunan"
                            status={statusLabel(docStatus)}
                            stages={resolveStages(docStages, docStatus)}
                        />
                        <TrackerLane
                            title="Covernote"
                            status={statusLabel(covernoteStatus)}
                            stages={resolveStages(
                                covernoteStages,
                                covernoteStatus,
                            )}
                        />
                        <TrackerLane
                            title="Pembayaran"
                            status={paymentStatusLabel(paymentStatus)}
                            stages={resolveStages(paymentStages, paymentStatus)}
                        />
                    </div>
                </div>
            </div>
        </section>
    );
}

function TrackerNode({
    index,
    label,
    state,
}: {
    index: number;
    label: string;
    state: 'done' | 'active' | 'waiting' | 'blocked';
}) {
    const Icon =
        state === 'done'
            ? CheckCircle2
            : state === 'active'
              ? Clock3
              : state === 'blocked'
                ? AlertCircle
                : Circle;
    const stateLabel =
        state === 'done'
            ? 'Lewat'
            : state === 'active'
              ? 'Aktif'
              : state === 'blocked'
                ? 'Tertahan'
                : 'Menunggu';
    const className =
        state === 'active'
            ? 'border-foreground bg-muted/40'
            : state === 'done'
              ? 'bg-muted/20'
              : state === 'blocked'
                ? 'border-red-500/70 bg-red-500/10'
                : 'bg-background';

    return (
        <div className={`rounded-md border p-3 ${className}`}>
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                    Node {index}
                </span>
                <Icon
                    className={
                        state === 'blocked'
                            ? 'size-4 text-red-600 dark:text-red-400'
                            : 'size-4 text-muted-foreground'
                    }
                />
            </div>
            <div className="mt-3 min-h-10 text-sm leading-snug font-medium">
                {label}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
                {stateLabel}
            </div>
        </div>
    );
}

function TrackerLane({
    title,
    status,
    stages,
}: {
    title: string;
    status: string;
    stages: ReturnType<typeof resolveStages>;
}) {
    return (
        <div className="rounded-md border p-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-sm font-medium">{title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                        {status}
                    </div>
                </div>
                <FileCheck2 className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-4 flex items-center gap-1.5">
                {stages.map((stage) => (
                    <div
                        key={stage.label}
                        className="flex flex-1 items-center gap-1.5"
                    >
                        <div
                            className={`h-2.5 w-full rounded-full ${stage.active ? 'bg-foreground' : stage.done ? 'bg-muted-foreground/50' : 'bg-muted'}`}
                            title={stage.label}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

function resolveStages(
    stages: { label: string; keys: string[] }[],
    rawStatus?: string | null,
) {
    const status = statusValue(rawStatus);
    const terminalBlocked = [
        'ditolak_notaris',
        'dibatalkan',
        'Ditolak notaris',
        'Dibatalkan',
        'perlu_perbaikan',
        'kedaluwarsa',
        'ditolak_admin',
        'ditolak_manajemen',
    ].includes(status);
    const activeIndex = Math.max(
        0,
        stages.findIndex((stage) => stage.keys.includes(status)),
    );

    return stages.map((stage, index) => ({
        ...stage,
        active: index === activeIndex,
        done: index < activeIndex,
        state:
            terminalBlocked && index === activeIndex
                ? ('blocked' as const)
                : index < activeIndex
                  ? ('done' as const)
                  : index === activeIndex
                    ? ('active' as const)
                    : ('waiting' as const),
    }));
}

function weakestStatus(
    rows: any[] = [],
    key: string,
    stages: { keys: string[] }[],
) {
    if (rows.length === 0) return null;

    return (
        rows
            .map((row) => statusValue(row?.[key]))
            .filter(Boolean)
            .sort(
                (a, b) => statusIndex(a, stages) - statusIndex(b, stages),
            )[0] ?? null
    );
}

function statusIndex(status: string, stages: { keys: string[] }[]) {
    const index = stages.findIndex((stage) =>
        stage.keys.includes(statusValue(status)),
    );
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function trackerBlockers(order: any) {
    const blockers: string[] = [];
    const orderStatus = statusValue(order.status);
    const paymentStatus = statusValue(order.payment_request?.status);

    if (['perbaikan_dokumen', 'Perbaikan dokumen'].includes(orderStatus))
        blockers.push('Dokumen perlu perbaikan');
    if (['ditolak_notaris', 'Ditolak notaris'].includes(orderStatus))
        blockers.push('Order ditolak notaris');
    if (['dibatalkan', 'Dibatalkan'].includes(orderStatus))
        blockers.push('Order dibatalkan');
    if (
        order.collaterals?.some(
            (item: any) => statusValue(item.covernote_status) === 'kedaluwarsa',
        )
    )
        blockers.push('Ada covernote kedaluwarsa');
    if (
        order.collaterals?.some(
            (item: any) => statusValue(item.doc_status) === 'perlu_perbaikan',
        )
    )
        blockers.push('Ada dokumen agunan perlu perbaikan');
    if (['ditolak_admin', 'ditolak_manajemen'].includes(paymentStatus))
        blockers.push('Pembayaran ditolak');

    return blockers;
}

function statusLabel(status?: string | null): string {
    const value = statusValue(status);
    const labels: Record<string, string> = {
        draft: 'Draft',
        diajukan: 'Diajukan',
        menunggu_approval: 'Menunggu approval',
        perlu_perbaikan_order: 'Perlu perbaikan order',
        disetujui_kepala_cabang: 'Disetujui approver cabang',
        menunggu_verifikasi_notaris: 'Menunggu verifikasi notaris',
        perlu_pengalihan_notaris: 'Perlu pengalihan notaris',
        menunggu_approval_covernote: 'Menunggu approval covernote',
        menunggu_approval_covernote_kepala_cabang:
            'Menunggu approval covernote Pimpinan Cabang',
        perbaikan_covernote: 'Perbaikan covernote',
        covernote_disetujui: 'Covernote disetujui',
        perbaikan_dokumen: 'Perbaikan dokumen',
        dokumen_valid: 'Dokumen valid',
        proses_akta: 'Proses akta',
        proses_bpn_samsat: 'Proses BPN/Samsat',
        draft_diunggah: 'Draft diunggah',
        menunggu_validasi_bpr: 'Menunggu validasi BPR',
        dokumen_final_diunggah: 'Dokumen final diunggah',
        dokumen_fisik_diterima: 'Dokumen fisik diterima',
        selesai: 'Selesai',
        ditolak_notaris: 'Ditolak notaris',
        dibatalkan: 'Dibatalkan',
        menunggu_verifikasi: 'Menunggu verifikasi',
        perlu_perbaikan: 'Perlu perbaikan',
        final_diunggah: 'Final diunggah',
        final_divalidasi: 'Final divalidasi',
        aktif: 'Aktif',
        mendekati_jatuh_tempo: 'Mendekati jatuh tempo',
        diperpanjang: 'Diperpanjang',
        diganti_sertifikat: 'Diganti sertifikat',
        kedaluwarsa: 'Kedaluwarsa',
    };

    return value ? (labels[value] ?? humanizeStatus(value)) : '-';
}

function humanizeStatus(value: string): string {
    return value
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function trackLabel(track?: string | null): string {
    const labels: Record<string, string> = {
        A: 'Alur order',
        B: 'Dokumen',
        C: 'Covernote',
        D: 'Pembayaran & fisik',
    };

    return track ? (labels[track] ?? `Proses ${track}`) : 'Proses order';
}

function paymentStatusLabel(status?: string | null): string {
    const value = statusValue(status);
    const labels: Record<string, string> = {
        belum_ajuan: 'Belum diajukan',
        diajukan: 'Diajukan',
        diverifikasi_admin: 'Diverifikasi admin',
        disetujui: 'Disetujui',
        dibayar: 'Dibayar',
        ditolak_admin: 'Ditolak admin',
        ditolak_manajemen: 'Ditolak manajemen',
    };

    return value ? (labels[value] ?? value) : 'Belum diajukan';
}

function documentTypeLabel(type?: string | null): string {
    const labels: Record<string, string> = {
        dokumen_awal: 'Dokumen awal',
        draft: 'Draft',
        resi_bpn: 'Resi BPN',
        final: 'Dokumen final',
        bukti_bayar: 'Bukti pembayaran',
        tanda_terima: 'Tanda terima',
        lainnya: 'Dokumen lainnya',
    };

    return type ? (labels[type] ?? type) : 'Dokumen';
}

function historyEventLabel(status?: string | null): string {
    const labels: Record<string, string> = {
        draft: 'Order disiapkan',
        diajukan: 'Order diajukan',
        menunggu_approval: 'Menunggu persetujuan cabang',
        disetujui_kepala_cabang: 'Order disetujui approver cabang',
        menunggu_verifikasi_notaris: 'Order dikirim ke notaris',
        menunggu_approval_covernote: 'Covernote diajukan untuk persetujuan',
        covernote_disetujui: 'Covernote disetujui',
        dokumen_valid: 'Dokumen agunan dinyatakan valid',
        proses_akta: 'Proses akta dimulai',
        proses_bpn_samsat: 'Proses BPN/Samsat dimulai',
        draft_diunggah: 'Draft dokumen diunggah',
        menunggu_validasi_bpr: 'Dokumen final menunggu validasi',
        dokumen_final_diunggah: 'Dokumen final diunggah',
        dokumen_fisik_diterima: 'Dokumen fisik diterima',
        dibayar: 'Pembayaran dikonfirmasi',
        selesai: 'Order diselesaikan',
        perbaikan_dokumen: 'Dokumen dikembalikan untuk perbaikan',
        perbaikan_covernote: 'Covernote dikembalikan untuk perbaikan',
        dibatalkan: 'Order dibatalkan',
    };

    return status
        ? (labels[statusValue(status)] ??
              `Status diperbarui menjadi ${statusLabel(status)}`)
        : 'Status diperbarui';
}

function actorLabel(actorType?: string | null, actor?: any): string {
    if (actor?.name) {
        const role = actor.notary_id
            ? 'Notaris'
            : actor.job_position?.role?.name ?? actor.job_position?.name;
        return role ? `${actor.name} · ${role}` : actor.name;
    }

    const labels: Record<string, string> = {
        notary: 'Notaris',
        user: 'Petugas internal',
        system: 'Sistem',
    };
    return actorType ? (labels[actorType] ?? actorType) : 'Petugas internal';
}

function checklistNameForDocument(
    order: any,
    documentId: number,
): string | null {
    for (const collateral of order.collaterals ?? []) {
        const checklist = (collateral.checklists ?? []).find(
            (item: any) => item.order_document_id === documentId,
        );
        if (checklist?.document_checklist?.name)
            return checklist.document_checklist.name;
    }
    return null;
}

OrdersShow.layout = {
    breadcrumbs: [{ title: 'Order', href: '/orders' }],
};
