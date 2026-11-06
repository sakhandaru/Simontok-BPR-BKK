<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\CoreDummyAccount;
use Illuminate\Database\Seeder;
use RuntimeException;

class DemakUatAccountSeeder extends Seeder
{
    public function run(): void
    {
        if (config('core.provider') !== 'dummy') {
            throw new RuntimeException('Seeder nasabah UAT Demak hanya dapat dijalankan saat CORE_PROVIDER=dummy.');
        }

        $branch = Branch::query()->where('code', '002')->first();
        if (! $branch) {
            throw new RuntimeException('Cabang dengan kode 002 belum tersedia.');
        }

        $accounts = [
            ['01', 'Budi Santoso', 'married', 150_000_000, 'Sertifikat Hak Milik', 'SHM Demak UAT 001'],
            ['02', 'Siti Rahmawati', 'married', 85_000_000, 'BPKB Kendaraan', 'BPKB Demak UAT 002'],
            ['03', 'Andi Pratama', 'single', 225_000_000, 'Tanah dan Bangunan', 'Rumah tinggal Demak UAT 003'],
            ['04', 'Dewi Lestari', 'married', 120_000_000, 'Sertifikat Hak Milik', 'SHM Demak UAT 004'],
            ['05', 'Rizky Maulana', 'single', 65_000_000, 'Deposito', 'Bilyet deposito Demak UAT 005'],
        ];

        foreach ($accounts as [$suffix, $name, $maritalStatus, $plafon, $collateralType, $collateralDescription]) {
            $account = CoreDummyAccount::updateOrCreate(
                ['account_id' => "DEMAK-UAT-ACCOUNT-{$suffix}"],
                [
                    'account_number' => "0029000000{$suffix}",
                    'customer_id' => "DEMAK-UAT-CUSTOMER-{$suffix}",
                    'customer_name' => $name,
                    'marital_status' => $maritalStatus,
                    'plafon' => $plafon,
                    'branch_code' => '002',
                    'branch_name' => $branch->name,
                ],
            );

            $account->collaterals()->delete();
            $account->collaterals()->create([
                'collateral_id' => "DEMAK-UAT-AGUNAN-{$suffix}",
                'type_name' => $collateralType,
                'description' => $collateralDescription,
            ]);
        }

        $this->command?->info('5 nasabah UAT Demak berhasil disiapkan pada cabang 002.');
    }
}
