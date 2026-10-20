<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Langkah proses per jenis pekerjaan (sumber: dokumen client "simontok nadhif.docx")
        // Dipakai order_progress.status sebagai nilai langkah yang dicatat per agunan.
        Schema::create('job_type_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('job_type_id')->constrained('job_types');
            $table->string('name');
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('job_type_steps');
    }
};
