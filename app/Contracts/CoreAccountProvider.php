<?php

namespace App\Contracts;

interface CoreAccountProvider
{
    /**
     * @return array<int, array<string, mixed>>
     */
    public function search(string $query, ?string $branchCode = null): array;

    /**
     * @return array<string, mixed>|null
     */
    public function find(string $accountId, ?string $branchCode = null): ?array;
}
