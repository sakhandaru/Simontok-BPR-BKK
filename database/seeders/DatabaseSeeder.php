<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\DocumentChecklist;
use App\Models\JobPosition;
use App\Models\JobType;
use App\Models\Notary;
use App\Models\Permission;
use App\Models\Role;
use App\Models\SlaPolicy;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $seedPassword = env('SEEDER_DEFAULT_PASSWORD', app()->isProduction() ? null : 'password');

        if (app()->isProduction() && blank($seedPassword)) {
            throw new \RuntimeException('SEEDER_DEFAULT_PASSWORD wajib diisi saat menjalankan seeder di production.');
        }

        $seedPassword ??= Str::random(32);
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
            ['code' => 'users.manage', 'name' => 'Kelola pengguna', 'module' => 'administration'],
            ['code' => 'roles.manage', 'name' => 'Kelola role', 'module' => 'administration'],
            ['code' => 'notary.portal', 'name' => 'Akses portal notaris', 'module' => 'notary'],
            ['code' => 'notary.actions', 'name' => 'Jalankan aksi portal notaris', 'module' => 'notary'],
            ['code' => 'audit.view', 'name' => 'Lihat audit log', 'module' => 'audit'],
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
            ['code' => 'legal_admin', 'name' => 'Admin Legal', 'permissions' => ['dashboard.view', 'orders.view', 'orders.create', 'orders.manage', 'orders.cancel', 'documents.validate', 'handovers.manage', 'covernotes.manage', 'covernotes.approve', 'payments.verify', 'payments.pay', 'tracking.view', 'reports.view']],
            ['code' => 'notaris', 'name' => 'Notaris', 'permissions' => ['dashboard.view', 'tracking.view', 'notary.portal', 'notary.actions']],
            ['code' => 'kepala_cabang', 'name' => 'Pimpinan Cabang', 'permissions' => ['dashboard.view', 'orders.view', 'orders.approve', 'orders.cancel', 'covernotes.approve', 'payments.approve', 'tracking.view', 'reports.view']],
            ['code' => 'kadiv_operasional', 'name' => 'Kadiv Operasional Cabang', 'permissions' => ['dashboard.view', 'orders.view', 'orders.approve', 'orders.cancel', 'covernotes.approve', 'payments.approve', 'tracking.view', 'reports.view']],
            ['code' => 'it_admin', 'name' => 'IT Administrator', 'permissions' => []],
            ['code' => 'auditor', 'name' => 'SKAI/Auditor', 'permissions' => ['dashboard.view', 'orders.view', 'tracking.view', 'reports.view', 'audit.view']],
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
            ['name' => 'Kantor Pusat Operasional', 'is_active' => true]
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

        $jobTypes = collect([
            ['code' => 'SKMHT', 'name' => 'SKMHT', 'steps' => ['Order', 'Pengecekan sertifikat', 'Validasi notaris', 'Penandaan lokasi jaminan', 'Penilaian kualitas tanah', 'Hasil cek keluar', 'Pendaftaran BPHTB', 'Penerbitan SKMHT/APHT', 'Selesai']],
            ['code' => 'APHT', 'name' => 'APHT', 'steps' => ['Order', 'Pengecekan sertifikat', 'Validasi notaris', 'Penandaan lokasi jaminan', 'Penilaian kualitas tanah', 'Hasil cek keluar', 'Pendaftaran BPHTB', 'Penerbitan SKMHT/APHT', 'Selesai']],
            ['code' => 'FIDUSIA', 'name' => 'Fidusia', 'steps' => ['Order', 'Pengecekan ulang kelengkapan dokumen', 'Pendaftaran fidusia di Kemenkumham / akta fidusia', 'Selesai']],
            ['code' => 'GADAI', 'name' => 'Gadai', 'steps' => ['Order', 'Pengecekan ulang kelengkapan dokumen', 'Pembuatan akta notaril', 'Selesai']],
            ['code' => 'CESSIE', 'name' => 'Cessie', 'steps' => ['Order', 'Pengecekan ulang kelengkapan dokumen', 'Pembuatan akta notaril', 'Selesai']],
            ['code' => 'KUASA_PAKAI', 'name' => 'Surat Kuasa Pelimpahan Hak Pemakaian', 'steps' => ['Order', 'Pengecekan ulang kelengkapan dokumen', 'Pembuatan akta notaril', 'Selesai']],
            ['code' => 'PK', 'name' => 'Perjanjian Kredit', 'steps' => ['Order', 'Pengecekan ulang kelengkapan dokumen', 'Pembuatan akta notaril', 'Selesai']],
            ['code' => 'LEGALISASI', 'name' => 'Legalisasi', 'steps' => ['Order', 'Pengecekan ulang kelengkapan dokumen', 'Pembuatan akta notaril', 'Selesai']],
            ['code' => 'BALIK_NAMA', 'name' => 'Balik Nama', 'steps' => ['Order', 'Proses notaris', 'Selesai']],
            ['code' => 'PENSERTIFIKATAN', 'name' => 'Pensertifikatan', 'steps' => ['Order', 'Proses notaris', 'Selesai']],
            ['code' => 'PECAH_BIDANG', 'name' => 'Pecah Bidang', 'steps' => ['Order', 'Proses notaris', 'Selesai']],
            ['code' => 'TURUN_WARIS', 'name' => 'Turun Waris', 'steps' => ['Order', 'Proses notaris', 'Selesai']],
            ['code' => 'HIBAH', 'name' => 'Hibah', 'steps' => ['Order', 'Proses notaris', 'Selesai']],
            ['code' => 'PENINGKATAN_HAK', 'name' => 'Peningkatan Hak', 'steps' => ['Order', 'Proses notaris', 'Selesai']],
        ])->mapWithKeys(function (array $item) {
            $jobType = JobType::updateOrCreate(
                ['code' => $item['code']],
                ['name' => $item['name'], 'is_active' => true]
            );

            foreach ($item['steps'] as $index => $step) {
                $jobType->steps()->updateOrCreate(
                    ['sort_order' => $index + 1],
                    ['name' => $step, 'is_active' => true]
                );
            }

            return [$item['code'] => $jobType];
        });

        $defaultSlaDays = [
            'SKMHT' => 30,
            'APHT' => 60,
            'FIDUSIA' => 30,
            'GADAI' => 14,
            'CESSIE' => 14,
            'KUASA_PAKAI' => 14,
            'PK' => 7,
            'LEGALISASI' => 7,
        ];

        foreach ($defaultSlaDays as $code => $days) {
            SlaPolicy::updateOrCreate(
                ['job_type_id' => $jobTypes[$code]->id, 'branch_id' => null],
                ['days' => $days, 'is_active' => true]
            );
        }

        foreach (['KTP debitur', 'KTP pemilik agunan', 'Kartu keluarga', 'Surat nikah', 'Sertifikat/BPKB asli', 'SPPT PBB', 'Bukti lunas PBB', 'NPWP', 'Dokumen persetujuan pasangan', 'Dokumen pendukung lain'] as $name) {
            DocumentChecklist::updateOrCreate(
                ['name' => $name, 'job_type_id' => null],
                ['is_active' => true]
            );
        }

        JobPosition::updateOrCreate(
            ['code' => 'LEGAL_ADMIN'],
            ['name' => 'Staf Legal/Admin Kredit', 'role_id' => $roles['legal_admin']->id]
        );

        JobPosition::updateOrCreate(
            ['code' => 'PIMPINAN_CABANG'],
            ['name' => 'Pimpinan Cabang', 'role_id' => $roles['kepala_cabang']->id]
        );

        JobPosition::updateOrCreate(
            ['code' => 'KADIV_OPERASIONAL'],
            ['name' => 'Kadiv Operasional Cabang', 'role_id' => $roles['kadiv_operasional']->id]
        );

        JobPosition::updateOrCreate(
            ['code' => 'IT_ADMIN'],
            ['name' => 'IT Administrator', 'role_id' => $roles['it_admin']->id]
        );

        JobPosition::updateOrCreate(
            ['code' => 'AUDITOR'],
            ['name' => 'SKAI/Auditor', 'role_id' => $roles['auditor']->id]
        );

        collect([
            ['login' => 'admin', 'name' => 'Administrator', 'position' => 'IT_ADMIN'],
            ['login' => 'legal', 'name' => 'Staf Legal', 'position' => 'LEGAL_ADMIN'],
            ['login' => 'pimpinan', 'name' => 'Pimpinan Cabang', 'position' => 'PIMPINAN_CABANG'],
            ['login' => 'kadiv', 'name' => 'Kadiv Operasional Cabang', 'position' => 'KADIV_OPERASIONAL'],
            ['login' => 'it', 'name' => 'IT Admin', 'position' => 'IT_ADMIN'],
            ['login' => 'auditor', 'name' => 'Auditor', 'position' => 'AUDITOR'],
        ])->each(fn (array $user) => User::updateOrCreate([
            'email' => $user['login'],
        ], [
            'name' => $user['name'],
            'password' => $seedPassword,
            'branch_id' => $branch->id,
            'job_position_id' => JobPosition::where('code', $user['position'])->value('id'),
            'notary_id' => null,
            'is_active' => true,
        ]));

        User::updateOrCreate([
            'email' => 'notaris',
        ], [
            'name' => 'Notaris',
            'password' => $seedPassword,
            'branch_id' => null,
            'job_position_id' => null,
            'notary_id' => $notary->id,
            'is_active' => true,
        ]);

        if (! app()->isProduction()) {
            $this->call(DemoFullDataSeeder::class);
        }
    }
}
