<?php

namespace App\Enums;

enum HandoverMethod: string
{
    case Kurir = 'kurir';
    case Titip = 'titip';
    case AmbilSendiri = 'ambil_sendiri';
}
