<?php

namespace Database\Seeders;

use App\Models\DocumentChecklist;
use App\Models\JobType;
use App\Models\SlaPolicy;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class NotaryWorkMasterSeeder extends Seeder
{
    public function run(): void
    {
        $workTypes = [
            'APHT' => [
                'name' => 'APHT',
                'sla_days' => 14,
                'steps' => ['Verifikasi berkas', 'Pengecekan sertifikat', 'Penyusunan APHT', 'Penandatanganan APHT', 'Pendaftaran Hak Tanggungan', 'Unggah bukti penyelesaian'],
                'required' => ['KTP Debitur', 'Kartu Keluarga (KK)', 'Sertifikat Tanah', 'SPPT PBB', 'KTP Pemilik Agunan'],
                'addon' => ['Surat Nikah/Akta Perkawinan', 'Akta Cerai', 'Akta Kematian', 'KTP Pasangan', 'Dokumen IMB/PBG', 'KTP Ahli Waris', 'Surat Keterangan Waris', 'Dokumen Pendukung Lainnya'],
            ],
            'SKMHT' => [
                'name' => 'SKMHT',
                'sla_days' => 7,
                'steps' => ['Verifikasi berkas', 'Pengecekan sertifikat', 'Penyusunan SKMHT', 'Penandatanganan SKMHT', 'Unggah akta dan bukti penyelesaian'],
                'required' => ['KTP Debitur', 'Kartu Keluarga (KK)', 'Sertifikat Tanah', 'SPPT PBB', 'KTP Pemilik Agunan'],
                'addon' => ['Surat Nikah/Akta Perkawinan', 'Akta Cerai', 'Akta Kematian', 'KTP Pasangan', 'Dokumen IMB/PBG', 'KTP Ahli Waris', 'Surat Keterangan Waris', 'Dokumen Pendukung Lainnya'],
            ],
            'HIBAH' => [
                'name' => 'Hibah',
                'sla_days' => 14,
                'steps' => ['Verifikasi berkas', 'Pengecekan sertifikat dan pajak', 'Penyusunan akta hibah', 'Penandatanganan akta hibah', 'Pendaftaran peralihan hak', 'Unggah bukti penyelesaian'],
                'required' => ['KTP Debitur', 'Kartu Keluarga (KK)', 'Sertifikat Tanah', 'SPPT PBB', 'KTP Pemilik Agunan'],
                'addon' => ['Surat Nikah/Akta Perkawinan', 'Akta Cerai', 'Akta Kematian', 'KTP Pasangan', 'Dokumen IMB/PBG', 'KTP Ahli Waris', 'Surat Keterangan Waris', 'Dokumen Pendukung Lainnya'],
            ],
            'BALIK_NAMA' => [
                'name' => 'Balik Nama',
                'sla_days' => 14,
                'steps' => ['Verifikasi berkas', 'Pengecekan sertifikat dan pajak', 'Penyusunan akta peralihan', 'Penandatanganan akta', 'Pendaftaran peralihan hak', 'Unggah bukti penyelesaian'],
                'required' => ['KTP Debitur', 'Kartu Keluarga (KK)', 'Sertifikat Tanah', 'SPPT PBB', 'KTP Pemilik Agunan'],
                'addon' => ['Surat Nikah/Akta Perkawinan', 'Akta Cerai', 'Akta Kematian', 'KTP Pasangan', 'Dokumen IMB/PBG', 'KTP Ahli Waris', 'Surat Keterangan Waris', 'Dokumen Pendukung Lainnya'],
            ],
            'PECAH_BIDANG' => [
                'name' => 'Pecah Bidang',
                'sla_days' => 30,
                'steps' => ['Verifikasi berkas', 'Pengecekan sertifikat dan data fisik', 'Pengajuan pengukuran', 'Pengukuran dan pemetaan', 'Penerbitan bidang hasil pemecahan', 'Unggah bukti penyelesaian'],
                'required' => ['KTP Debitur', 'Kartu Keluarga (KK)', 'Sertifikat Tanah', 'SPPT PBB', 'KTP Pemilik Agunan'],
                'addon' => ['Surat Nikah/Akta Perkawinan', 'Akta Cerai', 'Akta Kematian', 'KTP Pasangan', 'Dokumen IMB/PBG', 'KTP Ahli Waris', 'Surat Keterangan Waris', 'Dokumen Pendukung Lainnya'],
            ],
            'PENINGKATAN_HAK' => [
                'name' => 'Peningkatan Hak',
                'sla_days' => 30,
                'steps' => ['Verifikasi berkas', 'Pengecekan sertifikat dan status hak', 'Penyusunan permohonan peningkatan hak', 'Pemeriksaan data fisik dan yuridis', 'Penerbitan hak baru', 'Unggah bukti penyelesaian'],
                'required' => ['KTP Debitur', 'Kartu Keluarga (KK)', 'Sertifikat Tanah', 'SPPT PBB', 'KTP Pemilik Agunan'],
                'addon' => ['Surat Nikah/Akta Perkawinan', 'Akta Cerai', 'Akta Kematian', 'KTP Pasangan', 'Dokumen IMB/PBG', 'KTP Ahli Waris', 'Surat Keterangan Waris', 'Dokumen Pendukung Lainnya'],
            ],
            'PENSERTIFIKATAN' => [
                'name' => 'Pensertifikatan',
                'sla_days' => 60,
                'steps' => ['Verifikasi berkas', 'Pengecekan riwayat dan alas hak', 'Pengajuan pengukuran', 'Pengukuran dan pemetaan', 'Pemeriksaan data fisik dan yuridis', 'Penerbitan sertifikat', 'Unggah bukti penyelesaian'],
                'required' => ['KTP Debitur', 'Kartu Keluarga (KK)', 'Sertifikat Tanah', 'SPPT PBB', 'KTP Pemilik Agunan'],
                'addon' => ['Surat Nikah/Akta Perkawinan', 'Akta Cerai', 'Akta Kematian', 'KTP Pasangan', 'Dokumen IMB/PBG', 'KTP Ahli Waris', 'Surat Keterangan Waris', 'Dokumen Pendukung Lainnya'],
            ],
            'TURUN_WARIS' => [
                'name' => 'Turun Waris',
                'sla_days' => 30,
                'steps' => ['Verifikasi berkas ahli waris', 'Pengecekan sertifikat dan data pewaris', 'Penyusunan dokumen waris', 'Penandatanganan akta/pernyataan', 'Pendaftaran peralihan karena waris', 'Unggah bukti penyelesaian'],
                'required' => ['KTP Debitur', 'Kartu Keluarga (KK)', 'Sertifikat Tanah', 'SPPT PBB', 'KTP Pemilik Agunan'],
                'addon' => ['Surat Nikah/Akta Perkawinan', 'Akta Cerai', 'Akta Kematian', 'KTP Pasangan', 'Dokumen IMB/PBG', 'KTP Ahli Waris', 'Surat Keterangan Waris', 'Dokumen Pendukung Lainnya'],
            ],
            'FIDUSIA' => [
                'name' => 'Fidusia',
                'sla_days' => 3,
                'steps' => ['Verifikasi berkas', 'Penyusunan akta jaminan fidusia', 'Penandatanganan akta', 'Pendaftaran fidusia online', 'Unggah sertifikat fidusia'],
                'required' => ['KTP Debitur', 'Kartu Keluarga (KK)', 'BPKB', 'STNK', 'Gesek Nomor Rangka dan Nomor Mesin'],
                'addon' => ['Surat Nikah/Akta Perkawinan', 'Akta Cerai', 'Akta Kematian', 'KTP Pasangan', 'Dokumen Pendukung Lainnya'],
            ],
            'CESSIE' => [
                'name' => 'Cessie',
                'sla_days' => 7,
                'steps' => ['Verifikasi berkas', 'Pengecekan perjanjian kredit', 'Penyusunan akta cessie', 'Penandatanganan akta', 'Pencatatan/pemberitahuan pengalihan', 'Unggah bukti penyelesaian'],
                'required' => ['KTP Debitur', 'Kartu Keluarga (KK)', 'KTP Pihak yang Mengalihkan Piutang (Cedent)', 'KTP Penerima Pengalihan Piutang (Cessionaris)', 'Perjanjian Kredit'],
                'addon' => ['Surat Nikah/Akta Perkawinan', 'Akta Cerai', 'Akta Kematian', 'KTP Pasangan', 'Dokumen Pendukung Lainnya'],
            ],
            'KUASA_PAKAI' => [
                'name' => 'Kuasa Pakai',
                'sla_days' => 7,
                'steps' => ['Verifikasi berkas', 'Pengecekan objek dan kewenangan', 'Penyusunan surat kuasa', 'Penandatanganan surat kuasa', 'Unggah dokumen final'],
                'required' => ['KTP Pemberi Kuasa', 'KTP Penerima Kuasa', 'Kartu Keluarga (KK) Pemberi Kuasa', 'Dokumen/Bukti Kepemilikan Objek'],
                'addon' => ['Surat Nikah/Akta Perkawinan', 'Akta Cerai', 'Akta Kematian', 'KTP Pasangan', 'Dokumen Pendukung Lainnya'],
            ],
            'GADAI' => [
                'name' => 'Gadai',
                'sla_days' => 7,
                'steps' => ['Verifikasi berkas', 'Pengecekan kepemilikan deposito/tabungan', 'Penyusunan akta gadai', 'Penandatanganan akta', 'Pemberitahuan/pencatatan gadai', 'Unggah bukti penyelesaian'],
                'required' => ['KTP Debitur', 'Kartu Keluarga (KK)', 'KTP Pemilik Deposito/Tabungan', 'Bilyet Deposito atau Bukti Kepemilikan Tabungan'],
                'addon' => ['Surat Nikah/Akta Perkawinan', 'Akta Cerai', 'Akta Kematian', 'KTP Pasangan', 'Surat Persetujuan Pasangan (jika diperlukan)', 'Surat Kuasa (jika pemilik berbeda dengan debitur)', 'Dokumen Pendukung Lainnya'],
            ],
        ];

        DB::transaction(function () use ($workTypes): void {
            $codes = array_keys($workTypes);

            JobType::query()->whereNotIn('code', $codes)->update(['is_active' => false]);
            SlaPolicy::query()->whereNull('branch_id')->whereHas('jobType', fn ($query) => $query->whereNotIn('code', $codes))->update(['is_active' => false]);

            $allDocumentNames = collect($workTypes)
                ->flatMap(fn (array $workType): array => [...$workType['required'], ...$workType['addon']])
                ->unique()
                ->values();

            DocumentChecklist::query()
                ->whereNull('job_type_id')
                ->whereNotIn('name', $allDocumentNames)
                ->update(['is_active' => false]);
            DocumentChecklist::query()
                ->whereNotNull('job_type_id')
                ->update(['is_active' => false]);

            $documents = $allDocumentNames->mapWithKeys(function (string $name): array {
                $document = DocumentChecklist::withTrashed()->updateOrCreate(
                    ['name' => $name, 'job_type_id' => null],
                    ['is_active' => true, 'is_required' => false]
                );
                $document->restore();

                return [$name => $document];
            });

            foreach ($workTypes as $code => $definition) {
                $jobType = JobType::withTrashed()->firstOrNew(['code' => $code]);
                $jobType->fill(['name' => $definition['name'], 'is_active' => true]);
                $jobType->save();
                $jobType->restore();

                $jobType->steps()->delete();
                foreach ($definition['steps'] as $index => $step) {
                    $jobType->steps()->create([
                        'name' => $step,
                        'sort_order' => $index + 1,
                        'is_active' => true,
                    ]);
                }

                SlaPolicy::updateOrCreate(
                    ['job_type_id' => $jobType->id, 'branch_id' => null],
                    ['days' => $definition['sla_days'], 'is_active' => true],
                );

                $requiredNames = collect($definition['required']);
                $documentIds = $requiredNames
                    ->concat($definition['addon'])
                    ->mapWithKeys(fn (string $name): array => [
                        $documents[$name]->id => ['is_required' => $requiredNames->contains($name)],
                    ])
                    ->all();
                $jobType->documents()->sync($documentIds);
            }
        });
    }
}
