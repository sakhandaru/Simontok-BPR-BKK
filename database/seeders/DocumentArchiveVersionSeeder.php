<?php

namespace Database\Seeders;

use App\Models\DocumentArchive;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class DocumentArchiveVersionSeeder extends Seeder
{
    public function run(): void
    {
        $source = DocumentArchive::query()
            ->where('category', 'dokumen_agunan')
            ->orderBy('id')
            ->first();

        if (! $source) {
            $this->command?->warn('Belum ada dokumen agunan yang bisa dijadikan contoh versi.');

            return;
        }

        $base = $source->only([
            'documentable_type', 'documentable_id', 'document_type', 'document_key', 'category',
            'title', 'original_name', 'storage_disk', 'file_path', 'file_size', 'file_hash', 'metadata',
        ]);
        $uploaderId = $source->uploaded_by;

        foreach ([1, 2, 3] as $version) {
            DocumentArchive::updateOrCreate(
                [
                    'documentable_type' => $source->documentable_type,
                    'documentable_id' => $source->documentable_id,
                    'document_type' => $source->document_type,
                    'document_key' => $source->document_key,
                    'version' => $version,
                ],
                [
                    ...$base,
                    'status' => $version === 3 ? 'active' : 'archived',
                    'uploaded_by' => $uploaderId,
                    'change_note' => "Seeder demo: versi {$version}.",
                    'archived_at' => $version === 3 ? null : Carbon::now()->subDays(4 - $version),
                    'created_at' => Carbon::now()->subDays(4 - $version),
                ],
            );
        }

        $this->command?->info("Seeder selesai: {$source->title} sekarang memiliki versi 1 sampai 3.");
    }
}
