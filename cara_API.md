# Integrasi Global SSO ke Laravel

Panduan ini menjelaskan cara menghubungkan aplikasi Laravel sebagai client ke
Global SSO API. Laravel tidak membuat sistem login pegawai sendiri; Laravel
meneruskan proses login ke Global SSO API.

## 1. Arsitektur

```text
Browser
   |
   | Form login
   v
Laravel
   |
   | App Token + id_peg + password
   v
Global SSO API
   |
   | JWT
   v
Laravel Session
```

Ada dua kredensial yang berbeda:

- `X-App-Token`: identitas aplikasi Laravel.
- JWT: identitas pegawai setelah login berhasil.

`X-App-Token` harus tetap berada di backend Laravel. Jangan menaruhnya di
JavaScript, HTML, atau mengirimkannya langsung dari browser.

## 2. Environment Laravel

Tambahkan ke file `.env` Laravel:

```dotenv
SSO_BASE_URL=http://127.0.0.1:8000
SSO_APP=nora
SSO_APP_TOKEN=app_TOKEN_RAHASIA
```

Untuk server development:

```dotenv
SSO_BASE_URL=https://devsso.bkkjateng.co.id
```

Untuk production, gunakan URL production yang sesuai:

```dotenv
SSO_BASE_URL=https://apisso.bkkjateng.co.id
```

Jangan commit `.env` ke Git. Gunakan `.env.example` tanpa nilai rahasia:

```dotenv
SSO_BASE_URL=
SSO_APP=
SSO_APP_TOKEN=
```

Setelah mengubah `.env`, bersihkan cache konfigurasi:

```bash
php artisan config:clear
```

## 3. Daftarkan konfigurasi di Laravel

Tambahkan konfigurasi berikut ke `config/services.php`:

```php
'sso' => [
    'base_url' => env('SSO_BASE_URL'),
    'app' => env('SSO_APP'),
    'app_token' => env('SSO_APP_TOKEN'),
],
```

## 4. Endpoint Global SSO

| Method | Endpoint | JWT | Keterangan |
|---|---|---:|---|
| `POST` | `/api/auth/login` | Tidak | Login dan mendapatkan JWT |
| `GET` | `/api/auth/whoami` | Ya | Membaca identitas pegawai |
| `POST` | `/api/auth/update-profile` | Ya | Mengubah email atau nomor telepon |
| `POST` | `/api/auth/change-password` | Ya | Mengubah password |
| `POST` | `/api/auth/forgot-password` | Tidak | Memulai reset password |
| `POST` | `/api/auth/resend-otp` | Tidak | Mengirim ulang OTP |
| `POST` | `/api/auth/verify-otp` | Tidak | Memvalidasi OTP |
| `POST` | `/api/auth/reset-password` | Tidak | Mengubah password dengan token reset |

`POST /api/auth/whoami` adalah endpoint kompatibilitas lama. Untuk integrasi
baru, gunakan `GET /api/auth/whoami` dengan header `Authorization`.

## 5. Membuat client SSO

Buat file `app/Services/SsoClient.php`:

```php
<?php

namespace App\Services;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

class SsoClient
{
    private function request()
    {
        return Http::acceptJson()
            ->baseUrl(rtrim(config('services.sso.base_url'), '/'))
            ->withHeaders([
                'App' => config('services.sso.app'),
                'X-App-Token' => config('services.sso.app_token'),
            ]);
    }

    public function login(string $employeeId, string $password): Response
    {
        return $this->request()->post('/api/auth/login', [
            'id_peg' => $employeeId,
            'password' => $password,
        ]);
    }

    public function whoami(string $jwt): Response
    {
        return $this->request()
            ->withToken($jwt)
            ->get('/api/auth/whoami');
    }

    public function updateProfile(string $jwt, array $data): Response
    {
        return $this->request()
            ->withToken($jwt)
            ->post('/api/auth/update-profile', $data);
    }

    public function changePassword(
        string $jwt,
        string $oldPassword,
        string $newPassword
    ): Response {
        return $this->request()
            ->withToken($jwt)
            ->post('/api/auth/change-password', [
                'old_password' => $oldPassword,
                'new_password' => $newPassword,
            ]);
    }
}
```

`withToken($jwt)` otomatis menghasilkan header:

```http
Authorization: Bearer JWT_USER
```

## 6. Login dari controller

Contoh `app/Http/Controllers/AuthController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Services\SsoClient;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    public function login(Request $request, SsoClient $sso)
    {
        $credentials = $request->validate([
            'id_peg' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $response = $sso->login(
            $credentials['id_peg'],
            $credentials['password']
        );

        if (!$response->successful()) {
            return back()
                ->withInput($request->only('id_peg'))
                ->withErrors([
                    'id_peg' => $response->json('message', 'Login gagal.'),
                ]);
        }

        $jwt = $response->json('data.token');

        if (!is_string($jwt) || $jwt === '') {
            return back()->withErrors([
                'id_peg' => 'API SSO tidak mengembalikan token login.',
            ]);
        }

        $request->session()->regenerate();
        $request->session()->put('sso.jwt', $jwt);

        return redirect()->intended('/dashboard');
    }

    public function logout(Request $request)
    {
        $request->session()->forget('sso');
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/login');
    }
}
```

JWT disimpan di session server Laravel. Jangan menampilkan JWT di URL atau
menyimpannya ke `localStorage` jika aplikasi dapat memakai session server.

## 7. Memeriksa session dengan `whoami`

Contoh pemanggilan:

```php
$jwt = $request->session()->get('sso.jwt');

if (!is_string($jwt) || $jwt === '') {
    return redirect('/login');
}

$response = $sso->whoami($jwt);

if ($response->unauthorized()) {
    $request->session()->invalidate();

    return redirect('/login')->withErrors([
        'login' => 'Sesi login sudah berakhir. Silakan login kembali.',
    ]);
}

$employee = $response->json('data');
```

Gunakan data `employee` dari response untuk menampilkan nama, cabang, dan
jabatan pegawai.

## 8. Middleware session SSO

Untuk halaman yang harus login, buat middleware yang:

1. mengambil JWT dari session;
2. memanggil `GET /api/auth/whoami`;
3. mengarahkan ke `/login` jika JWT tidak ada atau sudah tidak valid;
4. meneruskan data pegawai jika valid.

Jangan hanya memeriksa apakah string JWT ada di session. JWT juga harus
divalidasi melalui API Global agar session tidak memakai token yang sudah
kedaluwarsa.

## 9. Penanganan error

| HTTP | Arti umum | Tindakan Laravel |
|---:|---|---|
| `200` | Request berhasil | Proses response |
| `400` | Input tidak valid | Tampilkan error form |
| `401` | JWT tidak ada/salah/kedaluwarsa | Hapus session, minta login ulang |
| `403` | App Token salah/tidak aktif | Periksa konfigurasi server |
| `500`/`503` | SSO atau database bermasalah | Tampilkan pesan layanan tidak tersedia |

Jangan menampilkan App Token, JWT, password, atau response mentah yang berisi
secret ke user maupun log aplikasi.

## 10. Tes koneksi dari Laravel

Sebelum mencoba login, pastikan API lokal berjalan:

```bash
php -S 127.0.0.1:8000 local-router.php
```

Lalu gunakan Tinker atau route sementara untuk memanggil `SsoClient`.

Tes langsung dengan `curl`:

```bash
curl -i http://127.0.0.1:8000/api/auth/whoami
```

Response `401` karena header belum ada berarti server API sudah merespons.
Response timeout atau `500` biasanya menunjukkan masalah koneksi database/API.

## 11. Checklist integrasi

- [ ] Aplikasi Laravel sudah didaftarkan di registry API.
- [ ] App Token khusus aplikasi sudah disimpan di environment server.
- [ ] `SSO_BASE_URL`, `SSO_APP`, dan `SSO_APP_TOKEN` sudah diisi.
- [ ] `config/services.php` membaca nilai SSO.
- [ ] Login memakai `POST /api/auth/login`.
- [ ] JWT disimpan di session server.
- [ ] `whoami` memakai `Authorization: Bearer JWT`.
- [ ] `401` menghapus session dan mengarahkan ke login.
- [ ] App Token tidak masuk ke frontend atau repository.
- [ ] Endpoint password diuji hanya dengan akun testing.
- [ ] HTTPS digunakan pada development bersama dan production.
