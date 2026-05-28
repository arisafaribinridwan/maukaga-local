# PRD — Mau KaGa / Pengajuan Kartu Garansi

Dokumen ini adalah sumber kebenaran produk untuk implementasi aktual aplikasi saat ini dan acuan migrasi ke Vue/Nuxt. Jika ada perbedaan antara dokumen lama, rencana kerja lama, dan kode saat ini, dokumen ini mengikuti perilaku aktual di `Code.gs`, `index.html`, `dashboard.html`, dan `config.js`.

## 1. Ringkasan Produk

**Mau KaGa** adalah aplikasi pengajuan dan pemrosesan kartu garansi. Arsitektur aktualnya adalah frontend HTML statis lokal yang memanggil API Google Apps Script, dengan Google Sheets sebagai database, Google Drive sebagai penyimpanan file hard copy, dan MailApp untuk email digest.

Aplikasi memiliki dua area utama:

1. **Form publik Cabang/CS** di `index.html`.
   - Pengguna membuat draft pengajuan.
   - Sistem memberikan ID pengajuan dan resume token.
   - Pengguna mencetak form, meminta tanda tangan, lalu melanjutkan draft untuk upload hard copy signed.
   - Setelah upload final, status pengajuan berubah menjadi `Baru`.
   - Pengguna dapat mengecek status pengajuan memakai ID pengajuan tanpa login.

2. **Dashboard Admin** di `dashboard.html`.
   - Admin login dengan username dan password/PIN.
   - Admin melihat dashboard pengajuan final, membuka detail, melihat file hard copy, dan update status.
   - Admin mereview nama produk untuk model baru sebelum item masuk antrean cetak.
   - Admin mengelola antrean cetak kartu garansi, memilih jenis kartu `Local`/`Import`, mencetak kartu, menandai kartu sudah dicetak, dan mencetak label pengiriman cabang.
   - Admin mengatur layout cetak kartu untuk jenis `Local` dan `Import`.

## 2. Tujuan Produk

- Menyediakan alur digital terpusat untuk pengajuan kartu garansi dari cabang/CS sampai proses cetak.
- Mengurangi pencatatan manual dengan menyimpan pengajuan, item, file hard copy, status, master model-produk, dan data cetak secara terstruktur.
- Memisahkan tahap **draft/cetak form** dan **submit final dengan file signed** agar pengguna dapat mencetak hard copy sebelum upload.
- Memberi admin dashboard untuk monitoring, pencarian, filter, review data produk, update status, dan proses cetak kartu.
- Memberi pengguna publik cara sederhana untuk mengecek status pengajuan dari ID.
- Mengirim rekap berkala pengajuan terbuka kepada penerima email aktif.
- Menjadi basis migrasi UI ke Vue/Nuxt tanpa mengubah kontrak bisnis dan data utama.

## 3. Ruang Lingkup

### 3.1 Termasuk

- Form pengajuan publik tanpa login.
- Cek status publik berdasarkan ID pengajuan.
- Simpan draft pengajuan sebelum cetak.
- Lanjutkan draft melalui ID + resume token, link URL, atau draft terakhir di `localStorage` browser.
- Cetak form permintaan kartu garansi ukuran A4.
- Upload file hard copy signed pada tahap submit final.
- Validasi frontend dan backend untuk data wajib, tanggal, item, file, status, session, dan layout cetak.
- Login admin berbasis username dan password/PIN dari sheet `Users`.
- Session admin 6 jam memakai `sessionStorage` browser dan `CacheService` Apps Script.
- Dashboard admin dengan summary, filter, pencarian, pagination, detail, dan update status.
- Review nama produk untuk model baru berdasarkan sheet `ModelProduk`.
- Antrean cetak kartu garansi untuk item berstatus pengajuan `Disetujui` dan nama produk `verified`.
- Pemilihan jenis kartu `Local` atau `Import` per item.
- Cetak kartu garansi dengan layout aktif per jenis kartu.
- Pengaturan layout cetak kartu: tambah, duplikasi, simpan, jadikan aktif, dan hapus layout custom.
- Tandai kartu sebagai `Printed`, termasuk batch cetak dan reprint count.
- Preview dan cetak label pengiriman cabang dari item yang sudah `Printed`.
- Penyimpanan file upload di Google Drive.
- Penyimpanan data utama di Google Sheets.
- Email digest terjadwal Senin dan Kamis sekitar pukul 09:00.

### 3.2 Tidak Termasuk Saat Ini

- Registrasi mandiri admin.
- Manajemen user dari UI.
- Manajemen penerima email dari UI.
- Manajemen konfigurasi umum dari UI selain layout cetak.
- Role dashboard selain `Admin`.
- Hashing password/PIN.
- Login Google Workspace/OAuth.
- Approval multi-level sesuai tanda tangan hard copy.
- Notifikasi email langsung saat pengajuan dibuat atau status berubah.
- Integrasi ERP/CRM eksternal.
- Export dashboard ke CSV/PDF.
- Penyajian frontend dari Apps Script `HtmlService`; frontend saat ini berupa file statis lokal.

## 4. Aktor dan Kebutuhan

### 4.1 Cabang/CS

Pengguna publik yang mengajukan kartu garansi. Tidak perlu login.

Kebutuhan utama:

- Mengisi data pengajuan.
- Menambahkan item produk.
- Memakai master model-produk jika model sudah dikenal.
- Menyimpan draft dan mendapat ID pengajuan.
- Mencetak form untuk tanda tangan.
- Melanjutkan draft dari perangkat/browser yang sama atau dari link lanjutkan.
- Mengunggah file hard copy bertanda tangan.
- Submit final.
- Mengecek status dengan ID pengajuan.

### 4.2 Admin/Controller

Pengguna internal yang login ke dashboard dengan role `Admin` aktif.

Kebutuhan utama:

- Login/logout dashboard.
- Melihat summary jumlah pengajuan final per status.
- Mencari dan memfilter pengajuan final.
- Membuka detail pengajuan dan file hard copy.
- Melihat status verifikasi nama produk tiap item.
- Mereview dan menyetujui mapping model ke nama produk.
- Mengubah status pengajuan dan mengisi catatan admin.
- Mengelola antrean cetak kartu garansi.
- Memilih jenis kartu per item.
- Mencetak kartu garansi sesuai layout aktif.
- Menandai kartu sudah dicetak.
- Membuat label pengiriman cabang.
- Mengelola layout cetak kartu.

## 5. Arsitektur Aktual

### 5.1 File Utama

| File | Peran |
| --- | --- |
| `index.html` | Frontend publik untuk form, draft, cetak form, upload final, dan cek status. |
| `dashboard.html` | Frontend admin untuk login, dashboard, detail, review produk, cetak kartu, setting layout, dan label cabang. |
| `config.js` | Konfigurasi frontend: `API_URL`, `APP_NAME`, `MAX_UPLOAD_MB`, `MAX_ITEMS`. |
| `Code.gs` | Backend Google Apps Script API, data access, validasi, trigger email, Drive upload, dan session. |
| `README.md` | Panduan setup teknis ringkas. |
| `doc/prd.md` | Dokumen produk aktual dan acuan migrasi. |
| `doc/tamplate cetak kartu garansi.xlsx` | Template referensi fisik cetak kartu garansi. Tidak dibaca runtime oleh aplikasi. |

### 5.2 Pola Komunikasi Frontend-Backend

- Frontend memanggil `CONFIG.API_URL` dengan `fetch` method `POST`.
- Header request memakai `Content-Type: text/plain;charset=utf-8` untuk menghindari preflight CORS saat HTML dibuka sebagai file lokal.
- Body request adalah JSON string dengan minimal field `action`.
- Response selalu JSON dengan bentuk umum:

```json
{ "success": true, "data": {} }
```

atau:

```json
{ "success": false, "error": "Pesan error" }
```

- Endpoint `doGet` hanya dipakai untuk health/info API, bukan untuk menyajikan HTML.
- Untuk action admin, frontend mengirim `token` session kecuali saat login.

### 5.3 Konfigurasi Frontend

`config.js` aktual berisi:

| Key | Keterangan |
| --- | --- |
| `API_URL` | URL deployment Google Apps Script Web App. |
| `APP_NAME` | Nama aplikasi di UI, saat ini `Mau KaGa`. |
| `MAX_UPLOAD_MB` | Batas ukuran file di frontend, default 10 MB. |
| `MAX_ITEMS` | Batas jumlah item di frontend, default 10. |

Catatan migrasi: di Vue/Nuxt, nilai ini sebaiknya menjadi runtime config/environment variable, tetapi perilaku bisnisnya tetap sama.

## 6. Status dan State Utama

### 6.1 Status Pengajuan

| Status | Arti | Terlihat di dashboard utama? | Terlihat di cek status publik? |
| --- | --- | --- | --- |
| `Menunggu Upload` | Draft sudah dibuat, form dapat dicetak, tetapi file signed belum diupload final. | Tidak | Ya |
| `Baru` | Submit final berhasil, file hard copy sudah tersimpan, menunggu proses admin. | Ya | Ya |
| `Disetujui` | Pengajuan disetujui admin dan item eligible untuk antrean cetak jika nama produk verified. | Ya | Ya |
| `Ditolak` | Pengajuan ditolak admin. Catatan admin wajib saat menyimpan status ini. | Ya | Ya |
| `Selesai` | Pengajuan selesai diproses. | Ya | Ya |

`VALID_STATUSES` di backend hanya berisi `Baru`, `Disetujui`, `Ditolak`, `Selesai`. Status `Menunggu Upload` adalah status draft khusus.

### 6.2 Status Verifikasi Nama Produk Item

| Status | Arti |
| --- | --- |
| `verified` | Model item sudah memiliki mapping valid di `ModelProduk`; nama produk dianggap benar. |
| `needs_review` | Model belum ada di master `ModelProduk`; admin perlu approve nama produk. |

### 6.3 Status Cetak Kartu

| Status | Arti |
| --- | --- |
| `Belum Dicetak` | Item sudah masuk data kartu tetapi belum ditandai printed. |
| `Printed` | Item sudah ditandai dicetak dan memiliki batch cetak. |

## 7. Alur Pengguna Publik

### 7.1 Membuat Draft dan Cetak Form

1. Pengguna membuka `index.html`.
2. Sistem menampilkan form pengajuan, tombol `Cek Status`, dan tombol `Lanjutkan Draft`.
3. Sistem otomatis mengisi `Tanggal Form` dengan tanggal hari ini.
4. Sistem memuat master model-produk melalui action `getModelProduk`.
5. Pengguna mengisi field wajib:
   - Nama
   - Bagian/Cabang
   - Pemilik
   - Tanggal Form
   - Alasan Pengajuan Kartu Garansi Baru
   - Minimal 1 item produk
6. Setiap item berisi:
   - Model
   - Produk / Nama Produk
   - Nomor Seri
7. Urutan input item di UI adalah `Model` -> `Produk / Nama Produk` -> `Nomor Seri`, karena field Produk dapat otomatis terisi setelah Model dikenali.
8. Jika model cocok dengan master `ModelProduk`, sistem otomatis mengisi dan mengunci field Produk untuk item tersebut.
9. Jika model belum cocok dengan master, field Produk tetap terbuka agar pengguna dapat mengisi nama produk manual.
10. Pengguna klik `Simpan Draft & Cetak`.
11. Frontend memvalidasi field wajib tanpa mewajibkan file upload.
12. Frontend memanggil action `saveDraftPengajuan`.
13. Backend membuat atau memperbarui row `Pengajuan` dengan status `Menunggu Upload`, membuat ID `KG-YYYYMMDD-0001`, membuat `Resume Token`, dan menyimpan item ke `PengajuanItems`.
14. Sistem menyimpan referensi draft di `localStorage` browser.
15. Sistem menampilkan form cetak ukuran A4 dan otomatis memanggil `window.print()`.
16. Printout memuat ID pengajuan. Jika halaman tidak dibuka dari protocol `file:`, sistem juga menampilkan link lanjutkan draft yang berisi query `id` dan `token`.
17. Area tanda tangan printout terdiri dari:
   - Teks `Tanggal Form : {tanggal form}` di kiri blok tanda tangan awal.
   - Tabel awal 3 kolom: `Diajukan`, `Diketahui`, `Disetujui`, dengan footer `CS Head` dan `Branch Manager`.
   - Teks `Disetujui dan diberikan :` di kiri blok tanda tangan akhir. Saat cabang mencetak form, tanggal ini harus kosong.
   - Tabel akhir 2 kolom: `Diberikan`, `Disetujui`, dengan footer `Controller` dan `QRCC Div. Head`.
18. Parameter internal `tanggalCetakKartu` pada `buildPrintHtml()` disiapkan untuk mengisi tanggal `Disetujui dan diberikan` dari tanggal cetak kartu. Alur cetak form cabang saat ini tidak mengirim parameter tersebut sehingga tetap kosong.

### 7.2 Melanjutkan Draft

Pengguna dapat melanjutkan draft dengan salah satu cara:

1. Klik `Draft Terakhir` jika draft pernah disimpan di browser yang sama.
2. Masukkan ID pengajuan di bagian `Lanjutkan Draft`; jika resume token tersimpan di browser yang sama, sistem memakainya.
3. Buka link lanjutkan yang memiliki query `id`/`idPengajuan` dan `token`/`resumeToken`.

Alur sistem:

1. Frontend memanggil `checkDraftPengajuanStatus` jika hanya ID tersedia.
2. Frontend memanggil `getDraftPengajuan` dengan ID dan resume token.
3. Backend menolak draft jika:
   - ID tidak ditemukan.
   - Resume token salah/kosong.
   - Status sudah bukan `Menunggu Upload`.
4. Jika berhasil, form diisi ulang dari data draft.
5. UI masuk mode submit final: section upload file muncul, tombol `Submit Final` muncul, tombol `Simpan Draft & Cetak` disembunyikan.

### 7.3 Submit Final

1. Pengguna melanjutkan draft valid.
2. Pengguna memilih file hard copy bertanda tangan.
3. File yang diizinkan: PDF, JPG/JPEG, PNG.
4. Ukuran file maksimal mengikuti `MAX_UPLOAD_MB`.
5. Pengguna klik `Submit Final`.
6. Frontend memvalidasi field wajib, item, tanggal, format file, dan ukuran file.
7. Frontend mengirim payload ke `submitDraftPengajuan`:
   - Data pengajuan
   - Items
   - `idPengajuan`
   - `resumeToken`
   - `fileBase64`
   - `fileExtension`
   - `fileMimeType`
8. Backend memvalidasi ulang semua data.
9. Backend membuat file Google Drive bernama `{ID Pengajuan}_hardcopy.{extension}`.
10. Backend mengubah status pengajuan dari `Menunggu Upload` menjadi `Baru`.
11. Backend mengisi `Timestamp Submit`, `Submitted At`, `File Hard Copy URL`, dan `File Hard Copy ID`.
12. Backend menambahkan log `StatusLog` dari `Menunggu Upload` ke `Baru` dengan user `system`.
13. Frontend menghapus referensi draft dari `localStorage` dan menampilkan halaman sukses berisi ID pengajuan.

### 7.4 Cek Status Publik

1. Pengguna klik `Cek Status` di `index.html`.
2. Pengguna memasukkan ID pengajuan.
3. Frontend memanggil `checkPengajuanStatus`.
4. Backend mengembalikan status jika ID ditemukan dan status termasuk `Menunggu Upload`, `Baru`, `Disetujui`, `Ditolak`, atau `Selesai`.
5. UI menampilkan badge status dan teks informasi singkat.

Data detail pribadi tidak ditampilkan di cek status publik; UI hanya menonjolkan ID dan status.

## 8. Alur Admin

### 8.1 Login dan Session

1. Admin membuka `dashboard.html`.
2. Jika tidak ada token di `sessionStorage`, sistem menampilkan section login.
3. Admin mengisi username dan password/PIN.
4. Frontend memanggil `adminLogin` tanpa token.
5. Backend membaca sheet `Users` dan menerima login jika:
   - Username cocok.
   - Password/PIN cocok.
   - `Role` adalah `Admin`.
   - `Aktif` adalah `yes`.
6. Backend membuat token UUID dan menyimpan session di `CacheService` selama 6 jam.
7. Backend mengisi `Last Login` di sheet `Users`.
8. Frontend menyimpan token dan nama admin di `sessionStorage`.
9. Logout memanggil `adminLogout`, menghapus token dari cache, dan membersihkan state frontend.

### 8.2 Dashboard Pengajuan

1. Setelah login, frontend memanggil `getDashboard`.
2. Backend hanya menampilkan pengajuan dengan status final: `Baru`, `Disetujui`, `Ditolak`, `Selesai`.
3. Draft `Menunggu Upload` tidak masuk dashboard utama.
4. Dashboard menampilkan summary:
   - Total Pengajuan
   - Baru
   - Disetujui
   - Ditolak
   - Selesai
5. Filter dashboard:
   - Search global untuk ID pengajuan, nama, dan bagian/cabang.
   - Status.
   - Tanggal submit dari/sampai.
6. Dashboard memiliki pagination server-side dengan default `pageSize = 20` dan maksimum `100`.
7. Tabel dashboard menampilkan:
   - No
   - ID Pengajuan
   - Waktu Submit
   - Nama
   - Bagian/Cabang
   - Jml Item
   - Status
   - Aksi Detail

### 8.3 Detail Pengajuan

1. Admin klik `Detail` dari dashboard.
2. Frontend memanggil `getDetail`.
3. Backend hanya mengizinkan detail untuk pengajuan final, bukan draft.
4. Detail menampilkan informasi:
   - ID Pengajuan
   - Waktu Submit
   - Nama
   - Bagian/Cabang
   - Pemilik
   - Tanggal Form
   - Alasan Pengajuan
   - Catatan Tambahan
   - Jumlah Item
   - Link file hard copy
   - Status saat ini
   - Catatan Admin
   - Update terakhir
   - User updater
5. Detail juga menampilkan daftar item:
   - No Item
   - Produk
   - Model
   - Nomor Seri
   - Verifikasi Nama Produk (`verified` atau belum terverifikasi)
6. Detail menampilkan riwayat status dari `StatusLog`, urut terbaru ke terlama.

### 8.4 Update Status

1. Admin membuka detail pengajuan.
2. Admin memilih status baru:
   - `Baru`
   - `Disetujui`
   - `Ditolak`
   - `Selesai`
3. Admin mengisi Catatan Admin.
4. Jika status baru `Ditolak`, Catatan Admin wajib diisi di frontend dan backend.
5. Frontend memanggil `updateStatus`.
6. Backend menyimpan:
   - Status baru
   - Catatan Admin
   - Tanggal Update Status Terakhir
   - User Update Status
   - Riwayat Singkat
7. Backend selalu menambahkan row ke `StatusLog` saat action `updateStatus` berhasil.

## 9. Review Nama Produk Model

### 9.1 Tujuan

Sistem memakai master `ModelProduk` sebagai mapping dari model ke nama produk. Tujuannya agar nama produk konsisten sebelum item masuk antrean cetak kartu.

### 9.2 Perilaku di Form Publik

- Saat halaman form dimuat, frontend memanggil `getModelProduk`.
- Response berisi daftar model verified.
- Jika pengguna mengetik model yang cocok setelah normalisasi, frontend otomatis mengisi `Produk` dan men-disable input Produk.
- Jika model tidak ditemukan, pengguna tetap bisa mengisi Produk manual.

### 9.3 Perilaku Backend Saat Simpan Draft atau Submit

- Backend menormalisasi model dengan trim, collapse spasi, dan uppercase.
- Jika model ditemukan di master `ModelProduk`, backend mengganti nama produk item dengan produk master dan menyimpan:
  - `model_normalized`
  - `produk_status = verified`
  - `produk_sumber = auto`
- Jika model tidak ditemukan, backend menyimpan input manual dan menandai:
  - `produk_status = needs_review`
  - `produk_sumber = manual`

### 9.4 Review oleh Admin

1. Dashboard memuat `getProductReviewQueue` setelah dashboard utama berhasil dimuat.
2. Backend mengelompokkan item yang belum `verified` berdasarkan `model_normalized`.
3. UI menampilkan jumlah item pending, contoh pengajuan/item, dan usulan nama produk dari input manual.
4. Admin mengisi nama produk yang benar dan klik `Approve Nama Produk`.
5. Frontend memanggil `approveModelProduk`.
6. Backend melakukan upsert ke sheet `ModelProduk` dengan status `verified`.
7. Backend memperbarui semua item pending dengan model tersebut menjadi `verified` dan mengganti nama produk sesuai master.

## 10. Antrean Cetak Kartu Garansi

### 10.1 Kriteria Item Masuk Antrean

Item masuk antrean cetak jika memenuhi semua syarat:

- Pengajuan berstatus `Disetujui`.
- Item memiliki `produk_status = verified`.

Item dari pengajuan `Baru`, `Ditolak`, `Selesai`, atau item yang masih `needs_review` tidak masuk antrean cetak.

### 10.2 Fitur Antrean Cetak

Admin membuka menu `Cetak Kartu` dari dashboard.

Sistem menampilkan:

- Summary total tampil.
- Jumlah item `Local`.
- Jumlah item `Import`.
- Jumlah item belum dipilih jenis kartunya.
- Filter search untuk ID, cabang, produk, model, nomor seri.
- Filter jenis kartu: semua, `Local`, `Import`, `Belum Dipilih`.
- Tabel item:
  - Checkbox pilih
  - ID pengajuan dan no item
  - Cabang
  - Produk
  - Model
  - Nomor Seri
  - Jenis Kartu
  - Status Cetak

### 10.3 Pemilihan Jenis Kartu

- Jenis kartu valid hanya `Local` dan `Import`.
- Admin dapat memilih jenis kartu per row.
- Admin dapat memilih beberapa row dan klik `Set Local` atau `Set Import`.
- Frontend memanggil `saveWarrantyCardTypes`.
- Backend menulis/memperbarui row di sheet `WarrantyCards`.
- Jika row belum ada, status cetak default adalah `Belum Dicetak`.

### 10.4 Cetak Kartu

1. Admin memilih satu atau lebih item.
2. Semua item terpilih wajib memiliki jenis kartu.
3. Frontend memuat layout aktif melalui `getPrintLayouts`.
4. Frontend membangun halaman print A4 per item di `section-warranty-print`.
5. Field yang dicetak:
   - Produk
   - Model
   - Nomor Seri
6. Posisi field memakai base layout berdasarkan jenis kartu dan adjustment dari layout aktif.
7. Frontend memanggil `window.print()`.

Catatan penting: action cetak kartu hanya memicu print browser. Status tidak otomatis menjadi `Printed`; admin harus klik `Tandai Sudah Dicetak`.

### 10.5 Tandai Sudah Dicetak dan Reprint

1. Admin memilih item yang sudah dicetak.
2. Semua item wajib memiliki jenis kartu.
3. Admin konfirmasi di browser.
4. Frontend memanggil `markWarrantyCardsPrinted`.
5. Backend membuat `Batch ID` format `KG-PRINT-YYYYMMDD-HHmmss-XXXXXXXX`.
6. Backend memperbarui row `WarrantyCards`:
   - `Status Cetak = Printed`
   - `Print Batch ID`
   - `Printed At`
   - `Printed By`
   - `Reprint Count`
   - `Last Reprint At`
   - `Last Reprint By`
   - `Catatan`
7. Jika item sebelumnya sudah `Printed`, `Reprint Count` bertambah dan data last reprint diisi.
8. Backend menambah row ke `PrintBatch`.
9. UI menampilkan batch ID dan tombol preview label untuk batch tersebut.

## 11. Layout Cetak Kartu

### 11.1 Jenis Layout

Layout cetak hanya berlaku untuk jenis:

- `local`
- `import`

Sistem membuat layout bawaan:

| ID | Type | Name | Builtin |
| --- | --- | --- | --- |
| `local-default` | `local` | `Local Default` | Ya |
| `import-default` | `import` | `Import Default` | Ya |

### 11.2 Konfigurasi Layout

Setiap layout memiliki:

| Field | Keterangan |
| --- | --- |
| `ID` | ID layout. Layout baru memakai prefix type dan potongan UUID. |
| `Type` | `local` atau `import`. |
| `Name` | Nama layout. Wajib saat menyimpan. |
| `Offset X` | Pergeseran horizontal dalam mm. Boleh negatif. |
| `Offset Y` | Pergeseran vertikal dalam mm. Boleh negatif. |
| `Gap Product Model` | Tambahan jarak vertikal dari produk ke model. Minimal 0. |
| `Gap Model Serial` | Tambahan jarak vertikal dari model ke serial. Minimal 0. |
| `Is Builtin` | `TRUE` untuk layout bawaan. |
| `Created At` | Timestamp dibuat. |
| `Updated At` | Timestamp update terakhir. |
| `Updated By` | Username admin updater. |

### 11.3 Setting UI

Menu `Setting` di dashboard digunakan untuk:

- Memilih jenis layout `Local` atau `Import`.
- Melihat layout aktif.
- Mengedit layout custom.
- Menambah layout baru.
- Duplikasi layout aktif.
- Simpan layout.
- Jadikan layout sebagai aktif.
- Hapus layout custom.

Aturan:

- Layout bawaan tidak boleh dihapus.
- Layout aktif tidak boleh dihapus sebelum admin memilih layout aktif lain.
- Jika config layout aktif menunjuk ID yang tidak ada, backend fallback ke layout default type terkait.

## 12. Label Pengiriman Cabang

### 12.1 Tujuan

Label pengiriman cabang membantu admin mengelompokkan kartu yang sudah dicetak berdasarkan cabang.

### 12.2 Sumber Data

- Label dibuat dari item `WarrantyCards` yang status cetaknya `Printed`.
- Jika dibuka dari tombol batch setelah mark printed, label difilter berdasarkan `Print Batch ID` tersebut.
- Jika dibuka dari antrean cetak tanpa batch ID, label memakai item printed yang sesuai search aktif.

### 12.3 Format Label

- Ukuran label: 60 x 50 mm.
- Layout halaman: A4 portrait.
- Satu halaman memuat maksimal 15 label.
- Setiap label menampilkan:
  - Nama cabang dalam huruf besar.
  - Quantity item untuk cabang tersebut.

## 13. Email Digest

### 13.1 Trigger

`setupApp()` membuat dua trigger time-based untuk `sendEmailDigest`:

- Senin sekitar pukul 09:00.
- Kamis sekitar pukul 09:00.

### 13.2 Penerima

Penerima diambil dari sheet `EmailRecipients` dengan aturan:

- `Aktif` harus `yes`.
- `Email` tidak kosong.

Jika tidak ada penerima aktif, sistem mencatat row di `EmailLog` dengan status `Tidak ada penerima aktif`.

### 13.3 Isi Digest Aktual

Digest mengambil maksimal 100 pengajuan terbaru dengan status:

- `Baru`
- `Disetujui`

Digest tidak mengirim draft `Menunggu Upload`, pengajuan `Ditolak`, atau `Selesai`.

Catatan: config `LAST_EMAIL_SENT_AT` diperbarui setelah digest, tetapi implementasi aktual tidak memakai nilai ini untuk membatasi hanya pengajuan baru sejak email terakhir.

## 14. Data Model Google Sheets

### 14.1 Sheet `Pengajuan`

| Kolom | Keterangan |
| --- | --- |
| `ID Pengajuan` | ID unik format `KG-YYYYMMDD-0001`. |
| `Timestamp Submit` | Waktu submit final; kosong saat draft. |
| `Nama` | Nama pengaju. |
| `Bagian/Cabang` | Unit/cabang pengaju. |
| `Pemilik` | Pemilik kartu/produk. |
| `Alasan Pengajuan` | Alasan pengajuan kartu garansi baru. |
| `Tanggal Form` | Tanggal form dibuat. |
| `File Hard Copy URL` | URL file signed di Google Drive; kosong saat draft. |
| `File Hard Copy ID` | File ID Google Drive; kosong saat draft. |
| `Catatan Tambahan` | Catatan dari pengaju. |
| `Jumlah Item` | Jumlah item produk. |
| `Status` | `Menunggu Upload`, `Baru`, `Disetujui`, `Ditolak`, atau `Selesai`. |
| `Catatan Admin` | Catatan terakhir dari admin saat update status. |
| `Tanggal Update Status Terakhir` | Timestamp update status oleh admin. |
| `User Update Status` | Username admin updater. |
| `Riwayat Singkat` | Log ringkas multiline. |
| `Resume Token` | Token rahasia untuk lanjutkan draft; dikosongkan setelah submit final. |
| `Draft Created At` | Timestamp draft pertama dibuat. |
| `Draft Updated At` | Timestamp draft terakhir diperbarui. |
| `Submitted At` | Timestamp submit final. |

### 14.2 Sheet `PengajuanItems`

| Kolom | Keterangan |
| --- | --- |
| `ID Pengajuan` | Relasi ke sheet `Pengajuan`. |
| `No Item` | Nomor urut item. |
| `Produk` | Nama produk. Bisa diganti dari master saat model verified. |
| `Model` | Model produk sesuai input pengguna. |
| `Nomor Seri` | Nomor seri produk. |
| `model_normalized` | Model hasil normalisasi trim/collapse space/uppercase. |
| `produk_status` | `verified` atau `needs_review`. |
| `produk_sumber` | `auto`, `manual`, atau `admin`. |

### 14.3 Sheet `Users`

| Kolom | Keterangan |
| --- | --- |
| `Username` | Username admin. |
| `Password/PIN` | Password/PIN plain text. |
| `Nama` | Nama admin. |
| `Role` | Harus `Admin` untuk login dashboard. |
| `Aktif` | `yes` untuk aktif. |
| `Last Login` | Timestamp login terakhir. |

### 14.4 Sheet `EmailRecipients`

| Kolom | Keterangan |
| --- | --- |
| `Nama` | Nama penerima. |
| `Email` | Email penerima. |
| `Aktif` | `yes` untuk aktif. |
| `Keterangan` | Catatan penerima. |

### 14.5 Sheet `Config`

| Key | Keterangan |
| --- | --- |
| `APP_NAME` | Nama aplikasi backend/default. |
| `DRIVE_FOLDER_ID` | Folder Google Drive untuk upload hard copy. |
| `MAX_UPLOAD_MB` | Batas ukuran upload backend. |
| `MAX_ITEMS` | Batas jumlah item backend. |
| `LAST_EMAIL_SENT_AT` | Timestamp digest terakhir; diperbarui otomatis. |
| `ACTIVE_PRINT_LAYOUT_LOCAL` | ID layout aktif untuk kartu Local. |
| `ACTIVE_PRINT_LAYOUT_IMPORT` | ID layout aktif untuk kartu Import. |

### 14.6 Sheet `StatusLog`

| Kolom | Keterangan |
| --- | --- |
| `Timestamp` | Waktu perubahan status. |
| `ID Pengajuan` | ID pengajuan. |
| `Status Lama` | Status sebelumnya. |
| `Status Baru` | Status baru. |
| `Catatan Admin` | Catatan admin atau catatan sistem. |
| `User` | Username admin atau `system`. |

### 14.7 Sheet `EmailLog`

| Kolom | Keterangan |
| --- | --- |
| `Timestamp` | Waktu pengiriman/percobaan digest. |
| `Subject` | Subject email. |
| `Recipients` | Daftar penerima. |
| `Jumlah Pengajuan` | Jumlah pengajuan di digest. |
| `Status` | `Terkirim`, `Tidak ada penerima aktif`, atau `Tidak ada pengajuan terbuka`. |

### 14.8 Sheet `WarrantyCards`

| Kolom | Keterangan |
| --- | --- |
| `ID Pengajuan` | Relasi ke pengajuan. |
| `No Item` | Relasi ke item pengajuan. |
| `Produk` | Nama produk final saat masuk data kartu. |
| `Model` | Model produk. |
| `Nomor Seri` | Nomor seri. |
| `Jenis Kartu` | `Local` atau `Import`. |
| `Status Cetak` | `Belum Dicetak` atau `Printed`. |
| `Print Batch ID` | Batch terakhir saat ditandai printed. |
| `Printed At` | Timestamp printed pertama. |
| `Printed By` | Username printed pertama. |
| `Reprint Count` | Jumlah reprint setelah sudah pernah printed. |
| `Last Reprint At` | Timestamp reprint terakhir. |
| `Last Reprint By` | Username reprint terakhir. |
| `Catatan` | Catatan proses cetak. |

### 14.9 Sheet `PrintBatch`

| Kolom | Keterangan |
| --- | --- |
| `Batch ID` | ID batch format `KG-PRINT-YYYYMMDD-HHmmss-XXXXXXXX`. |
| `Tipe Batch` | Saat ini `warranty_card`. |
| `Created At` | Timestamp batch dibuat. |
| `Created By` | Username admin. |
| `Jumlah Item` | Jumlah item dalam batch. |
| `Catatan` | Catatan batch. |

### 14.10 Sheet `PrintLayouts`

| Kolom | Keterangan |
| --- | --- |
| `ID` | ID layout. |
| `Type` | `local` atau `import`. |
| `Name` | Nama layout. |
| `Offset X` | Offset horizontal mm. |
| `Offset Y` | Offset vertikal mm. |
| `Gap Product Model` | Gap produk ke model mm. |
| `Gap Model Serial` | Gap model ke serial mm. |
| `Is Builtin` | `TRUE`/`FALSE`. |
| `Created At` | Timestamp dibuat. |
| `Updated At` | Timestamp update. |
| `Updated By` | Username updater. |

### 14.11 Sheet `ModelProduk`

| Kolom | Keterangan |
| --- | --- |
| `model_normalized` | Key model hasil normalisasi. |
| `model_display` | Model display. |
| `produk` | Nama produk verified. |
| `status` | Saat ini yang dipakai adalah `verified`. |
| `updated_at` | Timestamp update. |
| `updated_by` | Username updater atau system. |

## 15. Kontrak API Apps Script

Semua action dipanggil lewat `POST` ke `CONFIG.API_URL`.

### 15.1 Public Actions

| Action | Fungsi Backend | Keterangan |
| --- | --- | --- |
| `submitPengajuan` | `handleSubmitPengajuan` | Legacy/direct submit dengan file dalam satu langkah. Tidak dipakai alur utama frontend saat ini. |
| `saveDraftPengajuan` | `handleSaveDraftPengajuan` | Buat/perbarui draft dan item tanpa file upload. |
| `getDraftPengajuan` | `handleGetDraftPengajuan` | Ambil draft dengan ID dan resume token. |
| `checkDraftPengajuanStatus` | `handleCheckDraftPengajuanStatus` | Ambil resume token draft dari ID jika tersedia dan status masih draft. |
| `checkPengajuanStatus` | `handleCheckPengajuanStatus` | Cek status publik berdasarkan ID. |
| `getModelProduk` | `handleGetModelProduk` | Ambil master model-produk verified. |
| `getModelKategori` | `handleGetModelProduk` | Alias lama untuk `getModelProduk`. |
| `submitDraftPengajuan` | `handleSubmitDraftPengajuan` | Submit final draft dengan upload file hard copy. |

### 15.2 Admin Actions

| Action | Fungsi Backend | Keterangan |
| --- | --- | --- |
| `adminLogin` | `handleAdminLogin` | Login admin, menghasilkan token. |
| `adminLogout` | `handleAdminLogout` | Hapus token dari cache. |
| `getDashboard` | `handleGetDashboard` | Summary, rows, pagination dashboard. |
| `getDetail` | `handleGetDetail` | Detail pengajuan final. |
| `updateStatus` | `handleUpdateStatus` | Update status dan catatan admin. |
| `getProductReviewQueue` | `handleGetProductReviewQueue` | Ambil queue model yang nama produknya belum verified. |
| `getCategoryReviewQueue` | `handleGetProductReviewQueue` | Alias lama. |
| `approveModelProduk` | `handleApproveModelProduk` | Approve mapping model ke produk. |
| `approveModelKategori` | `handleApproveModelProduk` | Alias lama. |
| `getWarrantyPrintQueue` | `handleGetWarrantyPrintQueue` | Ambil antrean cetak kartu. |
| `getPrintLayouts` | `handleGetPrintLayouts` | Ambil semua layout dan layout aktif. |
| `savePrintLayout` | `handleSavePrintLayout` | Simpan layout baru/ubah layout. |
| `deletePrintLayout` | `handleDeletePrintLayout` | Hapus layout custom. |
| `setActivePrintLayout` | `handleSetActivePrintLayout` | Set layout aktif per jenis kartu. |
| `saveWarrantyCardTypes` | `handleSaveWarrantyCardTypes` | Simpan jenis kartu Local/Import. |
| `markWarrantyCardsPrinted` | `handleMarkWarrantyCardsPrinted` | Tandai kartu printed dan buat batch. |

## 16. Aturan Bisnis

- ID pengajuan memakai format `KG-YYYYMMDD-0001` dan sequence bertambah per tanggal.
- Simpan draft wajib dilakukan sebelum cetak form pada alur utama UI.
- Draft memiliki status `Menunggu Upload` dan tidak muncul di dashboard admin utama.
- Submit final hanya bisa dilakukan untuk draft valid dengan resume token valid.
- Setelah submit final, resume token dikosongkan dan draft tidak bisa diedit lagi.
- Setiap pengajuan wajib memiliki minimal 1 item.
- Pada form publik, urutan input item harus mendukung alur master model-produk: `Model` diisi lebih dulu, kemudian `Produk / Nama Produk`, lalu `Nomor Seri`.
- Jumlah item maksimal mengikuti `MAX_ITEMS` backend dan frontend.
- Upload file signed wajib saat submit final.
- Preview/cetak form tidak mewajibkan upload file.
- Saat cabang mencetak form, tanggal `Disetujui dan diberikan` wajib kosong karena tanggal tersebut diisi dari tanggal cetak kartu pada tahap proses kartu.
- File upload hanya boleh PDF, JPG/JPEG, atau PNG.
- Backend memvalidasi extension dan MIME type file.
- Ukuran file upload maksimum mengikuti `MAX_UPLOAD_MB`.
- Tanggal Form wajib valid dan tidak boleh lebih dari 7 hari ke depan.
- Hanya user aktif dengan role `Admin` yang dapat login dashboard.
- Status final hanya boleh `Baru`, `Disetujui`, `Ditolak`, atau `Selesai`.
- Catatan Admin wajib jika status disimpan sebagai `Ditolak`.
- Item hanya masuk antrean cetak jika pengajuan `Disetujui` dan produk item `verified`.
- Jenis kartu hanya boleh `Local` atau `Import`.
- Layout type hanya boleh `local` atau `import`.
- Layout builtin tidak boleh dihapus.
- Layout aktif tidak boleh dihapus.
- Kartu yang sudah dicetak ulang meningkatkan `Reprint Count`.
- Label cabang hanya dibuat dari kartu yang status cetaknya `Printed`.

## 17. Validasi

### 17.1 Frontend Public Form

- Field wajib tidak boleh kosong.
- Tanggal Form tidak boleh lebih dari 7 hari ke depan.
- Minimal 1 item.
- Setiap item wajib memiliki Produk, Model, dan Nomor Seri.
- Jumlah item tidak boleh melewati `CONFIG.MAX_ITEMS`.
- File wajib hanya saat submit final.
- Extension file harus PDF/JPG/JPEG/PNG.
- Ukuran file tidak boleh lebih dari `CONFIG.MAX_UPLOAD_MB`.
- Input dengan error diberi class `field-error`.
- Alert menampilkan status loading, success, atau error.

### 17.2 Frontend Admin

- Login mewajibkan username dan password.
- Update status `Ditolak` mewajibkan Catatan Admin.
- Review nama produk mewajibkan input nama produk.
- Cetak/tandai printed mewajibkan minimal 1 item dipilih.
- Cetak/tandai printed mewajibkan semua item terpilih memiliki jenis kartu.
- Simpan layout mewajibkan nama layout.
- Nilai posisi layout harus angka.
- Gap layout minimal 0.

### 17.3 Backend

- Semua field wajib pengajuan divalidasi ulang.
- Semua input string di-trim.
- Tanggal divalidasi dan dibatasi maksimal 7 hari ke depan.
- Jumlah item divalidasi.
- Item divalidasi per field.
- File divalidasi extension, MIME type, dan ukuran perkiraan base64.
- Session admin divalidasi dengan `CacheService` untuk semua action admin.
- Status divalidasi terhadap daftar valid.
- Jenis kartu dan layout type divalidasi.
- Operasi yang mengubah data memakai `LockService`.

## 18. Kebutuhan Non-Fungsional

### 18.1 Keamanan

- Dashboard admin wajib session valid.
- Token admin disimpan di `sessionStorage`, bukan `localStorage`.
- Session server-side disimpan di `CacheService` selama 6 jam.
- Resume token draft harus dianggap rahasia karena dapat membuka dan mengubah draft sebelum submit final.
- ID pengajuan draft juga harus dianggap sensitif karena action `checkDraftPengajuanStatus` dapat mengembalikan resume token selama status masih `Menunggu Upload`.
- Data yang dirender ke HTML harus di-escape untuk mengurangi risiko XSS.
- Link file Drive dibuka dengan `target="_blank"` dan `rel="noopener"`.
- File upload dibatasi extension, MIME type, dan ukuran.
- Operasi submit, update status, review produk, layout, dan cetak memakai lock untuk mengurangi race condition.

Catatan keamanan aktual:

- Password/PIN admin masih plain text di sheet `Users`.
- Admin default dibuat dengan username `admin` dan password `admin123`; wajib diganti setelah setup.
- Frontend statis memakai API URL publik; authorization bergantung pada session token untuk action admin dan resume token untuk draft.

### 18.2 Performa

- Dashboard melakukan filter dan pagination di backend.
- `pageSize` dashboard default 20 dan maksimum 100.
- Email digest membatasi data menjadi 100 row terbaru berstatus `Baru` atau `Disetujui`.
- Session memakai cache agar backend tidak membaca sheet `Users` di setiap request admin.
- Upload base64 dapat membesar sekitar 33% dari ukuran file asli.

### 18.3 Kompatibilitas

- Backend berjalan sebagai Google Apps Script Web App.
- Frontend saat ini adalah HTML/JavaScript statis dan Tailwind CDN.
- Aplikasi memakai Google Workspace services:
  - `SpreadsheetApp`
  - `DriveApp`
  - `CacheService`
  - `LockService`
  - `MailApp`
  - `ScriptApp`
  - `PropertiesService`
  - `Utilities`
  - `Session`
  - `ContentService`
- Frontend memakai request `text/plain;charset=utf-8` untuk mengurangi masalah CORS dari file lokal.

### 18.4 Kegunaan

- UI responsif untuk desktop dan mobile.
- Tabel menggunakan horizontal scroll untuk kolom banyak.
- Form cetak pengajuan dioptimalkan untuk A4 dan memakai dua blok tanda tangan terpisah sesuai alur cabang dan controller.
- Cetak kartu garansi menggunakan halaman A4 per item.
- Label cabang menggunakan halaman A4 dengan 15 label per halaman.
- Alert memberi feedback saat loading, sukses, dan gagal.

## 19. Setup dan Deployment Aktual

### 19.1 Backend

1. Buka Apps Script.
2. Salin isi `Code.gs` ke project Apps Script.
3. Jika ingin memakai spreadsheet tertentu, isi `APP.SPREADSHEET_ID`; jika kosong, backend memakai spreadsheet aktif atau membuat spreadsheet baru.
4. Jalankan `setupApp()`.
5. Berikan izin untuk Sheets, Drive, Mail, Cache, Lock, Trigger, dan service terkait.
6. `setupApp()` akan:
   - Membuat/menjamin semua sheet dan header.
   - Membuat user admin default jika sheet `Users` kosong.
   - Membuat default config.
   - Membuat folder Drive upload jika `DRIVE_FOLDER_ID` kosong.
   - Membuat default print layouts.
   - Membuat trigger email digest.
7. Deploy Apps Script sebagai Web App dengan akses yang sesuai kebutuhan aplikasi.
8. Salin URL deployment Web App.

### 19.2 Frontend

1. Buka `config.js`.
2. Isi `API_URL` dengan URL deployment Apps Script.
3. Sesuaikan `APP_NAME`, `MAX_UPLOAD_MB`, dan `MAX_ITEMS` jika perlu.
4. Buka `index.html` untuk form publik.
5. Buka `dashboard.html` untuk dashboard admin.
6. Login awal: username `admin`, password `admin123`.
7. Segera ganti password default melalui sheet `Users`.

### 19.3 Konfigurasi Sheet

- Isi penerima digest di `EmailRecipients`; set `Aktif` menjadi `yes`.
- Pastikan `Config.DRIVE_FOLDER_ID` valid.
- Pastikan `Config.MAX_UPLOAD_MB` dan `Config.MAX_ITEMS` konsisten dengan frontend config.
- Pastikan layout aktif di `ACTIVE_PRINT_LAYOUT_LOCAL` dan `ACTIVE_PRINT_LAYOUT_IMPORT` menunjuk layout valid atau biarkan default.

## 20. Kriteria Penerimaan

### 20.1 Form, Draft, dan Submit Final

- Pengguna dapat membuka form tanpa login.
- Pengguna tidak dapat menyimpan draft jika field wajib atau item belum lengkap.
- Pengguna dapat menyimpan draft tanpa upload file.
- Sistem menghasilkan ID pengajuan dan resume token untuk draft.
- Draft tersimpan dengan status `Menunggu Upload`.
- Sistem mencetak form A4 yang memuat ID, data pengajuan, item, catatan, `Tanggal Form`, dan tabel tanda tangan.
- Form cetak cabang menampilkan blok tanda tangan `Diajukan/Diketahui/Disetujui` dan blok `Diberikan/Disetujui` secara terpisah.
- Saat cabang mencetak form, teks `Disetujui dan diberikan :` tetap kosong.
- Pengguna dapat melanjutkan draft dengan token valid.
- Sistem menolak draft jika token salah atau status bukan `Menunggu Upload`.
- Pengguna tidak dapat submit final tanpa file signed.
- Sistem menolak file dengan format, MIME type, atau ukuran tidak valid.
- Submit final menyimpan file ke Drive.
- Submit final mengubah status menjadi `Baru`.
- Submit final mencatat transisi `Menunggu Upload` → `Baru` di `StatusLog`.
- Setelah submit final, draft tidak bisa dilanjutkan lagi.

### 20.2 Cek Status Publik

- Pengguna dapat mengecek status dengan ID valid.
- Sistem menampilkan status `Menunggu Upload`, `Baru`, `Disetujui`, `Ditolak`, atau `Selesai`.
- Sistem menolak ID kosong atau tidak ditemukan.

### 20.3 Dashboard Admin

- Admin valid dapat login.
- Admin invalid ditolak.
- Logout menghapus token browser dan cache server.
- Dashboard hanya menampilkan status final, bukan draft.
- Summary per status benar sesuai filter.
- Search, filter status, filter tanggal, dan pagination bekerja.
- Admin dapat membuka detail pengajuan.
- Detail menampilkan informasi pengajuan, item, file hard copy, status meta, dan riwayat.

### 20.4 Update Status

- Admin dapat menyimpan status valid.
- Backend menolak status invalid.
- Backend menolak status `Ditolak` tanpa Catatan Admin.
- Status, catatan, timestamp update, user updater, riwayat singkat, dan `StatusLog` diperbarui.

### 20.5 Review Nama Produk

- Model verified otomatis mengisi Produk di form publik.
- Field item publik ditampilkan dengan urutan `Model`, `Produk / Nama Produk`, lalu `Nomor Seri`.
- Model baru tersimpan sebagai `needs_review`.
- Dashboard menampilkan queue review untuk model yang belum verified.
- Admin dapat approve nama produk untuk model.
- Approval membuat/memperbarui row `ModelProduk` dan memperbarui item pending menjadi `verified`.
- Item baru dengan model yang sudah approved otomatis menjadi `verified`.

### 20.6 Cetak Kartu Garansi

- Hanya item dari pengajuan `Disetujui` dan produk `verified` yang muncul di antrean cetak.
- Admin dapat filter/search antrean cetak.
- Admin dapat memilih jenis kartu `Local`/`Import` per item atau batch.
- Sistem menyimpan jenis kartu ke `WarrantyCards`.
- Admin hanya dapat mencetak item yang sudah dipilih dan memiliki jenis kartu.
- Cetak kartu memakai layout aktif sesuai jenis kartu.
- Cetak kartu tidak otomatis mengubah status cetak.
- Admin dapat menandai item sebagai `Printed`.
- Sistem membuat batch cetak di `PrintBatch`.
- Reprint menambah `Reprint Count` dan mengisi data last reprint.

### 20.7 Layout Cetak

- Sistem membuat default layout Local dan Import saat setup.
- Admin dapat menambah dan menyimpan layout custom.
- Admin dapat menjadikan layout custom sebagai aktif.
- Admin dapat menghapus layout custom yang tidak aktif.
- Sistem menolak hapus layout bawaan.
- Sistem menolak hapus layout aktif.

### 20.8 Label Pengiriman Cabang

- Sistem dapat membuat preview label dari item `Printed`.
- Label dikelompokkan per cabang.
- Qty label sama dengan jumlah item printed untuk cabang tersebut.
- Label dapat dicetak dalam format A4, 15 label per halaman.

### 20.9 Email Digest

- Trigger digest dibuat saat setup.
- Digest tidak dikirim jika tidak ada penerima aktif dan kasus ini tercatat di `EmailLog`.
- Digest mencakup maksimal 100 pengajuan terbaru berstatus `Baru` atau `Disetujui`.
- Hasil pengiriman tercatat di `EmailLog`.

## 21. Catatan Migrasi ke Vue/Nuxt

### 21.1 Prinsip Migrasi

- Pertahankan backend contract terlebih dahulu agar migrasi UI tidak mengubah perilaku bisnis.
- Pecah `index.html` menjadi halaman/komponen public form, draft resume, status check, print form, dan success state.
- Pecah `dashboard.html` menjadi halaman/komponen login, dashboard, detail, product review, print queue, layout settings, shipping labels, dan print renderer.
- State yang saat ini global di script HTML perlu dipindahkan ke store/composable yang eksplisit.
- Semua call API harus tetap mengirim `Content-Type: text/plain;charset=utf-8` selama backend masih Apps Script `ContentService` tanpa CORS header eksplisit.
- Jangan memindahkan token admin ke `localStorage`; tetap gunakan session-scoped storage.
- Resume token draft boleh disimpan di local storage seperti implementasi saat ini, tetapi perlakukan sebagai secret.
- Print views harus dipertahankan pixel/mm-sensitive; migrasi CSS print harus diuji manual di browser.

### 21.2 Mapping Halaman Disarankan

| Area Aktual | Target Vue/Nuxt yang Disarankan |
| --- | --- |
| `index.html` form utama | `/` atau `/pengajuan` |
| Cek status | Komponen/section di halaman publik atau `/status` |
| Lanjutkan draft | Komponen/section di halaman publik; support query `id` dan `token` |
| Print form pengajuan | Komponen print-only yang memakai data form aktif |
| `dashboard.html` login | `/admin/login` |
| Dashboard admin | `/admin` |
| Detail pengajuan | `/admin/pengajuan/[id]` atau modal/detail view |
| Review nama produk | Section di dashboard atau `/admin/review-produk` |
| Antrean cetak | `/admin/cetak` |
| Setting layout | `/admin/setting/layout-cetak` |
| Label cabang | `/admin/cetak/label` atau print preview modal |

### 21.3 Store/Composable yang Disarankan

| Store/Composable | Tanggung Jawab |
| --- | --- |
| `useApiClient` | Wrapper fetch Apps Script, error handling, inject token opsional. |
| `usePublicPengajuan` | State form, items, validasi publik, save draft, resume draft, submit final. |
| `useStatusCheck` | Cek status publik dan render status text/badge. |
| `useAdminSession` | Login, logout, token `sessionStorage`, guard admin routes. |
| `useDashboard` | Filter, pagination, summary, rows. |
| `usePengajuanDetail` | Detail, items, history, update status. |
| `useModelProdukReview` | Queue review dan approve model-produk. |
| `useWarrantyPrintQueue` | Queue cetak, selection, jenis kartu, printed batch. |
| `usePrintLayouts` | Layout list, active layout, CRUD layout. |
| `useShippingLabels` | Build label cabang dari row printed. |

### 21.4 Risiko Migrasi yang Harus Diuji Manual

- CORS Apps Script saat frontend berpindah dari file lokal ke dev server/domain Nuxt.
- Print form A4, print kartu garansi, dan label cabang karena sangat bergantung CSS print/mm.
- Persistensi session admin dan draft resume setelah refresh halaman.
- Query URL resume draft (`id`, `idPengajuan`, `token`, `resumeToken`).
- Upload base64 file besar dan limit payload Apps Script.
- Perbedaan timezone saat format tanggal dan filter tanggal.
- Race condition ID dan update data; backend lock harus tetap dipakai.

## 22. Risiko dan Catatan Produk

- Password plain text adalah risiko utama jika aplikasi dipakai di luar lingkungan internal terbatas.
- Admin default harus diganti segera setelah setup.
- Resume token di URL dapat dibagikan; siapa pun yang punya link dapat melanjutkan draft sebelum submit final.
- Selama status masih `Menunggu Upload`, siapa pun yang mengetahui ID pengajuan dapat meminta resume token melalui API draft status.
- Apps Script memiliki limit runtime, payload, email, Drive, dan Spreadsheet.
- Tailwind CDN membutuhkan akses internet dari browser.
- Frontend statis dan backend Apps Script publik membuat security boundary utama berada di validasi backend dan token.
- Drive file permission mengikuti file/folder yang dibuat Apps Script.
- Email digest saat ini mengirim semua pengajuan terbuka terbaru, bukan delta sejak digest terakhir.

## 23. Metrik Keberhasilan

- Jumlah pengajuan draft yang berhasil lanjut ke submit final.
- Persentase pengajuan final yang memiliki file hard copy valid.
- Waktu rata-rata dari `Baru` ke `Disetujui`.
- Waktu rata-rata dari `Disetujui` ke kartu `Printed`.
- Jumlah item `needs_review` yang tertunda.
- Jumlah kartu `Printed` per batch dan per cabang.
- Jumlah reprint kartu.
- Jumlah error submit/login/update status/upload yang dilaporkan pengguna.

## 24. Potensi Pengembangan Lanjutan

- Hashing password atau migrasi ke login Google Workspace.
- Role tambahan seperti Controller, Branch Manager, CS Head, dan Div. Head.
- UI manajemen users, recipients, dan config.
- Approval bertahap digital sesuai tabel tanda tangan.
- Email notifikasi otomatis saat submit final dan status berubah.
- Export dashboard dan antrean cetak ke CSV/PDF.
- Audit log lebih lengkap untuk login, akses detail, approval produk, dan cetak.
- Backend API terpisah dari Apps Script jika kebutuhan CORS, auth, dan performa meningkat.
- Storage file dan database yang lebih kuat jika volume pengajuan meningkat.
