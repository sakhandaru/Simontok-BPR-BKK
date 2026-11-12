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

    public function test_remote_provider_combines_search_identity_with_detail_collaterals(): void
    {
        session(['simontok_api.jwt' => Crypt::encryptString('user-jwt')]);
        config([
            'services.simontok_api.url' => 'https://api.test',
            'services.simontok_api.app' => 'nora',
            'services.simontok_api.app_token' => 'app-token',
        ]);
        Http::fake([
            'https://api.test/api/v1/simontok/credit-accounts?query=001135000004*' => Http::response([
                'status' => 200,
                'data' => [[
                    'account_id' => 'account-4',
                    'account_number' => '001135000004',
                    'customer_id' => '001303947',
                    'customer_name' => 'ARIEF LUKMAN',
                    'marital_status' => 'married',
                    'collateral_count' => 5,
                    'plafond' => '200000000.00',
                    'branch' => ['code' => '001', 'name' => 'Kc. Utama', 'is_active' => true],
                    'selectable' => true,
                ]],
            ]),
            'https://api.test/api/v1/simontok/credit-accounts/account-4' => Http::response([
                'status' => 200,
                'data' => [
                    'account_id' => 'account-4',
                    'account_number' => '001135000004',
                    'collateral_count' => 5,
                    'collaterals' => [[
                        'collateral_id' => '0010002582',
                        'collateral_code' => '0010002582',
                        'type_code' => 'TANAH_DAN_BANGUNAN',
                        'type_name' => 'Tanah dan Bangunan',
                        'description' => 'SERTIFIKAT SHM NO 11',
                        'legal_reference' => 'Tanah - APHT',
                        'value' => '0.00',
                        'account_id' => 'account-4',
                    ]],
                ],
            ]),
        ]);

        $account = (new RemoteCoreAccountProvider)->find('account-4', '001', '001135000004');

        $this->assertSame('ARIEF LUKMAN', $account['customer_name']);
        $this->assertSame('married', $account['customer']['marital_status']);
        $this->assertSame('200000000.00', $account['credit']['loan_amount']);
        $this->assertSame(5, $account['collateral_count']);
        $this->assertCount(1, $account['collaterals']);
        Http::assertSentCount(2);
    }
}
