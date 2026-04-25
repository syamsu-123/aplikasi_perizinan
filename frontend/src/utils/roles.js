/**
 * Memeriksa apakah user saat ini adalah admin
 * @param {Object} user - Objek user dari Firebase
 * @returns {boolean} - True jika user adalah admin
 */
export const isAdmin = (user) => {
  return user?.email === 'adminizin@gmail.com';
};

/**
 * Memeriksa apakah user memiliki akses ke fitur tertentu
 * @param {Object} user - Objek user dari Firebase
 * @param {string} feature - Nama fitur ('reports', 'debug', 'management', dll)
 * @returns {boolean} - True jika user memiliki akses
 */
export const hasFeatureAccess = (user, feature) => {
  // Admin memiliki akses ke semua fitur
  if (isAdmin(user)) return true;
  
  // User biasa tidak dapat mengakses:
  // - Halaman Laporan (reports)
  // - Panel Debug (debug)
  // - Fitur Manajemen (management)
  const restrictedFeatures = ['reports', 'debug', 'santri-management', 'izin-management', 'denda-management'];
  
  return !restrictedFeatures.includes(feature);
};
