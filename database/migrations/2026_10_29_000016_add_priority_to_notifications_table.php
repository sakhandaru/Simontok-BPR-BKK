<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table): void {
            if (! Schema::hasColumn('notifications', 'priority')) {
                $table->string('priority', 20)->default('normal')->after('link_url');
            }
            $table->index(['recipient_type', 'recipient_id', 'is_read', 'created_at'], 'notif_recipient_read_created_idx');
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table): void {
            $table->dropIndex('notif_recipient_read_created_idx');
            if (Schema::hasColumn('notifications', 'priority')) {
                $table->dropColumn('priority');
            }
        });
    }
};
