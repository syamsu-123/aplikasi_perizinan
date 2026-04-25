/**
 * Utility untuk mengelola izin santri:
 * - Auto-complete izin yang sudah lewat waktu
 * - Hitung denda jika telat kembali
 * - Izin Keluar: denda per jam Rp5.000
 * - Izin Pulang/Berobat/Keluarga: denda per hari Rp10.000
 */

export const DENDA_CONFIG = {
  per_jam: 5000,       // Izin Keluar
  per_hari: 10000,     // Izin Pulang, Berobat, Keluarga
};

/**
 * Jenis izin dan mode dendanya
 */
export const JENIS_IZIN_DENDA = {
  'Izin Keluar': { mode: 'per_jam', durasiJam: 24 },
  'Izin Pulang': { mode: 'per_hari', durasiJam: 48 },
  'Izin Berobat': { mode: 'per_hari', durasiJam: 12 },
  'Izin Keluarga': { mode: 'per_hari', durasiJam: 24 },
};

/**
 * Hitung selisih waktu dalam jam
 */
function getHoursDiff(start, end) {
  const diffMs = new Date(end) - new Date(start);
  return diffMs / (1000 * 60 * 60);
}

/**
 * Hitung selisih waktu dalam hari (dibulatkan ke atas)
 */
function getDaysDiff(start, end) {
  const hours = getHoursDiff(start, end);
  return Math.ceil(hours / 24);
}

/**
 * Hitung jumlah denda berdasarkan jenis izin dan keterlambatan
 * @param {string} jenisIzinNama - Nama jenis izin
 * @param {string} tanggalSelesai - ISO date waktu deadline
 * @param {string} actualReturnTime - ISO date waktu santri kembali (optional, pakai now jika undefined)
 * @returns {{ jumlahDenda: number, terlambatJam: number, terlambatHari: number, mode: string }}
 */
export function calculateDenda(jenisIzinNama, tanggalSelesai, actualReturnTime) {
  const returnTime = actualReturnTime || new Date().toISOString();
  const deadline = new Date(tanggalSelesai);
  const actual = new Date(returnTime);

  // Jika belum lewat waktu, tidak ada denda
  if (actual <= deadline) {
    return { jumlahDenda: 0, terlambatJam: 0, terlambatHari: 0, mode: 'tidak_terlambat' };
  }

  const terlambatJam = Math.max(0, Math.floor(getHoursDiff(tanggalSelesai, returnTime)));
  const terlambatHari = getDaysDiff(tanggalSelesai, returnTime);

  let jumlahDenda = 0;
  let mode = '';

  if (jenisIzinNama === 'Izin Keluar') {
    mode = 'per_jam';
    jumlahDenda = terlambatJam * DENDA_CONFIG.per_jam;
  } else {
    // Izin Pulang, Berobat, Keluarga
    mode = 'per_hari';
    jumlahDenda = terlambatHari * DENDA_CONFIG.per_hari;
  }

  // Minimum denda
  if (jumlahDenda > 0 && jumlahDenda < DENDA_CONFIG.per_jam) {
    jumlahDenda = DENDA_CONFIG.per_jam;
  }

  return { jumlahDenda, terlambatJam, terlambatHari, mode };
}

/**
 * Cek apakah izin sudah expired (lewat dari tanggal_selesai)
 */
export function isIzinExpired(tanggalSelesai) {
  return new Date() > new Date(tanggalSelesai);
}

/**
 * Format sisa waktu menjadi string yang mudah dibaca
 * @param {string} tanggalSelesai - ISO date
 * @returns {string} - "2 jam 30 menit" atau "1 hari 5 jam"
 */
export function formatTimeRemaining(tanggalSelesai) {
  const now = new Date();
  const deadline = new Date(tanggalSelesai);
  const diffMs = deadline - now;

  if (diffMs <= 0) {
    const hours = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60));
    const minutes = Math.floor((Math.abs(diffMs) % (1000 * 60 * 60)) / (1000 * 60));
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `Terlambat ${days} hari ${remainingHours} jam`;
    }
    return `Terlambat ${hours} jam ${minutes} menit`;
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days} hari ${remainingHours} jam`;
  }

  return `${hours} jam ${minutes} menit`;
}

export default {
  DENDA_CONFIG,
  JENIS_IZIN_DENDA,
  calculateDenda,
  isIzinExpired,
  formatTimeRemaining,
};
