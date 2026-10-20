# PRD — SIMONTOK (Sistem Informasi Monitoring Pekerjaan Notaris Rekanan)

| | |
|---|---|
| **Status dokumen** | DRAFT v0.10 — sinkron dengan dokumen client (2026-10-13), menunggu jawaban [KONFIRMASI] |
| **Tanggal** | 2026-10-13 |
| **Pemilik produk** | (belum ditentukan) |
| **Ditulis oleh** | (developer) |
| **Sumber awal** | `README.md` & `PROGRESS.md` repo legacy, hasil audit repo lama & baru |

**Perubahan v0.10:** sinkronisasi dengan dokumen client `docs/simontok nadhif.docx`: glosarium APHT/SKMHT diperbaiki sesuai istilah notaris yang benar, aturan plafon & 6 jenis pengikatan masuk §6, [KONFIRMASI] alur per jenis (§10) terjawab, master langkah per jenis `job_type_steps` (migrasi 000010), strategi seed checklist (§12A), soal §15 baru nomor 22.
**Perubahan v0.9:** tambah Ringkasan Eksekutif (§0) untuk audiens manajemen — status, risiko utama, dan permintaan keputusan; dokumen disiapkan untuk review atasan.
**Perubahan v0.8:** ERD & skeleton migrasi Laravel dibuat — `docs/ERD.md` + 9 file `database/migrations/2026_10_13_*` (23 tabel domain baru; total 33 tabel dengan bawaan framework); konvensi frontend dikunci: **shadcn/ui + komponen starter kit dipakai ulang, tidak dibuat baru** (§8).
**Perubahan v0.7:** sumber migrasi dikonfirmasi — dump **`app_simontok_bahan.sql`** (14 tabel, ±19,5rb order, 23,6rb agunan) & kode legacy `../simonto`; §12A berisi pemetaan tabel lengkap + risiko migrasi; dump dipindah ke `database/legacy/` (gitignored — berisi data nasabah).
**Perubahan v0.6:** lengkapi celah model status (Track C/D, agregasi multi-agunan, batasan pembatalan, pause SLA), FR baru (revisi order, lifecycle akun notaris, fallback core bank, matriks notifikasi, spesifikasi upload), kepatuhan UU PDP & operabilitas, entitas §11 (`job_types`, `covernote_extensions`, `branch_notary`, `job_positions`, `order_status_histories` + tabel infra Laravel), pertanyaan terbuka 18–21.
**Perubahan v0.5:** perkuat §7.10 audit log — jejak penuh (pelaku, IP, aksi, before→after), append-only, export untuk auditor; sinkronisasi referensi FR-CTL-05.
**Perubahan v0.4:** formalisasi maker-checker-approver (segregasi tugas) untuk aksi kritis — §7.12 baru, matriks kewenangan (§9) tambah kolom Checker, kolom kontrol di §11, pertanyaan terbuka 15–17, KPI kontrol (§17).
**Perubahan v0.3:** keputusan modernisasi — kode lama **bukan** basis kode, hanya sumber migrasi; arsitektur dikoreksi ke Laravel 13 + Inertia/React; status progres diperbarui; ditambah §12A migrasi data lama; Lampiran A diperbarui.
**Perubahan v0.2:** alur diperluas dengan jalur penolakan notaris, handover dokumen fisik, multi-agunan, verifikasi invoice, model status 4 track, dan aturan covernote kedaluwarsa.

> ⚠️ Bagian yang ditandai **[KONFIRMASI]** belum diverifikasi dan wajib dibahas dengan stakeholder sebelum development dimulai.

---

## 0. Ringkasan Eksekutif (untuk manajemen)

| | |
|---|---|
| **Apa** | SIMONTOK — sistem monitoring pekerjaan notaris/PPAT rekanan (order → dokumen → akta → pembayaran → arsip), menggantikan pemantauan manual via telepon/WA |
| **Untuk siapa** | Staf legal & admin kredit, mitra notaris, kepala cabang/manajemen, IT, SKAI — di seluruh cabang PT BPR BKK Jateng |
| **Kenapa** | Risiko hukum bila agunan tidak terikat tepat waktu; SLA & kinerja notaris tidak terukur; jejak audit lemah padahal diawasi OJK |
| **Status teknis** | PRD & desain database selesai (ERD; 34 tabel sudah termigrasi di DB pengembangan); data legacy siap dimigrasi (±19,5rb order, 23,6rb agunan); **development modul bisnis belum dimulai** |
| **Kepatuhan** | Segregasi tugas maker-checker (OJK), audit log append-only (siap periksaan SKAI/auditor), perlindungan data pribadi (UU PDP) |
| **Risiko utama** | 54 penanda **[KONFIRMASI]** belum terjawab (daftar di §15, 22 pertanyaan) — **development tidak boleh dimulai sebelum sesi stakeholder**; aksi keamanan mendesak di Lampiran A |

**Yang diminta dari manajemen/stakeholder:**
1. **Jadwalkan sesi wawancara** (admin legal, notaris, kepala cabang, SKAI) untuk menjawab 22 pertanyaan §15 — daftar tanya sudah siap dalam dokumen ini.
2. **Tetapkan pemilik produk** dan posisi checker SoD (Kabag/Kasie Kredit) beserta threshold approval pembayaran.
3. **Putuskan environment produksi** (on-prem/cloud) & pengelola server.
4. **Segerakan aksi keamanan** (Lampiran A): privatasi repo legacy, rotasi kredensial lama.

**Cara membaca dokumen:** **[KONFIRMASI]** = butuh jawaban stakeholder; **FR-xxx** = kebutuhan fungsional; detail teknis di §8–§12 dan `docs/ERD.md`.

---

## 1. Ringkasan

SIMONTOK adalah aplikasi internal **PT BPR BKK Jateng (Perseroda)** untuk mendigitalisasi dan memantau seluruh pekerjaan legal pengikatan agunan kredit yang melibatkan **notaris/PPAT rekanan**. Aplikasi menggantikan proses manual (telepon/WhatsApp) dengan alur terpusat: order → verifikasi dokumen → proses akta → dokumen final → validasi → pembayaran → arsip.

**Pengguna utama:** Staf Admin & Legal Kredit (internal), Mitra Notaris (eksternal), Kepala Cabang/Manajemen, IT Administrator, SKAI/Auditor.

---

## 2. Latar Belakang & Masalah

Proses pengikatan kredit di BPR memerlukan notaris/PPAT untuk pekerjaan seperti PK, APHT, SKMHT, Fidusia, legalisasi dokumen, dan pengurusan dokumen agunan. Kondisi saat ini:

- Order pekerjaan ke notaris belum terdokumentasi penuh di sistem.
- Pemantauan progres masih manual (telepon/WhatsApp).
- Cabang dapat terlambat menginput data.
- Posisi dokumen fisik sulit dilacak real-time.
- Risiko dokumen terselip, terlambat, atau tidak tervalidasi.
- Evaluasi SLA dan kinerja notaris belum objektif dan terpusat.

**Dampak jika tidak ditangani:** sertifikat agunan tidak selesai tepat waktu → kredit tidak terjamin secara hukum → risiko hukum dan operasional BPR.

---

## 3. Tujuan & Non-Tujuan

### Tujuan
1. Pusatkan pencatatan order pekerjaan notaris.
2. Pantau progres pekerjaan dan posisi dokumen secara real-time.
3. Ukur SLA dan KPI notaris secara objektif.
4. Sediakan arsip digital dan jejak audit.
5. Mitigasi risiko hukum/operasional akibat keterlambatan atau kehilangan dokumen.

### Non-tujuan (v1)
- Bukan sistem core banking; data nasabah/rekening tetap dibaca dari core bank.
- Bukan sistem pembayaran (hanya mencatat pengajuan, verifikasi, approval, dan bukti bayar).
- Bukan portal self-service nasabah.
- Integrasi email/WhatsApp otomatis **[KONFIRMASI]** — v1 cukup notifikasi dalam aplikasi.

---

## 4. Aktor & Persona

| Aktor | Deskripsi | Kebutuhan utama |
|---|---|---|
| **Staf Admin & Legal Kredit** | Pegawai internal pembuat order. Login via SSO, role dari `job_position`. Data dibatasi `kode_kantor`. | Entry order cepat, cek status, validasi dokumen, verifikasi invoice |
| **Mitra Notaris** | Pihak eksternal penerima pekerjaan. Akun username/password terpisah (bukan SSO) **[KONFIRMASI]** | Daftar pekerjaan, update progres, upload dokumen, ajukan invoice, tolak order |
| **Kepala Cabang / Manajemen** | Pemantau kinerja & approver pembayaran | Dashboard, laporan, approval invoice |
| **IT Administrator** | Pengelola sistem | Master data, akun, role |
| **SKAI / Auditor** | Pemeriksa internal | Akses baca log & laporan |

**Pertanyaan aktor [KONFIRMASI]:**
1. Satu notaris = satu akun, atau satu kantor notaris bisa punya beberapa user?
2. Apakah Kepala Cabang terpisah dari Manajemen, atau digabung?
3. Apakah ada admin pusat yang bisa lihat lintas cabang?

---

## 5. Glosarium

| Istilah | Arti |
|---|---|
| **PK** | Perjanjian Kredit — akta perjanjian kredit antara BPR dan nasabah |
| **APHT** | Akta Pemberian Hak Tanggungan; pengikatan hak tanggungan atas agunan tanah/bangunan via PPAT (plafon di atas Rp50 juta) |
| **SKMHT** | Surat Kuasa Membebankan Hak Tanggungan; dasar pengikatan agunan tanah/bangunan via PPAT (plafon Rp10 sampai Rp50 juta) |
| **Fidusia** | Pengikatan agunan bergerak (kendaraan/BPKB) lewat Akta Fidusia; didaftarkan di Kemenkumham (plafon di atas Rp10 juta) |
| **Gadai** | Pengikatan agunan berupa tabungan/deposito lewat Akta Perjanjian Gadai dan Surat Kuasa Pencairan |
| **Cessie** | Pengikatan agunan berupa tagihan/piutang dari SPK/kontrak lewat akta pemindahan hak tagihan |
| **Surat Kuasa Pelimpahan Hak Pemakaian** | Pengikatan hak pemakaian kios/lapak pasar; jenis baru dari dokumen client (tidak ada di data legacy) |
| **PPAT** | Pejabat Pembuat Akta Tanah; pembuat akta tanah termasuk APHT/SKMHT |
| **Covernote** | Surat keterangan sementara dari PPAT/notaris bahwa proses pengikatan berjalan; punya **jatuh tempo** dan harus diperpanjang atau diganti sertifikat |
| **BPN** | Badan Pertanahan Nasional — tempat pendaftaran hak tanggungan |
| **Samsat** | Kantor pajak kendaraan — proses fidusia/penghapusan fidusia kendaraan |
| **SLA** | Batas waktu penyelesaian pekerjaan per jenis pekerjaan |
| **Resi BPN** | Bukti pendaftaran dokumen di BPN |
| **Handover** | Serah terima dokumen fisik (sertifikat asli) antara notaris dan BPR, dicatat penerima/waktu/metode |
| **kode_kantor** | Kode cabang tempat order berasal; membatasi akses data |

---

## 6. Alur Bisnis End-to-End

```
Admin Legal            Notaris                  Manajemen
    │                     │                        │
    ├─ 1. Buat order ────►│                        │
    │   (snapshot data    │                        │
    │    core bank,       │                        │
    │   boleh multi-agunan)│                       │
    │                     ├─ 2. Verifikasi dokumen │
    │                     │    awal (per agunan)   │
    │◄── 2a. Minta        │                        │
    │     perbaikan       │                        │
    ├─ 2b. Perbaiki ─────►│                        │
    │                     ├─ 2c. TOLAK order       │
    │                     │    (alasan → order     │
    │                     │    berakhir)           │
    │                     ├─ 3. Proses akta /      │
    │                     │    BPN / Samsat        │
    │                     ├─ 4. Update progres     │
    │                     ├─ 5. Upload draft,      │
    │                     │    resi BPN, final     │
    │◄── 6. Validasi final + HANDOVER fisik ──────┤
    │     (catat penerima/waktu/metode)            │
    │                     ├─ 7. Ajukan invoice ───►│
    │◄── 7a. Verifikasi invoice oleh admin legal   │
    │                     │                        ├─ 8. Approve bayar
    │◄── 8a. Upload bukti bayar ◄──────────────────┤
    └─ 9. Arsip + laporan SLA/KPI ◄───────────────┘
```

**Tahapan:**
1. Admin Legal membuat order: cari data kredit di core bank (no rekening/nama), data dibatasi `kode_kantor`, **data nasabah di-snapshot** saat order dibuat, pilih notaris rekanan sesuai cabang, input tanggal masuk notaris & jatuh tempo covernote, nominal & skema pembayaran, upload dokumen awal (PDF), pilih checklist dokumen & jenis pekerjaan **per agunan** (satu order boleh lebih dari satu agunan).
2. Notaris menerima & **memverifikasi dokumen awal per agunan**.
3. Jika dokumen belum sesuai → notaris membuat **permintaan perbaikan**; admin memperbaiki/melengkapi.
4. Notaris dapat **menolak order** dengan alasan (mis. data nasabah bermasalah) → order berakhir, tercatat di audit log **[KONFIRMASI: aturan penolakan]**.
5. Dokumen valid → notaris memproses akta/pengikatan (APHT/SKMHT/Fidusia, BPN, Samsat).
6. Notaris memperbarui **progres** secara berkala dan mengunggah **draft / resi BPN / dokumen final**.
7. Admin Legal **memvalidasi dokumen final** dan mencatat **handover dokumen fisik** (penerima, tanggal, metode: kurir/titip/ambil sendiri, tanda terima).
8. Notaris mengajukan **invoice/tagihan** (hanya jika seluruh agunan berstatus dokumen final valid).
9. Admin Legal **memverifikasi invoice** (nominal cocok dengan order, dokumen final sudah valid).
10. Manajemen **menyetujui pembayaran**; bukti bayar diunggah.
11. Sistem menyimpan arsip digital dan memperbarui laporan kinerja.

**Jenis pengikatan, plafon & langkah proses** (sumber: dokumen client `docs/simontok nadhif.docx`, okt 2026):

| Jenis pengikatan | Aturan plafon | Agunan | Dasar pengikatan |
|---|---|---|---|
| SKMHT | di atas Rp10 juta s.d. Rp50 juta | Tanah / Tanah & Bangunan (SHM/SHGB) | Surat Kuasa Membebankan Hak Tanggungan |
| APHT | di atas Rp50 juta | Tanah / Tanah & Bangunan (SHM/SHGB/SHGU) | Akta Pemberian Hak Tanggungan |
| Fidusia | di atas Rp10 juta | Kendaraan bermotor (BPKB) | Akta Fidusia, terdaftar di Kemenkumham |
| Gadai | tanpa batas plafon | Tabungan / Deposito | Akta Perjanjian Gadai + Surat Kuasa Pencairan |
| Cessie | tanpa batas plafon | Tagihan/piutang (SPK/kontrak) | Akta pemindahan hak tagihan |
| Surat Kuasa Pelimpahan Hak Pemakaian | tanpa batas plafon | Kios/lapak pasar | Surat kuasa pelimpahan hak pemakaian (jenis baru, tidak ada di data legacy) |

Langkah proses **berbeda per jenis** (dari dokumen client; dicatat per agunan di `order_progress`, master langkah di `job_type_steps`):

- **SKMHT/APHT:** Order → Pengecekan sertifikat → Validasi notaris → Penandaan lokasi jaminan → Penilaian kualitas tanah → Hasil cek keluar → Pendaftaran BPHTB (bila ada AJB/balik nama) → Penerbitan SKMHT/APHT → Selesai.
- **Fidusia:** Order → Pengecekan ulang kelengkapan dokumen → Pendaftaran fidusia di Kemenkumham / akta fidusia → Selesai.
- **Gadai, Cessie, Surat Kuasa Pelimpahan Hak Pemakaian:** Order → Pengecekan ulang kelengkapan dokumen → Pembuatan akta notaril → Selesai.

Syarat dokumen per jenis (SKMHT/APHT 10 butir, Fidusia 9, Gadai 6, Cessie 8, Surat Kuasa Pelimpahan 7) menjadi isi `document_checklists` per `job_type` (lihat §12A).

**[KONFIRMASI: soal 22]** 8 jenis pekerjaan di luar dokumen client (Balik Nama, Pensertifikatan, Pecah Bidang, Turun Waris, Hibah, Peningkatan Hak, Penggabungan Sertifikat, Tanpa Pengikatan) dan PK/legalisasi: tetap dipakai dengan alur masing-masing, atau di luar sistem baru?

**Kontrol (maker-checker):** pembuatan order dapat wajib diperiksa checker internal sebelum dikirim ke notaris, dan wajib 3 level (maker–checker–approver) jika nominal di atas threshold — detail & aturan SoD di §7.12 **[KONFIRMASI]**.

---

## 7. Kebutuhan Fungsional

### 7.1 Auth & Hak Akses
- FR-AUTH-01: Login pegawai internal via SSO; role ditentukan dari `job_position`.
- FR-AUTH-02: Login notaris via username/password tersendiri.
- FR-AUTH-03: Session timeout; kebijakan password kuat; force change password untuk password default.
- FR-AUTH-04: RBAC sesuai matriks kewenangan (§9).
- FR-AUTH-05: Logout untuk semua portal.

### 7.2 Manajemen Order
- FR-ORD-01: Admin Legal membuat order baru (data dari core bank, pilih notaris, SLA, jatuh tempo covernote, nominal, skema pembayaran, upload dokumen awal, checklist).
- FR-ORD-02: Pencarian data kredit berdasarkan nomor rekening/nama nasabah, dibatasi `kode_kantor`.
- FR-ORD-03: **Snapshot data nasabah/agunan** diambil saat order dibuat; perubahan di core bank tidak mengubah order yang sudah ada.
- FR-ORD-04: Riwayat perubahan order tercatat.
- FR-ORD-05: **Multi-agunan**: satu order bisa memiliki beberapa agunan, masing-masing dengan jenis pekerjaan, SLA, dan status sendiri.
- FR-ORD-06: Pembatalan order dengan alasan, oleh, dan dengan persetujuan **[KONFIRMASI: siapa yang boleh & siapa checker]** — wajib checker (FR-CTL-01).
- FR-ORD-07: **Revisi order setelah dikirim** — data order tidak diedit langsung setelah diterima notaris; perubahan melalui alur revisi (diajukan Admin Legal → dicek → diteruskan ke notaris), tercatat di audit log **[KONFIRMASI: diperlukan? atau cukup perbaikan dokumen?]**.
- FR-ORD-08: Data core bank tidak tersedia/error → pesan jelas + retry **[KONFIRMASI: mekanisme fallback — input manual atau coba lagi?]**.
- FR-ORD-09: **Saran jenis pengikatan dari plafon** — form order menyarankan jenis pengikatan (SKMHT/APHT/Fidusia) sesuai aturan plafon & jenis agunan di §6; admin tetap dapat memilih lain dengan alasan **[KONFIRMASI: saran atau mengikat]**.

### 7.3 Portal Notaris
- FR-NOT-01: Daftar pekerjaan diterima (filter status, tanggal, cabang).
- FR-NOT-02: Verifikasi dokumen awal **per agunan** (terima / minta perbaikan + keterangan).
- FR-NOT-03: Update progres pekerjaan.
- FR-NOT-04: Upload draft akta, resi BPN, dokumen final.
- FR-NOT-05: Perpanjangan covernote + riwayat perpanjangan.
- FR-NOT-06: Pengajuan invoice/tagihan (nominal & skema) — hanya jika seluruh agunan berstatus dokumen final valid.
- FR-NOT-07: Detail pekerjaan: data nasabah, agunan, checklist, dokumen, timeline.
- FR-NOT-08: **Penolakan order** dengan alasan wajib; order berakhir dan tercatat audit log **[KONFIRMASI: apakah bisa dibuka ulang]**.

### 7.4 Tracking & Status
- FR-TRK-01: Timeline pekerjaan dari order sampai selesai.
- FR-TRK-02: Status dokumen fisik vs digital.
- FR-TRK-03: Indikator SLA: aman / mendekati jatuh tempo / terlambat — **per agunan**.
- FR-TRK-04: Peringatan covernote mendekati jatuh tempo **[KONFIRMASI: H-berapa]**.
- FR-TRK-05: **Eskalasi SLA terlampaui**: notifikasi ke atasan langsung & kepala cabang **[KONFIRMASI: penerima & waktu]**.
- FR-TRK-06: **Aturan covernote kedaluwarsa**: order diflag "risiko tinggi" dan pengajuan invoice diblokir sampai covernote diperpanjang **[KONFIRMASI: aturan pasti]**.
- FR-TRK-07: **Progres langkah per jenis** — detail pekerjaan menampilkan daftar langkah sesuai jenis pekerjaan (`job_type_steps`); langkah yang sudah dicatat di `order_progress` ditandai selesai, sehingga monitoring tetap terstandar walau jenis pekerjaan berbeda-beda.

### 7.5 Dokumen, Arsip & Handover
- FR-DOC-01: Upload dokumen pendukung, draft/revisi, dokumen final.
- FR-DOC-02: Validasi dokumen final oleh Admin Legal **yang bukan pembuat order (segregasi tugas, FR-CTL-01)**.
- FR-DOC-03: Arsip digital per nomor rekening/order.
- FR-DOC-04: Unduh dokumen sesuai hak akses.
- FR-DOC-05: **Handover dokumen fisik**: catat penerima, tanggal, metode (kurir/titip/ambil sendiri), dan tanda terima; pencatatan wajib checker **[KONFIRMASI: siapa]** (FR-CTL-01).
- FR-DOC-06: **Spesifikasi upload**: format PDF, ukuran maks per file, jumlah maks per order, penamaan & versioning dokumen (draft → revisi → final) **[KONFIRMASI: batas ukuran & jumlah]**.

### 7.6 Dashboard & Risiko
- FR-DASH-01: Ringkasan pekerjaan aktif, selesai, terlambat, mendekati SLA.
- FR-DASH-02: Kinerja notaris per periode.
- FR-DASH-03: Monitoring per cabang.
- FR-DASH-04: Panel risiko: covernote kedaluwarsa, SLA terlampaui, dokumen fisik belum di-handover.
- FR-DASH-05: Semua role sesuai matriks kewenangan (viewer).

### 7.7 Reporting
- FR-REP-01: Laporan per cabang, per notaris, pekerjaan outstanding.
- FR-REP-02: Laporan covernote selesai/belum selesai & SLA notaris.
- FR-REP-03: Export Excel/PDF **[KONFIRMASI: format & kebutuhan]**.

### 7.8 Master Data & Akun
- FR-MST-01: Master notaris, cabang, jenis pekerjaan, checklist dokumen.
- FR-MST-02: Kelola user & role; aktivasi/nonaktif akun.
- FR-MST-03: **Lifecycle akun notaris**: pembuatan/aktivasi oleh IT Admin, wajib ganti password saat pertama login, penonaktifan langsung mengakhiri sesi aktif (force-logout), riwayat akun tercatat di audit log.

### 7.9 Notifikasi
- FR-NOTIF-01: Notifikasi order baru untuk notaris.
- FR-NOTIF-02: Notifikasi permintaan perbaikan untuk admin legal.
- FR-NOTIF-03: Notifikasi read/unread berbasis tabel.
- FR-NOTIF-04: Reminder SLA & jatuh tempo covernote (bertingkat H-7/H-3/H-1 **[KONFIRMASI]**).
- FR-NOTIF-05: Notifikasi eskalasi SLA terlampaui.
- FR-NOTIF-06: **Matriks notifikasi**: daftar penerima per jenis notifikasi (order baru, permintaan perbaikan, verifikasi invoice, approval pembayaran, handover, SLA, covernote) **[KONFIRMASI: lengkapi penerima & kanal]**.

### 7.10 Audit Log (Jejak Audit)

> Kebutuhan auditor: **semua** aktivitas dapat dilacak hingga ke pelakunya — *who did what, when, from where, on what*.

- FR-AUD-01: Catat seluruh aktivitas: login/logout (termasuk **kegagalan login**), pembuatan/pembaruan/pembatalan order, verifikasi & permintaan perbaikan dokumen per agunan, perpanjangan covernote, upload/unduh/hapus dokumen, validasi dokumen final, handover fisik, seluruh transisi status 4 track, pengajuan/verifikasi/approval invoice & pembayaran, perubahan master data & akun, eskalasi & notifikasi.
- FR-AUD-02: Setiap entri menyimpan: **user ID + nama + role** (identitas terautentikasi — SSO internal atau akun notaris), IP address, user agent, timestamp server (WIB), modul, entitas & ID terkait (order/agunan/dokumen/invoice), aksi, **detail perubahan (nilai sebelum → sesudah)**, keterangan, ID permintaan.
- FR-AUD-03: Aktivitas otomatis (scheduler, queue, sistem) dicatat dengan pelaku `system` beserta konteks pekerjaannya; **tidak ada aksi tanpa identitas pelaku**.
- FR-AUD-04: Audit log **append-only** — tidak dapat diubah/dihapus lewat aplikasi (termasuk oleh admin/IT); upaya mengakses/mengubah log ikut tercatat.
- FR-AUD-05: SKAI/Auditor dapat **filter per pengguna/order/periode/modul** dan **export** (Excel/PDF) tanpa akses ke isi dokumen; laporan jejak audit berkala **[KONFIRMASI: periode]**.
- FR-AUD-06: Retensi mengikuti kebijakan arsip **[KONFIRMASI: berapa tahun]**; opsi **hash chaining** agar manipulasi log terdeteksi **[KONFIRMASI]**.

### 7.11 Pembayaran & Invoice
- FR-PAY-01: Notaris mengajukan invoice (lihat FR-NOT-06).
- FR-PAY-02: Admin Legal **memverifikasi invoice** sebelum ke manajemen (nominal cocok, dokumen final valid, tidak ada covernote kedaluwarsa).
- FR-PAY-03: Manajemen menyetujui/tidak menyetujui pembayaran dengan catatan (status `ditolak_manajemen` di Track D, §10).
- FR-PAY-04: Bukti pembayaran diunggah dan terhubung ke order.
- FR-PAY-05: Status pembayaran terlihat di detail order.

### 7.12 Kontrol & Segregasi Tugas (Maker-Checker-Approver)

> Relevansi: sebagai BPR yang diawasi OJK, prinsip **segregasi tugas, otorisasi berjenjang, dan audit trail** wajib diterapkan dan **dapat dibuktikan oleh sistem** saat pemeriksaan.

- FR-CTL-01: Aksi kritis — **validasi dokumen final, pencatatan handover fisik, pembatalan order, perubahan master data** — wajib memiliki checker yang **berbeda penggunanya** dari maker; sistem menolak jika user sama.
- FR-CTL-02: Pembuatan order (maker: Admin Legal) dapat wajib diperiksa checker internal sebelum dikirim ke notaris **[KONFIRMASI: posisi checker & keharusan]**; wajib 3 level (maker–checker–approver) jika nominal di atas threshold **[KONFIRMASI: besaran]**.
- FR-CTL-03: Alur pembayaran sudah 3 level: notaris (maker/pengaju) → Admin Legal verifikasi (checker) → Manajemen (approver).
- FR-CTL-04: Setiap aksi kritis menyimpan `maker_id`, `checker_id`/`approved_by`, dan timestamp masing-masing.
- FR-CTL-05: Audit log bersifat **append-only** dan tidak ada UI edit/hapus (detail lihat FR-AUD-04); SKAI/Auditor read-only.

---

## 8. Kebutuhan Non-Fungsional

- **Keamanan:** prepared statement semua query; `password_hash()`/`password_verify()`; validasi upload (MIME, ekstensi, ukuran); folder upload tidak bisa eksekusi PHP; CSRF token; session timeout; akses dokumen berbasis role & kepemilikan cabang/notaris.
- **Konfigurasi:** kredensial tidak boleh di-commit; gunakan `.env` + `.env.example`.
- **Keterlacakan:** semua perubahan status, penolakan, dan handover ada di audit log.
- **Kontrol & kepatuhan:** segregasi tugas (maker-checker-approver) untuk aksi kritis (§7.12); audit log append-only; sistem dapat membuktikan SoD saat pemeriksaan OJK/SKAI.
- **Perlindungan data pribadi (UU PDP):** klasifikasi data (data nasabah = data pribadi), enkripsi data sensitif saat transit & disimpan, akses minimal sesuai kebutuhan, dan perjanjian kerahasiaan dengan notaris yang mengakses data pribadi **[KONFIRMASI: aspek legal]**.
- **Operabilitas:** health check endpoint, monitoring error & job (queue/scheduler — pengingat SLA bergantung padanya), peringatan otomatis saat job gagal **[KONFIRMASI: tooling]**.
- **Performa [KONFIRMASI]:** target waktu respons & volume order per hari (acuan awal dari dump legacy: ±19,5rb order selama Jun 2024–Jul 2026 ≈ ±800/bulan — tergolong ringan; konfirmasi angka pasti).
- **Ketersediaan [KONFIRMASI]:** jam operasional, environment produksi (on-prem/cloud), backup.
- **Arsitektur:** Laravel 13 (PHP 8.3), single-app monolith — BE Laravel (Eloquent, queue, scheduler, session & cache di database), FE Inertia + React 19 + **Tailwind CSS 4** (tanpa Bootstrap — UI baru 100% Tailwind); auth Laravel Fortify (+ Passkeys untuk passkey/2FA); document root `public/`; konfigurasi via `.env` (sudah sesuai §8 Konfigurasi). Kode legacy (`be/`, Bootstrap 5 + fetch API) **tidak dibawa** — hanya datanya yang dimigrasi (§12A).
- **Konvensi frontend:** **Laravel React Starter Kit** + **shadcn/ui** (gaya new-york, tema neutral, ikon lucide) sudah terpasang di repo — komponen & layout yang tersedia (button, input, select, dialog, sheet, card, badge, dropdown-menu, sidebar, sonner, skeleton, app-shell, app-sidebar, nav-*, heading, breadcrumbs, password-input, hooks) **dipakai ulang — jangan dibuat baru dari nol**; komponen yang belum tersedia (mis. table, tabs, textarea, pagination) ditambahkan via `npx shadcn@latest add <komponen>`, bukan hand-rolled; routing typed via Wayfinder.
- **Operasi teknis:** reminder SLA & covernote (H-7/H-3/H-1) via Laravel scheduler; notifikasi dikirim via queue; audit log via model observers; backup database & folder upload terjadwal **[KONFIRMASI: frekuensi, retensi backup]**.

---

## 9. Matriks Kewenangan

| Modul/Fitur | Staf Legal & Admin Kredit | Mitra Notaris | Kepala Cabang/Manajemen | IT Administrator | SKAI/Auditor | Checker / Aturan SoD |
|---|---|---|---|---|---|---|
| Input order baru | Maker | — | Approver jika > threshold **[KONFIRMASI]** | — | — | Checker: Kabag/Kasie Kredit **[KONFIRMASI: posisi & keharusan]** |
| Verifikasi dokumen awal | — | Maker | — | — | — | — (pihak eksternal) |
| Penolakan order | — | Maker | — | — | — | Notifikasi otomatis ke Admin Legal |
| Unggah draft & resi BPN | — | Maker | — | — | — | — |
| Validasi dokumen final & penerimaan fisik | Approver | — | — | — | — | **Checker ≠ pembuat order** (ditekan sistem, FR-CTL-01) |
| Handover dokumen fisik (catat) | Maker | — | — | — | — | Checker: Kabag/Kasie Kredit **[KONFIRMASI]** |
| Pembaruan status pekerjaan | Maker | Maker | — | — | — | — |
| Dashboard kinerja & risiko | Viewer | — | Viewer | — | Viewer | — |
| Verifikasi invoice | Maker (sebagai checker) | Maker (pengaju) | — | — | — | Level 3: Approver = Manajemen |
| Persetujuan pembayaran | — | — | Approver | — | — | — |
| Pembatalan order | Maker | — | **[KONFIRMASI]** | — | — | Checker wajib **[KONFIRMASI: siapa]** |
| Kelola master data & akun | — | — | **[KONFIRMASI: boleh mereview?]** | Maker | — | Checker wajib **[KONFIRMASI: siapa]** |
| Log & jejak audit | — | — | — | Viewer | Viewer | Append-only; Auditor dapat export (FR-AUD-05) |

---

## 10. Model Status (4 Track)

Status tidak boleh digabung dalam satu field. Setiap order punya 4 track paralel:

**Track A — Status pekerjaan (per order)**
```
diajukan → menunggu_verifikasi_notaris ⇄ perbaikan_dokumen
        → dokumen_valid → proses_akta → proses_bpn_samsat
        → draft_diunggah → menunggu_validasi_bpr
        → dokumen_final_diunggah → dokumen_fisik_diterima → selesai
        + ditolak_notaris / dibatalkan (dibatalkan hanya sebelum dokumen_final_diunggah — lihat aturan bisnis)
```

**Track B — Status dokumen (per agunan/dokumen)**
```
menunggu_verifikasi → perlu_perbaikan → dokumen_valid
                   → draft_diunggah → final_diunggah → final_divalidasi
```

**Track C — Status covernote (per agunan)**
```
aktif → mendekati_jatuh_tempo → kedaluwarsa (flag risiko tinggi)
     ↘ diperpanjang → kembali aktif (jatuh tempo baru; riwayat → covernote_extensions)
     ↘ diganti_sertifikat (hanya setelah sertifikat asli diterima / di-handover)
```

**Track D — Status pembayaran (per order)**
```
belum_ajuan → diajukan → diverifikasi_admin → disetujui → dibayar
                  ↘ ditolak_admin           ↘ ditolak_manajemen
   (ditolak_* → kembali ke belum_ajuan; boleh diajukan ulang [KONFIRMASI: batas kali])
```

**Aturan bisnis:**
- Covernote kedaluwarsa → pekerjaan diflag risiko tinggi; pengajuan invoice diblokir.
- Invoice hanya bisa diajukan jika Track B = `final_divalidasi` untuk **semua** agunan.
- Penolakan notaris mengakhiri order (status A = `ditolak_notaris`).
- **Agregasi multi-agunan:** tahap Track A dianggap tercapai hanya jika **semua** agunan mencapai tahap setara; jika berbeda, status order mengikuti agunan yang **paling tertinggal** **[KONFIRMASI: aturan agregasi]**.
- **Batasan pembatalan:** `dibatalkan` hanya mungkin **sebelum** `dokumen_final_diunggah`; setelah itu order harus diselesaikan **[KONFIRMASI]**.
- **Jam SLA berhenti** saat menunggu perbaikan (Track A `perbaikan_dokumen`) dan dilanjutkan setelah perbaikan diterima **[KONFIRMASI: pause atau tetap berjalan — soal 18]**.
- **Invoice bersifat per order** (mencakup seluruh agunan dalam satu tagihan) **[KONFIRMASI: per order atau per agunan — soal 19]**.

**Transisi per jenis (terjawab oleh dokumen client, okt 2026):** alur proses **berbeda per jenis pekerjaan** (rincian di §6). Keputusan desain: 4 track tetap berlaku untuk semua jenis; **sub-langkah dalam Track A/B mengikuti master `job_type_steps` per jenis** dan dicatat via `order_progress`. Jalur track terpisah baru diperlukan bila ada jenis di luar dokumen client yang transisinya berbeda **[KONFIRMASI: soal 22]**.

---

## 11. Kebutuhan Data (Entitas Inti)

`users`, `roles`, `permissions`, `role_permissions`, `job_positions` (mapping SSO → role), `branches`, `notaries`, `branch_notary` (notaris rekanan per cabang), `job_types`, `job_type_steps` (langkah proses per jenis), `orders`, `order_collaterals` (menyimpan status per agunan & covernote), `covernote_extensions` (riwayat perpanjangan), `order_documents`, `order_progress`, `order_status_histories`, `order_revisions`, `order_handovers`, `document_checklists`, `order_checklists`, `sla_policies`, `notifications`, `payment_requests`, `payments`, `audit_logs`.

**Kolom kontrol (maker-checker, FR-CTL-04):** `orders.created_by`/`checker_id`, `order_handovers.maker_id`/`checker_id`, `payment_requests.verified_by`/`approved_by`, dengan timestamp per tahap (`made_at`, `checked_at`, `approved_at`). `audit_logs` append-only dengan field identitas pelaku, IP, modul, aksi, dan detail before→after (FR-AUD-02).

**Tabel infrastruktur Laravel (dibuat framework/package):** `sessions`, `jobs`, `failed_jobs`, `cache`, `personal_access_tokens`, tabel passkey/2FA — bukan tabel domain.

**Desain detail:** `docs/ERD.md` — skeleton migrasi `database/migrations/2026_10_13_000001`–`000010` (24 tabel domain baru; total 34 tabel termasuk bawaan framework; siap `migrate`; nilai [KONFIRMASI] tertentu dapat menyesuaikan kolom).

**Pemetaan dari tabel lama:** lihat §12A (dump `app_simontok_bahan.sql`, 14 tabel) — inti: `tabel_form`→`orders`, `tabel_agunan`→`order_collaterals`, `tabel_notaris`→`notaries`, `tabel_pekerjaan_notaris`→`job_types`, `tabel_ceklist_*`→checklist, `tabel_perpanjangan_covernote`→`covernote_extensions`, sisanya 1:1. Tabel `test` tidak dimigrasi.

**[KONFIRMASI]:** retensi arsip dokumen (berapa tahun), kebijakan soft/hard delete.

---

## 12. Integrasi

| Integrasi | Arah | Catatan |
|---|---|---|
| SSO internal | Baca | Login pegawai; role dari `job_position` **[KONFIRMASI: job_position yang didukung]** |
| Core bank | Baca | Data kredit/nasabah/agunan per `kode_kantor`; di-snapshot saat order dibuat **[KONFIRMASI: real-time atau batch]** |
| Email/WhatsApp | Tulis (opsional) | Di luar v1 kecuali disetujui |

---

## 12A. Migrasi Data Lama (Legacy)

**Sumber (sudah ditemukan & diverifikasi):**
- **Dump data:** `database/legacy/app_simontok_bahan.sql` — 17 MB, export DBX (2026-10-13), utf8mb4/InnoDB, **14 tabel**, berisi data nyata nasabah → **tidak boleh di-commit** (sudah masuk `.gitignore`).
- **Kode legacy:** direktori `simonto` di sebelah repo (repo git terpisah; berisi `be/`, `README.md`, `PROGRESS.md`) — dipakai untuk decoding kolom lama.

**Pemetaan tabel → skema baru** (volume dari dump):

| Tabel legacy | Baris | Skema baru | Catatan |
|---|---:|---|---|
| `tabel_form` | 19.480 | `orders` | Kolom snapshot core bank sudah ada (`nama_nasabah`, `plafon`, `baki_debet`, `kolek`, `stat_kred`); `setu` = flag persetujuan |
| `tabel_agunan` | 23.589 | `order_collaterals` | Hanya `no_rekening` + `id_pekerjaan_notaris`; status 4-track diisi default |
| `tabel_notaris` | 126 | `notaries` | `username`/`password` **tidak** dimigrasi |
| `tabel_pekerjaan_notaris` | 13 | `job_types` | Master jenis pekerjaan; + 1 jenis baru dari dokumen client (Surat Kuasa Pelimpahan Hak Pemakaian) → minimal 14 |
| `tabel_ceklist_notaris` | 14 | `document_checklists` | Master checklist; 14 item legacy dipertahankan agar riwayat tetap punya FK, isi baru mengikuti dokumen client per jenis (lihat risiko di bawah) |
| `tabel_ceklist_history` | 132.345 | `order_checklists` (+ riwayat) | State disimpan sebagai teks log → perlu transformasi **[risiko]** |
| `tabel_perpanjangan_covernote` | 821 | `covernote_extensions` | `tgl_covernote_selesai_u` = jatuh tempo baru |
| `audit_logs` | 582 | `audit_logs` | Kolom sudah selaras FR-AUD-02 |
| `app_notifications` | 3 | `notifications` | |
| `notaris_documents` | 3 | `order_documents` | File fisik kemungkinan belum semua terdump **[risiko]** |
| `notaris_document_verifications` | 1 | `order_revisions` / Track B | |
| `notaris_invoice_requests` | 2 | `payment_requests` | `status` lama → petakan ke Track D |
| `notaris_progress_logs` | 0 | `order_progress` | Skema saja |
| `test` | 1 | — | **Tidak dimigrasi** (data uji) |

**Tidak ada di dump** (dari sumber lain): `branches` (dump hanya punya `kode_kantor` — ambil dari SSO/core bank), `users` pegawai (SSO), `sla_policies` (master baru, soal §15.1).

**Risiko & keputusan:**
- `tabel_agunan` tidak punya FK eksplisit ke `tabel_form` (hanya `no_rekening`) — ambigu bila satu rekening punya beberapa order **[KONFIRMASI: wawancara]**.
- Nilai status legacy (`setu`, `covernote`, `kolek`, `stat_kred`) harus dipetakan ke 4-track — decoding memakai kode legacy `simonto/be` **[wawancara]**.
- File fisik lampiran (`potopath` = nama file) — pastikan file ikut terdump/disimpan sebelum migrasi.
- **Checklist dua sumber**: daftar dokumen client (per jenis, ±22 butir unik) berbeda dari 14 item legacy (daftar global). Keputusan: `document_checklists` diisi mengikuti dokumen client per jenis, **ditambah** 14 item legacy dipertahankan agar `tabel_ceklist_history` (132.345 baris) tetap punya FK; nama item duplikat (mis. "KTP an Agunan" vs "KTP pemilik agunan") dipetakan saat migrasi **[KONFIRMASI: nama item final]**.

**Langkah:**
1. Decoding kolom & nilai status legacy bersama admin legal (fase 1, §16).
2. Mapping final ke skema baru (§11).
3. Migrasi bertahap: master data (notaris, jenis pekerjaan, checklist) → order + agunan + covernote → riwayat & dokumen.
4. Validasi: hitung rekaman per tabel, spot-check per cabang, tentukan tanggal cutoff.
5. Cutoff: status order lama setelah go-live **[KONFIRMASI: read-only atau tetap dikerjakan di sistem baru]**.

**Catatan:** akun/kredensial lama **tidak** dimigrasi — akun dibuat ulang dengan kebijakan password baru (FR-AUTH-03).

---

## 13. Ruang Lingkup

**In scope (v1):** auth & RBAC, order (multi-agunan, snapshot), portal notaris (termasuk penolakan), tracking/SLA 4-track, dokumen & arsip + handover fisik, verifikasi & approval pembayaran, dashboard & laporan dasar, master data, audit log, notifikasi dalam aplikasi.

**Out of scope (v1):** pembayaran aktual (hanya pencatatan & bukti), self-service nasabah, mobile app native, integrasi email/WA otomatis, eskalasi otomatis penuh.

---

## 14. Asumsi & Risiko

**Asumsi:** notaris rekanan bersedia login portal; data core bank tersedia via endpoint internal; SSO bisa diperluas untuk role lain.

**Risiko:**
- Pemahaman domain belum tervalidasi → mitigasi: wawancara admin legal & notaris sebelum coding.
- Data lama belum bersih (tabel uji, duplikasi) → mitigasi: inventarisasi & migrasi bertahap.
- Notaris kurang melek digital → mitigasi: UAT & panduan sederhana.
- Transisi hybrid (WA masih dipakai) → mitigasi: catat aktivitas WA penting ke sistem.

---

## 15. Pertanyaan Terbuka (wajib dibahas stakeholder)

1. Berapa hari SLA default per jenis pekerjaan? Beda per cabang?
2. Apa yang terjadi jika covernote kedaluwarsa (blokir order? eskalasi ke siapa)?
3. Satu notaris = satu akun, atau multi-user per kantor notaris?
4. Siapa yang boleh membatalkan order? Apakah notaris boleh menolak order, dan apakah order bisa dibuka ulang setelah ditolak?
5. Bagaimana serah terima dokumen fisik dilakukan (kurir, titip, ambil sendiri)? Apakah butuh tanda terima resmi?
6. Apakah satu order bisa memiliki lebih dari satu agunan dengan jenis pekerjaan berbeda?
7. Apakah invoice diverifikasi admin legal sebelum approval manajemen? Siapa yang menghitung nominal (manual atau otomatis)?
8. Apakah admin kredit cabang lain boleh lihat lintas cabang?
9. Apakah ada alur khusus untuk jenis pekerjaan di luar 6 jenis pengikatan dokumen client (mis. legalisasi, PK, 8 jenis legacy)? **Sebagian terjawab** (§6): alur berbeda untuk Gadai, Cessie, dan Surat Kuasa Pelimpahan Hak Pemakaian.
10. Format laporan yang dibutuhkan manajemen (Excel/PDF, periode)?
11. Environment produksi: on-prem atau cloud? Siapa yang mengelola server?
12. Berapa volume order per hari/per bulan (untuk sizing performa)?
13. Berapa lama retensi arsip dokumen?
14. Reminder SLA/covernote: H-berapa saja, dan lewat apa (dalam aplikasi / email / WA)?
15. Siapa checker untuk pembuatan order, handover fisik, pembatalan order, dan perubahan master data (Kabag Kredit? Kasie? Kepala Cabang)?
16. Berapa threshold nominal order yang wajib approval Kepala Cabang (level 3)?
17. Apakah ada pengecualian SoD untuk cabang dengan keterbatasan staf (mis. validasi final oleh atasan dari cabang lain)?
18. Jam SLA berhenti atau tetap berjalan saat menunggu perbaikan dokumen?
19. Invoice & pembayaran bersifat per order atau per agunan?
20. Apakah diperlukan alur **revisi order** setelah order dikirim ke notaris, atau cukup melalui perbaikan dokumen?
21. Matriks notifikasi: siapa menerima notifikasi apa, dan lewat kanal apa (dalam aplikasi / email / WA)?
22. Apakah dokumen client `docs/simontok nadhif.docx` (6 jenis pengikatan) bersifat **final dan lengkap**? Apakah 8 jenis pekerjaan legacy (Balik Nama, Pensertifikatan, Pecah Bidang, Turun Waris, Hibah, Peningkatan Hak, Penggabungan Sertifikat, Tanpa Pengikatan) tetap digunakan di sistem baru?

---

## 16. Rencana Fase

1. Inventarisasi fitur lama yang masih dipakai
2. Kunci kebutuhan final (PRD ini) dengan BPR & notaris
3. Desain ulang database (ERD 4-track) — **skeleton selesai (`docs/ERD.md` + 9 migrasi)**
4. Struktur Laravel, auth & RBAC (+ kontrol maker-checker)
5. Modul order (multi-agunan, snapshot)
6. Portal notaris (termasuk penolakan)
7. Upload, arsip dokumen & handover fisik
8. Tracking status & SLA (4-track)
9. Pembayaran & invoice
10. Dashboard & laporan
11. Audit log
12. Migrasi data lama
13. UAT dengan cabang, notaris, manajemen, IT, SKAI
14. Bersihkan file lama yang tidak dibutuhkan

**Status saat ini (2026-10-13):** proyek dimulai dari Laravel starter (Laravel 13 + Inertia + React 19) — tersedia kerangka auth (Fortify: login, profile, password, passkey) serta route `welcome` & `dashboard`. **Belum ada** modul bisnis: order, multi-agunan, portal notaris (termasuk penolakan), handover fisik, verifikasi invoice, inbox perbaikan, validasi final, approval invoice, notifikasi tabel, master data. Kode legacy tidak dibawa — hanya datanya yang dimigrasi (§12A).

---

## 17. Kriteria Penerimaan & KPI

- Semua FR punya acceptance criteria sebelum sprint dimulai — didokumentasikan terpisah per FR (format Given/When/Then, file `docs/ACCEPTANCE.md`).
- KPI operasional: % order selesai tepat waktu, rata-rata hari penyelesaian per notaris, jumlah permintaan perbaikan per order, jumlah covernote kedaluwarsa, % dokumen final tervalidasi ≤ SLA.
- KPI tata kelola: % handover fisik terdokumentasi, % invoice diverifikasi sebelum approval, jumlah penolakan & alasannya.
- KPI kontrol: % aksi kritis dengan checker ≠ maker; 100% aksi kritis menyimpan jejak maker/checker/approver.
- KPI sistem: 100% aktivitas (tanpa pengecualian) tercatat audit log dengan identitas pelaku; 0 kredensial di repo.

---

## Lampiran A — Catatan Audit (okt 2026)

- **Repo kerja baru belum `git init`** — wajib `git init` + remote privat (org BPR) sebelum coding. Repo legacy masih PUBLIK di akun GitHub pribadi — harus diprivat/dipindah ke org BPR.
- Kata sandi default hardcode (`bkkjtg123`) dan kredensial dummy (`notaris001/notaris123`) harus dirotasi & dihapus dari dokumentasi.
- Dump legacy **`app_simontok_bahan.sql`** (17 MB, 14 tabel, berisi data nasabah) — dipindah ke `database/legacy/` dan masuk `.gitignore`; **jangan pernah di-commit**. Kode legacy di direktori `simonto` (repo terpisah).
- File template sisa (NewBiz) dan aset duplikat (`lib/` vs `gen/`) ada di repo lama; tidak relevan untuk kode baru.
- `.env` lokal: `APP_DEBUG=true` dan nama database sementara `aktein` (sisa proyek lain) — harus diganti sebelum produksi.
