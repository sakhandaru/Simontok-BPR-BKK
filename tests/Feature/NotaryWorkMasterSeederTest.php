<?php

namespace Tests\Feature;

use App\Models\DocumentChecklist;
use App\Models\JobType;
use Database\Seeders\NotaryWorkMasterSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NotaryWorkMasterSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_notary_work_master_seeder_replaces_active_work_types_and_maps_required_documents(): void
    {
        $this->seed(NotaryWorkMasterSeeder::class);

        $this->assertSame([
            'APHT', 'BALIK_NAMA', 'CESSIE', 'FIDUSIA', 'GADAI', 'HIBAH',
            'KUASA_PAKAI', 'PECAH_BIDANG', 'PENINGKATAN_HAK', 'PENSERTIFIKATAN',
            'SKMHT', 'TURUN_WARIS',
        ], JobType::where('is_active', true)->orderBy('code')->pluck('code')->all());

        $fidusia = JobType::with('documents')->where('code', 'FIDUSIA')->firstOrFail();
        $this->assertSame(3, $fidusia->slaPolicies()->whereNull('branch_id')->value('days'));
        $this->assertCount(5, $fidusia->documents->where('pivot.is_required', true));
        $this->assertCount(5, $fidusia->documents->where('pivot.is_required', false));
        $this->assertTrue(DocumentChecklist::where('name', 'BPKB')->where('is_active', true)->exists());

        $apht = JobType::with('documents')->where('code', 'APHT')->firstOrFail();
        $this->assertCount(5, $apht->documents->where('pivot.is_required', true));
        $this->assertCount(8, $apht->documents->where('pivot.is_required', false));
    }
}
