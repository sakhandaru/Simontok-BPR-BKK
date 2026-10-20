<?php

namespace App\Enums;

enum OrderDocumentType: string
{
    case DokumenAwal = 'dokumen_awal';
    case Draft = 'draft';
    case ResiBpn = 'resi_bpn';
    case Final = 'final';
    case BuktiBayar = 'bukti_bayar';
    case TandaTerima = 'tanda_terima';
    case Lainnya = 'lainnya';
}
