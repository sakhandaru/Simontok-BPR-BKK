import { Head, router } from '@inertiajs/react';
import { AlertTriangle, Building2, Clock3, ListChecks } from 'lucide-react';
import { useState } from 'react';
import { SimKpiCard } from '@/components/sim-kpi-card';
import { SimPageHeader } from '@/components/sim-page-header';
import { SimSelect } from '@/components/sim-select';
import { SimTable, SimTableHead, SimTableSortHeader, useSimTableSort } from '@/components/sim-table';
import { SimTableToolbar } from '@/components/sim-table-toolbar';
import { SimStatusBadge } from '@/components/sim-status-badge';

type Branch = { id: number; code: string; name: string; total_orders: number; active_orders: number; risk_orders: number; overdue_sla: number; completed_orders: number; completion_percentage: number };

export default function BranchMonitoring({ summary, branches, filters }: { summary: { branches: number; active_orders: number; risk_orders: number; overdue_sla: number }; branches: Branch[]; filters: { search: string; focus: string } }) {
    const [search, setSearch] = useState(filters.search);
    const [focus, setFocus] = useState(filters.focus);
    const { sortedRows, sort, toggleSort } = useSimTableSort(branches, 'name');

    return <><Head title="Monitoring Cabang" /><div className="sim-workspace"><SimPageHeader title="Monitoring Cabang" description="Pantau beban kerja, risiko, dan keterlambatan seluruh cabang secara ringkas." />
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4"><SimKpiCard label="Cabang aktif" value={summary.branches} note="Cabang dalam pemantauan" icon={Building2} /><SimKpiCard label="Order aktif" value={summary.active_orders} note="Belum masuk status terminal" icon={ListChecks} /><SimKpiCard label="Berisiko" value={summary.risk_orders} note="Order dengan penanda risiko" icon={AlertTriangle} /><SimKpiCard label="Lewat SLA" value={summary.overdue_sla} note="Perlu ditindaklanjuti" icon={Clock3} /></section>
        <SimTableToolbar search={search} searchPlaceholder="Kode atau nama cabang" onSearchChange={setSearch} onSubmit={() => router.get('/branch-monitoring', { search, focus }, { preserveState: true, replace: true })} onReset={() => { setSearch(''); setFocus(''); router.get('/branch-monitoring'); }}>
            <SimSelect value={focus} onChange={setFocus} placeholder="Semua cabang" options={[{ value: 'risk', label: 'Ada risiko' }, { value: 'overdue', label: 'Lewat SLA' }]} />
        </SimTableToolbar>
        <SimTable minWidth="860px">
            <SimTableHead>
                <tr>
                    <SimTableSortHeader active={sort.key === 'name'} direction={sort.direction} onClick={() => toggleSort('name')}>Cabang</SimTableSortHeader>
                    <SimTableSortHeader active={sort.key === 'total_orders'} direction={sort.direction} onClick={() => toggleSort('total_orders')}>Total order</SimTableSortHeader>
                    <SimTableSortHeader active={sort.key === 'active_orders'} direction={sort.direction} onClick={() => toggleSort('active_orders')}>Aktif</SimTableSortHeader>
                    <SimTableSortHeader active={sort.key === 'risk_orders'} direction={sort.direction} onClick={() => toggleSort('risk_orders')}>Berisiko</SimTableSortHeader>
                    <SimTableSortHeader active={sort.key === 'overdue_sla'} direction={sort.direction} onClick={() => toggleSort('overdue_sla')}>Lewat SLA</SimTableSortHeader>
                    <SimTableSortHeader active={sort.key === 'completed_orders'} direction={sort.direction} onClick={() => toggleSort('completed_orders')}>Selesai</SimTableSortHeader>
                    <SimTableSortHeader active={sort.key === 'completion_percentage'} direction={sort.direction} onClick={() => toggleSort('completion_percentage')}>Persentase selesai</SimTableSortHeader>
                </tr>
            </SimTableHead>
            <tbody>
                {sortedRows.map((branch) => (
                    <tr key={branch.id} className="border-t transition-colors hover:bg-muted/25">
                        <td className="px-4 py-3">
                            <div className="font-medium">{branch.name}</div>
                            <div className="text-xs text-muted-foreground">{branch.code}</div>
                        </td>
                        <td className="px-4 py-3 font-medium text-sky-700 dark:text-sky-300">{branch.total_orders}</td>
                        <td className="px-4 py-3 font-medium text-emerald-700 dark:text-emerald-300">{branch.active_orders}</td>
                        <td className="px-4 py-3">
                            <SimStatusBadge
                                label={String(branch.risk_orders)}
                                tone={branch.risk_orders > 0 ? 'danger' : 'neutral'}
                            />
                        </td>
                        <td className="px-4 py-3">
                            <SimStatusBadge
                                label={String(branch.overdue_sla)}
                                tone={branch.overdue_sla > 0 ? 'warning' : 'neutral'}
                            />
                        </td>
                        <td className="px-4 py-3 font-medium text-violet-700 dark:text-violet-300">{branch.completed_orders}</td>
                        <td className="px-4 py-3 font-medium text-violet-700 dark:text-violet-300">{branch.completion_percentage}%</td>
                    </tr>
                ))}
            </tbody>
        </SimTable>
    </div></>;
}

BranchMonitoring.layout = { breadcrumbs: [{ title: 'Monitoring Cabang', href: '/branch-monitoring' }] };
