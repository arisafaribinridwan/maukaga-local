# PRD — Pengajuan Kartu Garansi

## 1. Ringkasan Produk

Aplikasi **Pengajuan Kartu Garansi** adalah Google Apps Script Web App untuk mengelola proses pengajuan kartu garansi baru. Pengguna cabang/CS dapat mengisi form pengajuan, mencetak form untuk ditandatangani, mengunggah scan/foto form yang sudah ditandatangani, lalu mengirim pengajuan. Admin/Controller dapat login ke dashboard, memantau daftar pengajuan, melihat detail, dan memperbarui status pengajuan.

## 2. Tujuan

- Menyediakan alur digital terpusat untuk pengajuan kartu garansi.
- Mengurangi pencatatan manual dan memudahkan pelacakan status pengajuan.
- Menyimpan data pengajuan, item produk, file hard copy, dan riwayat status secara terstruktur.
- Memberikan dashboard bagi Admin/Controller untuk filter, pencarian, detail, dan update status.
- Mengirim rekap berkala kepada penerima email aktif.

## 3. Ruang Lingkup

### Termasuk

- Form pengajuan tanpa login untuk cabang/CS.
- Preview dan cetak form pengajuan.
- Upload file hard copy bertanda tangan dalam format PDF/JPG/JPEG/PNG.
- Dashboard admin dengan login berbasis username dan password/PIN.
- Filter dashboard berdasarkan pencarian global, status, dan rentang tanggal.
- Detail pengajuan, daftar item, file hard copy, dan riwayat status.
- Update status pengajuan oleh admin.
- Validasi input di frontend dan backend.
- Penyimpanan data di Google Sheets.
- Penyimpanan file upload di Google Drive.
- Email digest terjadwal.

### Tidak Termasuk

- Registrasi mandiri pengguna admin.
- Approval multi-level otomatis.
- Notifikasi email langsung setiap pengajuan baru.
- Integrasi dengan sistem ERP/CRM eksternal.
- Role selain Admin pada dashboard.
- Penyimpanan password dengan hashing.

## 4. Target Pengguna

### Cabang/CS

Pengguna yang mengajukan kartu garansi baru. Tidak perlu login.

Kebutuhan utama:
- Mengisi data pengajuan.
- Menambahkan satu atau lebih item produk.
- Mencetak form untuk tanda tangan.
- Mengunggah scan/foto form signed.
- Mengirim pengajuan.

### Admin/Controller

Pengguna internal yang memantau dan memproses pengajuan. Perlu login.

Kebutuhan utama:
- Melihat ringkasan jumlah pengajuan per status.
- Mencari dan memfilter pengajuan.
- Membuka detail pengajuan.
- Membuka file hard copy.
- Mengubah status dan mencatat alasan/admin note.

## 5. Alur Pengguna

### 5.1 Alur Cabang/CS Mengirim Pengajuan

1. Pengguna membuka Web App.
2. Sistem menampilkan Form Pengajuan.
3. Pengguna mengisi:
   - Nama
   - Bagian/Cabang
   - Pemilik
   - Tanggal Form
   - Alasan Pengajuan Kartu Garansi Baru
   - Catatan Tambahan opsional
4. Pengguna menambahkan minimal 1 item produk dan maksimal sesuai konfigurasi.
5. Setiap item berisi:
   - Produk
   - Model
   - Nomor Seri
6. Pengguna klik **Preview / Cetak Form**.
7. Sistem menghasilkan dokumen cetak berformat A4.
8. Pengguna mencetak dan menandatangani hard copy.
9. Pengguna mengunggah scan/foto form signed.
10. Pengguna klik **Submit Pengajuan**.
11. Sistem memvalidasi data dan file.
12. Sistem menyimpan file ke Google Drive.
13. Sistem menyimpan data pengajuan dan item ke Google Sheets.
14. Sistem menampilkan pesan sukses beserta ID pengajuan.

### 5.2 Alur Admin Login

1. Admin klik **Dashboard Admin**.
2. Jika belum memiliki session token, sistem menampilkan halaman login.
3. Admin mengisi username dan password/PIN.
4. Sistem memvalidasi data ke sheet `Users`.
5. Jika berhasil, sistem menyimpan session token di `sessionStorage` browser dan `CacheService` Apps Script.
6. Dashboard ditampilkan.

### 5.3 Alur Admin Memantau Pengajuan

1. Admin membuka dashboard.
2. Sistem memuat data pengajuan dari Google Sheets.
3. Sistem menampilkan summary card:
   - total
   - Baru
   - Disetujui
   - Ditolak
   - Selesai
4. Admin dapat mencari dengan global search.
5. Admin dapat memfilter berdasarkan status dan tanggal submit.
6. Admin dapat membuka detail pengajuan.

### 5.4 Alur Admin Update Status

1. Admin membuka detail pengajuan.
2. Sistem menampilkan data pengajuan, item produk, link file hard copy, status saat ini, dan riwayat status.
3. Admin memilih status baru:
   - Baru
   - Disetujui
   - Ditolak
   - Selesai
4. Admin mengisi Catatan Admin.
5. Jika status `Ditolak`, Catatan Admin wajib diisi.
6. Admin klik **Simpan Status**.
7. Sistem menyimpan status, catatan, timestamp update, dan user updater.
8. Jika status berubah, sistem menambah log ke sheet `StatusLog`.
9. Dashboard dan detail diperbarui.

### 5.5 Alur Email Digest

1. Fungsi `setupApp()` membuat trigger email digest.
2. Trigger berjalan setiap Senin dan Kamis sekitar pukul 09:00.
3. Sistem mengambil penerima aktif dari sheet `EmailRecipients`.
4. Sistem mengirim rekap pengajuan yang masih terbuka atau baru sejak email terakhir.
5. Sistem mencatat hasil pengiriman ke sheet `EmailLog`.

## 6. Fitur Utama

### 6.1 Form Pengajuan

Form harus menyediakan field:

| Field | Wajib | Keterangan |
| --- | --- | --- |
| Nama | Ya | Nama pengaju |
| Bagian/Cabang | Ya | Unit/cabang pengaju |
| Pemilik | Ya | Pemilik kartu/produk |
| Tanggal Form | Ya | Tanggal form dibuat |
| Alasan Pengajuan | Ya | Alasan kartu garansi baru diajukan |
| Catatan Tambahan | Tidak | Informasi tambahan |
| Item Produk | Ya | Minimal 1 item |
| Upload File Signed | Ya saat submit | PDF/JPG/JPEG/PNG |

### 6.2 Item Produk Dinamis

- Sistem menampilkan 1 item default.
- Pengguna dapat menambah item sampai batas `MAX_ITEMS`.
- Pengguna dapat menghapus item jika jumlah item lebih dari 1.
- Setiap item wajib memiliki Produk, Model, dan Nomor Seri.

### 6.3 Preview dan Cetak Form

- Preview/cetak dapat dilakukan tanpa upload file.
- Data wajib tetap harus lengkap sebelum cetak.
- Untuk 1 item, data produk ditampilkan dalam tabel metadata.
- Untuk banyak item, data produk ditampilkan dalam tabel daftar item.
- Dokumen cetak memuat tabel tanda tangan:
  - Diajukan
  - Diketahui — CS Head
  - Disetujui — Branch Manager
  - Diberikan — Controller
  - Disetujui — Div. Head

### 6.4 Upload File Hard Copy

- Format yang diizinkan:
  - PDF
  - JPEG/JPG
  - PNG
- Ukuran maksimum mengikuti konfigurasi `MAX_UPLOAD_MB`.
- File disimpan ke folder Google Drive yang dikonfigurasi melalui `DRIVE_FOLDER_ID`.
- Nama file disimpan dengan pola `{ID Pengajuan}_hardcopy.{extension}`.

### 6.5 Dashboard Admin

Dashboard menampilkan:

- Summary card jumlah pengajuan.
- Filter global search.
- Filter status.
- Filter tanggal dari/sampai.
- Tabel pengajuan dengan kolom:
  - ID Pengajuan
  - Timestamp Submit
  - Nama
  - Bagian/Cabang
  - Jumlah Item
  - Status
  - Aksi Detail

### 6.6 Detail Pengajuan

Detail menampilkan:

- ID Pengajuan
- Timestamp Submit
- Nama
- Bagian/Cabang
- Pemilik
- Alasan Pengajuan
- Tanggal Form
- Link file hard copy
- Catatan Tambahan
- Jumlah Item
- Status saat ini
- Catatan Admin
- Update terakhir
- User update
- Daftar item produk
- Riwayat status

### 6.7 Update Status

- Admin dapat menyimpan status dan catatan admin.
- Status valid hanya:
  - Baru
  - Disetujui
  - Ditolak
  - Selesai
- Catatan Admin wajib jika status `Ditolak`.
- Perubahan status dicatat di `StatusLog`.
- Riwayat singkat disimpan pada sheet `Pengajuan`.

### 6.8 Session Admin

- Session dibuat setelah login berhasil.
- Token disimpan di browser melalui `sessionStorage`.
- Token disimpan server-side melalui `CacheService`.
- Masa berlaku session adalah 6 jam.
- Logout menghapus token dari cache dan browser.

## 7. Data Model

### 7.1 Sheet `Pengajuan`

| Kolom | Keterangan |
| --- | --- |
| ID Pengajuan | ID unik pengajuan |
| Timestamp Submit | Waktu submit |
| Nama | Nama pengaju |
| Bagian/Cabang | Unit/cabang |
| Pemilik | Pemilik |
| Alasan Pengajuan | Alasan pengajuan |
| Tanggal Form | Tanggal form |
| File Hard Copy URL | URL file upload |
| File Hard Copy ID | ID file Google Drive |
| Catatan Tambahan | Catatan dari pengaju |
| Jumlah Item | Jumlah item produk |
| Status | Status pengajuan |
| Catatan Admin | Catatan dari admin |
| Tanggal Update Status Terakhir | Timestamp update status terakhir |
| User Update Status | Username admin updater |
| Riwayat Singkat | Riwayat perubahan ringkas |

### 7.2 Sheet `PengajuanItems`

| Kolom | Keterangan |
| --- | --- |
| ID Pengajuan | Relasi ke sheet Pengajuan |
| No Item | Nomor urut item |
| Produk | Nama produk |
| Model | Model produk |
| Nomor Seri | Nomor seri produk |

### 7.3 Sheet `Users`

| Kolom | Keterangan |
| --- | --- |
| Username | Username admin |
| Password/PIN | Password/PIN admin |
| Nama | Nama admin |
| Role | Role pengguna |
| Aktif | `yes` untuk aktif |
| Last Login | Timestamp login terakhir |

### 7.4 Sheet `EmailRecipients`

| Kolom | Keterangan |
| --- | --- |
| Nama | Nama penerima |
| Email | Alamat email |
| Aktif | `yes` untuk aktif |
| Keterangan | Catatan penerima |

### 7.5 Sheet `Config`

| Key | Keterangan |
| --- | --- |
| APP_NAME | Nama aplikasi |
| DRIVE_FOLDER_ID | Folder penyimpanan upload |
| MAX_UPLOAD_MB | Batas maksimal upload |
| MAX_ITEMS | Batas jumlah item |
| LAST_EMAIL_SENT_AT | Timestamp email digest terakhir |

### 7.6 Sheet `StatusLog`

| Kolom | Keterangan |
| --- | --- |
| Timestamp | Waktu perubahan |
| ID Pengajuan | ID pengajuan |
| Status Lama | Status sebelumnya |
| Status Baru | Status baru |
| Catatan Admin | Catatan admin |
| User | Username admin |

### 7.7 Sheet `EmailLog`

| Kolom | Keterangan |
| --- | --- |
| Timestamp | Waktu pengiriman |
| Subject | Subject email |
| Recipients | Daftar penerima |
| Jumlah Pengajuan | Jumlah pengajuan dalam digest |
| Status | Status pengiriman |

## 8. Aturan Bisnis

- Setiap pengajuan wajib memiliki minimal 1 item produk.
- Jumlah item maksimum mengikuti konfigurasi `MAX_ITEMS`.
- Upload file signed wajib saat submit.
- Preview/cetak tidak mewajibkan upload file.
- File upload hanya boleh PDF, JPG/JPEG, atau PNG.
- Ukuran file upload maksimum mengikuti konfigurasi `MAX_UPLOAD_MB`.
- Tanggal Form harus valid dan tidak boleh jauh di masa depan.
- Hanya user aktif dengan role `Admin` yang dapat login dashboard.
- Status hanya boleh salah satu dari `Baru`, `Disetujui`, `Ditolak`, atau `Selesai`.
- Catatan Admin wajib jika status diubah/disimpan sebagai `Ditolak`.
- ID pengajuan menggunakan format `KG-YYYYMMDD-0001` dan bertambah per tanggal.

## 9. Validasi

### Frontend

- Validasi field wajib sebelum preview/cetak dan submit.
- Validasi jumlah item.
- Validasi field wajib setiap item.
- Validasi format file.
- Validasi ukuran file.
- Menampilkan pesan error/sukses/info melalui alert box.

### Backend

- Validasi ulang semua field wajib.
- Normalisasi dan trim input.
- Validasi item produk.
- Validasi tanggal form.
- Validasi file upload.
- Validasi session admin untuk endpoint dashboard/detail/update.
- Validasi status.

## 10. Kebutuhan Non-Fungsional

### Keamanan

- Dashboard hanya dapat diakses dengan session admin valid.
- Data HTML yang ditampilkan di frontend harus di-escape untuk mengurangi risiko XSS.
- File upload dibatasi berdasarkan MIME type dan ukuran.
- Operasi submit dan update status menggunakan lock untuk mengurangi risiko race condition.

Catatan keamanan saat ini:
- Password/PIN admin masih disimpan plain text di sheet `Users`.
- Admin default dibuat dengan username `admin` dan password `admin123`; password harus diganti setelah setup.

### Performa

- Dashboard memuat data dari Google Sheets dan melakukan filter di server.
- Email digest membatasi tampilan email hingga 100 baris pertama.
- Session menggunakan Apps Script CacheService agar tidak perlu membaca sheet setiap request dashboard.

### Kompatibilitas

- Aplikasi berjalan sebagai Google Apps Script Web App.
- Frontend menggunakan HTML, JavaScript, dan Tailwind via CDN.
- Backend menggunakan Google Apps Script dan Google Workspace services:
  - SpreadsheetApp
  - DriveApp
  - CacheService
  - LockService
  - MailApp
  - ScriptApp

### Kegunaan

- UI responsif untuk desktop dan mobile.
- Tabel dashboard mendukung horizontal scroll.
- Form cetak dioptimalkan untuk ukuran A4.
- Alert memberi feedback saat loading, berhasil, atau gagal.

## 11. Setup dan Deployment

### 11.1 Setup Awal

1. Tempel file backend sebagai `Code.gs`.
2. Tempel file frontend sebagai `Index.html`.
3. Pastikan `APP.HTML_FILE` bernilai `Index`.
4. Jalankan fungsi `setupApp()` dari editor Apps Script.
5. Sistem akan membuat sheet yang diperlukan jika belum ada.
6. Sistem akan membuat atau memakai folder upload Drive.
7. Sistem akan membuat admin default jika sheet `Users` masih kosong.
8. Ganti password admin default.
9. Isi sheet `EmailRecipients` dan aktifkan penerima yang valid.
10. Deploy sebagai Google Apps Script Web App.

### 11.2 Konfigurasi

Konfigurasi dikelola dari sheet `Config`:

- `APP_NAME`: nama aplikasi yang tampil di frontend.
- `DRIVE_FOLDER_ID`: folder upload file hard copy.
- `MAX_UPLOAD_MB`: batas maksimal upload.
- `MAX_ITEMS`: batas maksimal item per pengajuan.
- `LAST_EMAIL_SENT_AT`: dikelola otomatis oleh email digest.

## 12. Kriteria Penerimaan

### Form Pengajuan

- Pengguna dapat mengirim pengajuan valid dan mendapat ID pengajuan.
- Sistem menolak pengajuan jika field wajib kosong.
- Sistem menolak pengajuan tanpa file signed.
- Sistem menolak file dengan format atau ukuran tidak valid.
- Sistem menyimpan data utama ke sheet `Pengajuan`.
- Sistem menyimpan item ke sheet `PengajuanItems`.
- Sistem menyimpan file ke Google Drive.

### Preview/Cetak

- Pengguna dapat mencetak form setelah data wajib diisi.
- Cetakan memuat data pengajuan, item produk, tabel tanda tangan, dan catatan.
- Preview/cetak tidak membutuhkan upload file.

### Dashboard Admin

- Admin valid dapat login.
- Admin tidak valid tidak dapat login.
- Dashboard menampilkan summary dan daftar pengajuan.
- Filter search, status, dan tanggal bekerja sesuai data.
- Admin dapat membuka detail pengajuan.

### Update Status

- Admin dapat mengubah status pengajuan.
- Status invalid ditolak backend.
- Status `Ditolak` tanpa Catatan Admin ditolak.
- Perubahan status tercatat di `StatusLog`.
- Dashboard memperbarui data setelah status disimpan.

### Email Digest

- Trigger digest dibuat saat setup.
- Email hanya dikirim jika ada penerima aktif.
- Hasil pengiriman tercatat di `EmailLog`.

## 13. Risiko dan Catatan

- Penyimpanan password plain text perlu ditingkatkan jika aplikasi digunakan di lingkungan produksi.
- Tailwind CDN membutuhkan akses internet dari browser pengguna.
- Apps Script memiliki limit kuota untuk runtime, email, Drive, dan Spreadsheet.
- Upload file besar dalam base64 dapat mendekati limit payload Apps Script.
- Akses file Drive mengikuti permission file/folder yang dibuat oleh Apps Script.

## 14. Metrik Keberhasilan

- Jumlah pengajuan yang berhasil dikirim tanpa bantuan manual.
- Persentase pengajuan yang memiliki file hard copy valid.
- Waktu rata-rata dari status `Baru` ke `Selesai`.
- Jumlah pengajuan yang tertunda per status.
- Jumlah error submit/login/update status yang dilaporkan pengguna.

## 15. Potensi Pengembangan Lanjutan

- Hashing password atau integrasi login Google Workspace.
- Role tambahan seperti Controller, Branch Manager, dan Div. Head.
- Email notifikasi otomatis saat submit dan status berubah.
- Approval bertahap sesuai tabel tanda tangan.
- Export dashboard ke CSV/PDF.
- Halaman admin untuk mengelola users, recipients, dan config.
- Audit log lebih lengkap untuk login dan akses detail.
