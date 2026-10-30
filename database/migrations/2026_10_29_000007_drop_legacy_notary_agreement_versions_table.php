<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('notary_agreement_versions');
    }

    public function down(): void
    {
        // The legacy table is intentionally not recreated. Its data was migrated to document_archives.
    }
};
