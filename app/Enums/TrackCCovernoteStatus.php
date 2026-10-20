<?php

namespace App\Enums;

enum TrackCCovernoteStatus: string
{
    case Aktif = 'aktif';
    case MendekatiJatuhTempo = 'mendekati_jatuh_tempo';
    case Diperpanjang = 'diperpanjang';
    case DigantiSertifikat = 'diganti_sertifikat';
    case Kedaluwarsa = 'kedaluwarsa';
}
