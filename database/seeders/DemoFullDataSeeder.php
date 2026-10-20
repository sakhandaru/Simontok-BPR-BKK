<?php

namespace Database\Seeders;

use App\Enums\OrderDocumentType;
use App\Enums\TrackAStatus;
use App\Enums\TrackBDocStatus;
use App\Enums\TrackCCovernoteStatus;
use App\Enums\TrackDPaymentStatus;
use App\Models\Branch;
use App\Models\DocumentChecklist;
use App\Models\JobType;
use App\Models\Notary;
use App\Models\Order;
use App\Models\User;
use Illuminate\Database\Seeder;

class DemoFullDataSeeder extends Seeder
{
    public function run(): void
    {
        $branch = Branch::firstOrCreate(['code' => '001'], ['name' => 'Kantor Pusat Operasional', 'is_active' => true]);
        $notaries = Notary::where('is_active', true)->take(4)->get();
        if ($notaries->count() < 4) {
            foreach (range($notaries->count() + 1, 4) as $index) {
                $notaries->push(Notary::create([
                    'name' => "Kantor Notaris Simulasi {$index}",
                    'email' => "notaris{$index}@demo.local",
                    'phone' => "024-00000{$index}",
                    'address' => 'Semarang',
                    'is_active' => true,
                ]));
            }
        }

        $notaries->each(fn (Notary $notary) => $branch->notaries()->syncWithoutDetaching([$notary->id => ['is_active' => true]]));

        $jobTypes = JobType::where('is_active', true)->take(6)->get();
        $admin = User::where('email', 'admin')->first() ?? User::first();
        $notaryUser = User::where('email', 'notaris')->first() ?? $admin;
        $manager = User::where('email', 'pimpinan')->first() ?? $admin;

        $customers = [
            'Budi Santoso', 'Siti Aminah', 'Agus Waryanto', 'Dewi Lestari', 'Sri Wahyuni',
            'Ahmad Fauzi', 'Rina Kartika', 'Hendra Saputra', 'Nuryanto', 'Eka Prasetya',
            'Wahyu Nugroho', 'Tri Astuti', 'Mulyono', 'Fitri Handayani', 'Joko Susilo',
            'Nur Azizah', 'Slamet Riyadi', 'Endang Setyowati', 'Arif Rahman', 'Indah Permata',
            'Teguh Prakoso', 'Yuni Hapsari', 'Rudi Hartono', 'Maya Sari',
        ];

        $statuses = [
            TrackAStatus::Draft,
            TrackAStatus::Diajukan,
            TrackAStatus::MenungguApproval,
            TrackAStatus::PerluPerbaikanOrder,
            TrackAStatus::DisetujuiKepalaCabang,
            TrackAStatus::MenungguVerifikasiNotaris,
            TrackAStatus::PerbaikanDokumen,
            TrackAStatus::DokumenValid,
            TrackAStatus::ProsesAkta,
            TrackAStatus::ProsesBpnSamsat,
            TrackAStatus::DraftDiunggah,
            TrackAStatus::MenungguValidasiBpr,
            TrackAStatus::DokumenFinalDiunggah,
            TrackAStatus::DokumenFisikDiterima,
            TrackAStatus::Selesai,
        ];

        foreach ($customers as $index => $customer) {
            $status = $statuses[$index % count($statuses)];
            $orderNo = 'DEMO-'.str_pad((string) ($index + 1), 4, '0', STR_PAD_LEFT);
            $createdAt = now()->subDays(42 - $index);
            $notary = $notaries[$index % $notaries->count()];

            $order = Order::updateOrCreate(
                ['order_no' => $orderNo],
                [
                    'branch_id' => $branch->id,
                    'notary_id' => $notary->id,
                    'customer_name' => $customer,
                    'no_rekening' => '001'.str_pad((string) (135000000 + $index), 9, '0', STR_PAD_LEFT),
                    'tgl_realisasi' => $createdAt->copy()->subDays(5),
                    'plafon' => 25_000_000 + ($index * 7_500_000),
                    'baki_debet' => 20_000_000 + ($index * 5_000_000),
                    'kolek' => (string) (($index % 5) + 1),
                    'stat_kred' => 1,
                    'tgl_masuk_notaris' => $createdAt,
                    'nominal' => 250_000 + ($index * 75_000),
                    'skema_pembayaran' => $index % 2 === 0 ? 'transfer' : 'termin',
                    'status' => $status,
                    'risk_flag' => in_array($index % 8, [2, 5], true),
                    'created_by' => $admin?->id,
                    'sent_to_notary_at' => in_array($status, [
                        TrackAStatus::Draft,
                        TrackAStatus::Diajukan,
                        TrackAStatus::MenungguApproval,
                        TrackAStatus::PerluPerbaikanOrder,
                        TrackAStatus::DisetujuiKepalaCabang,
                    ], true) ? null : $createdAt->copy()->addDay(),
                    'created_at' => $createdAt,
                    'updated_at' => now(),
                ]
            );

            $order->collaterals()->delete();
            $order->documents()->delete();
            $order->handovers()->delete();
            $order->paymentRequest()->first()?->payments()->delete();
            $order->paymentRequest()->delete();
            $order->progress()->delete();
            $order->statusHistories()->delete();

            $collateralCount = ($index % 3) + 1;
            foreach (range(1, $collateralCount) as $collateralIndex) {
                $jobType = $jobTypes[($index + $collateralIndex) % $jobTypes->count()];
                $docStatus = $this->docStatusFor($status);
                $coverEnd = $this->coverEndFor($index);

                $collateral = $order->collaterals()->create([
                    'job_type_id' => $jobType->id,
                    'agunan_id' => "AG-{$orderNo}-{$collateralIndex}",
                    'deskripsi_agunan' => $collateralIndex % 2 === 0 ? 'Tanah dan bangunan SHM' : 'Kendaraan/BPKB atau dokumen agunan',
                    'doc_status' => $docStatus,
                    'covernote_no' => "CN/{$orderNo}/{$collateralIndex}",
                    'covernote_start' => $createdAt,
                    'covernote_end' => $coverEnd,
                    'covernote_status' => $this->coverStatusFor($coverEnd, $status),
                    'extension_count' => $index % 4 === 0 ? 1 : 0,
                    'sla_due_at' => $createdAt->copy()->addDays(14 + (($index + $collateralIndex) % 4) * 10),
                ]);

                if ($status !== TrackAStatus::Diajukan) {
                    $order->progress()->create([
                        'order_collateral_id' => $collateral->id,
                        'status' => 'Pengecekan ulang kelengkapan dokumen',
                        'catatan' => 'Simulasi progres pekerjaan untuk tampilan penuh.',
                        'komitmen_penyelesaian' => now()->addDays(($index % 10) + 1),
                        'created_by' => $notaryUser?->id ?? $admin?->id,
                    ]);
                }

                if (in_array($docStatus, [TrackBDocStatus::DraftDiunggah, TrackBDocStatus::FinalDiunggah, TrackBDocStatus::FinalDivalidasi], true)) {
                    $order->documents()->create([
                        'order_collateral_id' => $collateral->id,
                        'document_type' => OrderDocumentType::Draft,
                        'version' => 1,
                        'original_name' => "draft-{$orderNo}.pdf",
                        'stored_name' => "draft-{$orderNo}.pdf",
                        'stored_path' => "demo/draft-{$orderNo}.pdf",
                        'mime_type' => 'application/pdf',
                        'file_size' => 120000,
                        'uploaded_by' => $notaryUser?->id ?? $admin?->id,
                    ]);
                }

                if (in_array($docStatus, [TrackBDocStatus::FinalDiunggah, TrackBDocStatus::FinalDivalidasi], true)) {
                    $order->documents()->create([
                        'order_collateral_id' => $collateral->id,
                        'document_type' => OrderDocumentType::Final,
                        'version' => 1,
                        'original_name' => "final-{$orderNo}.pdf",
                        'stored_name' => "final-{$orderNo}.pdf",
                        'stored_path' => "demo/final-{$orderNo}.pdf",
                        'mime_type' => 'application/pdf',
                        'file_size' => 180000,
                        'uploaded_by' => $notaryUser?->id ?? $admin?->id,
                        'validated_by' => $docStatus === TrackBDocStatus::FinalDivalidasi ? $admin?->id : null,
                        'validated_at' => $docStatus === TrackBDocStatus::FinalDivalidasi ? now()->subDays($index % 5) : null,
                    ]);
                }

                if (in_array($status, [TrackAStatus::DokumenFisikDiterima, TrackAStatus::Selesai], true)) {
                    $order->handovers()->create([
                        'order_collateral_id' => $collateral->id,
                        'receiver_name' => 'Admin Legal',
                        'method' => 'kurir',
                        'handed_over_at' => now()->subDays($index % 6),
                        'maker_id' => $admin?->id,
                        'made_at' => now()->subDays($index % 6),
                    ]);
                }
            }

            $this->seedPayment($order, $index, $admin?->id, $manager?->id);

            $journeyStatuses = [
            TrackAStatus::Draft,
            TrackAStatus::Diajukan,
            TrackAStatus::MenungguApproval,
            TrackAStatus::PerluPerbaikanOrder,
            TrackAStatus::DisetujuiKepalaCabang,
            TrackAStatus::MenungguVerifikasiNotaris,
                TrackAStatus::DokumenValid,
                TrackAStatus::ProsesAkta,
                TrackAStatus::DraftDiunggah,
                TrackAStatus::MenungguValidasiBpr,
                TrackAStatus::DokumenFinalDiunggah,
                TrackAStatus::DokumenFisikDiterima,
                TrackAStatus::Selesai,
            ];
            $currentJourneyIndex = array_search($status, $journeyStatuses, true);

            foreach (array_slice($journeyStatuses, 0, $currentJourneyIndex === false ? 1 : $currentJourneyIndex + 1) as $journeyIndex => $journeyStatus) {
                $order->statusHistories()->create([
                    'track' => 'A',
                    'to_status' => $journeyStatus->value,
                    'actor_type' => 'system',
                    'reason' => 'Simulasi data penuh.',
                    'created_at' => $createdAt->copy()->addHours($journeyIndex * 4),
                ]);
            }
        }

        $this->seedPatiNotaryDecisionOrders($notaries, $jobTypes, $admin?->id);
    }

    private function seedPatiNotaryDecisionOrders($notaries, $jobTypes, ?int $adminId): void
    {
        $branch = Branch::firstOrCreate(['code' => 'PATI'], [
            'name' => 'Kantor Cabang Pati',
            'is_active' => true,
        ]);
        $notary = $notaries->first();
        $jobType = $jobTypes->first();
        $checklists = DocumentChecklist::query()
            ->where('is_active', true)
            ->where(fn ($query) => $query->whereNull('job_type_id')->orWhere('job_type_id', $jobType?->id))
            ->get();

        if (! $notary || ! $jobType || ! $adminId) {
            return;
        }

        $scenarios = [
            ['order_no' => 'PATI-NOTARY-ACCEPT-001', 'customer_name' => 'Nasabah Pati Menunggu Keputusan', 'status' => TrackAStatus::MenungguVerifikasiNotaris],
            ['order_no' => 'PATI-NOTARY-REJECT-001', 'customer_name' => 'Nasabah Pati Ditolak Notaris', 'status' => TrackAStatus::DitolakNotaris],
        ];

        foreach ($scenarios as $index => $scenario) {
            $createdAt = now()->subDays(2 - $index);
            $order = Order::updateOrCreate(
                ['order_no' => $scenario['order_no']],
                [
                    'branch_id' => $branch->id,
                    'notary_id' => $notary->id,
                    'customer_name' => $scenario['customer_name'],
                    'no_rekening' => 'PATI'.str_pad((string) ($index + 1), 8, '0', STR_PAD_LEFT),
                    'tgl_realisasi' => today()->addDays(7 + $index),
                    'plafon' => 150_000_000,
                    'kolek' => 1,
                    'stat_kred' => 1,
                    'tgl_masuk_notaris' => $createdAt,
                    'nominal' => 2_500_000,
                    'skema_pembayaran' => 'transfer',
                    'status' => $scenario['status'],
                    'risk_flag' => false,
                    'created_by' => $adminId,
                    'sent_to_notary_at' => $createdAt->copy()->addHours(4),
                    'created_at' => $createdAt,
                    'updated_at' => now(),
                ],
            );

            $order->collaterals()->delete();
            $order->statusHistories()->delete();
            $collateral = $order->collaterals()->create([
                'job_type_id' => $jobType->id,
                'agunan_id' => 'PATI-AG-00'.($index + 1),
                'deskripsi_agunan' => 'Tanah dan bangunan di Kabupaten Pati',
                'doc_status' => TrackBDocStatus::MenungguVerifikasi,
                'covernote_no' => null,
                'covernote_start' => null,
                'covernote_end' => null,
                'covernote_file_path' => null,
                'covernote_status' => null,
                'sla_due_at' => $createdAt->copy()->addDays(14),
            ]);

            foreach ($checklists as $checklist) {
                $collateral->checklists()->create([
                    'order_id' => $order->id,
                    'document_checklist_id' => $checklist->id,
                    'is_checked' => false,
                ]);
            }

            foreach ([
                [TrackAStatus::Draft, 'Order Pati dibuat oleh Admin Legal.'],
                [TrackAStatus::Diajukan, 'Order Pati diajukan untuk approval.'],
                [TrackAStatus::DisetujuiKepalaCabang, 'Order Pati disetujui Pimpinan Cabang.'],
                [TrackAStatus::MenungguVerifikasiNotaris, 'Order dikirim ke notaris Pati.'],
            ] as $journeyIndex => [$journeyStatus, $reason]) {
                $order->statusHistories()->create([
                    'track' => 'A',
                    'to_status' => $journeyStatus->value,
                    'actor_type' => 'system',
                    'actor_id' => $adminId,
                    'reason' => $reason,
                    'created_at' => $createdAt->copy()->addHours($journeyIndex * 3),
                ]);
            }

            if ($scenario['status'] === TrackAStatus::DitolakNotaris) {
                $order->statusHistories()->create([
                    'track' => 'A',
                    'from_status' => TrackAStatus::MenungguVerifikasiNotaris->value,
                    'to_status' => TrackAStatus::DitolakNotaris->value,
                    'actor_type' => 'notary',
                    'actor_id' => $notary->id,
                    'reason' => 'Notaris menolak karena dokumen agunan belum dapat diproses sesuai persyaratan.',
                    'created_at' => $createdAt->copy()->addHours(15),
                ]);
            }
        }
    }

    private function docStatusFor(TrackAStatus $status): TrackBDocStatus
    {
        return match ($status) {
            TrackAStatus::Draft, TrackAStatus::Diajukan, TrackAStatus::MenungguApproval, TrackAStatus::PerluPerbaikanOrder, TrackAStatus::DisetujuiKepalaCabang, TrackAStatus::MenungguVerifikasiNotaris => TrackBDocStatus::MenungguVerifikasi,
            TrackAStatus::PerbaikanDokumen => TrackBDocStatus::PerluPerbaikan,
            TrackAStatus::DokumenValid, TrackAStatus::ProsesAkta, TrackAStatus::ProsesBpnSamsat => TrackBDocStatus::DokumenValid,
            TrackAStatus::DraftDiunggah => TrackBDocStatus::DraftDiunggah,
            TrackAStatus::MenungguValidasiBpr, TrackAStatus::DokumenFinalDiunggah => TrackBDocStatus::FinalDiunggah,
            default => TrackBDocStatus::FinalDivalidasi,
        };
    }

    private function coverEndFor(int $index)
    {
        return match ($index % 8) {
            2 => today()->subDays(3),
            5 => today()->addDays(3),
            default => today()->addDays(20 + ($index % 20)),
        };
    }

    private function coverStatusFor($coverEnd, TrackAStatus $status): TrackCCovernoteStatus
    {
        if (in_array($status, [TrackAStatus::DokumenFisikDiterima, TrackAStatus::Selesai], true)) {
            return TrackCCovernoteStatus::DigantiSertifikat;
        }

        if ($coverEnd->lt(today())) {
            return TrackCCovernoteStatus::Kedaluwarsa;
        }

        return $coverEnd->diffInDays(today()) <= 7
            ? TrackCCovernoteStatus::MendekatiJatuhTempo
            : TrackCCovernoteStatus::Aktif;
    }

    private function seedPayment(Order $order, int $index, ?int $adminId, ?int $managerId): void
    {
        if ($index % 4 === 0) {
            return;
        }

        $status = match ($index % 5) {
            1 => TrackDPaymentStatus::Diajukan,
            2 => TrackDPaymentStatus::DiverifikasiAdmin,
            3 => TrackDPaymentStatus::Disetujui,
            default => TrackDPaymentStatus::Dibayar,
        };

        $request = $order->paymentRequest()->create([
            'invoice_no' => 'INV-'.$order->order_no,
            'nominal' => $order->nominal,
            'skema_pembayaran' => $order->skema_pembayaran,
            'status' => $status,
            'catatan_notaris' => 'Invoice simulasi.',
            'requested_at' => now()->subDays(8 - ($index % 6)),
            'verified_by' => in_array($status, [TrackDPaymentStatus::DiverifikasiAdmin, TrackDPaymentStatus::Disetujui, TrackDPaymentStatus::Dibayar], true) ? $adminId : null,
            'verified_at' => in_array($status, [TrackDPaymentStatus::DiverifikasiAdmin, TrackDPaymentStatus::Disetujui, TrackDPaymentStatus::Dibayar], true) ? now()->subDays(4) : null,
            'approved_by' => in_array($status, [TrackDPaymentStatus::Disetujui, TrackDPaymentStatus::Dibayar], true) ? $managerId : null,
            'approved_at' => in_array($status, [TrackDPaymentStatus::Disetujui, TrackDPaymentStatus::Dibayar], true) ? now()->subDays(2) : null,
            'paid_at' => $status === TrackDPaymentStatus::Dibayar ? now()->subDay() : null,
        ]);

        if ($status === TrackDPaymentStatus::Dibayar) {
            $request->payments()->create([
                'order_id' => $order->id,
                'paid_at' => now()->subDay(),
                'nominal' => $order->nominal,
                'bukti_path' => "demo/payment-{$order->order_no}.pdf",
                'uploaded_by' => $adminId,
                'catatan' => 'Bukti bayar simulasi.',
            ]);
        }
    }
}
