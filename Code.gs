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
};

const HEADERS = {
  [SHEETS.PENGAJUAN]: ['ID Pengajuan', 'Timestamp Submit', 'Nama', 'Bagian/Cabang', 'Pemilik', 'Alasan Pengajuan', 'Tanggal Form', 'File Hard Copy URL', 'File Hard Copy ID', 'Catatan Tambahan', 'Jumlah Item', 'Status', 'Catatan Admin', 'Tanggal Update Status Terakhir', 'User Update Status', 'Riwayat Singkat', 'Resume Token', 'Draft Created At', 'Draft Updated At', 'Submitted At'],
  [SHEETS.ITEMS]: ['ID Pengajuan', 'No Item', 'Produk', 'Model', 'Nomor Seri'],
  [SHEETS.USERS]: ['Username', 'Password/PIN', 'Nama', 'Role', 'Aktif', 'Last Login'],
  [SHEETS.RECIPIENTS]: ['Nama', 'Email', 'Aktif', 'Keterangan'],
  [SHEETS.CONFIG]: ['Key', 'Value'],
  [SHEETS.STATUS_LOG]: ['Timestamp', 'ID Pengajuan', 'Status Lama', 'Status Baru', 'Catatan Admin', 'User'],
  [SHEETS.EMAIL_LOG]: ['Timestamp', 'Subject', 'Recipients', 'Jumlah Pengajuan', 'Status'],
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
  };
  Object.keys(defaults).forEach(function (key) {
    upsertConfig_(configSheet, key, defaults[key], false);
  });

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
    throw new Error('ID Pengajuan ini sudah dikirim final dan tidak bisa dibuka sebagai draft. Jika ingin melihat statusnya, cek dashboard admin.');
  }

  return { success: true, data: { idPengajuan: id, status: status } };
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
  cleaned.items = cleaned.items.map(function (item, index) {
    const normalized = { produk: clean_(item.produk), model: clean_(item.model), nomorSeri: clean_(item.nomorSeri) };
    if (!normalized.produk || !normalized.model || !normalized.nomorSeri) throw new Error('Item #' + (index + 1) + ' belum lengkap');
    return normalized;
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
    .map(function (row) { return { noItem: row['No Item'], produk: row['Produk'], model: row['Model'], nomorSeri: row['Nomor Seri'] }; });
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
    return [id, index + 1, item.produk, item.model, item.nomorSeri];
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
