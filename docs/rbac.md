# Role & Permission

Fase 8 menetapkan akses internal berbasis role yang dipetakan dari `job_position`. Akun notaris memakai role `notaris` berdasarkan `notary_id`.

## Role

| Role | Fokus akses |
| --- | --- |
| `legal_admin` | Membuat order, melihat order, tracking, laporan |
| `notaris` | Portal pekerjaan notaris dan tracking terbatas |
| `kepala_cabang` | Monitoring order, tracking, laporan |
| `it_admin` | Monitoring dan master data |
| `auditor` | Monitoring, laporan, dan audit log |

## Enforcement

- `EnsurePermission` menjadi middleware route dengan format `permission:code`.
- Dashboard memakai `dashboard.view`.
- Daftar dan detail tracking memakai `tracking.view`.
- Daftar/detail order memakai `orders.view`.
- Pembuatan order memakai `orders.create`.
- Laporan dan audit log memakai permission masing-masing.
- Master data memakai `masters.manage`.
- Tracking publik tanpa login belum diaktifkan.

Pembatasan akses terhadap order milik notaris tetap dilakukan di controller portal, sehingga akun notaris tidak dapat melihat order kantor lain.
