import { Head, useForm } from '@inertiajs/react';
import { Activity, AlertTriangle, Check, Clock3, KeyRound, Save, Settings2 } from 'lucide-react';
import InputError from '@/components/input-error';
import { SimPageHeader } from '@/components/sim-page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Settings = {
    early_warning_enabled: boolean;
    notification_poll_interval: number;
    sound_priority: 'important' | 'critical';
    quiet_hours_enabled: boolean;
    quiet_start: string;
    quiet_end: string;
};

type EmergencyEvent = {
    id: number;
    action: string;
    description: string;
    reason?: string | null;
    ipAddress?: string | null;
    createdAt?: string | null;
};

type EmergencyAccess = {
    status: 'not_configured' | 'not_provisioned' | 'misconfigured' | 'inactive' | 'ready';
    loginIdentifier?: string | null;
    alertConfigured: boolean;
    canRotatePassword: boolean;
    passwordRotatedAt?: string | null;
    events: EmergencyEvent[];
};

const statusLabels: Record<EmergencyAccess['status'], string> = {
    not_configured: 'Belum dikonfigurasi',
    not_provisioned: 'Belum dibuat',
    misconfigured: 'Perlu diperbaiki',
    inactive: 'Nonaktif',
    ready: 'Siap digunakan',
};

const eventLabels: Record<string, string> = {
    emergency_login: 'Login darurat berhasil',
    emergency_login_failed: 'Percobaan login gagal',
    emergency_passkey_login_blocked: 'Login passkey ditolak',
    emergency_password_rotated: 'Kata sandi dirotasi',
    emergency_account_provisioned: 'Akun darurat dibuat',
};

export default function SystemSettings({ settings, emergencyAccess }: { settings: Settings; emergencyAccess: EmergencyAccess }) {
    const { data, setData, put, processing } = useForm(settings);
    const rotation = useForm({ current_password: '', password: '', password_confirmation: '' });

    return (
        <>
            <Head title="Pengaturan Sistem" />
            <div className="sim-workspace space-y-6">
                <SimPageHeader title="Pengaturan Sistem" description="Kelola perilaku notifikasi operasional dan akses pemulihan sistem." />

                <section className="max-w-3xl rounded-lg border bg-card p-5">
                    <div className="flex items-start gap-3">
                        <Settings2 className="mt-0.5 size-5 text-muted-foreground" aria-hidden="true" />
                        <div>
                            <h2 className="font-semibold">Early warning operasional</h2>
                            <p className="mt-1 text-sm text-muted-foreground">Pengaturan ini berlaku untuk notifikasi aktivitas akun internal.</p>
                        </div>
                    </div>

                    <form onSubmit={(event) => { event.preventDefault(); put('/system-settings'); }} className="mt-5 space-y-5">
                        <label className="flex items-start justify-between gap-4">
                            <span>
                                <span className="block font-medium">Aktifkan early warning</span>
                                <span className="text-sm text-muted-foreground">Sistem memeriksa aktivitas baru secara berkala.</span>
                            </span>
                            <input type="checkbox" checked={data.early_warning_enabled} onChange={(event) => setData('early_warning_enabled', event.target.checked)} className="mt-1 size-5 accent-primary" />
                        </label>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="space-y-2 text-sm font-medium">
                                Interval pemeriksaan
                                <select value={data.notification_poll_interval} onChange={(event) => setData('notification_poll_interval', Number(event.target.value))} className="flex h-10 w-full rounded-md border bg-background px-3 font-normal">
                                    <option value="10">Setiap 10 detik</option><option value="15">Setiap 15 detik</option><option value="30">Setiap 30 detik</option><option value="60">Setiap 60 detik</option>
                                </select>
                            </label>
                            <label className="space-y-2 text-sm font-medium">
                                Bunyi mulai pada
                                <select value={data.sound_priority} onChange={(event) => setData('sound_priority', event.target.value as Settings['sound_priority'])} className="flex h-10 w-full rounded-md border bg-background px-3 font-normal">
                                    <option value="important">Perlu perhatian</option><option value="critical">Kritis saja</option>
                                </select>
                            </label>
                        </div>

                        <label className="flex items-center gap-3">
                            <input type="checkbox" checked={data.quiet_hours_enabled} onChange={(event) => setData('quiet_hours_enabled', event.target.checked)} className="size-5 accent-primary" />
                            <span className="text-sm font-medium">Aktifkan jam tenang</span>
                        </label>

                        {data.quiet_hours_enabled && (
                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="space-y-2 text-sm font-medium">Mulai<input type="time" value={data.quiet_start} onChange={(event) => setData('quiet_start', event.target.value)} className="flex h-10 w-full rounded-md border bg-background px-3 font-normal" /></label>
                                <label className="space-y-2 text-sm font-medium">Selesai<input type="time" value={data.quiet_end} onChange={(event) => setData('quiet_end', event.target.value)} className="flex h-10 w-full rounded-md border bg-background px-3 font-normal" /></label>
                            </div>
                        )}

                        <Button type="submit" disabled={processing}><Save aria-hidden="true" /> Simpan pengaturan</Button>
                    </form>
                </section>

                <section className="max-w-3xl overflow-hidden rounded-lg border bg-card">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
                        <div className="flex items-start gap-3">
                            <KeyRound className="mt-0.5 size-5 text-muted-foreground" aria-hidden="true" />
                            <div>
                                <h2 className="font-semibold">Akses darurat IT</h2>
                                <p className="mt-1 text-sm text-muted-foreground">Akun lokal khusus untuk memulihkan akses saat SSO tidak tersedia.</p>
                            </div>
                        </div>
                        <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium">
                            {emergencyAccess.status === 'ready' ? <Check className="size-3.5" aria-hidden="true" /> : <AlertTriangle className="size-3.5" aria-hidden="true" />}
                            {statusLabels[emergencyAccess.status]}
                        </span>
                    </div>

                    <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
                        <Info label="ID login" value={emergencyAccess.loginIdentifier || 'Belum ditetapkan'} />
                        <Info label="Notifikasi IT" value={emergencyAccess.alertConfigured ? 'Email penerima sudah dikonfigurasi' : 'Email penerima belum dikonfigurasi'} />
                        <Info label="Rotasi kata sandi terakhir" value={emergencyAccess.passwordRotatedAt || 'Belum tercatat'} />
                        <Info label="Pemulihan akun" value="Dikelola IT melalui perintah deployment. Tidak dapat dihapus dari Manajemen Pengguna." />
                    </div>

                    {emergencyAccess.status !== 'ready' && (
                        <div className="mx-5 mb-4 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                            <p className="font-medium">Akun darurat belum siap.</p>
                            <p className="mt-1 text-muted-foreground">Pastikan SSO_EMERGENCY_LOGIN sudah ditetapkan, lalu jalankan <code className="rounded bg-muted px-1 py-0.5">php artisan simontok:emergency-account</code> oleh petugas IT.</p>
                        </div>
                    )}

                    {emergencyAccess.canRotatePassword && (
                        <form onSubmit={(event) => { event.preventDefault(); rotation.put('/system-settings/emergency-password', { onSuccess: () => rotation.reset() }); }} className="border-t px-5 py-4">
                            <h3 className="font-medium">Rotasi kata sandi</h3>
                            <p className="mt-1 text-sm text-muted-foreground">Gunakan kata sandi yang hanya diketahui admin IT. Kata sandi tidak akan ditampilkan lagi.</p>
                            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2 sm:col-span-2"><Label htmlFor="current_password">Kata sandi saat ini</Label><Input id="current_password" type="password" autoComplete="current-password" value={rotation.data.current_password} onChange={(event) => rotation.setData('current_password', event.target.value)} required /><InputError message={rotation.errors.current_password} /></div>
                                <div className="space-y-2"><Label htmlFor="new_password">Kata sandi baru</Label><Input id="new_password" type="password" autoComplete="new-password" value={rotation.data.password} onChange={(event) => rotation.setData('password', event.target.value)} required /><InputError message={rotation.errors.password} /></div>
                                <div className="space-y-2"><Label htmlFor="password_confirmation">Konfirmasi kata sandi baru</Label><Input id="password_confirmation" type="password" autoComplete="new-password" value={rotation.data.password_confirmation} onChange={(event) => rotation.setData('password_confirmation', event.target.value)} required /></div>
                            </div>
                            <Button type="submit" className="mt-4" disabled={rotation.processing}><KeyRound aria-hidden="true" /> Rotasi kata sandi</Button>
                        </form>
                    )}

                    <div className="border-t px-5 py-4">
                        <div className="mb-3 flex items-center gap-2 font-medium"><Activity className="size-4 text-muted-foreground" aria-hidden="true" /> Riwayat akses</div>
                        {emergencyAccess.events.length ? (
                            <ul className="divide-y">
                                {emergencyAccess.events.map((event) => (
                                    <li key={event.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[1fr_auto]">
                                        <div>
                                            <p className="font-medium">{eventLabels[event.action] || event.description}</p>
                                            {event.reason && <p className="mt-1 text-muted-foreground">Alasan: {event.reason}</p>}
                                            {event.ipAddress && <p className="mt-1 text-xs text-muted-foreground">IP {event.ipAddress}</p>}
                                        </div>
                                        <span className="inline-flex items-start gap-1.5 text-xs text-muted-foreground"><Clock3 className="size-3.5" aria-hidden="true" />{event.createdAt || 'Waktu tidak tersedia'}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">Belum ada aktivitas akses darurat.</p>
                        )}
                    </div>
                </section>
            </div>
        </>
    );
}

function Info({ label, value }: { label: string; value: string }) {
    return <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-medium">{value}</p></div>;
}

SystemSettings.layout = { breadcrumbs: [{ title: 'Pengaturan Sistem', href: '/system-settings' }] };
