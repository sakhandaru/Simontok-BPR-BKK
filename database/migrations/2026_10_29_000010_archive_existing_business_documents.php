<?php

use App\Models\Order;
use App\Models\OrderCollateral;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

return new class extends Migration
{
    public function up(): void
    {
        $disk = Storage::disk('local');
        $archive = function (string $type, string $key, string $category, string $title, string $documentableType, int $documentableId, string $path, ?int $size, ?int $uploadedBy, array $metadata) use ($disk): void {
            if (DB::table('document_archives')->where('file_path', $path)->exists()) {
                return;
            }
            $version = ((int) DB::table('document_archives')->where(['documentable_type' => $documentableType, 'documentable_id' => $documentableId, 'document_type' => $type, 'document_key' => $key])->max('version')) + 1;
            $absolutePath = $disk->path($path);
            DB::table('document_archives')->insert([
                'documentable_type' => $documentableType,
                'documentable_id' => $documentableId,
                'document_type' => $type,
                'document_key' => $key,
                'category' => $category,
                'version' => $version,
                'title' => $title,
                'original_name' => basename($path),
                'storage_disk' => 'local',
                'file_path' => $path,
                'file_size' => $size,
                'file_hash' => is_file($absolutePath) ? hash_file('sha256', $absolutePath) : null,
                'status' => 'active',
                'metadata' => json_encode($metadata),
                'uploaded_by' => $uploadedBy,
                'change_note' => 'Migrasi dokumen bisnis yang sudah tersimpan.',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        };

        DB::table('order_collaterals')->whereNotNull('covernote_file_path')->orderBy('id')->each(function (object $collateral) use ($archive, $disk): void {
            $archive('covernote', 'covernote', 'covernote', 'Covernote', OrderCollateral::class, $collateral->id, $collateral->covernote_file_path, $disk->exists($collateral->covernote_file_path) ? $disk->size($collateral->covernote_file_path) : null, null, ['order_id' => $collateral->order_id, 'collateral_id' => $collateral->id]);
        });
        DB::table('covernote_extensions')->whereNotNull('file_path')->orderBy('id')->each(function (object $extension) use ($archive, $disk): void {
            $archive('covernote', 'covernote', 'covernote', 'Covernote perpanjangan', OrderCollateral::class, $extension->order_collateral_id, $extension->file_path, $disk->exists($extension->file_path) ? $disk->size($extension->file_path) : null, $extension->extended_by, ['extension_id' => $extension->id, 'new_end' => $extension->new_end]);
        });
        DB::table('order_handovers')->whereNotNull('receipt_path')->orderBy('id')->each(function (object $handover) use ($archive, $disk): void {
            $archive('handover_receipt', 'handover_'.$handover->id, 'serah_terima', 'Tanda terima dokumen', OrderCollateral::class, $handover->order_collateral_id, $handover->receipt_path, $disk->exists($handover->receipt_path) ? $disk->size($handover->receipt_path) : null, $handover->maker_id, ['order_id' => $handover->order_id, 'handover_id' => $handover->id]);
        });
        DB::table('payments')->whereNotNull('bukti_path')->orderBy('id')->each(function (object $payment) use ($archive, $disk): void {
            $archive('payment_proof', 'payment_'.$payment->id, 'bukti_pembayaran', 'Bukti pembayaran', Order::class, $payment->order_id, $payment->bukti_path, $disk->exists($payment->bukti_path) ? $disk->size($payment->bukti_path) : null, $payment->uploaded_by, ['payment_id' => $payment->id, 'payment_request_id' => $payment->payment_request_id]);
        });
        // Keep this migration portable: the test suite uses SQLite, while production uses MariaDB.
        DB::table('document_archives')
            ->where('category', 'dokumen_agunan')
            ->orderBy('id')
            ->get()
            ->each(function (object $archive): void {
                $metadata = json_decode((string) $archive->metadata, true) ?: [];

                if (($metadata['order_document_type'] ?? null) === 'final') {
                    DB::table('document_archives')->where('id', $archive->id)->update(['category' => 'hasil_pekerjaan']);
                }
            });
    }

    public function down(): void
    {
        DB::table('document_archives')->whereIn('category', ['covernote', 'serah_terima', 'bukti_pembayaran'])->delete();
    }
};
