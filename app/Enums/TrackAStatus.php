<?php

namespace App\Enums;

enum TrackAStatus: string
{
    case Draft = 'draft';
    case Diajukan = 'diajukan';
    case MenungguApproval = 'menunggu_approval';
    case PerluPerbaikanOrder = 'perlu_perbaikan_order';
    case DisetujuiKepalaCabang = 'disetujui_kepala_cabang';
    case MenungguVerifikasiNotaris = 'menunggu_verifikasi_notaris';
    case PerbaikanDokumen = 'perbaikan_dokumen';
    case PerluPengalihanNotaris = 'perlu_pengalihan_notaris';
    case MenungguApprovalCovernote = 'menunggu_approval_covernote';
    case MenungguApprovalCovernoteKepalaCabang = 'menunggu_approval_covernote_kepala_cabang';
    case PerbaikanCovernote = 'perbaikan_covernote';
    case CovernoteDisetujui = 'covernote_disetujui';
    case DokumenValid = 'dokumen_valid';
    case ProsesAkta = 'proses_akta';
    case ProsesBpnSamsat = 'proses_bpn_samsat';
    case DraftDiunggah = 'draft_diunggah';
    case MenungguValidasiBpr = 'menunggu_validasi_bpr';
    case DokumenFinalDiunggah = 'dokumen_final_diunggah';
    case DokumenFisikDiterima = 'dokumen_fisik_diterima';
    case Selesai = 'selesai';
    case DitolakNotaris = 'ditolak_notaris';
    case Dibatalkan = 'dibatalkan';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::Diajukan => 'Diajukan',
            self::MenungguApproval => 'Menunggu approval',
            self::PerluPerbaikanOrder => 'Perlu perbaikan order',
            self::DisetujuiKepalaCabang => 'Disetujui Kepala Cabang',
            self::MenungguVerifikasiNotaris => 'Menunggu verifikasi notaris',
            self::PerbaikanDokumen => 'Perbaikan dokumen',
            self::PerluPengalihanNotaris => 'Perlu pengalihan notaris',
            self::MenungguApprovalCovernote => 'Menunggu approval covernote',
            self::MenungguApprovalCovernoteKepalaCabang => 'Menunggu approval covernote Kepala Cabang',
            self::PerbaikanCovernote => 'Perbaikan covernote',
            self::CovernoteDisetujui => 'Covernote disetujui',
            self::DokumenValid => 'Dokumen valid',
            self::ProsesAkta => 'Proses akta',
            self::ProsesBpnSamsat => 'Proses BPN/Samsat',
            self::DraftDiunggah => 'Draft diunggah',
            self::MenungguValidasiBpr => 'Menunggu validasi BPR',
            self::DokumenFinalDiunggah => 'Dokumen final diunggah',
            self::DokumenFisikDiterima => 'Dokumen fisik diterima',
            self::Selesai => 'Selesai',
            self::DitolakNotaris => 'Ditolak notaris',
            self::Dibatalkan => 'Dibatalkan',
        };
    }
}
