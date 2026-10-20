<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // FR-MST-01: master notaris/PPAT rekanan (migrasi dari tabel_notaris; TANPA username/password legacy)
        Schema::create('notaries', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('address')->nullable();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('sk_notary')->nullable();      // SK notaris
            $table->string('sk_ppat')->nullable();        // SK PPAT
            $table->string('pks_no')->nullable();         // nomor PKS dengan BPR
            $table->date('pks_start')->nullable();
            $table->date('pks_end')->nullable();
            $table->boolean('is_active')->default(true);
            $table->string('legacy_id', 20)->nullable()->index();  // id_notaris lama
            $table->timestamps();
            $table->softDeletes();
        });

        // FR-ORD-01: notaris rekanan per cabang (many-to-many)
        Schema::create('branch_notary', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('notary_id')->constrained('notaries')->cascadeOnDelete();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['branch_id', 'notary_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('branch_notary');
        Schema::dropIfExists('notaries');
    }
};
