import { Head } from '@inertiajs/react';
import { AlertTriangle, Building2, Clock3, ListChecks } from 'lucide-react';
import { SimKpiCard } from '@/components/sim-kpi-card';
import { SimPageHeader } from '@/components/sim-page-header';

type Branch = { id: number; code: string; name: string; total_orders: number; active_orders: number; risk_orders: number; overdue_sla: number; completed_orders: number };

export default function BranchMonitoring({ summary, branches }: { summary: { branches: number; active_orders: number; risk_orders: number; overdue_sla: number }; branches: Branch[] }) {
    return <><Head title="Monitoring Cabang" /><div className="sim-workspace"><SimPageHeader title="Monitoring Cabang" description="Pantau beban kerja, risiko, dan keterlambatan seluruh cabang secara ringkas." />
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4"><SimKpiCard label="Cabang aktif" value={summary.branches} note="Cabang dalam pemantauan" icon={Building2} /><SimKpiCard label="Order aktif" value={summary.active_orders} note="Belum masuk status terminal" icon={ListChecks} /><SimKpiCard label="Berisiko" value={summary.risk_orders} note="Order dengan penanda risiko" icon={AlertTriangle} /><SimKpiCard label="Lewat SLA" value={summary.overdue_sla} note="Perlu ditindaklanjuti" icon={Clock3} /></section>
        <section className="overflow-x-auto rounded-xl border bg-card"><table className="w-full min-w-[760px] text-sm"><thead className="bg-muted/40 text-left text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Cabang</th><th className="px-4 py-3 font-medium">Total order</th><th className="px-4 py-3 font-medium">Aktif</th><th className="px-4 py-3 font-medium">Berisiko</th><th className="px-4 py-3 font-medium">Lewat SLA</th><th className="px-4 py-3 font-medium">Selesai</th></tr></thead><tbody className="divide-y">{branches.map((branch) => <tr key={branch.id}><td className="px-4 py-4"><div className="font-medium">{branch.name}</div><div className="text-xs text-muted-foreground">{branch.code}</div></td><td className="px-4 py-4">{branch.total_orders}</td><td className="px-4 py-4 font-medium">{branch.active_orders}</td><td className="px-4 py-4">{branch.risk_orders}</td><td className="px-4 py-4">{branch.overdue_sla}</td><td className="px-4 py-4">{branch.completed_orders}</td></tr>)}</tbody></table></section>
    </div></>;
}

BranchMonitoring.layout = { breadcrumbs: [{ title: 'Monitoring Cabang', href: '/branch-monitoring' }] };
