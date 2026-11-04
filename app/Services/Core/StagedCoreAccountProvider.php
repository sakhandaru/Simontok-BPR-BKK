<?php

namespace App\Services\Core;

use App\Contracts\CoreAccountProvider;
use App\Models\CoreStagedAccount;

class StagedCoreAccountProvider implements CoreAccountProvider
{
    public function search(string $query, ?string $branchCode = null): array
    {
        $needle = mb_strtolower(trim($query));
        if (mb_strlen($needle) < 2) {
            return [];
        }

        return CoreStagedAccount::query()
            ->withCount('collaterals')
            ->where(fn ($builder) => $builder->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->when($branchCode, fn ($builder) => $builder->where('branch_code', $branchCode))
            ->where(fn ($builder) => $builder->where('customer_name', 'like', "%{$needle}%")->orWhere('account_number', 'like', "%{$needle}%"))
            ->orderBy('customer_name')->orderBy('account_number')->limit(20)->get()
            ->map(fn (CoreStagedAccount $account) => $this->summary($account))->all();
    }

    public function find(string $accountId, ?string $branchCode = null): ?array
    {
        $account = CoreStagedAccount::query()->with('collaterals')
            ->where(fn ($builder) => $builder->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->when($branchCode, fn ($builder) => $builder->where('branch_code', $branchCode))
            ->where('account_id', $accountId)->first();

        if (! $account) {
            return null;
        }

        return [
            ...$this->summary($account),
            'collaterals' => $account->collaterals->map(fn ($collateral) => [
                'collateral_id' => $collateral->collateral_id,
                'collateral_code' => $collateral->collateral_code,
                'type_code' => $collateral->type_code,
                'type_name' => $collateral->type_name,
                'description' => $collateral->description,
                'is_primary' => $collateral->is_primary,
                'status' => $collateral->status,
            ])->all(),
        ];
    }

    private function summary(CoreStagedAccount $account): array
    {
        return [
            'account_id' => $account->account_id,
            'account_number' => $account->account_number,
            'customer_id' => $account->customer_id,
            'customer_name' => $account->customer_name,
            'credit' => ['loan_amount' => $account->loan_amount, 'realization_date' => $account->realization_date?->format('Y-m-d')],
            'branch' => ['code' => $account->branch_code, 'name' => $account->branch_name],
            'collateral_count' => $account->collaterals_count ?? $account->collaterals()->count(),
        ];
    }
}
