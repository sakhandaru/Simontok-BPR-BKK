<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('payment_scheme_options', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 100)->unique();
            $table->timestamps();
        });

        $now = now();
        $names = DB::table('orders')
            ->whereNotNull('skema_pembayaran')
            ->where('skema_pembayaran', '<>', '')
            ->distinct()
            ->pluck('skema_pembayaran')
            ->map(fn (string $name) => trim($name))
            ->filter()
            ->unique(fn (string $name) => mb_strtolower($name))
            ->values();

        $names = $names->concat(['Transfer penuh', 'Lainnya'])
            ->unique(fn (string $name) => mb_strtolower($name))
            ->values();

        DB::table('payment_scheme_options')->insert($names->map(fn (string $name) => [
            'name' => $name,
            'created_at' => $now,
            'updated_at' => $now,
        ])->all());
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_scheme_options');
    }
};
