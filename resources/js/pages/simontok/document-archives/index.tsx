import { Head, router, useForm } from '@inertiajs/react';
import { Download, Eye, GitBranch, RotateCcw, Search } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { SimPageHeader } from '@/components/sim-page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SimSelect } from '@/components/sim-select';
import { SimStatusBadge } from '@/components/sim-status-badge';
import { SimTable } from '@/components/sim-table';
import { SimPagination, type SimPaginationLink } from '@/components/sim-pagination';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Paginated } from '@/types';

type ArchiveItem = {
    id: number;
    entity_name?: string;
    version: number;
    file_name: string;
    title: string;
    category: string;
    document_type: string;
    status: 'active' | 'archived';
    uploaded_by: string;
    created_at: string;
    file_size: string;
    metadata?: Record<string, string | number | null>;
    documentable_type: string;
    documentable_id: number;
    document_key: string;
    version_count: number;
};

type ArchiveVersion = { id: number; version: number; file_name: string; status: 'active' | 'archived'; uploaded_by: string; created_at: string; change_note?: string | null; preview_url: string; download_url: string };

function archiveDetail(item: ArchiveItem): { primary: string; secondary?: string } {
    const metadata = item.metadata ?? {};
    if (item.category === 'legalitas_rekanan') return { primary: [metadata.agreement_type, metadata.pks_no].filter(Boolean).join(' · ') || '-', secondary: [metadata.pks_start, metadata.pks_end].filter(Boolean).join(' – ') };
    if (item.category === 'covernote') return { primary: metadata.covernote_no ? `No. ${metadata.covernote_no}` : 'Covernote', secondary: metadata.covernote_end ? `Berlaku sampai ${metadata.covernote_end}` : undefined };
    if (item.category === 'serah_terima') return { primary: metadata.receiver_name ? `Penerima: ${metadata.receiver_name}` : 'Tanda terima', secondary: metadata.handed_over_at ? String(metadata.handed_over_at) : undefined };
    if (item.category === 'bukti_pembayaran') return { primary: metadata.nominal ? `Nominal: ${metadata.nominal}` : 'Bukti pembayaran', secondary: metadata.paid_at ? String(metadata.paid_at) : undefined };
    return { primary: item.title, secondary: item.document_type };
}

export default function DocumentArchives({ filters, notaries, categories, versions }: { filters: { search: string; notary_id: string | number; status: string; category: string }; notaries: { id: number; name: string }[]; categories: string[]; versions: Paginated<ArchiveItem> & { links: SimPaginationLink[] } }) {
    const { data, setData } = useForm(filters);
    const [historyItem, setHistoryItem] = useState<ArchiveItem | null>(null);
    const [historyVersions, setHistoryVersions] = useState<ArchiveVersion[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const tabs = [
        { value: '', label: 'Semua' },
        { value: 'legalitas_rekanan', label: 'Legalitas rekanan' },
        { value: 'dokumen_agunan', label: 'Dokumen agunan' },
        { value: 'covernote', label: 'Covernote' },
        { value: 'hasil_pekerjaan', label: 'Hasil pekerjaan' },
        { value: 'serah_terima', label: 'Serah terima' },
        { value: 'bukti_pembayaran', label: 'Bukti pembayaran' },
    ];
    const activeCategory = data.category || '';
    const filterGridClass = activeCategory === 'legalitas_rekanan'
        ? 'md:grid-cols-[minmax(220px,1fr)_minmax(160px,0.8fr)_minmax(160px,0.75fr)_auto]'
        : 'md:grid-cols-[minmax(220px,1fr)_minmax(160px,0.8fr)_auto]';

    const submit = (event: FormEvent) => {
        event.preventDefault();
        router.get('/document-archives', data, { preserveState: true, preserveScroll: true, replace: true });
    };

    const reset = () => {
        const empty = { search: '', notary_id: '', status: '', category: '' };
        setData(empty);
        router.get('/document-archives', empty, { preserveState: true, replace: true });
    };

    const selectTab = (category: string) => {
        const next = { ...data, category, notary_id: category === 'legalitas_rekanan' ? data.notary_id : '' };
        setData(next);
        router.get('/document-archives', next, { preserveState: true, preserveScroll: true, replace: true });
    };

    const openHistory = async (item: ArchiveItem) => {
        setHistoryItem(item);
        setHistoryVersions([]);
        setHistoryLoading(true);
        try {
            const response = await fetch(`/document-archives/${item.id}/versions`, { headers: { Accept: 'application/json' } });
            const payload = await response.json();
            setHistoryVersions(payload.versions ?? []);
        } finally {
            setHistoryLoading(false);
        }
    };

    return (
        <>
            <Head title="Arsip Dokumen" />
            <div className="sim-workspace">
                <SimPageHeader title="Arsip Dokumen" description="Riwayat versi dokumen legal yang tersimpan dan dapat ditelusuri." />
                <div className="flex gap-1 overflow-x-auto border-b border-border pb-1">{tabs.map((tab) => <button key={tab.value} type="button" onClick={() => selectTab(tab.value)} className={`whitespace-nowrap rounded-t-md px-3 py-2 text-sm transition-colors ${activeCategory === tab.value ? 'border-b-2 border-primary font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}>{tab.label}</button>)}</div>
                <form onSubmit={submit} className={`sim-panel grid gap-3 p-4 ${filterGridClass} md:items-end`}>
                    <div className="grid gap-2"><Label htmlFor="archive-search">Cari dokumen</Label><div className="relative"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="archive-search" className="pl-9" value={data.search} onChange={(event) => setData('search', event.target.value)} placeholder="Nama file, nomor, atau notaris" /></div></div>
                    {activeCategory === 'legalitas_rekanan' && <div className="grid gap-2"><Label>Notaris</Label><SimSelect value={String(data.notary_id || '')} onChange={(value) => setData('notary_id', value)} options={notaries.map((notary) => ({ value: String(notary.id), label: notary.name }))} placeholder="Semua notaris" /></div>}
                    <div className="grid gap-2"><Label>Status versi</Label><SimSelect value={data.status} onChange={(value) => setData('status', value)} options={[{ value: 'active', label: 'Aktif' }, { value: 'archived', label: 'Diarsipkan' }]} placeholder="Semua status" /></div>
                    <div className="flex gap-2"><Button type="submit"><Search className="size-4" />Cari</Button><Button type="button" variant="outline" onClick={reset}><RotateCcw className="size-4" />Reset</Button></div>
                </form>

                <div className="hidden md:block"><SimTable raw><table className="sim-table w-full min-w-[1080px] text-sm"><thead className="bg-muted/50 text-left text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Dokumen</th><th className="px-4 py-3 font-medium">Entitas</th><th className="px-4 py-3 font-medium">Detail</th><th className="px-4 py-3 font-medium">Versi terakhir</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Diunggah</th><th className="px-4 py-3 font-medium">Aksi</th></tr></thead><tbody>{versions.data.length ? versions.data.map((item) => { const detail = archiveDetail(item); return <tr key={item.id} className="border-t align-top"><td className="max-w-[280px] px-4 py-3"><div className="flex items-start gap-2"><span className="mt-0.5"><Eye className="size-4 text-muted-foreground" /></span><div className="min-w-0"><div className="truncate font-medium" title={item.file_name}>{item.title}</div><div className="truncate text-xs text-muted-foreground" title={item.file_name}>{item.file_name}</div><div className="mt-1 text-xs text-muted-foreground">{item.file_size}</div></div></div></td><td className="px-4 py-3">{item.entity_name ?? '-'}</td><td className="px-4 py-3"><div className="font-medium">{detail.primary}</div><div className="mt-1 text-xs text-muted-foreground">{detail.secondary ?? item.category.replaceAll('_', ' ')}</div></td><td className="px-4 py-3"><div>Versi {item.version}</div>{item.version_count > 1 && <button type="button" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary underline underline-offset-4" onClick={() => openHistory(item)}><GitBranch className="size-3.5" />{item.version_count} versi</button>}</td><td className="px-4 py-3"><SimStatusBadge label={item.status === 'active' ? 'Aktif' : 'Diarsipkan'} tone={item.status === 'active' ? 'success' : 'neutral'} /></td><td className="px-4 py-3"><div>{item.uploaded_by}</div><div className="text-xs text-muted-foreground">{item.created_at}</div></td><td className="px-4 py-3"><div className="flex gap-2"><Button asChild type="button" variant="outline" size="icon" className="size-9" aria-label="Buka preview" title="Buka preview"><a href={`/document-archives/${item.id}/preview`} target="_blank" rel="noreferrer"><Eye className="size-4" /></a></Button><Button type="button" variant="outline" size="icon" className="size-9" aria-label="Lihat versi" title="Lihat versi" onClick={() => openHistory(item)}><GitBranch className="size-4" /></Button><Button asChild type="button" variant="outline" size="icon" className="size-9" aria-label="Download dokumen" title="Download dokumen"><a href={`/document-archives/${item.id}/download`}><Download className="size-4" /></a></Button></div></td></tr>; }) : <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Belum ada arsip dokumen.</td></tr>}</tbody></table></SimTable></div>
                <div className="space-y-3 md:hidden">{versions.data.length ? versions.data.map((item) => { const detail = archiveDetail(item); return <article key={item.id} className="space-y-3 border border-border bg-card p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate font-medium">{item.title}</div><div className="truncate text-sm text-muted-foreground">{item.file_name}</div><div className="mt-1 text-sm text-muted-foreground">{item.entity_name ?? '-'}</div></div><SimStatusBadge label={item.status === 'active' ? 'Aktif' : 'Diarsipkan'} tone={item.status === 'active' ? 'success' : 'neutral'} /></div><div className="grid grid-cols-2 gap-3 text-sm"><div><div className="text-xs text-muted-foreground">Detail</div><div className="mt-1">{detail.primary}</div></div><div><div className="text-xs text-muted-foreground">Versi terakhir</div><div className="mt-1">Versi {item.version}</div></div></div><div className="flex gap-2 border-t border-border pt-3"><Button asChild type="button" variant="outline" className="flex-1"><a href={`/document-archives/${item.id}/preview`} target="_blank" rel="noreferrer"><Eye className="size-4" />Preview</a></Button><Button type="button" variant="outline" className="flex-1" onClick={() => openHistory(item)}><GitBranch className="size-4" />Versi ({item.version_count})</Button></div></article>; }) : <div className="border border-dashed p-6 text-center text-muted-foreground">Belum ada arsip dokumen.</div>}</div>
                <Dialog open={Boolean(historyItem)} onOpenChange={(open) => !open && setHistoryItem(null)}><DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Riwayat versi dokumen</DialogTitle><DialogDescription>{historyItem?.title} · {historyItem?.entity_name}</DialogDescription></DialogHeader>{historyLoading ? <div className="py-8 text-center text-sm text-muted-foreground">Memuat riwayat versi...</div> : <div className="relative space-y-4 pl-6 before:absolute before:inset-y-2 before:left-2 before:w-px before:bg-border">{historyVersions.map((version) => <div key={version.id} className="relative rounded-lg border border-border bg-card p-4"><span className={`absolute -left-[1.65rem] top-5 size-3 rounded-full border-2 border-background ${version.status === 'active' ? 'bg-primary' : 'bg-muted-foreground'}`} /><div className="flex items-start justify-between gap-3"><div><div className="font-medium">Versi {version.version}</div><div className="mt-1 text-sm text-muted-foreground">{version.file_name}</div></div><SimStatusBadge label={version.status === 'active' ? 'Aktif' : 'Diarsipkan'} tone={version.status === 'active' ? 'success' : 'neutral'} /></div><div className="mt-3 text-xs text-muted-foreground">Diunggah oleh {version.uploaded_by} · {version.created_at}</div><div className="mt-3 flex gap-2"><Button asChild type="button" variant="outline" size="sm"><a href={version.preview_url} target="_blank" rel="noreferrer"><Eye className="size-4" />Preview</a></Button><Button asChild type="button" variant="outline" size="sm"><a href={version.download_url}><Download className="size-4" />Download</a></Button></div></div>)}</div>}</DialogContent></Dialog>
                <SimPagination links={versions.links} />
            </div>
        </>
    );
}

DocumentArchives.layout = { breadcrumbs: [{ title: 'Arsip Dokumen', href: '/document-archives' }] };
