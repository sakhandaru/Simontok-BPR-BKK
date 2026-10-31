<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('collateral_types', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 255)->unique();
            $table->timestamps();
        });

        $now = now();
        DB::table('collateral_types')->insert(array_map(
            fn (string $name) => ['name' => $name, 'created_at' => $now, 'updated_at' => $now],
            ['Tanah', 'Bangunan', 'Tanah dan bangunan', 'Kendaraan', 'Deposito', 'Persediaan', 'Mesin dan peralatan', 'Lainnya'],
        ));
    }

    public function down(): void
    {
        Schema::dropIfExists('collateral_types');
    }
};
