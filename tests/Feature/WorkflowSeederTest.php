<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Enums\TrackBDocStatus;
use App\Enums\TrackDPaymentStatus;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkflowSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_full_seeder_registers_workflow_roles_and_statuses(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertNull(Role::where('code', 'keuangan')->first());
        $this->assertNotNull(Role::where('code', 'kadiv_operasional')->first());
        $this->assertNotNull(Permission::where('code', 'payments.verify')->first());
        $this->assertNotNull(Permission::where('code', 'payments.approve')->first());
        $this->assertNotNull(Permission::where('code', 'payments.pay')->first());
        $this->assertNotNull(Permission::where('code', 'documents.validate')->first());

        $statuses = Order::query()->pluck('status')->map(fn ($status) => $status->value)->unique();

        $this->assertTrue($statuses->contains('menunggu_approval'));
        $this->assertTrue($statuses->contains('perlu_perbaikan_order'));
        $this->assertTrue($statuses->contains('disetujui_kepala_cabang'));

        $it = User::where('email', 'admin')->firstOrFail();
        $it->role()->permissions()->detach();
        $this->assertTrue($it->fresh()->hasPermission('notary.portal'));
    }

    public function test_branch_manager_can_approve_pending_order(): void
    {
        $this->seed(DatabaseSeeder::class);

        $manager = User::where('email', 'pimpinan')->firstOrFail();
        $order = Order::where('order_no', 'DEMO-0003')->firstOrFail();

        $this->actingAs($manager)
            ->post(route('orders.approve', $order))
            ->assertRedirect();

        $this->assertSame('menunggu_verifikasi_notaris', $order->fresh()->status->value);
        $this->assertNotNull($order->fresh()->sent_to_notary_at);
    }

    public function test_only_one_branch_approver_can_approve_an_order(): void
    {
        $this->seed(DatabaseSeeder::class);

        $manager = User::where('email', 'pimpinan')->firstOrFail();
        $operational = User::where('email', 'kadiv')->firstOrFail();
        $order = Order::where('order_no', 'DEMO-0003')->firstOrFail();

        $this->actingAs($manager)
            ->post(route('orders.approve', $order))
            ->assertRedirect();

        $this->actingAs($operational)
            ->from(route('orders.show', $order))
            ->post(route('orders.approve', $order->fresh()))
            ->assertRedirect()
            ->assertSessionHas('error', 'Order sudah diproses oleh approver lain. Approval hanya dapat dilakukan satu kali.');

        $freshOrder = $order->fresh();
        $this->assertSame('menunggu_verifikasi_notaris', $freshOrder->status->value);
        $this->assertSame($manager->id, $freshOrder->checked_by);
        $this->assertSame(1, $freshOrder->statusHistories()->where('to_status', 'menunggu_verifikasi_notaris')->count());
    }

    public function test_handover_is_rejected_before_final_documents_are_validated(): void
    {
        $this->seed(DatabaseSeeder::class);

        $legal = User::where('email', 'legal')->firstOrFail();
        $order = Order::where('order_no', 'DEMO-0006')->firstOrFail();
        $collateral = $order->collaterals()->firstOrFail();

        $this->actingAs($legal)
            ->post(route('orders.handovers.store', $order), [
                'order_collateral_id' => $collateral->id,
                'receiver_name' => 'Admin Legal',
                'method' => 'kurir',
                'handed_over_at' => now()->toDateString(),
            ])
            ->assertStatus(422);
    }

    public function test_assigned_notary_can_accept_received_documents(): void
    {
        $this->seed(DatabaseSeeder::class);

        $notary = User::where('email', 'notaris')->firstOrFail();
        $order = Order::where('notary_id', $notary->notary_id)
            ->where('status', 'menunggu_verifikasi_notaris')
            ->firstOrFail();

        $this->actingAs($notary)
            ->post(route('notary.orders.accept-documents', $order))
            ->assertRedirect();

        $this->assertSame('menunggu_approval_covernote', $order->fresh()->status->value);
        $this->assertDatabaseHas('notifications', [
            'recipient_type' => 'user',
            'recipient_id' => $order->created_by,
            'title' => 'Dokumen awal diterima',
        ]);
    }

    public function test_assigned_notary_progress_starts_akta_stage(): void
    {
        $this->seed(DatabaseSeeder::class);

        $notary = User::where('email', 'notaris')->firstOrFail();
        $order = Order::where('status', 'dokumen_valid')->firstOrFail();
        $order->update(['notary_id' => $notary->notary_id]);
        $collateral = $order->collaterals()->with('jobType.steps')->firstOrFail();

        $this->actingAs($notary)
            ->post(route('notary.orders.progress.store', $order), [
                'order_collateral_id' => $collateral->id,
                'status' => $collateral->jobType->steps->first()->name,
                'catatan' => 'Proses pekerjaan dimulai.',
            ])
            ->assertRedirect();

        $this->assertSame('proses_akta', $order->fresh()->status->value);
    }

    public function test_legal_can_verify_then_branch_lead_can_approve_invoice(): void
    {
        $this->seed(DatabaseSeeder::class);

        $order = Order::where('status', 'dokumen_final_diunggah')->firstOrFail();
        $order->collaterals()->update(['doc_status' => TrackBDocStatus::FinalDivalidasi]);
        $order->update(['risk_flag' => false]);
        $paymentRequest = $order->paymentRequest()->updateOrCreate([], [
            'invoice_no' => 'INV-TEST-'.$order->id,
            'nominal' => $order->nominal,
            'status' => TrackDPaymentStatus::Diajukan,
            'requested_at' => now(),
        ]);

        $legal = User::where('email', 'legal')->firstOrFail();
        $manager = User::where('email', 'pimpinan')->firstOrFail();

        $this->actingAs($legal)
            ->post(route('orders.payment-requests.verify', [$order, $paymentRequest]), [
                'decision' => 'verify',
            ])
            ->assertRedirect();
        $this->assertSame('diverifikasi_admin', $paymentRequest->fresh()->status->value);

        $this->actingAs($manager)
            ->post(route('orders.payment-requests.approve', [$order, $paymentRequest]), [
                'decision' => 'approve',
            ])
            ->assertRedirect();
        $this->assertSame('disetujui', $paymentRequest->fresh()->status->value);
    }

    public function test_legal_can_record_payment_after_handover_and_close_order(): void
    {
        $this->seed(DatabaseSeeder::class);

        $order = Order::where('status', 'dokumen_fisik_diterima')->firstOrFail();
        $paymentRequest = $order->paymentRequest()->where('status', 'disetujui')->firstOrFail();
        $legal = User::where('email', 'legal')->firstOrFail();

        $this->actingAs($legal)
            ->post(route('orders.payment-requests.pay', [$order, $paymentRequest]), [
                'paid_at' => now()->toDateString(),
                'nominal' => $paymentRequest->nominal,
                'catatan' => 'Pembayaran selesai.',
            ])
            ->assertRedirect();

        $this->assertSame('dibayar', $paymentRequest->fresh()->status->value);
        $this->assertSame('dokumen_fisik_diterima', $order->fresh()->status->value);

    }

    public function test_assigned_notary_can_extend_an_existing_covernote(): void
    {
        $this->seed(DatabaseSeeder::class);

        $notary = User::where('email', 'notaris')->firstOrFail();
        $order = Order::where('sent_to_notary_at', '!=', null)
            ->whereHas('collaterals', fn ($query) => $query->whereNotNull('covernote_end'))
            ->firstOrFail();
        $order->update(['notary_id' => $notary->notary_id]);
        $collateral = $order->collaterals()->whereNotNull('covernote_end')->firstOrFail();
        $newEnd = $collateral->covernote_end->copy()->addDays(30)->toDateString();

        $this->actingAs($notary)
            ->post(route('notary.orders.collaterals.covernote-extensions.store', [$order, $collateral]), [
                'new_end' => $newEnd,
                'catatan' => 'Perpanjangan untuk menjaga covernote tetap aktif.',
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('covernote_extensions', [
            'order_collateral_id' => $collateral->id,
            'new_end' => $newEnd.' 00:00:00',
            'status' => 'menunggu_approval',
        ]);
        $this->assertSame(
            $collateral->covernote_end->toDateString(),
            $collateral->fresh()->covernote_end->toDateString(),
        );
    }
}
