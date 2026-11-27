<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\JobPosition;
use App\Models\Notary;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $permissions = collect([
            ['code' => 'dashboard.view', 'name' => 'Lihat dashboard', 'module' => 'dashboard'],
            ['code' => 'orders.view', 'name' => 'Lihat order', 'module' => 'orders'],
            ['code' => 'orders.create', 'name' => 'Buat order', 'module' => 'orders'],
            ['code' => 'orders.manage', 'name' => 'Kelola proses order', 'module' => 'orders'],
            ['code' => 'orders.approve', 'name' => 'Setujui order', 'module' => 'orders'],
            ['code' => 'tracking.view', 'name' => 'Lihat pelacakan order', 'module' => 'tracking'],
            ['code' => 'reports.view', 'name' => 'Lihat laporan', 'module' => 'reports'],
            ['code' => 'orders.cancel', 'name' => 'Batalkan order', 'module' => 'orders'],
            ['code' => 'documents.validate', 'name' => 'Validasi dokumen final', 'module' => 'documents'],
            ['code' => 'handovers.manage', 'name' => 'Catat handover dokumen', 'module' => 'documents'],
            ['code' => 'covernotes.manage', 'name' => 'Kelola covernote', 'module' => 'documents'],
            ['code' => 'covernotes.approve', 'name' => 'Setujui covernote', 'module' => 'documents'],
            ['code' => 'payments.verify', 'name' => 'Verifikasi invoice', 'module' => 'payments'],
            ['code' => 'payments.approve', 'name' => 'Setujui pembayaran', 'module' => 'payments'],
            ['code' => 'payments.pay', 'name' => 'Catat pembayaran', 'module' => 'payments'],
            ['code' => 'masters.manage', 'name' => 'Kelola master data', 'module' => 'masters'],
            ['code' => 'branches.view', 'name' => 'Lihat kantor cabang', 'module' => 'masters'],
            ['code' => 'branches.manage', 'name' => 'Kelola kantor cabang', 'module' => 'masters'],
            ['code' => 'notaries.view', 'name' => 'Lihat notaris rekanan', 'module' => 'masters'],
            ['code' => 'notaries.manage', 'name' => 'Kelola notaris rekanan', 'module' => 'masters'],
            ['code' => 'job_types.view', 'name' => 'Lihat jenis pekerjaan', 'module' => 'masters'],
            ['code' => 'job_types.manage', 'name' => 'Kelola jenis pekerjaan', 'module' => 'masters'],
            ['code' => 'documents.view', 'name' => 'Lihat dokumen', 'module' => 'documents'],
            ['code' => 'documents.archive.view', 'name' => 'Lihat arsip dokumen', 'module' => 'documents'],
            ['code' => 'users.manage', 'name' => 'Kelola pengguna', 'module' => 'administration'],
            ['code' => 'roles.manage', 'name' => 'Kelola role', 'module' => 'administration'],
            ['code' => 'notary.portal', 'name' => 'Akses portal notaris', 'module' => 'notary'],
            ['code' => 'notary.actions', 'name' => 'Jalankan aksi portal notaris', 'module' => 'notary'],
            ['code' => 'audit.view', 'name' => 'Lihat audit log', 'module' => 'audit'],
            ['code' => 'announcements.manage', 'name' => 'Kelola siaran operasional', 'module' => 'announcements'],
            ['code' => 'branches.monitor', 'name' => 'Monitoring cabang', 'module' => 'reports'],
            ['code' => 'system.settings', 'name' => 'Pengaturan sistem', 'module' => 'administration'],
        ])->mapWithKeys(fn (array $permission) => [
            $permission['code'] => Permission::updateOrCreate(
                ['code' => $permission['code']],
                $permission
            ),
        ]);

        User::where('email', 'keuangan')->delete();
        User::where('email', 'manajemen')->delete();
        User::whereHas('jobPosition', fn ($query) => $query->whereIn('code', ['KEUANGAN', 'MANAJEMEN']))->delete();
        JobPosition::where('code', 'KEUANGAN')->delete();
        JobPosition::where('code', 'MANAJEMEN')->delete();
        Role::whereIn('code', ['keuangan', 'manajemen'])->delete();

        $roles = collect([
            ['code' => 'direksi_pusat', 'name' => 'Direksi Pusat', 'permissions' => ['dashboard.view', 'orders.view', 'documents.view', 'tracking.view', 'reports.view', 'branches.monitor', 'documents.archive.view', 'announcements.manage']],
            ['code' => 'kadiv_ops_pusat', 'name' => 'Kadiv Operasional Pusat', 'permissions' => ['dashboard.view', 'orders.view', 'orders.approve', 'documents.view', 'documents.validate', 'covernotes.approve', 'payments.approve', 'tracking.view', 'reports.view', 'branches.monitor', 'documents.archive.view', 'announcements.manage']],
            ['code' => 'admin_legal_pusat', 'name' => 'Admin Legal Pusat', 'permissions' => ['dashboard.view', 'orders.view', 'orders.create', 'orders.manage', 'orders.cancel', 'documents.view', 'documents.validate', 'handovers.manage', 'covernotes.manage', 'covernotes.approve', 'payments.verify', 'payments.approve', 'payments.pay', 'tracking.view', 'reports.view', 'branches.view', 'branches.manage', 'branches.monitor', 'notaries.view', 'notaries.manage', 'job_types.view', 'job_types.manage', 'documents.archive.view', 'announcements.manage', 'notary.portal', 'audit.view', 'users.manage']],
            ['code' => 'pimpinan_cabang', 'name' => 'Pimpinan Cabang', 'permissions' => ['dashboard.view', 'orders.view', 'documents.view', 'tracking.view', 'reports.view']],
            ['code' => 'kabid_ops_cabang', 'name' => 'Kabid Operasional Cabang', 'permissions' => ['dashboard.view', 'orders.view', 'orders.approve', 'documents.view', 'documents.validate', 'covernotes.approve', 'payments.approve', 'tracking.view', 'reports.view']],
            ['code' => 'admin_legal_cabang', 'name' => 'Admin Legal Cabang', 'permissions' => ['dashboard.view', 'orders.view', 'orders.create', 'orders.manage', 'orders.cancel', 'documents.view', 'documents.validate', 'handovers.manage', 'covernotes.manage', 'covernotes.approve', 'payments.verify', 'payments.pay', 'tracking.view', 'reports.view', 'documents.archive.view', 'users.manage']],
            ['code' => 'notaris', 'name' => 'Notaris', 'permissions' => ['dashboard.view', 'tracking.view', 'notary.portal', 'notary.actions']],
            ['code' => 'it_admin', 'name' => 'IT Administrator', 'permissions' => []],
            ['code' => 'auditor', 'name' => 'Auditor / OJK', 'permissions' => ['dashboard.view', 'orders.view', 'documents.view', 'tracking.view', 'reports.view', 'branches.monitor', 'audit.view', 'documents.archive.view']],
        ])->mapWithKeys(function (array $role) use ($permissions) {
            $model = Role::updateOrCreate(
                ['code' => $role['code']],
                ['name' => $role['name'], 'description' => null]
            );
            $rolePermissions = $role['code'] === 'it_admin'
                ? $permissions->pluck('id')
                : $permissions->only($role['permissions'])->pluck('id');
            $model->permissions()->sync($rolePermissions);

            return [$role['code'] => $model];
        });

        $branch = Branch::updateOrCreate(
            ['code' => '001'],
            ['name' => 'KC. Kantor Pusat Operasional', 'is_active' => true]
        );

        $notary = Notary::updateOrCreate(
            ['email' => 'notaris.demo@example.com'],
            [
                'name' => 'Kantor Notaris Demo',
                'address' => 'Semarang',
                'phone' => '024-000000',
                'is_active' => true,
            ]
        );
        $branch->notaries()->syncWithoutDetaching([$notary->id => ['is_active' => true]]);

        $this->call(NotaryWorkMasterSeeder::class);

        JobPosition::updateOrCreate(
            ['code' => 'DIREKSI_PUSAT'],
            ['name' => 'Direksi Pusat', 'role_id' => $roles['direksi_pusat']->id]
        );

        JobPosition::updateOrCreate(
            ['code' => 'KADIV_OPS_PUSAT'],
            ['name' => 'Kadiv Operasional Pusat', 'role_id' => $roles['kadiv_ops_pusat']->id]
        );

        JobPosition::updateOrCreate(
            ['code' => 'LEGAL_ADMIN_PUSAT'],
            ['name' => 'Admin Legal Pusat', 'role_id' => $roles['admin_legal_pusat']->id]
        );

        JobPosition::updateOrCreate(
            ['code' => 'LEGAL_ADMIN_CABANG'],
            ['name' => 'Admin Legal Cabang', 'role_id' => $roles['admin_legal_cabang']->id]
        );

        JobPosition::updateOrCreate(
            ['code' => 'PIMPINAN_CABANG'],
            ['name' => 'Pimpinan Cabang', 'role_id' => $roles['pimpinan_cabang']->id]
        );

        JobPosition::updateOrCreate(
            ['code' => 'KABID_OPS_CABANG'],
            ['name' => 'Kabid Operasional Cabang', 'role_id' => $roles['kabid_ops_cabang']->id]
        );

        JobPosition::updateOrCreate(
            ['code' => 'IT_ADMIN'],
            ['name' => 'IT Administrator', 'role_id' => $roles['it_admin']->id]
        );

        JobPosition::updateOrCreate(
            ['code' => 'AUDITOR'],
            ['name' => 'SKAI/Auditor', 'role_id' => $roles['auditor']->id]
        );

        JobPosition::updateOrCreate(
            ['code' => 'NOTARIS'],
            ['name' => 'Notaris', 'role_id' => $roles['notaris']->id]
        );

        if (! config('uat.emergency_only')) {
            $this->call(UserSeeder::class);
        }
        if ((app()->environment(['local', 'testing', 'staging']) || config('uat.enabled')) && config('core.provider') === 'dummy') {
            $this->call(UatPartnerSeeder::class);
        }
        $this->call(EmergencyAccountSeeder::class);
        $this->call(CoreAccountSeeder::class);

        // Data demo hanya dibuat jika diaktifkan secara eksplisit. Ini aman untuk
        // staging dengan APP_ENV=production tanpa mengisi demo secara tidak sengaja.
        if (filter_var(env('SEED_DEMO_DATA', false), FILTER_VALIDATE_BOOLEAN)) {
            $this->call(DemoFullDataSeeder::class);
        }
    }
}
