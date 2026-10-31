import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowDown, ArrowLeft, ArrowUp, Check, Eye, FileText, FileUp, Plus, Save, Send, Trash2 } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import InputError from '@/components/input-error';
import { RupiahInput } from '@/components/rupiah-input';
import { SimActionAlert } from '@/components/sim-action-alert';
import { SimFileUpload } from '@/components/sim-file-upload';
import { SimSelect } from '@/components/sim-select';
import { SimStatusBadge, toneForStatus } from '@/components/sim-status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function NotaryOrderTransition({
    order,
    agreement,
    stepFees,
    serviceFee,
    canEditTransition,
    revisionReason,
}: {
    order: any;
    agreement: any | null;
    stepFees: any[];
    serviceFee: { main: number; steps: number; total: number };
    canEditTransition: boolean;
    revisionReason?: string | null;
}) {
    const [agreementOpened, setAgreementOpened] = useState(Boolean(agreement?.acknowledged));
    const [agreementConfirmed, setAgreementConfirmed] = useState(Boolean(agreement?.acknowledged));
    const firstCollateral = order.collaterals?.[0];
    const initialFees = useMemo(
        () => stepFees.length > 0 ? stepFees.map((fee: any) => ({ ...fee, amount: Number(fee.amount ?? 0) })) : order.collaterals.flatMap((collateral: any) =>
            (collateral.job_type?.steps ?? [])
                .filter((step: any) => step.is_active !== false)
                .map((step: any) => {
                    return {
                        id: null,
                        order_collateral_id: collateral.id,
                        job_type_step_id: step.id,
                        step_name: step.name,
                        amount: 0,
                    };
                }),
        ),
        [order.collaterals, stepFees],
    );
    const fees = useForm({ fees: initialFees });
    const covernoteSubmission = useForm({
        covernote_no: order.covernote_no ?? '',
        covernote_start: dateInput(order.covernote_start),
        covernote_end: dateInput(order.covernote_end),
        komitmen_penyelesaian: dateInput(order.komitmen_penyelesaian),
        file: null as File | null,
    });
    const status = statusValue(order.status);
    const isWaitingApproval = ['menunggu_approval_covernote', 'menunggu_approval_covernote_kepala_cabang'].includes(status);
    const covernoteReady = Boolean(order.covernote_no && order.covernote_start && order.covernote_end && order.covernote_file_path);
    const feesComplete = fees.data.fees.length > 0
        && fees.data.fees.every((fee: any) => fee.step_name.trim() !== '' && fee.amount !== '' && fee.amount !== null && fee.amount !== undefined)
        && order.collaterals.every((collateral: any) => fees.data.fees.some((fee: any) => Number(fee.order_collateral_id) === collateral.id));
    const stepTotal = fees.data.fees.reduce((sum: number, fee: any) => sum + Number(fee.amount || 0), 0);

    const acknowledgeAgreement = () => {
        router.post(`/notary/orders/${order.id}/agreement/acknowledge`, {}, { preserveScroll: true });
    };

    const submitStepFees = (event: FormEvent) => {
        event.preventDefault();
        fees.put(`/notary/orders/${order.id}/step-fees`, {
            preserveScroll: true,
            onSuccess: () => fees.setDefaults(),
        });
    };

    const updateFee = (index: number, key: string, value: string | number | null) => {
        fees.setData('fees', fees.data.fees.map((fee: any, feeIndex: number) => feeIndex === index ? { ...fee, [key]: value } : fee));
    };

    const addFee = () => {
        fees.setData('fees', [...fees.data.fees, {
            id: null,
            order_collateral_id: Number(firstCollateral?.id),
            job_type_step_id: null,
            step_name: '',
            amount: 0,
        }]);
    };

    const removeFee = (index: number) => fees.setData('fees', fees.data.fees.filter((_: any, feeIndex: number) => feeIndex !== index));

    const moveFee = (index: number, direction: -1 | 1) => {
        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= fees.data.fees.length) return;
        const next = [...fees.data.fees];
        [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
        fees.setData('fees', next);
    };

    const submitCovernoteDraft = (event: FormEvent) => {
        event.preventDefault();
        covernoteSubmission.post(`/notary/orders/${order.id}/covernote`, {
            forceFormData: true,
            preserveScroll: true,
        });
    };

    const submitTransition = () => {
        router.post(`/notary/orders/${order.id}/transition/submit`, {}, { preserveScroll: true });
    };

    return (
        <>
            <Head title={`Persiapan ${order.order_no}`} />
            <div className="flex h-full flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-2xl font-semibold">Persiapan pekerjaan</h1>
                            <SimStatusBadge label={orderStatusLabel(order.status)} tone={toneForStatus(orderStatusLabel(order.status))} />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{order.order_no} · {order.customer_name} · {order.no_rekening}</p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href="/notary/orders"><ArrowLeft className="size-4" /> Kembali</Link>
                    </Button>
                </div>

                <section className="sim-panel grid gap-4 p-4 md:grid-cols-3">
                    <Info label="Cabang" value={`${order.branch?.code ?? ''} ${order.branch?.name ?? ''}`} />
                    <Info label="Plafon" value={money(order.plafon)} />
                    <Info label="Total jasa sementara" value={money(serviceFee.main + stepTotal)} />
                </section>

                <section className="sim-panel overflow-hidden">
                    <div className="sim-panel-header">
                        <h2 className="font-medium">Jenis agunan dan deskripsi pekerjaan</h2>
                        <p className="mt-1 text-sm text-muted-foreground">Rincian pekerjaan yang diajukan untuk tiap agunan.</p>
                    </div>
                    <div className="divide-y">
                        {order.collaterals.map((collateral: any) => (
                            <div key={collateral.id} className="grid gap-2 p-4 sm:grid-cols-[minmax(180px,0.7fr)_minmax(0,1.3fr)]">
                                <div>
                                    <div className="font-medium">{collateral.nama_agunan || 'Jenis agunan'}</div>
                                    <div className="text-sm text-muted-foreground">{collateral.agunan_id || `AGN-${collateral.id}`}</div>
                                    {collateral.deskripsi_agunan && <p className="mt-1 text-sm text-muted-foreground">{collateral.deskripsi_agunan}</p>}
                                </div>
                                <div className="space-y-2">
                                    {(collateral.jobs?.length ? collateral.jobs : [collateral]).map((job: any, index: number) => (
                                        <div key={job.id ?? index} className="text-sm">
                                            <div className="font-medium">{job.job_type?.name ?? collateral.job_type?.name ?? 'Pekerjaan'}</div>
                                            <p className="text-muted-foreground">{job.deskripsi_pekerjaan || 'Deskripsi pekerjaan belum diisi.'}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {revisionReason && status === 'perbaikan_covernote' && (
                    <SimActionAlert tone="warning" title="Biaya dan covernote perlu diperbaiki" description={revisionReason} />
                )}
                {isWaitingApproval && (
                    <SimActionAlert tone="info" title="Menunggu approval Admin Legal Cabang" description="Biaya per langkah dan covernote sudah diajukan bersama. Perubahan hanya tersedia setelah Admin Legal mengembalikan pengajuan untuk perbaikan." />
                )}

                <section className="sim-panel overflow-hidden">
                    <div className="sim-panel-header">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h2 className="font-medium">PKS notaris</h2>
                                <p className="mt-1 text-sm text-muted-foreground">Baca dan setujui PKS sebelum mengisi biaya langkah.</p>
                            </div>
                            {agreement && <span className="rounded-full border px-2.5 py-1 text-xs font-medium">Versi {agreement.version}</span>}
                        </div>
                    </div>
                    <div className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center">
                        {agreement ? (
                            <div className="flex items-start gap-3">
                                <FileText className="mt-0.5 size-5 text-primary" />
                                <div>
                                    <div className="font-medium">{agreement.original_name}</div>
                                    <div className="mt-1 text-sm text-muted-foreground">{agreement.agreement_type ?? 'Perjanjian'} · Nomor {agreement.pks_no ?? '-'} · Berlaku {dateOnly(agreement.pks_start)} - {dateOnly(agreement.pks_end)}</div>
                                    {agreement.acknowledged && <div className="mt-2 text-xs text-emerald-600">PKS disetujui pada {agreement.acknowledged_at}.</div>}
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-300">PKS aktif belum tersedia. Hubungi Admin Legal sebelum melanjutkan.</div>
                        )}
                        {agreement && <Button type="button" variant="outline" asChild onClick={() => setAgreementOpened(true)}><a href={`/notary/orders/${order.id}/agreement/preview`} target="_blank" rel="noreferrer"><Eye className="size-4" /> Buka preview</a></Button>}
                        {agreement && canEditTransition && !agreement.acknowledged && (
                            <div className="md:col-span-2 rounded-md border-t pt-4">
                                <label className="flex items-start gap-3 text-sm">
                                    <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={agreementConfirmed} disabled={!agreementOpened} onChange={(event) => setAgreementConfirmed(event.target.checked)} />
                                    <span>Saya sudah membaca dan memahami PKS yang berlaku untuk order ini.</span>
                                </label>
                                <Button type="button" className="mt-3" disabled={!agreementOpened || !agreementConfirmed} onClick={acknowledgeAgreement}><Check className="size-4" /> Setujui PKS dan lanjutkan</Button>
                            </div>
                        )}
                    </div>
                </section>

                <section className="sim-panel overflow-hidden">
                    <div className="sim-panel-header">
                        <h2 className="font-medium">Langkah dan biaya pekerjaan</h2>
                        <p className="mt-1 text-sm text-muted-foreground">Biaya ini akan ditambahkan ke harga utama dan disetujui Admin Legal bersama covernote.</p>
                    </div>
                    {!agreement?.acknowledged ? (
                        <div className="p-4 text-sm text-muted-foreground">Bagian ini aktif setelah PKS dibaca dan disetujui.</div>
                    ) : (
                        <form onSubmit={submitStepFees} className="p-4">
                            <div className="divide-y rounded-md border">
                                {fees.data.fees.map((fee: any, index: number) => (
                                    <div key={fee.id ?? `new-${index}`} className="grid gap-3 p-3 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end">
                                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.8fr)]">
                                            <div className="grid gap-1"><Label>Nama langkah</Label><Input value={fee.step_name} onChange={(event) => updateFee(index, 'step_name', event.target.value)} placeholder="Contoh: Pemeriksaan dokumen" /></div>
                                            <div className="grid gap-1"><Label>Agunan</Label><SimSelect value={String(fee.order_collateral_id)} onChange={(value) => updateFee(index, 'order_collateral_id', Number(value))} options={order.collaterals.map((item: any) => ({ value: String(item.id), label: `${item.nama_agunan || 'Jenis agunan'} - ${item.agunan_id || `AGN-${item.id}`}` }))} placeholder="Pilih agunan" /></div>
                                        </div>
                                        {canEditTransition ? <div className="grid gap-1"><Label>Nominal</Label><RupiahInput value={fee.amount} onChange={(value) => updateFee(index, 'amount', value)} /></div> : <div className="font-medium">{money(fee.amount)}</div>}
                                        {canEditTransition && <div className="flex items-center gap-1"><Button type="button" size="icon" variant="outline" aria-label="Naikkan langkah" disabled={index === 0} onClick={() => moveFee(index, -1)}><ArrowUp className="size-4" /></Button><Button type="button" size="icon" variant="outline" aria-label="Turunkan langkah" disabled={index === fees.data.fees.length - 1} onClick={() => moveFee(index, 1)}><ArrowDown className="size-4" /></Button><Button type="button" size="icon" variant="outline" aria-label={`Hapus ${fee.step_name || 'langkah'}`} onClick={() => removeFee(index)}><Trash2 className="size-4" /></Button></div>}
                                    </div>
                                ))}
                            </div>
                            {canEditTransition && <Button type="button" variant="outline" className="mt-3" onClick={addFee}><Plus className="size-4" /> Tambah langkah</Button>}
                            <div className="mt-4 grid gap-2 border-t pt-4 text-sm sm:grid-cols-3">
                                <Info label="Harga utama" value={money(serviceFee.main)} />
                                <Info label="Tambahan langkah" value={money(stepTotal)} />
                                <Info label="Total sementara" value={money(serviceFee.main + stepTotal)} />
                            </div>
                            {canEditTransition && <><InputError message={(fees.errors as any).fees} /><Button type="submit" className="mt-4" disabled={fees.processing || !agreement?.acknowledged || !fees.isDirty || !feesComplete}><Save className="size-4" /> {fees.isDirty ? 'Simpan biaya langkah' : 'Biaya langkah tersimpan'}</Button></>}
                        </form>
                    )}
                </section>

                <section className="sim-panel overflow-hidden">
                    <div className="sim-panel-header">
                        <h2 className="font-medium">Covernote</h2>
                        <p className="mt-1 text-sm text-muted-foreground">Satu covernote berlaku untuk seluruh order dan akan diajukan bersama biaya langkah.</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 text-sm">
                        <div><div className="font-medium">{order.covernote_no || 'Covernote belum disimpan'}</div><div className="mt-1 text-muted-foreground">Berlaku {dateOnly(order.covernote_start)} sampai {dateOnly(order.covernote_end)}</div></div>
                        <SimStatusBadge label={covernoteReady ? 'Draft tersedia' : 'Belum diunggah'} tone={covernoteReady ? 'success' : 'neutral'} />
                    </div>
                    {canEditTransition && (
                        <form onSubmit={submitCovernoteDraft} className="grid gap-4 p-4 md:grid-cols-2">
                            <div className="grid gap-2"><Label>Nomor covernote</Label><Input value={covernoteSubmission.data.covernote_no} onChange={(event) => covernoteSubmission.setData('covernote_no', event.target.value)} placeholder="Nomor covernote" /></div>
                            <div className="grid gap-2"><Label>Tanggal mulai covernote</Label><Input type="date" value={covernoteSubmission.data.covernote_start} onChange={(event) => covernoteSubmission.setData('covernote_start', event.target.value)} /></div>
                            <div className="grid gap-2"><Label>Tanggal berakhir covernote</Label><Input type="date" value={covernoteSubmission.data.covernote_end} onChange={(event) => covernoteSubmission.setData('covernote_end', event.target.value)} /></div>
                            <div className="grid gap-2"><Label>Tanggal komitmen penyelesaian</Label><Input type="date" value={covernoteSubmission.data.komitmen_penyelesaian} onChange={(event) => covernoteSubmission.setData('komitmen_penyelesaian', event.target.value)} /></div>
                            <SimFileUpload value={covernoteSubmission.data.file} onChange={(file) => covernoteSubmission.setData('file', file)} label="Pilih covernote" />
                            <InputError message={(covernoteSubmission.errors as any).file || (covernoteSubmission.errors as any).covernote_no || (covernoteSubmission.errors as any).komitmen_penyelesaian} />
                            <Button type="submit" className="w-fit" disabled={covernoteSubmission.processing}><FileUp className="size-4" /> Simpan covernote</Button>
                        </form>
                    )}
                </section>

                {canEditTransition && (
                    <section className="sim-panel flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
                        <div><h2 className="font-medium">Ajukan untuk approval</h2><p className="mt-1 text-sm text-muted-foreground">Admin Legal akan menyetujui total biaya dan satu covernote order dalam satu tindakan.</p>{(!feesComplete || !covernoteReady) && <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{!feesComplete ? 'Simpan semua nominal langkah. ' : ''}{!covernoteReady ? 'Simpan covernote order terlebih dahulu.' : ''}</p>}</div>
                        <Button type="button" disabled={!agreement?.acknowledged || !feesComplete || !covernoteReady} onClick={submitTransition}><Send className="size-4" /> Ajukan biaya & covernote</Button>
                    </section>
                )}
            </div>
        </>
    );
}

function Info({ label, value }: { label: string; value?: string | null }) {
    return <div><div className="text-sm text-muted-foreground">{label}</div><div className="mt-1 font-medium">{value || '-'}</div></div>;
}

function dateInput(value?: string | null) {
    return value?.slice(0, 10) ?? '';
}

function dateOnly(value?: string | null) {
    return value?.slice(0, 10) ?? '-';
}

function money(value?: string | number | null) {
    if (value === null || value === undefined || value === '') return '-';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value));
}

function statusValue(value?: string | { value?: string } | null) {
    return typeof value === 'object' ? value?.value ?? '' : value ?? '';
}

function orderStatusLabel(value?: string | { value?: string } | null) {
    const labels: Record<string, string> = {
        persiapan_pekerjaan: 'Persiapan pekerjaan notaris',
        menunggu_approval_covernote: 'Menunggu approval biaya & covernote',
        menunggu_approval_covernote_kepala_cabang: 'Menunggu approval Pimpinan Cabang',
        perbaikan_covernote: 'Perbaikan biaya & covernote',
    };
    const key = statusValue(value);
    return labels[key] ?? key.replaceAll('_', ' ');
}

NotaryOrderTransition.layout = {
    breadcrumbs: [{ title: 'Portal Notaris', href: '/notary/orders' }],
};
