# SIMONTOK UI Foundations

Status: fase 2
Tanggal: 2026-10-15

## Arah Visual

SIMONTOK memakai bahasa visual netral, modern, dan institusional. Referensinya adalah kerapian Vercel dan kepadatan informasi Cloudflare, tanpa menyalin identitas visual keduanya.

UI harus terasa:

- tenang dan mudah diverifikasi;
- tajam untuk membaca tabel, status, dan tenggat;
- ringan tanpa dekorasi yang tidak membantu pekerjaan;
- konsisten antara halaman internal, portal notaris, dan pelacakan order.

## Token Dasar

### Tipografi

- Font utama: Plus Jakarta Sans.
- Heading halaman: `text-2xl`, weight 600.
- Judul panel: `text-sm`, weight 600.
- Body: `text-sm`.
- Metadata: `text-xs` dan muted foreground.
- Angka operasional menggunakan `tabular-nums`.

### Radius

- Panel/card: 8px.
- Input/button/badge: 6px.
- Tidak memakai pill radius sebagai default.
- Radius penuh hanya untuk indikator yang memang berbentuk titik atau progress.

### Surface

- Panel: background card, border tipis, tanpa shadow.
- Header panel: muted transparan dan border bawah.
- Elevated surface: hanya dropdown, dialog, dan popover.
- Hover: perubahan surface ringan, bukan glow atau transform.

### Warna Fungsional

- Neutral: struktur utama, navigasi, dan data biasa.
- Hijau: selesai, valid, atau aman.
- Amber: mendekati tenggat atau perlu perhatian.
- Merah: terlambat, ditolak, kedaluwarsa, atau tindakan destruktif.
- Biru: informasi dan link konteks.

Warna status selalu disertai teks. Warna tidak boleh menjadi satu-satunya penanda arti.

### Focus dan Interaksi

- Semua kontrol keyboard-visible memiliki focus ring.
- Target sentuh minimal 44px pada layout mobile.
- Hover hanya menambah konteks visual; fungsi utama tetap tersedia melalui click/tap.
- Aksi destruktif memakai konfirmasi dan penjelasan akibat.

## Pola Komponen

| Komponen | Fungsi | Aturan |
|---|---|---|
| Page header | Menjelaskan tujuan halaman | Satu judul dan satu deskripsi singkat |
| Panel | Mengelompokkan informasi yang berhubungan | Jangan menumpuk panel di dalam panel tanpa alasan |
| Table | Membandingkan banyak order | Kolom utama di kiri, aksi di kanan |
| Badge | Menandai status singkat | Pakai teks yang bermakna, bukan warna saja |
| Alert | Menjelaskan masalah dan dampaknya | Sertakan tindakan bila ada |
| Timeline | Menjelaskan urutan perubahan | Tampilkan waktu dan pelaku bila tersedia |
| Stepper | Menunjukkan posisi dalam alur | Node aktif harus paling jelas |
| Empty state | Menjelaskan kondisi tanpa data | Beri konteks atau tindakan berikutnya |

## Aturan UX

1. Halaman memprioritaskan satu pekerjaan utama.
2. Data yang membutuhkan tindakan tampil lebih dahulu daripada data historis.
3. Status selalu diterjemahkan menjadi kalimat yang dapat ditindaklanjuti.
4. Tanggal dan tenggat memakai format lokal Indonesia yang konsisten.
5. Filter harus menunjukkan kondisi aktif dan mudah dihapus.
6. Tabel panjang harus tetap punya konteks saat dipakai di mobile.
7. Loading, error, kosong, dan tidak punya akses diperlakukan sebagai state desain utama.
8. Aksi penting tidak disembunyikan di menu yang sulit ditemukan.

## Implementasi Awal

Token dan primitive global berada di `resources/css/app.css`. Class bersama yang tersedia:

- `sim-workspace`
- `sim-panel`
- `sim-panel-header`
- `sim-page-header`
- `sim-page-title`
- `sim-page-description`
- `sim-status-success`
- `sim-status-warning`
- `sim-status-danger`
- `sim-status-info`

Halaman berikutnya harus menggunakan fondasi ini sebelum menambahkan class visual baru.

Primitive React yang tersedia:

- `SimPageHeader`: judul, deskripsi, dan aksi halaman.
- `SimStatusBadge`: status dengan tone semantik.
- `SimEmptyState`: kondisi tanpa data dengan konteks dan aksi opsional.
- `SimActionAlert`: masalah atau informasi yang memiliki tindakan.
- `SimProgress`: progress bar dengan nilai yang dapat dibaca assistive technology.
- `SimTimeline`: riwayat berurutan dengan state complete, current, waiting, dan danger.
