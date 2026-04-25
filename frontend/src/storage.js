// Local Storage Manager - Pengganti API untuk mode standalone

const STORAGE_KEYS = {
  santri: 'perizinan_santri',
  izin: 'perizinan_izin',
  jenisIzin: 'perizinan_jenis_izin',
  akses: 'perizinan_akses',
  denda: 'perizinan_denda',
  dendaConfig: 'perizinan_denda_config',
  // Note: This storage.js is a local fallback. Its logic (e.g., denda calculation, jenisIzin IDs) is currently independent and may not fully align with the Firebase API. If intended as a functional fallback, its logic should be updated to mirror api.js more closely.
};

// Helper functions
const getStorage = (key) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Error reading from localStorage:', e);
    return [];
  }
};

const setStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Error writing to localStorage:', e);
  }
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// Initial data
const defaultJenisIzin = [
  { id: '1', nama_izin: 'Izin Keluar', keterangan: 'Izin keluar pondok' },
  { id: '2', nama_izin: 'Izin Pulang', keterangan: 'Izin pulang ke rumah' },
];

const defaultDendaConfig = {
  denda_per_hari: 10000,
  denda_per_jam: 5000,
  denda_minimum: 5000,
  denda_mode: 'per_hari'
};

// Initialize storage with defaults
export const initStorage = () => {
  if (!localStorage.getItem(STORAGE_KEYS.jenisIzin)) {
    setStorage(STORAGE_KEYS.jenisIzin, defaultJenisIzin);
  }
  if (!localStorage.getItem(STORAGE_KEYS.dendaConfig)) {
    setStorage(STORAGE_KEYS.dendaConfig, defaultDendaConfig);
  }
  if (!localStorage.getItem(STORAGE_KEYS.santri)) {
    setStorage(STORAGE_KEYS.santri, []);
  }
  if (!localStorage.getItem(STORAGE_KEYS.izin)) {
    setStorage(STORAGE_KEYS.izin, []);
  }
  if (!localStorage.getItem(STORAGE_KEYS.akses)) {
    setStorage(STORAGE_KEYS.akses, []);
  }
  if (!localStorage.getItem(STORAGE_KEYS.denda)) {
    setStorage(STORAGE_KEYS.denda, []);
  }
  
  // Auto-complete izin yang expired setiap init
  autoCompleteExpiredInternal();
};

// Santri Storage
export const santriStorage = {
  getAll: () => getStorage(STORAGE_KEYS.santri),
  getById: (id) => getStorage(STORAGE_KEYS.santri).find(s => s.id === id),
  getByNis: (nis) => getStorage(STORAGE_KEYS.santri).find(s => s.nis === nis),
  create: (data) => {
    const santri = [...getStorage(STORAGE_KEYS.santri)];
    const newSantri = {
      ...data,
      id: generateId(),
      status_aktif: data.status_aktif !== undefined ? data.status_aktif : 1,
      created_at: new Date().toISOString()
    };
    santri.push(newSantri);
    setStorage(STORAGE_KEYS.santri, santri);
    return newSantri;
  },
  update: (id, data) => {
    const santri = [...getStorage(STORAGE_KEYS.santri)];
    const index = santri.findIndex(s => s.id === id);
    if (index === -1) return null;
    santri[index] = { ...santri[index], ...data, updated_at: new Date().toISOString() };
    setStorage(STORAGE_KEYS.santri, santri);
    return santri[index];
  },
  delete: (id) => {
    const santri = getStorage(STORAGE_KEYS.santri).filter(s => s.id !== id);
    setStorage(STORAGE_KEYS.santri, santri);
  },
  forceDelete: () => {
    setStorage(STORAGE_KEYS.santri, []);
  },
};

// Auto-complete izin yang sudah lewat waktu selesai
const autoCompleteExpiredInternal = () => {
  const izin = getStorage(STORAGE_KEYS.izin);
  const now = new Date();
  let changed = false;
  
  izin.forEach(i => {
    // Jika approved dan belum selesai
    if (i.status === 'approved' && !i.waktu_kembali) {
      const selesai = new Date(i.tanggal_selesai);
      // Jika sudah lewat waktu selesai
      if (now > selesai) {
        const config = dendaStorage.getConfig();
        const santri = santriStorage.getById(i.santri_id);
        const jenisList = getStorage(STORAGE_KEYS.jenisIzin);
        const jenis = jenisList.find(j => j.id === i.jenis_izin_id);
        
        // Hitung keterlambatan
        const selisihMs = now - selesai;
        const selisihJam = selisihMs / (1000 * 60 * 60);
        const selisihHari = selisihJam / 24;

        let jumlahDenda = 0;
        let keteranganDenda = '';

        // Jika ada keterlambatan, hitung denda berdasarkan jenis izin
        if (selisihJam > 0) {
          // Izin Keluar (id=1) -> per_jam, Izin Pulang (id=2) -> per_hari
          const jenisIzinId = i.jenis_izin_id;
          let modeDenda;

          if (jenisIzinId === '1' || jenisIzinId === 1) {
            // Izin Keluar: pakai denda per jam
            modeDenda = 'per_jam';
            jumlahDenda = Math.max(
              config.denda_minimum,
              Math.ceil(selisihJam) * config.denda_per_jam
            );
            keteranganDenda = `Terlambat ${Math.ceil(selisihJam)} jam (denda per jam)`;
          } else {
            // Izin Pulang dan lainnya: pakai denda per hari
            modeDenda = 'per_hari';
            jumlahDenda = Math.max(
              config.denda_minimum,
              Math.ceil(selisihHari) * config.denda_per_hari
            );
            keteranganDenda = `Terlambat ${Math.ceil(selisihHari)} hari (denda per hari)`;
          }
          
          // Buat denda record
          const denda = getStorage(STORAGE_KEYS.denda);
          denda.push({
            id: generateId(),
            santri_id: i.santri_id,
            santri_nama: santri ? santri.nama : 'Unknown',
            santri_nis: santri ? santri.nis : '-',
            santri_kelas: santri ? santri.kelas : '-',
            izin_id: i.id,
            jenis_izin_nama: jenis ? (jenis.nama_izin || 'Unknown') : 'Unknown',
            hari_terlambat: Math.ceil(selisihHari),
            jam_terlambat: Math.ceil(selisihJam),
            jumlah_denda: jumlahDenda,
            status: 'belum_lunas',
            keterangan: keteranganDenda,
            created_at: now.toISOString()
          });
          setStorage(STORAGE_KEYS.denda, denda);
        }
        
        // Update status izin jadi completed
        i.status = 'completed';
        i.waktu_kembali = now.toISOString();
        i.keterangan_selesai = jumlahDenda > 0 
          ? `Selesai dengan denda: ${keteranganDenda}`
          : 'Selesai tepat waktu';
        i.updated_at = now.toISOString();
        changed = true;
      }
    }
  });
  
  if (changed) {
    setStorage(STORAGE_KEYS.izin, izin);
  }
  
  return changed;
};

// Izin Storage
export const izinStorage = {
  getAll: (params = {}) => {
    // Auto-complete dulu sebelum ambil data
    autoCompleteExpiredInternal();
    
    let izin = getStorage(STORAGE_KEYS.izin);
    if (params.status) {
      izin = izin.filter(i => i.status === params.status);
    }
    if (params.santri_id) {
      izin = izin.filter(i => i.santri_id === params.santri_id);
    }
    
    // Enrich dengan data santri dan jenis_izin
    return izin.map(i => {
      const santri = santriStorage.getById(i.santri_id);
      const jenisList = getStorage(STORAGE_KEYS.jenisIzin);
      const jenis = jenisList.find(j => j.id === i.jenis_izin_id);
      return {
        ...i,
        santri_nama: santri ? santri.nama : 'Unknown',
        santri_nis: santri ? santri.nis : '-',
        santri_kelas: santri ? santri.kelas : '-',
        jenis_izin_nama: jenis ? (jenis.nama_izin || 'Unknown') : (i.jenis_izin_nama || 'Unknown')
      };
    }).sort((a, b) => new Date(b.created_at || b.tanggal_mulai) - new Date(a.created_at || a.tanggal_mulai));
  },
  getById: (id) => {
    const izin = getStorage(STORAGE_KEYS.izin).find(i => i.id === id);
    if (!izin) return null;
    const santri = santriStorage.getById(izin.santri_id);
    const jenisList = getStorage(STORAGE_KEYS.jenisIzin);
    const jenis = jenisList.find(j => j.id === izin.jenis_izin_id);
    return {
      ...izin,
      santri_nama: santri ? santri.nama : 'Unknown',
      santri_nis: santri ? santri.nis : '-',
      santri_kelas: santri ? santri.kelas : '-',
      jenis_izin_nama: jenis ? (jenis.nama_izin || 'Unknown') : (izin.jenis_izin_nama || 'Unknown')
    };
  },
  create: (data) => {
    const izin = [...getStorage(STORAGE_KEYS.izin)];
    const santri = santriStorage.getById(data.santri_id);
    const jenisList = getStorage(STORAGE_KEYS.jenisIzin);
    const jenis = jenisList.find(j => j.id === data.jenis_izin_id);
    
    const newIzin = {
      ...data,
      id: generateId(),
      status: 'pending',
      santri_nama: santri ? santri.nama : 'Unknown',
      santri_nis: santri ? santri.nis : '-',
      santri_kelas: santri ? santri.kelas : '-',
      jenis_izin_nama: jenis ? (jenis.nama_izin || 'Unknown') : (data.jenis_izin_nama || 'Unknown'),
      created_at: new Date().toISOString()
    };
    izin.push(newIzin);
    setStorage(STORAGE_KEYS.izin, izin);
    return newIzin;
  },
  approve: (id, data) => {
    const izin = [...getStorage(STORAGE_KEYS.izin)];
    const index = izin.findIndex(i => i.id === id);
    if (index === -1) return null;
    
    const santri = santriStorage.getById(izin[index].santri_id);
    const jenisList = getStorage(STORAGE_KEYS.jenisIzin);
    const jenis = jenisList.find(j => j.id === izin[index].jenis_izin_id);
    
    izin[index] = {
      ...izin[index],
      ...data,
      status: 'approved',
      santri_nama: santri ? santri.nama : izin[index].santri_nama || 'Unknown',
      santri_nis: santri ? santri.nis : izin[index].santri_nis || '-',
      santri_kelas: santri ? santri.kelas : izin[index].santri_kelas || '-',
      jenis_izin_nama: jenis ? (jenis.nama_izin || 'Unknown') : izin[index].jenis_izin_nama || 'Unknown',
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setStorage(STORAGE_KEYS.izin, izin);
    return izin[index];
  },
  reject: (id, data) => {
    const izin = [...getStorage(STORAGE_KEYS.izin)];
    const index = izin.findIndex(i => i.id === id);
    if (index === -1) return null;
    
    const santri = santriStorage.getById(izin[index].santri_id);
    const jenisList = getStorage(STORAGE_KEYS.jenisIzin);
    const jenis = jenisList.find(j => j.id === izin[index].jenis_izin_id);
    
    izin[index] = {
      ...izin[index],
      ...data,
      status: 'rejected',
      santri_nama: santri ? santri.nama : izin[index].santri_nama || 'Unknown',
      santri_nis: santri ? santri.nis : izin[index].santri_nis || '-',
      santri_kelas: santri ? santri.kelas : izin[index].santri_kelas || '-',
      jenis_izin_nama: jenis ? (jenis.nama_izin || 'Unknown') : izin[index].jenis_izin_nama || 'Unknown',
      rejected_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setStorage(STORAGE_KEYS.izin, izin);
    return izin[index];
  },
  update: (id, data) => {
    const izin = [...getStorage(STORAGE_KEYS.izin)];
    const index = izin.findIndex(i => i.id === id);
    if (index === -1) return null;
    
    const santri = data.santri_id ? santriStorage.getById(data.santri_id) : santriStorage.getById(izin[index].santri_id);
    const jenisId = data.jenis_izin_id || izin[index].jenis_izin_id;
    const jenisList = getStorage(STORAGE_KEYS.jenisIzin);
    const jenis = jenisList.find(j => j.id === jenisId);
    
    izin[index] = {
      ...izin[index],
      ...data,
      santri_nama: santri ? santri.nama : izin[index].santri_nama || 'Unknown',
      santri_nis: santri ? santri.nis : izin[index].santri_nis || '-',
      santri_kelas: santri ? santri.kelas : izin[index].santri_kelas || '-',
      jenis_izin_nama: jenis ? (jenis.nama_izin || 'Unknown') : izin[index].jenis_izin_nama || 'Unknown',
      updated_at: new Date().toISOString()
    };
    setStorage(STORAGE_KEYS.izin, izin);
    return izin[index];
  },
  delete: (id) => {
    const izin = getStorage(STORAGE_KEYS.izin).filter(i => i.id !== id);
    setStorage(STORAGE_KEYS.izin, izin);
  },
  reset: () => {
    setStorage(STORAGE_KEYS.izin, []);
  },
  getJenisIzin: () => getStorage(STORAGE_KEYS.jenisIzin),
  
  // Auto-complete izin yang sudah lewat waktu selesai
  autoCompleteExpired: () => {
    return autoCompleteExpiredInternal();
  },
};

// Akses Storage
export const aksesStorage = {
  getAll: (params = {}) => {
    let akses = getStorage(STORAGE_KEYS.akses);
    
    if (params.santri_id) {
      akses = akses.filter(a => a.santri_id === params.santri_id);
    }
    if (params.jenis_akses) {
      akses = akses.filter(a => (a.tipe || a.jenis_akses) === params.jenis_akses);
    }
    if (params.tanggal_dari) {
      akses = akses.filter(a => a.waktu && a.waktu >= params.tanggal_dari);
    }
    if (params.tanggal_sampai) {
      const endOfDay = params.tanggal_sampai + 'T23:59:59.999Z';
      akses = akses.filter(a => a.waktu && a.waktu <= endOfDay);
    }
    
    // Enrich dengan data santri
    return akses.map(a => {
      const santri = santriStorage.getById(a.santri_id);
      return {
        ...a,
        santri_nama: santri ? santri.nama : 'Unknown',
        santri_nis: santri ? santri.nis : '-',
        santri_kelas: santri ? santri.kelas : '-'
      };
    }).sort((a, b) => new Date(b.waktu) - new Date(a.waktu));
  },
  getToday: () => {
    const today = new Date().toISOString().split('T')[0];
    return getStorage(STORAGE_KEYS.akses)
      .filter(a => a.waktu && a.waktu.startsWith(today))
      .map(a => {
        const santri = santriStorage.getById(a.santri_id);
        return {
          ...a,
          santri_nama: santri ? santri.nama : 'Unknown',
          santri_nis: santri ? santri.nis : '-',
          santri_kelas: santri ? santri.kelas : '-'
        };
      })
      .sort((a, b) => new Date(b.waktu) - new Date(a.waktu));
  },
  record: (data) => {
    const akses = [...getStorage(STORAGE_KEYS.akses)];
    const santri = santriStorage.getById(data.santri_id);
    
    const newAkses = {
      ...data,
      id: generateId(),
      waktu: new Date().toISOString(),
      santri_nama: santri ? santri.nama : 'Unknown',
      santri_nis: santri ? santri.nis : '-',
      santri_kelas: santri ? santri.kelas : '-'
    };
    akses.push(newAkses);
    setStorage(STORAGE_KEYS.akses, akses);

    // Calculate denda if terlambat
    calculateDenda(newAkses);

    return newAkses;
  },
  getSantriStatus: (santri_id) => {
    const santri = santriStorage.getById(santri_id);
    if (!santri) return null;

    const akses = getStorage(STORAGE_KEYS.akses);
    const lastAkses = akses
      .filter(a => a.santri_id === santri_id)
      .sort((a, b) => new Date(b.waktu) - new Date(a.waktu))[0];

    // Normalize tipe/jenis_akses
    const tipeAkses = lastAkses ? (lastAkses.tipe || lastAkses.jenis_akses) : null;
    
    // Status: 'inside' = di dalam pondok, 'outside' = di luar pondok
    let status;
    if (!tipeAkses) {
      status = 'outside'; // Belum ada akses = di luar pondok
    } else if (tipeAkses === 'keluar') {
      status = 'outside'; // Terakhir keluar = sedang di luar pondok
    } else {
      status = 'inside'; // Terakhir masuk = sudah kembali ke pondok
    }

    return {
      santri,
      last_akses: lastAkses || null,
      status: status,
      tipe: tipeAkses || 'di_pondok'
    };
  },
  getStats: () => {
    const akses = getStorage(STORAGE_KEYS.akses);
    const santri = getStorage(STORAGE_KEYS.santri);
    const today = new Date().toISOString().split('T')[0];
    const todayAkses = akses.filter(a => a.waktu && a.waktu.startsWith(today));
    
    // Hitung santri yang sedang di luar (terakhir akses = keluar)
    const santriStatusMap = {};
    santri.forEach(s => {
      const lastAkses = akses
        .filter(a => a.santri_id === s.id)
        .sort((a, b) => new Date(b.waktu) - new Date(a.waktu))[0];
      const tipeAkses = lastAkses ? (lastAkses.tipe || lastAkses.jenis_akses) : null;
      santriStatusMap[s.id] = tipeAkses;
    });
    
    const outsideCount = Object.values(santriStatusMap).filter(t => t === 'keluar').length;
    const insideCount = santri.length - outsideCount;
    
    // Build outside_santri dengan izin_info dan last_log
    const outsideSantri = santri
      .filter(s => santriStatusMap[s.id] === 'keluar')
      .map(s => {
        const lastAkses = akses
          .filter(a => a.santri_id === s.id)
          .sort((a, b) => new Date(b.waktu) - new Date(a.waktu))[0];
        
        // Cari izin aktif
        const izin = getStorage(STORAGE_KEYS.izin)
          .filter(i => i.santri_id === s.id && i.status === 'approved' && !i.waktu_kembali)
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
        
        const jenisList = getStorage(STORAGE_KEYS.jenisIzin);
        const jenis = izin ? jenisList.find(j => j.id === izin.jenis_izin_id) : null;
        
        return {
          id: s.id,
          santri_id: s.id,
          santri_nama: s.nama,
          santri_nis: s.nis,
          santri_kelas: s.kelas,
          status_izin: izin ? 'approved' : null,
          izin_info: izin ? {
            id: izin.id,
            jenis_izin_id: izin.jenis_izin_id,
            nama_izin: jenis ? jenis.nama_izin : 'Unknown',
            alasan: izin.alasan || '-',
            tanggal_mulai: izin.tanggal_mulai,
            tanggal_selesai: izin.tanggal_selesai
          } : null,
          last_log: lastAkses ? {
            id: lastAkses.id,
            waktu_akses: lastAkses.waktu,
            jenis_akses: lastAkses.tipe || lastAkses.jenis_akses,
            keterangan: lastAkses.keterangan || '-'
          } : null
        };
      });
    
    return {
      total_santri: santri.length,
      inside_count: insideCount,
      outside_count: outsideCount,
      total_today: todayAkses.length,
      keluar_today: todayAkses.filter(a => (a.tipe || a.jenis_akses) === 'keluar').length,
      masuk_today: todayAkses.filter(a => (a.tipe || a.jenis_akses) === 'masuk').length,
      total_akses: akses.length,
      outside_santri: outsideSantri,
      outside_with_izin: outsideSantri.filter(s => s.izin_info).length,
      izin_pulang: outsideSantri.filter(s => s.izin_info && s.izin_info.nama_izin && s.izin_info.nama_izin.includes('Pulang')),
      today_logs: todayAkses.length
    };
  },
  reset: () => {
    setStorage(STORAGE_KEYS.akses, []);
  },
  delete: (id) => {
    const akses = getStorage(STORAGE_KEYS.akses).filter(a => a.id !== id);
    setStorage(STORAGE_KEYS.akses, akses);
  },
};

// Denda Storage
export const dendaStorage = {
  getAll: () => {
    return getStorage(STORAGE_KEYS.denda).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },
  getById: (id) => getStorage(STORAGE_KEYS.denda).find(d => d.id === id),
  create: (data) => {
    const denda = [...getStorage(STORAGE_KEYS.denda)];
    const newDenda = {
      ...data,
      id: generateId(),
      status: 'belum_lunas',
      created_at: new Date().toISOString()
    };
    denda.push(newDenda);
    setStorage(STORAGE_KEYS.denda, denda);
    return newDenda;
  },
  markLunas: (id) => {
    const denda = [...getStorage(STORAGE_KEYS.denda)];
    const index = denda.findIndex(d => d.id === id);
    if (index === -1) return null;
    denda[index] = {
      ...denda[index],
      status: 'lunas',
      lunas_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setStorage(STORAGE_KEYS.denda, denda);
    return denda[index];
  },
  reset: () => {
    setStorage(STORAGE_KEYS.denda, []);
  },
  getStats: () => {
    const denda = getStorage(STORAGE_KEYS.denda);
    return {
      total_denda: denda.length,
      total_nominal: denda.reduce((sum, d) => sum + (d.jumlah_denda || 0), 0),
      denda_terlambat: denda.filter(d => d.status !== 'lunas').length
    };
  },
  getConfig: () => getStorage(STORAGE_KEYS.dendaConfig),
  updateConfig: (data) => {
    setStorage(STORAGE_KEYS.dendaConfig, { ...getStorage(STORAGE_KEYS.dendaConfig), ...data });
    return getStorage(STORAGE_KEYS.dendaConfig);
  },
};

// Calculate denda otomatis saat akses dicatat
const calculateDenda = (aksesData) => {
  const tipeAkses = aksesData.tipe || aksesData.jenis_akses;
  if (tipeAkses !== 'masuk') return;

  const config = dendaStorage.getConfig();
  const santri = santriStorage.getById(aksesData.santri_id);
  if (!santri) return;

  // Cari izin yang belum selesai
  const izinList = izinStorage.getAll({ santri_id: aksesData.santri_id, status: 'approved' });
  const activeIzin = izinList.find(i => !i.waktu_kembali);

  if (!activeIzin) return;

  // Update izin dengan waktu kembali
  izinStorage.update(activeIzin.id, { waktu_kembali: aksesData.waktu });

  // Hitung keterlambatan - PAKAI tanggal_selesai BUKAN waktu_kembali_rencana
  const waktuKembaliRencana = new Date(activeIzin.tanggal_selesai);
  const waktuKembaliAktual = new Date(aksesData.waktu);
  const selisihMs = waktuKembaliAktual - waktuKembaliRencana;
  const selisihJam = selisihMs / (1000 * 60 * 60);
  const selisihHari = selisihJam / 24;

  if (selisihJam > 0) {
    // Tentukan mode denda berdasarkan jenis izin
    // Izin Keluar (id=1) -> per_jam, Izin Pulang (id=2) -> per_hari
    const jenisIzinId = activeIzin.jenis_izin_id;
    let jumlahDenda;
    let modeDenda;
    let satuanTerlambat;

    if (jenisIzinId === '1' || jenisIzinId === 1) {
      // Izin Keluar: pakai denda per jam
      modeDenda = 'per_jam';
      jumlahDenda = Math.max(
        config.denda_minimum,
        Math.ceil(selisihJam) * config.denda_per_jam
      );
      satuanTerlambat = Math.ceil(selisihJam) + ' jam';
    } else {
      // Izin Pulang dan lainnya: pakai denda per hari
      modeDenda = 'per_hari';
      jumlahDenda = Math.max(
        config.denda_minimum,
        Math.ceil(selisihHari) * config.denda_per_hari
      );
      satuanTerlambat = Math.ceil(selisihHari) + ' hari';
    }

    dendaStorage.create({
      santri_id: aksesData.santri_id,
      santri_nama: santri.nama,
      santri_nis: santri.nis,
      santri_kelas: santri.kelas,
      izin_id: activeIzin.id,
      jenis_izin_nama: activeIzin.jenis_izin_nama || 'Izin',
      hari_terlambat: Math.ceil(selisihHari),
      jam_terlambat: Math.ceil(selisihJam),
      jumlah_denda: jumlahDenda,
      status: 'belum_lunas',
      keterangan: `Terlambat ${satuanTerlambat} (${modeDenda === 'per_jam' ? 'denda per jam' : 'denda per hari'})`
    });
  }
};

export default {
  initStorage,
  santriStorage,
  izinStorage,
  aksesStorage,
  dendaStorage
};
