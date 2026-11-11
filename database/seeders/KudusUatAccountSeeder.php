<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class KudusUatAccountSeeder extends Seeder
{
    public function run(): void
    {
        $this->callWith(CoreAccountSeeder::class, ['branchCode' => '002']);
    }
}
