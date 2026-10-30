import { Head, useForm } from '@inertiajs/react';
import { ExternalLink, Megaphone, Paperclip, Send, Save } from 'lucide-react';
import { FormEvent } from 'react';
import InputError from '@/components/input-error';
import { SimPageHeader } from '@/components/sim-page-header';
import { SimPagination, type SimPaginationLink } from '@/components/sim-pagination';
import { SimStatusBadge } from '@/components/sim-status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Paginated } from '@/types';

type Announcement = {
    id: number;
    title: string;
    body: string;
    link_url?: string | null;
    image_url?: string | null;
    status: 'draft' | 'published' | 'archived';
    priority: 'normal' | 'important';
    published_at?: string | null;
    expires_at?: string | null;
    created_by: string;
    created_at: string;
};

export default function Announcements({ announcements }: { announcements: Paginated<Announcement> & { links: SimPaginationLink[] } }) {
    const { data, setData, post, transform, processing, errors, reset } = useForm<{
        title: string;
        body: string;
        link_url: string;
        priority: 'normal' | 'important';
        expires_at: string;
        image: File | null;
        publish: boolean;
    }>({ title: '', body: '', link_url: '', priority: 'normal', expires_at: '', image: null, publish: true });

    const submit = (event: FormEvent, publish: boolean) => {
        event.preventDefault();
        transform((formData) => ({ ...formData, publish }));
        post('/announcements', { forceFormData: true, onSuccess: () => reset() });
    };

    return (
        <>
            <Head title="Siaran Operasional" />
            <div className="sim-workspace space-y-6">
                <SimPageHeader title="Siaran Operasional" description="Sampaikan informasi resmi kepada seluruh akun yang aktif di SIMONTOK." />
                <section className="sim-panel grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]">
                    <form onSubmit={(event) => submit(event, true)} className="grid gap-4">
                        <div className="flex items-start gap-3 border-b border-border pb-4">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted"><Megaphone className="size-4" /></div>
                            <div><h2 className="font-medium">Buat siaran baru</h2><p className="text-sm text-muted-foreground">Siaran terbit akan muncul sebagai alert saat penerima login.</p></div>
                        </div>
                        <Field label="Judul siaran" error={errors.title}><Input value={data.title} onChange={(event) => setData('title', event.target.value)} placeholder="Contoh: Perubahan batas waktu pengajuan" /></Field>
                        <Field label="Isi pengumuman" error={errors.body}><textarea className="flex min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" value={data.body} onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setData('body', event.target.value)} placeholder="Tulis informasi yang perlu diketahui penerima..." rows={6} /></Field>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Tautan (opsional)" error={errors.link_url}><Input type="url" value={data.link_url} onChange={(event) => setData('link_url', event.target.value)} placeholder="https://..." /></Field>
                            <Field label="Berakhir pada (opsional)" error={errors.expires_at}><Input type="datetime-local" value={data.expires_at} onChange={(event) => setData('expires_at', event.target.value)} /></Field>
                        </div>
                        <div className="grid gap-2"><Label htmlFor="announcement-image">Gambar (opsional)</Label><Input id="announcement-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setData('image', event.target.files?.[0] ?? null)} /><p className="text-xs text-muted-foreground">JPG, PNG, atau WebP maksimal 5 MB.</p><InputError message={errors.image} /></div>
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={data.priority === 'important'} onChange={(event) => setData('priority', event.target.checked ? 'important' : 'normal')} />Tandai sebagai penting</label><div className="flex gap-2"><Button type="button" variant="outline" onClick={(event) => submit(event as unknown as FormEvent, false)} disabled={processing}><Save className="size-4" />Simpan draft</Button><Button type="submit" disabled={processing}><Send className="size-4" />Terbitkan siaran</Button></div></div>
                    </form>
                    <aside className="border-l-0 border-border lg:border-l lg:pl-5"><div className="text-sm font-medium">Ketentuan penerima</div><p className="mt-2 text-sm leading-6 text-muted-foreground">Siaran diberikan kepada semua akun internal pusat dan cabang. Akun notaris serta auditor/OJK tidak menerima siaran ini. Setiap akun hanya melihat modal sampai menekan “Saya sudah membaca”.</p><div className="mt-5 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">Gunakan siaran untuk informasi resmi operasional. Perubahan data order tetap dilakukan dari modul order agar riwayat bisnisnya tercatat pada konteks yang tepat.</div></aside>
                </section>
                <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="font-medium">Riwayat siaran</h2><span className="text-sm text-muted-foreground">{announcements.data.length} ditampilkan</span></div><div className="divide-y divide-border border-y border-border">{announcements.data.length ? announcements.data.map((announcement) => <article key={announcement.id} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_180px_auto] md:items-start"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{announcement.title}</h3><SimStatusBadge label={announcement.status === 'published' ? 'Terbit' : announcement.status === 'draft' ? 'Draft' : 'Diarsipkan'} tone={announcement.status === 'published' ? 'success' : 'neutral'} />{announcement.priority === 'important' && <SimStatusBadge label="Penting" tone="warning" />}</div><p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">{announcement.body}</p>{announcement.link_url && <a href={announcement.link_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary underline underline-offset-4">Buka tautan <ExternalLink className="size-3" /></a>}</div><div className="text-sm text-muted-foreground"><div>Dibuat oleh {announcement.created_by}</div><div className="mt-1">{announcement.created_at}</div>{announcement.expires_at && <div className="mt-1">Berakhir {announcement.expires_at}</div>}</div><div className="flex items-center gap-2 text-xs text-muted-foreground">{announcement.image_url && <><Paperclip className="size-3.5" />Ada gambar</>}</div></article>) : <div className="py-10 text-center text-sm text-muted-foreground">Belum ada siaran operasional.</div>}</div><SimPagination links={announcements.links} /></section>
            </div>
        </>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <div className="grid gap-2"><Label>{label}</Label>{children}<InputError message={error} /></div>; }

Announcements.layout = { breadcrumbs: [{ title: 'Siaran Operasional', href: '/announcements' }] };
