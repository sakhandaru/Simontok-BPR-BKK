# Panduan mengulang UAT SIMONTOK

Gunakan panduan ini untuk memulai ulang pengujian di server UAT: order dan akun pengguna uji dibersihkan, satu akun IT darurat dipertahankan, dan master tetap siap digunakan.

Panduan ini memakai data nasabah dummy lokal dengan `CORE_PROVIDER=dummy`. Data uji ini tidak dimasukkan ke database API BU Core.

## Hasil reset

| Data | Hasil |
|---|---|
| Akun IT darurat | Tetap ada, password tetap. |
| Akun pengguna lainnya, termasuk portal notaris | Dihapus. |
| Order, progres, checklist, dokumen order, covernote, dan pembayaran | Record transaksi dihapus. |
| Notifikasi | Dihapus. |
| Role dan hak akses | Dipertahankan. |
| Master cabang, notaris, relasi cabang–notaris, pekerjaan, dan SLA | Dipertahankan. |
| Nasabah/rekening/agunan dummy | Diisi atau diperbarui oleh `CoreAccountSeeder`. |
| Audit log dan file upload fisik | Tetap tersimpan. |

Reset ini menghapus transaksi UAT sebelumnya. Data yang dihapus hanya dapat dipulihkan dari backup. Ini bukan pengosongan seluruh database.

## Persiapan

Deploy kode terbaru terlebih dahulu, termasuk `ProductionUsersAndOrdersResetSeeder.php` dan `CoreAccountSeeder.php`. Database harus sudah memiliki tabel aplikasi, master, dan akun IT darurat aktif dengan role `it_admin`.

Pastikan konfigurasi berikut pada `.env` server UAT:

```env
APP_ENV=staging
APP_DEBUG=false
UAT_MODE=true
UAT_EMERGENCY_ONLY=true
SEED_DEMO_DATA=false
CORE_PROVIDER=dummy
CORE_READ_MODEL=staging
CORE_STAGING_TTL_MINUTES=60
```

`SSO_EMERGENCY_LOGIN` harus sama dengan ID login akun IT darurat yang ingin dipertahankan. Reset akan dibatalkan jika akun tersebut tidak ditemukan, nonaktif, atau bukan `it_admin`. Password akun yang sudah ada tidak diubah; tidak perlu mengubah `EMERGENCY_ACCOUNT_PASSWORD` untuk reset ini.

## Perintah reset sebelum UAT

Jalankan sebelum pengguna mulai menguji. Masuk ke direktori project:

```bash
cd /www/wwwroot/simontokdev.bkkjateng.co.id
```

Jalankan perintah berikut satu per satu. Jika ada yang gagal, hentikan urutan dan periksa error sebelum melanjutkan.

```bash
php artisan config:clear

PRODUCTION_RESET_CONFIRM=DELETE_USERS_AND_ORDERS PRODUCTION_RESET_DRY_RUN=false php artisan db:seed --class=ProductionUsersAndOrdersResetSeeder --force

php artisan db:seed --class=CoreAccountSeeder --force
php artisan core:sync-staging

php artisan config:cache
```

Nilai `PRODUCTION_RESET_CONFIRM` dan `PRODUCTION_RESET_DRY_RUN` pada baris di atas hanya berlaku untuk perintah tersebut; tidak perlu disimpan di `.env`.

Tidak perlu menjalankan `migrate:fresh`, `StandardUatDataSeeder`, atau seeder global untuk pengulangan ini. `StandardUatDataSeeder` juga mereset master, sedangkan prosedur di atas mempertahankan master yang sudah disiapkan.

## Memeriksa hasil

Login menggunakan akun IT darurat dengan password yang sama. Daftar order harus kosong dan daftar pengguna hanya berisi akun IT darurat.

Jika memeriksa melalui database, jalankan query baca berikut:

```sql
SELECT COUNT(*) AS jumlah_user FROM users;
SELECT COUNT(*) AS jumlah_order FROM orders;
SELECT COUNT(*) AS jumlah_pembayaran FROM payments;
SELECT branch_code, COUNT(*) AS jumlah_rekening_dummy
FROM core_dummy_accounts
GROUP BY branch_code
ORDER BY branch_code;
```

Hasil yang diharapkan: `jumlah_user = 1`, `jumlah_order = 0`, dan `jumlah_pembayaran = 0`. Paket dummy menyediakan 30 rekening pada cabang `001` (20 tambahan dan 10 contoh lama), serta 20 rekening pada masing-masing cabang `002`–`010`. Jumlah bisa lebih besar jika ada data uji tambahan sebelumnya; `CoreAccountSeeder` tidak menghapus rekening di luar paketnya.

## Mencoba pencarian nasabah

| Cabang | Kata pencarian | Contoh nomor rekening |
|---|---|---|
| `001` | `001990` | `001990000001` |
| `002` | `002990` | `002990000001` |
| `010` | `010990` | `010990000001` |

Pola cabang lainnya sama: kode cabang diikuti `990`, lalu nomor urut enam digit `000001`–`000020`. Bisa juga mencari berdasarkan nama, misalnya `Budi`.

Variasi data meliputi nasabah dengan beberapa rekening, nasabah berbeda dengan nama sama, status menikah/belum menikah/belum diketahui, plafon Rp25 juta–Rp2 miliar, dan 0–3 agunan. Rekening tanpa agunan disediakan untuk menguji validasi kelengkapan order.

Untuk membuat order, cabang harus aktif dan memiliki notaris rekanan yang memenuhi syarat aplikasi. Seeder nasabah mengikuti nama master cabang yang sudah ada dan menambahkan cabang yang belum tersedia; seeder ini tidak mengaktifkan kembali cabang nonaktif atau mengatur relasi notaris. Akun portal notaris tidak tersedia setelah reset; pengujian sebagai notaris membutuhkan akun portal yang disiapkan tersendiri.

## Jika nasabah tidak muncul setelah beberapa waktu

Data staging memiliki masa berlaku. Perintah `core:sync-staging` saat ini memakai default `--ttl=60` menit, dan sinkronisasi terjadwal setiap jam di `routes/console.php`. Scheduler Laravel harus berjalan di server agar jadwal tersebut dieksekusi.

Untuk memperbarui data tanpa mereset order atau pengguna:

```bash
php artisan core:sync-staging
```

Jika scheduler belum aktif dan memerlukan data dummy untuk satu hari pengujian, gunakan:

```bash
php artisan core:sync-staging --ttl=1440
```

Opsi `--ttl` menentukan masa berlaku pada command saat ini; mengubah `CORE_STAGING_TTL_MINUTES` saja belum mengubah default command tersebut. Sinkronisasi berikutnya akan memperbarui masa berlaku lagi sesuai opsi yang dipakai.
