<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\CoreDummyAccount;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CoreAccountSeeder extends Seeder
{
    public function run(): void
    {
        if (config('core.provider') !== 'dummy') {
            $this->command?->warn('Seeder nasabah dummy dilewati karena CORE_PROVIDER bukan dummy.');

            return;
        }

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

        $branchNames = [
            '001' => 'KC. Kantor Pusat Operasional',
            '002' => 'KC. Kudus',
            '003' => 'KC. Demak',
            '004' => 'KC. Jepara',
            '005' => 'KC. Pati',
            '006' => 'KC. Rembang',
            '007' => 'KC. Semarang',
            '008' => 'KC. Grobogan',
            '009' => 'KC. Blora',
            '010' => 'KC. Purwodadi',
        ];

        DB::transaction(function () use ($accounts, $branchNames): void {
            $branches = collect($branchNames)->map(fn (string $name, string $code) => Branch::withTrashed()->firstOrCreate(
                ['code' => $code],
                ['name' => $name, 'is_active' => true],
            ));

            foreach ($branches as $branch) {
                $accounts = array_merge($accounts, $this->additionalAccounts($branch));
            }

            foreach ($accounts as $data) {
                $collaterals = $data['collaterals'];
                unset($data['collaterals']);
                $data['branch_name'] = $branches->get($data['branch_code'])->name;

                $account = CoreDummyAccount::updateOrCreate(['account_id' => $data['account_id']], $data);
                foreach ($collaterals as $collateral) {
                    $account->collaterals()->updateOrCreate(['collateral_id' => $collateral['collateral_id']], $collateral);
                }
                $account->collaterals()->whereNotIn('collateral_id', array_column($collaterals, 'collateral_id'))->delete();
            }
        });

        $this->command?->info('Nasabah dummy siap: 200 rekening tambahan (20 per cabang 001–010) dan 10 rekening contoh lama.');
    }

    private function additionalAccounts(Branch $branch): array
    {
        $scenarios = [
            ['Budi Santoso', 'married', 150_000_000, ['Sertifikat Hak Milik']],
            ['Budi Santoso', 'married', 275_000_000, ['BPKB Kendaraan', 'Sertifikat Hak Milik']],
            ['Siti Rahmawati', 'married', 75_000_000, []],
            ['Andi Pratama', 'single', 125_000_000, ['Sertifikat Hak Milik']],
            ['Dewi Lestari', 'married', 210_000_000, ['BPKB Kendaraan', 'Sertifikat Hak Milik']],
            ['Rizky Maulana', 'single', 90_000_000, ['Deposito']],
            ['Maya Kusuma', 'married', 350_000_000, ['Sertifikat Hak Milik', 'Tanah dan Bangunan']],
            ['Fajar Hidayat', 'single', 60_000_000, ['BPKB Kendaraan']],
            ['Nadia Permata', 'married', 185_000_000, ['Sertifikat Hak Milik']],
            ['Bagus Setiawan', 'single', 420_000_000, ['Tanah dan Bangunan']],
            ['Agus Wibowo', 'married', 500_000_000, ['Sertifikat Hak Milik', 'BPKB Kendaraan', 'Deposito']],
            ['Rina Kartika', 'single', 25_000_000, []],
            ['Hendra Saputra', null, 135_000_000, ['BPKB Kendaraan']],
            ['Fitri Handayani', 'married', 300_000_000, ['Sertifikat Hak Milik', 'Deposito']],
            ['Joko Susilo', 'single', 800_000_000, ['Tanah dan Bangunan', 'BPKB Kendaraan', 'Deposito']],
            ['Nur Azizah', 'married', 1_000_000_000, ['Tanah dan Bangunan']],
            ['Slamet Riyadi', null, 45_000_000, []],
            ['Endang Setyowati', 'married', 650_000_000, ['Sertifikat Hak Milik', 'Sertifikat Hak Milik']],
            ['Arif Rahman', 'single', 2_000_000_000, ['Tanah dan Bangunan', 'Sertifikat Hak Milik', 'BPKB Kendaraan']],
            ['Budi Santoso', 'single', 95_000_000, ['BPKB Kendaraan']],
        ];

        $accounts = [];
        foreach ($scenarios as $index => [$name, $maritalStatus, $plafon, $collateralTypes]) {
            $sequence = $index + 1;
            $suffix = sprintf('%03d', $sequence);
            $customerSuffix = $sequence === 2 ? '001' : $suffix;
            $collaterals = [];
            foreach ($collateralTypes as $collateralIndex => $type) {
                $collateralId = sprintf('UAT-AGUNAN-%s-%s-%02d', $branch->code, $suffix, $collateralIndex + 1);
                $collaterals[] = [
                    'collateral_id' => $collateralId,
                    'type_name' => $type,
                    'description' => "SIMULASI UAT — {$type} / {$name} / {$branch->name} / {$collateralId}",
                ];
            }

            $accounts[] = [
                'account_id' => "UAT-ACCOUNT-{$branch->code}-{$suffix}",
                'account_number' => sprintf('%s990%06d', $branch->code, $sequence),
                'customer_id' => "UAT-CUSTOMER-{$branch->code}-{$customerSuffix}",
                'customer_name' => $name,
                'marital_status' => $maritalStatus,
                'plafon' => $plafon,
                'branch_code' => $branch->code,
                'branch_name' => $branch->name,
                'collaterals' => $collaterals,
            ];
        }

        return $accounts;
    }
}
