<?php

namespace App\Enums;

enum TrackDPaymentStatus: string
{
    case BelumAjuan = 'belum_ajuan';
    case Diajukan = 'diajukan';
    case DiverifikasiAdmin = 'diverifikasi_admin';
    case Disetujui = 'disetujui';
    case Dibayar = 'dibayar';
    case DitolakAdmin = 'ditolak_admin';
    case DitolakManajemen = 'ditolak_manajemen';

    public function label(): string
    {
        return match ($this) {
            self::BelumAjuan => 'Belum diajukan',
            self::Diajukan => 'Diajukan',
            self::DiverifikasiAdmin => 'Diverifikasi admin',
            self::Disetujui => 'Disetujui',
            self::Dibayar => 'Dibayar',
            self::DitolakAdmin => 'Ditolak admin',
            self::DitolakManajemen => 'Ditolak manajemen',
        };
    }
}
