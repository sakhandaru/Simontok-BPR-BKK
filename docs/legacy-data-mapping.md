# Pemetaan Data Legacy SIMONTOK

## Dataset yang dipakai

- Sumber pilihan: `data_simontok_yang_dipindah.sql`.
- Arsip database baru: batch 1 di `legacy_import_batches` dan `legacy_import_records`.
- Jumlah sumber dan arsip cocok: 185.830 record dari 7 tabel.
- Pemetaan master belum diterapkan ke tabel operasional.
- Percobaan impor master operasional sebelumnya sudah di-rollback; data sumbernya tetap ada di arsip.
- Belum ada order atau riwayat operasional yang dibuat.

## Kesimpulan kelayakan migrasi

Data legacy memungkinkan dipindahkan ke project baru. Tidak ada tabel atau record pada dataset pilihan yang harus dibuang karena struktur baru berbeda. Seluruh 185.830 record sudah disimpan sebagai arsip sumber lengkap.

Pemindahan ke tabel operasional dilakukan bertahap: record yang relasinya sudah jelas dapat dipetakan, sedangkan record yang masih bergantung pada BU Core atau klarifikasi admin Legal tetap disimpan dan menunggu pemetaan. Field baru pada project baru boleh kosong jika memang tidak tersedia di sumber lama.

## Indikator pekerjaan lama

Berdasarkan aturan aplikasi lama, pekerjaan dianggap belum selesai bila `tgl_pekerjaan_notaris_selesai` masih `0000-00-00`. Dari 20.542 order pada dump pilihan:

- 19.195 memiliki tanggal selesai;
- 1.347 masih berstatus proses menurut aturan lama;
- 416 dari 1.347 tersebut sudah melewati `tgl_covernote_selesai` pada tanggal pemeriksaan 2026-11-03;
- 13 memiliki `setu = 0` dan 1 memiliki `covernote = 0`.

Angka ini menunjukkan status historis yang perlu dibawa ke sistem baru. Nilai tersebut tidak boleh diterjemahkan otomatis menjadi status baru sebelum arti bisnis `setu` dan `covernote` disepakati, tetapi record proses dan overdue sudah dapat ditandai sebagai kelompok prioritas migrasi.

## Pembagian jalur pemindahan order

Karena data yang tersedia terbatas, `tabel_form` tetap menjadi sumber utama order. Semua record dipertahankan, tetapi perlakuannya dibedakan:

- **1.347 pekerjaan masih proses** dibuat sebagai order operasional agar dapat dilanjutkan di project baru.
- **416 pekerjaan overdue** menjadi subset prioritas dari order proses dan diberi penanda risiko setelah aturan status baru disetujui.
- **19.195 pekerjaan yang sudah selesai** tetap dibuat sebagai order historis/selesai bila diperlukan untuk pelacakan dan laporan, tetapi tidak masuk antrean pekerjaan aktif.

Pembagian ini berdasarkan status pekerjaan pada data lama, bukan status aktif/tidak aktif notaris. Sebelum order dibuat, seluruh record tetap harus mendapatkan pasangan cabang, notaris, dan pembuat yang valid dari crosswalk. Record yang belum memiliki pasangan tidak dihapus; ia menunggu pemetaan sambil tetap tersedia di arsip.

## Pemetaan sumber ke tujuan

| Tabel sumber | Jumlah | Tujuan operasional | Kunci/pemetaan | Catatan |
|---|---:|---|---|---|
| `tabel_notaris` | 126 | `notaries` | `id_notaris` lama → `notaries.legacy_id` | Kandidat kunci pasangannya jelas, tetapi belum diterapkan. Akun/password lama tidak digunakan untuk login baru. |
| `tabel_pekerjaan_notaris` | 13 | `job_types` | Nama yang sama atau pemetaan yang disetujui | 10 nama cocok persis setelah spasi/kapitalisasi dinormalisasi; 3 belum punya pasangan nama. Belum diterapkan. |
| `tabel_ceklist_notaris` | 14 | `document_checklists` | Nama yang sama atau pemetaan yang disetujui | 3 nama cocok persis setelah spasi/kapitalisasi dinormalisasi; 11 belum punya pasangan nama. Belum diterapkan. |
| `tabel_form` | 20.542 | `orders` | `id_form_notaris` lama → `legacy_id` | Field snapshot seperti nama debitur, rekening, tanggal, plafon, baki debet, kolek, nominal, skema, dan keterangan memiliki kandidat tujuan. Order memerlukan cabang, notaris, dan pembuat yang valid. Saat ini belum ada order dengan semua relasi wajib terpetakan. |
| `tabel_agunan` | 24.808 | `order_collaterals` | `id_tabel_agunan` lama → `legacy_id` | Kode dan deskripsi agunan dapat dipetakan. `order_id` bergantung pada order; `job_type_id` wajib. Ada 6 agunan dengan lebih dari satu kandidat order, 2 tanpa order yang ditemukan, dan 11 tanpa jenis pekerjaan. |
| `tabel_ceklist_history` | 139.477 | `order_checklists` | ID checklist lama dan rekening | Perlu aturan untuk menentukan order/agunan yang tepat serta arti record terhadap `is_checked`. Tabel tujuan juga meminta relasi ke satu agunan. Semua detail asli sudah aman di arsip. |
| `tabel_perpanjangan_covernote` | 850 | `covernote_extensions` | `id_form_notaris` lama → order; tanggal baru dan file | Empat record tidak menemukan form lama (dua berisi ID 0 dan tanggal tidak valid). Tabel tujuan juga meminta agunan dan pengguna yang melakukan perpanjangan. |

## Kecocokan dengan master yang ada saat simulasi

Master operasional project baru saat ini kembali ke kondisi sebelum percobaan impor master legacy. Master dummy tetap ada dan tidak dipakai sebagai sumber kebenaran.

### Sumber master cabang

- Sumber resmi nama dan kode cabang: database **BU Core**.
- Tabel yang dibaca aplikasi lama: `app_kode_kantor`.
- Kolom yang diperlukan untuk pemetaan: `KODE_KANTOR` dan `NAMA_KANTOR`.
- Tabel cabang yang sekarang ada di database project baru dianggap data dummy dan tidak digunakan sebagai sumber kebenaran.
- Belum ada penggantian master cabang sampai data dari BU Core tersedia.

## Pembagian sumber untuk sisa pemetaan

- Dataset SQL pilihan menjadi sumber record aplikasi SIMONTOK yang sudah dikumpulkan.
- BU Core menjadi sumber referensi cabang, pegawai, dan data nasabah/kredit/agunan yang dipakai aplikasi lama.
- Data yang dihasilkan aplikasi (workflow, riwayat, dokumen, dan file upload) tetap bersumber dari database serta penyimpanan aplikasi lama. BU Core tidak menggantikannya.
- Snapshot nasabah/kredit yang sudah tersimpan pada record lama dipertahankan. Nilai BU Core terkini hanya dipakai untuk pencocokan referensi, kecuali ada keputusan khusus untuk memperbarui snapshot.

| Relasi yang diperiksa | Hasil |
|---|---:|
| Notaris lama tersedia melalui `legacy_id` | 0 dari 126; belum diterapkan |
| Jenis pekerjaan lama cocok nama dengan target | 10 dari 13; belum diterapkan |
| Checklist lama cocok nama dengan target | 3 dari 14; belum diterapkan |
| Kode cabang sumber sama dengan master baru | 10 dari 29 kode (kecocokan ini belum dipakai karena master target dummy) |
| Pembuat order lama cocok melalui `sso_employee_id` | 0 dari 20.542 |
| Order yang seluruh relasi wajibnya tersedia sekarang | 0 dari 20.542 |

Simulasi sebelum rollback menunjukkan 20.541 order akan menemukan notaris melalui ID lama bila master itu dimasukkan. Kecocokan 8.573 order ke kode cabang target hanya bersifat mekanis dan tidak dipakai karena cabang target dummy. Belum ada pembuat order lama yang cocok dengan `users.sso_employee_id`. Saat ini pemetaan belum diterapkan dan tidak ada order operasional yang dibuat.

Pencocokan nama hanya menghasilkan kandidat berdasarkan nama setelah spasi dirapikan dan kapitalisasi diabaikan. Jangan gunakan kemiripan nama sebagai keputusan otomatis bila hasilnya tidak tunggal.

## Aturan pemindahan

1. Arsip mentah adalah salinan sumber yang lengkap dan tidak diganti oleh pemetaan operasional.
2. Data operasional hanya dibuat ketika semua relasi wajib dapat ditentukan secara pasti.
3. ID lama dan nilai sumber tetap tersedia untuk pelacakan. Nilai tanpa pasangan tidak dibuang atau ditebak.
4. Normalisasi format yang aman (trim spasi, tanggal sentinel menjadi kosong) hanya dilakukan pada salinan operasional, bukan pada arsip mentah.
5. Pemindahan file fisik berada di pekerjaan terpisah; dataset terpilih ini hanya memuat tujuh tabel tersebut.

## Peta yang sudah siap dan yang masih menunggu keputusan

Peta kolom untuk tujuh tabel sumber sudah dibuat di `docs/legacy-field-mapping.md`. Artinya setiap kolom sumber sudah memiliki tujuan sementara, aturan arsip, atau penanda bahwa nilainya belum punya pasangan langsung.

Yang masih menunggu data atau keputusan sebelum pemindahan operasional:

- daftar kode/nama cabang resmi dari BU Core;
- pasangan `id_karyawan_master` lama ke akun pengguna baru;
- pasangan tiga jenis pekerjaan dan sebelas checklist yang belum cocok;
- aturan menerjemahkan `setu`, `covernote`, dan tanggal penyelesaian ke status baru;
- keputusan cara menyimpan riwayat checklist, karena satu kombinasi agunan-checklist dapat memiliki banyak peristiwa;
- pasangan agunan dan nilai `old_end` untuk perpanjangan covernote;
- lokasi file fisik yang dirujuk oleh `potopath`;
- jawaban admin Legal untuk enam relasi agunan yang ambigu serta record tanpa pasangan order.

Selama daftar ini belum ditutup, langkah yang aman adalah memperkaya crosswalk dan laporan pemetaan saja. Tidak ada alasan untuk mengubah isi arsip atau mengisi tabel operasional dengan nilai tebakan.
