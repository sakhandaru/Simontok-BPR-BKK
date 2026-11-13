<?php

namespace App\Console\Commands;

use App\Models\TemporaryOrderDocument;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class CleanupTemporaryOrderDocuments extends Command
{
    protected $signature = 'simontok:cleanup-temporary-documents {--limit=500 : Maksimum file yang dibersihkan per eksekusi}';

    protected $description = 'Membersihkan dokumen order sementara yang sudah kedaluwarsa.';

    public function handle(): int
    {
        $deleted = 0;
        $limit = max(1, (int) $this->option('limit'));

        TemporaryOrderDocument::query()
            ->whereNull('promoted_at')
            ->where('expires_at', '<=', now())
            ->orderBy('id')
            ->limit($limit)
            ->get()
            ->each(function (TemporaryOrderDocument $document) use (&$deleted): void {
                Storage::disk('local')->delete($document->stored_path);
                $document->delete();
                $deleted++;
            });

        $this->info("Dokumen sementara kedaluwarsa dibersihkan: {$deleted}.");

        return self::SUCCESS;
    }
}
