import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowLeft,
    BadgeCheck,
    BriefcaseBusiness,
    CheckCircle2,
    Circle,
    ClipboardList,
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
import { SimCreatableCombobox } from '@/components/sim-creatable-combobox';
import { saveCollateralType } from '@/lib/collateral-types';
import { SimTimeline } from '@/components/sim-timeline';
import { SimJourneyNodes } from '@/components/sim-journey-nodes';
import { RupiahInput } from '@/components/rupiah-input';
import { CoreAccountPicker, type CoreAccount } from '@/components/core-account-picker';
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
    collateralIndex: number;
    documentId?: number;
    checklistMasterId?: number;
    jobTypeId?: number | null;
    displayName: string;
    file: File | null;
    kind: 'agunan' | 'pendukung';
};
type PendingDocument = DocumentEditor & { file: File };
type CollateralDraft = {
    id?: string;
    agunan_id: string;
    nama_agunan: string;
    deskripsi_agunan: string;
    covernote_no: string;
    covernote_start: string;
    covernote_end: string;
    jobs: CollateralJobDraft[];
};
type CollateralJobDraft = { id?: string; job_type_id: string; deskripsi_pekerjaan: string; sla_days: string; sla_override_reason: string };
type OrderDraft = {
    core_account_id: string;
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
    paymentAccount,
    canVerifyPayment,
    canUploadPaymentProof,
    canApprovePayment,
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
    stepFees,
    serviceFee,
    branches,
    branchLocked,
    notaries,
    jobTypes,
    collateralTypes,
    paymentSchemes,
    slaPolicies,
    coreProvider,
    documentChecklists,
}: {
    order: any;
    canEdit: boolean;
    documentTypes: Option[];
    handoverMethods: Option[];
    paymentBlockers: string[];
    paymentAccount: { bank_name?: string | null; bank_account_number?: string | null; bank_account_name?: string | null } | null;
    canVerifyPayment: boolean;
    canUploadPaymentProof: boolean;
    canApprovePayment: boolean;
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
    stepFees: { id?: number; order_collateral_id: number; job_type_step_id: number | null; step_name: string; amount: number }[];
    serviceFee: { main: number; steps: number; total: number };
    branches: { id: number; code: string; name: string }[];
    branchLocked: boolean;
    notaries: { id: number; name: string; branch_ids: number[] }[];
    jobTypes: { id: number; code: string; name: string }[];
    collateralTypes: string[];
    paymentSchemes: string[];
    slaPolicies: Record<string, { days: number; source: string }>;
    coreProvider: string;
    documentChecklists: { id: number; name: string; job_type_id: number | null; is_required: boolean; is_active: boolean }[];
}) {
    const draft = useForm<OrderDraft>(orderDraftFrom(order));
    const [revisionOpen, setRevisionOpen] = useState(false);
    const [cancelOpen, setCancelOpen] = useState(false);
    const revision = useForm({ reason: '' });
    const cancellation = useForm({ reason: '' });
    const covernoteRevision = useForm({ reason: '' });
    const [progressDocumentsPreview, setProgressDocumentsPreview] = useState<
        any[] | null
    >(null);
    const [progressDocumentPreview, setProgressDocumentPreview] = useState<any | null>(null);
    const orderSentToNotary = Boolean(order.sent_to_notary_at);
    const canViewInitialDocuments = canManageOrder || canApproveOrder;
    const [pendingDocuments, setPendingDocuments] = useState<PendingDocument[]>([]);
    const [documentUploadError, setDocumentUploadError] = useState<string | null>(null);
    const [documentUploadProcessing, setDocumentUploadProcessing] = useState(false);
    const [submitProcessing, setSubmitProcessing] = useState(false);
    const [leaveDraftVisit, setLeaveDraftVisit] = useState<any | null>(null);
    const allowNavigation = useRef(false);

    useEffect(() => {
        if (!canEdit || (!draft.isDirty && pendingDocuments.length === 0) || submitProcessing) return;

        const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
            if (allowNavigation.current) return;
            event.preventDefault();
            event.returnValue = 'Order belum diajukan untuk approval.';
        };
        const removeBeforeVisit = router.on('before', (event) => {
            if (allowNavigation.current) return;
            if (event.detail.visit.prefetch) return;
            event.preventDefault();
            setLeaveDraftVisit(event.detail.visit);
        });

        window.addEventListener('beforeunload', warnBeforeLeaving);
        return () => {
            window.removeEventListener('beforeunload', warnBeforeLeaving);
            removeBeforeVisit();
        };
    }, [canEdit, draft.isDirty, pendingDocuments.length, submitProcessing]);

    const continueLeavingDraft = () => {
        const visit = leaveDraftVisit;
        if (!visit) return;

        allowNavigation.current = true;
        setLeaveDraftVisit(null);
        router.visit(visit.url, {
            method: visit.method,
            data: visit.data,
            replace: visit.replace,
            preserveScroll: visit.preserveScroll,
            preserveState: visit.preserveState,
            only: visit.only,
            except: visit.except,
            headers: visit.headers,
            errorBag: visit.errorBag,
            forceFormData: visit.forceFormData,
            queryStringArrayFormat: visit.queryStringArrayFormat,
            async: visit.async,
            showProgress: visit.showProgress,
            prefetch: visit.prefetch,
            fresh: visit.fresh,
            reset: visit.reset,
            preserveUrl: visit.preserveUrl,
            preserveErrors: visit.preserveErrors,
            invalidateCacheTags: visit.invalidateCacheTags,
            viewTransition: visit.viewTransition,
        });
    };

    const selectCoreAccount = (account: CoreAccount) => {
        const branch = branches.find((item) => item.code === account.branch.code);
        if (!branch) throw new Error('Cabang rekening belum tersedia di SIMONTOK. Hubungi admin master cabang.');
        const eligible = notaries.filter((item) => item.branch_ids.includes(branch.id));
        setPendingDocuments([]);
        draft.clearErrors();
        draft.setData({
            ...draft.data,
            core_account_id: account.account_id,
            branch_id: String(branch.id),
            notary_id: eligible.some((item) => String(item.id) === draft.data.notary_id) ? draft.data.notary_id : '',
            customer_name: account.customer_name,
            no_rekening: account.account_number,
            plafon: account.credit.loan_amount === null ? '' : String(account.credit.loan_amount).replace(/\.00$/, ''),
            collaterals: account.collaterals.map((item) => ({
                ...emptyCollateralDraft(),
                agunan_id: item.collateral_id,
                nama_agunan: item.type_name,
                deskripsi_agunan: item.description ?? '',
            })),
        });
    };

    const buildDraftPayload = () => {
        const payload = new FormData();
        Object.entries(draft.data).forEach(([key, value]) => {
            if (key === 'collaterals') return;
            payload.append(key, value == null ? '' : String(value));
        });
        draft.data.collaterals.forEach((collateral, collateralIndex) => {
            Object.entries(collateral).forEach(([key, value]) => {
                if (key === 'jobs') return;
                payload.append(`collaterals[${collateralIndex}][${key}]`, value == null ? '' : String(value));
            });
            collateral.jobs.filter((job) => Boolean(job.job_type_id)).forEach((job, jobIndex) => {
                Object.entries(job).forEach(([key, value]) => {
                    payload.append(`collaterals[${collateralIndex}][jobs][${jobIndex}][${key}]`, value == null ? '' : String(value));
                });
            });
        });
        return payload;
    };

    const submitOrderApproval = () => {
        if (submitProcessing) return;
        const payload = buildDraftPayload();
        setSubmitProcessing(true);
        allowNavigation.current = true;
        draft.clearErrors();
        router.post(`/orders/${order.id}/submit-approval`, payload, {
            forceFormData: true,
            preserveScroll: true,
            onError: (errors) => draft.setError(errors as Record<string, string>),
            onFinish: () => {
                allowNavigation.current = false;
                setSubmitProcessing(false);
            },
        });
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
    const setCollateral = (
        index: number,
        key: 'agunan_id' | 'nama_agunan' | 'deskripsi_agunan',
        value: string,
    ) => {
        const next = [...draft.data.collaterals];
        next[index] = { ...next[index], [key]: value };
        draft.setData('collaterals', next);
    };
    const setJob = (collateralIndex: number, jobIndex: number, key: keyof CollateralJobDraft, value: string) => {
        const next = [...draft.data.collaterals];
        const jobs = [...next[collateralIndex].jobs];
        jobs[jobIndex] = { ...jobs[jobIndex], [key]: value };
        next[collateralIndex] = { ...next[collateralIndex], jobs };
        draft.setData('collaterals', next);
        draft.clearErrors();
    };
    const setCollateralJobs = (index: number, jobs: CollateralJobDraft[]) => {
        const next = [...draft.data.collaterals];
        next[index] = { ...next[index], jobs };
        draft.setData('collaterals', next);
    };
    const documentFor = (collateralIndex: number, checklistMasterId?: number, jobTypeId?: number | null) =>
        pendingDocuments.find((item) => item.collateralIndex === collateralIndex && item.checklistMasterId === checklistMasterId && item.jobTypeId === jobTypeId);

    const pendingDocumentsFor = (collateralIndex: number) =>
        pendingDocuments.filter((item) => item.collateralIndex === collateralIndex);

    const canSend = Boolean(
        draft.data.branch_id &&
        draft.data.notary_id &&
        draft.data.customer_name &&
        draft.data.no_rekening &&
        draft.data.tgl_realisasi &&
        draft.data.collaterals.length > 0 &&
        draft.data.collaterals.every((item) => item.nama_agunan && item.jobs.length > 0 && item.jobs.every((job) => job.job_type_id)),
    );
    const missingRequiredDocument = draft.data.collaterals.some((collateral, collateralIndex) =>
        documentChecklists.some((checklist) => {
            const applicableJobs = checklist.job_type_id === null
                ? [null]
                : collateral.jobs
                    .filter((job) => Number(job.job_type_id) === checklist.job_type_id)
                    .map((job) => Number(job.job_type_id));
            if (!isRequiredChecklist(order, { document_checklist: checklist })) return false;
            return applicableJobs.some((jobTypeId) => {
                const sourceCollateral = order.collaterals?.find((item: any) =>
                    item.agunan_id === collateral.agunan_id || String(item.id) === String(collateral.id),
                );
                const existing = sourceCollateral?.checklists?.some((item: any) =>
                    item.document_checklist?.id === checklist.id && item.order_document_id &&
                    (checklist.job_type_id === null || item.job?.job_type_id === jobTypeId),
                );
                return !existing && !documentFor(collateralIndex, checklist.id, jobTypeId);
            });
        }),
    );
    const incompleteFields = [
        !draft.data.branch_id && 'Cabang',
        !draft.data.notary_id && 'Notaris',
        !draft.data.customer_name && 'Nama nasabah',
        !draft.data.no_rekening && 'No rekening',
        !draft.data.tgl_realisasi && 'Tanggal akad',
        draft.data.collaterals.length === 0 && 'Minimal satu agunan',
        ...draft.data.collaterals.flatMap((item, index) => [
            item.jobs.length === 0 && `Minimal satu pekerjaan agunan ${index + 1}`,
            ...item.jobs.map((job, jobIndex) => !job.job_type_id && `Jenis pekerjaan ${jobIndex + 1} agunan ${index + 1}`),
            !item.nama_agunan && `Jenis agunan ${index + 1}`,
        ]),
        missingRequiredDocument && 'Dokumen checklist agunan',
        draft.data.collaterals.some((item) => item.jobs.some((job) => job.sla_days && !job.sla_override_reason)) && 'Alasan perubahan SLA',
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
    const paymentApproval = useForm({
        decision: 'approve',
        catatan_approver: '',
    });
    const paymentProof = useForm({
        bukti: null as File | null,
        catatan: '',
    });
    const [documentEditor, setDocumentEditor] = useState<DocumentEditor | null>(
        null,
    );
    const [paymentProofPreview, setPaymentProofPreview] = useState<any | null>(null);
    const [viewCollateralModal, setViewCollateralModal] = useState<{
        item: any;
        tab: 'summary' | 'jobs' | 'documents';
    } | null>(null);

    const submitUpload = (event?: FormEvent) => {
        event?.preventDefault();
        upload.post(`/orders/${order.id}/documents`, {
            forceFormData: true,
            preserveScroll: true,
        });
    };

    const openChecklistEditor = (collateralIndex: number, checklistMasterId: number, jobTypeId?: number | null) => {
        setDocumentEditor({
            collateralIndex,
            checklistMasterId,
            jobTypeId,
            displayName: '',
            file: null,
            kind: 'agunan',
        });
    };
    const saveDocumentEditor = () => {
        if (
            !documentEditor ||
            !documentEditor.file ||
            (documentEditor.kind === 'pendukung' &&
                !documentEditor.displayName.trim())
        )
            return;

        setDocumentUploadError(null);

        const uploadDocument = (collateralId: string | number) => {
            const payload = new FormData();
            payload.append('order_collateral_id', String(collateralId));
            payload.append('documents[0][file]', documentEditor.file as File);
            payload.append('documents[0][display_name]', documentEditor.displayName);
            if (documentEditor.kind === 'agunan' && documentEditor.checklistMasterId) {
                payload.append('documents[0][checklist_id]', String(documentEditor.checklistMasterId));
            }

            const url = documentEditor.documentId
                ? `/orders/${order.id}/documents/${documentEditor.documentId}`
                : `/orders/${order.id}/documents/batch`;
            if (documentEditor.documentId) {
                payload.delete('order_collateral_id');
                payload.delete('documents[0][checklist_id]');
                payload.append('file', documentEditor.file as File);
            }

            const submit = documentEditor.documentId ? router.patch : router.post;
            submit(url, payload, {
                forceFormData: true,
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => setDocumentEditor(null),
                onError: (errors) => {
                    const message = Array.from(new Set(
                        Object.values(errors as Record<string, string | string[]>).flat().filter(Boolean),
                    )).join(' ');
                    setDocumentUploadError(message || 'Dokumen gagal disimpan. Coba lagi.');
                },
                onFinish: () => {
                    allowNavigation.current = false;
                    setDocumentUploadProcessing(false);
                },
            });
        };

        const draftCollateral = draft.data.collaterals[documentEditor.collateralIndex];
        const sourceCollateral = (order.collaterals ?? []).find(
            (collateral: any) => String(collateral.agunan_id ?? '') === String(draftCollateral?.agunan_id ?? ''),
        ) ?? order.collaterals?.[documentEditor.collateralIndex];
        const collateralId = draftCollateral?.id || sourceCollateral?.id;
        setDocumentUploadProcessing(true);

        if (documentEditor.documentId) {
            allowNavigation.current = true;
            uploadDocument(collateralId ?? '');
            return;
        }
        if (collateralId) {
            allowNavigation.current = true;
            uploadDocument(collateralId);
            return;
        }

        allowNavigation.current = true;
        const draftPayload = buildDraftPayload();
        draftPayload.append('_method', 'PUT');
        let savedCollateralId: string | number | null = null;
        let draftSaveFailed = false;
        router.post(`/orders/${order.id}`, draftPayload, {
            forceFormData: true,
            preserveScroll: true,
            preserveState: true,
            onSuccess: (page) => {
                const savedCollaterals = (page as any).props?.order?.collaterals ?? [];
                const savedCollateral = savedCollaterals.find(
                    (collateral: any) => String(collateral.agunan_id ?? '') === String(draftCollateral?.agunan_id ?? ''),
                ) ?? savedCollaterals[documentEditor.collateralIndex];
                if (!savedCollateral?.id) {
                    draftSaveFailed = true;
                    allowNavigation.current = false;
                    setDocumentUploadError('Agunan gagal disimpan. Dokumen belum diunggah.');
                    setDocumentUploadProcessing(false);
                    return;
                }
                savedCollateralId = savedCollateral.id;
            },
            onError: (errors) => {
                draftSaveFailed = true;
                const message = Array.from(new Set(
                    Object.values(errors as Record<string, string | string[]>).flat().filter(Boolean),
                )).join(' ');
                allowNavigation.current = false;
                setDocumentUploadError(message || 'Agunan gagal disimpan. Coba lagi.');
                setDocumentUploadProcessing(false);
            },
            onFinish: () => {
                if (!draftSaveFailed && savedCollateralId) {
                    uploadDocument(savedCollateralId);
                }
            },
        });
    };

    const removePendingDocument = (document: PendingDocument) => {
        setPendingDocuments((documents) => documents.filter((item) => item !== document));
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
    const submitPaymentApproval = (event: FormEvent) => {
        event.preventDefault();
        if (!order.payment_request?.id) return;
        paymentApproval.post(
            `/orders/${order.id}/payment-requests/${order.payment_request.id}/approve`,
            { preserveScroll: true },
        );
    };

    const renderCollateralDocuments = (collateral: any) => {
        if (orderSentToNotary || !canViewInitialDocuments) return null;

        const checklistItems = (collateral.checklists ?? []).filter(
            (item: any) => item.document_checklist?.is_active !== false,
        );
        const uploadedCount = checklistItems.filter(
            (item: any) => item.order_document,
        ).length;
        const documentGroups = checklistItems.length > 0
            ? [{ label: 'Checklist dokumen', items: checklistItems }]
            : [];
        const documents = [
            ...checklistItems.filter((item: any) => item.order_document).map((item: any) => item.order_document),
            ...(collateral.documents ?? []).filter((document: any) => (document.document_type?.value ?? document.document_type) === 'lainnya'),
        ];

        return (
            <section className="mt-4 rounded-md border bg-muted/10 p-3 md:col-span-2 md:p-4">
                <div className="border-b pb-3">
                    <h4 className="font-medium">Dokumen <span className="text-sm font-normal text-muted-foreground">{documents.length} file diunggah</span></h4>
                    <p className="mt-1 text-xs text-muted-foreground">Checklist dan dokumen pendukung untuk agunan ini.</p>
                </div>
                {documents.length > 0 ? (
                    <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                        {documents.map((document: any) => <li key={document.id} className="flex min-w-0 items-center gap-2"><span className="size-1.5 shrink-0 rounded-full bg-green-500" /><span className="min-w-0 flex-1 truncate">{document.display_name || document.original_name || 'Dokumen'}</span></li>)}
                    </ul>
                ) : <p className="mt-3 text-sm text-muted-foreground">Belum ada dokumen yang diunggah.</p>}
            </section>
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
                                    disabled={!canSend || missingRequiredDocument || draft.processing || submitProcessing}
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
                                    Setujui biaya & covernote
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
                                <Button
                                    type="button"
                                    onClick={closeOrder}
                                    className="dark:border-[var(--brand-blue)] dark:bg-[var(--brand-blue)] dark:text-white dark:hover:border-[var(--brand-blue-end)] dark:hover:bg-[var(--brand-blue-end)]"
                                >
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
                    <section className="sim-panel overflow-hidden">
                        <div className="sim-panel-header">
                            <h2 className="font-medium">Review biaya dan covernote</h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Satu approval akan mengesahkan total harga utama, biaya setiap langkah, dan covernote order.
                            </p>
                        </div>
                        <div className="grid gap-4 p-4 md:grid-cols-3">
                            <div><div className="text-sm text-muted-foreground">Harga utama</div><div className="mt-1 font-medium">{money(serviceFee.main)}</div></div>
                            <div><div className="text-sm text-muted-foreground">Tambahan langkah</div><div className="mt-1 font-medium">{money(serviceFee.steps)}</div></div>
                            <div><div className="text-sm text-muted-foreground">Total disetujui</div><div className="mt-1 font-semibold">{money(serviceFee.total)}</div></div>
                        </div>
                        <div className="grid gap-3 border-t p-4 md:grid-cols-2">
                            {stepFees.map((fee) => (
                                <div key={fee.id ?? `${fee.order_collateral_id}-${fee.job_type_step_id}`} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                                    <div><div className="font-medium">{fee.step_name}</div><div className="text-xs text-muted-foreground">{order.collaterals.find((item: any) => item.id === fee.order_collateral_id)?.job_type?.name ?? 'Pekerjaan'}</div></div>
                                    <div className="font-medium">{money(fee.amount)}</div>
                                </div>
                            ))}
                        </div>
                        <div className="grid gap-3 border-t p-4 text-sm md:grid-cols-[1fr_auto] md:items-center">
                            <div>
                                <div className="font-medium">Covernote order · {order.covernote_no ?? '-'}</div>
                                <div className="mt-1 text-muted-foreground">Berlaku {dateOnly(order.covernote_start) || '-'} sampai {dateOnly(order.covernote_end) || '-'}</div>
                                <div className="mt-1 text-xs text-muted-foreground">{order.covernote_file_path ? 'Satu file covernote untuk seluruh order' : 'File covernote belum tersedia'}</div>
                            </div>
                            {order.covernote_file_path && order.collaterals?.[0] && (
                                <Button type="button" variant="outline" asChild>
                                    <a href={`/orders/${order.id}/collaterals/${order.collaterals[0].id}/covernote/preview`} target="_blank" rel="noreferrer"><Eye className="size-4" /> Buka preview</a>
                                </Button>
                            )}
                        </div>
                    </section>
                )}

                {canApproveCovernote && (
                    <form
                        onSubmit={requestCovernoteRevision}
                        className="sim-panel border-destructive/40 p-4"
                    >
                        <div className="font-medium">
                            Biaya & covernote menunggu approval
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Setujui total biaya dan covernote, atau kembalikan keduanya dengan satu alasan perbaikan.
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
                            placeholder="Contoh: nominal langkah kedua belum sesuai dan nomor covernote perlu diperbaiki."
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
                            Kembalikan biaya & covernote
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
                        branchLocked={branchLocked}
                        notaries={notaries}
                        jobTypes={jobTypes}
                        collateralTypes={collateralTypes}
                        paymentSchemes={paymentSchemes}
                        slaPolicies={slaPolicies}
                        order={order}
                        setCollateral={setCollateral}
                        setJob={setJob}
                        setCollateralJobs={setCollateralJobs}
                        openChecklistEditor={openChecklistEditor}
                        openDocumentEditor={(editor) => setDocumentEditor(editor)}
                        documentChecklists={documentChecklists}
                        documentFor={documentFor}
                        pendingDocumentsFor={pendingDocumentsFor}
                        removePendingDocument={removePendingDocument}
                        incompleteFields={incompleteFields}
                        coreProvider={coreProvider}
                        selectCoreAccount={selectCoreAccount}
                        canReplaceAccount={!order.collaterals?.length && !order.documents?.length}
                        submitProcessing={submitProcessing}
                    />
                )}
                <OrderTrackingHero order={order} paymentAccount={paymentAccount} />

                {order.payment_request && (
                    <details className="sim-panel group">
                        <summary className="sim-panel-header flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
                            <div>
                                <h2 className="sim-panel-title">Pembayaran</h2>
                                <p className="sim-panel-subtitle">
                                    Setelah dokumen fisik diterima, Admin Legal
                                    mengunggah bukti pembayaran invoice.
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
                                {paymentAccount && (
                                    <div className="rounded-md border p-3">
                                        <div className="mb-2 font-medium">Rekening notaris</div>
                                        <div className="grid gap-2 sm:grid-cols-3">
                                            <Info label="Bank" value={paymentAccount.bank_name} />
                                            <Info label="Nomor rekening" value={paymentAccount.bank_account_number} />
                                            <Info label="Atas nama" value={paymentAccount.bank_account_name} />
                                        </div>
                                    </div>
                                )}
                                <Info
                                    label="Skema pembayaran"
                                    value={
                                        order.payment_request
                                            ?.skema_pembayaran ??
                                        order.skema_pembayaran
                                    }
                                />
                                <Info
                                    label="Catatan notaris"
                                    value={
                                        order.payment_request?.catatan_notaris
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

                                {canApprovePayment && (
                                    <form
                                        onSubmit={submitPaymentApproval}
                                        className="sim-metric grid gap-3"
                                    >
                                        <div className="font-medium">
                                            Persetujuan pembayaran
                                        </div>
                                        <SimSelect
                                            value={paymentApproval.data.decision}
                                            onChange={(value) =>
                                                paymentApproval.setData(
                                                    'decision',
                                                    value,
                                                )
                                            }
                                            options={[
                                                {
                                                    value: 'approve',
                                                    label: 'Setujui pembayaran',
                                                },
                                                {
                                                    value: 'reject',
                                                    label: 'Tolak pembayaran',
                                                },
                                            ]}
                                        />
                                        <textarea
                                            className="sim-input min-h-20 py-2"
                                            value={
                                                paymentApproval.data
                                                    .catatan_approver
                                            }
                                            onChange={(event) =>
                                                paymentApproval.setData(
                                                    'catatan_approver',
                                                    event.target.value,
                                                )
                                            }
                                            placeholder="Catatan persetujuan"
                                        />
                                        <Button
                                            className="w-fit"
                                            disabled={
                                                paymentApproval.processing
                                            }
                                        >
                                            <Save className="size-4" />
                                            Simpan persetujuan
                                        </Button>
                                    </form>
                                )}

                                {canUploadPaymentProof && (
                                    <form
                                        onSubmit={submitPaymentProof}
                                        className="sim-metric grid gap-3"
                                    >
                                        <div className="font-medium">Unggah bukti pembayaran</div>
                                        <p className="text-sm text-muted-foreground">
                                            Nominal yang dicatat: {money(order.payment_request?.nominal)}
                                        </p>
                                        <SimFileUpload
                                            value={paymentProof.data.bukti}
                                            accept="application/pdf,image/jpeg,image/png"
                                            description="JPG, PNG, atau PDF · maksimal 10 MB"
                                            onChange={(file) =>
                                                paymentProof.setData(
                                                    'bukti',
                                                    file,
                                                )
                                            }
                                            label="Pilih foto atau PDF bukti pembayaran"
                                        />
                                        <InputError message={paymentProof.errors.bukti} />
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
                                            disabled={paymentProof.processing || !paymentProof.data.bukti}
                                        >
                                            <WalletCards className="size-4" />
                                            Simpan bukti pembayaran
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
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setPaymentProofPreview(payment)}
                                                        >
                                                            <Eye className="size-4" />
                                                            Lihat bukti
                                                        </Button>
                                                    )}
                                            </div>
                                        ),
                                    )}
                                </div>
                            </div>
                        )}
                    </details>
                )}

                <Dialog
                    open={Boolean(paymentProofPreview)}
                    onOpenChange={(open) => !open && setPaymentProofPreview(null)}
                >
                    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>Bukti pembayaran</DialogTitle>
                            <DialogDescription>
                                Pratinjau bukti pembayaran sebelum diunduh.
                            </DialogDescription>
                        </DialogHeader>
                        {paymentProofPreview && order.payment_request?.id && (
                            <div className="grid gap-3">
                                <iframe
                                    title="Preview bukti pembayaran"
                                    src={`/orders/${order.id}/payment-requests/${order.payment_request.id}/payments/${paymentProofPreview.id}/preview`}
                                    className="h-[min(70vh,42rem)] w-full rounded-md border bg-white"
                                />
                                <div className="flex justify-end">
                                    <Button asChild>
                                        <a href={`/orders/${order.id}/payment-requests/${order.payment_request.id}/payments/${paymentProofPreview.id}/download`}>
                                            <Download className="size-4" />
                                            Unduh bukti
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

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
                        {order.collaterals.map((item: any, index: number) => (
                            <div
                                key={item.id}
                                className="border-b p-4 last:border-b-0"
                            >
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <div className="font-medium">Agunan {index + 1}</div>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            {item.nama_agunan || item.agunan_id || 'Identitas agunan belum diisi'}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button type="button" variant="outline" size="sm" onClick={() => setViewCollateralModal({ item, tab: 'summary' })}>
                                            <ClipboardList className="size-4" />Ringkasan
                                        </Button>
                                        <Button type="button" size="sm" onClick={() => setViewCollateralModal({ item, tab: 'jobs' })}>
                                            <BriefcaseBusiness className="size-4" />Pekerjaan
                                        </Button>
                                        <Button type="button" variant="outline" size="sm" onClick={() => setViewCollateralModal({ item, tab: 'documents' })}>
                                            <FileText className="size-4" />Dokumen
                                        </Button>
                                    </div>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <SimStatusBadge
                                        label={'Dokumen: ' + statusLabel(item.doc_status)}
                                        tone={toneForStatus(statusLabel(item.doc_status))}
                                    />
                                    <SimStatusBadge
                                        label={item.covernote_no || item.covernote_end ? 'Covernote: ' + statusLabel(item.covernote_status) : 'Covernote belum tersedia'}
                                        tone={item.covernote_no || item.covernote_end ? toneForStatus(statusLabel(item.covernote_status)) : 'warning'}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </details>

                <Dialog
                    open={Boolean(viewCollateralModal)}
                    onOpenChange={(open) => !open && setViewCollateralModal(null)}
                >
                    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>
                                {viewCollateralModal?.tab === 'jobs'
                                    ? 'Pekerjaan untuk agunan ini'
                                    : viewCollateralModal?.tab === 'documents'
                                      ? 'Dokumen agunan'
                                      : 'Ringkasan agunan'}
                            </DialogTitle>
                            <DialogDescription>
                                {viewCollateralModal?.item?.nama_agunan || 'Agunan'}
                            </DialogDescription>
                        </DialogHeader>
                        {viewCollateralModal && (
                            <div className="grid gap-5">
                                {(viewCollateralModal.tab === 'summary' || viewCollateralModal.tab === 'jobs') && (
                                    <div className="overflow-hidden rounded-md border">
                                        <div className="bg-primary px-4 py-3 text-primary-foreground">
                                            <div className="font-medium">Pekerjaan untuk agunan ini</div>
                                            <div className="text-sm text-primary-foreground/75">Ringkasan pekerjaan dan SLA.</div>
                                        </div>
                                        <div className="grid gap-3 p-4">
                                            {(viewCollateralModal.item.jobs?.length ? viewCollateralModal.item.jobs : [viewCollateralModal.item]).map((job: any, jobIndex: number) => (
                                                <div key={job.id ?? jobIndex} className="border-b pb-3 last:border-b-0 last:pb-0">
                                                    <div className="font-medium">{job.job_type?.name ?? 'Pekerjaan'}</div>
                                                    {job.deskripsi_pekerjaan && <div className="mt-1 text-sm text-muted-foreground">{job.deskripsi_pekerjaan}</div>}
                                                    <div className="mt-1 text-sm text-muted-foreground">{job.sla_days ? `${job.sla_days} hari` : 'Belum ditentukan'} · jatuh tempo {dateOnly(job.sla_due_at) || 'menunggu tanggal masuk notaris'}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {viewCollateralModal.tab === 'summary' && (
                                    <>
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <Info label="ID agunan" value={viewCollateralModal.item.agunan_id || `AGN-${viewCollateralModal.item.id}`} />
                                            <Info label="Jenis agunan" value={viewCollateralModal.item.nama_agunan} />
                                            <div className="sm:col-span-2"><Info label="Deskripsi agunan" value={viewCollateralModal.item.deskripsi_agunan} /></div>
                                        </div>
                                        <div className="flex flex-wrap gap-2 border-t pt-4">
                                            <SimStatusBadge label={'Dokumen: ' + statusLabel(viewCollateralModal.item.doc_status)} tone={toneForStatus(statusLabel(viewCollateralModal.item.doc_status))} />
                                            <SimStatusBadge label={viewCollateralModal.item.covernote_no || viewCollateralModal.item.covernote_end ? 'Covernote: ' + statusLabel(viewCollateralModal.item.covernote_status) : 'Covernote belum tersedia'} tone={viewCollateralModal.item.covernote_no || viewCollateralModal.item.covernote_end ? toneForStatus(statusLabel(viewCollateralModal.item.covernote_status)) : 'warning'} />
                                        </div>
                                    </>
                                )}
                                {(viewCollateralModal.tab === 'summary' || viewCollateralModal.tab === 'documents') && (
                                    <div className="grid gap-2 border-t pt-4">
                                        <div className="font-medium">Dokumen yang diunggah</div>
                                        {(() => {
                                            const collateral = viewCollateralModal.item;
                                            const documents = [
                                                ...(collateral.checklists ?? []).filter((item: any) => item.order_document).map((item: any) => item.order_document),
                                                ...(collateral.documents ?? []).filter((document: any) => (document.document_type?.value ?? document.document_type) === 'lainnya'),
                                            ];
                                            return documents.length > 0 ? (
                                                <ul className="grid gap-2 text-sm sm:grid-cols-2">
                                                    {documents.map((document: any) => (
                                                        <li key={document.id} className="flex min-w-0 items-center justify-between gap-2 rounded-md border p-2">
                                                            <span className="min-w-0 flex-1 truncate">{document.display_name || document.original_name || 'Dokumen'}</span>
                                                            <Button type="button" variant="outline" size="sm" onClick={() => window.open(`/orders/${order.id}/documents/${document.id}/preview`, '_blank', 'noopener,noreferrer')}><Eye className="size-4" />Lihat</Button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : <p className="text-sm text-muted-foreground">Belum ada dokumen yang diunggah.</p>;
                                        })()}
                                    </div>
                                )}
                                {viewCollateralModal.tab === 'summary' && (
                                    <div className="grid gap-2 border-t pt-4 text-sm">
                                        <div className="font-medium">Covernote</div>
                                        {viewCollateralModal.item.covernote_no || viewCollateralModal.item.covernote_end ? (
                                            <div className="text-muted-foreground">Nomor: {viewCollateralModal.item.covernote_no || 'Belum tersedia'} · Jatuh tempo: {dateOnly(viewCollateralModal.item.covernote_end) || 'Belum tersedia'}</div>
                                        ) : <p className="text-muted-foreground">Nomor dan tanggal jatuh tempo akan muncul setelah notaris mengajukan covernote.</p>}
                                    </div>
                                )}
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

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
                                                {item.nama_agunan || item.job_type?.name || 'Jenis agunan'}
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
                                                        {item.nama_agunan || item.job_type?.name || 'Jenis agunan'}
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
                                <h2 className="font-medium">Dokumen pendukung</h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Dokumen yang tersedia pada order ini.
                                    Dokumen final direview dari progres Selesai.
                                </p>
                            </div>
                            <ChevronDown className="mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="p-3 md:p-4">
                            {order.documents.filter(
                                (document: any) =>
                                    document.document_type !== 'final',
                            ).length === 0 ? (
                                <div className="px-1 py-8 text-center text-sm text-muted-foreground">
                                    Belum ada dokumen.
                                </div>
                            ) : (
                                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                    {order.documents
                                        .filter(
                                            (document: any) =>
                                                document.document_type !==
                                                'final',
                                        )
                                        .map((document: any) => {
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
                                                        <span className="min-w-0 truncate">
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
                                    label: `${item.nama_agunan || item.job_type?.name || 'Agunan'} - ${item.agunan_id || item.id}`,
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
                                accept="application/pdf,image/jpeg,image/png"
                                description="JPG, PNG, atau PDF · maksimal 10 MB"
                                onChange={(file) =>
                                    handover.setData('receipt', file)
                                }
                                label="Pilih foto atau PDF tanda terima"
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

                <Dialog
                    open={Boolean(documentEditor)}
                    onOpenChange={(open) => {
                        if (!open) {
                            setDocumentEditor(null);
                            setDocumentUploadError(null);
                        }
                    }}
                >
                    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>
                                {documentEditor?.kind === 'pendukung'
                                    ? 'Tambah dokumen pendukung'
                                    : 'Input dokumen agunan'}
                            </DialogTitle>
                            <DialogDescription>
                                Masukkan satu file. File langsung disimpan sebagai
                                draft dan masih bisa diganti sebelum diajukan ke Kabid Ops.
                            </DialogDescription>
                        {documentUploadError && (
                            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                {documentUploadError}
                            </div>
                        )}
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
                                    'Pilih file PDF'
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
                                    documentUploadProcessing ||
                                    !documentEditor?.file ||
                                    (documentEditor?.kind === 'pendukung' &&
                                        !documentEditor.displayName.trim())
                                }
                            >
                                <Save className="size-4" />
                                {documentUploadProcessing ? 'Menyimpan…' : 'Simpan ke draft'}
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
                                                {item.collateral?.nama_agunan || item.collateral?.job_type?.name || 'Jenis agunan'}{' '}
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
                                                            (() => {
                                                                setProgressDocumentsPreview(
                                                                    finalDocuments,
                                                                );
                                                                setProgressDocumentPreview(
                                                                    finalDocuments[0] ??
                                                                        null,
                                                                );
                                                            })()
                                                        }
                                                    >
                                                        <Eye className="size-4" />
                                                        {allFinalDocumentsValidated
                                                            ? `Lihat dokumen final (${finalDocuments.length})`
                                                            : `Review dokumen final (${finalDocuments.length})`}
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
                    onOpenChange={(open) => {
                        if (!open) {
                            setProgressDocumentsPreview(null);
                            setProgressDocumentPreview(null);
                        }
                    }}
                >
                    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
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
                                        className={`flex items-center gap-3 rounded-md border p-3 text-sm ${progressDocumentPreview?.id === document.id ? 'border-primary bg-primary/5' : ''}`}
                                    >
                                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                                        <button
                                            type="button"
                                            className="min-w-0 flex-1 truncate text-left font-medium hover:underline"
                                            onClick={() =>
                                                setProgressDocumentPreview(
                                                    document,
                                                )
                                            }
                                        >
                                            {document.original_name}
                                        </button>
                                        {document.validated_at ? (
                                            <SimStatusBadge
                                                label="Tervalidasi"
                                                tone="success"
                                            />
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
                        {canValidateDocuments &&
                            (progressDocumentsPreview ?? []).some(
                                (document: any) => !document.validated_at,
                            ) && (
                                <div className="flex justify-end border-t pt-4">
                                    <Button
                                        onClick={() =>
                                            router.post(
                                                `/orders/${order.id}/documents/validate-final-batch`,
                                                {
                                                    document_ids: (
                                                        progressDocumentsPreview ??
                                                        []
                                                    ).map(
                                                        (document: any) =>
                                                            document.id,
                                                    ),
                                                },
                                                {
                                                    preserveScroll: true,
                                                    onSuccess: () => {
                                                        setProgressDocumentsPreview(
                                                            null,
                                                        );
                                                        setProgressDocumentPreview(
                                                            null,
                                                        );
                                                    },
                                                },
                                            )
                                        }
                                    >
                                        <FileCheck2 className="size-4" />
                                        Setujui semua dokumen
                                    </Button>
                                </div>
                            )}
                        {progressDocumentPreview && (
                            <div className="overflow-hidden rounded-md border bg-muted/20">
                                <div className="border-b px-3 py-2 text-sm font-medium">
                                    Preview: {progressDocumentPreview.original_name}
                                </div>
                                <iframe
                                    title={`Preview ${progressDocumentPreview.original_name}`}
                                    src={`/orders/${order.id}/documents/${progressDocumentPreview.id}/preview`}
                                    className="h-[min(60vh,36rem)] w-full bg-white"
                                />
                            </div>
                        )}
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
            <Dialog
                open={Boolean(leaveDraftVisit)}
                onOpenChange={(open) => !open && setLeaveDraftVisit(null)}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <div className="mb-1 flex size-10 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            <AlertCircle className="size-5" />
                        </div>
                        <DialogTitle>Keluar dari pengisian order?</DialogTitle>
                        <DialogDescription>
                            Order ini belum diajukan untuk approval. Data yang
                            sedang diisi belum dihitung sebagai order aktif.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-800 dark:text-amber-200">
                        Jika keluar sekarang, pengisian sementara ini akan
                        dibatalkan. Kamu dapat tetap di halaman untuk
                        melengkapinya.
                    </div>
                    <DialogFooter className="flex-col sm:flex-col sm:justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={() => setLeaveDraftVisit(null)}
                        >
                            Tetap isi order
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            className="w-full"
                            onClick={continueLeavingDraft}
                        >
                            Keluar tanpa mengajukan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
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

function SummaryInfo({ label, value }: { label: string; value?: string | null }) {
    return (
        <div>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-0.5 text-sm font-medium leading-5">{value || '-'}</div>
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
    order,
    branches,
    branchLocked,
    notaries,
    jobTypes,
    collateralTypes,
    paymentSchemes,
    slaPolicies,
    setCollateral,
    setJob,
    setCollateralJobs,
    openChecklistEditor,
    openDocumentEditor,
    documentChecklists,
    documentFor,
    pendingDocumentsFor,
    removePendingDocument,
    incompleteFields,
    coreProvider,
    selectCoreAccount,
    canReplaceAccount,
    submitProcessing,
}: {
    draft: any;
    order: any;
    branches: any[];
    branchLocked: boolean;
    notaries: any[];
    jobTypes: any[];
    collateralTypes: string[];
    paymentSchemes: string[];
    slaPolicies: Record<string, { days: number; source: string }>;
    setCollateral: (
        index: number,
        key: 'agunan_id' | 'nama_agunan' | 'deskripsi_agunan',
        value: string,
    ) => void;
    setJob: (collateralIndex: number, jobIndex: number, key: keyof CollateralJobDraft, value: string) => void;
    setCollateralJobs: (index: number, jobs: CollateralJobDraft[]) => void;
    openChecklistEditor: (collateralIndex: number, checklistMasterId: number, jobTypeId?: number | null) => void;
    openDocumentEditor: (editor: DocumentEditor) => void;
    documentChecklists: { id: number; name: string; job_type_id: number | null; is_required: boolean; is_active: boolean }[];
    documentFor: (collateralIndex: number, checklistMasterId?: number, jobTypeId?: number | null) => PendingDocument | undefined;
    pendingDocumentsFor: (collateralIndex: number) => PendingDocument[];
    removePendingDocument: (document: PendingDocument) => void;
    incompleteFields: string[];
    coreProvider: string;
    selectCoreAccount: (account: CoreAccount) => void;
    canReplaceAccount: boolean;
    submitProcessing: boolean;
}) {
    const coreSelected = Boolean(draft.data.core_account_id);
    const [collateralModal, setCollateralModal] = useState<{
        index: number;
        tab: 'summary' | 'jobs' | 'documents';
    } | null>(null);
    const activeCollateral = collateralModal
        ? draft.data.collaterals[collateralModal.index]
        : null;
    const activeSourceCollateral = activeCollateral
        ? order.collaterals?.find(
              (item: any) => String(item.id) === String(activeCollateral.id),
          ) ?? order.collaterals?.find(
              (item: any) => item.agunan_id && item.agunan_id === activeCollateral.agunan_id,
          ) ?? order.collaterals?.[collateralModal?.index ?? 0]
        : null;
    const activeSummaryJobs = activeSourceCollateral?.jobs?.length
        ? activeSourceCollateral.jobs
        : activeCollateral?.jobs ?? [];
    const activeSummaryDocuments = [
              ...pendingDocumentsFor(collateralModal?.index ?? -1).map((document) => ({
                  id: `pending-${document.collateralIndex}-${document.checklistMasterId ?? document.displayName}`,
                  display_name: document.displayName || document.file.name,
              })),
              ...(activeSourceCollateral
        ? [
              ...(activeSourceCollateral.checklists ?? [])
                  .filter((item: any) => item.order_document)
                  .map((item: any) => item.order_document),
              ...(activeSourceCollateral.documents ?? []).filter(
                  (document: any) =>
                      (document.document_type?.value ?? document.document_type) ===
                      'lainnya',
              ),
          ]
        : [])];
    const activeSupportingDocuments = [
        ...pendingDocumentsFor(collateralModal?.index ?? -1)
            .filter((document) => document.kind === 'pendukung')
            .map((document) => ({
                id: `pending-supporting-${document.collateralIndex}-${document.displayName}`,
                display_name: document.displayName || document.file.name,
                original_name: document.file.name,
                pending: true,
                source: document,
            })),
        ...(activeSourceCollateral?.documents ?? [])
            .filter((document: any) => (document.document_type?.value ?? document.document_type) === 'lainnya')
            .map((document: any) => ({ ...document, pending: false })),
    ];
    const activeChecklistItems = activeSourceCollateral?.checklists?.length
        ? activeSourceCollateral.checklists.filter((item: any) => item.document_checklist?.is_active !== false)
        : documentChecklists.flatMap((checklist) => checklist.job_type_id
            ? activeCollateral?.jobs
                .map((job: CollateralJobDraft, jobIndex: number) => ({ job, jobIndex }))
                .filter(({ job }: { job: CollateralJobDraft; jobIndex: number }) => Number(job.job_type_id) === checklist.job_type_id)
                .map(({ job, jobIndex }: { job: CollateralJobDraft; jobIndex: number }) => ({
                    id: `draft-${checklist.id}-${jobIndex}`,
                    document_checklist: checklist,
                    draft_job_type_id: checklist.job_type_id,
                    draft_job_index: jobIndex,
                    order_document: documentFor(collateralModal?.index ?? -1, checklist.id, checklist.job_type_id),
                })) ?? []
            : [{
                id: `draft-${checklist.id}`,
                document_checklist: checklist,
                draft_job_type_id: null,
                order_document: documentFor(collateralModal?.index ?? -1, checklist.id, null),
            }]);
    return (
        <div className="sim-panel overflow-hidden">
            <div className="sim-panel-header flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="sim-panel-title">Lengkapi order</h2>
                    <p className="sim-panel-subtitle">
                        Perubahan disimpan saat order diajukan untuk approval.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                        {submitProcessing ? 'Mengajukan...' : 'Belum disimpan'}
                    </span>
                </div>
            </div>
            <CoreAccountPicker
                selected={coreSelected ? { customer_name: draft.data.customer_name, account_number: draft.data.no_rekening } : null}
                initialQuery={draft.data.customer_name || draft.data.no_rekening}
                disabled={draft.processing}
                canReplace={canReplaceAccount}
                isDummy={coreProvider === 'dummy'}
                error={draft.errors.core_account_id}
                onSelect={selectCoreAccount}
            />
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
                        disabled={branchLocked || coreSelected}
                    />
                    {(branchLocked || coreSelected) && (
                        <p className="text-xs text-muted-foreground">
                            {coreSelected ? 'Mengikuti cabang rekening terpilih.' : 'Otomatis mengikuti cabang yang terdaftar pada akun Anda.'}
                        </p>
                    )}
                </DraftField>
                <DraftField
                    label="Nama nasabah"
                    required
                    invalid={!draft.data.customer_name}
                    error={draft.errors.customer_name}
                >
                    <Input
                        value={draft.data.customer_name}
                        readOnly
                        aria-label="Nama nasabah terpilih"
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
                        readOnly
                        aria-label="Nomor rekening terpilih"
                        onChange={(event) =>
                            draft.setData('no_rekening', event.target.value)
                        }
                    />
                </DraftField>
                <DraftField label="Plafon">
                    <RupiahInput
                        value={draft.data.plafon}
                        onChange={(value) => draft.setData('plafon', value)}
                        readOnly={coreSelected}
                    />
                </DraftField>
                <div className="md:col-span-2 border-t pt-4">
                    <h3 className="font-medium">Lengkapi data order</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Isi data yang diperlukan sebelum menambahkan agunan.
                    </p>
                </div>
                <DraftField
                    label="Notaris"
                    required
                    invalid={!draft.data.notary_id}
                    error={draft.errors.notary_id}
                >
                    <SimSelect
                        value={draft.data.notary_id}
                        onChange={(value) => draft.setData('notary_id', value)}
                        options={notaries.filter((item) => item.branch_ids?.includes(Number(draft.data.branch_id))).map((item) => ({
                            value: String(item.id),
                            label: item.name,
                        }))}
                        placeholder="Pilih notaris"
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
                <DraftField label="Nominal jasa">
                    <RupiahInput
                        value={draft.data.nominal}
                        onChange={(value) => draft.setData('nominal', value)}
                    />
                </DraftField>
                <DraftField label="Skema pembayaran">
                    <SimSelect
                        value={draft.data.skema_pembayaran}
                        options={['Bayar awal', 'Bayar sebagian'].map((value) => ({ value, label: value }))}
                        placeholder="Pilih skema pembayaran"
                        onChange={(value) => draft.setData('skema_pembayaran', value)}
                    />
                </DraftField>
            </div>
            <div className="border-t p-4">
                <div className="mb-4">
                    <div>
                        <h3 className="font-medium">Agunan</h3>
                        <p className="text-sm text-muted-foreground">
                            Agunan diisi otomatis dari rekening yang dipilih.
                        </p>
                    </div>
                </div>
                {coreSelected && draft.data.collaterals.length === 0 && <p role="status" className="mb-3 text-sm text-destructive">Rekening ini tidak memiliki agunan. Draft dapat disimpan, tetapi belum dapat diajukan.</p>}
                {coreSelected && draft.data.collaterals.length > 0 && <p className="mb-3 text-sm text-muted-foreground">Identitas agunan terisi dari rekening terpilih. Lengkapi jenis pekerjaan dan SLA yang diperlukan.</p>}
                <div className="grid gap-4">
                    {draft.data.collaterals.map(
                        (item: CollateralDraft, index: number) => (
                            <div
                                key={index}
                                className="grid gap-4 rounded-md border p-4 md:grid-cols-2"
                            >
                                <div className="-mx-4 -mt-4 flex flex-col gap-1 rounded-t-md border-b bg-muted px-4 pb-3 pt-4 md:col-span-2">
                                    <h4 className="font-medium">Agunan {index + 1}</h4>
                                    <p className="text-xs text-muted-foreground">{coreSelected ? 'Identitas agunan berasal dari BU Core. Tambahkan pekerjaan dan SLA yang berlaku.' : 'Identitas agunan diisi terlebih dahulu, lalu tambahkan pekerjaan yang berlaku.'}</p>
                                </div>
                                <div className="md:col-span-2 flex flex-col gap-3 rounded-md border bg-muted/10 p-3 md:flex-row md:items-center md:justify-between md:p-4">
                                    <div>
                                        <div className="font-medium">{item.nama_agunan || 'Jenis agunan belum diisi'}</div>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {item.agunan_id || 'ID agunan belum diisi'}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button type="button" variant="outline" size="sm" onClick={() => setCollateralModal({ index, tab: 'summary' })}>
                                            <ClipboardList className="size-4" />Ringkasan
                                        </Button>
                                        <Button type="button" size="sm" onClick={() => setCollateralModal({ index, tab: 'jobs' })}>
                                            <BriefcaseBusiness className="size-4" />Pekerjaan
                                            <span className="text-xs opacity-75">({item.jobs.length})</span>
                                        </Button>
                                        <Button type="button" variant="outline" size="sm" onClick={() => setCollateralModal({ index, tab: 'documents' })}>
                                            <FileText className="size-4" />Dokumen
                                        </Button>
                                    </div>
                                </div>
                                {draft.data.collaterals.length > 1 && !coreSelected && (
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
            <Dialog
                open={Boolean(collateralModal)}
                onOpenChange={(open) => !open && setCollateralModal(null)}
            >
                <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>
                            {collateralModal?.tab === 'jobs'
                                ? 'Pekerjaan untuk agunan ini'
                                : collateralModal?.tab === 'documents'
                                  ? 'Dokumen agunan'
                                  : 'Ringkasan agunan'}
                        </DialogTitle>
                        <DialogDescription>
                            {activeCollateral?.nama_agunan || 'Agunan'}
                        </DialogDescription>
                    </DialogHeader>

                    {activeCollateral && collateralModal?.tab === 'summary' && (
                        coreSelected ? (
                            <div className="grid gap-5">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Info label="ID agunan" value={activeCollateral.agunan_id || `AGN-${activeCollateral.id}`} />
                                    <Info label="Jenis agunan" value={activeCollateral.nama_agunan} />
                                    <div className="sm:col-span-2">
                                        <Info label="Deskripsi agunan" value={activeCollateral.deskripsi_agunan} />
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2 border-t pt-4">
                                    <SimStatusBadge
                                        label={`Dokumen: ${statusLabel(activeSourceCollateral?.doc_status)}`}
                                        tone={toneForStatus(statusLabel(activeSourceCollateral?.doc_status))}
                                    />
                                    <SimStatusBadge
                                        label={activeSourceCollateral?.covernote_no || activeSourceCollateral?.covernote_end ? `Covernote: ${statusLabel(activeSourceCollateral?.covernote_status)}` : 'Covernote belum tersedia'}
                                        tone={activeSourceCollateral?.covernote_no || activeSourceCollateral?.covernote_end ? toneForStatus(statusLabel(activeSourceCollateral?.covernote_status)) : 'warning'}
                                    />
                                </div>
                                <div className="overflow-hidden rounded-md border">
                                    <div className="bg-primary px-4 py-3 text-primary-foreground">
                                        <div className="font-medium">Pekerjaan untuk agunan ini</div>
                                        <div className="text-sm text-primary-foreground/75">Ringkasan pekerjaan dan SLA.</div>
                                    </div>
                                    <div className="grid gap-3 p-4">
                                        {activeSummaryJobs.length > 0 ? activeSummaryJobs.map((job: any, jobIndex: number) => (
                                            <div key={job.id ?? jobIndex} className="border-b pb-3 last:border-b-0 last:pb-0">
                                                <div className="font-medium">{job.job_type?.name ?? jobTypes.find((type) => String(type.id) === String(job.job_type_id))?.name ?? 'Pekerjaan'}</div>
                                                <div className="mt-1 text-sm text-muted-foreground">
                                                    {job.sla_days ? `${job.sla_days} hari` : 'Belum ditentukan'} · jatuh tempo {dateOnly(job.sla_due_at) || 'menunggu tanggal masuk notaris'}
                                                </div>
                                                {job.deskripsi_pekerjaan && <div className="mt-1 text-sm text-muted-foreground">{job.deskripsi_pekerjaan}</div>}
                                            </div>
                                        )) : <p className="text-sm text-muted-foreground">Belum ada pekerjaan.</p>}
                                    </div>
                                </div>
                                <div className="grid gap-2 border-t pt-4 text-sm">
                                    <div className="font-medium">Covernote</div>
                                    {activeSourceCollateral?.covernote_no || activeSourceCollateral?.covernote_end ? (
                                        <>
                                            <div className="text-muted-foreground">Nomor: {activeSourceCollateral.covernote_no || 'Belum tersedia'}</div>
                                            <div className="text-muted-foreground">Jatuh tempo: {dateOnly(activeSourceCollateral.covernote_end) || 'Belum tersedia'}</div>
                                        </>
                                    ) : <p className="text-muted-foreground">Nomor dan tanggal jatuh tempo akan muncul setelah notaris mengajukan covernote.</p>}
                                </div>
                                <div className="grid gap-2 border-t pt-4">
                                    <div className="font-medium">Dokumen yang diunggah</div>
                                    {activeSummaryDocuments.length > 0 ? (
                                        <ul className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                                            {activeSummaryDocuments.map((document: any) => <li key={document.id} className="flex min-w-0 items-center gap-2"><span className="size-1.5 shrink-0 rounded-full bg-green-500" /><span className="min-w-0 truncate">{document.display_name || document.original_name || 'Dokumen'}</span></li>)}
                                        </ul>
                                    ) : <p className="text-sm text-muted-foreground">Belum ada dokumen yang diunggah.</p>}
                                </div>
                            </div>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2">
                                <DraftField label="ID agunan">
                                    <Input value={activeCollateral.agunan_id} onChange={(event) => setCollateral(collateralModal.index, 'agunan_id', event.target.value)} />
                                </DraftField>
                                <DraftField label="Jenis agunan" required invalid={!activeCollateral.nama_agunan} error={draft.errors[`collaterals.${collateralModal.index}.nama_agunan`]}>
                                    <SimCreatableCombobox id={`collateral-type-draft-${collateralModal.index}`} value={activeCollateral.nama_agunan} options={collateralTypes} placeholder="Pilih atau ketik jenis agunan" emptyLabel="Belum ada pilihan jenis agunan." onAdd={saveCollateralType} onChange={(value) => setCollateral(collateralModal.index, 'nama_agunan', value)} />
                                </DraftField>
                                <div className="md:col-span-2">
                                    <DraftField label="Deskripsi agunan" error={draft.errors[`collaterals.${collateralModal.index}.deskripsi_agunan`]}>
                                        <textarea className="sim-input min-h-32 py-2" value={activeCollateral.deskripsi_agunan} onChange={(event) => setCollateral(collateralModal.index, 'deskripsi_agunan', event.target.value)} />
                                    </DraftField>
                                </div>
                            </div>
                        )
                    )}

                    {activeCollateral && collateralModal?.tab === 'jobs' && (
                        <div className="grid gap-4">
                            {activeCollateral.jobs.map(
                                (job: CollateralJobDraft, jobIndex: number) => (
                                    <div
                                        key={jobIndex}
                                        className="grid gap-3 rounded-md border p-3 md:grid-cols-2"
                                    >
                                        <DraftField
                                            label={`Pekerjaan ${jobIndex + 1}`}
                                            required
                                            invalid={!job.job_type_id && Boolean(draft.errors[`collaterals.${collateralModal.index}.jobs.${jobIndex}.job_type_id`])}
                                            error={job.job_type_id ? undefined : draft.errors[`collaterals.${collateralModal.index}.jobs.${jobIndex}.job_type_id`]}
                                        >
                                            <SimSelect
                                                value={job.job_type_id}
                                                onChange={(value) => setJob(collateralModal.index, jobIndex, 'job_type_id', value)}
                                                options={jobTypes.map((type) => ({ value: String(type.id), label: type.name }))}
                                                placeholder="Pilih jenis pekerjaan"
                                            />
                                        </DraftField>
                                        <DraftField
                                            label="SLA pekerjaan (hari)"
                                            error={draft.errors[`collaterals.${collateralModal.index}.jobs.${jobIndex}.sla_days`]}
                                        >
                                            <Input
                                                type="number"
                                                min={1}
                                                max={365}
                                                value={job.sla_days}
                                                placeholder={slaPolicies[job.job_type_id] ? String(slaPolicies[job.job_type_id].days) : 'Otomatis dari kebijakan'}
                                                onChange={(event) => setJob(collateralModal.index, jobIndex, 'sla_days', event.target.value)}
                                            />
                                        </DraftField>
                                        <div className="md:col-span-2">
                                            <DraftField
                                                label="Deskripsi pekerjaan"
                                                error={draft.errors[`collaterals.${collateralModal.index}.jobs.${jobIndex}.deskripsi_pekerjaan`]}
                                            >
                                                <textarea
                                                    className="sim-input min-h-24 py-2"
                                                    value={job.deskripsi_pekerjaan}
                                                    onChange={(event) => setJob(collateralModal.index, jobIndex, 'deskripsi_pekerjaan', event.target.value)}
                                                    placeholder="Jelaskan pekerjaan yang diminta untuk agunan ini"
                                                />
                                            </DraftField>
                                        </div>
                                        {job.sla_days && slaPolicies[job.job_type_id] && Number(job.sla_days) !== slaPolicies[job.job_type_id].days && (
                                            <DraftField
                                                label="Alasan perubahan SLA"
                                                error={draft.errors[`collaterals.${collateralModal.index}.jobs.${jobIndex}.sla_override_reason`]}
                                            >
                                                <textarea
                                                    className="sim-input min-h-20 py-2"
                                                    value={job.sla_override_reason}
                                                    onChange={(event) => setJob(collateralModal.index, jobIndex, 'sla_override_reason', event.target.value)}
                                                    placeholder="Jelaskan alasan SLA khusus"
                                                />
                                            </DraftField>
                                        )}
                                        {activeCollateral.jobs.length > 1 && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="w-fit"
                                                onClick={() => setCollateralJobs(collateralModal.index, activeCollateral.jobs.filter((_: CollateralJobDraft, currentIndex: number) => currentIndex !== jobIndex))}
                                            >
                                                <Trash2 className="size-4" />Hapus pekerjaan
                                            </Button>
                                        )}
                                    </div>
                                ),
                            )}
                            <Button
                                type="button"
                                variant="outline"
                                className="w-fit"
                                onClick={() => setCollateralJobs(collateralModal.index, [...activeCollateral.jobs, emptyCollateralJobDraft()])}
                            >
                                <Plus className="size-4" />Tambah pekerjaan
                            </Button>
                        </div>
                    )}

                    {activeCollateral && collateralModal?.tab === 'documents' && (
                        <div className="grid gap-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="font-medium">Dokumen awal</div>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        openDocumentEditor({ collateralIndex: collateralModal?.index ?? 0, displayName: '', file: null, kind: 'pendukung' });
                                    }}
                                >
                                    <FilePlus2 className="size-4" />Tambah dokumen pendukung
                                </Button>
                            </div>
                            <div className="grid gap-5">
                                {[
                                    {
                                        label: 'Dokumen wajib',
                                        description: 'Harus dilengkapi sebelum order dapat diajukan.',
                                        items: activeChecklistItems.filter((item: any) => isRequiredChecklist(order, item)),
                                    },
                                    {
                                        label: 'Dokumen tambahan',
                                        description: 'Opsional, diunggah jika relevan dengan pekerjaan atau kondisi agunan.',
                                        items: activeChecklistItems.filter((item: any) => !isRequiredChecklist(order, item)),
                                    },
                                ].filter((group) => group.items.length > 0).map((group) => (
                                    <section key={group.label} className="grid gap-2">
                                        <div>
                                            <div className="font-medium">{group.label}</div>
                                            <p className="text-xs text-muted-foreground">{group.description}</p>
                                        </div>
                                        <div className="grid gap-2 md:grid-cols-2">
                                            {group.items.map((item: any) => {
                                                const pending = documentFor(
                                                    collateralModal?.index ?? -1,
                                                    Number(item.document_checklist?.id),
                                                    item.document_checklist?.job_type_id ?? null,
                                                );
                                                const document = item.order_document || pending;
                                                return (
                                                    <div key={item.id} className="grid min-w-0 gap-2 rounded-md border p-3 text-sm">
                                                        <div className="flex items-start gap-2">
                                                            <span className={document ? 'mt-0.5 flex size-5 items-center justify-center rounded border border-green-500 bg-green-500 text-xs text-white' : 'mt-0.5 flex size-5 items-center justify-center rounded border border-input text-xs text-muted-foreground'}>{document ? '✓' : ''}</span>
                                                            <span className="font-medium">{item.document_checklist?.name}</span>
                                                        </div>
                                                        {item.order_document ? (
                                                            <div className="flex min-w-0 items-center justify-between gap-2 text-xs">
                                                                <span className="block min-w-0 flex-1 truncate overflow-hidden text-muted-foreground">{item.order_document.display_name ?? item.order_document.original_name}</span>
                                                                <div className="flex shrink-0 gap-2">
                                                                    <Button type="button" variant="outline" size="sm" onClick={() => window.open(`/orders/${order.id}/documents/${item.order_document.id}/preview`, '_blank', 'noopener,noreferrer')}><Eye className="size-4" />Lihat</Button>
                                                                    <Button type="button" variant="outline" size="sm" onClick={() => openDocumentEditor({ collateralIndex: collateralModal?.index ?? 0, documentId: item.order_document.id, displayName: item.order_document.display_name ?? '', file: null, kind: 'agunan' })}>
                                                                        Ganti
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ) : pending ? (
                                                            <div className="flex min-w-0 items-center justify-between gap-2 text-xs">
                                                                <span className="min-w-0 flex-1 truncate text-muted-foreground">{pending.file.name}</span>
                                                                <Button type="button" variant="outline" size="sm" onClick={() => removePendingDocument(pending)}>Hapus</Button>
                                                            </div>
                                                        ) : (
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                className="w-fit"
                                                                onClick={() => openChecklistEditor(
                                                                    collateralModal?.index ?? 0,
                                                                                        Number(item.id),
                                                                    item.document_checklist?.job_type_id ?? null,
                                                                )}
                                                            >
                                                                <FilePlus2 className="size-4" />Input dokumen
                                                            </Button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </section>
                                ))}
                            </div>
                            <div className="border-t pt-4">
                                <div className="font-medium">Dokumen pendukung</div>
                                <p className="mt-1 text-xs text-muted-foreground">Opsional. Tidak menghalangi pengajuan jika belum tersedia.</p>
                                {activeSupportingDocuments.length > 0 ? (
                                    <ul className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                                        {activeSupportingDocuments.map((document: any) => (
                                            <li key={document.id} className="flex min-w-0 items-center justify-between gap-2 rounded-md border p-2">
                                                <span className="min-w-0 flex-1 truncate text-muted-foreground">{document.display_name || document.original_name}</span>
                                                {document.pending ? (
                                                    <Button type="button" variant="outline" size="sm" onClick={() => removePendingDocument(document.source)}>
                                                        Hapus
                                                    </Button>
                                                ) : (
                                                    <div className="flex shrink-0 gap-2">
                                                        <Button type="button" variant="outline" size="sm" onClick={() => window.open(`/orders/${order.id}/documents/${document.id}/preview`, '_blank', 'noopener,noreferrer')}>
                                                            <Eye className="size-4" />Lihat
                                                        </Button>
                                                        <Button type="button" variant="outline" size="sm" onClick={() => openDocumentEditor({ collateralIndex: collateralModal?.index ?? 0, documentId: document.id, displayName: document.display_name || '', file: null, kind: 'pendukung' })}>
                                                            Ganti
                                                        </Button>
                                                    </div>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="mt-2 text-sm text-muted-foreground">Belum ada dokumen pendukung.</p>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
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

function orderDraftFrom(order: any): OrderDraft {
    const saved = order.collaterals ?? [];
    const collaterals = order.core_account_id && order.core_snapshot
        ? order.core_snapshot.collaterals.map((source: CoreAccount['collaterals'][number]) => {
            const savedCollateral = saved.find((item: any) => item.agunan_id === source.collateral_id);
            return {
                ...savedCollateral,
                id: savedCollateral?.id ?? '',
                agunan_id: source.collateral_id,
                nama_agunan: source.type_name,
                deskripsi_agunan: source.description,
            };
        })
        : saved;

    return {
        core_account_id: order.core_account_id ?? '',
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
        collaterals: collaterals.map((item: any) => ({
            id: String(item.id ?? ''),
            agunan_id: item.agunan_id ?? '',
            nama_agunan: item.nama_agunan ?? '',
            deskripsi_agunan: item.deskripsi_agunan ?? '',
            covernote_no: item.covernote_no ?? '',
            covernote_start: dateInput(item.covernote_start),
            covernote_end: dateInput(item.covernote_end),
            jobs: (item.jobs?.length ? item.jobs : item.job_type_id ? [item] : [{}]).map((job: any) => ({
                id: String(job.id ?? ''),
                job_type_id: String(job.job_type_id ?? ''),
                deskripsi_pekerjaan: job.deskripsi_pekerjaan ?? '',
                sla_days: job.sla_source === 'override' && job.sla_days ? String(job.sla_days) : '',
                sla_override_reason: job.sla_override_reason ?? '',
            })),
        })),
    };
}

function emptyCollateralDraft(): CollateralDraft {
    return {
        id: '',
        agunan_id: '',
        nama_agunan: '',
        deskripsi_agunan: '',
        covernote_no: '',
        covernote_start: '',
        covernote_end: '',
        jobs: [emptyCollateralJobDraft()],
    };
}

function emptyCollateralJobDraft(): CollateralJobDraft {
    return { id: '', job_type_id: '', deskripsi_pekerjaan: '', sla_days: '', sla_override_reason: '' };
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

function OrderTrackingHero({
    order,
    paymentAccount,
}: {
    order: any;
    paymentAccount: { bank_name?: string | null; bank_account_number?: string | null; bank_account_name?: string | null } | null;
}) {
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
                <div className="grid content-start gap-4 border-t border-sidebar-border bg-sidebar p-4 text-sidebar-foreground lg:border-t-0 md:p-5">
                    <div>
                        <h3 className="inline-flex items-center rounded-full border-[3px] border-[var(--brand-blue)] bg-[var(--brand-yellow-middle)] px-3 py-1 text-sm font-bold text-[var(--brand-blue)]">
                            Ringkasan order
                        </h3>
                        <div className="mt-3 border-t-2 border-dashed border-sidebar-border pt-3">
                            <div className="text-xs text-muted-foreground">
                                Nomor order
                            </div>
                            <div className="mt-1 text-lg font-semibold tracking-tight">
                                {order.order_no}
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground">
                                {order.customer_name} · {order.branch?.name ?? '-'}
                            </div>
                        </div>
                    </div>
                    <div className="grid gap-x-4 gap-y-2.5 border-t-2 border-dashed border-sidebar-border pt-3 sm:grid-cols-2 lg:grid-cols-1">
                        <SummaryInfo label="Notaris" value={order.notary?.name} />
                        <SummaryInfo
                            label="Nomor rekening nasabah"
                            value={order.no_rekening}
                        />
                        {paymentAccount && (
                            <>
                                <SummaryInfo label="Bank notaris" value={paymentAccount.bank_name} />
                                <SummaryInfo label="Nomor rekening notaris" value={paymentAccount.bank_account_number} />
                                <SummaryInfo label="Atas nama rekening" value={paymentAccount.bank_account_name} />
                            </>
                        )}
                        <SummaryInfo label="Plafon" value={money(order.plafon)} />
                        <SummaryInfo
                            label="Tanggal akad"
                            value={formatTimelineDate(order.tgl_realisasi)}
                        />
                        <SummaryInfo
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
        persiapan_pekerjaan: 'Persiapan pekerjaan notaris',
        menunggu_approval_covernote: 'Menunggu approval biaya & covernote',
        menunggu_approval_covernote_kepala_cabang:
            'Menunggu approval biaya & covernote Pimpinan Cabang',
        perbaikan_covernote: 'Perbaikan biaya & covernote',
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
        persiapan_pekerjaan: 'Notaris menyiapkan biaya dan covernote',
        menunggu_approval_covernote: 'Biaya dan covernote diajukan untuk persetujuan',
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
        perbaikan_covernote: 'Biaya dan covernote dikembalikan untuk perbaikan',
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

function isRequiredChecklist(order: any, checklist: any): boolean {
    const status = String(
        order.core_snapshot?.customer?.marital_status ??
            order.core_snapshot?.customer_marital_status ??
            '',
    ).toLowerCase().trim();
    const name = String(checklist.document_checklist?.name ?? '').toLowerCase().trim();
    const spouseRequired = name === 'ktp pasangan' && ['married', 'kawin', 'menikah'].includes(status);

    return checklist.document_checklist?.is_active !== false && (
        checklist.document_checklist?.is_required !== false ||
        spouseRequired
    );
}

OrdersShow.layout = {
    breadcrumbs: [{ title: 'Order', href: '/orders' }],
};
