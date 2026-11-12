<?php

namespace App\Services\Core;

use App\Contracts\CoreAccountProvider;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpKernel\Exception\HttpException;

class RemoteCoreAccountProvider implements CoreAccountProvider
{
    public function search(string $query, ?string $branchCode = null, int $limit = 20): array
    {
        $query = trim($query);
        if (mb_strlen($query) < 3) {
            return [];
        }

        $response = $this->get('/api/v1/simontok/credit-accounts', array_filter([
            'query' => $query,
            'branch_code' => $branchCode,
            'limit' => min(max($limit, 1), 100),
        ], static fn ($value): bool => $value !== null && $value !== ''));

        return array_map(fn (array $account): array => $this->normalizeAccount($account), $this->dataList($response));
    }

    public function find(string $accountId, ?string $branchCode = null, ?string $accountNumber = null): ?array
    {
        $account = $this->dataObject($this->get('/api/v1/simontok/credit-accounts/'.rawurlencode($accountId)));

        if ($account === null) {
            return null;
        }

        if (($account['account_id'] ?? null) !== $accountId) {
            throw new HttpException(502, 'Identitas rekening dari API tidak sesuai permintaan.');
        }

        if ($accountNumber !== null
            && filled($account['account_number'] ?? null)
            && trim((string) $account['account_number']) !== trim($accountNumber)) {
            throw new HttpException(502, 'Nomor rekening dari API tidak sesuai hasil pencarian.');
        }

        if (! $this->hasIdentity($account)) {
            if ($accountNumber === null || trim($accountNumber) === '') {
                throw new HttpException(422, 'Cari dan pilih rekening kembali untuk memuat identitas nasabah.');
            }

            $accountNumber = trim($accountNumber);
            $summary = collect($this->search($accountNumber, $branchCode, 100))
                ->first(fn (array $candidate): bool => ($candidate['account_id'] ?? null) === $accountId
                    && ($candidate['account_number'] ?? null) === $accountNumber);

            if ($summary === null) {
                return null;
            }

            $account = [...$summary, ...$account];
        }

        if (! $this->hasIdentity($account)) {
            throw new HttpException(502, 'Identitas nasabah dari API belum lengkap.');
        }

        if (($branchCode !== null && data_get($account, 'branch.code') !== $branchCode)
            || ($account['selectable'] ?? true) === false) {
            return null;
        }

        return $this->normalizeAccount($account);
    }

    public function collaterals(string $accountId, ?string $branchCode = null, ?string $accountNumber = null): array
    {
        $account = $this->find($accountId, $branchCode, $accountNumber);
        if ($account === null) {
            return [];
        }

        $response = $this->get('/api/v1/simontok/credit-accounts/'.rawurlencode($accountId).'/collaterals');

        return $this->dataList($response);
    }

    public function branches(bool $active = true): array
    {
        $response = $this->get('/api/v1/simontok/branches', ['active' => $active ? 'true' : 'false'], false);

        return $this->dataList($response);
    }

    /** @param array<string, mixed> $query */
    private function get(string $path, array $query = [], bool $requiresToken = true): array
    {
        $token = null;
        if ($requiresToken) {
            $storedToken = session()->get(config('services.simontok_api.token_session_key'));
            if (! is_string($storedToken) || $storedToken === '') {
                throw new HttpException(401, 'Sesi API SIMONTOK tidak ditemukan. Silakan login kembali.');
            }

            try {
                $token = Crypt::decryptString($storedToken);
            } catch (DecryptException) {
                session()->forget(config('services.simontok_api.token_session_key'));
                throw new HttpException(401, 'Sesi API SIMONTOK tidak valid. Silakan login kembali.');
            }
        }

        try {
            $response = $this->client($token)->get($path, $query);
        } catch (ConnectionException) {
            throw new HttpException(503, 'Layanan API SIMONTOK sedang tidak dapat dihubungi.');
        }

        if ($response->status() === 401) {
            session()->forget(config('services.simontok_api.token_session_key'));
            throw new HttpException(401, 'Sesi API SIMONTOK sudah kedaluwarsa. Silakan login kembali.');
        }

        if ($response->status() === 403) {
            throw new HttpException(403, 'Akun Anda tidak memiliki akses ke data API SIMONTOK.');
        }

        if ($response->failed()) {
            throw new HttpException(502, 'API SIMONTOK mengembalikan respons yang tidak berhasil.');
        }

        return $response->json();
    }

    private function client(?string $token = null): PendingRequest
    {
        $request = Http::baseUrl(config('services.simontok_api.url'))
            ->acceptJson()
            ->withHeaders(array_filter([
                'X-App-Token' => config('services.simontok_api.app_token'),
                'App' => config('services.simontok_api.app'),
            ], static fn ($value): bool => is_string($value) && $value !== ''))
            ->withOptions(['verify' => config('services.simontok_api.verify_ssl', true)])
            ->timeout((int) config('services.simontok_api.timeout', 10));

        return $token ? $request->withToken($token) : $request;
    }

    /** @param array<string, mixed> $response */
    private function dataObject(array $response): ?array
    {
        $data = $response['data'] ?? null;

        return is_array($data) ? $data : null;
    }

    /** @param array<string, mixed> $account */
    private function hasIdentity(array $account): bool
    {
        return filled($account['account_number'] ?? null)
            && filled(data_get($account, 'customer.customer_id', $account['customer_id'] ?? null))
            && filled(data_get($account, 'customer.name', $account['customer_name'] ?? null))
            && filled(data_get($account, 'branch.code'));
    }

    /** @param array<string, mixed> $account */
    private function normalizeAccount(array $account): array
    {
        $customerId = data_get($account, 'customer.customer_id', $account['customer_id'] ?? null);
        $customerName = data_get($account, 'customer.name', $account['customer_name'] ?? null);
        $maritalStatus = $account['marital_status'] ?? data_get($account, 'customer.marital_status');

        return [
            ...$account,
            'customer_id' => $customerId,
            'customer_name' => $customerName,
            'customer_marital_status' => $maritalStatus,
            'customer' => [
                ...((array) ($account['customer'] ?? [])),
                'customer_id' => $customerId,
                'name' => $customerName,
                'marital_status' => $maritalStatus,
            ],
            'credit' => [
                ...((array) ($account['credit'] ?? [])),
                'loan_amount' => $account['plafond'] ?? data_get($account, 'credit.loan_amount'),
                'realization_date' => data_get($account, 'credit.realization_date'),
            ],
            'collaterals' => collect($account['collaterals'] ?? [])
                ->filter(fn ($collateral): bool => is_array($collateral))
                ->map(fn (array $collateral): array => [
                    ...$collateral,
                    'collateral_id' => $collateral['collateral_id'] ?? $collateral['collateral_code'] ?? null,
                    'type_name' => $collateral['type_name'] ?? $collateral['type_code'] ?? null,
                    'description' => $collateral['description'] ?? null,
                ])->values()->all(),
        ];
    }

    /** @param array<string, mixed> $response */
    private function dataList(array $response): array
    {
        $data = $response['data'] ?? [];

        return is_array($data) ? array_values($data) : [];
    }
}
