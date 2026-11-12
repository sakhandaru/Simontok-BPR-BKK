<?php

namespace App\Contracts;

interface CoreAccountProvider
{
    /**
     * @return array<int, array<string, mixed>>
     */
    public function search(string $query, ?string $branchCode = null, int $limit = 20): array;

    /**
     * @return array<string, mixed>|null
     */
    public function find(string $accountId, ?string $branchCode = null, ?string $accountNumber = null): ?array;

    /**
     * @return array<int, array<string, mixed>>
     */
    public function collaterals(string $accountId, ?string $branchCode = null, ?string $accountNumber = null): array;

    /**
     * @return array<int, array<string, mixed>>
     */
    public function branches(bool $active = true): array;
}
