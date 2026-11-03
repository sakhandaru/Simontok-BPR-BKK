# Peta Kolom Data Legacy ke SIMONTOK Baru

Dokumen ini untuk menyepakati pemetaan sebelum menulis data ke tabel operasional. Sumber tetap dijaga utuh pada `legacy_import_records`; pemetaan di bawah adalah rancangan, bukan hasil impor operasional.

## Aturan umum

- Arsip mentah menjadi bukti sumber dan tidak diubah.
- Kolom baru tanpa sumber dibiarkan kosong atau memakai default sistem hanya bila memang aman.
- ID lama dipertahankan sebagai `legacy_id` jika tersedia; untuk master tanpa kolom ID legacy, gunakan `legacy_master_links` setelah pemetaan disetujui.
- Relasi yang tidak tunggal tidak ditebak.
- Perubahan format yang aman pada salinan operasional: rapikan spasi, tanggal sentinel `0000-00-00` menjadi kosong, dan nominal disimpan sebagai decimal tanpa mengubah nilainya.

## Sumber data dan pemilik nilainya

| Sumber | Jenis data | Cara memakai saat pemetaan |
|---|---|---|
| `data_simontok_yang_dipindah.sql` | Record SIMONTOK yang sudah dikumpulkan: order, agunan, notaris rekanan, checklist, riwayat checklist, dan perpanjangan covernote | Sumber utama untuk mempertahankan record aplikasi dan snapshot historisnya. |
| BU Core | Master cabang (`app_kode_kantor`), pegawai/login (`karyawan_master_copy1`, `userkary`), dan referensi nasabah/kredit/agunan yang dipakai aplikasi lama | Sumber referensi untuk mencocokkan kode cabang dan identitas pegawai. Data BU Core yang lebih baru tidak otomatis mengganti snapshot historis pada dump. |
| Database dan penyimpanan file aplikasi lama | Data yang dibuat selama penggunaan aplikasi seperti workflow/status, dokumen, notifikasi, audit, serta isi file upload | Jika masuk cakupan, ambil dari database atau folder aplikasi lama. Data ini tidak digantikan oleh BU Core. |

Dump pilihan saat ini hanya mencakup tujuh tabel aplikasi. Data aplikasi lain dan file upload perlu diambil dari sumber aplikasi lama secara terpisah bila termasuk target migrasi.

## `tabel_notaris` → `notaries`

| Kolom sumber | Kolom tujuan | Aturan |
|---|---|---|
| `id_notaris` | `notaries.legacy_id` | Simpan sebagai teks untuk menjaga ID lama. |
| `nama_notaris` | `name` | Trim spasi luar; nama asli tetap ada di arsip. |
| `alamat` | `address` | Trim; kosong menjadi `NULL`. |
| `sk_notaris` | `sk_notary` | Nilai langsung. |
| `sk_ppat` | `sk_ppat` | Nilai langsung. |
| `pks` | `pks_no` | Nilai langsung. |
| `tgl_pks_mulai` | `pks_start` | Tanggal sentinel menjadi `NULL`. |
| `tgl_pks_selesai` | `pks_end` | Tanggal sentinel menjadi `NULL`. |
| `kondisi` | `is_active` | `1` menjadi aktif; nilai lain tidak aktif. |
| `kode_kantor` | `branch_notary.branch_id` | Lookup berdasarkan kode resmi dari BU Core (`app_kode_kantor`). Jangan gunakan master cabang dummy. |
| `username`, `password` | Arsip saja | Tetap tersimpan dalam payload mentah; tidak dipakai sebagai kredensial login baru. |
| `log_entry_notaris` | Timestamp master | Kandidat `created_at`/`updated_at` bila valid; nilai mentah tetap diarsipkan. |

`phone` dan `email` pada master baru tidak punya kolom sumber dan dibiarkan kosong.

## `tabel_pekerjaan_notaris` → `job_types`

| Kolom sumber | Kolom tujuan | Aturan |
|---|---|---|
| `id_pekerjaan_notaris` | `legacy_master_links.source_key` | Hubungkan ID lama ke `job_types.id`. |
| `deskripsi_pekerjaan` | `job_types.name` | Nama sama setelah trim/spasi/kapitalisasi boleh menjadi kandidat pasangan; 3 dari 13 nama belum cocok. |
| `log_pekerjaan_notaris` | Arsip saja | Tidak ada timestamp padanan yang berguna di master target. |

`job_types.code` adalah kode bisnis baru; jangan mengarang kode dari ID lama tanpa keputusan. Jenis yang belum cocok tetap di arsip sampai pemetaannya disepakati.

## `tabel_ceklist_notaris` → `document_checklists`

| Kolom sumber | Kolom tujuan | Aturan |
|---|---|---|
| `id_ceklist_notaris` | `legacy_master_links.source_key` | Hubungkan ID checklist lama ke `document_checklists.id`. |
| `nama_ceklist` | `document_checklists.name` | 3 dari 14 nama cocok setelah trim/spasi/kapitalisasi; sisanya perlu pemetaan. |

Checklist legacy bersifat umum. Jangan menetapkan `job_type_id` kecuali ada aturan yang disetujui.

## `tabel_form` → `orders`

| Kolom sumber | Kolom tujuan | Aturan |
|---|---|---|
| `id_form_notaris` | `orders.legacy_id` | Kunci utama untuk rekonsiliasi order lama. |
| `nama_nasabah` | `customer_name` | Pertahankan snapshot dari dump; jangan otomatis menimpa dengan nilai BU Core terkini. |
| `no_rekening` | `no_rekening` | Simpan sebagai teks; pertahankan nol di depan. Juga menjadi kunci lookup BU Core. |
| `tgl_realisasi` | `tgl_realisasi` | Pertahankan snapshot; tanggal sentinel menjadi `NULL`. |
| `plafon` | `plafon` | Pertahankan snapshot nominal dari dump ke decimal. |
| `baki_debet` | `baki_debet` | Pertahankan snapshot nominal dari dump ke decimal. |
| `kolek` | `kolek` | Pertahankan snapshot dari dump. |
| `stat_kred` | `stat_kred` | Pertahankan snapshot dari dump. |
| `kode_kantor` | `branch_id` | Lookup ke master cabang BU Core berdasarkan `KODE_KANTOR`; master cabang target saat ini dummy. |
| `id_notaris` | `notary_id` | Lookup ke notaris melalui `legacy_id`; nilai 0/tidak ditemukan perlu penanganan khusus. |
| `tgl_masuk_notaris` | `tgl_masuk_notaris` | Tanggal sentinel menjadi `NULL`. |
| `nom_bayar` | `nominal` | Nilai nominal langsung ke decimal. |
| `skema_pembayaran` | `skema_pembayaran` | Nilai lama perlu dipasangkan ke opsi skema baru; simpan kode sumber di arsip. |
| `tgl_covernote_selesai` | `orders.covernote_end` (kandidat utama) | Struktur baru sekarang memiliki snapshot covernote di tingkat order. Simpan nilai historis di sini bila aturan bisnis mengonfirmasi bahwa nilai lama memang jatuh tempo order; jangan menyalinnya ke semua agunan. |
| `tgl_pekerjaan_notaris_selesai` | Kandidat status Track A | Tanggal selesai dapat membantu menentukan status, tetapi aturan status harus disepakati. |
| `covernote` | `orders.covernote_no` atau status Track C | Nilai lama perlu diperiksa apakah berisi nomor, kode status, atau flag. Jangan menganggap nilai langsung sama dengan nomor/status baru. |
| `setu` | Kandidat status/approval | Flag lama perlu didekode sebelum menentukan status baru. |
| `keterangan_kendala` | `keterangan` | Nilai langsung setelah trim; kosong menjadi `NULL`. |
| `komitmen_penyelesaian_notaris` | `order_progress.komitmen_penyelesaian` atau catatan | Sumber bertipe teks; hanya ubah menjadi tanggal bila format valid dan disepakati. |
| `id_karyawan_master` | `created_by` | Lookup ke akun pegawai melalui ID SSO/employee crosswalk; mapping saat ini belum tersedia. Simpan ID lama di arsip. |
| `potopath` | `order_documents` metadata | Path/nama sumber dapat dipetakan setelah file fisik ditemukan; isi file harus disalin terpisah. |
| `log_form` | `created_at`/`updated_at` | Kandidat timestamp bila valid; pertahankan sumber di arsip. |

Kolom `orders.covernote_start`, `orders.covernote_file_path`, dan `orders.risk_flag` tidak memiliki padanan yang pasti dari satu kolom sumber. `covernote_start` hanya diisi bila tanggal mulai dapat ditentukan dari data lama; path file hanya diisi setelah file fisik ditemukan; `risk_flag` diturunkan setelah aturan status disepakati.

## `tabel_agunan` → `order_collaterals`

| Kolom sumber | Kolom tujuan | Aturan |
|---|---|---|
| `id_tabel_agunan` | `order_collaterals.legacy_id` | Kunci utama agunan lama. |
| `no_rekening` | Lookup `order_id` | Hubungkan hanya bila rekening mengarah ke satu order. Ada rekening ganda dan record tanpa order; jangan menebak. |
| `agunan_id` | `agunan_id` | Simpan sebagai teks dan pertahankan nol di depan. |
| `deskripsi_agunan` | `deskripsi_agunan` | Nilai penuh, tanpa dipotong. |
| `id_pekerjaan_notaris` | `job_type_id` dan/atau `order_collateral_jobs.job_type_id` | Lookup melalui crosswalk master jenis pekerjaan; 11 record tidak berisi jenis pekerjaan. Jika satu agunan memiliki beberapa pekerjaan di sistem baru, buat baris pekerjaan terpisah hanya bila ada sumber atau aturan yang mendukungnya. |
| `log_tabel_agunan` | Timestamp agunan | Kandidat `created_at`/`updated_at` bila valid. |

Status dokumen, covernote, dan SLA baru tidak memiliki padanan langsung di tabel sumber agunan; jangan mengisi berdasarkan tebakan.

## `tabel_ceklist_history` → `order_checklists` / arsip riwayat

| Kolom sumber | Kolom tujuan | Aturan |
|---|---|---|
| `id_ceklist_history` | Arsip/source key | Pertahankan ID setiap peristiwa. |
| `id_ceklist_notaris` | `document_checklist_id` | Lookup melalui crosswalk master checklist. |
| `no_rekening` | Lookup `order_id` | Hubungkan bila ada satu order yang cocok; ada record tanpa order. |
| — | `order_collateral_id` | Tidak ada ID agunan di sumber. Target mewajibkan relasi ini; jangan memilih agunan secara acak. |
| `id_karyawan_master` | `checked_by` | Lookup melalui employee/SSO crosswalk; belum tersedia. |
| `log_ceklist_history` | `checked_at` | Tanggal/waktu langsung bila valid. |
| — | `is_checked` | Sumber tidak memiliki flag ini. Perlu aturan bisnis; jangan menganggap keberadaan baris otomatis berarti checked tanpa persetujuan. |

Target `order_checklists` memiliki satu baris per pasangan agunan-checklist, sedangkan sumber adalah riwayat peristiwa dan dapat memiliki beberapa baris untuk kombinasi yang sama. Karena itu riwayat tidak boleh langsung di-*upsert* ke tabel tersebut. Semua 139.477 baris tetap dipertahankan dalam arsip; bila riwayat operasional perlu ditampilkan, perlu tabel/aturan histori tersendiri atau keputusan eksplisit tentang cara merangkum peristiwa.

## `tabel_perpanjangan_covernote` → `covernote_extensions` / arsip

| Kolom sumber | Kolom tujuan | Aturan |
|---|---|---|
| `id_perpanjangan_cv` | Arsip/source key | Pertahankan ID setiap perpanjangan. |
| `id_form_notaris` | Lookup order | Hubungkan dengan `orders.legacy_id`; empat record tidak menemukan order. |
| `no_rekening` | Pemeriksaan silang | Gunakan untuk validasi, bukan pengganti ID bila nilainya bertentangan. |
| `tgl_covernote_selesai_u` | `new_end` | Tanggal sentinel menjadi `NULL`. |
| `potopath` | `file_path` | Metadata/path saja; file fisik harus disalin terpisah. |
| `id_karyawan_master` | `extended_by` | Lookup ke akun pegawai/SSO; belum tersedia. Kolom tujuan wajib diisi, sehingga record tanpa pasangan pengguna harus tetap diarsipkan atau menunggu crosswalk, bukan diisi akun sembarang. |
| `log_perpanjangan_covernote` | `created_at` | Timestamp langsung bila valid. |
| — | `order_collateral_id`, `old_end` | Tidak tersedia langsung. Perlu pemetaan aturan dan agunan; jangan diturunkan dengan tebakan. `old_end` wajib di tabel tujuan, sedangkan sumber hanya memberikan tanggal baru. |

## Referensi yang masih dibutuhkan

- Master cabang BU Core: `app_kode_kantor.KODE_KANTOR`, `NAMA_KANTOR`.
- Crosswalk ID pegawai lama ke akun pegawai/SSO baru.
- Aturan status lama (`setu`, `covernote`, tanggal selesai) ke status baru.
- Jawaban admin Legal untuk record dengan beberapa kandidat relasi.
- Lokasi file fisik yang dirujuk oleh `potopath`.
