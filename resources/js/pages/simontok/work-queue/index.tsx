import { Head, Link } from '@inertiajs/react';
import { AlertTriangle, ArrowRight, ClipboardList, ListTodo } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SimKpiCard } from '@/components/sim-kpi-card';
import { SimPageHeader } from '@/components/sim-page-header';

type Task = { id: number; order_no: string; title: string; reason: string; priority: string; branch: string | null; notary: string | null; status: string; created_at: string };

export default function WorkQueue({ summary, tasks }: { summary: { total: number; important: number }; tasks: Task[] }) {
    return <><Head title="Antrian Kerja" /><div className="sim-workspace">
        <SimPageHeader title="Antrian Kerja" description="Daftar pekerjaan yang membutuhkan tindakan sesuai kewenangan Anda." />
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-3"><SimKpiCard label="Total antrian" value={summary.total} note="Pekerjaan yang belum selesai" icon={ListTodo} /><SimKpiCard label="Perlu perhatian" value={summary.important} note="Persetujuan atau verifikasi" icon={AlertTriangle} /></section>
        <section className="overflow-hidden rounded-xl border bg-card"><div className="border-b px-4 py-4"><h2 className="font-semibold">Pekerjaan saya</h2><p className="mt-1 text-sm text-muted-foreground">Urutan diprioritaskan dari pekerjaan yang memerlukan keputusan lebih dulu.</p></div>
            {tasks.length === 0 ? <div className="px-4 py-12 text-center text-sm text-muted-foreground">Tidak ada pekerjaan yang menunggu tindakan.</div> : <div className="divide-y">{tasks.map((task) => <div key={`${task.id}-${task.title}`} className="grid gap-4 px-4 py-4 lg:grid-cols-[1fr_auto] lg:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{task.title}</span>{task.priority === 'important' && <Badge variant="secondary">Perlu perhatian</Badge>}</div><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm"><span className="font-medium">{task.order_no}</span><span className="text-muted-foreground">{task.branch ?? 'Tanpa cabang'} · {task.notary ?? 'Tanpa notaris'}</span></div><p className="mt-1 text-sm text-muted-foreground">{task.reason} Status: {task.status}.</p></div><Button variant="outline" size="sm" asChild><Link href={`/orders/${task.id}`}>Buka order <ArrowRight /></Link></Button></div>)}</div>}
        </section>
    </div></>;
}

WorkQueue.layout = { breadcrumbs: [{ title: 'Antrian Kerja', href: '/work-queue' }] };
