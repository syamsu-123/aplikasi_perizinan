const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'database.db'));

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  -- Table untuk data santri
  CREATE TABLE IF NOT EXISTS santri (
    id TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    nis TEXT UNIQUE NOT NULL,
    kelas TEXT NOT NULL,
    tanggal_lahir TEXT,
    alamat TEXT,
    no_hp_ortu TEXT,
    qr_code TEXT UNIQUE,
    status_aktif INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Table untuk jenis izin
  CREATE TABLE IF NOT EXISTS jenis_izin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama_izin TEXT NOT NULL,
    deskripsi TEXT,
    durasi_jam INTEGER DEFAULT 24,
    requires_approval INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Table untuk pengajuan izin
  CREATE TABLE IF NOT EXISTS izin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    santri_id TEXT NOT NULL,
    jenis_izin_id INTEGER NOT NULL,
    alasan TEXT NOT NULL,
    tanggal_mulai TEXT NOT NULL,
    tanggal_selesai TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    tanggal_kembali TEXT,
    approved_by TEXT,
    approved_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (santri_id) REFERENCES santri(id),
    FOREIGN KEY (jenis_izin_id) REFERENCES jenis_izin(id)
  );

  -- Add column tanggal_kembali if not exists (for existing databases)
`);

// Add column if not exists (handle existing database upgrades)
try {
  db.exec(`ALTER TABLE izin ADD COLUMN tanggal_kembali TEXT;`);
  console.log('Added tanggal_kembali column to izin table');
} catch (error) {
  // Column already exists, ignore error
  if (!error.message.includes('duplicate column')) {
    console.log('Note:', error.message);
  }
}

db.exec(`
  -- Table untuk konfigurasi aplikasi
  CREATE TABLE IF NOT EXISTS config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Insert default config for denda
  INSERT OR REPLACE INTO config (key, value, description) VALUES
  ('denda_per_hari', '10000', 'Jumlah denda per hari keterlambatan (Rp)'),
  ('denda_per_jam', '5000', 'Jumlah denda per jam keterlambatan (Rp)'),
  ('denda_minimum', '5000', 'Jumlah denda minimum (Rp)'),
  ('denda_mode', 'per_hari', 'Mode perhitungan denda: per_hari atau per_jam');

  -- Table untuk denda
  CREATE TABLE IF NOT EXISTS denda (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    izin_id INTEGER NOT NULL,
    santri_id TEXT NOT NULL,
    jumlah_denda INTEGER DEFAULT 0,
    hari_terlambat INTEGER DEFAULT 0,
    jam_terlambat INTEGER DEFAULT 0,
    tanggal_kembali TEXT,
    keterangan TEXT,
    status TEXT DEFAULT 'belum_lunas',
    tanggal_bayar TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (izin_id) REFERENCES izin(id),
    FOREIGN KEY (santri_id) REFERENCES santri(id)
  );

  -- Table untuk log keluar masuk
  CREATE TABLE IF NOT EXISTS akses_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    santri_id TEXT NOT NULL,
    izin_id INTEGER,
    jenis_akses TEXT NOT NULL,
    waktu_akses TEXT DEFAULT CURRENT_TIMESTAMP,
    keterangan TEXT,
    verified_by TEXT,
    FOREIGN KEY (santri_id) REFERENCES santri(id),
    FOREIGN KEY (izin_id) REFERENCES izin(id)
  );

  -- Table untuk users (admin/pengurus)
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nama_lengkap TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Insert default admin user (password: admin123)
  INSERT OR IGNORE INTO users (username, password, nama_lengkap, role)
  VALUES ('admin', 'admin123', 'Administrator', 'admin');

  -- Insert default jenis izin (use INSERT OR REPLACE to avoid duplicates)
  INSERT OR REPLACE INTO jenis_izin (id, nama_izin, deskripsi, durasi_jam, requires_approval) VALUES
  (1, 'Izin Keluar', 'Izin untuk keluar pondok', 24, 1),
  (2, 'Izin Pulang', 'Izin pulang ke rumah', 48, 1),
  (3, 'Izin Berobat', 'Izin untuk berobat ke luar', 12, 0),
  (4, 'Izin Keluarga', 'Izin karena keperluan keluarga', 24, 1);
`);

console.log('Database initialized successfully!');

module.exports = db;
