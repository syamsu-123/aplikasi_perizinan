import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';

// Collection references
const santriCol = collection(db, 'santri');
const izinCol = collection(db, 'izin');
const aksesCol = collection(db, 'akses');
const dendaCol = collection(db, 'denda');
const configCol = collection(db, 'config');
const jenisIzinCol = collection(db, 'jenis_izin');

// Helper to convert Firestore doc to plain object
const toObj = (docSnap) => {
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() };
};

// Santri API - menggunakan Firebase Firestore
export const santriAPI = {
  getAll: async () => {
    const q = query(santriCol, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const data = snap.docs.map(d => toObj(d));
    return { data: { success: true, data } };
  },

  getById: async (id) => {
    const d = await getDoc(doc(db, 'santri', id));
    const data = toObj(d);
    if (!data) throw new Error('Santri tidak ditemukan');
    return { data: { success: true, data } };
  },

  getByNis: async (nis) => {
    const q = query(santriCol, where('nis', '==', nis));
    const snap = await getDocs(q);
    const data = snap.docs.map(d => toObj(d))[0] || null;
    if (!data) throw new Error('Santri tidak ditemukan');
    return { data: { success: true, data } };
  },

  create: async (formData) => {
    const id = crypto.randomUUID();
    const qrCodeData = `SANTRI-${formData.nis}-${id}`;

    await addDoc(santriCol, {
      nama: formData.nama,
      nis: formData.nis,
      kelas: formData.kelas,
      statusBaru: formData.statusBaru || 'lama',
      tanggal_lahir: formData.tanggal_lahir || null,
      alamat: formData.alamat || null,
      no_hp_ortu: formData.no_hp_ortu || null,
      qrCode: qrCodeData,
      statusAktif: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Get the created doc (query by qrCode since addDoc generates random ID)
    const q = query(santriCol, where('qrCode', '==', qrCodeData));
    const snap = await getDocs(q);
    const data = snap.docs.map(d => toObj(d))[0];

    return { data: { success: true, data, message: 'Santri berhasil ditambahkan' } };
  },

  update: async (id, formData) => {
    const d = doc(db, 'santri', id);
    await updateDoc(d, {
      ...formData,
      updatedAt: serverTimestamp()
    });
    return { data: { success: true, message: 'Santri berhasil diupdate' } };
  },

  delete: async (id) => {
    // Check related data
    const izinQ = query(aksesCol, where('santriId', '==', id));
    const izinSnap = await getDocs(izinQ);
    
    const d = doc(db, 'santri', id);
    await deleteDoc(d);
    return { data: { success: true, message: 'Santri berhasil dihapus' } };
  },

  forceDelete: async (id, _confirm) => {
    const batch = writeBatch(db);
    
    // Delete related izin
    const izinQ = query(izinCol, where('santriId', '==', id));
    const izinSnap = await getDocs(izinQ);
    izinSnap.forEach(d => batch.delete(d.ref));
    
    // Delete related akses
    const aksesQ = query(aksesCol, where('santriId', '==', id));
    const aksesSnap = await getDocs(aksesQ);
    aksesSnap.forEach(d => batch.delete(d.ref));
    
    // Delete related denda
    const dendaQ = query(dendaCol, where('santriId', '==', id));
    const dendaSnap = await getDocs(dendaQ);
    dendaSnap.forEach(d => batch.delete(d.ref));
    
    // Delete santri
    batch.delete(doc(db, 'santri', id));
    
    await batch.commit();
    return { data: { success: true, message: 'Santri dan semua data terkait berhasil dihapus' } };
  },

  getQRCode: async (id) => {
    const d = await getDoc(doc(db, 'santri', id));
    const data = toObj(d);
    if (!data) throw new Error('Santri tidak ditemukan');
    return { data: { success: true, data } };
  },
};

// Izin API - menggunakan Firebase Firestore
export const izinAPI = {
  getAll: async (params = {}) => {
    let q = query(izinCol);
    if (params.santri_id) {
      q = query(izinCol, where('santriId', '==', params.santri_id));
    }
    if (params.status) {
      q = query(izinCol, where('status', '==', params.status));
    }
    const snap = await getDocs(q);
    const data = snap.docs.map(d => toObj(d));
    // Sort client-side to avoid composite index
    data.sort((a, b) => {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return bTime - aTime;
    });
    return { data: { success: true, data } };
  },

  getById: async (id) => {
    const d = await getDoc(doc(db, 'izin', id));
    const data = toObj(d);
    if (!data) throw new Error('Izin tidak ditemukan');
    return { data: { success: true, data } };
  },

  create: async (formData) => {
    // Get santri data
    let santriData = null;
    if (formData.santri_id) {
      const santriRef = doc(db, 'santri', formData.santri_id);
      const santriSnap = await getDoc(santriRef);
      if (santriSnap.exists()) {
        santriData = santriSnap.data();
      }
    }

    // Get jenis izin data
    let jenisData = null;
    if (formData.jenis_izin_id) {
      const jenisRef = doc(db, 'jenis_izin', formData.jenis_izin_id);
      const jenisSnap = await getDoc(jenisRef);
      if (jenisSnap.exists()) {
        jenisData = jenisSnap.data();
      }
    }

    // Use tanggal_selesai from form if provided, otherwise calculate from durasi
    let tanggal_selesai = formData.tanggal_selesai || '';
    if (!tanggal_selesai && jenisData?.durasiJam) {
      const tanggal_mulai = formData.tanggal_mulai || new Date().toISOString();
      const mulai = new Date(tanggal_mulai);
      const selesai = new Date(mulai.getTime() + jenisData.durasiJam * 60 * 60 * 1000);
      tanggal_selesai = selesai.toISOString();
      console.log('[izinAPI.create] Auto-calculated tanggal_selesai:', tanggal_selesai, 'from durasi:', jenisData.durasiJam, 'hours');
    }

    console.log('[izinAPI.create] Final tanggal_selesai:', tanggal_selesai, 'from form:', formData.tanggal_selesai);

    const ref = await addDoc(izinCol, {
      santri_id: formData.santri_id,
      santri_nama: santriData?.nama || '',
      santri_nis: santriData?.nis || '',
      santri_kelas: santriData?.kelas || '',
      jenis_izin_id: formData.jenis_izin_id,
      jenis_izin_nama: jenisData?.namaIzin || jenisData?.nama_izin || '',
      dendaMode: jenisData?.dendaMode || 'per_hari',
      alasan: formData.alasan || '',
      tanggal_mulai: formData.tanggal_mulai || new Date().toISOString(),
      tanggal_selesai: tanggal_selesai,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp() // Added missing updatedAt
    });
    
    // Immediately verify what was actually saved
    const verifyDoc = await getDoc(ref, { source: 'server' });
    const verifyData = verifyDoc.data();
    console.log('[izinAPI.create] VERIFY after save - tanggal_selesai:', verifyData.tanggal_selesai, 'status:', verifyData.status);
    
    const snap = await getDoc(ref);
    return { data: { success: true, data: toObj(snap), message: 'Izin berhasil dibuat' } };
  },

  reject: async (id, data) => {
    // Get izin data first to log activity
    const izinDoc = await getDoc(doc(db, 'izin', id));
    if (!izinDoc.exists()) throw new Error('Izin tidak ditemukan');
    const izinData = izinDoc.data();

    const d = doc(db, 'izin', id);
    await updateDoc(d, {
      status: 'rejected',
      rejectedReason: data.rejectedReason || '', // Standardize to camelCase
      updatedAt: serverTimestamp()
    });

    // Log this activity to 'akses' collection
    if (izinData.santri_id) {
      await aksesAPI.record({
        santriId: izinData.santri_id,
        izin_id: id,
        jenisAkses: 'izin_ditolak',
        keterangan: `Izin '${izinData.jenis_izin_nama}' ditolak. Alasan: ${data.reason || '-'}`,
        verified_by: 'system'
      });
    }

    return { data: { success: true, message: 'Izin ditolak' } };
  },

  update: async (id, formData) => {
    const d = doc(db, 'izin', id);
    await updateDoc(d, { ...formData, updatedAt: serverTimestamp() });
    return { data: { success: true, message: 'Izin berhasil diupdate' } };
  },

  delete: async (id) => {
    await deleteDoc(doc(db, 'izin', id));
    return { data: { success: true, message: 'Izin berhasil dihapus' } };
  },

  reset: async () => {
    const snap = await getDocs(izinCol);
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return { data: { success: true, message: 'Semua data izin berhasil direset' } };
  },

  getJenisIzin: async () => {
    try {
      const snap = await getDocs(jenisIzinCol);
      let data = snap.docs.map(d => toObj(d));

      // If empty, seed with default data (with dendaMode)
      if (data.length === 0) {
        const defaultJenis = [
          { namaIzin: 'Izin Keluar', deskripsi: 'Izin keluar pondok', durasiJam: 24, dendaMode: 'per_jam' },
          { namaIzin: 'Izin Pulang', deskripsi: 'Izin pulang ke rumah', durasiJam: 48, dendaMode: 'per_hari' },
          { namaIzin: 'Izin Berobat', deskripsi: 'Izin untuk berobat', durasiJam: 12, dendaMode: 'per_hari' },
          { namaIzin: 'Izin Keluarga', deskripsi: 'Izin keperluan keluarga', durasiJam: 24, dendaMode: 'per_hari' }
        ];
        for (const item of defaultJenis) {
          await addDoc(jenisIzinCol, item);
        }
        // Re-fetch to get proper IDs
        const snapAfter = await getDocs(jenisIzinCol);
        data = snapAfter.docs.map(d => toObj(d));
        console.log('Jenis Izin seeded:', data.length, 'items');
      }

      return { data: { success: true, data } };
    } catch (error) {
      console.error('Error in getJenisIzin:', error);
      // Return empty array on error so UI doesn't break
      return { data: { success: true, data: [] } };
    }
  },

  /**
   * Approve izin - TIDAK mengubah tanggal_selesai (gunakan yang sudah di-set saat create)
   */
  approve: async (id, data) => {
    // Get current data first to log tanggal_selesai
    const izinDoc = await getDoc(doc(db, 'izin', id));
    if (!izinDoc.exists()) throw new Error('Izin tidak ditemukan');
    const currentData = izinDoc.data();
    
    console.log('[approve] BEFORE - tanggal_selesai:', currentData.tanggal_selesai, 'jenis:', currentData.jenis_izin_nama);
    
    const d = doc(db, 'izin', id);
    
    // HANYA update status, JANGAN ubah tanggal_selesai
    await updateDoc(d, {
      status: 'approved',
      approvedBy: data.approvedBy || 'admin',
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // Force fetch from server to verify no change
    const afterDoc = await getDoc(doc(db, 'izin', id), { source: 'server' });
    const afterData = afterDoc.data();
    console.log('[approve] AFTER - tanggal_selesai:', afterData.tanggal_selesai);
    
    if (currentData.tanggal_selesai !== afterData.tanggal_selesai) {
      console.warn('[approve] WARNING: tanggal_selesai CHANGED from', currentData.tanggal_selesai, 'to', afterData.tanggal_selesai);
    } else {
      console.log('[approve] OK - tanggal_selesai TIDAK BERUBAH');
    }
    
    // Log this activity to 'akses' collection
    if (currentData.santri_id) {
      await aksesAPI.record({
        santriId: currentData.santri_id,
        izin_id: id,
        jenisAkses: 'izin_disetujui',
        keterangan: `Izin '${currentData.jenis_izin_nama}' disetujui oleh ${data.approvedBy || 'admin'}`,
        verified_by: data.approvedBy || 'admin'
      });
    }

    return { data: { success: true, message: 'Izin berhasil disetujui' } };
  },

  /**
   * Complete izin (santri sudah kembali)
   * Jika telat, otomatis buat denda
   */
  complete: async (id, actualReturnTime) => {
    const izinDoc = await getDoc(doc(db, 'izin', id));
    if (!izinDoc.exists()) throw new Error('Izin tidak ditemukan');
    const izinData = izinDoc.data();

    console.log('[complete] izinData keys:', Object.keys(izinData));
    console.log('[complete] santri_id:', izinData.santri_id, 'santriId:', izinData.santriId);
    console.log('[complete] santri_nama:', izinData.santri_nama, 'jenis_izin_nama:', izinData.jenis_izin_nama);
    console.log('[complete] tanggal_selesai:', izinData.tanggal_selesai);

    // Support both field naming conventions
    const santriId = izinData.santri_id || izinData.santriId || '';
    const santriNama = izinData.santri_nama || izinData.santriNama || '';
    const santriNis = izinData.santri_nis || izinData.santriNis || '';
    const santriKelas = izinData.santri_kelas || izinData.santriKelas || '';
    const jenisIzinNama = izinData.jenis_izin_nama || izinData.jenisIzin || '';
    const dendaMode = izinData.dendaMode || 'per_hari';
    const tanggalSelesai = izinData.tanggal_selesai || ''; // Standardize to tanggal_selesai

    // Get jenis_izin for info
    const jenisDoc = await getDoc(doc(db, 'jenis_izin', izinData.jenis_izin_id));
    let finalJenisNama = jenisIzinNama;
    let finalDendaMode = dendaMode;
    if (jenisDoc.exists()) {
      const jenisData = jenisDoc.data();
      finalJenisNama = jenisData.namaIzin || jenisData.nama_izin || jenisIzinNama;
      finalDendaMode = jenisData.dendaMode || dendaMode;
    }

    // Ambil konfigurasi denda terbaru
    const configRes = await aksesAPI.getDendaConfig();
    const dendaConfig = configRes.data.data;

    const returnTime = actualReturnTime || new Date().toISOString();
    const deadline = new Date(tanggalSelesai);
    const actual = new Date(returnTime);
    const isLate = actual > deadline;

    console.log('[complete] isLate:', isLate, 'deadline:', tanggalSelesai, 'returnTime:', returnTime);

    // Update izin status
    const d = doc(db, 'izin', id);
    await updateDoc(d, {
      status: 'completed',
      actual_return_time: returnTime,
      completedAt: serverTimestamp(),
      isTerlambat: isLate,
      updatedAt: serverTimestamp()
    });

    // Jika telat, buat denda
    if (isLate) {
      const terlambatMs = actual - deadline;
      const terlambatJam = Math.max(1, Math.floor(terlambatMs / (1000 * 60 * 60)));
      const terlambatHari = Math.ceil(terlambatJam / 24);

      let jumlahDenda = 0;
      // Terapkan rules: Izin Keluar selalu per jam & Rp5.000 (FIXED)
      if (finalJenisNama === 'Izin Keluar' || finalJenisNama.toLowerCase().includes('keluar')) {
        finalDendaMode = 'per_jam';
        jumlahDenda = terlambatJam * 5000;
        if (jumlahDenda < 5000) jumlahDenda = 5000;
      } else {
        // Untuk izin lain (Pulang, Berobat, dll), gunakan konfigurasi global
        finalDendaMode = dendaConfig.denda_mode || finalDendaMode;
        if (finalDendaMode === 'per_jam') {
          jumlahDenda = terlambatJam * (dendaConfig.denda_per_jam || 5000);
        } else {
          jumlahDenda = terlambatHari * (dendaConfig.denda_per_hari || 10000);
        }
        if (jumlahDenda < (dendaConfig.denda_minimum || 5000)) jumlahDenda = dendaConfig.denda_minimum || 5000;
      }

      console.log('[complete] Creating denda:', {
        santriId, santriNama, santriNis, santriKelas, jenisIzin: finalJenisNama,
        dendaMode: finalDendaMode, terlambatJam, terlambatHari, jumlahDenda
      });

      await addDoc(dendaCol, {
        santriId: santriId,
        santriNama: santriNama,
        santriNis: santriNis,
        santriKelas: santriKelas,
        izinId: id,
        jenisIzin: finalJenisNama,
        tanggalMulaiIzin: izinData.tanggal_mulai || '',
        tanggalSelesaiIzin: tanggalSelesai,
        actualReturnTime: returnTime,
        terlambatJam: terlambatJam,
        terlambatHari: terlambatHari,
        dendaMode: finalDendaMode,
        jumlahDenda: jumlahDenda,
        status: 'belum_lunas',
        tanggalDenda: new Date().toISOString(),
        createdAt: serverTimestamp()
      });
      console.log('[complete] Denda berhasil dibuat');
    }

    return { data: { success: true, message: isLate ? 'Izin selesai. Denda dikenakan karena terlambat.' : 'Izin selesai. Tidak ada keterlambatan.' } };
  },

  /**
   * Get semua izin yang approved dan belum expired (santri masih di luar)
   */
  getActiveIzin: async () => {
    const q = query(izinCol, where('status', '==', 'approved'));
    const snap = await getDocs(q);
    const data = snap.docs.map(d => toObj(d));
    const now = new Date();

    // Filter hanya yang belum expired
    const activeIzin = data.filter(izin => {
      if (!izin.tanggal_selesai) return false;
      return new Date(izin.tanggal_selesai) > now;
    });

    return { data: { success: true, data: activeIzin } };
  },

  /**
   * Check dan auto-complete izin yang sudah expired
   */
  checkExpiredIzin: async () => {
    const q = query(izinCol, where('status', '==', 'approved'));
    const snap = await getDocs(q);
    const data = snap.docs.map(d => toObj(d));
    const now = new Date();

    let completedCount = 0;
    let dendaCreated = 0;

    // Ambil konfigurasi denda terbaru
    const configRes = await aksesAPI.getDendaConfig();
    const dendaConfig = configRes.data.data;

    for (const izin of data) {
      if (izin.tanggal_selesai && new Date(izin.tanggal_selesai) <= now) {
        // Support both field naming conventions
        const santriId = izin.santri_id || izin.santriId || '';
        const santriNama = izin.santri_nama || izin.santriNama || '';
        const santriNis = izin.santri_nis || izin.santriNis || '';
        const santriKelas = izin.santri_kelas || izin.santriKelas || '';
        const jenisIzinNama = izin.jenis_izin_nama || izin.jenisIzin || '';
        let dendaMode = izin.dendaMode || 'per_hari';
        const tanggalSelesai = izin.tanggal_selesai || ''; // Standardize to tanggal_selesai
        // Izin sudah expired, mark as completed
        const d = doc(db, 'izin', izin.id);
        await updateDoc(d, {
          status: 'completed',
          autoCompleted: true,
          isTerlambat: true,
          completedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        completedCount++;

        // Calculate fine based on dendaMode
        const terlambatMs = now - new Date(tanggalSelesai); // Use standardized name
        const terlambatJam = Math.max(1, Math.floor(terlambatMs / (1000 * 60 * 60)));
        const terlambatHari = Math.ceil(terlambatJam / 24);
        
        let jumlahDenda = 0;
        // Terapkan rules: Izin Keluar selalu per jam & Rp5.000 (FIXED)
        if (jenisIzinNama === 'Izin Keluar' || jenisIzinNama.toLowerCase().includes('keluar')) {
          dendaMode = 'per_jam';
          jumlahDenda = terlambatJam * 5000;
          if (jumlahDenda < 5000) jumlahDenda = 5000;
        } else {
          // Untuk izin lain (Pulang, Berobat, dll), gunakan konfigurasi global
          dendaMode = dendaConfig.denda_mode || dendaMode;
          if (dendaMode === 'per_jam') {
            jumlahDenda = terlambatJam * (dendaConfig.denda_per_jam || 5000);
          } else {
            jumlahDenda = terlambatHari * (dendaConfig.denda_per_hari || 10000);
          }
          if (jumlahDenda < (dendaConfig.denda_minimum || 5000)) jumlahDenda = dendaConfig.denda_minimum || 5000;
        }
        
        console.log('[checkExpiredIzin] Santri:', santriNama, 'Mode:', dendaMode, 'Terlambat:', terlambatJam, 'jam/', terlambatHari, 'hari', 'Denda: Rp' + jumlahDenda.toLocaleString('id-ID'));

        const dendaData = {
          santriId: santriId,
          santriNama: santriNama,
          santriNis: santriNis,
          santriKelas: santriKelas,
          izinId: izin.id,
          jenisIzin: jenisIzinNama,
          tanggalMulaiIzin: izin.tanggal_mulai || '',
          tanggalSelesaiIzin: tanggalSelesai, // Use standardized name
          actualReturnTime: null,
          terlambatJam: terlambatJam,
          terlambatHari: terlambatHari,
          dendaMode: dendaMode,
          jumlahDenda: jumlahDenda,
          status: 'belum_lunas',
          tanggalDenda: new Date().toISOString(),
          createdAt: serverTimestamp()
        };

        await addDoc(dendaCol, dendaData);
        dendaCreated++;
      }
    }

    return { data: { success: true, completedCount, dendaCreated } };
  },
};

// Akses API - menggunakan Firebase Firestore
export const aksesAPI = {
  getAll: async (params = {}) => {
    // Build query constraints for server-side filtering.
    // NOTE: This may require creating composite indexes in Firebase.
    // Firebase will provide a link in the console error to create it automatically.
    const constraints = [orderBy('waktuAkses', 'desc')];

    if (params.santri_id) {
      constraints.push(where('santriId', '==', params.santri_id));
    }
    if (params.jenis_akses) {
      constraints.push(where('jenisAkses', '==', params.jenis_akses));
    }
    // Apply date range filter on the server for better performance
    if (params.tanggal_dari) {
      // Start of the day
      constraints.push(where('waktuAkses', '>=', params.tanggal_dari + 'T00:00:00.000Z'));
    }
    if (params.tanggal_sampai) {
      // End of the day
      constraints.push(where('waktuAkses', '<=', params.tanggal_sampai + 'T23:59:59.999Z'));
    }

    const q = query(aksesCol, ...constraints);
    const snap = await getDocs(q);
    let data = snap.docs.map(d => toObj(d));

    // If searching by text (not ID), filter the results from the date-filtered query
    if (params.santri_search && !params.santri_id) {
      const searchTerm = params.santri_search.toLowerCase();
      data = data.filter(log =>
        (log.santri_nama || '').toLowerCase().includes(searchTerm) ||
        (log.santri_nis || '').toLowerCase().includes(searchTerm)
      );
    }

    // Enrich with santri name if missing (for old records)
    const santriCache = new Map();
    for (const akses of data) {
      if ((!akses.santri_nama || akses.santri_nama === '') && akses.santriId) {
        if (!santriCache.has(akses.santriId)) {
          try {
            const santriSnap = await getDoc(doc(db, 'santri', akses.santriId));
            if (santriSnap.exists()) {
              santriCache.set(akses.santriId, santriSnap.data());
            }
          } catch (e) { /* ignore */ }
        }
        const cached = santriCache.get(akses.santriId);
        if (cached) {
          akses.santri_nama = cached.nama || '';
          akses.santri_nis = cached.nis || '';
          akses.santri_kelas = cached.kelas || '';
        }
      }
    }

    return { data: { success: true, data } };
  },

  getToday: async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const q = query(aksesCol, where('waktuAkses', '>=', today.toISOString()));
    const snap = await getDocs(q);
    let data = snap.docs.map(d => toObj(d));

    // Sort client-side
    data.sort((a, b) => new Date(b.waktuAkses) - new Date(a.waktuAkses));

    // Enrich with santri name if missing (for old records)
    const santriCache = new Map();
    for (const akses of data) {
      if ((!akses.santri_nama || akses.santri_nama === '') && akses.santriId) {
        if (!santriCache.has(akses.santriId)) {
          try {
            const santriSnap = await getDoc(doc(db, 'santri', akses.santriId));
            if (santriSnap.exists()) {
              santriCache.set(akses.santriId, santriSnap.data());
            }
          } catch (e) {
            // Ignore
          }
        }
        const cached = santriCache.get(akses.santriId);
        if (cached) {
          akses.santri_nama = cached.nama || '';
          akses.santri_nis = cached.nis || '';
          akses.santri_kelas = cached.kelas || '';
        }
      }
    }

    return { data: { success: true, data } };
  },

  record: async (data) => {
    // Get santri data to store name info
    let santriNama = '';
    let santriNis = '';
    let santriKelas = '';
    const targetSantriId = data.santriId || data.santri_id;
    if (targetSantriId) {
      const santriRef = doc(db, 'santri', targetSantriId);
      const santriSnap = await getDoc(santriRef);
      if (santriSnap.exists()) {
        const sd = santriSnap.data();
        santriNama = sd.nama || '';
        santriNis = sd.nis || '';
        santriKelas = sd.kelas || '';
      }
    }

    const ref = await addDoc(aksesCol, {
      ...data,
      santriId: targetSantriId,
      jenisAkses: data.jenisAkses || data.jenis_akses,
      izinId: data.izinId || data.izin_id,
      santri_nama: santriNama,
      santri_nis: santriNis,
      santri_kelas: santriKelas,
      waktuAkses: data.waktuAkses || new Date().toISOString(),
      createdAt: serverTimestamp()
    });
    const snap = await getDoc(ref);
    return { data: { success: true, data: toObj(snap), message: 'Akses berhasil dicatat' } };
  },

  getSantriStatus: async (id) => {
    const santriDoc = await getDoc(doc(db, 'santri', id));
    const santri = toObj(santriDoc);
    if (!santri) throw new Error('Santri tidak ditemukan');
    
    // Get latest akses
    const q = query(aksesCol, where('santriId', '==', id), orderBy('waktuAkses', 'desc'));
    const snap = await getDocs(q);
    const aksesData = snap.docs.map(d => toObj(d))[0] || null;
    
    return { data: { success: true, data: { santri, lastAkses: aksesData } } };
  },

  getStats: async () => {
    // Get santri count
    const santriSnap = await getDocs(santriCol);
    const totalSantri = santriSnap.docs.length;

    // Get akses logs
    const aksesSnap = await getDocs(aksesCol);
    const aksesData = aksesSnap.docs.map(d => toObj(d));
    const today = new Date().toISOString().split('T')[0];
    const todayCount = aksesData.filter(a => a.waktuAkses?.startsWith(today)).length;

    // Get active izin (approved & not expired) - santri yang sedang di luar
    // Use simple query without orderBy to avoid composite index requirement
    const now = new Date();
    const izinQ = query(izinCol, where('status', '==', 'approved'));
    const izinSnap = await getDocs(izinQ);
    const izinData = izinSnap.docs.map(d => toObj(d));
    const activeIzin = izinData.filter(izin => {
      if (!izin.tanggal_selesai) return false;
      return new Date(izin.tanggal_selesai) > now;
    });

    // Get santri details for each active izin
    const outsideSantriWithIzin = [];
    const insideSet = new Set();

    for (const izin of activeIzin) {
      // Support both field naming conventions (snake_case and camelCase)
      const santriId = izin.santri_id || izin.santriId || '';
      const santriNama = izin.santri_nama || izin.santriNama || '-';
      const santriNis = izin.santri_nis || izin.santriNis || '-';
      const santriKelas = izin.santri_kelas || izin.santriKelas || '-';
      const jenisIzinNama = izin.jenis_izin_nama || izin.jenisIzinNama || izin.jenis_izin_nama || 'Izin Keluar';
      const jenisIzinId = izin.jenis_izin_id || izin.jenisIzinId || null;

      // Get santri info from izin data
      const santriInfo = {
        id: santriId,
        nama: santriNama,
        nis: santriNis,
        kelas: santriKelas,
        izin_id: izin.id,
        izin_info: {
          jenis_izin_id: jenisIzinId,
          nama_izin: jenisIzinNama,
          tanggal_mulai: izin.tanggal_mulai,
          tanggal_selesai: izin.tanggal_selesai,
          alasan: izin.alasan || '-',
          sisa_waktu: null
        },
        status_izin: 'dengan_izin',
        last_log: null
      };

      // Calculate remaining time
      if (izin.tanggal_selesai) {
        const sisaMs = new Date(izin.tanggal_selesai) - now;
        if (sisaMs > 0) {
          const sisaJam = Math.floor(sisaMs / (1000 * 60 * 60));
          const sisaMenit = Math.floor((sisaMs % (1000 * 60 * 60)) / (1000 * 60));
          santriInfo.izin_info.sisa_waktu = { jam: sisaJam, menit: sisaMenit, expired: izin.tanggal_selesai };
        }
      }

      outsideSantriWithIzin.push(santriInfo);
      insideSet.add(santriId);
    }

    // Calculate inside count (total - outside)
    const insideCount = Math.max(0, totalSantri - outsideSantriWithIzin.length);

    // Izin pulang (jenis_izin_id == 2 or nama_izin == 'Izin Pulang')
    const izinPulang = outsideSantriWithIzin.filter(s =>
      s.izin_info?.nama_izin === 'Izin Pulang' || s.izin_info?.jenis_izin_id === 2
    );

    // Santri di luar pondok = semua izin KECUALI Izin Pulang
    const outsideSantri = outsideSantriWithIzin.filter(s =>
      s.izin_info?.nama_izin !== 'Izin Pulang' && s.izin_info?.jenis_izin_id !== 2
    );

    return { data: {
      success: true,
      data: {
        total_santri: totalSantri,
        inside_count: insideCount,
        outside_count: outsideSantriWithIzin.length,
        today_logs: todayCount,
        outside_santri: outsideSantri,
        outside_with_izin: outsideSantriWithIzin.length,
        izin_pulang: izinPulang
      }
    }};
  },

  reset: async () => {
    const snap = await getDocs(aksesCol);
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return { data: { success: true, message: 'Semua data akses berhasil direset' } };
  },

  delete: async (id) => {
    await deleteDoc(doc(db, 'akses', id));
    return { data: { success: true, message: 'Data akses berhasil dihapus' } };
  },

  // Denda API
  getDenda: async () => {
    const snap = await getDocs(dendaCol);
    const data = snap.docs.map(d => toObj(d));
    return { data: { success: true, data } };
  },

  createDenda: async (dendaData) => {
    const ref = await addDoc(dendaCol, {
      ...dendaData,
      status: dendaData.status || 'belum_lunas',
      tanggalDenda: dendaData.tanggalDenda || new Date().toISOString(),
      createdAt: serverTimestamp()
    });
    const snap = await getDoc(ref);
    return { data: { success: true, data: toObj(snap), message: 'Denda berhasil ditambahkan' } };
  },

  getDendaStats: async () => {
    const snap = await getDocs(dendaCol);
    const data = snap.docs.map(d => toObj(d));
    return { data: { 
      success: true, 
      data: {
        total_denda: data.length,
        total_nominal: data.reduce((sum, d) => sum + (d.jumlahDenda || 0), 0),
        denda_terlambat: data.filter(d => d.status !== 'lunas').length
      }
    }};
  },

  getDendaConfig: async () => {
    const snap = await getDocs(configCol);
    const configData = {};
    snap.docs.forEach(d => {
      const item = toObj(d);
      configData[item.key] = item.value;
    });
    
    // Default config if empty
    if (Object.keys(configData).length === 0) {
      const defaults = {
        denda_per_hari: 10000,
        denda_per_jam: 5000,
        denda_minimum: 5000,
        denda_mode: 'per_hari'
      };
      for (const [key, value] of Object.entries(defaults)) {
        await addDoc(configCol, { key, value });
      }
      return { data: { success: true, data: defaults } };
    }
    
    return { data: { success: true, data: configData } };
  },

  updateDendaConfig: async (data) => {
    // Delete existing and add new
    const snap = await getDocs(configCol);
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    
    for (const [key, value] of Object.entries(data)) {
      await addDoc(configCol, { key, value });
    }
    return { data: { success: true, data, message: 'Konfigurasi denda berhasil diupdate' } };
  },

  markDendaLunas: async (id) => {
    // Get denda data first to log activity
    const d = doc(db, 'denda', id);
    const dendaDoc = await getDoc(d);
    if (!dendaDoc.exists()) throw new Error('Denda tidak ditemukan');
    const dendaData = dendaDoc.data();

    await updateDoc(d, {
      status: 'lunas',
      tanggalBayar: new Date().toISOString(),
      updatedAt: serverTimestamp()
    });

    // Log this activity to 'akses' collection
    if (dendaData.santriId) {
      await aksesAPI.record({
        santriId: dendaData.santriId,
        izin_id: dendaData.izinId || null,
        jenisAkses: 'denda_lunas',
        keterangan: `Denda ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(dendaData.jumlahDenda || 0)} untuk izin '${dendaData.jenisIzin}' telah lunas.`,
        verified_by: 'system'
      });
    }

    return { data: { success: true, message: 'Denda berhasil ditandai sebagai lunas' } };
  },

  resetDenda: async () => {
    const snap = await getDocs(dendaCol);
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return { data: { success: true, message: 'Semua data denda berhasil direset' } };
  },
};

export default { santriAPI, izinAPI, aksesAPI };
