<?php

namespace App\Services\Core;

use App\Contracts\CoreAccountProvider;
use App\Models\Branch;
use App\Models\Order;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class CoreOrderSnapshot
{
    public function __construct(private readonly CoreAccountProvider $provider) {}

    public function prepare(string $accountId, array $submitted, User $user, ?Order $order = null, ?string $accountNumber = null): array
    {
        $sameAccount = $order?->core_account_id === $accountId;
        if (! $sameAccount && $order && ($order->collaterals()->exists() || $order->documents()->exists())) {
            throw ValidationException::withMessages([
                'core_account_id' => 'Rekening tidak dapat diganti setelah pekerjaan atau dokumen agunan tersimpan. Buat draft baru untuk rekening lain.',
            ]);
        }

        $scope = $user->branchScopeId();
        $branchCode = $scope !== null ? Branch::whereKey($scope)->value('code') : null;
        if ($scope !== null && $branchCode === null) {
            abort(403);
        }

        // A saved order keeps its original snapshot even when the source changes.
        $account = $sameAccount && $order->core_snapshot
            ? $order->core_snapshot
            : $this->provider->find($accountId, $branchCode, $accountNumber);
        if ($account === null) {
            throw ValidationException::withMessages(['core_account_id' => 'Rekening tidak ditemukan atau berada di luar cabang Anda.']);
        }

        $branch = Branch::where('code', $account['branch']['code'])->where('is_active', true)->first();
        if (! $branch || ($scope !== null && $branch->id !== $scope)) {
            throw ValidationException::withMessages(['core_account_id' => 'Cabang rekening tidak tersedia atau berada di luar akses Anda.']);
        }

        $sourceCollaterals = collect($account['collaterals']);
        $sourceIds = $sourceCollaterals->pluck('collateral_id')->all();
        $saved = $order ? $order->collaterals()->get()->keyBy('agunan_id') : collect();
        $byId = [];
        foreach ($submitted as $item) {
            $sourceId = $item['agunan_id'] ?? null;
            if (! is_string($sourceId) || ! in_array($sourceId, $sourceIds, true) || isset($byId[$sourceId])) {
                throw ValidationException::withMessages(['core_account_id' => 'Daftar agunan tidak sesuai rekening terpilih. Muat ulang halaman dan pilih rekening kembali.']);
            }
            if (filled($item['id'] ?? null) && (string) ($saved->get($sourceId)?->id ?? '') !== (string) $item['id']) {
                throw ValidationException::withMessages(['core_account_id' => 'Agunan tidak sesuai dengan order ini.']);
            }
            $byId[$sourceId] = $item;
        }

        $collaterals = $sourceCollaterals->map(function (array $source) use ($byId, $saved): array {
            $id = $source['collateral_id'];
            $existing = $saved->get($id);
            $workflow = $byId[$id] ?? [
                'jobs' => $existing?->jobs->map(fn ($job) => [
                    'job_type_id' => $job->job_type_id,
                    'deskripsi_pekerjaan' => $job->deskripsi_pekerjaan,
                    'sla_days' => $job->sla_source === 'override' ? $job->sla_days : null,
                    'sla_override_reason' => $job->sla_override_reason,
                ])->all() ?? [],
            ];

            return [
                ...collect($workflow)->only(['jobs', 'job_type_id', 'deskripsi_pekerjaan', 'sla_days', 'sla_override_reason'])->all(),
                'id' => $existing?->id,
                'agunan_id' => $id,
                'nama_agunan' => $source['type_name'],
                'deskripsi_agunan' => $source['description'] ?? null,
            ];
        })->all();

        return [
            'core_account_id' => $accountId,
            'core_customer_id' => $account['customer_id'],
            'core_branch_code' => $account['branch']['code'],
            'core_snapshot' => $account,
            'core_synced_at' => $sameAccount && $order->core_synced_at ? $order->core_synced_at : now(),
            'branch_id' => $branch->id,
            'customer_name' => $account['customer_name'],
            'no_rekening' => $account['account_number'],
            'plafon' => $account['credit']['loan_amount'] ?? null,
            'collaterals' => $collaterals,
        ];
    }
}
