# Arsip Data Lama SIMONTOK

Command `legacy:archive-import` menyalin record dari dump pilihan ke arsip database baru tanpa memetakan atau mengubah data operasional.

## Tujuan

- Mempertahankan seluruh baris dan kolom sumber dalam payload JSON.
- Menyimpan nama tabel sumber, urutan baris, dan ID lama bila tersedia.
- Membuat proses idempoten berdasarkan SHA-256 dump, agar dump yang sama tidak digandakan.
- Tidak membuat atau mengubah order operasional, notaris, agunan, pembayaran, maupun status baru.

## Pemakaian

1. Pastikan file pilihan tersedia di `data_simontok_yang_dipindah.sql`.
2. Jalankan `php artisan migrate` pada database target.
3. Periksa jumlah record tanpa menulis data:

   ```sh
   php artisan legacy:archive-import --dry-run
   ```

4. Setelah hitungan sesuai, jalankan arsip:

   ```sh
   php artisan legacy:archive-import
   ```

Dump lain dapat diberikan lewat `--path=/path/ke/dump.sql`. File default ini berisi dataset terpilih, bukan dump lengkap aplikasi lama.

## Penyimpanan

- `legacy_import_batches`: hash dump, status, waktu, dan jumlah baris per tabel.
- `legacy_import_records`: satu baris per record sumber. `payload` mempertahankan pasangan kolom-nilai sumber, termasuk nilai kosong dan string tanggal lama.
- `legacy_master_links`: tabel kosong untuk mencatat pasangan ID sumber ke master baru setelah pemetaan disetujui.

Tahap saat ini hanya mengarsipkan sumber mentah. Pemetaan ke master dan tabel operasional dilakukan setelah sumber cabang/pegawai tersedia dan aturan relasi dikonfirmasi. Order, agunan, checklist per order, perpanjangan, dan status operasional belum diimpor.

Dump memuat data nasabah dan kredensial lama. File dump masuk `.gitignore`; batasi akses file, database, backup, dan hasil query arsip sesuai kebutuhan kerja.
