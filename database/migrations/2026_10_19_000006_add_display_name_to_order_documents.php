<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_documents', function (Blueprint $table) {
            $table->string('display_name')->nullable()->after('document_type');
        });
    }

    public function down(): void
    {
        Schema::table('order_documents', function (Blueprint $table) {
            $table->dropColumn('display_name');
        });
    }
};
