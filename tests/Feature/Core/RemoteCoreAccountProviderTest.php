<?php

namespace Tests\Feature\Core;

use App\Services\Core\RemoteCoreAccountProvider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class RemoteCoreAccountProviderTest extends TestCase
{
    use RefreshDatabase;

    public function test_remote_provider_sends_required_headers_and_search_parameters(): void
    {
        session(['simontok_api.jwt' => Crypt::encryptString('user-jwt')]);
        config([
            'services.simontok_api.url' => 'https://api.test',
            'services.simontok_api.app' => 'simontok',
            'services.simontok_api.app_token' => 'app-token',
        ]);
        Http::fake([
            'https://api.test/api/v1/simontok/credit-accounts*' => Http::response([
                'status' => 200,
                'data' => [['account_id' => 'account-1']],
            ]),
        ]);

        $result = (new RemoteCoreAccountProvider)->search('001135000003', '001', 30);

        $this->assertSame('account-1', $result[0]['account_id']);
        Http::assertSent(fn ($request) => $request->url() === 'https://api.test/api/v1/simontok/credit-accounts?query=001135000003&branch_code=001&limit=30'
            && $request->hasHeader('X-App-Token', 'app-token')
            && $request->hasHeader('App', 'simontok')
            && $request->hasHeader('Authorization', 'Bearer user-jwt'));
    }

    public function test_remote_provider_clears_expired_token(): void
    {
        session(['simontok_api.jwt' => Crypt::encryptString('expired-jwt')]);
        config(['services.simontok_api.url' => 'https://api.test']);
        Http::fake([
            'https://api.test/*' => Http::response(['message' => 'expired'], 401),
        ]);

        try {
            (new RemoteCoreAccountProvider)->search('suyanto');
            $this->fail('Expected the remote provider to reject an expired token.');
        } catch (HttpException $exception) {
            $this->assertSame(401, $exception->getStatusCode());
        }

        $this->assertNull(session('simontok_api.jwt'));
    }
}
