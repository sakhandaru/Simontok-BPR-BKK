<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_checklists', function (Blueprint $table): void {
            $table->boolean('is_required')->default(true)->after('is_active');
        });

        DB::table('document_checklists')
            ->whereNull('job_type_id')
            ->whereIn('name', [
                'Surat nikah',
                'Bukti lunas PBB',
                'NPWP',
                'Dokumen persetujuan pasangan',
                'KTP pasangan',
                'NIB',
                'Dokumen pendukung lain',
            ])
            ->update(['is_required' => false]);

        DB::table('document_checklists')
            ->whereNull('job_type_id')
            ->where('name', 'Dokumen persetujuan pasangan')
            ->update(['name' => 'KTP pasangan']);

        DB::table('document_checklists')->updateOrInsert(
            ['name' => 'NIB', 'job_type_id' => null],
            ['is_active' => true, 'is_required' => false, 'created_at' => now(), 'updated_at' => now()],
        );

        DB::table('document_checklists')
            ->whereNull('job_type_id')
            ->where('name', 'Bukti lunas PBB')
            ->update(['is_active' => false, 'is_required' => false]);
    }

    public function down(): void
    {
        Schema::table('document_checklists', function (Blueprint $table): void {
            $table->dropColumn('is_required');
        });
    }
};
