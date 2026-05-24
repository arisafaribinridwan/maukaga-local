# Rencana Pengembangan Berikutnya

## Context

MVP saat ini sudah berjalan baik untuk alur dasar pengajuan kartu garansi: cabang mengisi form, mencetak form pengajuan, upload hard copy bertanda tangan, lalu controller/admin memantau dan update status melalui dashboard. Kebutuhan berikutnya adalah membuat sistem lebih siap dipakai operasional harian: data produk tidak salah, controller bisa cetak kartu garansi secara bulk, label pengiriman bisa dicetak, dan cabang mudah mendapat update fitur tanpa proses manual yang rumit.

Kondisi aplikasi sekarang:
- Frontend masih berupa file HTML lokal: `index.html`, `dashboard.html`, dan `config.js`.
- Backend memakai Google Apps Script di `Code.gs`.
- Data tersimpan di Google Sheets dan file upload tersimpan di Google Drive.
- Print yang sudah ada baru print form pengajuan dari `index.html`, belum print kartu garansi fisik, bulk print, atau label pengiriman.
- Sumber master data yang dipilih untuk tahap awal adalah Google Sheet master.

## Rekomendasi Utama

Jangan langsung mulai dari migrasi Vue. Urutan paling aman adalah menyiapkan model data dan cara distribusi/update dulu, karena fitur master data, bulk print, dan label pengiriman akan menentukan struktur UI Vue nanti.

Urutan prioritas yang direkomendasikan:

1. Tentukan cara distribusi/update aplikasi.
2. Tambahkan fondasi master data dan tracking item/print di backend.
3. Migrasi frontend ke Vue dengan alur yang sama seperti sekarang.
4. Tambahkan master data-driven form.
5. Tambahkan bulk cetak kartu garansi.
6. Tambahkan cetak label pengiriman.
7. Hardening keamanan, audit, dan SOP operasional.

## Phase 1 — Keputusan Distribusi dan Update

Tujuan: cabang bisa memakai fitur terbaru dengan langkah paling sedikit.

Rekomendasi pendekatan:
- Gunakan frontend terpusat jika memungkinkan, supaya cabang cukup buka satu URL yang sama.
- Karena tidak ada server sendiri, opsi paling cocok adalah:
  1. Google Apps Script HTMLService sebagai frontend terpusat.
  2. Static hosting yang diizinkan kebijakan perusahaan, jika ada.
  3. File lokal tetap sebagai fallback terakhir, bukan jalur utama.

Alasan:
- File lokal sulit di-update serentak ke banyak cabang.
- Satu URL terpusat membuat update frontend langsung aktif untuk semua cabang.
- Backend Apps Script dan data Sheets/Drive masih bisa dipertahankan.

File yang terdampak saat implementasi nanti:
- `config.js`
- `index.html`
- `dashboard.html`
- `Code.gs`
- `README.md`

## Phase 2 — Fondasi Data Backend

Tujuan: sebelum fitur print dan Vue dibuat, struktur data harus siap agar tidak perlu rombak besar.

Tambahkan sheet baru di Apps Script setup:

1. `MasterProducts`
   - `Model`
   - `Produk`
   - `Kategori`
   - `Aktif`
   - kolom tambahan opsional seperti brand/series/catatan

2. `WarrantyCardLog` atau `WarrantyCards`
   - `ID Pengajuan`
   - `No Item`
   - `Model`
   - `Nomor Seri`
   - `Status Cetak`
   - `Print Batch ID`
   - `Printed At`
   - `Printed By`
   - `Reprint Count`

3. `PrintBatch`
   - `Batch ID`
   - `Tipe Batch` seperti `warranty_card` atau `shipping_label`
   - `Created At`
   - `Created By`
   - `Jumlah Item`
   - `Catatan`

4. `ShippingLabelLog`
   - `Shipment Batch ID`
   - `Cabang Tujuan`
   - `Courier`
   - `Jumlah Kartu`
   - `Request IDs`
   - `Printed At`
   - `Printed By`

Backend `Code.gs` perlu menambah action API untuk:
- membaca master produk berdasarkan model,
- validasi model saat submit/draft,
- daftar item yang eligible dicetak,
- membuat print batch,
- menandai item sudah dicetak,
- membuat shipment batch,
- membaca data label pengiriman.

## Phase 3 — Migrasi Frontend ke Vue

Tujuan: mengganti HTML/JS inline menjadi frontend yang lebih mudah dikembangkan, tanpa langsung mengubah semua flow bisnis.

Pendekatan:
- Gunakan Vue 3 + Vite untuk struktur frontend baru.
- Buat ulang flow yang sudah ada terlebih dahulu:
  - form pengajuan cabang,
  - simpan draft,
  - lanjutkan draft,
  - submit final,
  - dashboard admin,
  - filter dashboard,
  - detail pengajuan,
  - update status.
- Buat API client bersama untuk memanggil Apps Script action-based API di `Code.gs`.
- Buat komponen print/layout yang reusable untuk form, kartu garansi, dan label.

Catatan penting:
- Vue sebaiknya tidak dikerjakan sebelum struktur master data dan print tracking disepakati.
- Jika distribusi terpusat dipilih, Vue build harus diarahkan ke mekanisme hosting yang dipilih.

## Phase 4 — Master Data di Form Cabang

Tujuan: cabang cukup isi model dan nomor seri, lalu produk/kategori diketahui otomatis dari master data.

Perubahan alur:
1. Cabang mengisi model.
2. Sistem mencari model di `MasterProducts`.
3. Jika model ditemukan:
   - produk otomatis terisi,
   - kategori otomatis diketahui,
   - field produk/kategori sebaiknya readonly.
4. Cabang mengisi nomor seri.
5. Saat submit, backend tetap validasi ulang model agar data tidak salah.

Kebijakan yang perlu diputuskan saat implementasi:
- Jika model tidak ditemukan, apakah submit diblokir atau boleh lanjut dengan status exception?
- Apakah nomor seri harus unik secara global?
- Apakah satu model selalu hanya punya satu produk dan satu kategori?

## Phase 5 — Bulk Cetak Kartu Garansi

Tujuan: controller bisa mencetak banyak kartu garansi dari daftar permintaan yang sudah disetujui.

Rekomendasi workflow:
1. Controller membuka dashboard print queue.
2. Sistem menampilkan item dari pengajuan berstatus `Disetujui`.
3. Controller memilih satu atau banyak item/request.
4. Sistem membuat `PrintBatch`.
5. Sistem membuka layout cetak kartu garansi sesuai kategori produk: local/import.
6. Controller mencetak kartu garansi.
7. Sistem mencatat item sebagai `Printed`.
8. Jika cetak ulang, sistem menaikkan `Reprint Count` dan mencatat alasan jika diperlukan.

Catatan desain:
- Tracking cetak sebaiknya per item, bukan hanya per pengajuan, karena satu pengajuan bisa berisi banyak produk.
- Status request seperti `Disetujui` atau `Selesai` tidak cukup untuk melacak cetak kartu satu per satu.

## Phase 6 — Cetak Label Pengiriman

Tujuan: mendukung proses pemisahan dan pengiriman kartu garansi via kurir.

Rekomendasi workflow:
1. Controller memilih kartu/request yang sudah dicetak.
2. Sistem mengelompokkan berdasarkan cabang tujuan.
3. Controller membuat shipment batch.
4. Sistem mencetak label berisi:
   - cabang tujuan,
   - nama penerima atau PIC jika ada,
   - jumlah kartu,
   - daftar ID pengajuan atau batch ID,
   - tanggal cetak,
   - kurir/service jika sudah diketahui.
5. Sistem menyimpan log label pengiriman.

Catatan desain:
- Kartu garansi bersifat item-level.
- Label pengiriman bersifat batch/package-level.
- Keduanya sebaiknya punya tracking terpisah.

## Fitur Tambahan yang Layak Dipertimbangkan

1. Audit cetak dan reprint
   - Siapa yang mencetak, kapan, batch apa, dan berapa kali reprint.

2. Dashboard antrian kerja controller
   - Antrian baru, disetujui, siap cetak, sudah cetak, siap kirim, selesai.

3. Validasi duplicate serial number
   - Mencegah nomor seri yang sama dicetak dua kali tanpa alasan jelas.

4. Import/update master data dari Excel/CSV
   - Memudahkan update master produk tanpa edit manual satu per satu.

5. Report bulanan
   - Jumlah pengajuan, kartu dicetak, cabang terbanyak, reprint, dan pengiriman.

6. QR/barcode di kartu atau label
   - Untuk lookup cepat ke detail pengajuan atau batch.

7. Role tambahan
   - Misalnya Admin, Controller, Viewer, Master Data Admin.

8. Keamanan login lebih baik
   - Password saat ini masih plain text sesuai catatan `README.md`; nanti bisa ditingkatkan.

## Klarifikasi yang Masih Perlu Sebelum Coding

Sebelum implementasi, perlu keputusan detail berikut:

1. Hosting/distribusi frontend mana yang diizinkan: Apps Script HTMLService, static hosting eksternal, atau tetap file lokal.
2. Format fisik kartu garansi:
   - ukuran,
   - posisi field,
   - jumlah kartu per halaman,
   - perbedaan layout local/import.
3. Format label pengiriman:
   - A4 biasa, stiker label, A6, atau format kurir tertentu.
4. Aturan eligibility:
   - apakah cukup status `Disetujui`, atau harus cek master data/serial/duplikasi juga.
5. Aturan reprint:
   - siapa boleh reprint,
   - apakah wajib alasan,
   - apakah reprint terlihat di laporan.

## Verifikasi End-to-End Saat Nanti Diimplementasikan

Untuk setiap phase, verifikasi harus dilakukan dengan menjalankan aplikasi asli, bukan hanya membaca kode.

Minimal verifikasi:
1. Jalankan setup Apps Script dan pastikan sheet baru terbentuk.
2. Submit pengajuan dari form cabang.
3. Pastikan model dari master data otomatis mengisi produk/kategori.
4. Login dashboard controller.
5. Approve pengajuan.
6. Pilih beberapa item approved dan cetak kartu garansi bulk.
7. Pastikan print batch dan item printed tercatat di sheet.
8. Buat shipment batch dan cetak label.
9. Pastikan label berisi cabang, nama, qty kartu, dan batch/request reference yang benar.
10. Uji reprint dan pastikan audit/reprint count tercatat.

## Kesimpulan Rekomendasi

Semua fitur penting, tetapi urutan terbaik adalah: distribusi/update dulu, master data dan tracking backend, baru migrasi Vue, lalu bulk print dan label pengiriman. Dengan urutan ini, risiko salah data dan salah cetak lebih kecil, cabang lebih mudah menerima update, dan Vue dibangun di atas struktur workflow yang sudah benar.