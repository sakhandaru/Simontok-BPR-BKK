<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\JobPosition;
use App\Models\Notary;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class UatPartnerSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing', 'staging']) || config('core.provider') !== 'dummy') {
            throw new RuntimeException('Seeder rekanan UAT hanya tersedia di local/testing/staging dengan CORE_PROVIDER=dummy.');
        }

        $position = JobPosition::where('code', 'NOTARIS')
            ->whereHas('role', fn ($query) => $query->where('code', 'notaris'))
            ->firstOrFail();
        $fixture = file_get_contents(database_path('seeders/fixtures/notary-agreement-uat.pdf'));
        if ($fixture === false) {
            throw new RuntimeException('Dokumen PKS UAT tidak tersedia.');
        }

        DB::transaction(function () use ($position, $fixture): void {
            $branch = Branch::firstOrCreate(['code' => '001'], [
                'name' => 'KC. Kantor Pusat Operasional',
                'is_active' => true,
            ]);
            if (! $branch->is_active) {
                throw new RuntimeException('Cabang 001 nonaktif. Aktifkan cabang UAT melalui master cabang terlebih dahulu.');
            }

            $notary = Notary::firstOrCreate(['email' => 'notaris.demo@example.com'], [
                'name' => 'Kantor Notaris Demo',
                'is_active' => true,
            ]);
            $path = 'demo/notary-agreement.pdf';
            if ($notary->legacy_id || (filled($notary->agreement_file_path) && $notary->agreement_file_path !== $path)) {
                throw new RuntimeException('Notaris demo sudah memakai data atau dokumen lain; seeder UAT tidak boleh menimpanya.');
            }

            $archive = $notary->documents()->where('document_type', 'notary_agreement')->where('status', 'active')->first();
            if ($archive && $archive->file_path !== $path) {
                throw new RuntimeException('Notaris demo sudah memiliki arsip PKS lain.');
            }
            $disk = Storage::disk('local');
            if ($disk->exists($path) && hash('sha256', $disk->get($path)) !== hash('sha256', $fixture)) {
                throw new RuntimeException('File PKS demo sudah berisi dokumen lain.');
            }

            if (! $disk->exists($path) && ! $disk->put($path, $fixture)) {
                throw new RuntimeException('File PKS UAT gagal disimpan.');
            }

            $notary->update([
                'is_active' => true,
                'bank_name' => 'BKK JATENG',
                'agreement_type' => 'PKS',
                'agreement_file_path' => $path,
                'agreement_file_name' => 'PKS Notaris Demo - KHUSUS UAT.pdf',
                'pks_no' => 'PKS-DEMO-001',
                'pks_start' => $notary->pks_start ?? today(),
                'pks_end' => $notary->pks_end && ! $notary->pks_end->isBefore(today())
                    ? $notary->pks_end
                    : today()->addYear(),
            ]);
            $notary->branches()->syncWithoutDetaching([$branch->id => ['is_active' => true]]);

            $portal = $notary->users()->first();
            if (! config('uat.emergency_only') && ! $portal) {
                $login = 'notaris.demo@example.com';
                if (User::where('email', $login)->exists()) {
                    throw new RuntimeException('Login portal UAT sudah dipakai pengguna lain.');
                }
                $portal = $notary->users()->create([
                    'email' => $login,
                    'name' => 'Notaris Demo UAT',
                    'password' => env('SEEDER_DEFAULT_PASSWORD') ?: Str::random(32),
                    'job_position_id' => $position->id,
                    'is_active' => true,
                ]);
            } elseif ($portal && $portal->sso_employee_id) {
                throw new RuntimeException('Akun notaris demo terhubung ke pegawai SSO.');
            } elseif ($portal) {
                $portal->update(['is_active' => true, 'job_position_id' => $position->id]);
            }

            if (! $archive) {
                $notary->documents()->create([
                    'document_type' => 'notary_agreement',
                    'document_key' => 'default',
                    'category' => 'legalitas_rekanan',
                    'version' => ((int) $notary->documents()->where('document_type', 'notary_agreement')->max('version')) + 1,
                    'title' => 'PKS Notaris Demo - KHUSUS UAT',
                    'original_name' => $notary->agreement_file_name,
                    'storage_disk' => 'local',
                    'file_path' => $path,
                    'file_size' => strlen($fixture),
                    'file_hash' => hash('sha256', $fixture),
                    'status' => 'active',
                    'metadata' => ['uat' => true, 'agreement_type' => 'PKS', 'pks_no' => $notary->pks_no],
                    'change_note' => 'Dokumen simulasi UAT, bukan perjanjian resmi.',
                ]);
            }

            $portalLabel = $portal?->email ?? 'tanpa akun portal (mode admin-only)';
            $this->command?->info("Rekanan UAT siap: cabang {$branch->code}, {$notary->name}, portal {$portalLabel}.");
        });
    }
}
