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
                'customer_id' => 'DUMMY-CUSTOMER-001', 'customer_name' => 'Budi Santoso', 'marital_status' => 'married',
                'plafon' => 150_000_000,
                'branch_code' => '001', 'branch_name' => 'KC. Kantor Pusat Operasional',
                'collaterals' => [
                    ['collateral_id' => 'DUMMY-AGUNAN-001', 'type_name' => 'Sertifikat Hak Milik', 'description' => 'SHM No. 123 / Budi Santoso'],
                ],
            ],
            [
                'account_id' => 'DUMMY-ACCOUNT-002', 'account_number' => '001234567891',
                'customer_id' => 'DUMMY-CUSTOMER-001', 'customer_name' => 'Budi Santoso', 'marital_status' => 'married',
                'plafon' => 275_000_000,
                'branch_code' => '001', 'branch_name' => 'KC. Kantor Pusat Operasional',
                'collaterals' => [
                    ['collateral_id' => 'DUMMY-AGUNAN-002', 'type_name' => 'BPKB Kendaraan', 'description' => 'BPKB Honda CR-V'],
                    ['collateral_id' => 'DUMMY-AGUNAN-003', 'type_name' => 'Sertifikat Hak Milik', 'description' => 'SHM No. 456 / Budi Santoso'],
                ],
            ],
            [
                'account_id' => 'DUMMY-ACCOUNT-003', 'account_number' => '001987654321',
                'customer_id' => 'DUMMY-CUSTOMER-002', 'customer_name' => 'Siti Rahmawati', 'marital_status' => 'married',
                'plafon' => 75_000_000,
                'branch_code' => '001', 'branch_name' => 'KC. Kantor Pusat Operasional',
                'collaterals' => [],
            ],
            [
                'account_id' => 'DUMMY-ACCOUNT-004', 'account_number' => '002345678901',
                'customer_id' => 'DUMMY-CUSTOMER-003', 'customer_name' => 'Andi Pratama', 'marital_status' => 'single',
                'plafon' => 125_000_000,
                'branch_code' => '001', 'branch_name' => 'KC. Kantor Pusat Operasional',
                'collaterals' => [
                    ['collateral_id' => 'DUMMY-AGUNAN-004', 'type_name' => 'Sertifikat Hak Milik', 'description' => 'SHM No. 789 / Andi Pratama'],
                ],
            ],
            [
                'account_id' => 'DUMMY-ACCOUNT-005', 'account_number' => '002345678902',
                'customer_id' => 'DUMMY-CUSTOMER-004', 'customer_name' => 'Dewi Lestari', 'marital_status' => 'married',
                'plafon' => 210_000_000,
                'branch_code' => '001', 'branch_name' => 'KC. Kantor Pusat Operasional',
                'collaterals' => [
                    ['collateral_id' => 'DUMMY-AGUNAN-005', 'type_name' => 'BPKB Kendaraan', 'description' => 'BPKB Toyota Innova / Dewi Lestari'],
                    ['collateral_id' => 'DUMMY-AGUNAN-006', 'type_name' => 'Sertifikat Hak Milik', 'description' => 'SHM No. 901 / Dewi Lestari'],
                ],
            ],
            [
                'account_id' => 'DUMMY-ACCOUNT-006', 'account_number' => '002345678903',
                'customer_id' => 'DUMMY-CUSTOMER-005', 'customer_name' => 'Rizky Maulana', 'marital_status' => 'single',
                'plafon' => 90_000_000,
                'branch_code' => '001', 'branch_name' => 'KC. Kantor Pusat Operasional',
                'collaterals' => [
                    ['collateral_id' => 'DUMMY-AGUNAN-007', 'type_name' => 'Deposito', 'description' => 'Bilyet deposito / Rizky Maulana'],
                ],
            ],
            [
                'account_id' => 'DUMMY-ACCOUNT-007', 'account_number' => '002345678904',
                'customer_id' => 'DUMMY-CUSTOMER-006', 'customer_name' => 'Maya Kusuma', 'marital_status' => 'married',
                'plafon' => 350_000_000,
                'branch_code' => '001', 'branch_name' => 'KC. Kantor Pusat Operasional',
                'collaterals' => [
                    ['collateral_id' => 'DUMMY-AGUNAN-008', 'type_name' => 'Sertifikat Hak Milik', 'description' => 'SHM No. 112 / Maya Kusuma'],
                    ['collateral_id' => 'DUMMY-AGUNAN-009', 'type_name' => 'Tanah dan Bangunan', 'description' => 'Rumah tinggal / Maya Kusuma'],
                ],
            ],
            [
                'account_id' => 'DUMMY-ACCOUNT-008', 'account_number' => '002345678905',
                'customer_id' => 'DUMMY-CUSTOMER-007', 'customer_name' => 'Fajar Hidayat', 'marital_status' => 'single',
                'plafon' => 60_000_000,
                'branch_code' => '001', 'branch_name' => 'KC. Kantor Pusat Operasional',
                'collaterals' => [
                    ['collateral_id' => 'DUMMY-AGUNAN-010', 'type_name' => 'BPKB Kendaraan', 'description' => 'BPKB Suzuki Ertiga / Fajar Hidayat'],
                ],
            ],
            [
                'account_id' => 'DUMMY-ACCOUNT-009', 'account_number' => '002345678906',
                'customer_id' => 'DUMMY-CUSTOMER-008', 'customer_name' => 'Nadia Permata', 'marital_status' => 'married',
                'plafon' => 185_000_000,
                'branch_code' => '001', 'branch_name' => 'KC. Kantor Pusat Operasional',
                'collaterals' => [
                    ['collateral_id' => 'DUMMY-AGUNAN-011', 'type_name' => 'Sertifikat Hak Milik', 'description' => 'SHM No. 314 / Nadia Permata'],
                ],
            ],
            [
                'account_id' => 'DUMMY-ACCOUNT-010', 'account_number' => '002345678907',
                'customer_id' => 'DUMMY-CUSTOMER-009', 'customer_name' => 'Bagus Setiawan', 'marital_status' => 'single',
                'plafon' => 420_000_000,
                'branch_code' => '001', 'branch_name' => 'KC. Kantor Pusat Operasional',
                'collaterals' => [
                    ['collateral_id' => 'DUMMY-AGUNAN-012', 'type_name' => 'Tanah dan Bangunan', 'description' => 'Ruko usaha / Bagus Setiawan'],
                ],
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
