<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentSchemeOption extends Model
{
    protected $table = 'payment_scheme_options';

    protected $fillable = ['name'];
}
