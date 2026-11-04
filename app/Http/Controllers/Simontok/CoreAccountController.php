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
            'query' => ['required', 'string', 'min:2', 'max:100'],
        ]);

        return response()->json([
            'data' => $this->provider->search($data['query'], $this->branchCode($request)),
            'provider' => config('core.provider'),
        ]);
    }

    public function show(Request $request, string $accountId): JsonResponse
    {
        $account = $this->provider->find($accountId, $this->branchCode($request));

        abort_unless($account !== null, 404, 'Rekening tidak ditemukan.');

        return response()->json([
            'data' => $account,
            'provider' => config('core.provider'),
        ]);
    }

    private function branchCode(Request $request): ?string
    {
        $branchId = $request->user()->branchScopeId();

        if ($branchId === null) {
            return null;
        }
        $code = Branch::whereKey($branchId)->where('is_active', true)->value('code');
        abort_if($code === null, 403);

        return $code;
    }
}
