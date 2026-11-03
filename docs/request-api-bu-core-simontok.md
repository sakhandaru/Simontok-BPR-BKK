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
    "realization_date": "2026-11-03",
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
| `branch.code` | Ya | Kode cabang resmi. |
| `branch.name` | Ya | Nama cabang resmi. |
| `realization_date` | Jika tersedia | Tanggal realisasi/akad yang ditampilkan SIMONTOK. |
| `collaterals` | Ya | Array seluruh agunan yang terhubung. |

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
