<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // FR-AUD-01/02/04: jejak audit append-only (tanpa updated_at, tanpa UI edit/hapus)
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->string('actor_type', 20)->default('user')->index(); // user|notary|system
            $table->unsignedBigInteger('actor_id')->nullable()->index();
            $table->string('actor_name')->nullable();
            $table->string('role_code', 30)->nullable();
            $table->string('module', 30)->nullable()->index();
            $table->string('entity_type', 50)->nullable();        // Order, OrderDocument, ...
            $table->unsignedBigInteger('entity_id')->nullable()->index();
            $table->string('action', 50)->index();                // create|update|delete|login|logout|login_failed|approve|reject|...
            $table->text('description')->nullable();
            $table->string('route')->nullable();
            $table->string('method', 10)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->json('payload')->nullable();                  // detail before -> after
            $table->timestamp('created_at')->useCurrent()->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
