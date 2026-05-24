# Task Plan — Aplikasi Pengajuan Kartu Garansi
## Arsitektur: HTML Lokal → Google Apps Script API → Google Sheets & Drive

---

## Konteks Proyek

Aplikasi ini menggantikan sistem Google Apps Script Web App menjadi arsitektur baru:
- **Frontend**: File HTML lokal yang dibuka langsung di browser (tidak di-host di server)
- **Backend**: Google Apps Script yang berfungsi sebagai REST API
- **Storage**: Google Sheets (data) + Google Drive (file upload)

Pengguna terdiri dari dua tipe:
- **Cabang/CS**: Mengisi dan mengirim form pengajuan kartu garansi (tanpa login)
- **Admin/Controller**: Login ke dashboard untuk memantau dan memperbarui status pengajuan

---

## Struktur File yang Harus Dibuat

```
project/
├── index.html          # Halaman form pengajuan (untuk Cabang/CS)
├── dashboard.html      # Halaman dashboard admin (dengan login)
├── config.js           # Konfigurasi URL Apps Script endpoint
└── Code.gs             # Backend Google Apps Script (satu file)
```

---

## TASK 1 — Backend: `Code.gs` (Google Apps Script)

### 1.1 Konfigurasi Global

Buat objek `APP` di bagian atas file berisi:

```javascript
const APP = {
  SPREADSHEET_ID: '', // diisi manual oleh user setelah setup
  DRIVE_FOLDER_ID: '', // diisi dari sheet Config
  MAX_UPLOAD_MB: 10,   // default, diisi dari sheet Config
  MAX_ITEMS: 10,        // default, diisi dari sheet Config
  APP_NAME: 'Pengajuan Kartu Garansi',
  SESSION_DURATION_HOURS: 6,
};
```

### 1.2 Fungsi `setupApp()`

Jalankan sekali saat setup awal. Fungsi ini harus:

1. Membuat sheet `Pengajuan` dengan header kolom:
   - ID Pengajuan, Timestamp Submit, Nama, Bagian/Cabang, Pemilik, Alasan Pengajuan, Tanggal Form, File Hard Copy URL, File Hard Copy ID, Catatan Tambahan, Jumlah Item, Status, Catatan Admin, Tanggal Update Status Terakhir, User Update Status, Riwayat Singkat

2. Membuat sheet `PengajuanItems` dengan header:
   - ID Pengajuan, No Item, Produk, Model, Nomor Seri

3. Membuat sheet `Users` dengan header:
   - Username, Password/PIN, Nama, Role, Aktif, Last Login
   - Jika sheet kosong, tambahkan user default: `admin` / `admin123` / `Administrator` / `Admin` / `yes`

4. Membuat sheet `EmailRecipients` dengan header:
   - Nama, Email, Aktif, Keterangan

5. Membuat sheet `Config` dengan header:
   - Key, Value
   - Isi nilai default: APP_NAME, DRIVE_FOLDER_ID (kosong), MAX_UPLOAD_MB (10), MAX_ITEMS (10), LAST_EMAIL_SENT_AT (kosong)

6. Membuat sheet `StatusLog` dengan header:
   - Timestamp, ID Pengajuan, Status Lama, Status Baru, Catatan Admin, User

7. Membuat sheet `EmailLog` dengan header:
   - Timestamp, Subject, Recipients, Jumlah Pengajuan, Status

8. Membuat atau mengambil folder Google Drive untuk upload file. Simpan ID folder ke sheet Config key `DRIVE_FOLDER_ID`.

9. Membuat time-based trigger untuk fungsi `sendEmailDigest()` yang berjalan setiap Senin dan Kamis sekitar pukul 09:00.

10. Log hasil setup ke console.

### 1.3 Fungsi `doPost(e)`

Ini adalah entry point utama backend. Routing berdasarkan `e.parameter.action` atau `JSON.parse(e.postData.contents).action`.

Daftar action yang harus ditangani:

| Action | Fungsi yang dipanggil |
|---|---|
| `submitPengajuan` | `handleSubmitPengajuan(data)` |
| `adminLogin` | `handleAdminLogin(data)` |
| `getDashboard` | `handleGetDashboard(data)` |
| `getDetail` | `handleGetDetail(data)` |
| `updateStatus` | `handleUpdateStatus(data)` |
| `adminLogout` | `handleAdminLogout(data)` |

Response selalu berformat JSON:
```json
{ "success": true, "data": {} }
// atau
{ "success": false, "error": "pesan error" }
```

Tambahkan header CORS pada setiap response agar bisa diakses dari file HTML lokal:
```javascript
.setHeader('Access-Control-Allow-Origin', '*')
.setHeader('Access-Control-Allow-Methods', 'POST')
.setHeader('Access-Control-Allow-Headers', 'Content-Type')
```

### 1.4 Fungsi `doGet(e)`

Tangani preflight OPTIONS request untuk CORS. Return response kosong dengan status 200 dan header CORS yang sama.

### 1.5 Helper: `generateId()`

Generate ID pengajuan dengan format `KG-YYYYMMDD-XXXX` dimana XXXX adalah nomor urut 4 digit per tanggal. Logika:
1. Baca semua ID di sheet `Pengajuan`
2. Filter ID yang memiliki prefix tanggal hari ini
3. Ambil nomor urut tertinggi, tambah 1
4. Jika tidak ada, mulai dari 0001
5. Gunakan LockService untuk menghindari race condition

### 1.6 Helper: `getConfig()`

Baca semua konfigurasi dari sheet `Config` dan return sebagai object key-value.

### 1.7 Helper: `validateSession(token)`

1. Cek token di CacheService: `CacheService.getScriptCache().get(token)`
2. Jika tidak ada, return `null`
3. Jika ada, return object `{ username, nama, role }`

### 1.8 Fungsi `handleSubmitPengajuan(data)`

Parameter yang diterima (dari body JSON):
```json
{
  "nama": "",
  "bagianCabang": "",
  "pemilik": "",
  "tanggalForm": "",
  "alasanPengajuan": "",
  "catatanTambahan": "",
  "items": [
    { "produk": "", "model": "", "nomorSeri": "" }
  ],
  "fileBase64": "",
  "fileExtension": "",
  "fileMimeType": ""
}
```

Langkah-langkah:
1. Validasi semua field wajib (nama, bagianCabang, pemilik, tanggalForm, alasanPengajuan)
2. Validasi items: minimal 1, setiap item wajib memiliki produk, model, nomorSeri
3. Validasi tanggalForm: harus format tanggal valid, tidak lebih dari 7 hari ke depan
4. Validasi file: wajib ada, extension harus pdf/jpg/jpeg/png, ukuran (dari base64 length) tidak melebihi MAX_UPLOAD_MB
5. Gunakan LockService sebelum generate ID dan write ke sheet
6. Generate ID pengajuan dengan `generateId()`
7. Decode base64 dan simpan file ke Google Drive dengan nama `{ID}_hardcopy.{extension}`
8. Simpan baris data utama ke sheet `Pengajuan`
9. Simpan setiap item ke sheet `PengajuanItems`
10. Return `{ success: true, data: { idPengajuan: "KG-..." } }`

### 1.9 Fungsi `handleAdminLogin(data)`

Parameter: `{ username, password }`

Langkah-langkah:
1. Trim dan lowercase username
2. Cari user di sheet `Users` yang match username, aktif = `yes`, role = `Admin`
3. Bandingkan password (plain text untuk saat ini)
4. Jika tidak match, return error `"Username atau password salah"`
5. Jika berhasil:
   - Generate token: `Utilities.getUuid()`
   - Simpan ke CacheService dengan key = token, value = JSON `{ username, nama, role }`, expiry = 6 jam (21600 detik)
   - Update kolom `Last Login` di sheet Users
   - Return `{ success: true, data: { token, nama, username } }`

### 1.10 Fungsi `handleAdminLogout(data)`

Parameter: `{ token }`

1. Hapus token dari CacheService
2. Return `{ success: true }`

### 1.11 Fungsi `handleGetDashboard(data)`

Parameter: `{ token, search, status, dateFrom, dateTo, page, pageSize }`

Langkah-langkah:
1. Validasi session dengan `validateSession(token)`, jika gagal return error `"Unauthorized"`
2. Baca semua data dari sheet `Pengajuan`
3. Filter berdasarkan:
   - `search`: cocokkan ke kolom ID Pengajuan, Nama, Bagian/Cabang (case-insensitive)
   - `status`: filter exact match ke kolom Status (jika diisi)
   - `dateFrom` dan `dateTo`: filter Timestamp Submit (jika diisi)
4. Hitung summary: total, Baru, Disetujui, Ditolak, Selesai dari data yang sudah difilter
5. Urutkan data: Timestamp Submit terbaru di atas
6. Implementasi pagination: `page` (default 1), `pageSize` (default 20)
7. Return:
```json
{
  "success": true,
  "data": {
    "summary": { "total": 0, "baru": 0, "disetujui": 0, "ditolak": 0, "selesai": 0 },
    "rows": [],
    "totalRows": 0,
    "page": 1,
    "pageSize": 20
  }
}
```

Setiap row berisi: ID Pengajuan, Timestamp Submit, Nama, Bagian/Cabang, Jumlah Item, Status.

### 1.12 Fungsi `handleGetDetail(data)`

Parameter: `{ token, idPengajuan }`

Langkah-langkah:
1. Validasi session
2. Cari baris di sheet `Pengajuan` yang match ID Pengajuan
3. Jika tidak ditemukan, return error `"Pengajuan tidak ditemukan"`
4. Ambil items dari sheet `PengajuanItems` yang match ID Pengajuan
5. Ambil riwayat dari sheet `StatusLog` yang match ID Pengajuan, urutkan terbaru di atas
6. Return semua data pengajuan + items + riwayat status

### 1.13 Fungsi `handleUpdateStatus(data)`

Parameter: `{ token, idPengajuan, statusBaru, catatanAdmin }`

Langkah-langkah:
1. Validasi session
2. Validasi statusBaru: harus salah satu dari `Baru`, `Disetujui`, `Ditolak`, `Selesai`
3. Jika statusBaru = `Ditolak`, catatanAdmin wajib diisi
4. Cari baris di sheet `Pengajuan` yang match ID Pengajuan
5. Simpan statusLama sebelum diubah
6. Gunakan LockService
7. Update kolom: Status, Catatan Admin, Tanggal Update Status Terakhir, User Update Status, Riwayat Singkat
8. Format Riwayat Singkat: tambahkan entry baru ke string yang ada, format: `[TIMESTAMP] statusLama → statusBaru oleh username`
9. Tambahkan baris baru ke sheet `StatusLog`
10. Return `{ success: true }`

### 1.14 Fungsi `sendEmailDigest()`

Dipanggil oleh trigger terjadwal (Senin & Kamis pukul 09:00):
1. Baca config `LAST_EMAIL_SENT_AT`
2. Baca semua penerima aktif dari sheet `EmailRecipients`
3. Jika tidak ada penerima aktif, stop
4. Ambil pengajuan dengan status `Baru` atau `Disetujui`, maksimal 100 baris
5. Buat HTML email berisi tabel ringkasan pengajuan
6. Kirim email ke setiap penerima aktif menggunakan `MailApp.sendEmail()`
7. Update `LAST_EMAIL_SENT_AT` di sheet Config
8. Catat hasil pengiriman ke sheet `EmailLog`

---

## TASK 2 — File Konfigurasi: `config.js`

```javascript
const CONFIG = {
  // Ganti dengan URL deployment Google Apps Script kamu
  API_URL: 'https://script.google.com/macros/s/XXXXXXXX/exec',
  APP_NAME: 'Pengajuan Kartu Garansi',
};
```

File ini di-include di kedua HTML file. User hanya perlu mengganti `API_URL` sekali.

---

## TASK 3 — Frontend Form: `index.html`

### 3.1 Struktur Halaman

Halaman tunggal (tidak perlu routing), terdiri dari tiga section yang ditampilkan/disembunyikan secara bergantian:
- `#section-form` — Form pengajuan utama
- `#section-print` — Tampilan cetak (hidden, ditampilkan saat print)
- `#section-success` — Pesan sukses setelah submit berhasil

### 3.2 Header

- Judul aplikasi dari `CONFIG.APP_NAME`
- Tombol **"Dashboard Admin →"** yang membuka `dashboard.html`

### 3.3 Form Pengajuan (`#section-form`)

Tampilkan field berikut dengan label dan validasi visual (border merah jika error):

**Data Pengaju:**
- Nama (text, required)
- Bagian/Cabang (text, required)
- Pemilik (text, required)
- Tanggal Form (date, required)
- Alasan Pengajuan Kartu Garansi Baru (textarea, required)
- Catatan Tambahan (textarea, opsional)

**Daftar Item Produk:**
- Container `#item-list` yang berisi item card
- Setiap item card berisi:
  - Label "Item #N"
  - Produk (text, required)
  - Model (text, required)
  - Nomor Seri (text, required)
  - Tombol "Hapus Item" (hanya tampil jika jumlah item > 1)
- Tombol **"+ Tambah Item"** (disabled jika sudah mencapai MAX_ITEMS, default 10)

**Upload File:**
- Input file (accept: .pdf,.jpg,.jpeg,.png)
- Tampilkan nama file yang dipilih dan ukuran file
- Validasi format dan ukuran di sisi client sebelum submit

**Tombol Aksi:**
- **"Preview / Cetak Form"** — validasi data wajib (kecuali file), lalu tampilkan halaman cetak
- **"Submit Pengajuan"** — validasi semua field termasuk file, lalu kirim ke API

### 3.4 Alert Box

Tampilkan alert box di atas form untuk feedback:
- Loading: "Mengirim pengajuan..."
- Sukses: "Pengajuan berhasil dikirim! ID: KG-..."
- Error: pesan error dari API atau validasi frontend

### 3.5 Halaman Cetak (`#section-print`)

Ditampilkan dengan `window.print()` saat tombol preview diklik. Layout dioptimalkan untuk kertas A4.

Konten cetak:
- Header: nama aplikasi, tanggal cetak
- Tabel metadata: Nama, Bagian/Cabang, Pemilik, Tanggal Form, Alasan Pengajuan, Catatan Tambahan
- Jika item hanya 1: tampilkan data produk dalam tabel metadata yang sama
- Jika item lebih dari 1: tampilkan tabel daftar item terpisah dengan kolom No, Produk, Model, Nomor Seri
- Tabel tanda tangan dengan 5 kolom:

| Diajukan | Diketahui (CS Head) | Disetujui (Branch Manager) | Diberikan (Controller) | Disetujui (Div. Head) |
|---|---|---|---|---|
| _(tanda tangan)_ | _(tanda tangan)_ | _(tanda tangan)_ | _(tanda tangan)_ | _(tanda tangan)_ |

- Tombol "Kembali ke Form" (hidden saat print menggunakan CSS `@media print`)

### 3.6 Halaman Sukses (`#section-success`)

Tampilkan setelah submit berhasil:
- Icon centang
- Pesan: "Pengajuan berhasil dikirim!"
- ID Pengajuan yang diterima dari API
- Tombol "Buat Pengajuan Baru" (reset form dan kembali ke section-form)

### 3.7 JavaScript Logic (`index.html`)

```javascript
// State
let items = [{ produk: '', model: '', nomorSeri: '' }];

// Fungsi utama yang harus diimplementasi:
function renderItems() {} // render ulang item list dari state
function addItem() {}     // tambah item ke state, panggil renderItems
function removeItem(index) {} // hapus item dari state
function validateForm(includeFile) {} // return true/false + tampilkan error
function handlePreviewCetak() {} // validasi, isi #section-print, panggil print
function handleSubmit() {} // validasi, konversi file ke base64, kirim ke API
async function submitToAPI(payload) {} // fetch POST ke CONFIG.API_URL
function showAlert(type, message) {} // 'loading' | 'success' | 'error'
function resetForm() {} // reset semua field dan state items
```

**Konversi file ke base64:**
```javascript
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
```

---

## TASK 4 — Frontend Dashboard: `dashboard.html`

### 4.1 State Management

```javascript
const state = {
  token: sessionStorage.getItem('admin_token') || null,
  adminNama: sessionStorage.getItem('admin_nama') || null,
  currentView: 'dashboard', // 'dashboard' | 'detail'
  currentId: null,
  filters: { search: '', status: '', dateFrom: '', dateTo: '' },
  page: 1,
  pageSize: 20,
};
```

### 4.2 Routing View

Tampilkan/sembunyikan section berdasarkan `state.token` dan `state.currentView`:
- Jika token null → tampilkan `#section-login`
- Jika token ada dan currentView = `dashboard` → tampilkan `#section-dashboard`
- Jika token ada dan currentView = `detail` → tampilkan `#section-detail`

Saat halaman load, cek token di sessionStorage. Jika ada, langsung load dashboard (skip login).

### 4.3 Halaman Login (`#section-login`)

- Input username
- Input password (type="password")
- Tombol **"Login"**
- Alert error jika login gagal

### 4.4 Halaman Dashboard (`#section-dashboard`)

**Header:**
- Judul + nama admin yang login
- Tombol **"Logout"**
- Tombol **"← Kembali ke Form"** yang buka `index.html`

**Summary Cards (5 card):**
- Total Pengajuan
- Baru (badge warna biru)
- Disetujui (badge warna hijau)
- Ditolak (badge warna merah)
- Selesai (badge warna abu-abu)

**Filter Bar:**
- Input search (debounce 300ms)
- Select status: Semua, Baru, Disetujui, Ditolak, Selesai
- Input tanggal dari
- Input tanggal sampai
- Tombol **"Reset Filter"**

**Tabel Pengajuan:**
- Kolom: No, ID Pengajuan, Waktu Submit, Nama, Bagian/Cabang, Jml Item, Status, Aksi
- Status ditampilkan sebagai badge berwarna
- Kolom Aksi: tombol **"Detail"**
- Tabel mendukung horizontal scroll pada layar kecil
- Tampilkan pesan "Tidak ada data" jika kosong

**Pagination:**
- Tampilkan info: "Menampilkan X–Y dari Z pengajuan"
- Tombol Prev / Next
- Disable tombol jika sudah di halaman pertama/terakhir

### 4.5 Halaman Detail (`#section-detail`)

**Tombol navigasi:**
- **"← Kembali ke Dashboard"** (panggil `loadDashboard()`)

**Informasi Pengajuan:**
Tampilkan dalam dua kolom grid:
- ID Pengajuan
- Waktu Submit
- Nama
- Bagian/Cabang
- Pemilik
- Tanggal Form
- Alasan Pengajuan
- Catatan Tambahan
- Jumlah Item
- File Hard Copy: link yang bisa diklik untuk membuka file di tab baru

**Tabel Daftar Item:**
Kolom: No, Produk, Model, Nomor Seri

**Form Update Status:**
- Select status: Baru, Disetujui, Ditolak, Selesai (pre-filled dengan status saat ini)
- Textarea Catatan Admin (wajib jika status = Ditolak)
- Status saat ini, update terakhir, dan user updater (read-only)
- Tombol **"Simpan Status"**

**Riwayat Status:**
Tabel riwayat dari StatusLog: Waktu, Status Lama → Status Baru, Catatan, Admin

### 4.6 JavaScript Logic (`dashboard.html`)

```javascript
// Fungsi utama yang harus diimplementasi:
async function handleLogin() {}
async function handleLogout() {}
async function loadDashboard() {} // ambil data dari API, render tabel & summary
async function loadDetail(idPengajuan) {} // ambil detail dari API, render section detail
async function handleUpdateStatus() {} // validasi, kirim ke API, reload detail
function renderSummaryCards(summary) {}
function renderTable(rows) {}
function renderPagination(total, page, pageSize) {}
function renderDetailInfo(data) {}
function renderItemsTable(items) {}
function renderStatusHistory(logs) {}
function applyFilters() {} // reset page ke 1, panggil loadDashboard
function showAlert(type, message, targetEl) {}
async function callAPI(action, payload) {} // wrapper fetch POST ke CONFIG.API_URL dengan token
```

**Fungsi `callAPI`:**
```javascript
async function callAPI(action, payload = {}) {
  const body = { action, token: state.token, ...payload };
  const res = await fetch(CONFIG.API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}
```

---

## TASK 5 — Styling & UI

### 5.1 Stack

- Tailwind CSS via CDN (`https://cdn.tailwindcss.com`)
- Tidak ada framework JS (vanilla JS saja)
- Responsif: mobile-first

### 5.2 Color Scheme untuk Badge Status

| Status | Background | Text |
|---|---|---|
| Baru | Biru muda | Biru tua |
| Disetujui | Hijau muda | Hijau tua |
| Ditolak | Merah muda | Merah tua |
| Selesai | Abu-abu muda | Abu-abu tua |

### 5.3 CSS Print

Tambahkan di `index.html`:
```css
@media print {
  body > *:not(#section-print) { display: none !important; }
  #section-print { display: block !important; }
  .no-print { display: none !important; }
}
@media screen {
  #section-print { display: none; }
}
```

---

## TASK 6 — Validasi Lengkap

### 6.1 Frontend (`index.html`)

Sebelum **Preview/Cetak**:
- Nama tidak boleh kosong
- Bagian/Cabang tidak boleh kosong
- Pemilik tidak boleh kosong
- Tanggal Form tidak boleh kosong
- Alasan Pengajuan tidak boleh kosong
- Minimal ada 1 item
- Setiap item: Produk, Model, Nomor Seri tidak boleh kosong

Sebelum **Submit** (tambahan di atas):
- File harus dipilih
- Format file harus pdf/jpg/jpeg/png
- Ukuran file tidak boleh melebihi 10MB (atau sesuai MAX_UPLOAD_MB)

### 6.2 Backend (`Code.gs`)

- Semua validasi frontend diulang di backend
- Trim semua string input
- Tanggal Form: parse dan cek tidak lebih dari 7 hari ke depan
- File base64: decode dan cek ukuran, cek MIME type
- Session token: wajib valid untuk semua endpoint admin
- Status: hanya boleh nilai yang terdaftar
- Catatan Admin wajib jika status = Ditolak

---

## TASK 7 — Setup & Cara Penggunaan

Buat file `README.md` yang menjelaskan langkah-langkah berikut:

### Langkah Setup Backend

1. Buka [script.google.com](https://script.google.com) dan buat project baru
2. Salin seluruh isi `Code.gs` ke editor
3. Jalankan fungsi `setupApp()` dari menu Run
4. Berikan izin yang diminta (akses Sheets, Drive, Mail)
5. Setelah setup selesai, deploy sebagai Web App:
   - Execute as: **Me**
   - Who has access: **Anyone** (agar HTML lokal bisa mengakses tanpa login Google)
6. Salin URL deployment

### Langkah Setup Frontend

1. Buka file `config.js`
2. Ganti nilai `API_URL` dengan URL deployment dari langkah di atas
3. Buka `index.html` di browser untuk mulai menggunakan form pengajuan
4. Buka `dashboard.html` di browser untuk akses dashboard admin
5. Login dengan username `admin` dan password `admin123`
6. **Segera ganti password default** melalui sheet `Users` di Google Sheets

### Konfigurasi Tambahan

- Buka Google Sheets yang dibuat otomatis
- Sheet `Config`: sesuaikan `MAX_UPLOAD_MB` dan `MAX_ITEMS`
- Sheet `Users`: tambah/edit user admin
- Sheet `EmailRecipients`: tambahkan penerima email digest

---

## TASK 8 — Batasan & Catatan Teknis

| Aspek | Keterangan |
|---|---|
| CORS | Apps Script harus di-deploy dengan akses **Anyone** |
| Upload file | Dikirim sebagai base64. Jaga MAX_UPLOAD_MB ≤ 35MB agar base64 tidak melebihi limit payload ~50MB Apps Script |
| Session | Token disimpan di `sessionStorage` browser. Session hilang saat tab ditutup |
| Password | Disimpan plain text di sheet Users — cukup untuk internal, tingkatkan jika akan dipublikasikan |
| Quota | Apps Script memiliki limit harian: 6 jam runtime, 100 email/hari, 1000 Drive operations |
| Offline | Frontend tidak bisa digunakan tanpa koneksi internet (butuh akses ke Apps Script) |

---

## Checklist Kriteria Penerimaan

### Form Pengajuan
- [ ] Pengguna dapat mengisi dan mengirim pengajuan valid
- [ ] Sistem menolak jika field wajib kosong
- [ ] Sistem menolak jika file tidak dilampirkan
- [ ] Sistem menolak file dengan format/ukuran tidak valid
- [ ] Data tersimpan ke sheet `Pengajuan` dan `PengajuanItems`
- [ ] File tersimpan ke Google Drive
- [ ] ID pengajuan format `KG-YYYYMMDD-XXXX` ditampilkan setelah sukses

### Preview/Cetak
- [ ] Bisa preview/cetak tanpa upload file
- [ ] Cetakan memuat semua data pengajuan, item, dan tabel tanda tangan
- [ ] Layout cetak optimal untuk kertas A4

### Dashboard Admin
- [ ] Login berhasil untuk user aktif + role Admin
- [ ] Login gagal untuk user tidak valid
- [ ] Dashboard menampilkan summary card dan tabel pengajuan
- [ ] Filter search, status, dan tanggal berfungsi
- [ ] Pagination berfungsi
- [ ] Admin bisa membuka halaman detail

### Update Status
- [ ] Admin bisa mengubah status pengajuan
- [ ] Status tidak valid ditolak
- [ ] Status Ditolak tanpa catatan admin ditolak
- [ ] Perubahan tercatat di sheet `StatusLog`
- [ ] Riwayat status tampil di halaman detail

### Email Digest
- [ ] Trigger dibuat saat `setupApp()` dijalankan
- [ ] Email hanya terkirim jika ada penerima aktif
- [ ] Hasil pengiriman tercatat di sheet `EmailLog`
