<?php

namespace Database\Seeders;

use App\Models\CoreDummyAccount;
use Illuminate\Database\Seeder;

class CoreAccountSeeder extends Seeder
{
    public function run(): void
    {
        $accounts = [
            [
                'account_id' => 'DUMMY-ACCOUNT-001', 'account_number' => '001234567890',
                'customer_id' => 'DUMMY-CUSTOMER-001', 'customer_name' => 'Budi Santoso',
                'plafon' => 150_000_000,
                'branch_code' => '001', 'branch_name' => 'KC. Kantor Pusat Operasional',
                'collaterals' => [
                    ['collateral_id' => 'DUMMY-AGUNAN-001', 'type_name' => 'Sertifikat Hak Milik', 'description' => 'SHM No. 123 / Budi Santoso'],
                ],
            ],
            [
                'account_id' => 'DUMMY-ACCOUNT-002', 'account_number' => '001234567891',
                'customer_id' => 'DUMMY-CUSTOMER-001', 'customer_name' => 'Budi Santoso',
                'plafon' => 275_000_000,
                'branch_code' => '001', 'branch_name' => 'KC. Kantor Pusat Operasional',
                'collaterals' => [
                    ['collateral_id' => 'DUMMY-AGUNAN-002', 'type_name' => 'BPKB Kendaraan', 'description' => 'BPKB Honda CR-V'],
                    ['collateral_id' => 'DUMMY-AGUNAN-003', 'type_name' => 'Sertifikat Hak Milik', 'description' => 'SHM No. 456 / Budi Santoso'],
                ],
            ],
            [
                'account_id' => 'DUMMY-ACCOUNT-003', 'account_number' => '001987654321',
                'customer_id' => 'DUMMY-CUSTOMER-002', 'customer_name' => 'Siti Rahmawati',
                'plafon' => 75_000_000,
                'branch_code' => '001', 'branch_name' => 'KC. Kantor Pusat Operasional',
                'collaterals' => [],
            ],
        ];

        foreach ($accounts as $data) {
            $collaterals = $data['collaterals'];
            unset($data['collaterals']);

            $account = CoreDummyAccount::updateOrCreate(['account_id' => $data['account_id']], $data);
            $account->collaterals()->delete();
            $account->collaterals()->createMany($collaterals);
        }
    }
}
