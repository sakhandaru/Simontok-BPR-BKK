# SIMONTOK App Shell

Status: fase 3
Tanggal: 2026-10-15

## Struktur Navigasi

Sidebar dibagi berdasarkan pekerjaan pengguna, bukan berdasarkan jenis implementasi:

- **Operasional**: Dashboard, Order, Lacak Order, Laporan.
- **Referensi**: Cabang, Notaris, Jenis Pekerjaan.
- **Administrasi**: Portal Notaris, Notifikasi, Audit Log.
- **Akun**: Pengaturan akun dan user menu.

Menu harus mengikuti permission user. Pengelompokan visual tidak menggantikan pengecekan akses di backend.

## Header

Header internal memakai tinggi ringkas, border bawah tipis, dan breadcrumb yang tetap terlihat saat halaman digulir. Breadcrumb:

- menunjukkan konteks lokasi;
- memiliki link pada level sebelumnya;
- memotong judul panjang di mobile;
- tidak menjadi pengganti page title.

## Active Navigation

Menu aktif menggunakan parent matching. Contoh:

- `/orders` dan `/orders/24` mengaktifkan menu Order.
- `/tracking-orders` dan `/tracking-orders/24` mengaktifkan menu Lacak Order.
- `/reports` tetap berdiri sendiri.

Dengan pola ini, user tidak kehilangan konteks saat masuk ke halaman detail.

## Layout Rules

- Content area memiliki `min-width: 0` agar tabel dan panel tidak memaksa viewport melebar.
- Workspace memakai padding 16px di mobile dan 24px di layar lebih besar.
- Header tidak memakai judul produk besar atau elemen dekoratif.
- Sidebar dapat diciutkan ke mode icon pada desktop.
- Mobile memakai sidebar sheet dan tetap menyediakan label menu yang jelas.
- Konten utama tidak boleh tertutup header sticky.

## UX Checklist

- [ ] Menu aktif terlihat pada daftar dan detail.
- [ ] Breadcrumb tidak overflow di mobile.
- [ ] Sidebar tidak menampilkan menu yang tidak berhak diakses.
- [ ] Header tetap dapat dipakai keyboard.
- [ ] Tabel besar memiliki containment atau reflow yang sesuai.
- [ ] User dapat kembali ke konteks sebelumnya tanpa mengandalkan tombol browser.
