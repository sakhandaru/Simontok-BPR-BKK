import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, FilePlus2 } from 'lucide-react';
import { FormEvent, type ReactNode } from 'react';
import InputError from '@/components/input-error';
import { SimPageHeader } from '@/components/sim-page-header';
import { SimSelect } from '@/components/sim-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Option = { id: number; code?: string; name: string };

export default function OrdersCreate({ branches, notaries }: { branches: Option[]; notaries: Option[] }) {
    const { data, setData, post, processing, errors } = useForm({ branch_id: '', notary_id: '', customer_name: '', no_rekening: '' });
    const submit = (event: FormEvent) => { event.preventDefault(); post('/orders'); };

    return <><Head title="Buat order" /><div className="sim-workspace">
        <SimPageHeader title="Buat order" description="Buat draft order dengan identitas minimum, lalu lengkapi datanya di halaman detail." actions={<Button variant="outline" asChild><Link href="/orders"><ArrowLeft className="size-4" />Kembali</Link></Button>} />
        <form onSubmit={submit} className="sim-panel max-w-3xl">
            <div className="sim-panel-header"><h2 className="sim-panel-title">Mulai order</h2><p className="sim-panel-subtitle">Pilih tujuan order terlebih dahulu. Data kredit, agunan, dan dokumen diisi setelah draft dibuat.</p></div>
            <div className="grid gap-4 p-4 md:grid-cols-2">
                <Field label="Cabang" error={errors.branch_id}><SimSelect value={data.branch_id} onChange={(value) => setData('branch_id', value)} options={branches.map((item) => ({ value: String(item.id), label: `${item.code} - ${item.name}` }))} placeholder="Pilih cabang" /></Field>
                <Field label="Notaris" error={errors.notary_id}><SimSelect value={data.notary_id} onChange={(value) => setData('notary_id', value)} options={notaries.map((item) => ({ value: String(item.id), label: item.name }))} placeholder="Pilih notaris" /></Field>
                <Field label="Nama nasabah" error={errors.customer_name}><Input value={data.customer_name} onChange={(event) => setData('customer_name', event.target.value)} /></Field>
                <Field label="No rekening" error={errors.no_rekening}><Input value={data.no_rekening} onChange={(event) => setData('no_rekening', event.target.value)} /></Field>
            </div>
            <div className="flex justify-end border-t p-4"><Button disabled={processing}><FilePlus2 className="size-4" />Buat draft order</Button></div>
        </form>
    </div></>;
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
    return <div className="grid gap-2"><Label>{label}</Label>{children}<InputError message={error} /></div>;
}

OrdersCreate.layout = { breadcrumbs: [{ title: 'Order', href: '/orders' }, { title: 'Buat', href: '/orders/create' }] };
