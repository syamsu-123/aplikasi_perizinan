const express = require('express');
const router = express.Router();
const db = require('../database/init');

// Get all jenis izin
router.get('/jenis', (req, res) => {
  try {
    const jenisIzin = db.prepare('SELECT * FROM jenis_izin ORDER BY id').all();
    res.json({ success: true, data: jenisIzin });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all izin requests
router.get('/', (req, res) => {
  try {
    const { status, santri_id } = req.query;
    
    let query = `
      SELECT 
        i.*,
        s.nama as santri_nama,
        s.nis as santri_nis,
        s.kelas as santri_kelas,
        j.nama_izin as jenis_izin_nama
      FROM izin i
      JOIN santri s ON i.santri_id = s.id
      JOIN jenis_izin j ON i.jenis_izin_id = j.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (status) {
      query += ' AND i.status = ?';
      params.push(status);
    }
    
    if (santri_id) {
      query += ' AND i.santri_id = ?';
      params.push(santri_id);
    }
    
    query += ' ORDER BY i.created_at DESC';
    
    const izin = db.prepare(query).all(...params);
    res.json({ success: true, data: izin });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get izin by ID
router.get('/:id', (req, res) => {
  try {
    const query = `
      SELECT 
        i.*,
        s.nama as santri_nama,
        s.nis as santri_nis,
        s.kelas as santri_kelas,
        s.no_hp_ortu,
        j.nama_izin as jenis_izin_nama,
        j.durasi_jam
      FROM izin i
      JOIN santri s ON i.santri_id = s.id
      JOIN jenis_izin j ON i.jenis_izin_id = j.id
      WHERE i.id = ?
    `;
    
    const izin = db.prepare(query).get(req.params.id);
    if (!izin) {
      return res.status(404).json({ success: false, message: 'Izin not found' });
    }
    res.json({ success: true, data: izin });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create new izin request
router.post('/', (req, res) => {
  try {
    const { santri_id, jenis_izin_id, alasan, tanggal_mulai, tanggal_selesai } = req.body;
    
    // Get jenis izin to check if requires approval
    const jenisIzin = db.prepare('SELECT * FROM jenis_izin WHERE id = ?').get(jenis_izin_id);
    const status = jenisIzin.requires_approval ? 'pending' : 'approved';
    
    const stmt = db.prepare(`
      INSERT INTO izin (santri_id, jenis_izin_id, alasan, tanggal_mulai, tanggal_selesai, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(santri_id, jenis_izin_id, alasan, tanggal_mulai, tanggal_selesai, status);
    
    res.json({ 
      success: true, 
      message: status === 'approved' ? 'Izin langsung disetujui' : 'Permintaan izin berhasil dibuat, menunggu persetujuan',
      data: { id: result.lastInsertRowid, status }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Approve izin
router.put('/:id/approve', (req, res) => {
  try {
    const { approved_by } = req.body;

    // Get izin details before updating
    const izinDetail = db.prepare(`
      SELECT i.*, j.nama_izin 
      FROM izin i
      JOIN jenis_izin j ON i.jenis_izin_id = j.id
      WHERE i.id = ? AND i.status = 'pending'
    `).get(req.params.id);

    if (!izinDetail) {
      return res.status(400).json({ success: false, message: 'Izin tidak dapat disetujui (mungkin sudah diproses)' });
    }

    // Update status to approved
    const stmt = db.prepare(`
      UPDATE izin
      SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(approved_by || 'admin', req.params.id);

    // Auto create akses_log "keluar" when izin is approved
    db.prepare(`
      INSERT INTO akses_log (santri_id, izin_id, jenis_akses, keterangan, verified_by)
      VALUES (?, ?, 'keluar', ?, ?)
    `).run(
      izinDetail.santri_id,
      req.params.id,
      `Izin ${izinDetail.nama_izin}: ${izinDetail.alasan}`,
      approved_by || 'admin'
    );

    console.log(`Izin approved: ${izinDetail.nama_izin} for santri ${izinDetail.santri_id}, akses_log created`);

    res.json({ 
      success: true, 
      message: 'Izin berhasil disetujui dan tercatat di laporan' 
    });
  } catch (error) {
    console.error('Error approving izin:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Reject izin
router.put('/:id/reject', (req, res) => {
  try {
    const { approved_by, rejection_reason } = req.body;
    
    const stmt = db.prepare(`
      UPDATE izin 
      SET status = 'rejected', approved_by = ?, approved_at = CURRENT_TIMESTAMP, alasan = ?
      WHERE id = ? AND status = 'pending'
    `);
    
    const result = stmt.run(approved_by || 'admin', rejection_reason || 'Ditolak', req.params.id);
    
    if (result.changes === 0) {
      return res.status(400).json({ success: false, message: 'Izin tidak dapat ditolak' });
    }
    
    res.json({ success: true, message: 'Izin ditolak' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update izin status
router.put('/:id', (req, res) => {
  try {
    const { status } = req.body;
    
    const stmt = db.prepare(`
      UPDATE izin SET status = ? WHERE id = ?
    `);
    
    stmt.run(status, req.params.id);
    
    res.json({ success: true, message: 'Status izin berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete all izin (reset) - MUST BE BEFORE /:id route
router.delete('/reset', (req, res) => {
  try {
    const { confirm } = req.body;
    
    if (confirm !== 'RESET_SEMUA_IZIN') {
      return res.status(400).json({ 
        success: false, 
        message: 'Konfirmasi tidak valid' 
      });
    }

    const countBefore = db.prepare('SELECT COUNT(*) as count FROM izin').get();
    
    db.prepare('DELETE FROM izin').run();
    
    console.log(`Reset izin: ${countBefore.count} records deleted`);
    
    res.json({ 
      success: true, 
      message: `Berhasil mereset ${countBefore.count} data izin`,
      deleted_count: countBefore.count
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete izin
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM izin WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Izin berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
