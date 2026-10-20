<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('code', 30)->unique();   // legal_admin, notaris, kepala_cabang, it_admin, auditor
            $table->string('name');
            $table->string('description')->nullable();
            $table->timestamps();
        });

        // FR-CTL-05 & FR-AUD: permission granular per modul
        Schema::create('permissions', function (Blueprint $table) {
            $table->id();
            $table->string('code', 60)->unique();   // orders.create, orders.cancel, documents.validate, ...
            $table->string('name');
            $table->string('module', 30)->nullable();
            $table->timestamps();
        });

        Schema::create('role_permissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('role_id')->constrained('roles')->cascadeOnDelete();
            $table->foreignId('permission_id')->constrained('permissions')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['role_id', 'permission_id']);
        });

        // FR-AUTH-01: mapping job_position SSO -> role
        Schema::create('job_positions', function (Blueprint $table) {
            $table->id();
            $table->string('code', 50)->unique();   // job_position dari SSO
            $table->string('name');
            $table->foreignId('role_id')->nullable()->constrained('roles');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('job_positions');
        Schema::dropIfExists('role_permissions');
        Schema::dropIfExists('permissions');
        Schema::dropIfExists('roles');
    }
};
