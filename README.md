# Pengajuan Kartu Garansi

Aplikasi ini memakai arsitektur HTML lokal → Google Apps Script API → Google Sheets dan Google Drive.

## File

- `index.html` — form pengajuan untuk Cabang/CS.
- `dashboard.html` — dashboard Admin/Controller.
- `config.js` — konfigurasi URL API Apps Script.
- `Code.gs` — backend Google Apps Script.
- `prd.md` dan `task-plan.md` — dokumen kebutuhan dan rencana kerja.

## Setup Backend

1. Buka https://script.google.com dan buat project baru.
2. Salin seluruh isi `Code.gs` ke editor Apps Script.
3. Jika ingin memakai Google Sheet tertentu, isi `APP.SPREADSHEET_ID` di bagian atas `Code.gs`. Jika dikosongkan, Apps Script akan memakai spreadsheet aktif atau membuat spreadsheet baru.
4. Jalankan fungsi `setupApp()` dari menu Run.
5. Berikan izin yang diminta untuk Sheets, Drive, Mail, Cache, Lock, dan Trigger.
6. Setelah setup selesai, deploy sebagai Web App dengan pengaturan: Execute as: Me, Who has access: Anyone.
7. Salin URL deployment Web App.

## Setup Frontend

1. Buka `config.js`.
2. Ganti `API_URL` dengan URL deployment Apps Script dari langkah backend.
3. Buka `index.html` langsung di browser untuk mulai membuat pengajuan.
4. Buka `dashboard.html` langsung di browser untuk dashboard admin.
5. Login awal menggunakan username `admin` dan password `admin123`.
6. Segera ganti password default melalui sheet `Users`.

## Konfigurasi Tambahan

Setelah `setupApp()` dijalankan, buka Google Sheets yang dipakai aplikasi. Sheet `Config` berisi `APP_NAME`, `DRIVE_FOLDER_ID`, `MAX_UPLOAD_MB`, `MAX_ITEMS`, dan `LAST_EMAIL_SENT_AT`. Sheet `Users` dipakai untuk admin. Sheet `EmailRecipients` dipakai untuk penerima digest berkala. Isi kolom `Aktif` dengan `yes` agar user atau penerima email dianggap aktif.

## Catatan CORS Google Apps Script

Frontend mengirim request `POST` dengan header `Content-Type: text/plain;charset=utf-8` agar request dari file HTML lokal tidak memicu preflight CORS. Google Apps Script `ContentService.TextOutput` tidak menyediakan API `.setHeader()` untuk menambahkan header CORS manual. Jika browser atau environment Anda tetap memblokir request lintas origin, opsi paling stabil adalah menyajikan HTML dari Apps Script atau memakai proxy/API hosting yang mendukung header CORS eksplisit.

## Email Digest

`setupApp()` membuat dua trigger untuk `sendEmailDigest()`, yaitu Senin dan Kamis sekitar pukul 09:00. Digest mengirim maksimal 100 pengajuan berstatus `Baru` atau `Disetujui` kepada penerima aktif di sheet `EmailRecipients`, lalu mencatat hasil di `EmailLog`.

## Batasan Teknis

Upload dikirim sebagai base64, jadi sebaiknya `MAX_UPLOAD_MB` tidak dibuat terlalu besar. Password admin saat ini disimpan plain text sesuai PRD, sehingga aplikasi ini cocok untuk penggunaan internal terbatas dan perlu peningkatan jika akan dipakai di lingkungan produksi yang lebih ketat.
