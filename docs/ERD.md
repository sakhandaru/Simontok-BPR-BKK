# ERD — SIMONTOK (v1 skeleton)

| | |
|---|---|
| **Dokumen terkait** | `docs/PRD.md` DRAFT v0.10 |
| **Tanggal** | 2026-10-13 |
| **Status** | Skeleton — kolom & relasi final menunggu jawaban [KONFIRMASI] di §15 PRD sebelum `migrate` ke produksi |
| **Migrasi** | `database/migrations/2026_10_13_000001`–`000010` (10 file) |

## Konvensi

- Laravel/Eloquent: `snake_case` plural; `id()` bigints; FK via `foreignId()->constrained()`.
- **Status 4 track = kolom string** di tabel terkait, bukan tabel terpisah; di kode PHP diwujudkan sebagai *backed enum* (`App\Enums\TrackAStatus`, `TrackBDocStatus`, `TrackCCovernoteStatus`, `TrackDPaymentStatus`) — nilai persis di §Enum.
- **Riwayat** transisi status = `order_status_histories`; riwayat perpanjangan covernote = `covernote_extensions`.
- **Kolon kontrol maker-checker** (FR-CTL-04): `created_by`/`maker_id` + `checked_by` + timestamp per tahap (`made_at`, `checked_at`, `verified_at`, `approved_at`).
- **Master** (`branches`, `job_types`, `job_type_steps`, `notaries`, `document_checklists`) pakai `softDeletes` (kebijakan final [KONFIRMASI]); `orders` & `audit_logs` **tanpa** soft delete.
- **`audit_logs` append-only**: tanpa `updated_at`, tanpa UI edit/hapus (FR-AUD-04).
- Kolom `legacy_id` pada tabel yang dimigrasi (`orders`, `order_collaterals`, `notaries`) untuk jejak `id_*` lama.

## Diagram Relasi

```mermaid
erDiagram
    branches ||--o{ orders : "asal order"
    notaries ||--o{ orders : "menerima order"
    branches ||--o{ branch_notary : ""
    notaries ||--o{ branch_notary : "rekanan cabang"
    branches ||--o{ sla_policies : "opsional"
    job_types ||--o{ sla_policies : "SLA"
    job_types ||--o{ order_collaterals : "jenis pekerjaan"
    job_types ||--o{ document_checklists : "checklist per jenis"
    job_types ||--o{ job_type_steps : "langkah proses"

    orders ||--o{ order_collaterals : "multi-agunan"
    orders ||--o{ order_documents : ""
    orders ||--o{ order_progress : ""
    orders ||--o{ order_status_histories : "riwayat 4-track"
    orders ||--o{ order_revisions : "perbaikan"
    orders ||--o{ order_handovers : "serah terima fisik"
    orders ||--o{ order_checklists : ""
    orders ||||--o| payment_requests : "1 invoice (saat ini)"
    payment_requests ||--o{ payments : "bukti bayar"

    order_collaterals ||--o{ covernote_extensions : "perpanjangan"
    order_collaterals ||--o{ order_documents : "per agunan"
    order_collaterals ||--o{ order_checklists : "per agunan"
    order_collaterals ||--o{ order_handovers : "[KONFIRMASI]"

    roles ||--o{ role_permissions : ""
    permissions ||--o{ role_permissions : ""
    roles ||--o{ job_positions : "mapping SSO"
    job_positions ||--o{ users : ""
    branches ||--o{ users : "pegawai"
    notaries ||--o{ users : "akun notaris"
```

## Enum Status (dari PRD §10)

| Track | Kolom | Nilai |
|---|---|---|
| A — pekerjaan (order) | `orders.status` | `diajukan`, `menunggu_verifikasi_notaris`, `perbaikan_dokumen`, `dokumen_valid`, `proses_akta`, `proses_bpn_samsat`, `draft_diunggah`, `menunggu_validasi_bpr`, `dokumen_final_diunggah`, `dokumen_fisik_diterima`, `selesai`, `ditolak_notaris`, `dibatalkan` |
| B — dokumen (agunan) | `order_collaterals.doc_status` | `menunggu_verifikasi`, `perlu_perbaikan`, `dokumen_valid`, `draft_diunggah`, `final_diunggah`, `final_divalidasi` |
| C — covernote (agunan) | `order_collaterals.covernote_status` | `aktif`, `mendekati_jatuh_tempo`, `diperpanjang`*, `diganti_sertifikat`, `kedaluwarsa` |
| D — pembayaran (order) | `payment_requests.status` | `diajukan`, `diverifikasi_admin`, `disetujui`, `dibayar`, `ditolak_admin`, `ditolak_manajemen` |

\* `diperpanjang` dicatat sebagai event di `covernote_extensions`; status kembali ke `aktif` dengan `covernote_end` baru.

## Tabel per Kelompok

### Master & RBAC (migrasi 000001–000003)

| Tabel | Kolom inti |
|---|---|
| `branches` | `code` (unik, = kode_kantor), `name`, `is_active` |
| `job_types` | `code` (unik), `name`, `is_active` |
| `sla_policies` | `job_type_id` FK, `branch_id` FK nullable (null = semua cabang), `days`; unik `(job_type_id, branch_id)` |
| `job_type_steps` (migrasi 000010) | `job_type_id` FK, `name`, `sort_order`, `is_active`; langkah proses per jenis sesuai dokumen client |
| `roles` | `code` (unik), `name`, `description` |
| `permissions` | `code` (unik), `name`, `module` |
| `role_permissions` | `role_id`, `permission_id`; unik keduanya |
| `job_positions` | `code` SSO (unik), `name`, `role_id` FK nullable |
| `notaries` | `name`, `address`, `phone`, `email`, `sk_notary`, `sk_ppat`, `pks_no`, `pks_start/end`, `is_active`, `legacy_id` |
| `branch_notary` | `branch_id`, `notary_id`; unik keduanya |
| `users` (alter 000009) | + `branch_id`, `notary_id`, `job_position_id` (nullable FK), `is_active` |

### Order & Agunan (migrasi 000004)

| Tabel | Kolom inti |
|---|---|
| `orders` | `order_no` (unik), `branch_id` FK, `notary_id` FK, `legacy_id`; snapshot: `customer_name`, `no_rekening`, `tgl_realisasi`, `plafon`, `baki_debet`, `kolek`, `stat_kred`; `tgl_masuk_notaris`, `nominal`, `skema_pembayaran`; **Track A**: `status`, `risk_flag`, `sla_due_at`; kontrol: `created_by`, `checked_by`, `checked_at`, `sent_to_notary_at` |
| `order_collaterals` | `order_id` FK, `job_type_id` FK, `agunan_id`, `deskripsi_agunan`, `legacy_id`; **Track B**: `doc_status`; **Track C**: `covernote_no`, `covernote_start`, `covernote_end`, `covernote_status`, `extension_count`; `sla_due_at` |
| `covernote_extensions` | `order_collateral_id` FK, `old_end`, `new_end`, `extended_by` FK, `catatan`, `file_path` |

### Workflow (migrasi 000005)

| Tabel | Kolom inti |
|---|---|
| `document_checklists` | `name`, `job_type_id` FK nullable, `is_active` |
| `order_checklists` | `order_id`, `order_collateral_id`, `document_checklist_id`, `is_checked`, `checked_by`, `checked_at`, `catatan`; unik `(order_collateral_id, document_checklist_id)` |
| `order_progress` | `order_id`, `order_collateral_id` nullable, `status`, `catatan`, `komitmen_penyelesaian`, `created_by` |
| `order_status_histories` | `order_id`, `order_collateral_id` nullable, `track` (A/B/C/D), `from_status`, `to_status`, `actor_type` (user/notary/system), `actor_id`, `reason` |
| `order_revisions` | `order_id`, `order_collateral_id` nullable, `revision_no` (unik per order), `requested_by`, `alasan`, `status` (diajukan/diperbaiki/selesai), `fixed_by`, `fixed_at`, `catatan_admin` |

### Dokumen, Handover & Notifikasi (migrasi 000006)

| Tabel | Kolom inti |
|---|---|
| `order_documents` | `order_id`, `order_collateral_id` nullable, `document_type` (dokumen_awal/draft/resi_bpn/final/bukti_bayar/tanda_terima/lainnya), `version`, `original_name`, `stored_name`, `stored_path`, `mime_type`, `file_size`, `uploaded_by`, `validated_by`, `validated_at` |
| `order_handovers` | `order_id`, `order_collateral_id` nullable [KONFIRMASI: per order/per agunan], `receiver_name`, `method` (kurir/titip/ambil_sendiri), `handed_over_at`, `receipt_path`, `maker_id`, `checked_by`, `made_at`, `checked_at` |
| `notifications` | `recipient_type` (user/notary), `recipient_id`, `title`, `message`, `link_url`, `is_read`, `read_at` |

### Pembayaran & Audit (migrasi 000007–000008)

| Tabel | Kolom inti |
|---|---|
| `payment_requests` | `order_id` (unik = 1 invoice per order [KONFIRMASI]), `invoice_no`, `nominal`, `skema_pembayaran`; **Track D**: `status`; jejak 3 level: `requested_at` → `verified_by/at` + `catatan_verifikasi` → `approved_by/at` / `rejected_by/at` + `catatan_approver`; `paid_at` |
| `payments` | `payment_request_id`, `order_id`, `paid_at`, `nominal`, `bukti_path`, `uploaded_by`, `catatan` |
| `audit_logs` | `actor_type`, `actor_id`, `actor_name`, `role_code`, `module`, `entity_type`, `entity_id`, `action`, `description`, `route`, `method`, `ip_address`, `user_agent`, `payload` (JSON before→after), `created_at` (index) — **tanpa `updated_at`** |

## Peta Migrasi → Tabel

| File | Membuat |
|---|---|
| `2026_10_13_000001_create_simontok_master_tables` | branches, job_types, sla_policies |
| `2026_10_13_000002_create_rbac_tables` | roles, permissions, role_permissions, job_positions |
| `2026_10_13_000003_create_notaries_tables` | notaries, branch_notary |
| `2026_10_13_000004_create_orders_tables` | orders, order_collaterals, covernote_extensions |
| `2026_10_13_000005_create_order_workflow_tables` | document_checklists, order_checklists, order_progress, order_status_histories, order_revisions |
| `2026_10_13_000006_create_documents_handovers_notifications_tables` | order_documents, order_handovers, notifications |
| `2026_10_13_000007_create_payment_tables` | payment_requests, payments |
| `2026_10_13_000008_create_audit_logs_table` | audit_logs |
| `2026_10_13_000009_add_simontok_columns_to_users_table` | alter users (+branch_id, notary_id, job_position_id, is_active) |
| `2026_10_13_000010_create_job_type_steps_table` | job_type_steps |

Tabel framework (`users`, `password_reset_tokens`, `sessions`, `cache`, `jobs`, passkeys, 2FA) dari migrasi bawaan starter kit — tidak didesain ulang.

## Keputusan skema yang menunggu [KONFIRMASI] (PRD §15)

| # | Keputusan | Dampak skema |
|---|---|---|
| 3 | Multi-user per kantor notaris | desain `users.notary_id` sudah mendukung; bila sebaliknya, cukup 1 user per notary |
| 6 | Satu order multi jenis pekerjaan berbeda | didukung: `order_collaterals.job_type_id` per agunan |
| 7/19 | Invoice per order atau per agunan | `payment_requests.order_id` UNIQUE — bila per agunan: ganti ke `(order_id, order_collateral_id)` |
| 5 | Handover per order atau per agunan | `order_collaterals.order_collateral_id` nullable — bila wajib per agunan, hilangkan nullable |
| 1 | SLA default & hari kerja | isi `sla_policies.days`; perlu keputusan kalender kerja (weekend/libur) |
| 15/16 | Checker & threshold approval | kolom sudah ada; threshold disimpan di konfigurasi (belum ada tabel `settings`) |
| 13 | Retensi arsip & soft/hard delete | kebijakan soft delete master saat ini bersifat sementara |

## Catatan implementasi berikutnya

- Seed: 14 `job_types` (13 dari dump legacy + Surat Kuasa Pelimpahan Hak Pemakaian dari dokumen client), `job_type_steps` sesuai alur per jenis di dokumen client, dan `document_checklists` sesuai daftar dokumen client per jenis ditambah 14 item legacy (untuk pemetaan riwayat `tabel_ceklist_history`) — buat di `database/seeders/`.
- PHP backed enums untuk 4 track + `OrderDocumentType`, `HandoverMethod`.
- `storage/app/private/documents/` untuk file upload (di luar document root; akses via controller dengan cek hak akses).
- Script migrasi data legacy: command artisan `legacy:import` (baca dump → Eloquent, chunked).
