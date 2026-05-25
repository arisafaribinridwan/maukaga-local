saya baru melakukan pengecekan proses atau flow di cabang, secara garis besar : 
1. kondisi saat ini yang mengisi dan mencetak form permintaan adalah sales.
2. tanda tangan, dan minta tanda tangan atasannya.
3. serahkan ke CS admin untuk minta tanda tangan CS head.
4. admin CS Cabang akan email ke controller untuk permintaan ini.

nah, saya menemukan berarti orang yang membuat form dan yang menginput file scan hard copy formulir itu berbeda orang atau pc.

jadi sepertinya sistem sekarang belum bisa mengakomodir kondisi tersebut ya? 
karena kondisi sekarang adalah yang mengisi formulir, mencetak dan mensubmit file scan itu asumsinya dari pc satu orang, betul kah analisa saya?

---

## Konsep Final: Setting Layout Cetak Kartu Garansi

Tujuan fitur:
- Offset layout cetak kartu garansi tidak lagi diatur manual dari halaman antrian cetak.
- Admin dapat mengelola konfigurasi layout dari menu **Setting**.
- Konfigurasi tersimpan di Google Sheet / Apps Script, bukan localStorage, supaya tetap tersedia saat admin berpindah orang atau memakai PC lain.
- Layout aktif harus berbeda per jenis kartu:
  - Cetak kartu **Local** memakai layout aktif khusus `local`.
  - Cetak kartu **Import** memakai layout aktif khusus `import`.

UI yang diinginkan:
- Tambahkan menu/tombol **Setting** di dashboard admin.
- Di menu Setting, tambahkan section **Layout Cetak Garansi**.
- Section ini memiliki pilihan jenis layout:
  - `Local`
  - `Import`
- Setiap jenis memiliki:
  - Dropdown **Layout aktif**.
  - Tombol **Tambah Layout**.
  - Tombol **Duplikasi Layout Aktif**.
  - Form konfigurasi:
    - Nama layout
    - Offset X
    - Offset Y
    - Gap Produk ke Model
    - Gap Model ke Nomor Seri
  - Tombol **Simpan**.
  - Tombol **Jadikan Aktif**.
  - Tombol **Hapus** khusus layout custom.

Aturan konfigurasi:
- Satuan semua nilai posisi/gap adalah **mm**.
- `Offset X` dan `Offset Y` boleh bernilai negatif.
- Nilai gap minimal `0`.
- Nilai desimal diperbolehkan, contoh `2.5`.
- Layout bawaan tidak boleh dihapus.
- Layout custom boleh dihapus, tetapi jika layout tersebut sedang aktif, admin harus memilih layout lain terlebih dahulu.

Data yang disimpan di Google Sheet:
- Buat sheet baru, contoh nama: `PrintLayouts`.
- Header yang disarankan:
  - `ID`
  - `Type`
  - `Name`
  - `Offset X`
  - `Offset Y`
  - `Gap Product Model`
  - `Gap Model Serial`
  - `Is Builtin`
  - `Created At`
  - `Updated At`
  - `Updated By`

Preset default:
- `local-default`
  - Type: `local`
  - Name: `Local Default`
  - Builtin: `TRUE`
- `import-default`
  - Type: `import`
  - Name: `Import Default`
  - Builtin: `TRUE`

Layout aktif per jenis disimpan di sheet `Config`:
- `ACTIVE_PRINT_LAYOUT_LOCAL`
- `ACTIVE_PRINT_LAYOUT_IMPORT`

Behavior cetak:
- Saat dashboard/admin dibuka, frontend mengambil daftar layout dari server.
- Saat mencetak kartu, setiap item memakai `jenisKartuKey`:
  - `local` mengambil konfigurasi dari layout aktif Local.
  - `import` mengambil konfigurasi dari layout aktif Import.
- CSS print tetap memakai ukuran dan posisi dasar kartu yang sudah ada.
- Konfigurasi layout hanya menambah penyesuaian:
  - offset horizontal
  - offset vertical
  - gap tambahan antara baris produk dan model
  - gap tambahan antara model dan nomor seri

Catatan implementasi:
- Jaga agar perubahan tidak merusak UI dashboard, detail pengajuan, flow cetak, dan logic status yang sudah ada.
- Hindari refactor besar. Tambahkan fitur dengan scope kecil:
  - `Code.gs`: tambah sheet/header, default layout, API get/save/delete/set-active layout.
  - `dashboard.html`: tambah section Setting, state layout, render form layout, dan ubah render print agar memakai layout aktif.
  - `config.js` tidak perlu diubah kecuali ada kebutuhan endpoint baru.
- Halaman antrian cetak sebaiknya tidak lagi menampilkan input offset manual. Sebagai gantinya bisa menampilkan ringkasan layout aktif Local/Import atau tombol menuju Setting.
