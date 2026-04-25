const express = require('express');
const router = express.Router();
const db = require('../database/init');
const moment = require('moment');

// Helper function to get config value
const getConfig = (key, defaultValue) => {
  try {
    const config = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
    return config ? parseInt(config.value) : defaultValue;
  } catch (error) {
    return defaultValue;
  }
};

// Helper function to calculate fine
const calculateFine = (jenis_izin_id, tanggal_selesai, tanggal_kembali) => {
  const selesai = moment(tanggal_selesai);
  const kembali = moment(tanggal_kembali);

  if (!kembali.isAfter(selesai)) {
    return { hari_terlambat: 0, jam_terlambat: 0, jumlah_denda: 0, mode: 'tidak_terlambat' };
  }

  const diffHours = kembali.diff(selesai, 'hours', true);
  const diffDays = Math.ceil(diffHours / 24);
  
  // Izin Keluar (jenis_izin_id = 1) - Denda FIXED Rp 5.000/jam (tidak bisa diubah)
  // Jenis izin lain - Denda berdasarkan config yang bisa diatur admin
  let jumlahDenda, jamTerlambat, dendaMode;

  if (jenis_izin_id === 1) {
    // Izin Keluar: Fixed Rp 5.000/jam
    dendaMode = 'per_jam';
    const dendaPerJamIzinKeluar = 5000; // HARDCODE - tidak bisa diubah
    jamTerlambat = Math.ceil(diffHours);
    jumlahDenda = Math.max(jamTerlambat * dendaPerJamIzinKeluar, 5000);
  } else {
    // Izin lain (Pulang, Berobat, Keluarga): Pakai config
    dendaMode = getConfig('denda_mode', 'per_hari');
    
    if (dendaMode === 'per_jam') {
      const dendaPerJam = getConfig('denda_per_jam', 5000);
      jamTerlambat = Math.ceil(diffHours);
      jumlahDenda = Math.max(jamTerlambat * dendaPerJam, getConfig('denda_minimum', 5000));
    } else {
      // per_hari mode
      const dendaPerHari = getConfig('denda_per_hari', 10000);
      jamTerlambat = Math.ceil(diffHours);
      jumlahDenda = Math.max(diffDays * dendaPerHari, getConfig('denda_minimum', 5000));
    }
  }

  return {
    hari_terlambat: diffDays,
    jam_terlambat: jamTerlambat,
    jumlah_denda: jumlahDenda,
    mode: dendaMode
  };
};

// Helper function to auto-process expired izin
const processExpiredIzin = () => {
  try {
    const now = moment().toISOString();
    
    // Get all approved izin that have passed their end time
    const expiredIzin = db.prepare(`
      SELECT i.*, j.nama_izin
      FROM izin i
      JOIN jenis_izin j ON i.jenis_izin_id = j.id
      WHERE i.status = 'approved'
        AND i.tanggal_selesai <= ?
    `).all(now);
    
    let processed = 0;

    for (const izin of expiredIzin) {
      const selesai = moment(izin.tanggal_selesai);
      const sekarang = moment();
      const { hari_terlambat, jam_terlambat, jumlah_denda, mode } = calculateFine(izin.jenis_izin_id, izin.tanggal_selesai, sekarang.toISOString());
      
      // Update izin status to completed
      db.prepare(`
        UPDATE izin 
        SET status = 'completed', tanggal_kembali = ?
        WHERE id = ?
      `).run(sekarang.toISOString(), izin.id);
      
      // Create denda record if late
      if (jumlah_denda > 0) {
        const jenisIzinLabel = izin.jenis_izin_id === 1 ? 'Izin Keluar (FIXED Rp5.000/jam)' : `Izin Lain (${mode})`;
        db.prepare(`
          INSERT INTO denda (izin_id, santri_id, jumlah_denda, hari_terlambat, jam_terlambat, tanggal_kembali, keterangan, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'belum_lunas')
        `).run(
          izin.id,
          izin.santri_id,
          jumlah_denda,
          hari_terlambat,
          jam_terlambat,
          sekarang.toISOString(),
          `${jenisIzinLabel} - Terlambat ${hari_terlambat > 0 ? hari_terlambat + ' hari' : jam_terlambat + ' jam'} dari jadwal selesai ${selesai.format('DD/MM/YYYY HH:mm')}`
        );
        
        console.log(`[AUTO] Denda created: Rp ${jumlah_denda} for santri ${izin.santri_id} (${hari_terlambat} hari, ${jam_terlambat} jam late)`);
      } else {
        console.log(`[AUTO] Izin completed on time for santri ${izin.santri_id}`);
      }
      
      processed++;
    }
    
    if (processed > 0) {
      console.log(`[AUTO] Processed ${processed} expired izin`);
    }
    
    return processed;
  } catch (error) {
    console.error('[AUTO] Error processing expired izin:', error);
    return 0;
  }
};

// Get all akses logs
router.get('/', (req, res) => {
  try {
    const { santri_id, jenis_akses, tanggal, tanggal_dari, tanggal_sampai } = req.query;

    let query = `
      SELECT
        a.*,
        s.nama as santri_nama,
        s.nis as santri_nis,
        s.kelas as santri_kelas,
        i.alasan as izin_alasan,
        i.status as izin_status,
        j.nama_izin as jenis_izin_nama
      FROM akses_log a
      JOIN santri s ON a.santri_id = s.id
      LEFT JOIN izin i ON a.izin_id = i.id
      LEFT JOIN jenis_izin j ON i.jenis_izin_id = j.id
      WHERE 1=1
    `;

    const params = [];

    if (santri_id) {
      query += ' AND a.santri_id = ?';
      params.push(santri_id);
    }

    if (jenis_akses) {
      query += ' AND a.jenis_akses = ?';
      params.push(jenis_akses);
    }

    // Support date range filtering
    if (tanggal_dari && tanggal_sampai) {
      query += ' AND DATE(a.waktu_akses) BETWEEN ? AND ?';
      params.push(tanggal_dari, tanggal_sampai);
    } else if (tanggal_dari) {
      query += ' AND DATE(a.waktu_akses) >= ?';
      params.push(tanggal_dari);
    } else if (tanggal_sampai) {
      query += ' AND DATE(a.waktu_akses) <= ?';
      params.push(tanggal_sampai);
    } else if (tanggal) {
      // Backward compatibility for single date filter
      query += ' AND DATE(a.waktu_akses) = ?';
      params.push(tanggal);
    }

    query += ' ORDER BY a.waktu_akses DESC';

    const logs = db.prepare(query).all(...params);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get logs for today
router.get('/today', (req, res) => {
  try {
    const query = `
      SELECT 
        a.*,
        s.nama as santri_nama,
        s.nis as santri_nis,
        s.kelas as santri_kelas
      FROM akses_log a
      JOIN santri s ON a.santri_id = s.id
      WHERE DATE(a.waktu_akses) = DATE('now')
      ORDER BY a.waktu_akses DESC
    `;
    
    const logs = db.prepare(query).all();
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Record akses (check-in/check-out)
router.post('/', (req, res) => {
  try {
    const { santri_id, izin_id, jenis_akses, keterangan, verified_by } = req.body;

    // Validate jenis_akses
    if (!['check_in', 'check_out', 'keluar', 'masuk'].includes(jenis_akses)) {
      return res.status(400).json({ success: false, message: 'Jenis akses tidak valid' });
    }

    // Check if santri exists
    const santri = db.prepare('SELECT * FROM santri WHERE id = ?').get(santri_id);
    if (!santri) {
      return res.status(404).json({ success: false, message: 'Santri tidak ditemukan' });
    }

    // Check if santri has active izin if required
    let activeIzin = null;
    if (izin_id) {
      activeIzin = db.prepare(`
        SELECT * FROM izin
        WHERE id = ? AND santri_id = ? AND status = 'approved'
      `).get(izin_id, santri_id);

      if (!activeIzin) {
        return res.status(400).json({
          success: false,
          message: 'Izin tidak ditemukan atau belum disetujui'
        });
      }
    }

    // If santri is coming back (masuk/check_in), update izin status and calculate fine
    let fineInfo = null;
    if (['masuk', 'check_in'].includes(jenis_akses) && activeIzin) {
      const now = moment();
      const selesai = moment(activeIzin.tanggal_selesai);
      const fineResult = calculateFine(activeIzin.jenis_izin_id, activeIzin.tanggal_selesai, now);
      const { hari_terlambat, jam_terlambat, jumlah_denda, mode } = fineResult;
      
      // Update izin status to completed
      db.prepare(`
        UPDATE izin 
        SET status = 'completed', tanggal_kembali = ?
        WHERE id = ?
      `).run(now.toISOString(), activeIzin.id);

      // Create fine record if late
      if (jumlah_denda > 0) {
        const jenisIzinLabel = activeIzin.jenis_izin_id === 1 ? 'Izin Keluar (FIXED Rp5.000/jam)' : `Izin Lain (${mode})`;
        db.prepare(`
          INSERT INTO denda (izin_id, santri_id, jumlah_denda, hari_terlambat, jam_terlambat, tanggal_kembali, keterangan, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'belum_lunas')
        `).run(
          activeIzin.id,
          santri_id,
          jumlah_denda,
          hari_terlambat,
          jam_terlambat,
          now.toISOString(),
          `${jenisIzinLabel} - Terlambat ${hari_terlambat > 0 ? hari_terlambat + ' hari' : jam_terlambat + ' jam'} dari jadwal selesai ${selesai.format('DD/MM/YYYY HH:mm')}`
        );

        fineInfo = { hari_terlambat, jam_terlambat, jumlah_denda, mode: fineResult.mode };
        console.log(`Denda created: Rp ${jumlah_denda} for ${hari_terlambat > 0 ? hari_terlambat + ' days' : jam_terlambat + ' hours'} late`);
      } else {
        // Update izin without fine
        console.log(`Izin completed on time for santri ${santri_id}`);
      }
    }

    // Insert akses log
    const stmt = db.prepare(`
      INSERT INTO akses_log (santri_id, izin_id, jenis_akses, keterangan, verified_by)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(santri_id, izin_id || null, jenis_akses, keterangan || '', verified_by || 'system');

    const responseData = {
      success: true,
      message: `Berhasil melakukan ${jenis_akses.replace('_', ' ')}`,
      data: {
        id: result.lastInsertRowid,
        santri_nama: santri.nama,
        santri_nis: santri.nis,
        jenis_akses,
        waktu_akses: new Date().toISOString()
      }
    };

    // Add fine info to response if applicable
    if (fineInfo) {
      responseData.data.fine = fineInfo;
      const terlambatText = fineInfo.hari_terlambat > 0 
        ? `${fineInfo.hari_terlambat} hari`
        : `${fineInfo.jam_terlambat} jam`;
      responseData.data.message = `Santri terlambat ${terlambatText}. Denda: Rp ${fineInfo.jumlah_denda.toLocaleString('id-ID')}`;
    }

    res.json(responseData);
  } catch (error) {
    console.error('Error recording akses:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get santri status (inside/outside)
router.get('/santri-status/:santri_id', (req, res) => {
  try {
    const { santri_id } = req.params;
    
    // Get last akses log
    const lastLog = db.prepare(`
      SELECT * FROM akses_log 
      WHERE santri_id = ? 
      ORDER BY waktu_akses DESC 
      LIMIT 1
    `).get(santri_id);
    
    const santri = db.prepare('SELECT nama, nis FROM santri WHERE id = ?').get(santri_id);
    
    if (!santri) {
      return res.status(404).json({ success: false, message: 'Santri tidak ditemukan' });
    }
    
    let status = 'inside'; // Default status is inside pondok
    
    if (lastLog) {
      // If last log is keluar or check_out, santri is outside
      if (['keluar', 'check_out'].includes(lastLog.jenis_akses)) {
        status = 'outside';
      }
    }
    
    res.json({ 
      success: true, 
      data: { 
        santri_id,
        santri_nama: santri.nama,
        santri_nis: santri.nis,
        status,
        last_log: lastLog
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get statistics
router.get('/stats', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Get all active santri
    const allSantri = db.prepare('SELECT id, nama, nis, kelas FROM santri WHERE status_aktif = 1').all();
    let insideCount = 0;
    let outsideWithIzin = 0;
    let outsideWithoutIzin = 0;
    const outsideSantriList = [];
    const izinPulangList = [];

    for (const s of allSantri) {
      // Get last akses log
      const lastLog = db.prepare(`
        SELECT jenis_akses, waktu_akses FROM akses_log
        WHERE santri_id = ?
        ORDER BY waktu_akses DESC
        LIMIT 1
      `).get(s.id);

      // Check if santri has active izin (prioritize the most recent one)
      const activeIzin = db.prepare(`
        SELECT i.id, i.jenis_izin_id, i.tanggal_mulai, i.tanggal_selesai, i.alasan, j.nama_izin
        FROM izin i
        JOIN jenis_izin j ON i.jenis_izin_id = j.id
        WHERE i.santri_id = ? 
          AND i.status = 'approved'
          AND DATE(i.tanggal_mulai) <= DATE('now')
          AND DATE(i.tanggal_selesai) >= DATE('now')
        ORDER BY i.created_at DESC
        LIMIT 1
      `).get(s.id);

      // Determine status
      if (lastLog && ['keluar', 'check_out'].includes(lastLog.jenis_akses)) {
        // Last action was keluar, so santri is outside
        const hasIzin = !!activeIzin;
        if (hasIzin) {
          outsideWithIzin++;
        } else {
          outsideWithoutIzin++;
        }
        
        const santriData = {
          id: s.id,
          nama: s.nama,
          nis: s.nis,
          kelas: s.kelas,
          status_izin: hasIzin ? 'dengan_izin' : 'tanpa_izin',
          izin_info: activeIzin || null,
          last_log: lastLog
        };
        
        outsideSantriList.push(santriData);
        
        // Add to izin pulang list if jenis_izin_id = 2 (Izin Pulang)
        if (activeIzin && activeIzin.jenis_izin_id === 2) {
          izinPulangList.push(santriData);
        }
      } else {
        // Last action was masuk or no log, so santri is inside
        insideCount++;
      }
    }

    const outsideCount = outsideWithIzin + outsideWithoutIzin;

    // Today's logs
    const todayLogs = db.prepare(`
      SELECT COUNT(*) as count FROM akses_log
      WHERE DATE(waktu_akses) = ?
    `).get(today);

    res.json({
      success: true,
      data: {
        total_santri: allSantri.length,
        inside_count: insideCount,
        outside_count: outsideCount,
        outside_with_izin: outsideWithIzin,
        outside_without_izin: outsideWithoutIzin,
        today_logs: todayLogs.count,
        outside_santri: outsideSantriList,
        izin_pulang: izinPulangList
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete all akses logs (reset)
router.delete('/reset', (req, res) => {
  try {
    const { confirm } = req.body;
    
    if (confirm !== 'RESET_SEMUA_DATA') {
      return res.status(400).json({ 
        success: false, 
        message: 'Konfirmasi tidak valid' 
      });
    }

    const countBefore = db.prepare('SELECT COUNT(*) as count FROM akses_log').get();
    
    db.prepare('DELETE FROM akses_log').run();
    
    console.log(`Reset akses log: ${countBefore.count} records deleted`);
    
    res.json({ 
      success: true, 
      message: `Berhasil mereset ${countBefore.count} data akses log`,
      deleted_count: countBefore.count
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete akses log by ID
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM akses_log WHERE id = ?').run(req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Data akses log tidak ditemukan' 
      });
    }
    
    res.json({ success: true, message: 'Data akses log berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all denda
router.get('/denda', (req, res) => {
  try {
    const { santri_id, status } = req.query;
    
    let query = `
      SELECT 
        d.*,
        s.nama as santri_nama,
        s.nis as santri_nis,
        s.kelas as santri_kelas,
        i.alasan as izin_alasan,
        i.jenis_izin_id,
        j.nama_izin as jenis_izin_nama
      FROM denda d
      JOIN santri s ON d.santri_id = s.id
      JOIN izin i ON d.izin_id = i.id
      JOIN jenis_izin j ON i.jenis_izin_id = j.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (santri_id) {
      query += ' AND d.santri_id = ?';
      params.push(santri_id);
    }
    
    query += ' ORDER BY d.created_at DESC';
    
    const denda = db.prepare(query).all(...params);
    res.json({ success: true, data: denda });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get denda stats
router.get('/denda/stats', (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_denda,
        COALESCE(SUM(jumlah_denda), 0) as total_nominal,
        COALESCE(SUM(CASE WHEN hari_terlambat > 0 THEN 1 ELSE 0 END), 0) as denda_terlambat
      FROM denda
    `).get();
    
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get config denda
router.get('/denda/config', (req, res) => {
  try {
    const config = {
      denda_per_hari: getConfig('denda_per_hari', 10000),
      denda_per_jam: getConfig('denda_per_jam', 5000),
      denda_minimum: getConfig('denda_minimum', 5000),
      denda_mode: getConfig('denda_mode', 'per_hari')
    };
    
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update config denda
router.put('/denda/config', (req, res) => {
  try {
    const { denda_per_hari, denda_per_jam, denda_minimum, denda_mode } = req.body;
    
    // Validate minimum denda
    if (denda_minimum && denda_minimum < 5000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Denda minimum tidak boleh kurang dari Rp 5.000' 
      });
    }
    
    if (denda_per_hari) {
      db.prepare(`
        INSERT OR REPLACE INTO config (key, value, description, updated_at)
        VALUES ('denda_per_hari', ?, 'Jumlah denda per hari keterlambatan (Rp)', CURRENT_TIMESTAMP)
      `).run(denda_per_hari.toString());
    }
    
    if (denda_per_jam) {
      db.prepare(`
        INSERT OR REPLACE INTO config (key, value, description, updated_at)
        VALUES ('denda_per_jam', ?, 'Jumlah denda per jam keterlambatan (Rp)', CURRENT_TIMESTAMP)
      `).run(denda_per_jam.toString());
    }
    
    if (denda_minimum) {
      db.prepare(`
        INSERT OR REPLACE INTO config (key, value, description, updated_at)
        VALUES ('denda_minimum', ?, 'Jumlah denda minimum (Rp)', CURRENT_TIMESTAMP)
      `).run(denda_minimum.toString());
    }
    
    if (denda_mode && ['per_hari', 'per_jam'].includes(denda_mode)) {
      db.prepare(`
        INSERT OR REPLACE INTO config (key, value, description, updated_at)
        VALUES ('denda_mode', ?, 'Mode perhitungan denda: per_hari atau per_jam', CURRENT_TIMESTAMP)
      `).run(denda_mode);
    }
    
    res.json({ 
      success: true, 
      message: 'Konfigurasi denda berhasil diupdate',
      data: {
        denda_per_hari: denda_per_hari || getConfig('denda_per_hari', 10000),
        denda_per_jam: denda_per_jam || getConfig('denda_per_jam', 5000),
        denda_minimum: denda_minimum || getConfig('denda_minimum', 5000),
        denda_mode: denda_mode || getConfig('denda_mode', 'per_hari')
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Mark denda as paid (lunas)
router.put('/denda/:id/lunas', (req, res) => {
  try {
    const denda = db.prepare('SELECT * FROM denda WHERE id = ?').get(req.params.id);
    
    if (!denda) {
      return res.status(404).json({ success: false, message: 'Data denda tidak ditemukan' });
    }
    
    if (denda.status === 'lunas') {
      return res.status(400).json({ success: false, message: 'Denda sudah lunas' });
    }
    
    db.prepare(`
      UPDATE denda 
      SET status = 'lunas', tanggal_bayar = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(req.params.id);
    
    res.json({ 
      success: true, 
      message: 'Status denda berhasil diubah menjadi lunas' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Reset denda (delete all)
router.delete('/denda/reset', (req, res) => {
  try {
    const { confirm } = req.body;
    
    if (confirm !== 'RESET_SEMUA_DENDA') {
      return res.status(400).json({ 
        success: false, 
        message: 'Konfirmasi tidak valid' 
      });
    }

    const countBefore = db.prepare('SELECT COUNT(*) as count FROM denda').get();
    
    db.prepare('DELETE FROM denda').run();
    
    console.log(`Reset denda: ${countBefore.count} records deleted`);
    
    res.json({ 
      success: true, 
      message: `Berhasil mereset ${countBefore.count} data denda`,
      deleted_count: countBefore.count
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Manual trigger to process expired izin
router.post('/izin/process-expired', (req, res) => {
  try {
    const processed = processExpiredIzin();
    
    res.json({
      success: true,
      message: `Berhasil memproses ${processed} izin yang melewati batas waktu`,
      processed_count: processed
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Auto-process expired izin every 1 minute
setInterval(() => {
  const processed = processExpiredIzin();
  if (processed > 0) {
    console.log(`[SCHEDULER] Auto-processed ${processed} expired izin at ${moment().format('HH:mm:ss')}`);
  }
}, 60 * 1000); // Run every 60 seconds

// Initial run on server start
console.log('[SCHEDULER] Starting expired izin auto-processor...');
const initialProcessed = processExpiredIzin();
console.log(`[SCHEDULER] Initial run: processed ${initialProcessed} expired izin`);

module.exports = router;
