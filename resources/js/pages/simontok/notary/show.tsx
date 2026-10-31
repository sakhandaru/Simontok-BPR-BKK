import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    Check,
    ChevronDown,
    Download,
    Eye,
    FileText,
    FileUp,
    Save,
    Send,
    X,
} from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import InputError from '@/components/input-error';
import { RupiahInput } from '@/components/rupiah-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SimSelect } from '@/components/sim-select';
import { SimFileUpload } from '@/components/sim-file-upload';
import { SimStatusBadge, toneForStatus } from '@/components/sim-status-badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

export default function NotaryOrdersShow({
    order,
    canReview,
    initialDocumentsComplete,
    canViewDocuments,
    canRequestInvoice,
    canAddProgress,
    canSubmitFinal,
    canRequestAdditionalDocuments,
    canExtendCovernote,
    paymentBlockers,
    agreement,
    serviceFee,
    stepFees,
}: {
    order: any;
    canReview: boolean;
    initialDocumentsComplete: boolean;
    canViewDocuments: boolean;
    canRequestInvoice: boolean;
    canAddProgress: boolean;
    canSubmitFinal: boolean;
    canRequestAdditionalDocuments: boolean;
    canExtendCovernote: boolean;
    paymentBlockers: string[];
    agreement: any | null;
    serviceFee: { main: number; steps: number; total: number };
    stepFees: any[];
}) {
    const [revisionOpen, setRevisionOpen] = useState(false);
    const [rejectOpen, setRejectOpen] = useState(false);
    const [evidencePreview, setEvidencePreview] = useState<any | null>(null);
    const [finalDocumentsPreview, setFinalDocumentsPreview] = useState<any[] | null>(null);
    const progressOptions = useMemo(() => {
        return Object.fromEntries(
            order.collaterals.map((collateral: any) => [
                collateral.id,
                (stepFees.filter((fee: any) => fee.order_collateral_id === collateral.id).length
                    ? stepFees.filter((fee: any) => fee.order_collateral_id === collateral.id).map((fee: any) => fee.step_name)
                    : collateral.job_type?.steps?.map((step: any) => step.name)) ?? [],
            ]),
        );
    }, [order.collaterals, stepFees]);

    const revision = useForm({ order_collateral_id: '', alasan: '' });
    const reject = useForm({ reason: '' });
    const progress = useForm({
        order_collateral_id: String(order.collaterals[0]?.id ?? ''),
        status: '',
        catatan: '',
        komitmen_penyelesaian: '',
        evidence: null as File | null,
        final_documents: [] as File[],
    });
    const invoice = useForm({
        invoice_no: '',
        nominal: serviceFee.total,
        skema_pembayaran: order.skema_pembayaran ?? '',
        catatan_notaris: '',
    });
    const covernote = useForm({
        order_collateral_id: String(order.collaterals[0]?.id ?? ''),
        new_end: '',
        catatan: '',
        file: null as File | null,
    });
    const documentRequest = useForm({
        order_collateral_id: '',
        name: '',
        reason: '',
    });
    const selectedProgressSteps =
        progressOptions[progress.data.order_collateral_id] ?? [];
    const isFinalProgressStep =
        selectedProgressSteps.length > 0 &&
        progress.data.status ===
            selectedProgressSteps[selectedProgressSteps.length - 1];
    const missingInitialDocuments = order.collaterals.flatMap(
        (collateral: any) =>
            (collateral.checklists ?? [])
                .filter(
                    (checklist: any) =>
                        checklist.document_checklist?.is_active !== false &&
                        checklist.document_checklist?.is_required !== false &&
                        (!checklist.is_checked || !checklist.order_document),
                )
                .map(
                    (checklist: any) =>
                        `${collateral.nama_agunan || collateral.job_type?.name || 'Agunan'} - ${checklist.document_checklist?.name ?? 'Dokumen checklist'}`,
                ),
    );

    const acceptDocuments = () => {
        router.post(
            `/notary/orders/${order.id}/accept-documents`,
            {},
            { preserveScroll: true },
        );
    };

    const submitRevision = (event: FormEvent) => {
        event.preventDefault();
        revision.post(`/notary/orders/${order.id}/request-revision`, {
            preserveScroll: true,
            onSuccess: () => revision.reset(),
        });
    };

    const submitReject = (event: FormEvent) => {
        event.preventDefault();
        reject.post(`/notary/orders/${order.id}/reject`, {
            preserveScroll: true,
            onSuccess: () => reject.reset(),
        });
    };

    const submitProgress = (event: FormEvent) => {
        event.preventDefault();
        progress.post(`/notary/orders/${order.id}/progress`, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () =>
                progress.reset(
                    'status',
                    'catatan',
                    'komitmen_penyelesaian',
                    'evidence',
                    'final_documents',
                ),
        });
    };

    const addFinalDocuments = (files: FileList | null) => {
        const selectedFiles = Array.from(files ?? []);
        const existingFiles = progress.data.final_documents;
        const newFiles = selectedFiles.filter(
            (file) =>
                !existingFiles.some(
                    (existingFile) =>
                        existingFile.name === file.name &&
                        existingFile.size === file.size &&
                        existingFile.lastModified === file.lastModified,
                ),
        );
        progress.setData('final_documents', [
            ...existingFiles,
            ...newFiles,
        ]);
    };

    const removeFinalDocument = (index: number) => {
        progress.setData(
            'final_documents',
            progress.data.final_documents.filter((_, fileIndex) => fileIndex !== index),
        );
    };
    const submitFinal = () =>
        router.post(
            `/notary/orders/${order.id}/documents/submit-final`,
            {},
            { preserveScroll: true },
        );
    const submitInvoice = (event: FormEvent) => {
        event.preventDefault();
        invoice.transform((data) => ({ ...data, nominal: serviceFee.total }));
        invoice.post(`/notary/orders/${order.id}/payment-requests`, {
            preserveScroll: true,
        });
    };
    const submitCovernote = (event: FormEvent) => {
        event.preventDefault();
        covernote.post(
            `/notary/orders/${order.id}/collaterals/${covernote.data.order_collateral_id}/covernote-extensions`,
            {
                forceFormData: true,
                preserveScroll: true,
                onSuccess: () => covernote.reset('new_end', 'catatan', 'file'),
            },
        );
    };
    const submitDocumentRequest = (event: FormEvent) => {
        event.preventDefault();
        documentRequest.post(`/notary/orders/${order.id}/document-requests`, {
            preserveScroll: true,
            onSuccess: () => documentRequest.reset(),
        });
    };

    return (
        <>
            <Head title={`Portal ${order.order_no}`} />
            <div className="flex h-full flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-2xl font-semibold">
                                {order.order_no}
                            </h1>
                            <SimStatusBadge
                                label={orderStatusLabel(order.status, order)}
                                tone={toneForStatus(orderStatusLabel(order.status, order))}
                            />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {order.customer_name} - {order.no_rekening}
                        </p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href="/notary/orders">
                            <ArrowLeft className="size-4" />
                            Kembali
                        </Link>
                    </Button>
                </div>

                <section className="sim-panel grid gap-4 p-4 md:grid-cols-3">
                    <Info
                        label="Cabang"
                        value={`${order.branch?.code ?? ''} ${order.branch?.name ?? ''}`}
                    />
                    <Info label="Plafon" value={money(order.plafon)} />
                    <Info
                        label="Tanggal masuk notaris"
                        value={dateOnly(
                            order.tgl_masuk_notaris ?? order.sent_to_notary_at,
                        )}
                    />
                </section>

                <section className="sim-panel overflow-hidden">
                    <div className="sim-panel-header">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h2 className="font-medium">PKS notaris</h2>
                                <p className="mt-1 text-sm text-muted-foreground">Baca dan setujui PKS yang berlaku sebelum mengisi langkah dan biaya pekerjaan.</p>
                            </div>
                            {agreement && <span className="rounded-full border px-2.5 py-1 text-xs font-medium">Versi {agreement.version}</span>}
                        </div>
                    </div>
                    <div className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center">
                        {agreement ? <>
                            <div className="flex items-start gap-3"><FileText className="mt-0.5 size-5 text-primary" /><div><div className="font-medium">{agreement.original_name}</div><div className="mt-1 text-sm text-muted-foreground">{agreement.agreement_type ?? 'Perjanjian'} · Nomor {agreement.pks_no ?? '-'} · Berlaku {dateOnly(agreement.pks_start)} - {dateOnly(agreement.pks_end)}</div>{agreement.acknowledged && <div className="mt-2 text-xs text-emerald-600">PKS disetujui pada {agreement.acknowledged_at}.</div>}</div></div>
                            <Button type="button" variant="outline" asChild><a href={`/notary/orders/${order.id}/agreement/preview`} target="_blank" rel="noreferrer"><Eye className="size-4" /> Buka preview</a></Button>
                        </> : <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-300">PKS aktif belum tersedia. Hubungi Admin Legal sebelum melanjutkan.</div>}
                    </div>
                </section>

                {canViewDocuments && (
                    <section className="sim-panel overflow-hidden">
                        <div className="sim-panel-header">
                            <h2 className="font-medium">Invoice</h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Invoice diajukan setelah seluruh dokumen final
                                divalidasi BPR dan covernote aman.
                            </p>
                        </div>
                        <div className="grid gap-4 p-4 lg:grid-cols-[1fr_1fr]">
                            <div className="grid gap-3 text-sm">
                                <Info
                                    label="Status pembayaran"
                                    value={
                                        order.payment_request?.status ??
                                        'Belum diajukan'
                                    }
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
                                    label="Catatan admin"
                                    value={
                                        order.payment_request
                                            ?.catatan_verifikasi
                                    }
                                />
                                {paymentBlockers.length > 0 &&
                                    !order.payment_request && (
                                        <div className="rounded-md border bg-muted/30 p-3">
                                            <div className="font-medium">
                                                Belum bisa diajukan
                                            </div>
                                            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                                                {paymentBlockers.map((item) => (
                                                    <li key={item}>{item}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                            </div>

                            {canRequestInvoice && (
                                <form
                                    onSubmit={submitInvoice}
                                    className="grid gap-3 rounded-md border p-3"
                                >
                                    <div className="font-medium">
                                        Ajukan invoice
                                    </div>
                                    <Input
                                        placeholder="Nomor invoice"
                                        value={invoice.data.invoice_no}
                                        onChange={(e) =>
                                            invoice.setData(
                                                'invoice_no',
                                                e.target.value,
                                            )
                                        }
                                    />
                                    <div className="grid gap-1">
                                        <Label>Total jasa</Label>
                                        <RupiahInput
                                            min="1"
                                            value={serviceFee.total}
                                            readOnly
                                            aria-readonly="true"
                                            onChange={() => undefined}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Harga utama ditambah seluruh biaya langkah pekerjaan.
                                        </p>
                                    </div>
                                    <div className="grid gap-1">
                                        <Label>Skema pembayaran</Label>
                                        <Input
                                            value={invoice.data.skema_pembayaran}
                                            readOnly
                                            aria-readonly="true"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Mengikuti skema pembayaran pada order.
                                        </p>
                                    </div>
                                    <textarea
                                        className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm"
                                        value={invoice.data.catatan_notaris}
                                        onChange={(e) =>
                                            invoice.setData(
                                                'catatan_notaris',
                                                e.target.value,
                                            )
                                        }
                                        placeholder="Catatan notaris — tulis rekening tujuan pembayaran jika diperlukan"
                                    />
                                    <InputError
                                        message={
                                            (invoice.errors as any).invoice ||
                                            invoice.errors.nominal
                                        }
                                    />
                                    <Button
                                        className="w-fit"
                                        disabled={invoice.processing}
                                    >
                                        <Send className="size-4" />
                                        Ajukan invoice
                                    </Button>
                                </form>
                            )}
                        </div>
                        {order.payment_request?.payments?.length > 0 && (
                            <div className="border-t px-4 py-3">
                                <div className="font-medium">
                                    Bukti pembayaran
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
                                                        {payment.catatan ?? '-'}
                                                    </div>
                                                </div>
                                                {payment.bukti_path && (
                                                    <a
                                                        className="font-medium underline-offset-4 hover:underline"
                                                        href={`/notary/orders/${order.id}/payment-requests/${order.payment_request.id}/payments/${payment.id}/download`}
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
                    </section>
                )}

                {canReview && (
                    <>
                        <section className="sim-panel overflow-hidden">
                            <div className="sim-panel-header">
                                <h2 className="font-medium">
                                    Data dan dokumen untuk pemeriksaan
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Periksa data order, agunan, dan file sebelum
                                    menerima atau meminta perbaikan.
                                </p>
                            </div>
                            <div className="grid gap-4 p-4 md:grid-cols-2 lg:grid-cols-4">
                                <Info label="Nama nasabah" value={order.customer_name} />
                                <Info label="Nomor rekening" value={order.no_rekening} />
                                <Info label="Tanggal akad" value={dateOnly(order.tgl_realisasi)} />
                                <Info label="Nominal jasa" value={money(order.nominal)} />
                                <Info label="Skema pembayaran" value={order.skema_pembayaran} />
                            </div>
                            <div className="divide-y border-t">
                                {order.collaterals.map((collateral: any) => (
                                    <div key={collateral.id} className="p-4">
                                        <div className="font-medium">
                                            {collateral.nama_agunan || 'Jenis agunan'}
                                            {collateral.agunan_id
                                                ? ` - ${collateral.agunan_id}`
                                                : ` - AGN-${collateral.id}`}
                                        </div>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            {collateral.deskripsi_agunan || '-'}
                                        </p>
                                        <div className="mt-3 space-y-2">
                                            {(collateral.jobs?.length ? collateral.jobs : [collateral]).map((job: any, index: number) => (
                                                <div key={job.id ?? index} className="rounded-md border bg-muted/20 p-3 text-sm">
                                                    <div className="font-medium">{job.job_type?.name ?? 'Pekerjaan'}</div>
                                                    <p className="mt-1 text-muted-foreground">{job.deskripsi_pekerjaan || 'Deskripsi pekerjaan belum diisi.'}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                                            {(collateral.checklists ?? []).map(
                                                (checklist: any) => (
                                                    <div
                                                        key={checklist.id}
                                                        className="rounded-md border p-3 text-sm"
                                                    >
                                                        {checklist.order_document && (
                                                            <a
                                                                href={`/notary/orders/${order.id}/documents/${checklist.order_document.id}/preview`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="relative -mx-3 -mt-3 mb-3 block h-36 overflow-hidden border-b bg-muted/20"
                                                                aria-label={`Preview ${checklist.document_checklist?.name ?? 'dokumen checklist'}`}
                                                            >
                                                                <iframe
                                                                    src={`/notary/orders/${order.id}/documents/${checklist.order_document.id}/preview`}
                                                                    title={`Preview ${checklist.document_checklist?.name ?? 'dokumen checklist'}`}
                                                                    className="pointer-events-none h-full w-full bg-white"
                                                                />
                                                                <span className="absolute inset-x-0 bottom-0 bg-background/90 px-3 py-2 text-xs font-medium opacity-0 transition-opacity hover:opacity-100">
                                                                    Buka preview · {checklist.order_document.original_name}
                                                                </span>
                                                            </a>
                                                        )}
                                                        <div className="flex items-start gap-2">
                                                            <span
                                                                className={
                                                                    checklist.order_document
                                                                        ? 'flex size-5 shrink-0 items-center justify-center rounded bg-emerald-500 text-xs text-white'
                                                                        : 'flex size-5 shrink-0 items-center justify-center rounded border text-xs text-muted-foreground'
                                                                }
                                                            >
                                                                {checklist.order_document ? '✓' : ''}
                                                            </span>
                                                            <span className="font-medium">
                                                                {checklist.document_checklist?.name ?? 'Dokumen checklist'}
                                                            </span>
                                                        </div>
                                                        {checklist.order_document ? (
                                                            <div className="mt-2 truncate text-xs text-muted-foreground">
                                                                File: {checklist.order_document.display_name ?? checklist.order_document.original_name} · v{checklist.order_document.version} · {formatBytes(checklist.order_document.file_size)}
                                                            </div>
                                                        ) : (
                                                            <div className="mt-2 text-xs text-muted-foreground">
                                                                Belum tersedia
                                                            </div>
                                                        )}
                                                    </div>
                                                ),
                                            )}
                                        </div>
                                        {(collateral.documents ?? []).filter(
                                            (document: any) =>
                                                (document.document_type?.value ?? document.document_type) === 'lainnya',
                                        ).length > 0 && (
                                            <div className="mt-3 rounded-md border border-dashed p-3">
                                                <div className="text-sm font-medium">Dokumen pendukung</div>
                                                <div className="mt-2 grid gap-2 md:grid-cols-2">
                                                    {(collateral.documents ?? [])
                                                        .filter(
                                                            (document: any) =>
                                                                (document.document_type?.value ?? document.document_type) === 'lainnya',
                                                        )
                                                        .map((document: any) => (
                                                            <div
                                                                key={document.id}
                                                                className="group overflow-hidden rounded-md border bg-card text-sm"
                                                            >
                                                                <a
                                                                    href={`/notary/orders/${order.id}/documents/${document.id}/preview`}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="relative block h-32 overflow-hidden border-b bg-muted/20"
                                                                    aria-label={`Preview ${document.display_name ?? document.original_name}`}
                                                                >
                                                                    <iframe
                                                                        src={`/notary/orders/${order.id}/documents/${document.id}/preview`}
                                                                        title={`Preview ${document.display_name ?? document.original_name}`}
                                                                        className="pointer-events-none h-full w-full bg-white"
                                                                    />
                                                                    <span className="absolute inset-x-0 bottom-0 bg-background/90 px-3 py-2 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100">
                                                                        <Eye className="mr-1 inline size-3.5" />Buka preview
                                                                    </span>
                                                                </a>
                                                                <div className="p-3">
                                                                    <div className="truncate font-medium">{document.display_name ?? document.original_name}</div>
                                                                    <div className="mt-1 text-xs text-muted-foreground">{formatBytes(document.file_size)}</div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    <section className="sim-panel p-4">
                        <h2 className="font-medium">Verifikasi dokumen awal</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Pilih keputusan setelah memeriksa data nasabah,
                            agunan, dan checklist dokumen.
                        </p>
                        {!initialDocumentsComplete && (
                            <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-300">
                                Checklist belum lengkap. Minta perbaikan untuk:{' '}
                                {missingInitialDocuments.join(', ') || 'dokumen awal'}.
                            </div>
                        )}
                        <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                                type="button"
                                onClick={acceptDocuments}
                                disabled={!initialDocumentsComplete}
                            >
                                <Check className="size-4" />
                                Terima dokumen
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={() => setRejectOpen(!rejectOpen)}
                            >
                                <X className="size-4" />
                                Tolak order
                            </Button>
                        </div>

                        {rejectOpen && (
                            <form
                                onSubmit={submitReject}
                                className="mt-4 grid gap-3 border-t pt-4"
                            >
                                <div className="grid gap-2">
                                    <Label>Alasan penolakan</Label>
                                    <textarea
                                        className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm"
                                        value={reject.data.reason}
                                        onChange={(e) =>
                                            reject.setData(
                                                'reason',
                                                e.target.value,
                                            )
                                        }
                                    />
                                    <InputError
                                        message={reject.errors.reason}
                                    />
                                </div>
                                <Button
                                    className="w-fit"
                                    variant="destructive"
                                    disabled={reject.processing}
                                >
                                    Tolak order
                                </Button>
                            </form>
                        )}
                        </section>
                    </>
                )}

                {canViewDocuments && canRequestAdditionalDocuments && (
                    <section className="sim-panel p-4">
                        <h2 className="font-medium">Minta dokumen tambahan</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Ajukan dokumen yang perlu dilengkapi Admin Legal.
                            Dokumen akan muncul setelah diunggah.
                        </p>
                        <form
                            onSubmit={submitDocumentRequest}
                            className="mt-4 grid gap-4 md:grid-cols-3"
                        >
                            <SimSelect
                                value={documentRequest.data.order_collateral_id}
                                onChange={(value) =>
                                    documentRequest.setData(
                                        'order_collateral_id',
                                        value,
                                    )
                                }
                                options={order.collaterals.map((item: any) => ({
                                    value: String(item.id),
                                    label: `${item.nama_agunan || 'Jenis agunan'} - ${item.agunan_id || `AGN-${item.id}`} - ${item.deskripsi_agunan || 'Tanpa deskripsi'}`,
                                }))}
                                placeholder="Agunan (opsional)"
                            />
                            <Input
                                value={documentRequest.data.name}
                                onChange={(event) =>
                                    documentRequest.setData(
                                        'name',
                                        event.target.value,
                                    )
                                }
                                placeholder="Nama dokumen yang diminta"
                            />
                            <Input
                                value={documentRequest.data.reason}
                                onChange={(event) =>
                                    documentRequest.setData(
                                        'reason',
                                        event.target.value,
                                    )
                                }
                                placeholder="Alasan/keterangan"
                            />
                            <Button
                                className="w-fit"
                                disabled={documentRequest.processing}
                            >
                                <Send className="size-4" />
                                Kirim permintaan
                            </Button>
                        </form>
                        <div className="mt-4 divide-y rounded-md border">
                            {order.document_requests?.map((item: any) => (
                                <div
                                    key={item.id}
                                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                                >
                                    <span>
                                        {item.name} - {item.reason}
                                    </span>
                                    <SimStatusBadge
                                        label={
                                            item.status === 'diunggah'
                                                ? 'Dokumen tersedia'
                                                : 'Menunggu Admin Legal'
                                        }
                                        tone={
                                            item.status === 'diunggah'
                                                ? 'success'
                                                : 'warning'
                                        }
                                    />
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {canExtendCovernote && (
                    <details className="sim-panel group">
                        <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-4 [&::-webkit-details-marker]:hidden">
                            <div>
                                <h2 className="font-medium">
                                    Perpanjang covernote
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Perpanjangan berlaku untuk seluruh order. Masa berlaku saat ini sampai {dateOnly(order.covernote_end) || dateOnly(order.collaterals?.[0]?.covernote_end)}.
                                </p>
                            </div>
                            <ChevronDown className="mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                        </summary>
                        <form
                            onSubmit={submitCovernote}
                            className="border-t p-4"
                        >
                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label>Tanggal jatuh tempo baru</Label>
                                    <Input
                                        type="date"
                                        value={covernote.data.new_end}
                                        onChange={(event) =>
                                            covernote.setData(
                                                'new_end',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <InputError
                                        message={covernote.errors.new_end}
                                    />
                                </div>
                                <div className="grid gap-2 md:col-span-2">
                                    <Label>Catatan</Label>
                                    <textarea
                                        className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm"
                                        value={covernote.data.catatan}
                                        onChange={(event) =>
                                            covernote.setData(
                                                'catatan',
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Catatan perpanjangan"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <SimFileUpload
                                        value={covernote.data.file}
                                        onChange={(file) =>
                                            covernote.setData('file', file)
                                        }
                                        label="Pilih surat perpanjangan"
                                    />
                                </div>
                            </div>
                            <Button
                                className="mt-4"
                                disabled={
                                    covernote.processing ||
                                    !covernote.data.new_end
                                }
                            >
                                <Save className="size-4" />
                                Simpan perpanjangan
                            </Button>
                        </form>
                    </details>
                )}

                {canViewDocuments && canAddProgress && (
                    <form onSubmit={submitProgress} className="sim-panel p-4">
                        <h2 className="font-medium">Tambah progres</h2>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div className="grid gap-2">
                                <Label>Agunan</Label>
                                <SimSelect
                                    value={progress.data.order_collateral_id}
                                    onChange={(value) =>
                                        progress.setData(
                                            'order_collateral_id',
                                            value,
                                        )
                                    }
                                    options={order.collaterals.map(
                                        (collateral: any) => ({
                                            value: String(collateral.id),
                                    label: `${collateral.nama_agunan || 'Jenis agunan'} - ${collateral.agunan_id || collateral.id}`,
                                        }),
                                    )}
                                    placeholder="Pilih agunan"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Langkah</Label>
                                <SimSelect
                                    value={progress.data.status}
                                    onChange={(value) =>
                                        progress.setData('status', value)
                                    }
                                    options={(
                                        progressOptions[
                                            progress.data.order_collateral_id
                                        ] ?? []
                                    ).map((step: string) => ({
                                        value: step,
                                        label: step,
                                    }))}
                                    placeholder="Pilih langkah"
                                />
                                <InputError message={progress.errors.status} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Komitmen penyelesaian</Label>
                                <Input
                                    type="date"
                                    value={progress.data.komitmen_penyelesaian}
                                    onChange={(e) =>
                                        progress.setData(
                                            'komitmen_penyelesaian',
                                            e.target.value,
                                        )
                                    }
                                />
                            </div>
                            <div className="grid gap-2 md:col-span-2">
                                <Label>Catatan progres</Label>
                                <textarea
                                    className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm"
                                    value={progress.data.catatan}
                                    onChange={(e) =>
                                        progress.setData(
                                            'catatan',
                                            e.target.value,
                                        )
                                    }
                                />
                                <InputError message={progress.errors.catatan} />
                            </div>
                            <div className="grid gap-2 md:col-span-2">
                                <Label>Bukti pendukung (opsional)</Label>
                                <SimFileUpload
                                    value={progress.data.evidence}
                                    accept="application/pdf,image/*"
                                    onChange={(file) =>
                                        progress.setData('evidence', file)
                                    }
                                    label="Pilih bukti progres"
                                />
                            </div>
                            {isFinalProgressStep && (
                                <div className="grid gap-2 md:col-span-2">
                                    <Label htmlFor="final-documents">
                                        Dokumen final wajib
                                    </Label>
                                    <label
                                        htmlFor="final-documents"
                                        className="flex min-h-16 cursor-pointer items-center gap-3 rounded-md border border-dashed border-input bg-muted/20 px-3 py-2.5 transition-colors hover:border-ring hover:bg-accent/40"
                                    >
                                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
                                            <FileUp className="size-4" />
                                        </span>
                                        <span className="min-w-0 flex-1 text-sm">
                                            <span className="block font-medium">
                                                Tambah dokumen final
                                            </span>
                                            <span className="block text-xs text-muted-foreground">
                                                PDF, maksimal 10 MB per file ·
                                                bisa ditambahkan bertahap
                                            </span>
                                        </span>
                                        <Input
                                            id="final-documents"
                                            type="file"
                                            accept="application/pdf"
                                            multiple
                                            className="sr-only"
                                            onChange={(event) => {
                                                addFinalDocuments(
                                                    event.target.files,
                                                );
                                                event.currentTarget.value = '';
                                            }}
                                        />
                                    </label>
                                    <p className="text-xs text-muted-foreground">
                                        Pilih satu atau beberapa PDF. Minimal
                                        satu dokumen wajib diunggah untuk
                                        menyelesaikan langkah terakhir.
                                    </p>
                                    {progress.data.final_documents.length >
                                        0 && (
                                        <div className="rounded-md border bg-muted/20 p-3 text-sm">
                                            <div className="font-medium">
                                                {progress.data.final_documents.length}{' '}
                                                dokumen dipilih
                                            </div>
                                            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                                                {progress.data.final_documents.map(
                                                    (file, index) => (
                                                        <li
                                                            key={`${file.name}-${file.size}`}
                                                            className="flex items-center gap-2"
                                                        >
                                                            <span className="min-w-0 flex-1 truncate">
                                                                {file.name}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                                                aria-label={`Hapus ${file.name}`}
                                                                onClick={() =>
                                                                    removeFinalDocument(
                                                                        index,
                                                                    )
                                                                }
                                                            >
                                                                <X className="size-3.5" />
                                                            </button>
                                                        </li>
                                                    ),
                                                )}
                                            </ul>
                                        </div>
                                    )}
                                    <InputError
                                        message={
                                            progress.errors.final_documents
                                        }
                                    />
                                </div>
                            )}
                        </div>
                        <Button className="mt-4" disabled={progress.processing}>
                            <Save className="size-4" />
                            Simpan progres
                        </Button>
                    </form>
                )}

                {canViewDocuments && (
                    <details className="sim-panel group overflow-hidden">
                        <summary className="sim-panel-header flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
                            <div>
                                <h2 className="font-medium">Dokumen pendukung</h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Preview dokumen awal dan dokumen pendukung
                                    pada order ini. Dokumen final direview dari
                                    progres Selesai.
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
                                        const previewUrl = `/notary/orders/${order.id}/documents/${document.id}/preview`;
                                        const downloadUrl = `/notary/orders/${order.id}/documents/${document.id}/download`;

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
                    </details>
                )}

                {canViewDocuments && (
                    <section className="sim-panel">
                        <div className="sim-panel-header font-medium">
                            Riwayat progres
                        </div>
                        <div className="divide-y">
                            {order.progress.length === 0 ? (
                                <div className="px-4 py-6 text-sm text-muted-foreground">
                                    Belum ada progres.
                                </div>
                            ) : (
                                order.progress.map((item: any) => (
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
                                                {item.collateral?.job_type
                                                    ?.name ?? 'Agunan'}{' '}
                                                · Komitmen{' '}
                                                {dateOnly(
                                                    item.komitmen_penyelesaian,
                                                ) || '-'}
                                            </div>
                                            {item.catatan && (
                                                <div
                                                    className="mt-1 truncate text-xs text-muted-foreground"
                                                    title={item.catatan}
                                                >
                                                    {item.catatan}
                                                </div>
                                            )}
                                            {item.evidence_path && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="mt-2"
                                                    onClick={() =>
                                                        setEvidencePreview(item)
                                                    }
                                                >
                                                    <Eye className="size-4" />
                                                    Lihat bukti
                                                </Button>
                                            )}
                                            {item.status ===
                                                (progressOptions[
                                                    item.order_collateral_id
                                                ] ?? [])[(
                                                    progressOptions[
                                                        item.order_collateral_id
                                                    ] ?? []
                                                ).length - 1] &&
                                                order.documents.filter(
                                                    (document: any) =>
                                                        document.document_type ===
                                                            'final' &&
                                                        document.order_collateral_id ===
                                                            item.order_collateral_id,
                                                ).length > 0 && (
                                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                                        <SimStatusBadge
                                                            label={
                                                                order.documents
                                                                    .filter(
                                                                        (document: any) =>
                                                                            document.document_type ===
                                                                                'final' &&
                                                                            document.order_collateral_id ===
                                                                                item.order_collateral_id,
                                                                    )
                                                                    .every(
                                                                        (document: any) =>
                                                                            document.validated_at,
                                                                    )
                                                                    ? 'Tervalidasi'
                                                                    : 'Menunggu validasi'
                                                            }
                                                            tone={
                                                                order.documents
                                                                    .filter(
                                                                        (document: any) =>
                                                                            document.document_type ===
                                                                                'final' &&
                                                                            document.order_collateral_id ===
                                                                                item.order_collateral_id,
                                                                    )
                                                                    .every(
                                                                        (document: any) =>
                                                                            document.validated_at,
                                                                    )
                                                                    ? 'success'
                                                                    : 'warning'
                                                            }
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() =>
                                                                setFinalDocumentsPreview(
                                                                    order.documents.filter(
                                                                        (document: any) =>
                                                                            document.document_type ===
                                                                                'final' &&
                                                                            document.order_collateral_id ===
                                                                                item.order_collateral_id,
                                                                    ),
                                                                )
                                                            }
                                                        >
                                                            <Eye className="size-4" />
                                                            Lihat dokumen final
                                                        </Button>
                                                    </div>
                                                )}
                                            <div className="mt-1 text-xs text-muted-foreground">
                                                Oleh{' '}
                                                {item.user?.name ?? 'Notaris'}
                                            </div>
                                        </div>
                                        <div className="text-xs text-muted-foreground md:text-right">
                                            {formatTimelineDate(
                                                item.created_at,
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                )}

                <Dialog
                    open={Boolean(evidencePreview)}
                    onOpenChange={(open) => !open && setEvidencePreview(null)}
                >
                    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
                        <DialogHeader>
                            <DialogTitle>
                                Bukti progres —{' '}
                                {evidencePreview
                                    ? progressLabel(evidencePreview.status)
                                    : ''}
                            </DialogTitle>
                            <DialogDescription>
                                Bukti yang diunggah notaris untuk langkah ini.
                            </DialogDescription>
                        </DialogHeader>
                        {evidencePreview && (
                            <iframe
                                title={`Bukti ${progressLabel(evidencePreview.status)}`}
                                src={`/notary/orders/${order.id}/progress/${evidencePreview.id}/evidence`}
                                className="h-[min(70vh,42rem)] w-full rounded-md border bg-white"
                            />
                        )}
                    </DialogContent>
                </Dialog>

                <Dialog
                    open={Boolean(finalDocumentsPreview)}
                    onOpenChange={(open) =>
                        !open && setFinalDocumentsPreview(null)
                    }
                >
                    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>Dokumen final</DialogTitle>
                            <DialogDescription>
                                Dokumen final yang diunggah pada progres selesai.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2">
                            {(finalDocumentsPreview ?? []).map(
                                (document: any) => (
                                    <a
                                        key={document.id}
                                        href={`/notary/orders/${order.id}/documents/${document.id}/preview`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center gap-3 rounded-md border p-3 text-sm hover:bg-muted/50"
                                    >
                                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                                        <span className="min-w-0 flex-1 truncate">
                                            {document.original_name}
                                        </span>
                                        <Eye className="size-4 shrink-0 text-muted-foreground" />
                                    </a>
                                ),
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
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

function dateOnly(value?: string | null) {
    return value?.slice(0, 10) ?? '';
}

function formatTimelineDate(value?: string | null): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

function progressLabel(value?: string | null): string {
    if (!value) return 'Progres diperbarui';
    return value
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function orderStatusLabel(
    value?: string | { value?: string } | null,
    order?: any,
): string {
    const key = typeof value === 'object' ? value?.value : value;
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
            'Menunggu approval covernote Kepala Cabang',
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
    };

    const covernoteComplete =
        order?.collaterals?.length > 0 &&
        order.collaterals.every(
            (collateral: any) =>
                collateral.covernote_no &&
                collateral.covernote_end &&
                collateral.covernote_file_path,
        );

    if (key === 'menunggu_approval_covernote' && !covernoteComplete) {
        return 'Menunggu covernote notaris';
    }

    return key ? (labels[key] ?? progressLabel(key)) : 'Status order';
}

function formatBytes(bytes?: number | null): string {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

function money(value?: string | number | null) {
    if (!value) return '-';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(Number(value));
}

NotaryOrdersShow.layout = {
    breadcrumbs: [{ title: 'Portal Notaris', href: '/notary/orders' }],
};
