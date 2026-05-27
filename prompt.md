# Rencana: Validasi Model - Nama Produk Minimal

## Koreksi Penting

Ternyata istilah “kategori” pada rencana sebelumnya sebenarnya merujuk ke field yang sudah ada saat ini, yaitu `Produk` / `Nama Produk`.

Jadi implementasi tidak boleh menambahkan field kategori baru di sisi cabang. Validasi yang benar adalah validasi pasangan:

```text
model -> nama_produk
```

Dalam konteks flow ini:

- `Produk` / `Nama Produk` adalah nilai kategori produk yang akan dicetak/dipakai di kartu.
- Cabang tetap mengisi `Model` dan `Nama Produk` seperti flow yang sudah ada.
- Jika model sudah dikenal di master, `Nama Produk` otomatis terisi dan terkunci.
- Jika model belum dikenal di master, cabang tetap boleh mengisi `Nama Produk` manual.
- Review admin adalah review kebenaran `Nama Produk` untuk model tersebut.
- Jangan membuat input/kolom UI baru bernama kategori di form cabang.

## Context

Masalah utama yang ingin diminimalkan adalah salah cetak karena data model dan nama produk tidak konsisten, misalnya model LCD tetapi Nama Produk terisi penanak nasi. Mengisi master produk lengkap akan makan waktu dan membuat Google Sheet membesar, jadi pendekatan yang dipilih adalah master ringan: hanya menyimpan pasangan `model -> nama_produk` yang sudah diverifikasi.

Tujuan akhirnya: cabang tetap bisa input cepat dan tetap bisa mengajukan permohonan sampai final, Nama Produk otomatis terkunci jika model sudah dikenal, dan model baru yang Nama Produknya masih diisi manual oleh cabang harus direview admin sebelum boleh masuk proses cetak.

## Prinsip flow yang disepakati

1. Cabang tetap bisa submit pengajuan sampai final.
   - Jika model belum ada di master, cabang tetap boleh mengisi Nama Produk manual.
   - Pengajuan tidak ditahan di sisi cabang hanya karena model belum ada di master.
   - Yang ditahan adalah proses cetaknya, bukan proses submit final pengajuan.

2. Cabang tidak perlu melihat status teknis verifikasi Nama Produk.
   - Status seperti `needs_review`, `verified`, `produk_sumber`, atau “belum ada di master” hanya untuk admin.
   - Di sisi cabang, pesan cukup netral seperti: “Pengajuan berhasil dikirim dan akan diverifikasi oleh admin.”
   - Cabang tetap memakai status pengajuan umum yang sudah ada, seperti Baru, Diproses, Disetujui, atau Ditolak.

3. Admin bertanggung jawab memastikan Nama Produk benar.
   - Data dengan model yang belum ada di master muncul di dashboard admin sebagai item yang perlu review Nama Produk.
   - Admin bisa memperbaiki atau menyetujui Nama Produk.
   - Setelah admin approve, data boleh masuk ke proses cetak.

4. Approval admin berlaku untuk semua data pending dengan model yang sama.
   - Saat admin menyetujui Nama Produk untuk satu model, semua item pending dengan `model_normalized` yang sama ikut menjadi terverifikasi.
   - Pasangan model-nama_produk juga disimpan ke master ringan agar input berikutnya otomatis.

## Pendekatan yang direkomendasikan

1. Tambahkan sheet master ringan `ModelProduk` atau tetap gunakan `ModelKategori` hanya jika sudah terlanjur dibuat.
   - Jika belum implementasi final, nama sheet yang lebih tepat adalah `ModelProduk`.
   - Jika sheet `ModelKategori` sudah terlanjur ada dari percobaan sebelumnya, boleh dipertahankan agar tidak perlu migrasi besar, tetapi maknanya harus dianggap sebagai master `model -> nama_produk`.
   - Kolom minimal yang disarankan:
     - `model_normalized`
     - `model_display`
     - `produk`
     - `status`
     - `updated_at`
     - `updated_by`
   - Data hanya satu baris per model, bukan per nomor seri.
   - `model_normalized` dibuat dari model yang di-trim, uppercase, dan dinormalisasi agar pencocokan stabil.

2. Ubah flow input cabang di `index.html` tanpa menambah field baru.
   - Field `Produk` / `Nama Produk` tetap field yang sudah ada.
   - Cabang tetap mengisi model.
   - Saat model cocok dengan master, field `Produk` otomatis terisi dan dikunci.
   - Saat model belum ada, cabang boleh mengisi `Produk` manual.
   - Item dari model yang belum ada di master disimpan dengan status internal `needs_review`.
   - Status internal ini tidak perlu ditampilkan ke cabang.

3. Tambahkan status verifikasi Nama Produk di backend `Code.gs`.
   - Simpan metadata per item di `PengajuanItems`, tetapi jangan menambah konsep input kategori baru.
   - Kolom metadata yang disarankan:
     - `model_normalized`
     - `produk_status`: `verified` atau `needs_review`
     - `produk_sumber`: `auto`, `manual`, atau `admin`
   - Field `Produk` yang sudah ada tetap menjadi sumber Nama Produk.
   - Pengajuan final tetap boleh dibuat walaupun ada item `needs_review`.
   - Tombol/aksi cetak hanya boleh memproses item dengan `produk_status = verified`.

4. Tambahkan review admin di `dashboard.html`.
   - Tampilkan badge/filter “Nama Produk belum terverifikasi” hanya di dashboard admin.
   - Admin bisa memperbaiki atau menyetujui Nama Produk untuk model baru.
   - Saat admin approve satu model, terapkan Nama Produk yang disetujui ke semua data pending dengan `model_normalized` yang sama.
   - Setelah approve, backend menyimpan pasangan model-nama_produk ke master ringan, lalu semua item terkait menjadi `verified`.

5. Gunakan pola yang sudah ada.
   - Reuse pola schema sheet di `Code.gs`: `setupApp()`, `ensureSheet_()`, `readObjects_()`.
   - Reuse pola draft/status gating yang sudah ada: `DRAFT_STATUS`, `handleSaveDraftPengajuan()`, `handleSubmitDraftPengajuan()`.
   - Reuse badge/status UI yang sudah ada di `dashboard.html`: `statusBadge()` / pola badge lain.

## Flow ringkas

```text
Cabang input model
        ↓
Sistem cek master model -> nama_produk
        ↓
Jika model ditemukan:
  Nama Produk auto terisi
  Field Produk dikunci
  produk_status = verified
  produk_sumber = auto
  cabang bisa submit final
  item boleh dicetak saat status pengajuan sudah memenuhi syarat cetak

Jika model tidak ditemukan:
  cabang isi Nama Produk manual di field Produk yang sudah ada
  produk_status = needs_review
  produk_sumber = manual
  cabang tetap bisa submit final
  cabang tidak melihat status teknis needs_review
        ↓
Admin melihat item perlu review Nama Produk di dashboard
        ↓
Admin koreksi / approve Nama Produk
        ↓
Sistem menyimpan model -> nama_produk ke master
        ↓
Semua pending dengan model yang sama menjadi verified
        ↓
Item boleh masuk proses cetak
```

## Task plan perbaikan dari implementasi sebelumnya

1. Backend `Code.gs`
   - Hapus atau abaikan field/kolom baru yang memperlakukan kategori sebagai input terpisah.
   - Pastikan `Produk` tetap menjadi nilai Nama Produk utama.
   - Jika sudah ada helper seperti `getModelKategoriMap_()`, ubah maknanya menjadi lookup `model -> produk`.
   - Jika sudah ada kolom `Kategori` di `PengajuanItems`, jangan gunakan untuk flow baru; lebih baik gunakan kolom metadata `produk_status` dan `produk_sumber`.
   - Jika perubahan schema belum terlanjur dipakai production, ganti header metadata menjadi:
     - `model_normalized`
     - `produk_status`
     - `produk_sumber`
   - Update normalisasi submit agar:
     - model dikenal: overwrite `item.produk` dari master, set `produk_status = verified`, `produk_sumber = auto`.
     - model baru: pakai `item.produk` dari cabang, set `produk_status = needs_review`, `produk_sumber = manual`.
   - Update approval admin agar menyimpan approved Nama Produk ke master dan meng-update kolom `Produk` semua item pending dengan model sama.
   - Update print queue agar hanya mengambil item dengan `produk_status = verified`.

2. Form cabang `index.html`
   - Hapus input kategori tambahan jika sudah sempat dibuat.
   - Kembalikan layout item ke field utama:
     - Produk / Nama Produk
     - Model
     - Nomor Seri
   - Tambahkan behavior pada field Model:
     - jika model ada di master, isi field Produk otomatis dan lock field Produk.
     - jika model tidak ada di master, unlock field Produk agar cabang bisa isi manual.
   - `collectPayload()` tidak perlu mengirim `kategori`; cukup kirim `produk`, `model`, dan `nomorSeri`.
   - `fillFormFromDraft()`, `resetForm()`, dan print draft tetap memakai `produk`, bukan `kategori`.

3. Dashboard admin `dashboard.html`
   - Ubah istilah UI dari “kategori” menjadi “Nama Produk”.
   - Panel review harus menampilkan model, Nama Produk usulan/manual, jumlah item pending, dan tombol approve.
   - Approval admin harus mengirim `model_normalized/modelDisplay` dan `produk` yang disetujui.
   - Detail item admin menampilkan status verifikasi Nama Produk, bukan status kategori.
   - Antrean cetak tidak perlu UI khusus; backend cukup memastikan hanya item verified yang masuk.

## File utama yang akan disentuh

- `Code.gs`
  - Tambah/rapikan sheet master `ModelProduk` atau master existing yang bermakna `model -> produk`.
  - Tambah lookup model-produk.
  - Simpan status verifikasi Nama Produk per item.
  - Izinkan submit final walaupun Nama Produk masih `needs_review`.
  - Tambah action admin untuk approve Nama Produk per model.
  - Saat approve, apply ke semua pending dengan model yang sama.
  - Pastikan print queue hanya mengambil item dengan Nama Produk terverifikasi.

- `index.html`
  - Jangan tambah field kategori baru.
  - Reuse field `Produk` sebagai Nama Produk yang diverifikasi.
  - Auto-fill dan lock field `Produk` jika model sudah ada di master ringan.
  - Jika model belum dikenal, izinkan input manual di field `Produk`.
  - Jangan tampilkan status teknis `needs_review` ke cabang.
  - Setelah submit, tampilkan pesan umum bahwa pengajuan berhasil dikirim dan akan diverifikasi admin.

- `dashboard.html`
  - Tambah tampilan/filter item yang perlu review Nama Produk.
  - Tambah badge admin “Nama Produk belum terverifikasi”.
  - Tambah aksi admin approve/koreksi Nama Produk.
  - Saat approve, apply ke semua pending dengan model yang sama.

## Verifikasi end-to-end

1. Jalankan aplikasi lokal atau buka HTML sesuai flow project saat ini.
2. Buat pengajuan dengan model yang sudah ada di master.
   - Pastikan field Produk / Nama Produk auto terisi.
   - Pastikan field Produk terkunci.
   - Pastikan cabang bisa submit final.
   - Pastikan item bisa lanjut ke cetak setelah status pengajuan sesuai.
3. Buat pengajuan dengan model yang belum ada di master.
   - Pastikan cabang bisa isi Produk / Nama Produk manual.
   - Pastikan cabang tetap bisa submit final.
   - Pastikan cabang tidak melihat status teknis `needs_review`.
   - Pastikan item belum bisa dicetak sebelum admin approve Nama Produk.
4. Buka dashboard admin.
   - Pastikan item/model baru muncul dalam filter review Nama Produk.
   - Approve atau koreksi Nama Produk untuk satu model.
   - Pastikan semua pending dengan model yang sama ikut menjadi `verified`.
   - Pastikan pasangan model-nama_produk tersimpan ke master.
5. Ulangi input model yang sama dari cabang.
   - Pastikan field Produk sekarang auto terisi dan terkunci.
   - Pastikan item langsung berstatus internal `verified`.
6. Jalankan pengecekan regresi manual pada flow yang sudah ada:
   - save draft
   - load draft
   - submit final
   - dashboard status
   - queue cetak warranty/shipping label
