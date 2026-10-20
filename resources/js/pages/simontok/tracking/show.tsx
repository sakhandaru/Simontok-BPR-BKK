import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Clock3, FileCheck2, Landmark, ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SimEmptyState } from '@/components/sim-empty-state';
import { SimPageHeader } from '@/components/sim-page-header';
import { SimProgress } from '@/components/sim-progress';
import { SimStatusBadge, toneForStatus } from '@/components/sim-status-badge';
import { SimTimeline } from '@/components/sim-timeline';

type TrackingDetail = {
    id: number;
    order_no: string;
    customer_name: string;
    no_rekening: string;
    branch: string | null;
    notary: string | null;
    status_label: string;
    current_node: string;
    progress: number;
    risk_flag: boolean;
    payment_status: string;
    created_at: string | null;
    updated_at: string | null;
    nominal: string | number | null;
    maker: string | null;
    collaterals: {
        id: number;
        job_type: string | null;
        description: string | null;
        doc_status: string | null;
        covernote_status: string | null;
        covernote_no: string | null;
        covernote_end: string | null;
        sla_due_at: string | null;
        handovers_count: number;
    }[];
    journey: {
        id: number;
        track: string;
        from_status: string | null;
        to_status: string;
        reason: string | null;
        created_at: string | null;
    }[];
    payment_request: {
        status: string;
        invoice_no: string | null;
        nominal: string | number | null;
        requested_at: string | null;
        payments_count: number;
    } | null;
};

export default function TrackingShow({ order }: { order: TrackingDetail }) {
    return (
        <>
            <Head title={`Lacak ${order.order_no}`} />
            <div className="sim-workspace gap-6">
                <SimPageHeader title={order.order_no} description={order.customer_name} actions={<Button variant="outline" asChild><Link href="/tracking-orders"><ArrowLeft className="size-4" /> Kembali</Link></Button>} />

                <section className="sim-panel p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-lg font-semibold">{order.current_node}</h2>
                                <SimStatusBadge label={order.status_label} tone={order.risk_flag ? 'danger' : toneForStatus(order.status_label)} />
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">{order.branch ?? '-'} / {order.notary ?? '-'}</p>
                        </div>
                        <div className="text-right text-sm">
                            <div className="font-medium tabular-nums">{order.progress}%</div>
                            <div className="text-muted-foreground">progress pengajuan</div>
                        </div>
                    </div>
                    <SimProgress value={order.progress} label="Progress pengajuan" className="mt-5" />
                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                        <InfoBlock label="Maker" value={order.maker ?? '-'} />
                        <InfoBlock label="Nominal jasa" value={money(order.nominal)} />
                        <InfoBlock label="Dibuat" value={order.created_at ?? '-'} />
                        <InfoBlock label="Update" value={order.updated_at ?? '-'} />
                    </div>
                </section>

                <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
                    <div className="sim-panel overflow-hidden">
                        <div className="sim-panel-header flex items-center gap-2">
                            <Clock3 className="size-4" />
                            <h2 className="sim-panel-title">Journey pengajuan</h2>
                        </div>
                        <div className="p-4">
                            <SimTimeline
                                items={order.journey.map((item) => ({
                                    id: item.id,
                                    title: statusLabel(item.to_status),
                                    description: item.reason ?? 'Status pengajuan diperbarui.',
                                    timestamp: item.created_at ?? '-',
                                    meta: <SimStatusBadge label={`Track ${item.track}`} />,
                                    state: item.to_status.includes('tolak') || item.to_status.includes('batal') ? 'danger' as const : 'complete' as const,
                                }))}
                                empty={<SimEmptyState title="Belum ada riwayat status" description="Perubahan status pengajuan akan muncul di sini." />}
                            />
                        </div>
                    </div>

                    <div className="grid gap-4">
                        <SidePanel icon={FileCheck2} title="Dokumen & covernote">
                            <div className="grid gap-3">
                                {order.collaterals.length === 0 ? <SimEmptyState title="Belum ada agunan" /> : order.collaterals.map((item) => (
                                    <div key={item.id} className="rounded-md border p-3 text-sm">
                                        <div className="font-medium">{item.job_type ?? 'Agunan'}</div>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            <SimStatusBadge label={`Dokumen: ${statusLabel(item.doc_status)}`} tone={toneForStatus(item.doc_status)} />
                                            <SimStatusBadge label={item.covernote_no || item.covernote_end ? `Covernote: ${statusLabel(item.covernote_status)}` : 'Covernote belum tersedia'} tone={item.covernote_no || item.covernote_end ? toneForStatus(item.covernote_status) : 'neutral'} />
                                        </div>
                                        <div className="mt-2 text-muted-foreground">{item.covernote_no || item.covernote_end ? `Jatuh tempo: ${item.covernote_end ?? 'Belum tersedia'}` : 'Nomor dan jatuh tempo menunggu covernote notaris.'}</div>
                                    </div>
                                ))}
                            </div>
                        </SidePanel>

                        <SidePanel icon={ReceiptText} title="Pembayaran">
                            <div className="grid gap-3 text-sm">
                                <div className="space-y-1"><div className="text-xs text-muted-foreground">Status</div><SimStatusBadge label={order.payment_status} tone={toneForStatus(order.payment_status)} /></div>
                                <InfoBlock label="Invoice" value={order.payment_request?.invoice_no ?? '-'} />
                                <InfoBlock label="Nominal" value={money(order.payment_request?.nominal)} />
                                <InfoBlock label="Bukti bayar" value={`${order.payment_request?.payments_count ?? 0} file`} />
                            </div>
                        </SidePanel>

                        <SidePanel icon={Landmark} title="Aksi cepat">
                            <div className="grid gap-2">
                                <Button variant="outline" asChild><Link href={`/orders/${order.id}`}>Buka detail order</Link></Button>
                                <Button variant="outline" asChild><Link href="/reports">Buka laporan</Link></Button>
                            </div>
                        </SidePanel>
                    </div>
                </section>
            </div>
        </>
    );
}

function SidePanel({ icon: Icon, title, children }: { icon: typeof FileCheck2; title: string; children: React.ReactNode }) {
    return (
        <section className="sim-panel">
            <div className="sim-panel-header flex items-center gap-2">
                <Icon className="size-4" />
                <h2 className="sim-panel-title">{title}</h2>
            </div>
            <div className="p-4">{children}</div>
        </section>
    );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-md border bg-muted/20 p-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-sm font-medium">{value || '-'}</div>
        </div>
    );
}

function money(value?: string | number | null) {
    if (!value) return '-';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value));
}

function statusLabel(status?: string | null): string {
    const labels: Record<string, string> = {
        draft: 'Draft',
        diajukan: 'Diajukan',
        menunggu_approval: 'Menunggu approval',
        perlu_perbaikan_order: 'Perlu perbaikan order',
        disetujui_kepala_cabang: 'Disetujui Kepala Cabang',
        menunggu_verifikasi_notaris: 'Menunggu verifikasi notaris',
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

    return status ? labels[status] ?? status : '-';
}

TrackingShow.layout = {
    breadcrumbs: [
        { title: 'Lacak Order', href: '/tracking-orders' },
        { title: 'Detail Journey', href: '#' },
    ],
};
