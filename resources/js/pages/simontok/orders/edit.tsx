import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { FormEvent } from 'react';
import type { ReactNode } from 'react';
import InputError from '@/components/input-error';
import { RupiahInput } from '@/components/rupiah-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SimSelect } from '@/components/sim-select';
import type { Option } from '@/types';

type CollateralForm = {
    job_type_id: string;
    agunan_id: string;
    deskripsi_agunan: string;
    covernote_no: string;
    covernote_start: string;
    covernote_end: string;
    sla_days: string;
    sla_override_reason: string;
};

type OrderForm = {
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
    collaterals: CollateralForm[];
};

const emptyCollateral = (): CollateralForm => ({
    job_type_id: '',
    agunan_id: '',
    deskripsi_agunan: '',
    covernote_no: '',
    covernote_start: '',
    covernote_end: '',
    sla_days: '',
    sla_override_reason: '',
});

const dateOnly = (value?: string | null) => value?.slice(0, 10) ?? '';

export default function OrdersEdit({ order, branches, notaries, jobTypes, slaPolicies }: { order: any; branches: Option[]; notaries: Option[]; jobTypes: Option[]; slaPolicies: Record<string, { days: number; source: string }> }) {
    const { data, setData, put, processing, errors } = useForm<OrderForm>({
        branch_id: String(order.branch_id ?? ''),
        notary_id: String(order.notary_id ?? ''),
        customer_name: order.customer_name ?? '',
        no_rekening: order.no_rekening ?? '',
        tgl_masuk_notaris: dateOnly(order.tgl_masuk_notaris),
        tgl_realisasi: dateOnly(order.tgl_realisasi),
        plafon: order.plafon ?? '',
        nominal: order.nominal ?? '',
        skema_pembayaran: order.skema_pembayaran ?? '',
        keterangan: order.keterangan ?? '',
        collaterals: order.collaterals?.map((item: any) => ({
            job_type_id: String(item.job_type_id ?? ''),
            agunan_id: item.agunan_id ?? '',
            deskripsi_agunan: item.deskripsi_agunan ?? '',
            covernote_no: item.covernote_no ?? '',
            covernote_start: dateOnly(item.covernote_start),
            covernote_end: dateOnly(item.covernote_end),
            sla_days: item.sla_days ? String(item.sla_days) : '',
            sla_override_reason: item.sla_override_reason ?? '',
        })) ?? [emptyCollateral()],
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        put(`/orders/${order.id}`);
    };

    const setCollateral = (index: number, key: keyof CollateralForm, value: string) => {
        const next = [...data.collaterals];
        next[index] = { ...next[index], [key]: value };
        setData('collaterals', next);
    };

    return (
        <>
            <Head title={`Edit ${order.order_no}`} />
            <form onSubmit={submit} className="flex h-full flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">Edit order</h1>
                        <p className="mt-1 text-sm text-muted-foreground">{order.order_no} masih berstatus draft dan belum dikirim ke notaris.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" asChild><Link href={`/orders/${order.id}`}><ArrowLeft className="size-4" />Batal</Link></Button>
                        <Button type="submit" disabled={processing}><Save className="size-4" />Simpan perubahan</Button>
                    </div>
                </div>

                <section className="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
                    <Field label="Cabang" error={errors.branch_id}>
                        <SimSelect value={data.branch_id} onChange={(value) => setData('branch_id', value)} options={branches.map((item) => ({ value: String(item.id), label: `${item.code} - ${item.name}` }))} placeholder="Pilih cabang" />
                    </Field>
                    <Field label="Notaris" error={errors.notary_id}>
                        <SimSelect value={data.notary_id} onChange={(value) => setData('notary_id', value)} options={notaries.map((item) => ({ value: String(item.id), label: item.name }))} placeholder="Pilih notaris" />
                    </Field>
                    <Field label="Nama nasabah" error={errors.customer_name}><Input value={data.customer_name} onChange={(e) => setData('customer_name', e.target.value)} /></Field>
                    <Field label="No rekening" error={errors.no_rekening}><Input value={data.no_rekening} onChange={(e) => setData('no_rekening', e.target.value)} /></Field>
                    <Field label="Tanggal akad"><Input type="date" value={data.tgl_realisasi} onChange={(e) => setData('tgl_realisasi', e.target.value)} /></Field>
                    <Field label="Tanggal masuk notaris" error={errors.tgl_masuk_notaris}><Input type="date" value={data.tgl_masuk_notaris} onChange={(e) => setData('tgl_masuk_notaris', e.target.value)} /></Field>
                    <Field label="Plafon"><RupiahInput value={data.plafon} onChange={(value) => setData('plafon', value)} /></Field>
                    <Field label="Nominal jasa"><RupiahInput value={data.nominal} onChange={(value) => setData('nominal', value)} /></Field>
                    <Field label="Skema pembayaran"><Input list="payment-schemes-edit" value={data.skema_pembayaran} onChange={(e) => setData('skema_pembayaran', e.target.value)} placeholder="Pilih atau ketik skema" /><datalist id="payment-schemes-edit"><option value="Transfer penuh" /><option value="Lainnya" /></datalist></Field>
                </section>

                <section className="flex flex-col gap-4 rounded-lg border p-4">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="font-medium">Agunan</h2>
                        <Button type="button" variant="outline" size="sm" onClick={() => setData('collaterals', [...data.collaterals, emptyCollateral()])}>
                            <Plus className="size-4" />
                            Tambah
                        </Button>
                    </div>
                    {data.collaterals.map((collateral, index) => (
                        <div key={index} className="grid gap-4 border-t pt-4 md:grid-cols-2">
                            <Field label="Jenis pekerjaan">
                                <SimSelect value={collateral.job_type_id} onChange={(value) => setCollateral(index, 'job_type_id', value)} options={jobTypes.map((item) => ({ value: String(item.id), label: item.name }))} placeholder="Pilih jenis" />
                            </Field>
                            <Field label="ID agunan"><Input value={collateral.agunan_id} onChange={(e) => setCollateral(index, 'agunan_id', e.target.value)} /></Field>
                            <Field label="Deskripsi agunan">
                                <textarea className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm" value={collateral.deskripsi_agunan} onChange={(e) => setCollateral(index, 'deskripsi_agunan', e.target.value)} />
                            </Field>
                            <Field label="SLA order (hari)" error={errors[`collaterals.${index}.sla_days` as keyof typeof errors]}><Input type="number" min={1} max={365} value={collateral.sla_days} placeholder={slaPolicies[collateral.job_type_id] ? String(slaPolicies[collateral.job_type_id].days) : 'Otomatis'} onChange={(e) => setCollateral(index, 'sla_days', e.target.value)} /></Field>
                            {collateral.sla_days && slaPolicies[collateral.job_type_id] && Number(collateral.sla_days) !== slaPolicies[collateral.job_type_id].days && <Field label="Alasan perubahan SLA" error={errors[`collaterals.${index}.sla_override_reason` as keyof typeof errors]}><textarea className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm" value={collateral.sla_override_reason} onChange={(e) => setCollateral(index, 'sla_override_reason', e.target.value)} /></Field>}
                            {data.collaterals.length > 1 && (
                                <Button type="button" variant="outline" size="sm" className="md:w-fit" onClick={() => setData('collaterals', data.collaterals.filter((_, i) => i !== index))}>
                                    <Trash2 className="size-4" />
                                    Hapus agunan
                                </Button>
                            )}
                        </div>
                    ))}
                </section>
            </form>
        </>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
    return (
        <div className="grid gap-2">
            <Label>{label}</Label>
            {children}
            <InputError message={error} />
        </div>
    );
}

OrdersEdit.layout = {
    breadcrumbs: [
        { title: 'Order', href: '/orders' },
        { title: 'Edit', href: '#' },
    ],
};
