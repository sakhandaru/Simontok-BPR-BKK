# Request API BU Core untuk SIMONTOK Baru

> **Status dokumen: Request Pengembangan**
>
> Dokumen ini digunakan sebagai bahan pengembangan dan desain awal API/integrasi BU Core untuk SIMONTOK baru. Dokumen ini belum menjadi kontrak produksi final. Nama endpoint, field, metode autentikasi, aturan otorisasi, dan format respons dapat disesuaikan melalui pembahasan teknis bersama.

## Tujuan

SIMONTOK baru membutuhkan API read-only dari BU Core agar Admin Legal dapat membuat order tanpa mengetik ulang data nasabah, rekening, cabang, dan agunan.

Alur yang diharapkan:

1. Admin Legal mencari berdasarkan nama nasabah atau nomor rekening.
2. API mengembalikan kandidat rekening.
3. Admin memilih satu rekening yang benar.
4. SIMONTOK mengambil detail rekening, cabang, dan seluruh agunan.
5. SIMONTOK membentuk draft order dan menyimpan snapshot data yang dipakai.
6. Admin hanya melengkapi data proses SIMONTOK: notaris, jenis pekerjaan, dokumen/checklist, tanggal proses, dan catatan.

SIMONTOK tidak mengubah data BU Core. Semua endpoint yang diminta di dokumen ini bersifat read-only.

## Ruang lingkup data

### Wajib disediakan

- Pencarian rekening berdasarkan nomor rekening atau nama nasabah.
- Detail rekening/nasabah yang diperlukan untuk order.
- Kode dan nama cabang pemilik rekening.
- Seluruh agunan yang terhubung ke rekening.
- Identitas unik dari rekening, nasabah, cabang, dan agunan untuk disimpan sebagai referensi.

### Pemetaan sumber pada skema BU Core

Berdasarkan dokumentasi skema BU Core yang tersedia di `bu_core-docs.html`, sumber data yang perlu dipertimbangkan oleh tim API adalah:

| Sumber BU Core | Kegunaan di SIMONTOK | Field sumber utama |
|---|---|---|
| `kredit` | Rekening dan detail fasilitas kredit | `no_rekening`, `nasabah_id`, `jml_pinjaman`, `tgl_realisasi`, `tgl_jatuh_tempo`, `kode_kantor`, `kode_produk`, `type_kredit`, `status`, `tgl_lunas`, `tgl_pengikatan`, `kode_notaris`, `status_rek` |
| `nasabah` | Identitas dan data kontak nasabah | `nasabah_id`, `nama_nasabah`, `status_perkawinan`, `alamat`, `jenis_id`, `no_id`, `telpon`, `hp`, `email`, `alamat_ktp`, `alamat_surat`, `npwp` |
| `kre_agunan_relasi` | Relasi rekening dan agunan | `agunan_id`, `no_rekening`, `kode_kantor`, `primer`, `status` |
| `kre_agunan` | Detail agunan dan data legalnya | `AGUNAN_ID`, `KODE_JENIS_AGUNAN`, `DESKRIPSI_RINGKAS`, `JENIS_AGUNAN`, `JENIS_PENGIKATAN`, `PEMILIK_AGUNAN`, `BUKTI_MILIK`, `ALAMAT_AGUNAN`, `NILAI_AGUNAN`, `NILAI_AGUNAN_BANK`, `NILAI_AGUNAN_PENILAI`, `TGL_PENILAIAN`, serta field detail tanah/kendaraan sesuai jenis agunan |
| `app_kode_kantor` | Master cabang | `KODE_KANTOR`, `NAMA_KANTOR`, `ALAMAT_KANTOR`, `KOTA_KANTOR`, status/keterangan cabang yang aman untuk diekspos |
| `kre_kode_jenis_agunan` | Label jenis agunan | `KODE_JENIS_AGUNAN`, `DESKRIPSI_JENIS_AGUNAN` |
| `kre_produk` | Label/metadata produk kredit jika diperlukan | `kode_produk`, `DESKRIPSI_PRODUK`, `TYPE_KREDIT_DEFAULT`, `kode_pembiayaan` |

`kredit_history` tidak menjadi kebutuhan versi awal karena sistem baru tidak menggunakan `baki_debet` atau data saldo historis. Endpoint history hanya dibuat jika ada kebutuhan monitoring yang disetujui kemudian.

API sebaiknya menggabungkan dan menerjemahkan tabel-tabel tersebut menjadi response bisnis. SIMONTOK tidak perlu mengetahui atau mengakses join database BU Core secara langsung.

### Field wajib versi awal dari pemetaan skema

Untuk pembuatan order SIMONTOK, field minimal yang perlu tersedia adalah:

| Kelompok | Field response API | Keterangan |
|---|---|---|
| Rekening | `account_id`, `account_number` | Identifier stabil dan nomor rekening sebagai string. |
| Nasabah | `customer_id`, `customer_name`, `customer.marital_status` | Identitas nasabah dan status perkawinan untuk menentukan kebutuhan dokumen pasangan. |
| Cabang | `branch.code`, `branch.name` | Cabang pemilik rekening dan scope akses. |
| Kredit | `credit.loan_amount`, `credit.realization_date` | `credit.loan_amount` ditampilkan sebagai **Plafon** di SIMONTOK dan bersumber dari `kredit.jml_pinjaman`, bukan baki debet. |
| Agunan | `collateral_id`, `collateral_code`, `type_code`, `type_name`, `description` | Seluruh agunan yang terhubung ke rekening. |
| Relasi | `account_id`, `is_primary`, `status` | Untuk memastikan agunan benar-benar terkait rekening tersebut. |

### Field kandidat untuk pengembangan

Field berikut tersedia atau dapat diturunkan dari skema BU Core, tetapi belum menjadi syarat order versi awal:

- `credit_product_code` dan `credit_product_name` dari `kredit.kode_produk`/`kre_produk`;
- `credit_type` dari `kredit.type_kredit`;
- `maturity_date` dari `kredit.tgl_jatuh_tempo`;
- `account_status` dari status rekening/kredit;
- `paid_off_date` dari `kredit.tgl_lunas`;
- `binding_date` dari `kredit.tgl_pengikatan`;
- `notary_code` dari `kredit.kode_notaris`, hanya sebagai referensi dan bukan pengganti notaris rekanan SIMONTOK;
- detail legal agunan seperti jenis pengikatan, pemilik, bukti kepemilikan, alamat, nomor sertifikat/BPKB, dan data penilaian;
- data identitas nasabah seperti alamat, nomor identitas, tanggal lahir, kontak, dan NPWP jika benar-benar diperlukan untuk dokumen legal.

Field identitas dan legal agunan termasuk data sensitif. Penggunaannya harus disetujui oleh pemilik proses dan tim keamanan/privasi sebelum dimasukkan ke response API atau snapshot SIMONTOK.

### Tidak diperlukan untuk sistem baru

Jangan masukkan field berikut kecuali ada kebutuhan bisnis baru yang disetujui:

- `baki_debet`;
- `kolek`;
- `stat_kred`;
- field saldo atau status legacy lain yang tidak digunakan oleh workflow SIMONTOK.

Data status pekerjaan notaris, dokumen, covernote, checklist, SLA, pembayaran, dan audit log bukan sumber BU Core. Data tersebut dikelola oleh SIMONTOK.

### Kandidat kebutuhan untuk pengembangan lanjutan

Field berikut belum ditetapkan sebagai kebutuhan wajib versi awal, tetapi sebaiknya dipertimbangkan saat desain API agar dapat dikembangkan tanpa perubahan besar:

- status rekening masih aktif/lunas;
- jenis atau produk kredit;
- tanggal jatuh tempo kredit;
- detail legal agunan tambahan;
- nama/identitas pemilik agunan;
- nilai atau taksasi agunan;
- status keterikatan agunan;
- endpoint refresh atau validasi ulang data Core sebelum order dikirim;
- versioning response API agar perubahan kontrak dapat dikelola.

Field kandidat hanya ditambahkan ke response jika memang tersedia di BU Core dan disetujui sebagai kebutuhan bisnis. Jangan menjadikan field tersebut syarat pembuatan order versi awal tanpa keputusan tertulis.

## API yang diminta

Nama/path endpoint dapat disesuaikan dengan standar API internal. Struktur respons sebaiknya mengikuti kontrak di bawah.

### 1. Cari rekening

```http
GET /api/v1/simontok/credit-accounts?query={keyword}&branch_code={kode_kantor}&limit=20
```

Parameter:

| Parameter | Wajib | Keterangan |
|---|---:|---|
| `query` | Ya | Nomor rekening atau nama nasabah; minimal 3 karakter jika pencarian nama. |
| `branch_code` | Kondisional | Diisi untuk membatasi pencarian sesuai cabang user. User pusat dapat mengosongkan bila diizinkan. |
| `limit` | Tidak | Default 20, maksimum 50. |

Respons contoh:

```json
{
  "data": [
    {
      "account_id": "CORE-ACCOUNT-123",
      "account_number": "001234567890",
      "customer_id": "CORE-CUSTOMER-456",
      "customer_name": "Nama Nasabah",
      "branch": {
        "code": "001",
        "name": "Kantor Cabang Contoh"
      },
      "selectable": true
    }
  ],
  "meta": {
    "limit": 20,
    "count": 1
  }
}
```

Catatan:

- Nomor rekening harus dikembalikan sebagai string agar angka nol di depan tidak hilang.
- Pencarian nama dapat menghasilkan lebih dari satu hasil; SIMONTOK tidak boleh memilih otomatis.
- `account_id` atau identifier stabil lain dibutuhkan untuk mengambil detail secara aman.

### 2. Detail rekening dan nasabah

```http
GET /api/v1/simontok/credit-accounts/{account_id}
```

Respons minimal:

```json
{
  "data": {
    "account_id": "CORE-ACCOUNT-123",
    "account_number": "001234567890",
    "customer": {
      "customer_id": "CORE-CUSTOMER-456",
      "name": "Nama Nasabah"
    },
    "branch": {
      "code": "001",
      "name": "Kantor Cabang Contoh"
    },
    "credit": {
      "loan_amount": 100000000,
      "realization_date": "2026-11-03"
    },
    "collaterals": []
  }
}
```

Field detail:

| Field | Wajib | Keterangan |
|---|---:|---|
| `account_id` | Ya | ID unik internal/API BU Core. |
| `account_number` | Ya | Nomor rekening sebagai string. |
| `customer.customer_id` | Disarankan | ID unik nasabah. |
| `customer.name` | Ya | Nama nasabah untuk snapshot order. |
| `customer.marital_status` | Ya | Status perkawinan yang dinormalisasi, minimal `married` atau `single`; diperlukan untuk aturan KTP pasangan. |
| `branch.code` | Ya | Kode cabang resmi. |
| `branch.name` | Ya | Nama cabang resmi. |
| `credit.loan_amount` | Jika digunakan | Nilai pinjaman/plafon dari `kredit.jml_pinjaman`; di form SIMONTOK dipetakan menjadi `plafon`. Bukan `baki_debet`. |
| `credit.realization_date` | Jika tersedia | Tanggal realisasi/akad yang ditampilkan SIMONTOK. |
| `collaterals` | Ya | Array seluruh agunan yang terhubung. |

`credit.loan_amount` adalah sumber field **Plafon** pada form order SIMONTOK. Setelah rekening dipilih, SIMONTOK mengisi nilai ini otomatis, menjadikannya read-only, dan menyimpannya sebagai bagian dari snapshot order.

### Aturan dokumen pasangan

Jika `customer.marital_status` bernilai `married`/`kawin`/`menikah`, checklist **KTP pasangan** harus diperlakukan sebagai dokumen wajib. Jika bernilai `single`/`belum_menikah`, checklist tersebut bersifat opsional. Jika status tidak tersedia atau tidak dapat dinormalisasi, SIMONTOK sebaiknya menahan pengajuan sampai status dikonfirmasi; jangan menganggap KTP pasangan otomatis tidak diperlukan.

Jangan mengirim data sensitif yang tidak diperlukan oleh proses order.

### 3. Daftar agunan rekening

Jika tidak digabungkan dalam endpoint detail, sediakan endpoint terpisah:

```http
GET /api/v1/simontok/credit-accounts/{account_id}/collaterals
```

Respons contoh:

```json
{
  "data": [
    {
      "collateral_id": "CORE-COLLATERAL-789",
      "collateral_code": "AG-000123",
      "type_code": "TANAH_BANGUNAN",
      "type_name": "Tanah dan Bangunan",
      "description": "SHM No. 123 atas nama ...",
      "legal_reference": "SHM-123",
      "account_id": "CORE-ACCOUNT-123"
    }
  ]
}
```

Field minimal:

- `collateral_id` — identifier stabil dari BU Core;
- `collateral_code` — kode/nomor agunan jika tersedia;
- `type_code` dan `type_name` — jenis agunan;
- `description` — deskripsi agunan;
- `legal_reference` — nomor dokumen legal jika tersedia;
- `account_id` — rekening pemilik agunan.

Jika satu rekening memiliki beberapa agunan, seluruhnya harus dikembalikan. SIMONTOK akan membuat satu `order_collaterals` untuk setiap agunan.

### 4. Master cabang

```http
GET /api/v1/simontok/branches?active=true
```

Respons minimal:

```json
{
  "data": [
    {
      "code": "001",
      "name": "Kantor Cabang Contoh",
      "is_active": true
    }
  ]
}
```

Sumber legacy yang perlu dijadikan referensi bila masih relevan adalah `app_kode_kantor` dengan kolom `KODE_KANTOR` dan `NAMA_KANTOR`. API sebaiknya tidak mengekspos nama tabel database kepada SIMONTOK.

## Pembatasan akses

API harus mendukung pembatasan berdasarkan kode cabang:

- user cabang hanya boleh mencari rekening dari cabangnya;
- user pusat dapat mencari lintas cabang hanya jika role-nya mengizinkan;
- API tetap melakukan validasi otorisasi, bukan hanya mengandalkan filter dari frontend;
- akses ke endpoint dicatat di log API bila standar keamanan internal mengharuskannya.

Jika otorisasi sudah dilakukan oleh SSO/API Gateway, jelaskan claim/header yang harus dikirim SIMONTOK, misalnya employee ID, role, dan branch code.

## Autentikasi dan keamanan

Mohon tentukan:

- metode autentikasi: OAuth2 client credentials, service account, mTLS, atau standar internal lain;
- base URL untuk development, staging, dan production;
- header/token yang wajib dikirim;
- timeout dan rate limit;
- apakah API hanya dapat diakses dari jaringan internal/VPN;
- format correlation/request ID;
- kebijakan masking data pribadi pada log;
- sertifikat atau CA yang diperlukan.

SIMONTOK hanya memerlukan akses baca. Tidak diperlukan endpoint untuk insert/update/delete data BU Core.

## Arsitektur integrasi dan database staging

BU Core tetap menjadi sumber kebenaran utama. SIMONTOK tidak mengakses tabel BU Core secara langsung dan tidak menjadikan database staging sebagai pengganti sumber resmi.

Alur produksi yang diharapkan:

```text
BU Core API
    ↓
API adapter / sinkronisasi SIMONTOK
    ↓
Database staging atau read model SIMONTOK
    ↓
Pencarian dan pengisian form order
    ↓
Snapshot permanen pada order
```

Database staging digunakan sebagai read model untuk pencarian cepat, mengurangi beban API BU Core, dan menjaga aplikasi tetap dapat membaca data terakhir yang berhasil disinkronkan. Data staging tidak boleh dianggap lebih authoritative daripada BU Core.

Read model minimal yang perlu disediakan SIMONTOK:

| Read model | Isi utama |
|---|---|
| `core_staged_accounts` | `account_id`, `account_number`, `customer_id`, `customer_name`, `credit.loan_amount`, `credit.realization_date`, `branch.code`, `branch.name`, `source_provider`, `synced_at`, `expires_at` |
| `core_staged_collaterals` | `account_id`, `collateral_id`, `collateral_code`, `type_code`, `type_name`, `description`, `is_primary`, `status`, `synced_at` |

Nama tabel di atas adalah usulan internal SIMONTOK dan tidak perlu sama dengan nama tabel BU Core. Jika API BU Core mengembalikan response gabungan, SIMONTOK tetap memisahkan data rekening dan agunan pada read model agar pencarian dan pembaruan dapat dilakukan secara efisien.

### Sinkronisasi

Sinkronisasi staging harus memiliki ketentuan berikut:

- berjalan terjadwal, minimal setiap jam atau sesuai SLA API BU Core;
- dapat dijalankan ulang secara manual untuk kebutuhan UAT dan troubleshooting;
- menyimpan waktu sinkronisasi terakhir dan waktu kedaluwarsa setiap record;
- menggunakan transaksi per rekening agar kegagalan satu rekening tidak merusak data rekening lain;
- mengganti daftar agunan secara atomik setelah detail rekening berhasil diambil;
- mencatat jumlah berhasil, gagal, dilewati, dan waktu proses;
- tidak menghapus data staging hanya karena satu kali request API gagal;
- memiliki retry dengan backoff untuk timeout dan HTTP `429`/`503`;
- tidak menimpa data dengan response parsial atau data yang tidak tervalidasi.

Endpoint atau mekanisme sinkronisasi yang diminta dari tim BU Core:

- pencarian atau daftar rekening yang dapat diproses bertahap/pagination;
- detail rekening berdasarkan `account_id`;
- detail seluruh agunan rekening;
- optional: `updated_since` atau cursor perubahan agar sinkronisasi tidak perlu mengambil seluruh data setiap kali.

### TTL dan data kedaluwarsa

TTL read model harus dapat dikonfigurasi per environment. Nilai awal yang disarankan untuk staging/UAT adalah 60 menit, lalu disesuaikan berdasarkan SLA dan frekuensi perubahan data BU Core.

Ketika record staging sudah melewati `expires_at`:

- record tidak boleh dipakai diam-diam untuk membuat order baru;
- sistem mencoba refresh dari BU Core atau menampilkan pesan bahwa data perlu dimuat ulang;
- order lama tetap dapat dibaca karena menggunakan snapshot order;
- kegagalan refresh ditampilkan sebagai error yang dapat dicoba ulang, bukan sebagai data kosong yang menyesatkan.

### Validasi ulang sebelum order dikirim

Staging dipakai untuk pencarian dan pengisian awal. Sebelum order dikirim untuk approval, backend perlu mengambil detail rekening terbaru dari BU Core API jika layanan tersedia, lalu memvalidasi:

- `account_id` masih ada dan dapat diakses user;
- rekening masih berada pada cabang yang diizinkan;
- nomor rekening dan customer ID sesuai dengan rekening yang dipilih;
- plafon dari `credit.loan_amount` masih dapat digunakan;
- seluruh `collateral_id` pada order masih terhubung ke rekening;
- agunan tidak berstatus tidak aktif atau terhapus jika status tersebut disediakan API.

Jika validasi ulang gagal karena rekening berubah, berada di luar scope, atau agunan tidak lagi sesuai, pengiriman order harus ditolak dan admin diminta memuat ulang data. Jika BU Core sedang tidak tersedia, kebijakan harus dipilih secara eksplisit oleh pemilik proses. Rekomendasi default untuk produksi adalah menolak submit baru dan mengizinkan retry; jangan menggunakan data staging kedaluwarsa secara diam-diam.

Validasi ulang tidak boleh mengubah snapshot order lama secara otomatis. Jika data terbaru berbeda, perbedaan dicatat dan admin harus memilih tindakan yang sesuai.

## Status implementasi UAT saat ini

Sebelum API BU Core produksi tersedia, UAT menggunakan provider dummy dengan alur yang sama:

```text
Dummy Core
    ↓ core:sync-staging
Database staging SIMONTOK
    ↓
Pencarian rekening, plafon, dan agunan
    ↓
Validasi backend
    ↓
Snapshot order
```

Implementasi UAT saat ini sudah memiliki:

- provider dummy untuk rekening, nasabah, cabang, plafon, dan agunan;
- read model staging rekening dan agunan;
- TTL staging yang dapat dikonfigurasi;
- sinkronisasi staging manual dan terjadwal;
- pengisian otomatis form berdasarkan rekening terpilih;
- snapshot data Core pada order;
- pembatasan scope cabang pada pencarian dan penyimpanan order.

Yang belum dapat diaktifkan sebelum informasi dari tim BU Core tersedia:

- API adapter produksi;
- base URL tiap environment;
- autentikasi dan credential/service account;
- validasi ulang langsung ke BU Core sebelum submit;
- retry policy dan SLA yang disepakati;
- rekonsiliasi perubahan data dari BU Core.

Saat API produksi siap, form order dan struktur snapshot tidak perlu diubah. Yang perlu diganti adalah source pada command sinkronisasi, adapter response, konfigurasi autentikasi, dan proses validasi ulang sebelum submit.

## Error response

Mohon gunakan HTTP status yang konsisten, minimal:

| Status | Arti |
|---:|---|
| `400` | Parameter pencarian tidak valid. |
| `401` | Token tidak valid/tidak ada. |
| `403` | User tidak berhak mengakses cabang atau data. |
| `404` | Rekening/agunan tidak ditemukan. |
| `409` | Data memiliki konflik/keadaan yang perlu ditangani. |
| `429` | Rate limit terlampaui. |
| `500`/`503` | Layanan BU Core sedang bermasalah. |

Format error yang diharapkan:

```json
{
  "error": {
    "code": "ACCOUNT_NOT_FOUND",
    "message": "Data rekening tidak ditemukan.",
    "request_id": "req-20261103-000001"
  }
}
```

SIMONTOK akan menampilkan pesan retry ketika BU Core tidak tersedia. Mekanisme fallback input manual perlu diputuskan secara eksplisit; default yang lebih aman adalah tidak mengizinkan order dibuat tanpa data Core yang tervalidasi.

## Snapshot di SIMONTOK

Saat admin memilih rekening dan menyimpan order, SIMONTOK akan menyimpan snapshot minimal:

- identifier rekening dari BU Core;
- nomor rekening;
- identifier nasabah dan nama nasabah;
- kode/nama cabang;
- plafon dari `credit.loan_amount`;
- tanggal realisasi jika digunakan;
- identifier, jenis, dan deskripsi setiap agunan;
- waktu pengambilan data;
- versi atau sumber API jika tersedia.

Perubahan data di BU Core setelah order dibuat tidak boleh mengubah snapshot order lama secara otomatis.

## Acceptance criteria

Integrasi dianggap siap apabila:

- pencarian berdasarkan nomor rekening mengembalikan rekening yang benar;
- pencarian berdasarkan nama mengembalikan kandidat dan tidak memilih otomatis;
- rekening dari luar scope cabang ditolak oleh API;
- detail rekening mengembalikan data yang dibutuhkan form order baru;
- seluruh agunan rekening dikembalikan tanpa perlu input manual;
- nomor rekening dan ID agunan tidak kehilangan angka nol di depan;
- response tidak mengandung `baki_debet`, `kolek`, atau `stat_kred` kecuali kebutuhan tersebut disetujui kemudian;
- error, timeout, dan data tidak ditemukan dapat ditangani SIMONTOK;
- tersedia endpoint dan credential untuk environment development/test;
- tersedia contoh request/response dan dokumentasi OpenAPI/Swagger;
- tersedia data uji untuk rekening dengan nol, satu, dan beberapa agunan.

## Informasi yang diminta dari tim Database/API

Mohon diberikan:

1. Base URL setiap environment.
2. Spesifikasi OpenAPI/Swagger atau dokumentasi endpoint.
3. Metode autentikasi dan credential/service account untuk development.
4. Daftar field final beserta tipe data dan aturan nullability.
5. Aturan pembatasan berdasarkan cabang dan role.
6. Contoh response untuk rekening tanpa agunan dan multi-agunan.
7. Daftar kode error dan retry policy.
8. SLA/ketersediaan API dan rate limit.
9. Kontak teknis untuk pengujian integrasi.
10. Konfirmasi apakah master cabang diambil real-time atau melalui sinkronisasi berkala.

## Catatan penggunaan dokumen

Dokumen ini dibuat untuk diberikan kepada tim yang menangani database dan API sebagai dasar pengembangan. Setelah tim tersebut memberikan spesifikasi endpoint dan contoh response nyata, SIMONTOK akan menyesuaikan:

- service client API;
- form pencarian dan pemilihan rekening;
- pengisian otomatis detail nasabah, cabang, dan agunan;
- validasi scope cabang;
- struktur snapshot pada order;
- penanganan timeout, retry, dan data tidak ditemukan.

Koneksi langsung dari SIMONTOK ke tabel database BU Core bukan target desain. Jika database menjadi sumber API, detail tabel internal tetap berada di sisi API dan tidak menjadi ketergantungan langsung aplikasi SIMONTOK.
