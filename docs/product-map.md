# SIMONTOK Product Map

Status: baseline fase 1
Tanggal: 2026-10-15

## 1. Tujuan Produk

SIMONTOK adalah aplikasi operasional internal untuk memantau pekerjaan notaris rekanan BPR dan dokumen agunan dari order dibuat sampai pekerjaan selesai, dokumen fisik diterima, dan jasa notaris dibayar.

Nilai utamanya:

- Tidak ada order yang hilang atau tidak jelas pemilik tindakannya.
- Posisi setiap order dapat dipahami tanpa membaca banyak halaman.
- SLA, covernote, dokumen, handover, dan pembayaran dapat dipantau.
- Perubahan status memiliki jejak yang dapat diaudit.

SIMONTOK bukan core banking dan bukan sistem persetujuan kredit. Aplikasi ini mengelola workflow legal/agunan setelah pekerjaan notaris dibuat.

## 2. Pengguna dan Kebutuhan

| Pengguna | Kebutuhan utama | Akses yang seharusnya |
|---|---|---|
| Staf Legal/Admin Kredit | Membuat order, mengirim ke notaris, memeriksa dokumen, memantau SLA, handover, dan pembayaran | Akses operasional penuh sesuai kewenangan |
| Mitra Notaris | Melihat order yang ditugaskan, memverifikasi dokumen, meminta perbaikan, mencatat progres, mengunggah dokumen, dan mengajukan pembayaran | Hanya order miliknya; tidak boleh melihat order notaris lain |
| Kepala Cabang/Manajemen | Memantau pekerjaan cabang dan menyetujui pembayaran jika berwenang | Read-only operasional + approval tertentu |
| Auditor/SKAI | Melihat data dan jejak perubahan | Read-only + audit log |
| IT Administrator | Mengelola user, role, master data, dan konfigurasi | Administrasi teknis; akses data operasional seperlunya |
| Pihak eksternal | Hanya mengecek progres pengajuan | Tanpa login, read-only, melalui token terbatas |

## 3. Alur Utama

```text
Buat order
  -> Kirim ke notaris
  -> Verifikasi notaris
  -> Perbaikan dokumen bila diperlukan
  -> Dokumen valid
  -> Proses akta / BPN / Samsat
  -> Draft diunggah
  -> Validasi BPR
  -> Dokumen final diunggah
  -> Dokumen fisik diterima
  -> Pembayaran diproses
  -> Selesai
```

Alur utama ini adalah Track A. Track B, C, dan D berjalan sebagai proses pendukung yang dapat memiliki masalah sendiri:

- Track B: status dokumen agunan.
- Track C: status covernote dan tanggal jatuh tempo.
- Track D: invoice, verifikasi, approval, dan pembayaran.

## 4. Status dan Tindakan

### Track A: Order

| Status | Arti bagi pengguna | Tindakan berikutnya |
|---|---|---|
| Diajukan | Order baru dibuat | Admin mengirim ke notaris |
| Menunggu verifikasi notaris | Order berada di pihak notaris | Notaris memeriksa dokumen |
| Perbaikan dokumen | Ada kekurangan atau koreksi | Admin melengkapi atau memperbaiki dokumen |
| Dokumen valid | Pemeriksaan awal selesai | Notaris mencatat proses pekerjaan |
| Proses akta | Pekerjaan legal sedang berjalan | Notaris memperbarui progres |
| Proses BPN/Samsat | Proses eksternal sedang berjalan | Notaris memperbarui progres dan komitmen |
| Draft diunggah | Draft hasil pekerjaan tersedia | BPR memeriksa draft |
| Menunggu validasi BPR | Menunggu keputusan BPR | Admin memvalidasi atau meminta perbaikan |
| Dokumen final diunggah | Hasil final tersedia | Admin memeriksa dan menerima dokumen |
| Dokumen fisik diterima | Handover fisik tercatat | Selesaikan administrasi dan pembayaran |
| Selesai | Workflow selesai | Tidak ada tindakan operasional lanjutan |
| Ditolak notaris | Notaris tidak menerima pekerjaan | Admin meninjau alasan dan keputusan |
| Dibatalkan | Order dihentikan | Tidak boleh diproses lanjut |

### Track B: Dokumen

`Menunggu verifikasi -> Perlu perbaikan -> Dokumen valid -> Draft diunggah -> Final diunggah -> Final divalidasi`

### Track C: Covernote

`Aktif -> Mendekati jatuh tempo -> Diperpanjang / Diganti sertifikat -> Selesai atau Kedaluwarsa`

### Track D: Pembayaran

`Belum diajukan -> Diajukan -> Diverifikasi admin -> Disetujui -> Dibayar`

Cabang pengecualian: ditolak admin atau ditolak manajemen.

## 5. Arsitektur Halaman

### Halaman utama

- Dashboard: prioritas operasional harian dan antrian tindakan.
- Order: daftar dan filter semua order yang boleh dilihat user.
- Detail Order: data lengkap dan aksi operasional satu order.
- Lacak Order: pencarian banyak order berdasarkan posisi/node.
- Detail Journey: timeline dan progress satu order.
- Laporan: analitik cabang, notaris, aging, tren, dan rekap.

### Halaman pendukung

- Portal Notaris: inbox dan pekerjaan khusus notaris.
- Master Data: cabang, notaris, jenis pekerjaan, SLA, checklist.
- Notifikasi: pemberitahuan tindakan dan perubahan status.
- Audit Log: jejak aktivitas untuk auditor dan admin berwenang.

### Akses tanpa login

Tracking eksternal harus dipisahkan dari tracking internal:

- URL memakai token acak dan dapat kedaluwarsa atau dicabut.
- Hanya menampilkan nomor referensi, status umum, node, progress, dan update terakhir.
- Tidak menampilkan nomor rekening, nominal, dokumen, catatan internal, atau data sensitif.
- Tidak boleh menggunakan ID order berurutan sebagai satu-satunya pengaman.
- Endpoint perlu rate limit dan pencatatan akses.

## 6. Temuan Gap Saat Ini

### Permission belum mencakup semua aksi

Permission yang tersedia saat ini masih terbatas pada dashboard, lihat/buat/batalkan order, master data, dan audit. Aksi nyata seperti upload/validasi dokumen, handover, pengelolaan covernote, verifikasi pembayaran, approval pembayaran, dan akses tracking belum memiliki permission granular.

Rekomendasi permission berikutnya:

```text
orders.view
orders.create
orders.update
orders.send
orders.cancel
documents.view
documents.upload
documents.validate
covernotes.view
covernotes.manage
handovers.view
handovers.manage
payments.view
payments.request
payments.verify
payments.approve
payments.record
tracking.view
tracking.public
reports.view
audit.view
masters.manage
```

### Alur jenis pekerjaan dan Track A belum sepenuhnya sejajar

Master jenis pekerjaan sudah memiliki langkah spesifik, misalnya SKMHT/APHT memiliki proses pengecekan sertifikat dan BPHTB, sedangkan Track A global memakai kelompok status seperti Proses Akta dan Proses BPN/Samsat.

Implikasi UX: UI sebaiknya menampilkan dua tingkat:

- Node ringkas untuk monitoring lintas order.
- Langkah spesifik jenis pekerjaan di detail order dan portal notaris.

### Pembayaran membutuhkan pemisahan kewenangan

Alur pembayaran memiliki maker-checker-approver, tetapi role saat ini belum secara eksplisit memisahkan siapa yang boleh meminta, memverifikasi, menyetujui, dan mencatat pembayaran.

### Tracking publik belum menjadi domain terpisah

Tracking internal dan tracking tanpa login perlu diperlakukan sebagai dua produk akses yang berbeda meskipun membaca data workflow yang sama.

## 7. Keputusan yang Perlu Dikonfirmasi

1. Apakah Kepala Cabang hanya melihat data cabangnya atau seluruh jaringan?
2. Apakah Manajemen boleh menyetujui pembayaran, atau hanya role tertentu?
3. Apakah satu order selalu memiliki satu notaris dan satu invoice, atau bisa banyak?
4. Apakah tracking eksternal ditujukan untuk nasabah, cabang, atau pihak lain?
5. Data apa yang boleh terlihat pada tracking eksternal?
6. Apakah semua jenis pekerjaan memakai Track A yang sama, atau tiap jenis memiliki alur visual sendiri?
7. Siapa pemilik tindakan pada setiap node: admin, notaris, cabang, atau manajemen?

## 8. Prinsip UI/UX untuk Fase Berikutnya

- Setiap halaman memiliki satu tujuan utama.
- Status selalu ditampilkan dengan label dan teks tindakan, bukan warna saja.
- Node aktif harus menjawab: sedang di mana, sejak kapan, siapa berikutnya, dan apa yang harus dilakukan.
- Dashboard menampilkan pengecualian dan pekerjaan yang perlu tindakan, bukan semua data.
- Detail order menjadi sumber informasi lengkap.
- Laporan menampung analitik historis.
- Tabel harus dapat dipindai dan memiliki filter yang mudah dipahami.
- Empty, loading, error, dan akses ditolak adalah bagian dari desain utama.
- Mobile menggunakan reflow yang sengaja dirancang, bukan tabel desktop yang dipaksa mengecil.
