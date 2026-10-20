<?php

namespace App\Enums;

enum TrackBDocStatus: string
{
    case MenungguVerifikasi = 'menunggu_verifikasi';
    case PerluPerbaikan = 'perlu_perbaikan';
    case DokumenValid = 'dokumen_valid';
    case DraftDiunggah = 'draft_diunggah';
    case FinalDiunggah = 'final_diunggah';
    case FinalDivalidasi = 'final_divalidasi';
}
