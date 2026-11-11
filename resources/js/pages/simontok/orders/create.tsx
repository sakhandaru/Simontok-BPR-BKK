import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, FilePlus2, LoaderCircle, Plus, Search, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useState, type ReactNode } from 'react';
import InputError from '@/components/input-error';
import { RupiahInput } from '@/components/rupiah-input';
import { SimSelect } from '@/components/sim-select';
import { SimCreatableCombobox } from '@/components/sim-creatable-combobox';
import { saveCollateralType } from '@/lib/collateral-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Option = { id: number; code?: string; name: string };
type CollateralForm = { job_type_id: string; agunan_id: string; nama_agunan: string; deskripsi_agunan: string; deskripsi_pekerjaan: string; sla_days: string; sla_override_reason: string };
type OrderForm = { core_account_id: string; branch_id: string; notary_id: string; customer_name: string; no_rekening: string; tgl_masuk_notaris: string; tgl_realisasi: string; plafon: string; nominal: string; skema_pembayaran: string; keterangan: string; collaterals: CollateralForm[] };
type CoreAccountResult = { account_id: string; account_number: string; customer_id: string; customer_name: string; credit: { loan_amount: number | string | null }; branch: { code: string; name: string }; collateral_count: number };
type CoreAccount = CoreAccountResult & { collaterals: { collateral_id: string; type_name: string; description: string }[] };

const emptyCollateral = (): CollateralForm => ({ job_type_id: '', agunan_id: '', nama_agunan: '', deskripsi_agunan: '', deskripsi_pekerjaan: '', sla_days: '', sla_override_reason: '' });

export default function OrdersCreate({ branches, notaries, jobTypes, collateralTypes, paymentSchemes, slaPolicies, defaultBranchId, branchLocked }: { branches: Option[]; notaries: Option[]; jobTypes: Option[]; collateralTypes: string[]; paymentSchemes?: string[]; slaPolicies: Record<string, { days: number; source: string }>; defaultBranchId: number | null; branchLocked: boolean }) {
    const { data, setData, post, processing, errors } = useForm<OrderForm>({ core_account_id: '', branch_id: defaultBranchId ? String(defaultBranchId) : '', notary_id: '', customer_name: '', no_rekening: '', tgl_masuk_notaris: '', tgl_realisasi: '', plafon: '', nominal: '', skema_pembayaran: '', keterangan: '', collaterals: [emptyCollateral()] });
    const [coreQuery, setCoreQuery] = useState('');
    const [coreResults, setCoreResults] = useState<CoreAccountResult[]>([]);
    const [coreLoading, setCoreLoading] = useState(false);
    const [coreSelected, setCoreSelected] = useState<CoreAccount | null>(null);

    useEffect(() => {
        const query = coreQuery.trim();
        if (query.length < 2 || coreSelected) {
            setCoreResults([]);
            return;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            setCoreLoading(true);
            try {
                const response = await fetch(`/core/accounts?query=${encodeURIComponent(query)}`, { headers: { Accept: 'application/json' }, signal: controller.signal });
                if (!response.ok) throw new Error('Pencarian rekening gagal.');
                const payload = await response.json() as { data: CoreAccountResult[] };
                setCoreResults(payload.data);
            } catch (error) {
                if ((error as DOMException).name !== 'AbortError') setCoreResults([]);
            } finally {
                setCoreLoading(false);
            }
        }, 250);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [coreQuery, coreSelected]);

    const selectCoreAccount = async (result: CoreAccountResult) => {
        setCoreLoading(true);
        try {
            const response = await fetch(`/core/accounts/${encodeURIComponent(result.account_id)}`, { headers: { Accept: 'application/json' } });
            if (!response.ok) throw new Error('Detail rekening gagal dimuat.');
            const payload = await response.json() as { data: CoreAccount };
            const account = payload.data;
            const branch = branches.find((item) => item.code === account.branch.code);
            setCoreSelected(account);
            setCoreQuery(`${account.customer_name} · ${account.account_number}`);
            setData('core_account_id', account.account_id);
            setData('customer_name', account.customer_name);
            setData('no_rekening', account.account_number);
            setData('plafon', account.credit.loan_amount === null ? '' : String(account.credit.loan_amount).replace(/\.00$/, ''));
            if (branch) setData('branch_id', String(branch.id));
            setData('collaterals', account.collaterals.length > 0
                ? account.collaterals.map((collateral) => ({ ...emptyCollateral(), agunan_id: collateral.collateral_id, nama_agunan: collateral.type_name, deskripsi_agunan: collateral.description }))
                : [emptyCollateral()]);
        } finally {
            setCoreLoading(false);
            setCoreResults([]);
        }
    };

    const clearCoreAccount = () => {
        setCoreSelected(null);
        setCoreQuery('');
        setData('core_account_id', '');
    };
    const submit = (event: FormEvent) => { event.preventDefault(); post('/orders'); };
    const setCollateral = (index: number, key: keyof CollateralForm, value: string) => { const next = [...data.collaterals]; next[index] = { ...next[index], [key]: value }; setData('collaterals', next); };

    return <><Head title="Buat order" /><form onSubmit={submit} className="flex h-full flex-1 flex-col gap-6 p-4 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><h1 className="text-2xl font-semibold">Buat order</h1><p className="mt-1 text-sm text-muted-foreground">Lengkapi data order dalam satu form. Order akan tersimpan sebagai draft.</p></div><div className="flex gap-2"><Button variant="outline" asChild><Link href="/orders"><ArrowLeft className="size-4" />Kembali</Link></Button><Button type="submit" disabled={processing}><FilePlus2 className="size-4" />Simpan draft</Button></div></div>
        <section className="grid gap-4 rounded-lg border p-4 md:grid-cols-2"><div className="md:col-span-2"><h2 className="font-medium">Identitas order</h2><p className="mt-1 text-sm text-muted-foreground">Tentukan cabang, notaris rekanan, dan data nasabah.</p></div>
            <div className="md:col-span-2 rounded-md border bg-muted/20 p-3"><div className="flex items-center gap-2"><Search className="size-4 text-muted-foreground" /><div><h3 className="text-sm font-medium">Ambil data dari BU Core</h3><p className="text-xs text-muted-foreground">Cari nama nasabah atau nomor rekening. Mode UAT memakai data dummy.</p></div></div><div className="relative mt-3"><Input value={coreQuery} onChange={(event) => { setCoreQuery(event.target.value); if (coreSelected) clearCoreAccount(); }} placeholder="Ketik minimal 2 karakter" aria-label="Cari nasabah atau nomor rekening" />{coreLoading && <LoaderCircle className="absolute right-3 top-2.5 size-4 animate-spin text-muted-foreground" />}{coreResults.length > 0 && <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-background shadow-md">{coreResults.map((result) => <button key={result.account_id} type="button" className="block w-full border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-muted" onClick={() => void selectCoreAccount(result)}><span className="font-medium">{result.customer_name}</span><span className="ml-2 text-muted-foreground">{result.account_number}</span><span className="mt-0.5 block text-xs text-muted-foreground">{result.branch.name} · {result.collateral_count} agunan</span></button>)}</div>}{coreSelected && <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">Data rekening terpilih akan disimpan sebagai snapshot pada order.</p>}{errors.core_account_id && <InputError message={errors.core_account_id} />}</div></div>
            <Field label="Cabang" error={errors.branch_id}><SimSelect value={data.branch_id} onChange={(value) => setData('branch_id', value)} options={branches.map((item) => ({ value: String(item.id), label: `${item.code} - ${item.name}` }))} placeholder="Pilih cabang" disabled={branchLocked || Boolean(coreSelected)} />{(branchLocked || coreSelected) && <p className="text-xs text-muted-foreground">{coreSelected ? 'Mengikuti cabang rekening yang dipilih dari BU Core.' : 'Otomatis mengikuti cabang yang terdaftar pada akun Anda.'}</p>}</Field>
            <Field label="Notaris" error={errors.notary_id}><SimSelect value={data.notary_id} onChange={(value) => setData('notary_id', value)} options={notaries.map((item) => ({ value: String(item.id), label: item.name }))} placeholder="Pilih notaris" /></Field>
            <Field label="Nama nasabah" error={errors.customer_name}><Input value={data.customer_name} onChange={(e) => setData('customer_name', e.target.value)} readOnly={Boolean(coreSelected)} /></Field><Field label="No rekening" error={errors.no_rekening}><Input value={data.no_rekening} onChange={(e) => setData('no_rekening', e.target.value)} readOnly={Boolean(coreSelected)} /></Field>
            <Field label="Tanggal akad" error={errors.tgl_realisasi}><Input type="date" value={data.tgl_realisasi} onChange={(e) => setData('tgl_realisasi', e.target.value)} /></Field><Field label="Tanggal masuk notaris" error={errors.tgl_masuk_notaris}><Input type="date" value={data.tgl_masuk_notaris} onChange={(e) => setData('tgl_masuk_notaris', e.target.value)} /><p className="text-xs text-muted-foreground">Menjadi titik awal perhitungan SLA setiap agunan.</p></Field>
            <Field label="Plafon"><RupiahInput value={data.plafon} onChange={(value) => setData('plafon', value)} readOnly={Boolean(coreSelected)} /></Field><Field label="Nominal jasa"><RupiahInput value={data.nominal} onChange={(value) => setData('nominal', value)} /></Field><Field label="Skema pembayaran"><SimSelect value={data.skema_pembayaran} options={['Bayar awal', 'Bayar sebagian'].map((value) => ({ value, label: value }))} placeholder="Pilih skema pembayaran" onChange={(value) => setData('skema_pembayaran', value)} /></Field><Field label="Keterangan"><textarea className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm" value={data.keterangan} onChange={(e) => setData('keterangan', e.target.value)} /></Field>
        </section>
            <section className="flex flex-col gap-4 rounded-lg border p-4"><div className="flex items-center justify-between gap-3"><div><h2 className="font-medium">Agunan</h2><p className="mt-1 text-sm text-muted-foreground">{coreSelected ? 'Identitas agunan mengikuti rekening yang dipilih dari BU Core.' : 'Tambahkan jenis pekerjaan dan detail setiap agunan.'}</p></div>{!coreSelected && <Button type="button" size="sm" onClick={() => setData('collaterals', [...data.collaterals, emptyCollateral()])}><Plus className="size-4" />Tambah agunan</Button>}</div>
            {data.collaterals.map((collateral, index) => <div key={index} className="grid gap-4 border-t pt-4 md:grid-cols-2"><Field label="Jenis pekerjaan" error={errors[`collaterals.${index}.job_type_id` as keyof typeof errors]}><SimSelect value={collateral.job_type_id} onChange={(value) => setCollateral(index, 'job_type_id', value)} options={jobTypes.map((item) => ({ value: String(item.id), label: item.name }))} placeholder="Pilih jenis pekerjaan" /></Field><Field label="ID agunan" error={errors[`collaterals.${index}.agunan_id` as keyof typeof errors]}><Input value={collateral.agunan_id} onChange={(e) => setCollateral(index, 'agunan_id', e.target.value)} readOnly={Boolean(coreSelected)} /></Field><Field label="Jenis agunan" error={errors[`collaterals.${index}.nama_agunan` as keyof typeof errors]}><SimCreatableCombobox id={`collateral-type-create-${index}`} value={collateral.nama_agunan} options={collateralTypes} placeholder="Pilih atau ketik jenis agunan" emptyLabel="Belum ada pilihan jenis agunan." onAdd={saveCollateralType} onChange={(value) => setCollateral(index, 'nama_agunan', value)} disabled={Boolean(coreSelected)} /></Field><Field label="Deskripsi agunan" error={errors[`collaterals.${index}.deskripsi_agunan` as keyof typeof errors]}><textarea className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm" value={collateral.deskripsi_agunan} onChange={(e) => setCollateral(index, 'deskripsi_agunan', e.target.value)} readOnly={Boolean(coreSelected)} /></Field><Field label="Deskripsi pekerjaan" error={errors[`collaterals.${index}.deskripsi_pekerjaan` as keyof typeof errors]}><textarea className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm" value={collateral.deskripsi_pekerjaan} onChange={(e) => setCollateral(index, 'deskripsi_pekerjaan', e.target.value)} placeholder="Jelaskan pekerjaan yang diminta" /></Field><Field label="SLA pekerjaan (hari)" error={errors[`collaterals.${index}.sla_days` as keyof typeof errors]}><Input type="number" min={1} max={365} value={collateral.sla_days} placeholder={slaPolicies[collateral.job_type_id] ? String(slaPolicies[collateral.job_type_id].days) : 'Otomatis dari kebijakan'} onChange={(e) => setCollateral(index, 'sla_days', e.target.value)} /></Field>{collateral.sla_days && slaPolicies[collateral.job_type_id] && Number(collateral.sla_days) !== slaPolicies[collateral.job_type_id].days && <Field label="Alasan perubahan SLA" error={errors[`collaterals.${index}.sla_override_reason` as keyof typeof errors]}><textarea className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm" value={collateral.sla_override_reason} onChange={(e) => setCollateral(index, 'sla_override_reason', e.target.value)} /></Field>}{data.collaterals.length > 1 && !coreSelected && <Button type="button" variant="outline" size="sm" className="md:w-fit" onClick={() => setData('collaterals', data.collaterals.filter((_, i) => i !== index))}><Trash2 className="size-4" />Hapus agunan</Button>}</div>)}
        </section>
    </form></>;
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) { return <div className="grid gap-2"><Label>{label}</Label>{children}<InputError message={error} /></div>; }

OrdersCreate.layout = { breadcrumbs: [{ title: 'Order', href: '/orders' }, { title: 'Buat', href: '/orders/create' }] };
