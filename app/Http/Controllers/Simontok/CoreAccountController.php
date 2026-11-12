<?php

namespace App\Http\Controllers\Simontok;

use App\Contracts\CoreAccountProvider;
use App\Http\Controllers\Controller;
use App\Models\Branch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CoreAccountController extends Controller
{
    public function __construct(private readonly CoreAccountProvider $provider) {}

    public function search(Request $request): JsonResponse
    {
        $data = $request->validate([
            'query' => ['required', 'string', 'min:3', 'max:100'],
            'branch_code' => ['nullable', 'string', 'max:10'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        return response()->json([
            'data' => $this->provider->search($data['query'], $this->branchCode($request, $data['branch_code'] ?? null), (int) ($data['limit'] ?? 20)),
            'provider' => config('core.provider'),
        ]);
    }

    public function show(Request $request, string $accountId): JsonResponse
    {
        $data = $request->validate(['account_number' => ['nullable', 'string', 'min:3', 'max:30']]);
        $account = $this->provider->find($accountId, $this->branchCode($request), $data['account_number'] ?? null);

        abort_unless($account !== null, 404, 'Rekening tidak ditemukan.');

        return response()->json([
            'data' => $account,
            'provider' => config('core.provider'),
        ]);
    }

    public function collaterals(Request $request, string $accountId): JsonResponse
    {
        $data = $request->validate(['account_number' => ['nullable', 'string', 'min:3', 'max:30']]);

        return response()->json([
            'data' => $this->provider->collaterals($accountId, $this->branchCode($request), $data['account_number'] ?? null),
            'provider' => config('core.provider'),
        ]);
    }

    public function branches(Request $request): JsonResponse
    {
        $active = $request->boolean('active', true);

        return response()->json([
            'data' => $this->provider->branches($active),
            'provider' => config('core.provider'),
        ]);
    }

    private function branchCode(Request $request, ?string $requestedCode = null): ?string
    {
        $branchId = $request->user()->branchScopeId();

        if ($branchId === null) {
            return $requestedCode;
        }
        $code = Branch::whereKey($branchId)->where('is_active', true)->value('code');
        abort_if($code === null, 403);

        abort_if($requestedCode !== null && $requestedCode !== $code, 403);

        return $code;
    }
}
