# Akun darurat IT

Akun darurat IT adalah akun lokal tunggal dengan role IT Administrator. Akun ini menggunakan halaman login yang sama dengan pengguna lain, tetapi ID-nya dicocokkan dengan `SSO_EMERGENCY_LOGIN` dan kata sandinya diverifikasi lokal. Login akun ini tidak memanggil SSO. Akun tidak terikat cabang dan tidak dikelola dari Manajemen Pengguna.

## Konfigurasi dan pembuatan

1. Tetapkan `SSO_EMERGENCY_LOGIN` ke username khusus yang tidak digunakan akun lain.
2. Tetapkan `EMERGENCY_ACCOUNT_PASSWORD` minimal 16 karakter jika akun akan dibuat melalui `db:seed`.
3. Tetapkan `SSO_EMERGENCY_ALERT_EMAIL` ke email penanggung jawab IT dan pastikan mailer Laravel memakai transport yang benar-benar mengirim email, bukan `log` atau `array`.
4. Muat ulang konfigurasi aplikasi bila konfigurasi di-cache: `php artisan config:cache`.
5. Setelah migrasi dan seeder menyediakan role IT Administrator, jalankan `php artisan db:seed --class=DatabaseSeeder` atau buat/rotasi akun melalui `php artisan simontok:emergency-account` dari terminal server.
6. Simpan kata sandi di password vault perusahaan. Kata sandi tidak ditulis sebagai argumen atau ditampilkan ulang.

Jika akun sudah ada, perintah berhenti tanpa mengubahnya. Untuk merotasi kata sandi lewat terminal, jalankan `php artisan simontok:emergency-account --rotate`. Tambahkan `--generate` agar CLI membuat kata sandi acak dan menampilkannya sekali untuk disimpan di vault.

## Login dan rotasi

- Masuk melalui halaman login biasa. Pegawai internal tetap menggunakan SSO; username yang disetel sebagai `SSO_EMERGENCY_LOGIN` menggunakan kata sandi lokal.
- Percobaan login gagal dan berhasil dicatat. Login berhasil juga masuk ke log server dan mengirim email jika penerima serta transport sudah dikonfigurasi.
- Jika 2FA diaktifkan, login darurat tetap mengikuti verifikasi 2FA. Passkey tidak dapat digunakan untuk identitas darurat.
- Rotasi kata sandi dilakukan di **Pengaturan Sistem → Akses darurat IT** atau melalui CLI. Reset password biasa dan Manajemen Pengguna tidak dapat mengubah akun ini.
- Jika akun tidak tersedia, petugas IT dapat membuatnya kembali dari CLI setelah memastikan `SSO_EMERGENCY_LOGIN` benar.
- Jangan menonaktifkan atau menghapus akun ini sebagai bagian dari pembersihan pengguna rutin. Simpan kata sandinya di vault dengan akses terbatas untuk petugas IT yang ditunjuk.

## Audit

Riwayat login dan rotasi terlihat di **Pengaturan Sistem** serta **Audit Log**. Catatan mencakup jenis peristiwa, waktu, dan alamat IP. Kata sandi tidak dicatat.
