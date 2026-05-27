const APP = {
  SPREADSHEET_ID: '', // diisi manual oleh user setelah setup jika ingin memakai spreadsheet yang sudah ada
  DRIVE_FOLDER_ID: '', // diisi/di-update dari sheet Config
  MAX_UPLOAD_MB: 10,
  MAX_ITEMS: 10,
  APP_NAME: 'Pengajuan Kartu Garansi',
  SESSION_DURATION_HOURS: 6,
};

const SHEETS = {
  PENGAJUAN: 'Pengajuan',
  ITEMS: 'PengajuanItems',
  USERS: 'Users',
  RECIPIENTS: 'EmailRecipients',
  CONFIG: 'Config',
  STATUS_LOG: 'StatusLog',
  EMAIL_LOG: 'EmailLog',
  WARRANTY_CARDS: 'WarrantyCards',
  PRINT_BATCH: 'PrintBatch',
  PRINT_LAYOUTS: 'PrintLayouts',
  MODEL_PRODUK: 'ModelProduk',
};

const HEADERS = {
  [SHEETS.PENGAJUAN]: ['ID Pengajuan', 'Timestamp Submit', 'Nama', 'Bagian/Cabang', 'Pemilik', 'Alasan Pengajuan', 'Tanggal Form', 'File Hard Copy URL', 'File Hard Copy ID', 'Catatan Tambahan', 'Jumlah Item', 'Status', 'Catatan Admin', 'Tanggal Update Status Terakhir', 'User Update Status', 'Riwayat Singkat', 'Resume Token', 'Draft Created At', 'Draft Updated At', 'Submitted At'],
  [SHEETS.ITEMS]: ['ID Pengajuan', 'No Item', 'Produk', 'Model', 'Nomor Seri', 'model_normalized', 'produk_status', 'produk_sumber'],
  [SHEETS.USERS]: ['Username', 'Password/PIN', 'Nama', 'Role', 'Aktif', 'Last Login'],
  [SHEETS.RECIPIENTS]: ['Nama', 'Email', 'Aktif', 'Keterangan'],
  [SHEETS.CONFIG]: ['Key', 'Value'],
  [SHEETS.STATUS_LOG]: ['Timestamp', 'ID Pengajuan', 'Status Lama', 'Status Baru', 'Catatan Admin', 'User'],
  [SHEETS.EMAIL_LOG]: ['Timestamp', 'Subject', 'Recipients', 'Jumlah Pengajuan', 'Status'],
  [SHEETS.WARRANTY_CARDS]: ['ID Pengajuan', 'No Item', 'Produk', 'Model', 'Nomor Seri', 'Jenis Kartu', 'Status Cetak', 'Print Batch ID', 'Printed At', 'Printed By', 'Reprint Count', 'Last Reprint At', 'Last Reprint By', 'Catatan'],
  [SHEETS.PRINT_BATCH]: ['Batch ID', 'Tipe Batch', 'Created At', 'Created By', 'Jumlah Item', 'Catatan'],
  [SHEETS.PRINT_LAYOUTS]: ['ID', 'Type', 'Name', 'Offset X', 'Offset Y', 'Gap Product Model', 'Gap Model Serial', 'Is Builtin', 'Created At', 'Updated At', 'Updated By'],
  [SHEETS.MODEL_PRODUK]: ['model_normalized', 'model_display', 'produk', 'status', 'updated_at', 'updated_by'],
};

const DEFAULT_PRINT_LAYOUTS = [
  { id: 'local-default', type: 'local', name: 'Local Default', offsetX: 0, offsetY: 0, gapProductModel: 0, gapModelSerial: 0, isBuiltin: true },
  { id: 'import-default', type: 'import', name: 'Import Default', offsetX: 0, offsetY: 0, gapProductModel: 0, gapModelSerial: 0, isBuiltin: true },
];
const ACTIVE_PRINT_LAYOUT_KEYS = {
  local: 'ACTIVE_PRINT_LAYOUT_LOCAL',
  import: 'ACTIVE_PRINT_LAYOUT_IMPORT',
};
const DRAFT_STATUS = 'Menunggu Upload';
const VALID_STATUSES = ['Baru', 'Disetujui', 'Ditolak', 'Selesai'];
const VALID_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];
const VALID_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

function setupApp() {
  const ss = getSpreadsheet_();
  Object.keys(HEADERS).forEach(function (name) {
    ensureSheet_(ss, name, HEADERS[name]);
  });

  const usersSheet = ss.getSheetByName(SHEETS.USERS);
  if (usersSheet.getLastRow() < 2) {
    usersSheet.appendRow(['admin', 'admin123', 'Administrator', 'Admin', 'yes', '']);
  }

  const configSheet = ss.getSheetByName(SHEETS.CONFIG);
  const defaults = {
    APP_NAME: APP.APP_NAME,
    DRIVE_FOLDER_ID: '',
    MAX_UPLOAD_MB: APP.MAX_UPLOAD_MB,
    MAX_ITEMS: APP.MAX_ITEMS,
    LAST_EMAIL_SENT_AT: '',
    ACTIVE_PRINT_LAYOUT_LOCAL: 'local-default',
    ACTIVE_PRINT_LAYOUT_IMPORT: 'import-default',
  };
  Object.keys(defaults).forEach(function (key) {
    upsertConfig_(configSheet, key, defaults[key], false);
  });
  ensurePrintLayoutDefaults_(configSheet);

  const config = getConfig();
  let folderId = String(config.DRIVE_FOLDER_ID || APP.DRIVE_FOLDER_ID || '').trim();
  if (!folderId) {
    const folder = DriveApp.createFolder(APP.APP_NAME + ' Uploads');
    folderId = folder.getId();
    upsertConfig_(configSheet, 'DRIVE_FOLDER_ID', folderId, true);
  } else {
    DriveApp.getFolderById(folderId);
  }

  ensureEmailDigestTrigger_();
  console.log('Setup selesai. Spreadsheet ID: ' + ss.getId() + ', Drive folder ID: ' + folderId);
}

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action === 'ping') return jsonResponse_({ success: true, data: { app: APP.APP_NAME, time: new Date().toISOString() } });
  return jsonResponse_({ success: true, data: { message: 'API Pengajuan Kartu Garansi aktif. Gunakan POST untuk action API.' } });
}

function doPost(e) {
  try {
    const data = parseRequest_(e);
    const action = data.action || (e && e.parameter && e.parameter.action);
    if (!action) throw new Error('Action wajib diisi');
    ensureRuntimeHeaders_();

    switch (action) {
      case 'submitPengajuan':
        return jsonResponse_(handleSubmitPengajuan(data));
      case 'saveDraftPengajuan':
        return jsonResponse_(handleSaveDraftPengajuan(data));
      case 'getDraftPengajuan':
        return jsonResponse_(handleGetDraftPengajuan(data));
      case 'checkDraftPengajuanStatus':
        return jsonResponse_(handleCheckDraftPengajuanStatus(data));
      case 'checkPengajuanStatus':
        return jsonResponse_(handleCheckPengajuanStatus(data));
      case 'getModelProduk':
      case 'getModelKategori':
        return jsonResponse_(handleGetModelProduk(data));
      case 'submitDraftPengajuan':
        return jsonResponse_(handleSubmitDraftPengajuan(data));
      case 'adminLogin':
        return jsonResponse_(handleAdminLogin(data));
      case 'getDashboard':
        return jsonResponse_(handleGetDashboard(data));
      case 'getDetail':
        return jsonResponse_(handleGetDetail(data));
      case 'updateStatus':
        return jsonResponse_(handleUpdateStatus(data));
      case 'getProductReviewQueue':
      case 'getCategoryReviewQueue':
        return jsonResponse_(handleGetProductReviewQueue(data));
      case 'approveModelProduk':
      case 'approveModelKategori':
        return jsonResponse_(handleApproveModelProduk(data));
      case 'getWarrantyPrintQueue':
        return jsonResponse_(handleGetWarrantyPrintQueue(data));
      case 'getPrintLayouts':
        return jsonResponse_(handleGetPrintLayouts(data));
      case 'savePrintLayout':
        return jsonResponse_(handleSavePrintLayout(data));
      case 'deletePrintLayout':
        return jsonResponse_(handleDeletePrintLayout(data));
      case 'setActivePrintLayout':
        return jsonResponse_(handleSetActivePrintLayout(data));
      case 'saveWarrantyCardTypes':
        return jsonResponse_(handleSaveWarrantyCardTypes(data));
      case 'markWarrantyCardsPrinted':
        return jsonResponse_(handleMarkWarrantyCardsPrinted(data));
      case 'adminLogout':
        return jsonResponse_(handleAdminLogout(data));
      default:
        throw new Error('Action tidak dikenal: ' + action);
    }
  } catch (err) {
    return jsonResponse_({ success: false, error: err.message || String(err) });
  }
}

function generateId() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return generateIdUnlocked_();
  } finally {
    lock.releaseLock();
  }
}

function getConfig() {
  const sheet = getSheet_(SHEETS.CONFIG);
  const values = sheet.getDataRange().getValues();
  const config = {};
  for (let i = 1; i < values.length; i++) {
    const key = String(values[i][0] || '').trim();
    if (key) config[key] = values[i][1];
  }
  return Object.assign({}, APP, config);
}

function validateSession(token) {
  token = String(token || '').trim();
  if (!token) return null;
  const raw = CacheService.getScriptCache().get(token);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function handleSubmitPengajuan(data) {
  const config = getConfig();
  const cleaned = normalizeSubmission_(data, config, true);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const id = generateIdUnlocked_();
    const folderId = String(config.DRIVE_FOLDER_ID || APP.DRIVE_FOLDER_ID || '').trim();
    if (!folderId) throw new Error('DRIVE_FOLDER_ID belum dikonfigurasi. Jalankan setupApp() terlebih dahulu.');

    const bytes = Utilities.base64Decode(cleaned.fileBase64);
    const blob = Utilities.newBlob(bytes, cleaned.fileMimeType, id + '_hardcopy.' + cleaned.fileExtension);
    const file = DriveApp.getFolderById(folderId).createFile(blob);
    file.setName(id + '_hardcopy.' + cleaned.fileExtension);

    const now = new Date();
    appendPengajuanRow_(id, cleaned, 'Baru', '', now, file.getUrl(), file.getId(), '', '', '', now, '[' + formatDateTime_(now) + '] Pengajuan dibuat');
    replaceItemRows_(id, cleaned.items);
    return { success: true, data: { idPengajuan: id } };
  } finally {
    lock.releaseLock();
  }
}

function handleSaveDraftPengajuan(data) {
  const config = getConfig();
  const cleaned = normalizeSubmission_(data, config, false);
  const requestedId = clean_(data.idPengajuan);
  const requestedToken = clean_(data.resumeToken);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const now = new Date();
    const sheet = getSheet_(SHEETS.PENGAJUAN);
    const record = requestedId ? findPengajuanRecord_(requestedId) : null;
    let id = requestedId;
    let token = requestedToken;
    let history = '[' + formatDateTime_(now) + '] Draft dibuat';
    let draftCreatedAt = now;

    if (record) {
      if (!requestedToken || clean_(record.row[record.col['Resume Token']]) !== requestedToken) throw new Error('Link lanjutkan tidak valid atau draft tidak ditemukan');
      if (record.row[record.col['Status']] !== DRAFT_STATUS) throw new Error('Draft sudah tidak dapat diubah');
      const oldHistory = record.row[record.col['Riwayat Singkat']] || '';
      history = oldHistory ? oldHistory + '\n[' + formatDateTime_(now) + '] Draft diperbarui' : '[' + formatDateTime_(now) + '] Draft diperbarui';
      draftCreatedAt = record.row[record.col['Draft Created At']] || now;
      updatePengajuanRow_(sheet, record.rowNumber, record.col, id, cleaned, DRAFT_STATUS, token, '', '', '', draftCreatedAt, now, '', history);
    } else {
      if (requestedId || requestedToken) throw new Error('Draft tidak ditemukan atau link lanjutkan tidak valid');
      id = generateIdUnlocked_();
      token = generateResumeToken_();
      appendPengajuanRow_(id, cleaned, DRAFT_STATUS, token, '', '', '', '', now, now, '', history);
    }

    replaceItemRows_(id, cleaned.items);
    return { success: true, data: { idPengajuan: id, resumeToken: token, status: DRAFT_STATUS } };
  } finally {
    lock.releaseLock();
  }
}

function handleGetDraftPengajuan(data) {
  const id = clean_(data.idPengajuan);
  const token = clean_(data.resumeToken);
  if (!id || !token) throw new Error('Buka draft dari Draft Terakhir atau Link Lanjutkan Draft');

  const record = findPengajuanRecord_(id);
  if (!record) throw new Error('Draft tidak ditemukan');
  if (clean_(record.row[record.col['Resume Token']]) !== token) throw new Error('Link lanjutkan tidak valid atau draft tidak ditemukan');
  if (record.row[record.col['Status']] !== DRAFT_STATUS) throw new Error('Draft sudah tidak dapat dilanjutkan');

  const row = record.row;
  const col = record.col;
  return {
    success: true,
    data: {
      idPengajuan: id,
      status: row[col['Status']],
      nama: row[col['Nama']],
      bagianCabang: row[col['Bagian/Cabang']],
      pemilik: row[col['Pemilik']],
      alasanPengajuan: row[col['Alasan Pengajuan']],
      tanggalForm: formatDateOnly_(row[col['Tanggal Form']]),
      catatanTambahan: row[col['Catatan Tambahan']],
      items: getItemsForPengajuan_(id),
    },
  };
}

function handleCheckDraftPengajuanStatus(data) {
  const id = clean_(data.idPengajuan);
  if (!id) throw new Error('Masukkan ID Pengajuan terlebih dahulu.');

  const record = findPengajuanRecord_(id);
  if (!record) throw new Error('ID Pengajuan tidak ditemukan. Periksa kembali ID pada printout draft.');

  const status = record.row[record.col['Status']];
  if (status !== DRAFT_STATUS) {
    throw new Error('ID Pengajuan ini sudah dikirim final dan tidak bisa dibuka sebagai draft.');
  }

  const resumeToken = clean_(record.row[record.col['Resume Token']]);
  if (!resumeToken) {
    throw new Error('Draft ditemukan, tetapi Resume Token tidak tersedia. Draft ini tidak bisa dilanjutkan. Silakan buat draft baru atau hubungi admin.');
  }

  return { success: true, data: { idPengajuan: id, status: status, resumeToken: resumeToken } };
}

function handleCheckPengajuanStatus(data) {
  const id = clean_(data.idPengajuan);
  if (!id) throw new Error('Masukkan ID Pengajuan terlebih dahulu.');

  const record = findPengajuanRecord_(id);
  if (!record) throw new Error('ID Pengajuan tidak ditemukan. Periksa kembali ID yang dimasukkan.');

  const row = record.row;
  const col = record.col;
  const status = clean_(row[col['Status']]);
  if (VALID_STATUSES.concat([DRAFT_STATUS]).indexOf(status) === -1) {
    throw new Error('Status pengajuan tidak bisa ditampilkan.');
  }

  return {
    success: true,
    data: {
      idPengajuan: id,
      status: status,
      timestampSubmit: toIso_(row[col['Timestamp Submit']]),
      jumlahItem: row[col['Jumlah Item']],
      catatanAdmin: row[col['Catatan Admin']],
      tanggalUpdateStatusTerakhir: toIso_(row[col['Tanggal Update Status Terakhir']]),
      draftUpdatedAt: toIso_(row[col['Draft Updated At']]),
    },
  };
}

function handleGetModelProduk() {
  const rows = getModelProdukRows_().map(function (row) {
    return {
      modelNormalized: row.modelNormalized,
      modelDisplay: row.modelDisplay,
      produk: row.produk,
      status: row.status,
      updatedAt: toIso_(row.updatedAt),
    };
  });
  return { success: true, data: { rows: rows } };
}

function handleSubmitDraftPengajuan(data) {
  const config = getConfig();
  const cleaned = normalizeSubmission_(data, config, true);
  const id = clean_(data.idPengajuan);
  const token = clean_(data.resumeToken);
  if (!id || !token) throw new Error('Buka draft dari Draft Terakhir atau Link Lanjutkan Draft');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const record = findPengajuanRecord_(id);
    if (!record) throw new Error('Draft tidak ditemukan');
    if (clean_(record.row[record.col['Resume Token']]) !== token) throw new Error('Link lanjutkan tidak valid atau draft tidak ditemukan');
    if (record.row[record.col['Status']] !== DRAFT_STATUS) throw new Error('Draft sudah tidak dapat dilanjutkan');

    const folderId = String(config.DRIVE_FOLDER_ID || APP.DRIVE_FOLDER_ID || '').trim();
    if (!folderId) throw new Error('DRIVE_FOLDER_ID belum dikonfigurasi. Jalankan setupApp() terlebih dahulu.');

    const bytes = Utilities.base64Decode(cleaned.fileBase64);
    const blob = Utilities.newBlob(bytes, cleaned.fileMimeType, id + '_hardcopy.' + cleaned.fileExtension);
    const file = DriveApp.getFolderById(folderId).createFile(blob);
    file.setName(id + '_hardcopy.' + cleaned.fileExtension);

    const now = new Date();
    const oldHistory = record.row[record.col['Riwayat Singkat']] || '';
    const history = oldHistory ? oldHistory + '\n[' + formatDateTime_(now) + '] Pengajuan final dikirim' : '[' + formatDateTime_(now) + '] Pengajuan final dikirim';
    updatePengajuanRow_(record.sheet, record.rowNumber, record.col, id, cleaned, 'Baru', '', now, file.getUrl(), file.getId(), record.row[record.col['Draft Created At']] || '', record.row[record.col['Draft Updated At']] || '', now, history);
    replaceItemRows_(id, cleaned.items);
    getSheet_(SHEETS.STATUS_LOG).appendRow([now, id, DRAFT_STATUS, 'Baru', 'Final submit hard copy signed', 'system']);

    return { success: true, data: { idPengajuan: id } };
  } finally {
    lock.releaseLock();
  }
}

function handleAdminLogin(data) {
  const username = clean_(data.username).toLowerCase();
  const password = clean_(data.password);
  if (!username || !password) throw new Error('Username dan password wajib diisi');

  const sheet = getSheet_(SHEETS.USERS);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    const rowUsername = clean_(values[i][0]).toLowerCase();
    const rowPassword = clean_(values[i][1]);
    const nama = clean_(values[i][2]);
    const role = clean_(values[i][3]);
    const aktif = clean_(values[i][4]).toLowerCase();
    if (rowUsername === username && aktif === 'yes' && role.toLowerCase() === 'admin') {
      if (rowPassword !== password) break;
      const token = Utilities.getUuid();
      const session = { username: rowUsername, nama: nama || rowUsername, role: role };
      CacheService.getScriptCache().put(token, JSON.stringify(session), APP.SESSION_DURATION_HOURS * 60 * 60);
      sheet.getRange(i + 1, 6).setValue(new Date());
      return { success: true, data: { token: token, nama: session.nama, username: rowUsername } };
    }
  }
  throw new Error('Username atau password salah');
}

function handleAdminLogout(data) {
  const token = clean_(data.token);
  if (token) CacheService.getScriptCache().remove(token);
  return { success: true, data: {} };
}

function handleGetDashboard(data) {
  const session = requireSession_(data.token);
  const page = Math.max(parseInt(data.page || 1, 10), 1);
  const pageSize = Math.min(Math.max(parseInt(data.pageSize || 20, 10), 1), 100);
  const search = clean_(data.search).toLowerCase();
  const status = clean_(data.status);
  const dateFrom = data.dateFrom ? startOfDay_(new Date(data.dateFrom)) : null;
  const dateTo = data.dateTo ? endOfDay_(new Date(data.dateTo)) : null;
  if (status && VALID_STATUSES.indexOf(status) === -1) throw new Error('Status filter tidak valid');

  let rows = readObjects_(SHEETS.PENGAJUAN).filter(function (row) {
    if (VALID_STATUSES.indexOf(row['Status']) === -1) return false;
    const ts = row['Timestamp Submit'] instanceof Date ? row['Timestamp Submit'] : new Date(row['Timestamp Submit']);
    const haystack = [row['ID Pengajuan'], row['Nama'], row['Bagian/Cabang']].join(' ').toLowerCase();
    if (search && haystack.indexOf(search) === -1) return false;
    if (status && row['Status'] !== status) return false;
    if (dateFrom && ts < dateFrom) return false;
    if (dateTo && ts > dateTo) return false;
    return true;
  });

  const summary = { total: rows.length, baru: 0, disetujui: 0, ditolak: 0, selesai: 0 };
  rows.forEach(function (row) {
    const key = String(row['Status'] || '').toLowerCase();
    if (summary.hasOwnProperty(key)) summary[key] += 1;
  });

  rows.sort(function (a, b) {
    return new Date(b['Timestamp Submit']).getTime() - new Date(a['Timestamp Submit']).getTime();
  });

  const totalRows = rows.length;
  const start = (page - 1) * pageSize;
  const paged = rows.slice(start, start + pageSize).map(function (row) {
    return {
      idPengajuan: row['ID Pengajuan'],
      timestampSubmit: toIso_(row['Timestamp Submit']),
      nama: row['Nama'],
      bagianCabang: row['Bagian/Cabang'],
      jumlahItem: row['Jumlah Item'],
      status: row['Status'],
    };
  });

  return { success: true, data: { summary: summary, rows: paged, totalRows: totalRows, page: page, pageSize: pageSize, admin: session.nama } };
}

function handleGetDetail(data) {
  requireSession_(data.token);
  const id = clean_(data.idPengajuan);
  if (!id) throw new Error('ID Pengajuan wajib diisi');

  const pengajuan = readObjects_(SHEETS.PENGAJUAN).find(function (row) { return row['ID Pengajuan'] === id && VALID_STATUSES.indexOf(row['Status']) !== -1; });
  if (!pengajuan) throw new Error('Pengajuan tidak ditemukan');

  const items = getItemsForPengajuan_(id);
  const riwayat = readObjects_(SHEETS.STATUS_LOG)
    .filter(function (row) { return row['ID Pengajuan'] === id; })
    .sort(function (a, b) { return new Date(b['Timestamp']).getTime() - new Date(a['Timestamp']).getTime(); })
    .map(function (row) {
      return {
        timestamp: toIso_(row['Timestamp']),
        statusLama: row['Status Lama'],
        statusBaru: row['Status Baru'],
        catatanAdmin: row['Catatan Admin'],
        user: row['User'],
      };
    });

  return {
    success: true,
    data: {
      idPengajuan: pengajuan['ID Pengajuan'],
      timestampSubmit: toIso_(pengajuan['Timestamp Submit']),
      nama: pengajuan['Nama'],
      bagianCabang: pengajuan['Bagian/Cabang'],
      pemilik: pengajuan['Pemilik'],
      alasanPengajuan: pengajuan['Alasan Pengajuan'],
      tanggalForm: formatDateOnly_(pengajuan['Tanggal Form']),
      fileHardCopyUrl: pengajuan['File Hard Copy URL'],
      fileHardCopyId: pengajuan['File Hard Copy ID'],
      catatanTambahan: pengajuan['Catatan Tambahan'],
      jumlahItem: pengajuan['Jumlah Item'],
      status: pengajuan['Status'],
      catatanAdmin: pengajuan['Catatan Admin'],
      tanggalUpdateStatusTerakhir: toIso_(pengajuan['Tanggal Update Status Terakhir']),
      userUpdateStatus: pengajuan['User Update Status'],
      riwayatSingkat: pengajuan['Riwayat Singkat'],
      items: items,
      riwayat: riwayat,
    },
  };
}

function handleUpdateStatus(data) {
  const session = requireSession_(data.token);
  const id = clean_(data.idPengajuan);
  const statusBaru = clean_(data.statusBaru);
  const catatanAdmin = clean_(data.catatanAdmin);
  if (!id) throw new Error('ID Pengajuan wajib diisi');
  if (VALID_STATUSES.indexOf(statusBaru) === -1) throw new Error('Status tidak valid');
  if (statusBaru === 'Ditolak' && !catatanAdmin) throw new Error('Catatan Admin wajib diisi jika status Ditolak');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getSheet_(SHEETS.PENGAJUAN);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const col = indexMap_(headers);
    let targetRow = -1;
    for (let i = 1; i < values.length; i++) {
      if (values[i][col['ID Pengajuan']] === id && VALID_STATUSES.indexOf(values[i][col['Status']]) !== -1) {
        targetRow = i + 1;
        break;
      }
    }
    if (targetRow === -1) throw new Error('Pengajuan tidak ditemukan');

    const statusLama = values[targetRow - 1][col['Status']] || '';
    const now = new Date();
    const entry = '[' + formatDateTime_(now) + '] ' + statusLama + ' → ' + statusBaru + ' oleh ' + session.username;
    const oldHistory = values[targetRow - 1][col['Riwayat Singkat']] || '';

    sheet.getRange(targetRow, col['Status'] + 1).setValue(statusBaru);
    sheet.getRange(targetRow, col['Catatan Admin'] + 1).setValue(catatanAdmin);
    sheet.getRange(targetRow, col['Tanggal Update Status Terakhir'] + 1).setValue(now);
    sheet.getRange(targetRow, col['User Update Status'] + 1).setValue(session.username);
    sheet.getRange(targetRow, col['Riwayat Singkat'] + 1).setValue(oldHistory ? oldHistory + '\n' + entry : entry);

    getSheet_(SHEETS.STATUS_LOG).appendRow([now, id, statusLama, statusBaru, catatanAdmin, session.username]);
    return { success: true, data: {} };
  } finally {
    lock.releaseLock();
  }
}

function handleGetProductReviewQueue(data) {
  requireSession_(data.token);
  const pengajuanMap = {};
  readObjects_(SHEETS.PENGAJUAN).forEach(function (row) {
    if (VALID_STATUSES.indexOf(row['Status']) !== -1) pengajuanMap[row['ID Pengajuan']] = row;
  });

  const groups = {};
  readObjects_(SHEETS.ITEMS).forEach(function (row) {
    const pengajuan = pengajuanMap[row['ID Pengajuan']];
    if (!pengajuan) return;
    const status = clean_(row['produk_status']);
    if (status === 'verified') return;
    const modelNormalized = clean_(row['model_normalized']) || normalizeModelKey_(row['Model']);
    if (!modelNormalized) return;
    if (!groups[modelNormalized]) {
      groups[modelNormalized] = {
        modelNormalized: modelNormalized,
        modelDisplay: clean_(row['Model']),
        produk: clean_(row['Produk']),
        count: 0,
        items: [],
        produkOptions: {},
      };
    }
    const group = groups[modelNormalized];
    const produk = clean_(row['Produk']);
    group.count += 1;
    if (produk) group.produkOptions[produk] = (group.produkOptions[produk] || 0) + 1;
    group.items.push({
      idPengajuan: row['ID Pengajuan'],
      noItem: row['No Item'],
      produk: produk,
      model: row['Model'],
      nomorSeri: row['Nomor Seri'],
      statusPengajuan: pengajuan['Status'],
      bagianCabang: pengajuan['Bagian/Cabang'],
    });
  });

  const rows = Object.keys(groups).map(function (key) {
    const group = groups[key];
    const options = Object.keys(group.produkOptions).sort(function (a, b) {
      return group.produkOptions[b] - group.produkOptions[a] || a.localeCompare(b);
    });
    if (!group.produk && options.length) group.produk = options[0];
    group.produkOptions = options.map(function (produk) {
      return { produk: produk, count: group.produkOptions[produk] };
    });
    return group;
  }).sort(function (a, b) {
    if (b.count !== a.count) return b.count - a.count;
    return a.modelDisplay.localeCompare(b.modelDisplay);
  });

  return { success: true, data: { rows: rows } };
}

function handleApproveModelProduk(data) {
  const session = requireSession_(data.token);
  const modelNormalized = clean_(data.modelNormalized || data.model_normalized) || normalizeModelKey_(data.modelDisplay || data.model);
  const modelDisplay = clean_(data.modelDisplay || data.model) || modelNormalized;
  const produk = clean_(data.produk || data.kategori);
  if (!modelNormalized) throw new Error('Model wajib dipilih');
  if (!produk) throw new Error('Nama Produk wajib diisi');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    upsertModelProduk_(modelNormalized, modelDisplay, produk, session.username);
    const count = verifyPendingItemsByModel_(modelNormalized, produk);
    return { success: true, data: { modelNormalized: modelNormalized, produk: produk, count: count } };
  } finally {
    lock.releaseLock();
  }
}

function handleGetWarrantyPrintQueue(data) {
  requireSession_(data.token);
  const includePrinted = data.includePrinted === true || clean_(data.includePrinted).toLowerCase() === 'yes';
  const search = clean_(data.search).toLowerCase();
  const cardType = normalizeWarrantyCardType_(data.jenisKartu, false);
  const rows = getApprovedWarrantyQueueItems_().filter(function (item) {
    if (!includePrinted && item.statusCetak === 'Printed') return false;
    if (cardType && item.jenisKartu !== cardType) return false;
    if (search) {
      const haystack = [
        item.idPengajuan,
        item.nama,
        item.bagianCabang,
        item.produk,
        item.model,
        item.nomorSeri,
      ].join(' ').toLowerCase();
      if (haystack.indexOf(search) === -1) return false;
    }
    return true;
  });

  rows.sort(function (a, b) {
    const typeOrder = { Local: 1, Import: 2, '': 3 };
    const aType = typeOrder[a.jenisKartu] || 3;
    const bType = typeOrder[b.jenisKartu] || 3;
    if (aType !== bType) return aType - bType;
    const aTime = new Date(a.timestampSubmit || 0).getTime();
    const bTime = new Date(b.timestampSubmit || 0).getTime();
    if (aTime !== bTime) return aTime - bTime;
    if (a.idPengajuan !== b.idPengajuan) return String(a.idPengajuan).localeCompare(String(b.idPengajuan));
    return Number(a.noItem) - Number(b.noItem);
  });

  const summary = { total: rows.length, local: 0, import: 0, belumJenisKartu: 0, printed: 0 };
  rows.forEach(function (item) {
    if (item.jenisKartu === 'Local') summary.local += 1;
    else if (item.jenisKartu === 'Import') summary.import += 1;
    else summary.belumJenisKartu += 1;
    if (item.statusCetak === 'Printed') summary.printed += 1;
  });

  return { success: true, data: { rows: rows, summary: summary } };
}

function handleGetPrintLayouts(data) {
  requireSession_(data.token);
  ensurePrintLayoutDefaults_(getSheet_(SHEETS.CONFIG));
  return { success: true, data: getPrintLayoutState_() };
}

function handleSavePrintLayout(data) {
  const session = requireSession_(data.token);
  const cleaned = normalizePrintLayoutInput_(data.layout || data, true);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    ensurePrintLayoutDefaults_(getSheet_(SHEETS.CONFIG));
    const sheet = getSheet_(SHEETS.PRINT_LAYOUTS);
    const values = sheet.getDataRange().getValues();
    const headers = values[0] || HEADERS[SHEETS.PRINT_LAYOUTS];
    const col = indexMap_(headers);
    const now = new Date();
    let targetRow = -1;
    let existing = null;
    if (cleaned.id) {
      for (let i = 1; i < values.length; i++) {
        if (clean_(values[i][col.ID]) === cleaned.id) {
          targetRow = i + 1;
          existing = values[i];
          break;
        }
      }
    }
    const id = cleaned.id || generatePrintLayoutId_(cleaned.type);
    const isBuiltin = existing ? parseBoolean_(existing[col['Is Builtin']]) : false;
    const createdAt = existing ? existing[col['Created At']] : now;
    const row = [
      id,
      cleaned.type,
      cleaned.name,
      cleaned.offsetX,
      cleaned.offsetY,
      cleaned.gapProductModel,
      cleaned.gapModelSerial,
      isBuiltin ? 'TRUE' : 'FALSE',
      createdAt,
      now,
      session.username,
    ];
    if (targetRow > -1) sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
    else sheet.appendRow(row);
    const state = getPrintLayoutState_();
    state.savedLayoutId = id;
    return { success: true, data: state };
  } finally {
    lock.releaseLock();
  }
}

function handleDeletePrintLayout(data) {
  requireSession_(data.token);
  const id = clean_(data.id || data.layoutId);
  if (!id) throw new Error('Layout wajib dipilih');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    ensurePrintLayoutDefaults_(getSheet_(SHEETS.CONFIG));
    const state = getPrintLayoutState_();
    const layout = state.layouts.find(function (item) { return item.id === id; });
    if (!layout) throw new Error('Layout tidak ditemukan');
    if (layout.isBuiltin) throw new Error('Layout bawaan tidak boleh dihapus');
    if (state.active[layout.type] === id) throw new Error('Pilih layout aktif lain sebelum menghapus layout ini');

    const sheet = getSheet_(SHEETS.PRINT_LAYOUTS);
    const values = sheet.getDataRange().getValues();
    const col = indexMap_(values[0]);
    for (let i = 1; i < values.length; i++) {
      if (clean_(values[i][col.ID]) === id) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
    return { success: true, data: getPrintLayoutState_() };
  } finally {
    lock.releaseLock();
  }
}

function handleSetActivePrintLayout(data) {
  const session = requireSession_(data.token);
  const type = normalizePrintLayoutType_(data.type, true);
  const id = clean_(data.id || data.layoutId);
  if (!id) throw new Error('Layout wajib dipilih');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    ensurePrintLayoutDefaults_(getSheet_(SHEETS.CONFIG));
    const state = getPrintLayoutState_();
    const layout = state.layouts.find(function (item) { return item.id === id && item.type === type; });
    if (!layout) throw new Error('Layout tidak ditemukan untuk jenis kartu ini');
    upsertConfig_(getSheet_(SHEETS.CONFIG), ACTIVE_PRINT_LAYOUT_KEYS[type], id, true);
    return { success: true, data: getPrintLayoutState_(), updatedBy: session.username };
  } finally {
    lock.releaseLock();
  }
}

function handleSaveWarrantyCardTypes(data) {
  const session = requireSession_(data.token);
  const items = Array.isArray(data.items) ? data.items : [];
  if (!items.length) throw new Error('Pilih item terlebih dahulu');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const approvedMap = mapByWarrantyKey_(getApprovedWarrantyQueueItems_());
    const state = getWarrantyCardSheetState_();
    items.forEach(function (input) {
      const id = clean_(input.idPengajuan);
      const noItem = clean_(input.noItem);
      const jenisKartu = normalizeWarrantyCardType_(input.jenisKartu, true);
      const key = warrantyCardKey_(id, noItem);
      const item = approvedMap[key];
      if (!item) throw new Error('Item tidak ditemukan atau belum berstatus Disetujui: ' + id + ' #' + noItem);

      const existing = state.rows[key] ? state.rows[key].data : {};
      writeWarrantyCardRow_(state.sheet, state.rows[key], {
        idPengajuan: item.idPengajuan,
        noItem: item.noItem,
        produk: item.produk,
        model: item.model,
        nomorSeri: item.nomorSeri,
        jenisKartu: jenisKartu,
        statusCetak: clean_(existing['Status Cetak']) || 'Belum Dicetak',
        printBatchId: clean_(existing['Print Batch ID']),
        printedAt: existing['Printed At'] || '',
        printedBy: clean_(existing['Printed By']),
        reprintCount: Number(existing['Reprint Count'] || 0),
        lastReprintAt: existing['Last Reprint At'] || '',
        lastReprintBy: clean_(existing['Last Reprint By']),
        catatan: clean_(existing['Catatan']) || ('Jenis kartu disimpan oleh ' + session.username),
      });
      state.rows[key] = findWarrantyCardStateRow_(state.sheet, key);
    });

    return { success: true, data: { count: items.length } };
  } finally {
    lock.releaseLock();
  }
}

function handleMarkWarrantyCardsPrinted(data) {
  const session = requireSession_(data.token);
  const inputs = Array.isArray(data.items) ? data.items : [];
  const catatan = clean_(data.catatan);
  if (!inputs.length) throw new Error('Pilih item yang sudah dicetak');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const approvedMap = mapByWarrantyKey_(getApprovedWarrantyQueueItems_());
    const state = getWarrantyCardSheetState_();
    const now = new Date();
    const batchId = generatePrintBatchId_('KG');

    inputs.forEach(function (input) {
      const id = clean_(input.idPengajuan);
      const noItem = clean_(input.noItem);
      const key = warrantyCardKey_(id, noItem);
      const item = approvedMap[key];
      if (!item) throw new Error('Item tidak ditemukan atau belum berstatus Disetujui: ' + id + ' #' + noItem);

      const existing = state.rows[key] ? state.rows[key].data : {};
      const jenisKartu = normalizeWarrantyCardType_(input.jenisKartu || existing['Jenis Kartu'], true);
      const alreadyPrinted = clean_(existing['Status Cetak']) === 'Printed';
      const printedAt = existing['Printed At'] || now;
      const printedBy = clean_(existing['Printed By']) || session.username;
      const reprintCount = alreadyPrinted ? Number(existing['Reprint Count'] || 0) + 1 : Number(existing['Reprint Count'] || 0);

      writeWarrantyCardRow_(state.sheet, state.rows[key], {
        idPengajuan: item.idPengajuan,
        noItem: item.noItem,
        produk: item.produk,
        model: item.model,
        nomorSeri: item.nomorSeri,
        jenisKartu: jenisKartu,
        statusCetak: 'Printed',
        printBatchId: batchId,
        printedAt: printedAt,
        printedBy: printedBy,
        reprintCount: reprintCount,
        lastReprintAt: alreadyPrinted ? now : (existing['Last Reprint At'] || ''),
        lastReprintBy: alreadyPrinted ? session.username : clean_(existing['Last Reprint By']),
        catatan: catatan,
      });
      state.rows[key] = findWarrantyCardStateRow_(state.sheet, key);
    });

    getSheet_(SHEETS.PRINT_BATCH).appendRow([batchId, 'warranty_card', now, session.username, inputs.length, catatan]);
    return { success: true, data: { batchId: batchId, count: inputs.length } };
  } finally {
    lock.releaseLock();
  }
}

function sendEmailDigest() {
  const config = getConfig();
  const recipients = readObjects_(SHEETS.RECIPIENTS)
    .filter(function (row) { return clean_(row['Aktif']).toLowerCase() === 'yes' && clean_(row['Email']); })
    .map(function (row) { return clean_(row['Email']); });
  if (!recipients.length) {
    getSheet_(SHEETS.EMAIL_LOG).appendRow([new Date(), 'Digest Pengajuan Kartu Garansi', '', 0, 'Tidak ada penerima aktif']);
    return;
  }

  const rows = readObjects_(SHEETS.PENGAJUAN)
    .filter(function (row) { return ['Baru', 'Disetujui'].indexOf(row['Status']) !== -1; })
    .sort(function (a, b) { return new Date(b['Timestamp Submit']).getTime() - new Date(a['Timestamp Submit']).getTime(); })
    .slice(0, 100);

  if (!rows.length) {
    upsertConfig_(getSheet_(SHEETS.CONFIG), 'LAST_EMAIL_SENT_AT', new Date(), true);
    getSheet_(SHEETS.EMAIL_LOG).appendRow([new Date(), 'Digest Pengajuan Kartu Garansi', recipients.join(', '), 0, 'Tidak ada pengajuan terbuka']);
    return;
  }

  const subject = '[' + (config.APP_NAME || APP.APP_NAME) + '] Digest ' + rows.length + ' pengajuan terbuka';
  const htmlBody = buildDigestHtml_(rows, config);
  MailApp.sendEmail({ to: recipients.join(','), subject: subject, htmlBody: htmlBody });
  upsertConfig_(getSheet_(SHEETS.CONFIG), 'LAST_EMAIL_SENT_AT', new Date(), true);
  getSheet_(SHEETS.EMAIL_LOG).appendRow([new Date(), subject, recipients.join(', '), rows.length, 'Terkirim']);
}

function ensureRuntimeHeaders_() {
  const ss = getSpreadsheet_();
  Object.keys(HEADERS).forEach(function (name) {
    ensureSheet_(ss, name, HEADERS[name]);
  });
}

function getSpreadsheet_() {
  if (APP.SPREADSHEET_ID) return SpreadsheetApp.openById(APP.SPREADSHEET_ID);
  const props = PropertiesService.getScriptProperties();
  const storedId = props.getProperty('SPREADSHEET_ID');
  if (storedId) return SpreadsheetApp.openById(storedId);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    props.setProperty('SPREADSHEET_ID', active.getId());
    return active;
  }
  const created = SpreadsheetApp.create(APP.APP_NAME + ' Data');
  props.setProperty('SPREADSHEET_ID', created.getId());
  return created;
}

function getSheet_(name) {
  const sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error('Sheet ' + name + ' belum ada. Jalankan setupApp() terlebih dahulu.');
  return sheet;
}

function ensureSheet_(ss, name, headers) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (!sheet.getLastRow()) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  const existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
  const needsHeader = headers.some(function (header, index) { return existing[index] !== header; });
  if (needsHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  sheet.setFrozenRows(1);
  return sheet;
}

function upsertConfig_(sheet, key, value, overwrite) {
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === key) {
      if (overwrite || values[i][1] === '') sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

function ensureEmailDigestTrigger_() {
  const triggers = ScriptApp.getProjectTriggers();
  const exists = triggers.some(function (trigger) { return trigger.getHandlerFunction() === 'sendEmailDigest'; });
  if (!exists) {
    ScriptApp.newTrigger('sendEmailDigest').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).create();
    ScriptApp.newTrigger('sendEmailDigest').timeBased().onWeekDay(ScriptApp.WeekDay.THURSDAY).atHour(9).create();
  }
}

function parseRequest_(e) {
  if (e && e.postData && e.postData.contents) return JSON.parse(e.postData.contents);
  const data = {};
  if (e && e.parameter) Object.keys(e.parameter).forEach(function (key) { data[key] = e.parameter[key]; });
  return data;
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function normalizeModelKey_(value) {
  return clean_(value).replace(/\s+/g, ' ').toUpperCase();
}

function getModelProdukRows_() {
  return readObjects_(SHEETS.MODEL_PRODUK).map(function (row) {
    return {
      modelNormalized: clean_(row['model_normalized']),
      modelDisplay: clean_(row['model_display']),
      produk: clean_(row['produk']),
      status: clean_(row['status']) || 'verified',
      updatedAt: row['updated_at'],
    };
  }).filter(function (row) {
    return row.modelNormalized && row.produk && row.status === 'verified';
  });
}

function getModelProdukMap_() {
  const map = {};
  getModelProdukRows_().forEach(function (row) {
    map[row.modelNormalized] = row;
  });
  return map;
}

function resolveItemProduk_(item, modelMap) {
  const modelNormalized = normalizeModelKey_(item.model);
  const master = modelMap[modelNormalized];
  if (master) {
    return Object.assign({}, item, {
      produk: master.produk,
      modelNormalized: modelNormalized,
      produkStatus: 'verified',
      produkSumber: 'auto',
    });
  }
  return Object.assign({}, item, {
    modelNormalized: modelNormalized,
    produkStatus: 'needs_review',
    produkSumber: 'manual',
  });
}

function upsertModelProduk_(modelNormalized, modelDisplay, produk, username) {
  const sheet = getSheet_(SHEETS.MODEL_PRODUK);
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || HEADERS[SHEETS.MODEL_PRODUK];
  const col = indexMap_(headers);
  const now = new Date();
  for (let i = 1; i < values.length; i++) {
    if (clean_(values[i][col['model_normalized']]) === modelNormalized) {
      sheet.getRange(i + 1, col['model_display'] + 1).setValue(modelDisplay);
      sheet.getRange(i + 1, col['produk'] + 1).setValue(produk);
      sheet.getRange(i + 1, col['status'] + 1).setValue('verified');
      sheet.getRange(i + 1, col['updated_at'] + 1).setValue(now);
      sheet.getRange(i + 1, col['updated_by'] + 1).setValue(username);
      return;
    }
  }
  sheet.appendRow([modelNormalized, modelDisplay, produk, 'verified', now, username]);
}

function verifyPendingItemsByModel_(modelNormalized, produk) {
  const sheet = getSheet_(SHEETS.ITEMS);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return 0;
  const col = indexMap_(values[0]);
  let count = 0;
  for (let i = 1; i < values.length; i++) {
    const rowModelNormalized = clean_(values[i][col['model_normalized']]) || normalizeModelKey_(values[i][col['Model']]);
    if (rowModelNormalized !== modelNormalized) continue;
    if (clean_(values[i][col['produk_status']]) === 'verified') continue;
    sheet.getRange(i + 1, col['Produk'] + 1).setValue(produk);
    sheet.getRange(i + 1, col['model_normalized'] + 1).setValue(modelNormalized);
    sheet.getRange(i + 1, col['produk_status'] + 1).setValue('verified');
    sheet.getRange(i + 1, col['produk_sumber'] + 1).setValue('admin');
    count += 1;
  }
  return count;
}

function normalizeSubmission_(data, config, includeFile) {
  const cleaned = {
    nama: clean_(data.nama),
    bagianCabang: clean_(data.bagianCabang),
    pemilik: clean_(data.pemilik),
    tanggalForm: clean_(data.tanggalForm),
    alasanPengajuan: clean_(data.alasanPengajuan),
    catatanTambahan: clean_(data.catatanTambahan),
    items: Array.isArray(data.items) ? data.items : [],
    fileBase64: clean_(data.fileBase64),
    fileExtension: clean_(data.fileExtension).toLowerCase().replace(/^\./, ''),
    fileMimeType: clean_(data.fileMimeType).toLowerCase(),
  };
  ['nama', 'bagianCabang', 'pemilik', 'tanggalForm', 'alasanPengajuan'].forEach(function (field) {
    if (!cleaned[field]) throw new Error('Field wajib belum lengkap: ' + field);
  });

  const tanggal = new Date(cleaned.tanggalForm + 'T00:00:00');
  if (isNaN(tanggal.getTime())) throw new Error('Tanggal Form tidak valid');
  const maxDate = endOfDay_(new Date());
  maxDate.setDate(maxDate.getDate() + 7);
  if (tanggal > maxDate) throw new Error('Tanggal Form tidak boleh lebih dari 7 hari ke depan');

  const maxItems = Number(config.MAX_ITEMS || APP.MAX_ITEMS);
  if (!cleaned.items.length) throw new Error('Minimal 1 item produk wajib diisi');
  if (cleaned.items.length > maxItems) throw new Error('Jumlah item maksimal ' + maxItems);
  const modelMap = getModelProdukMap_();
  cleaned.items = cleaned.items.map(function (item, index) {
    const normalized = { produk: clean_(item.produk), model: clean_(item.model), nomorSeri: clean_(item.nomorSeri) };
    if (!normalized.produk || !normalized.model || !normalized.nomorSeri) throw new Error('Item #' + (index + 1) + ' belum lengkap');
    return resolveItemProduk_(normalized, modelMap);
  });

  if (includeFile) {
    if (!cleaned.fileBase64) throw new Error('File hard copy wajib dilampirkan');
    if (VALID_EXTENSIONS.indexOf(cleaned.fileExtension) === -1) throw new Error('Format file tidak valid');
    if (VALID_MIME_TYPES.indexOf(cleaned.fileMimeType) === -1) throw new Error('MIME type file tidak valid');
    const approxBytes = Math.ceil((cleaned.fileBase64.length * 3) / 4);
    const maxBytes = Number(config.MAX_UPLOAD_MB || APP.MAX_UPLOAD_MB) * 1024 * 1024;
    if (approxBytes > maxBytes) throw new Error('Ukuran file melebihi ' + (config.MAX_UPLOAD_MB || APP.MAX_UPLOAD_MB) + 'MB');
  }
  return cleaned;
}

function appendPengajuanRow_(id, cleaned, status, resumeToken, timestampSubmit, fileUrl, fileId, catatanAdmin, draftCreatedAt, draftUpdatedAt, submittedAt, riwayatSingkat) {
  getSheet_(SHEETS.PENGAJUAN).appendRow([
    id,
    timestampSubmit,
    cleaned.nama,
    cleaned.bagianCabang,
    cleaned.pemilik,
    cleaned.alasanPengajuan,
    cleaned.tanggalForm,
    fileUrl,
    fileId,
    cleaned.catatanTambahan,
    cleaned.items.length,
    status,
    catatanAdmin,
    '',
    '',
    riwayatSingkat,
    resumeToken,
    draftCreatedAt,
    draftUpdatedAt,
    submittedAt,
  ]);
}

function updatePengajuanRow_(sheet, rowNumber, col, id, cleaned, status, resumeToken, timestampSubmit, fileUrl, fileId, draftCreatedAt, draftUpdatedAt, submittedAt, riwayatSingkat) {
  const row = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
  row[col['ID Pengajuan']] = id;
  row[col['Timestamp Submit']] = timestampSubmit;
  row[col['Nama']] = cleaned.nama;
  row[col['Bagian/Cabang']] = cleaned.bagianCabang;
  row[col['Pemilik']] = cleaned.pemilik;
  row[col['Alasan Pengajuan']] = cleaned.alasanPengajuan;
  row[col['Tanggal Form']] = cleaned.tanggalForm;
  row[col['File Hard Copy URL']] = fileUrl;
  row[col['File Hard Copy ID']] = fileId;
  row[col['Catatan Tambahan']] = cleaned.catatanTambahan;
  row[col['Jumlah Item']] = cleaned.items.length;
  row[col['Status']] = status;
  row[col['Catatan Admin']] = '';
  row[col['Tanggal Update Status Terakhir']] = '';
  row[col['User Update Status']] = '';
  row[col['Riwayat Singkat']] = riwayatSingkat;
  row[col['Resume Token']] = resumeToken;
  row[col['Draft Created At']] = draftCreatedAt;
  row[col['Draft Updated At']] = draftUpdatedAt;
  row[col['Submitted At']] = submittedAt;
  sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
}

function findPengajuanRecord_(id) {
  const sheet = getSheet_(SHEETS.PENGAJUAN);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return null;
  const headers = values[0];
  const col = indexMap_(headers);
  for (let i = 1; i < values.length; i++) {
    if (values[i][col['ID Pengajuan']] === id) {
      return { sheet: sheet, values: values, headers: headers, col: col, rowNumber: i + 1, row: values[i] };
    }
  }
  return null;
}

function getItemsForPengajuan_(id) {
  return readObjects_(SHEETS.ITEMS)
    .filter(function (row) { return row['ID Pengajuan'] === id; })
    .sort(function (a, b) { return Number(a['No Item']) - Number(b['No Item']); })
    .map(function (row) {
      return {
        noItem: row['No Item'],
        produk: row['Produk'],
        model: row['Model'],
        nomorSeri: row['Nomor Seri'],
        modelNormalized: clean_(row['model_normalized']) || normalizeModelKey_(row['Model']),
        produkStatus: clean_(row['produk_status']) || 'needs_review',
        produkSumber: clean_(row['produk_sumber']) || '',
      };
    });
}

function getApprovedWarrantyQueueItems_() {
  const pengajuanMap = {};
  readObjects_(SHEETS.PENGAJUAN).forEach(function (row) {
    if (row['Status'] !== 'Disetujui') return;
    pengajuanMap[row['ID Pengajuan']] = row;
  });

  const cardState = getWarrantyCardSheetState_();
  return readObjects_(SHEETS.ITEMS)
    .filter(function (row) { return pengajuanMap[row['ID Pengajuan']] && clean_(row['produk_status']) === 'verified'; })
    .map(function (row) {
      const pengajuan = pengajuanMap[row['ID Pengajuan']];
      const key = warrantyCardKey_(row['ID Pengajuan'], row['No Item']);
      const state = cardState.rows[key] ? cardState.rows[key].data : {};
      const jenisKartu = normalizeWarrantyCardType_(state['Jenis Kartu'], false);
      return {
        key: key,
        idPengajuan: row['ID Pengajuan'],
        noItem: row['No Item'],
        produk: row['Produk'],
        model: row['Model'],
        nomorSeri: row['Nomor Seri'],
        jenisKartu: jenisKartu,
        jenisKartuKey: jenisKartu ? jenisKartu.toLowerCase() : '',
        statusCetak: clean_(state['Status Cetak']) || 'Belum Dicetak',
        printBatchId: clean_(state['Print Batch ID']),
        printedAt: toIso_(state['Printed At']),
        printedBy: clean_(state['Printed By']),
        reprintCount: Number(state['Reprint Count'] || 0),
        nama: pengajuan['Nama'],
        bagianCabang: pengajuan['Bagian/Cabang'],
        timestampSubmit: toIso_(pengajuan['Timestamp Submit']),
      };
    });
}

function getWarrantyCardSheetState_() {
  const sheet = getSheet_(SHEETS.WARRANTY_CARDS);
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || HEADERS[SHEETS.WARRANTY_CARDS];
  const rows = {};
  for (let i = 1; i < values.length; i++) {
    if (!values[i].some(function (cell) { return cell !== ''; })) continue;
    const data = {};
    headers.forEach(function (header, index) { data[header] = values[i][index]; });
    rows[warrantyCardKey_(data['ID Pengajuan'], data['No Item'])] = { rowNumber: i + 1, data: data };
  }
  return { sheet: sheet, rows: rows };
}

function findWarrantyCardStateRow_(sheet, key) {
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || HEADERS[SHEETS.WARRANTY_CARDS];
  for (let i = 1; i < values.length; i++) {
    const data = {};
    headers.forEach(function (header, index) { data[header] = values[i][index]; });
    if (warrantyCardKey_(data['ID Pengajuan'], data['No Item']) === key) return { rowNumber: i + 1, data: data };
  }
  return null;
}

function writeWarrantyCardRow_(sheet, existingRow, data) {
  const row = [
    data.idPengajuan,
    data.noItem,
    data.produk,
    data.model,
    data.nomorSeri,
    data.jenisKartu,
    data.statusCetak,
    data.printBatchId,
    data.printedAt,
    data.printedBy,
    data.reprintCount,
    data.lastReprintAt,
    data.lastReprintBy,
    data.catatan,
  ];
  if (existingRow && existingRow.rowNumber) {
    sheet.getRange(existingRow.rowNumber, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
}

function mapByWarrantyKey_(items) {
  const map = {};
  items.forEach(function (item) { map[warrantyCardKey_(item.idPengajuan, item.noItem)] = item; });
  return map;
}

function warrantyCardKey_(id, noItem) {
  return clean_(id) + '::' + clean_(noItem);
}

function normalizeWarrantyCardType_(value, required) {
  const raw = clean_(value).toLowerCase();
  if (!raw) {
    if (required) throw new Error('Jenis kartu wajib dipilih');
    return '';
  }
  if (raw === 'local' || raw === 'lokal') return 'Local';
  if (raw === 'import' || raw === 'impor') return 'Import';
  throw new Error('Jenis kartu tidak valid: ' + value);
}

function ensurePrintLayoutDefaults_(configSheet) {
  const sheet = getSheet_(SHEETS.PRINT_LAYOUTS);
  const state = getPrintLayoutRows_();
  const now = new Date();
  DEFAULT_PRINT_LAYOUTS.forEach(function (layout) {
    if (!state.byId[layout.id]) {
      sheet.appendRow([
        layout.id,
        layout.type,
        layout.name,
        layout.offsetX,
        layout.offsetY,
        layout.gapProductModel,
        layout.gapModelSerial,
        'TRUE',
        now,
        now,
        'system',
      ]);
    }
    upsertConfig_(configSheet, ACTIVE_PRINT_LAYOUT_KEYS[layout.type], layout.id, false);
  });
}

function getPrintLayoutState_() {
  const rows = getPrintLayoutRows_().layouts;
  const configSheet = getSheet_(SHEETS.CONFIG);
  const config = getConfig();
  const active = {
    local: clean_(config.ACTIVE_PRINT_LAYOUT_LOCAL) || 'local-default',
    import: clean_(config.ACTIVE_PRINT_LAYOUT_IMPORT) || 'import-default',
  };
  const activeLayouts = {};
  ['local', 'import'].forEach(function (type) {
    let layout = rows.find(function (item) { return item.id === active[type] && item.type === type; });
    if (!layout) {
      layout = rows.find(function (item) { return item.id === type + '-default' && item.type === type; });
      active[type] = layout ? layout.id : '';
      if (layout) upsertConfig_(configSheet, ACTIVE_PRINT_LAYOUT_KEYS[type], layout.id, true);
    }
    activeLayouts[type] = layout || null;
  });
  return { layouts: rows, active: active, activeLayouts: activeLayouts };
}

function getPrintLayoutRows_() {
  const sheet = getSheet_(SHEETS.PRINT_LAYOUTS);
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || HEADERS[SHEETS.PRINT_LAYOUTS];
  const col = indexMap_(headers);
  const layouts = [];
  const byId = {};
  for (let i = 1; i < values.length; i++) {
    if (!values[i].some(function (cell) { return cell !== ''; })) continue;
    const layout = {
      id: clean_(values[i][col.ID]),
      type: normalizePrintLayoutType_(values[i][col.Type], false),
      name: clean_(values[i][col.Name]),
      offsetX: normalizeNumber_(values[i][col['Offset X']], 0, true),
      offsetY: normalizeNumber_(values[i][col['Offset Y']], 0, true),
      gapProductModel: normalizeNumber_(values[i][col['Gap Product Model']], 0, false),
      gapModelSerial: normalizeNumber_(values[i][col['Gap Model Serial']], 0, false),
      isBuiltin: parseBoolean_(values[i][col['Is Builtin']]),
      createdAt: toIso_(values[i][col['Created At']]),
      updatedAt: toIso_(values[i][col['Updated At']]),
      updatedBy: clean_(values[i][col['Updated By']]),
    };
    if (!layout.id || !layout.type) continue;
    layouts.push(layout);
    byId[layout.id] = layout;
  }
  layouts.sort(function (a, b) {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    if (a.isBuiltin !== b.isBuiltin) return a.isBuiltin ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return { layouts: layouts, byId: byId };
}

function normalizePrintLayoutInput_(input, requireName) {
  const layout = {
    id: clean_(input.id || input.layoutId),
    type: normalizePrintLayoutType_(input.type, true),
    name: clean_(input.name),
    offsetX: normalizeNumber_(input.offsetX, 0, true),
    offsetY: normalizeNumber_(input.offsetY, 0, true),
    gapProductModel: normalizeNumber_(input.gapProductModel, 0, false),
    gapModelSerial: normalizeNumber_(input.gapModelSerial, 0, false),
  };
  if (requireName && !layout.name) throw new Error('Nama layout wajib diisi');
  return layout;
}

function normalizePrintLayoutType_(value, required) {
  const raw = clean_(value).toLowerCase();
  if (!raw) {
    if (required) throw new Error('Jenis layout wajib dipilih');
    return '';
  }
  if (raw === 'local' || raw === 'lokal') return 'local';
  if (raw === 'import' || raw === 'impor') return 'import';
  throw new Error('Jenis layout tidak valid: ' + value);
}

function normalizeNumber_(value, fallback, allowNegative) {
  if (value === '' || value == null) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error('Nilai angka tidak valid');
  if (!allowNegative && number < 0) throw new Error('Nilai gap minimal 0');
  return number;
}

function parseBoolean_(value) {
  const raw = clean_(value).toLowerCase();
  return raw === 'true' || raw === 'yes' || raw === '1';
}

function generatePrintLayoutId_(type) {
  return type + '-' + Utilities.getUuid().slice(0, 8).toLowerCase();
}

function replaceItemRows_(id, items) {
  const sheet = getSheet_(SHEETS.ITEMS);
  const values = sheet.getDataRange().getValues();
  if (values.length >= 2) {
    const col = indexMap_(values[0]);
    for (let i = values.length - 1; i >= 1; i--) {
      if (values[i][col['ID Pengajuan']] === id) sheet.deleteRow(i + 1);
    }
  }

  const itemRows = items.map(function (item, index) {
    return [id, index + 1, item.produk, item.model, item.nomorSeri, item.modelNormalized, item.produkStatus, item.produkSumber];
  });
  if (itemRows.length) sheet.getRange(sheet.getLastRow() + 1, 1, itemRows.length, itemRows[0].length).setValues(itemRows);
}

function generateIdUnlocked_() {
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  const prefix = 'KG-' + today + '-';
  const sheet = getSheet_(SHEETS.PENGAJUAN);
  const lastRow = sheet.getLastRow();
  let max = 0;
  if (lastRow >= 2) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
    ids.forEach(function (id) {
      id = String(id || '');
      if (id.indexOf(prefix) === 0) {
        const seq = parseInt(id.slice(prefix.length), 10);
        if (!isNaN(seq) && seq > max) max = seq;
      }
    });
  }
  return prefix + String(max + 1).padStart(4, '0');
}

function generatePrintBatchId_(prefix) {
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  return prefix + '-PRINT-' + stamp + '-' + Utilities.getUuid().slice(0, 8).toUpperCase();
}

function generateResumeToken_() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
}

function readObjects_(sheetName) {
  const sheet = getSheet_(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).filter(function (row) { return row.some(function (cell) { return cell !== ''; }); }).map(function (row) {
    const obj = {};
    headers.forEach(function (header, index) { obj[header] = row[index]; });
    return obj;
  });
}

function requireSession_(token) {
  const session = validateSession(token);
  if (!session) throw new Error('Unauthorized');
  return session;
}

function clean_(value) {
  return String(value == null ? '' : value).trim();
}

function indexMap_(headers) {
  const map = {};
  headers.forEach(function (header, index) { map[header] = index; });
  return map;
}

function startOfDay_(date) {
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay_(date) {
  date.setHours(23, 59, 59, 999);
  return date;
}

function toIso_(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function formatDateOnly_(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? String(value) : Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function formatDateTime_(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function buildDigestHtml_(rows, config) {
  const trs = rows.map(function (row) {
    return '<tr>' +
      '<td>' + escapeHtml_(row['ID Pengajuan']) + '</td>' +
      '<td>' + escapeHtml_(formatDateTime_(row['Timestamp Submit'])) + '</td>' +
      '<td>' + escapeHtml_(row['Nama']) + '</td>' +
      '<td>' + escapeHtml_(row['Bagian/Cabang']) + '</td>' +
      '<td>' + escapeHtml_(row['Jumlah Item']) + '</td>' +
      '<td>' + escapeHtml_(row['Status']) + '</td>' +
      '</tr>';
  }).join('');
  return '<h2>' + escapeHtml_(config.APP_NAME || APP.APP_NAME) + '</h2>' +
    '<p>Berikut ringkasan pengajuan berstatus Baru atau Disetujui.</p>' +
    '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">' +
    '<thead><tr><th>ID</th><th>Waktu Submit</th><th>Nama</th><th>Bagian/Cabang</th><th>Jml Item</th><th>Status</th></tr></thead>' +
    '<tbody>' + trs + '</tbody></table>';
}

function escapeHtml_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
