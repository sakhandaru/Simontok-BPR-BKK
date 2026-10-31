<?php

namespace App\Support;

use App\Enums\TrackAStatus;

/**
 * Pemetaan tunggal tujuh tahap pipeline (DESIGN.md blok 6).
 * Dipakai DashboardController (pipeline + aging) dan OrderController (filter stage)
 * supaya angka panel dan hasil filter selalu memakai definisi yang sama.
 */
final class OrderStages
{
    /**
     * Semua status Track A yang aktif masuk ke satu tahap.
     * Status terminal ditolak/dibatalkan sengaja tidak masuk tahap;
     * keduanya tetap tampil pada distribusi status order.
     *
     * @return array<string, array{label: string, statuses: list<string>}>
     */
    public static function groups(): array
    {
        return [
            'draft' => [
                'label' => 'Draft',
                'statuses' => [TrackAStatus::Draft->value, TrackAStatus::PerluPerbaikanOrder->value],
            ],
            'approval' => [
                'label' => 'Persetujuan order',
                'statuses' => [TrackAStatus::Diajukan->value, TrackAStatus::MenungguApproval->value, TrackAStatus::DisetujuiKepalaCabang->value],
            ],
            'verifikasi' => [
                'label' => 'Verifikasi notaris',
                'statuses' => [TrackAStatus::MenungguVerifikasiNotaris->value, TrackAStatus::PerbaikanDokumen->value, TrackAStatus::PerluPengalihanNotaris->value],
            ],
            'akta' => [
                'label' => 'Proses akta',
                'statuses' => [
                    TrackAStatus::PersiapanPekerjaan->value,
                    TrackAStatus::MenungguApprovalCovernote->value,
                    TrackAStatus::MenungguApprovalCovernoteKepalaCabang->value,
                    TrackAStatus::PerbaikanCovernote->value,
                    TrackAStatus::CovernoteDisetujui->value,
                    TrackAStatus::DokumenValid->value,
                    TrackAStatus::ProsesAkta->value,
                    TrackAStatus::ProsesBpnSamsat->value,
                ],
            ],
            'validasi' => [
                'label' => 'Validasi BPR',
                'statuses' => [TrackAStatus::DraftDiunggah->value, TrackAStatus::MenungguValidasiBpr->value, TrackAStatus::DokumenFinalDiunggah->value],
            ],
            'fisik' => [
                'label' => 'Fisik & bayar',
                'statuses' => [TrackAStatus::DokumenFisikDiterima->value],
            ],
            'selesai' => [
                'label' => 'Selesai',
                'statuses' => [TrackAStatus::Selesai->value],
            ],
        ];
    }

    /**
     * @return list<string>
     */
    public static function keys(): array
    {
        return array_keys(self::groups());
    }

    /**
     * @return list<string>
     */
    public static function statuses(string $key): array
    {
        return self::groups()[$key]['statuses'] ?? [];
    }

    /**
     * Status terminal di luar pipeline (order sudah keluar dari seluruh tahap).
     *
     * @return list<string>
     */
    public static function closedStatuses(): array
    {
        return [TrackAStatus::Selesai->value, TrackAStatus::Dibatalkan->value, TrackAStatus::DitolakNotaris->value];
    }

    /**
     * Tahap yang memuat order aktif (tanpa tahap Selesai), untuk matriks aging.
     *
     * @return array<string, array{label: string, statuses: list<string>}>
     */
    public static function activeGroups(): array
    {
        return collect(self::groups())
            ->except('selesai')
            ->all();
    }
}
