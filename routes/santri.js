const express = require('express');
const router = express.Router();
const db = require('../database/init');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');

// Get all santri
router.get('/', (req, res) => {
  try {
    const santri = db.prepare('SELECT * FROM santri ORDER BY created_at DESC').all();
    res.json({ success: true, data: santri });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get santri by ID
router.get('/:id', (req, res) => {
  try {
    const santri = db.prepare('SELECT * FROM santri WHERE id = ?').get(req.params.id);
    if (!santri) {
      return res.status(404).json({ success: false, message: 'Santri not found' });
    }
    res.json({ success: true, data: santri });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get santri by NIS
router.get('/nis/:nis', (req, res) => {
  try {
    const santri = db.prepare('SELECT * FROM santri WHERE nis = ?').get(req.params.nis);
    if (!santri) {
      return res.status(404).json({ success: false, message: 'Santri not found' });
    }
    res.json({ success: true, data: santri });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create new santri
router.post('/', async (req, res) => {
  try {
    const { nama, nis, kelas, tanggal_lahir, alamat, no_hp_ortu } = req.body;

    // Validate required fields
    if (!nama || !nis || !kelas) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nama, NIS, dan Kelas harus diisi!' 
      });
    }

    // Check if NIS already exists
    const existingSantri = db.prepare('SELECT id FROM santri WHERE nis = ?').get(nis);
    if (existingSantri) {
      return res.status(400).json({ 
        success: false, 
        message: 'NIS sudah terdaftar! Gunakan NIS yang berbeda.' 
      });
    }

    // Generate unique ID and QR code
    const id = uuidv4();
    const qrCodeData = `SANTRI-${nis}-${id}`;

    const stmt = db.prepare(`
      INSERT INTO santri (id, nama, nis, kelas, tanggal_lahir, alamat, no_hp_ortu, qr_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, nama, nis, kelas, tanggal_lahir || null, alamat || null, no_hp_ortu || null, qrCodeData);

    // Generate QR code image
    const qrCodeImage = await QRCode.toDataURL(qrCodeData);

    // Fetch the created santri
    const newSantri = db.prepare('SELECT * FROM santri WHERE id = ?').get(id);

    res.status(201).json({
      success: true,
      message: 'Santri berhasil ditambahkan',
      data: { ...newSantri, qr_code_image: qrCodeImage }
    });
  } catch (error) {
    console.error('Error creating santri:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update santri
router.put('/:id', (req, res) => {
  try {
    const { nama, kelas, tanggal_lahir, alamat, no_hp_ortu, status_aktif } = req.body;
    
    const stmt = db.prepare(`
      UPDATE santri 
      SET nama = ?, kelas = ?, tanggal_lahir = ?, alamat = ?, no_hp_ortu = ?, status_aktif = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(nama, kelas, tanggal_lahir, alamat, no_hp_ortu, status_aktif ?? 1, req.params.id);
    
    res.json({ success: true, message: 'Santri berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete santri
router.delete('/:id', (req, res) => {
  try {
    const santri = db.prepare('SELECT * FROM santri WHERE id = ?').get(req.params.id);
    if (!santri) {
      return res.status(404).json({ success: false, message: 'Santri tidak ditemukan' });
    }

    // Check if santri has related records
    const izinCount = db.prepare('SELECT COUNT(*) as count FROM izin WHERE santri_id = ?').get(req.params.id).count;
    const aksesCount = db.prepare('SELECT COUNT(*) as count FROM akses_log WHERE santri_id = ?').get(req.params.id).count;
    const dendaCount = db.prepare('SELECT COUNT(*) as count FROM denda WHERE santri_id = ?').get(req.params.id).count;

    if (izinCount > 0 || aksesCount > 0 || dendaCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Tidak dapat menghapus santri karena masih memiliki data terkait (${izinCount} izin, ${aksesCount} akses log, ${dendaCount} denda). Gunakan hapus semua data.` 
      });
    }

    // Delete santri
    db.prepare('DELETE FROM santri WHERE id = ?').run(req.params.id);
    
    res.json({ success: true, message: 'Santri berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting santri:', error);
    res.status(500).json({ success: false, message: 'Gagal menghapus santri: ' + error.message });
  }
});

// Delete santri with all related data (force delete)
router.delete('/:id/force', (req, res) => {
  try {
    const { confirm } = req.body;
    
    if (confirm !== 'HAPUS_SEMUA_DATA') {
      return res.status(400).json({ 
        success: false, 
        message: 'Konfirmasi tidak valid' 
      });
    }

    const santri = db.prepare('SELECT * FROM santri WHERE id = ?').get(req.params.id);
    if (!santri) {
      return res.status(404).json({ success: false, message: 'Santri tidak ditemukan' });
    }

    // Count related data before deletion
    const izinCount = db.prepare('SELECT COUNT(*) as count FROM izin WHERE santri_id = ?').get(req.params.id).count;
    const aksesCount = db.prepare('SELECT COUNT(*) as count FROM akses_log WHERE santri_id = ?').get(req.params.id).count;
    const dendaCount = db.prepare('SELECT COUNT(*) as count FROM denda WHERE santri_id = ?').get(req.params.id).count;

    // Delete in correct order (foreign key constraints)
    db.prepare('DELETE FROM denda WHERE santri_id = ?').run(req.params.id);
    db.prepare('DELETE FROM akses_log WHERE santri_id = ?').run(req.params.id);
    db.prepare('DELETE FROM izin WHERE santri_id = ?').run(req.params.id);
    db.prepare('DELETE FROM santri WHERE id = ?').run(req.params.id);

    console.log(`Force deleted santri ${santri.nama}: ${izinCount} izin, ${aksesCount} akses, ${dendaCount} denda`);
    
    res.json({ 
      success: true, 
      message: `Santri "${santri.nama}" dan semua data terkait berhasil dihapus (${izinCount} izin, ${aksesCount} akses, ${dendaCount} denda)` 
    });
  } catch (error) {
    console.error('Error force deleting santri:', error);
    res.status(500).json({ success: false, message: 'Gagal menghapus: ' + error.message });
  }
});

// Generate QR Code for santri
router.get('/:id/qr-code', async (req, res) => {
  try {
    const santri = db.prepare('SELECT * FROM santri WHERE id = ?').get(req.params.id);
    if (!santri) {
      return res.status(404).json({ success: false, message: 'Santri not found' });
    }
    
    const qrCodeImage = await QRCode.toDataURL(santri.qr_code);
    res.json({ 
      success: true, 
      data: { 
        qr_code: santri.qr_code, 
        qr_code_image: qrCodeImage,
        nama: santri.nama,
        nis: santri.nis
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
