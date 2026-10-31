<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->string('covernote_no')->nullable()->after('komitmen_penyelesaian');
            $table->date('covernote_start')->nullable()->after('covernote_no');
            $table->date('covernote_end')->nullable()->after('covernote_start');
            $table->string('covernote_file_path')->nullable()->after('covernote_end');
        });

        DB::table('orders')->orderBy('id')->each(function (object $order): void {
            $collateral = DB::table('order_collaterals')->where('order_id', $order->id)->orderBy('id')->first();
            if (! $collateral) {
                return;
            }
            DB::table('orders')->where('id', $order->id)->update([
                'covernote_no' => $collateral->covernote_no,
                'covernote_start' => $collateral->covernote_start,
                'covernote_end' => $collateral->covernote_end,
                'covernote_file_path' => $collateral->covernote_file_path,
            ]);
        });
    }

    public function down(): void
    {
        Schema::table('orders', fn (Blueprint $table) => $table->dropColumn([
            'covernote_no', 'covernote_start', 'covernote_end', 'covernote_file_path',
        ]));
    }
};
