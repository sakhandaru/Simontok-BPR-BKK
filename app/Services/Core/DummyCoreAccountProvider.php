<?php

namespace App\Services\Core;

use App\Contracts\CoreAccountProvider;
use App\Models\CoreDummyAccount;

class DummyCoreAccountProvider implements CoreAccountProvider
{
    public function search(string $query, ?string $branchCode = null): array
    {
        $needle = mb_strtolower(trim($query));

        if (mb_strlen($needle) < 2) {
            return [];
        }

        return CoreDummyAccount::query()
            ->withCount('collaterals')
            ->when($branchCode, fn ($query) => $query->where('branch_code', $branchCode))
            ->where(fn ($query) => $query
                ->where('customer_name', 'like', "%{$needle}%")
                ->orWhere('account_number', 'like', "%{$needle}%"))
            ->orderBy('customer_name')
            ->orderBy('account_number')
            ->limit(20)
            ->get()
            ->map(fn (CoreDummyAccount $account) => [
                'account_id' => $account->account_id,
                'account_number' => $account->account_number,
                'customer_id' => $account->customer_id,
                'customer_name' => $account->customer_name,
                'credit' => ['loan_amount' => $account->plafon],
                'branch' => ['code' => $account->branch_code, 'name' => $account->branch_name],
                'collateral_count' => $account->collaterals_count,
            ])
            ->all();
    }

    public function find(string $accountId, ?string $branchCode = null): ?array
    {
        $account = CoreDummyAccount::query()
            ->with(['collaterals' => fn ($query) => $query->orderBy('collateral_id')])
            ->when($branchCode, fn ($query) => $query->where('branch_code', $branchCode))
            ->where('account_id', $accountId)
            ->first();

        return $account ? [
            'account_id' => $account->account_id,
            'account_number' => $account->account_number,
            'customer_id' => $account->customer_id,
            'customer_name' => $account->customer_name,
            'credit' => ['loan_amount' => $account->plafon],
            'branch' => ['code' => $account->branch_code, 'name' => $account->branch_name],
            'collaterals' => $account->collaterals->map(fn ($collateral) => [
                'collateral_id' => $collateral->collateral_id,
                'type_name' => $collateral->type_name,
                'description' => $collateral->description,
            ])->all(),
        ] : null;
    }
}
