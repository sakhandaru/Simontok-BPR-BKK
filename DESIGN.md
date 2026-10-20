# DESIGN.md

Arah desain SIMONTOK. Dibaca sebelum kerja UI/visual, lalu difilter antislop.
Oleh: pemilik arah (dijawab 2026-10-13). Perubahan arah dilakukan di sini lewat diskusi, bukan ditambah diam-diam saat build.

## Identitas

- Produk: SIMONTOK, sistem monitoring pekerjaan notaris rekanan PT BPR BKK Jateng (Perseroda).
- Sifat: alat kerja harian internal + portal mitra notaris. Bukan halaman promosi.
- Kepribadian: institusional tenang. Serius, rapi, mudah diverifikasi, minim distraksi, sesuai konteks OJK dan audit.
- Bahasa antarmuka: Indonesia.

## Palet

- Dasar: netral ala web modern, rasa Vercel: monokrom, kontras tajam, garis tipis bersih, tanpa warna mencolok.
- Implementasi: pakai token warna neutral shadcn yang sudah terpasang (`resources/css/app.css`). Perubahan warna hanya lewat token ini.
- Warna korporat hanya datang dari logo BKK, bukan ditebak sendiri.
- Warna hanya untuk fungsi: status 4 track (order, dokumen, covernote, pembayaran), sukses/galat, dan aksi destruktif. Bukan dekorasi.

## Tipografi

- Utama: Plus Jakarta Sans.
- Alasan: rapi untuk tabel dan form padat, membawa identitas lokal Indonesia.
- Catatan implementasi: starter kit sekarang memuat Instrument Sans (`resources/css/app.css`, `--font-sans`). Saat build UI, ganti ke Plus Jakarta Sans dan muat font-nya.

## Mood & dials

Dial: ENERGY 1 / RHYTHM 2 / MOTION 1

- ENERGY 1: tenang seperti layanan publik. Halaman langsung ke isi, tanpa sapaan besar.
- RHYTHM 2: komposisi antar layar boleh bervariasi mengikuti isi (daftar padat vs detail proses vs dashboard), tetap dalam kesan kalem.
- MOTION 1: tanpa animasi dekoratif. Hanya transisi hover/focus dan feedback form yang diperlukan. Tanpa reveal saat gulir, tanpa loop.

Design Read:

> Reading this as: aplikasi kerja internal perbankan untuk staf legal & notaris, gaya institusional netral modern (referensi rasa: Vercel), dial ENERGY 1 / RHYTHM 2 / MOTION 1.

## Arah Visual Dashboard

Targetnya adalah **vibe control panel modern**: padat, fokus, tenang, dan terasa cepat. Vercel dipakai sebagai referensi kualitas komposisi dan kejernihan informasi, bukan sebagai template yang disalin.

### Yang diambil

- Sidebar navigasi yang ringkas dengan kelompok menu yang jelas dan state aktif yang terlihat.
- Topbar sederhana untuk konteks halaman, pencarian, filter, notifikasi, dan akun.
- Konten utama memakai lebar efektif yang besar, dengan judul halaman singkat dan aksi utama di sisi kanan.
- Tabel dan daftar menjadi pola utama untuk order, dokumen, invoice, progres, dan notifikasi.
- Baris data rapat tetapi tetap nyaman dibaca, dengan separator tipis dan hover state yang halus.
- Search, filter, sort, dan view switcher ditempatkan dekat daftar, bukan disembunyikan di halaman lain.
- Status menggunakan titik, badge, atau label kecil yang informatif; tidak menggunakan ilustrasi dekoratif.
- Panel hanya dipakai untuk mengelompokkan pekerjaan yang memang perlu dibaca atau dilakukan bersama.
- Detail order memakai layout dua area: konteks dan status di utama, ringkasan atau metadata di sisi pendamping.
- Aksi primer terang atau kontras tinggi, aksi sekunder netral, dan aksi destruktif tetap jelas tetapi tidak mendominasi.

### Yang tidak disalin

- Tidak menyalin logo, nama, ikon khusus, copywriting, URL, struktur menu, atau layout Vercel secara satu banding satu.
- Tidak memakai bingkai hijau, dekorasi neon, atau elemen promosi dari referensi.
- Tidak membuat dashboard proyek/deployment; struktur harus mengikuti order, agunan, dokumen, covernote, progres, handover, dan pembayaran.
- Tidak mengubah semua informasi menjadi kartu. Tabel, timeline, form, dan panel tetap dipilih berdasarkan tugasnya.

### Komposisi layar

- Desktop: sidebar tetap sekitar 240-260px, area kerja fleksibel, konten tidak dipaksa terlalu sempit.
- Mobile: sidebar berubah menjadi drawer atau panel navigasi, tabel dapat digeser horizontal, dan aksi utama tetap mudah dijangkau.
- Header halaman tidak lebih dari dua tingkat informasi sebelum daftar atau form dimulai.
- Gunakan section header yang tipis dan fungsional, bukan card bertumpuk.
- Radius kecil dan konsisten: 6-8px untuk panel, 6px untuk input dan tombol, 999px hanya untuk badge status.
- Shadow hampir tidak dipakai. Elevasi hanya untuk dropdown, dialog, dan elemen yang benar-benar berada di atas konten.

### Tema dan warna

- Dark mode boleh menjadi tampilan utama untuk area kerja karena mendukung pemindaian data dan durasi kerja panjang; light mode tetap harus lengkap dan setara.
- Latar belakang memakai hitam atau netral gelap yang solid pada dark mode, bukan gradient.
- Border, separator, dan muted text membangun hierarki lebih banyak daripada warna.
- Warna hijau, biru, amber, dan merah hanya muncul sebagai state atau aksi yang bermakna.
- Satu halaman tidak boleh terasa seperti kumpulan warna status. Netral tetap menjadi mayoritas.

### Ritme interaksi

- Navigasi dan filter terasa instan; perubahan state kecil memakai transisi singkat tanpa animasi dekoratif.
- Dialog dibuka untuk input terfokus, bukan untuk menggantikan halaman yang masih perlu dibandingkan.
- Setelah submit, pengguna tetap berada di konteks yang sama dan melihat hasilnya langsung.
- Loading memakai skeleton atau state tertahan pada area yang berubah, bukan layar kosong penuh.
- Empty state menjelaskan kondisi data dan menyediakan satu aksi berikutnya yang relevan.

## Batas implementasi

- Utamakan komponen stock: starter kit Laravel + shadcn/ui (sudah terpasang di repo).
- Komponen custom seperlunya saja, sedikit mungkin.
- "Ala Vercel" berarti rasa: netral, kontras, kerapian. Bukan menyalin tampilan produk lain; identitas SIMONTOK datang dari logo BKK dan konteks lembaga.

## Aset

- Logo BKK: tersedia dari pemilik. Serahkan berkasnya ke repo sebelum build; sampai itu ada, pakai nama produk sebagai teks atau penanda [LOGO].
- Tanpa ilustrasi stok. Tampilan memakai data dan antarmuka asli.

## Prinsip UX Operasional

SIMONTOK dipakai untuk pekerjaan berulang, pemeriksaan, dan audit. Setiap layar harus membantu pengguna menjawab tiga hal dengan cepat: sedang berada di tahap apa, apa yang harus dilakukan sekarang, dan apa yang menghalangi tahap berikutnya.

- Utamakan aksi berikutnya yang sah pada tahap tersebut. Aksi yang belum tersedia tidak ditampilkan sebagai tombol aktif.
- Jangan meminta data yang sudah diketahui sistem. Tampilkan konteks order, agunan, status, dan pemilik proses di dekat input.
- Simpan pekerjaan bertahap tanpa menghilangkan data yang sudah ada. Perubahan draft harus mempertahankan ID agunan, checklist, dokumen, dan riwayat.
- Satu tindakan bisnis hanya punya satu jalur utama. Hindari tombol alternatif yang melakukan hal sama dengan istilah berbeda.
- Validasi harus muncul dekat field yang bermasalah, dengan bahasa Indonesia yang menjelaskan cara memperbaikinya. Error server tidak boleh tampil sebagai halaman exception Laravel.
- Setelah aksi berhasil, perbarui status, journey, daftar, dan notifikasi dalam respons yang sama. Pengguna tidak boleh menebak apakah tindakannya tersimpan.

## Hirarki Status

Status adalah informasi utama, bukan dekorasi. Gunakan label bahasa Indonesia yang konsisten dan warna fungsional yang tenang:

- **Menunggu**: netral atau amber lembut. Ada pihak lain yang perlu memproses.
- **Aktif / berjalan**: biru netral. Pekerjaan sedang berlangsung.
- **Berhasil / disetujui**: hijau. Tahap telah lolos pemeriksaan.
- **Perlu perbaikan / berisiko**: amber. Masih dapat dilanjutkan setelah koreksi.
- **Ditolak / gagal / dibatalkan**: merah. Membutuhkan keputusan atau tindakan khusus.
- **Selesai**: hijau lebih tegas, hanya dipakai pada penutupan order.

Badge harus menyebut status secara eksplisit. Jangan memakai warna tanpa label, dan jangan menggunakan status internal seperti `draft_diunggah` sebagai teks pengguna.

## Detail Order

Halaman detail order menggunakan urutan kerja berikut:

1. Identitas order dan status saat ini.
2. Journey pengajuan dengan tahap aktif dan tahap berikutnya.
3. Aksi yang tersedia pada tahap aktif.
4. Ringkasan agunan dan dokumen.
5. Covernote, progres, invoice, handover, dan pembayaran sesuai kesiapan tahap.
6. Riwayat status dan audit sebagai informasi pendukung.

Panel tidak boleh menampilkan form yang belum dapat digunakan. Jika sebuah tahap tertahan, tampilkan satu alasan yang jelas dan tindakan yang dapat membuka tahap tersebut.

## Dokumen & Agunan

- Dokumen selalu ditampilkan dalam konteks agunan jika memang terkait agunan.
- Label agunan minimal memuat jenis pekerjaan, ID agunan, dan deskripsi singkat. Contoh: `APHT - AGN-002 - Sertifikat rumah`.
- Checklist, file yang sudah diunggah, dokumen tambahan, versi, ukuran file, dan status validasi harus dapat dibedakan secara visual.
- Upload batch dilakukan per agunan. Pengguna mengisi atau mengubah record di modal, melihat preview, lalu mengunggah seluruh antrean dengan satu aksi.
- Record dokumen memiliki aksi edit dan hapus yang konsisten menggunakan ikon dengan tooltip dan label aksesibilitas.
- Preview PDF atau gambar tersedia sebelum penyimpanan record dan saat review Admin Legal.
- Dokumen tambahan yang diminta Notaris harus muncul di daftar yang sama setelah Admin Legal mengunggahnya, dengan nama dokumen, agunan terkait, file, ukuran, versi, dan status.
- Batas file ditampilkan sebelum memilih file. Setelah dipilih, nama dan ukuran file selalu terlihat.

## Guard Berbasis Tahap

UI mengikuti aturan bisnis berikut:

- Dokumen awal dilengkapi Admin Legal sebelum order dikirim.
- Notaris hanya menerima atau menolak order pada tahap verifikasi awal. Notaris tidak meminta revisi pada tahap tersebut.
- Covernote diunggah Notaris setelah order diterima dan baru membuka progres setelah disetujui Admin Legal.
- Dokumen tambahan baru dapat diminta setelah covernote disetujui.
- Langkah progres diselesaikan berurutan. Langkah terakhir wajib menyertakan dokumen final.
- Upload dokumen final otomatis mengajukan paket untuk validasi Admin Legal setelah seluruh agunan lengkap.
- Invoice diajukan setelah dokumen final tervalidasi.
- Bukti pembayaran hanya dapat diunggah setelah handover dokumen fisik tercatat.
- Order hanya menjadi selesai setelah pembayaran tercatat dan Admin Legal menutup order.

## Form, Feedback, dan Responsif

- Form padat memakai grid dua kolom di desktop dan satu kolom di layar kecil.
- Label berada di atas field. Placeholder hanya memberi contoh, bukan menggantikan label.
- Tombol utama memakai kata kerja yang spesifik: `Terima dokumen`, `Ajukan covernote`, `Catat handover`, `Upload bukti pembayaran`, `Tutup order`.
- Tombol destruktif memerlukan alasan atau konfirmasi yang relevan.
- Toast sukses singkat menyebut hasil tindakan. Toast error menyebut penyebab dan tindakan pemulihan.
- Modal dipakai untuk pekerjaan terfokus seperti input atau review dokumen. Modal harus memiliki preview, judul jelas, footer tetap, dan dapat ditutup dengan keyboard.
- Tabel boleh melebar secara horizontal di layar kecil, tetapi aksi penting tetap mudah dijangkau.
- Fokus keyboard, kontras, target sentuh, dan pesan error harus tetap jelas pada mode terang maupun gelap.

## Prinsip UX Produk

Referensi dashboard modern dipakai terutama untuk rasa penggunaan: cepat, tenang, terstruktur, dan membantu pengguna memahami tindakan berikutnya. Visual yang rapi tidak cukup jika alur bisnis masih membuat pengguna menebak-nebak.

### Kejelasan alur

- Setiap layar harus menjawab tiga hal: pengguna sedang berada di tahap apa, apa yang sudah selesai, dan apa yang harus dilakukan berikutnya.
- Tampilkan hanya tindakan yang valid untuk role dan tahap saat ini. Jika tindakan belum tersedia, tampilkan alasan yang dapat ditindaklanjuti.
- Satu pekerjaan utama memiliki satu tindakan utama. Jangan menyediakan dua tombol yang memulai proses bisnis yang sama dengan istilah berbeda.
- Form mengikuti urutan kerja: pilih konteks, isi data, lampirkan bukti, tinjau, lalu kirim.
- Setelah submit, pengguna tetap berada di konteks yang sama dan langsung melihat perubahan status, timeline, daftar, serta notifikasi.

### UX berbasis role

- Admin Legal berfokus pada validasi, review dokumen, permintaan dokumen, verifikasi invoice, dan pencatatan bukti pembayaran.
- Notaris berfokus pada penerimaan order, covernote, progres, dokumen final, permintaan dokumen tambahan, dan invoice.
- Pimpinan Cabang berfokus pada keputusan yang memang menjadi kewenangannya, dengan akses review terhadap dokumen dan catatan relevan.
- Setiap role melihat istilah, aksi, dan informasi yang sesuai dengan tanggung jawabnya. Jangan menampilkan kontrol yang tidak dapat dipakai.
- Status menjadi sumber kebenaran tunggal. Badge, timeline, tombol, notifikasi, dan ringkasan harus membaca state yang sama.

### Mengurangi beban kerja

- Jangan meminta pengguna mengisi informasi yang sudah diketahui sistem; gunakan konteks order, agunan, role, dan status secara otomatis.
- Kelompokkan dokumen berdasarkan agunan dan tahap. Dokumen tambahan harus tetap terlihat dalam daftar yang sama, bukan tersembunyi di panel terpisah.
- Untuk upload banyak file, gunakan antrean yang menampilkan nama, ukuran, status, preview, dan aksi hapus/ganti per file.
- Simpan draft tanpa menghapus data yang sudah tersimpan. Jika validasi gagal, pertahankan input dan file yang masih valid.
- Pertahankan filter, pencarian, tab, dan posisi konteks ketika pengguna membuka detail lalu kembali ke daftar.

### Feedback dan recovery

- Setiap aksi submit memiliki state loading pada tombol, toast hasil, dan perubahan status yang terlihat.
- Error validasi muncul dekat field yang bermasalah. Error server, ukuran file, dan konflik tahap diterjemahkan menjadi pesan bahasa Indonesia yang menjelaskan solusi.
- Jangan menampilkan stack trace, exception Laravel, nama endpoint, atau enum status internal kepada pengguna.
- Toast dipakai untuk hasil singkat; informasi yang memengaruhi keputusan tetap tampil di halaman, badge, atau riwayat audit.
- Operasi berisiko seperti hapus, batal, tolak, dan kembalikan revisi memerlukan konfirmasi serta alasan jika dibutuhkan audit.
- Refresh, tombol kembali, dan pembukaan ulang halaman harus menghasilkan state yang sama dengan server, bukan state UI yang tertinggal.

### Efisiensi dan aksesibilitas

- Pencarian, filter, sortir, pagination, dan shortcut digunakan pada daftar order, dokumen, serta aktivitas yang panjang.
- Modal dipakai untuk input singkat atau review terfokus. Gunakan halaman penuh untuk proses panjang, banyak field, atau preview dokumen besar.
- Empty state harus membedakan kondisi kosong, loading, dan error, lalu menawarkan satu tindakan berikutnya yang relevan.
- Transisi singkat boleh membantu orientasi, tetapi tidak boleh menunda pekerjaan atau menjadi dekorasi.
- Keyboard focus, urutan tab, kontras, label aksesibilitas, target sentuh, dan perilaku mobile harus diperlakukan sebagai bagian dari UX inti.

## Spesifikasi Dashboard Admin Utama

Dashboard adalah pusat pemantauan operasional Admin Legal atau admin utama. Isinya bukan sekadar ringkasan angka, tetapi alat untuk mengetahui kondisi sistem dan menentukan pekerjaan berikutnya.

### Susunan informasi

1. **Header konteks**
   Menampilkan identitas area kerja, judul `Overview`, deskripsi singkat, serta aksi menuju laporan dan pembuatan order.

2. **KPI utama**
   Menampilkan order aktif, order yang perlu perhatian, order selesai, dan persentase dokumen final tervalidasi. Setiap KPI dapat dibuka untuk melihat daftar terkait.

3. **Antrian tindakan**
   Menampilkan pekerjaan prioritas seperti SLA terlambat, covernote kedaluwarsa, dan dokumen fisik yang belum dihandover. Setiap baris mengarah langsung ke detail order.

4. **Kontrol harian**
   Menampilkan jumlah SLA terlambat, SLA yang mendekati batas, covernote kedaluwarsa, dan handover yang belum tercatat.

5. **Performa cabang**
   Menampilkan total order, order aktif, dan jumlah risiko per cabang. Tujuannya membantu admin melihat cabang yang memiliki beban atau risiko paling tinggi.

6. **Pipeline pengajuan**
   Menampilkan distribusi order pada setiap tahap: draft, persetujuan order, verifikasi notaris, proses akta, validasi BPR, fisik dan pembayaran, serta selesai.

7. **Kesehatan dokumen**
   Menampilkan aging pekerjaan aktif berdasarkan tahap dan rentang umur `0-7`, `8-14`, `15-30`, serta `>30` hari.

8. **Pergerakan aktivitas**
   Menampilkan tren delapan minggu untuk order masuk, order selesai, dan order berisiko.

9. **Funnel pembayaran**
   Menampilkan posisi invoice dari diajukan, diverifikasi, disetujui, sampai dibayar.

10. **Order terbaru**
    Menampilkan aktivitas order terakhir dengan nomor order, nasabah, dan statusnya.

11. **Distribusi status order**
    Menampilkan jumlah order berdasarkan status terkini dengan badge status yang konsisten.

12. **Performa notaris**
    Menampilkan beban order, jumlah selesai, dan risiko per notaris sebagai pembanding performa cabang.

### Aturan komposisi

- Dashboard memakai bento grid yang padat dengan bobot panel berbeda sesuai kepentingan informasi.
- Antrian tindakan dan KPI menjadi prioritas visual tertinggi.
- Panel monitoring memakai header tipis, separator ringan, dan baris compact.
- Setiap angka penting dapat ditelusuri ke daftar atau detail terkait.
- Tidak ada grafik dekoratif tanpa keputusan yang dapat diambil dari datanya.
- Di mobile, semua blok turun menjadi satu kolom dengan urutan prioritas yang sama.
