import { useState, useEffect } from 'react';
import {
  Container, Card, Button, Alert, Modal, Form,
  Row, Col, Spinner, Badge
} from 'react-bootstrap';
import { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint } from '@capacitor/barcode-scanner';
import { santriAPI, aksesAPI, izinAPI } from '../api';
import moment from 'moment';
import 'bootstrap-icons/font/bootstrap-icons.css';

function QRScanner() {
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [hasPermission, setHasPermission] = useState(true); // Default true for web dev, auto-check on Android
  const [scannerActive, setScannerActive] = useState(false);
  const [santriData, setSantriData] = useState(null);
  const [santriStatus, setSantriStatus] = useState(null);
  const [activeIzin, setActiveIzin] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualSearchTerm, setManualSearchTerm] = useState('');
  const [showIzinModal, setShowIzinModal] = useState(false);
  const [jenisIzinList, setJenisIzinList] = useState([]);
  const [selectedJenisIzin, setSelectedJenisIzin] = useState('');
  const [izinAlasan, setIzinAlasan] = useState('');
  const [autoMode, setAutoMode] = useState(() => {
    return localStorage.getItem('qr_scanner_auto_mode') === 'true';
  }); // Sakelar Mode Cepat

  // Load jenis izin saat component mount
  useEffect(() => {
    loadJenisIzin();
  }, []);

  const loadJenisIzin = async () => {
    try {
      const res = await izinAPI.getJenisIzin();
      if (res.data.success) {
        setJenisIzinList(res.data.data);
      }
    } catch (error) {
      console.error('Error loading jenis izin:', error);
    }
  };

  const handleScan = async () => {
    if (scanning || scannerActive || processing) return;
    
    // Skip permission check for smoother first experience (Capacitor handles prompt automatically)
    setHasPermission(true);
    
    setScanResult(null);
    setSantriData(null);
    setSantriStatus(null);
    setActiveIzin(null);
    setMessage({ type: '', text: '' });
    setScanning(true);
    setScannerActive(true);

    try {
      const result = await CapacitorBarcodeScanner.scanBarcode({
        showFlipCameraButton: true,
        showTorchButton: true,
        scanInstructions: 'Arahkan kamera ke QR Code kartu santri',
      });

      // Always stop scanner
      try { await CapacitorBarcodeScanner.stopScan(); } catch(e) {}
      setScannerActive(false);
      setScanning(false);
      
      console.log('Scan result:', JSON.stringify(result));

      const rawValue = result?.ScanResult?.rawValue || result?.text || result?.code || result?.content;
      if (rawValue) {
        setScanResult(rawValue);
        
        // Memutar suara beep saat QR berhasil terbaca
        try {
          const beepSound = new Audio('/beep.mp3');
          beepSound.play().catch(err => console.log('Gagal memutar beep:', err));
        } catch (e) { /* Abaikan jika browser memblokir audio */ }

        await processScanResult(rawValue);
      } else {
        setMessage({ type: 'warning', text: 'Scan dibatalkan atau tidak valid' });
      }
    } catch (error) {
      setScannerActive(false);
      setScanning(false);
      console.error('Scan error:', error);
      
      if (error.message && error.message.includes('permission')) {
        setMessage({
          type: 'danger',
          text: 'Izin kamera ditolak. Buka Pengaturan → Aplikasi → Perizinan Santri → Izin → Kamera'
        });
      } else if (error.message && error.message.includes('cancel')) {
        setMessage({
          type: 'info',
          text: 'Scan dibatalkan'
        });
      } else {
        setMessage({
          type: 'danger',
          text: 'Gagal scan: ' + (error.message || 'Error tidak diketahui')
        });
      }
    }
  };

  const processScanResult = async (decodedText) => {
    console.log('Processing QR Code:', decodedText);

    const trimmedText = decodedText.trim();

    // Expected format: SANTRI-NIS-UUID
    // UUIDs mengandung tanda hubung, jadi kita perlu parsing yang lebih robust daripada split sederhana.
    // Kita asumsikan NIS tidak mengandung tanda hubung.
    if (!trimmedText.toUpperCase().startsWith('SANTRI-')) {
      if (/^\d+$/.test(trimmedText)) {
        // Fallback: Jika QR hanya berisi angka, langsung query sebagai NIS
        return await fetchSantriData(trimmedText);
      }
      throw new Error(`Format QR tidak dikenal! Terbaca: ${trimmedText}`);
    }

    const remaining = trimmedText.substring('SANTRI-'.length); // Contoh: "12345-a1b2c3d4-e5f6-7890-1234-567890abcdef"
    const firstHyphenIndex = remaining.indexOf('-'); // Cari tanda hubung pertama yang memisahkan NIS dari UUID

    if (firstHyphenIndex === -1) {
      throw new Error('Format QR Code tidak lengkap: NIS atau ID santri tidak ditemukan.');
    }

    const nis = remaining.substring(0, firstHyphenIndex);
    const santriId = remaining.substring(firstHyphenIndex + 1); // Ini adalah UUID lengkap

    if (!nis || !santriId) {
      throw new Error('NIS atau ID santri tidak ditemukan dalam QR Code.');
    }
    const result = await fetchSantriData(nis); // fetchSantriData hanya membutuhkan NIS

      // Auto Mode: Eksekusi check-in/out otomatis jika memenuhi syarat
      if (autoMode && result?.santri && result?.status) {
        const isInside = result.status.status === 'inside';
        if (!isInside) {
          // Jika di luar -> Otomatis Masuk
          await executeRecordAkses(result.santri.id, 'masuk', null, true);
        } else if (isInside && result.activeIzin) {
          // Jika di dalam dan punya izin aktif -> Otomatis Keluar
          await executeRecordAkses(result.santri.id, 'keluar', result.activeIzin.id, true);
        }
      }
  };

  const fetchSantriData = async (query) => {
    if (processing) return;
    setProcessing(true);
    console.log('Fetching santri data for query:', query);
    let fetchedSantri = null;
    let fetchedStatus = null;
    let fetchedActiveIzin = null;
    try {
      // Coba cari berdasarkan NIS terlebih dahulu
      let santriRes = null;
      try {
        const res = await santriAPI.getByNis(query);
        santriRes = res.data;
      } catch (err) {
        console.log('Gagal mencari by NIS, mencoba by Nama...');
      }

      // Jika tidak ketemu berdasarkan NIS, cari berdasarkan Nama (fetch all)
      if (!santriRes?.success || !santriRes?.data) {
        const allRes = await santriAPI.getAll();
        if (allRes.data?.success) {
          const matched = allRes.data.data.find(s => 
            s.nama.toLowerCase().includes(query.toLowerCase()) || 
            s.nis === query
          );
          if (matched) {
            santriRes = { success: true, data: matched };
          }
        }
      }

      if (!santriRes?.success) {
        throw new Error('Santri tidak ditemukan');
      }
      
      const santri = santriRes.data;
      console.log('Santri found:', santri);
      setSantriData(santri);
      fetchedSantri = santri;

      // Parallel status + izin check
      const [statusRes, izinRes] = await Promise.allSettled([
        aksesAPI.getSantriStatus(santri.id).then(r => r.data),
        izinAPI.getAll({ santri_id: santri.id, status: 'approved' }).then(r => r.data)
      ]);

      if (statusRes.status === 'fulfilled' && statusRes.value.success) {
        setSantriStatus(statusRes.value.data);
        fetchedStatus = statusRes.value.data;

        if (statusRes.value.data.status === 'inside') {
          setShowIzinModal(true);
        } else if (izinRes.status === 'fulfilled' && izinRes.value.success) {
          const now = new Date();
          const active = izinRes.value.data.find(izin => {
            const mulai = new Date(izin.tanggal_mulai);
            const selesai = new Date(izin.tanggal_selesai);
            return now >= mulai && now <= selesai;
          });
          setActiveIzin(active || null);
          fetchedActiveIzin = active || null;
        }
      }

      setMessage({
        type: 'success',
        text: `Santri ditemukan: ${santri.nama}`
      });
    } catch (error) {
      console.error('Fetch error:', error);
      setMessage({
        type: 'danger',
        text: error.message || 'Santri tidak ditemukan!'
      });
    } finally {
      setProcessing(false);
    }
    return { santri: fetchedSantri, status: fetchedStatus, activeIzin: fetchedActiveIzin };
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setProcessing(true);
    const result = await fetchSantriData(manualSearchTerm);
    setShowManualInput(false);
    setManualSearchTerm('');
    
    // Auto create izin if santri inside (manual mode)
    if (result && result.santri && result.status?.status === 'inside' && jenisIzinList.length > 0) {
      const defaultJenis = jenisIzinList[0]; // First jenisIzin as default
      const durasiJam = defaultJenis.durasiJam || 24;
      const tanggalMulai = new Date();
      const tanggalSelesai = new Date(tanggalMulai.getTime() + durasiJam * 60 * 60 * 1000);

      const izinData = {
        santri_id: result.santri.id,
        jenis_izin_id: defaultJenis.id,
        alasan: `Izin keluar manual - ${defaultJenis.namaIzin}`,
        tanggal_mulai: tanggalMulai.toISOString(),
        tanggal_selesai: tanggalSelesai.toISOString()
      };

      try {
        const createRes = await izinAPI.create(izinData);
        if (createRes.data.success) {
          const izinId = createRes.data.data.id;
          await izinAPI.approve(izinId, { approvedBy: 'manual_scan' });
          setActiveIzin(createRes.data.data);
          setMessage({ type: 'success', text: `✅ Izin ${defaultJenis.namaIzin} auto-dibuat & disetujui!` });
        }
      } catch (err) {
        setMessage({ type: 'danger', text: 'Gagal auto-izin: ' + err.message });
      }
    }
  };

  const handleIzinSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedJenisIzin) {
      setMessage({ type: 'danger', text: 'Pilih jenis izin terlebih dahulu!' });
      return;
    }

    setProcessing(true);
    try {
      // Cari nama jenis izin
      const jenisIzin = jenisIzinList.find(j => j.id === selectedJenisIzin);
      const durasiJam = jenisIzin?.durasiJam || 24;
      
      // Hitung tanggal selesai berdasarkan durasi
      const tanggalMulai = new Date();
      const tanggalSelesai = new Date(tanggalMulai.getTime() + durasiJam * 60 * 60 * 1000);

      console.log('[QRScanner] Creating izin with auto-approve');
      console.log('[QRScanner] tanggal_mulai:', tanggalMulai.toISOString());
      console.log('[QRScanner] tanggal_selesai:', tanggalSelesai.toISOString());

      // Buat izin dengan auto-approve
      const izinData = {
        santri_id: santriData.id,
        jenis_izin_id: selectedJenisIzin,
        alasan: izinAlasan || `Izin keluar melalui scan QR - ${jenisIzin?.namaIzin || ''}`,
        tanggal_mulai: tanggalMulai.toISOString(),
        tanggal_selesai: tanggalSelesai.toISOString(),
        auto_approve: true // Flag untuk auto-approve
      };

      const createRes = await izinAPI.create(izinData);
      
      if (createRes.data.success) {
        const izinId = createRes.data.data.id;
        console.log('[QRScanner] Izin created, ID:', izinId);

        // Auto-approve izin
        const approveRes = await izinAPI.approve(izinId, { approvedBy: 'qr_scanner' });
        
        if (approveRes.data.success) {
          setMessage({
            type: 'success',
            text: `✅ Izin ${jenisIzin?.namaIzin || 'Keluar'} berhasil dibuat dan disetujui! Santri dapat keluar.`
          });
          
          // Update active izin
          setActiveIzin(createRes.data.data);
          
          // Tutup modal
          setShowIzinModal(false);
          setSelectedJenisIzin('');
          setIzinAlasan('');
        }
      }
    } catch (error) {
      console.error('[QRScanner] Error creating izin:', error);
      setMessage({
        type: 'danger',
        text: 'Gagal membuat izin: ' + (error.response?.data?.message || error.message)
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleRecordAkses = async () => {
    if (!santriData || !santriStatus) return;

    const aksesType = santriStatus.status === 'inside' ? 'keluar' : 'masuk';
    await executeRecordAkses(santriData.id, aksesType, activeIzin ? activeIzin.id : null, false);
  };

  const executeRecordAkses = async (santriId, aksesType, izinId, isAuto = false) => {
    setProcessing(true);
    try {
      if (aksesType === 'keluar' && !izinId) {
        setMessage({
          type: 'danger',
          text: '⚠️ Santri tidak memiliki izin aktif! Silakan buat izin terlebih dahulu melalui tombol "Buat Izin Keluar".'
        });
        return;
      }

      const response = await aksesAPI.record({
        santri_id: santriId,
        izin_id: izinId,
        jenis_akses: aksesType,
        keterangan: `Scan QR Code - ${aksesType}${isAuto ? ' (Auto)' : ''}`,
        verified_by: 'security'
      });

      if (response.data.success) {
        setMessage({
          type: 'success',
          text: `✅ Berhasil ${aksesType === 'keluar' ? 'Keluar' : 'Masuk'}: ${response.data.message}`
        });

        const statusRes = await aksesAPI.getSantriStatus(santriId);
        if (statusRes.data.success) {
          setSantriStatus(statusRes.data.data);
          setActiveIzin(null); // Reset active izin setelah masuk
        }
      }
    } catch (error) {
      setMessage({
        type: 'danger',
        text: 'Error: ' + (error.response?.data?.message || error.message)
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReset = () => {
    setScanResult(null);
    setSantriData(null);
    setSantriStatus(null);
    setActiveIzin(null);
    setMessage({ type: '', text: '' });
  };

  return (
    <Container className="page-content">
      {/* Page Header */}
      <div className="page-header d-flex justify-content-between align-items-center mb-3">
        <h2 className="page-title mb-0">
          <i className="bi bi-qr-code-scan"></i>
          QR Scanner
        </h2>
      <div className="d-flex gap-3 flex-wrap align-items-center">
        <Form.Check 
          type="switch"
          id="auto-mode-switch"
          label={<span className="small fw-bold text-primary">Mode Cepat</span>}
          checked={autoMode}
          onChange={(e) => {
            setAutoMode(e.target.checked);
            localStorage.setItem('qr_scanner_auto_mode', e.target.checked);
          }}
          title="Jika aktif, otomatis mencatat santri keluar/masuk"
        />
          <Button
            variant="outline-secondary"
            onClick={() => setShowManualInput(true)}
            size="sm"
            disabled={processing || scannerActive}
          >
            <i className="bi bi-keyboard me-1"></i>
            <span className="d-none d-sm-inline">Input Manual</span>
            <span className="d-sm-none">Manual</span>
          </Button>
  <Button variant="primary" onClick={handleScan} size="sm" disabled={scanning || processing || !hasPermission}>
            {scanning ? (
              <>
                <Spinner animation="border" size="sm" className="me-1" />
                <span className="d-none d-sm-inline">Scanning...</span>
                <span className="d-sm-none">Scan...</span>
              </>
            ) : (
              <>
                <i className="bi bi-camera me-1"></i>
                <span className="d-none d-sm-inline">Mulai Scan</span>
                <span className="d-sm-none">Scan</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Message */}
      {message.text && (
        <Alert
          variant={message.type}
          className="border-0"
          onClose={() => setMessage({ type: '', text: '' })}
          dismissible
        >
          <i className={`bi bi-${message.type === 'success' ? 'check-circle' : 'exclamation-triangle'} me-2`}></i>
          {message.text}
        </Alert>
      )}

      {/* Santri Info */}
      {santriData && santriStatus && (
        <Card className="mb-3 border-0">
          <Card.Header className="bg-white border-0">
            <h5 className="mb-0">
              <i className="bi bi-person-badge text-primary me-2"></i>
              Informasi Santri
            </h5>
          </Card.Header>
          <Card.Body>
            <Row>
              <Col xs={12} md={6} className="mb-2 mb-md-0">
                <div className="info-card">
                  <div className="d-flex align-items-center mb-2">
                    <div className="avatar-circle me-2">
                      <i className="bi bi-person-circle text-primary" style={{ fontSize: '2rem' }}></i>
                    </div>
                    <div>
                      <h5 className="mb-0 fw-bold">{santriData.nama}</h5>
                      <p className="mb-0 text-muted">{santriData.nis} | {santriData.kelas}</p>
                    </div>
                  </div>
                </div>
              </Col>
              <Col xs={12} md={6}>
                <div className="info-card">
                  <h6 className="mb-2 fw-bold">Status Saat Ini</h6>
                  <div className="text-center mb-2">
                    <div className={`status-badge ${
                      santriStatus.status === 'inside'
                        ? 'status-inside'
                        : 'status-outside'
                    } p-2`}>
                      <i className={`bi ${
                        santriStatus.status === 'inside'
                          ? 'bi-house-check-fill'
                          : 'bi-person-walking'
                      } me-1`}></i>
                      <span>
                        {santriStatus.status === 'inside' ? 'Di Dalam' : 'Di Luar'}
                      </span>
                    </div>
                  </div>
                  {activeIzin && (
                    <Alert variant="success" className="mb-0 small py-1">
                      <div className="d-flex align-items-center">
                        <i className="bi bi-patch-check-fill me-1"></i>
                        <div>
                          <strong className="d-block" style={{fontSize: '0.75rem'}}>{activeIzin.jenis_izin_nama}</strong>
                          <small style={{fontSize: '0.65rem'}}>
                            s/d: {moment(activeIzin.tanggal_selesai).format('DD/MM/YYYY HH:mm')}
                          </small>
                        </div>
                      </div>
                    </Alert>
                  )}
                </div>
              </Col>
            </Row>

            <div className="text-center mt-3">
              {processing || scannerActive ? (
                <div>
                  <Spinner animation="border" variant="primary" className="me-2" size="sm" />
                  <span className="text-muted">{scannerActive ? 'Scanner aktif...' : 'Memproses...'}</span>
                </div>
              ) : (
                <div className="d-flex flex-wrap gap-2 justify-content-center">
                  {/* Tombol Buat Izin - hanya muncul jika santri di dalam dan belum ada izin aktif */}
                  {santriStatus.status === 'inside' && !activeIzin && (
                  <Button
                      variant="success"
                      onClick={() => setShowIzinModal(true)}
                      className="flex-grow-1 flex-md-grow-0"
                      disabled={processing}
                    >
                      <i className="bi bi-file-earmark-plus me-1"></i>
                      Buat Izin Keluar
                    </Button>
                  )}
                  
                  {/* Tombol Catat Keluar - hanya muncul jika sudah ada izin aktif */}
                  {santriStatus.status === 'inside' && activeIzin && (
                    <Button
                      variant="warning"
                      onClick={handleRecordAkses}
                      className="flex-grow-1 flex-md-grow-0"
                      disabled={processing}
                    >
                      <i className="bi bi-door-open me-1"></i>
                      Catat Keluar
                    </Button>
                  )}
                  
                  {/* Tombol Catat Masuk - muncul jika santri di luar */}
                  {santriStatus.status === 'outside' && (
                    <Button
                      variant="success"
                      onClick={handleRecordAkses}
                      className="flex-grow-1 flex-md-grow-0"
                      disabled={processing}
                    >
                      <i className="bi bi-box-arrow-in-right me-1"></i>
                      Catat Masuk
                    </Button>
                  )}
                  
                  <Button
                    variant="outline-secondary"
                    onClick={handleReset}
                    className="flex-grow-1 flex-md-grow-0"
                  >
                    <i className="bi bi-arrow-repeat me-1"></i>
                    Scan Ulang
                  </Button>
                </div>
              )}
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Manual Input Modal */}
      <Modal show={showManualInput} onHide={() => setShowManualInput(false)} className="modal-custom">
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-keyboard me-2"></i>
            Input Manual
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleManualSubmit}>
          <Modal.Body>
            <div className="form-group-custom">
              <Form.Label>
                <i className="bi bi-card-text me-1"></i>
                NIS atau Nama Santri
              </Form.Label>
              <Form.Control
                type="text"
                value={manualSearchTerm}
                onChange={(e) => setManualSearchTerm(e.target.value)}
                placeholder="Masukkan NIS atau Nama santri"
                required
                autoFocus
                disabled={processing}
              />
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setShowManualInput(false)} disabled={processing}>
              <i className="bi bi-x-lg me-1"></i>
              Batal
            </Button>
            <Button variant="primary" type="submit" disabled={processing || !manualSearchTerm}>
              {processing ? (
                <>
                  <Spinner animation="border" size="sm" className="me-1" />
                  Mencari...
                </>
              ) : (
                <>
                  <i className="bi bi-search me-1"></i>
                  Cari
                </>
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal Pengajuan Izin Otomatis */}
      <Modal show={showIzinModal} onHide={() => setShowIzinModal(false)} className="modal-custom">
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-file-earmark-plus-fill text-success me-2"></i>
            Buat Izin Keluar
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleIzinSubmit}>
          <Modal.Body>
            <Alert variant="info" className="mb-3">
              <i className="bi bi-info-circle me-2"></i>
              <strong>Auto-Approve Aktif</strong>
              <p className="mb-0 small">
                Izin akan langsung disetujui karena santri melakukan scan QR Code.
              </p>
            </Alert>

            {santriData && (
              <div className="mb-3 p-2 bg-light rounded">
                <strong>{santriData.nama}</strong>
                <div className="small text-muted">NIS: {santriData.nis} | Kelas: {santriData.kelas}</div>
              </div>
            )}

            <div className="form-group-custom mb-3">
              <Form.Label>
                <i className="bi bi-tag me-1"></i>
                Jenis Izin
              </Form.Label>
              <Form.Select
                value={selectedJenisIzin}
                onChange={(e) => setSelectedJenisIzin(e.target.value)}
                required
              >
                <option value="">-- Pilih Jenis Izin --</option>
                {jenisIzinList.map((jenis) => (
                  <option key={jenis.id} value={jenis.id}>
                    {jenis.namaIzin} ({jenis.durasiJam} jam)
                  </option>
                ))}
              </Form.Select>
            </div>

            <div className="form-group-custom">
              <Form.Label>
                <i className="bi bi-card-text me-1"></i>
                Alasan (Opsional)
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={izinAlasan}
                onChange={(e) => setIzinAlasan(e.target.value)}
                placeholder="Masukkan alasan izin..."
              />
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => {
              setShowIzinModal(false);
              setSelectedJenisIzin('');
              setIzinAlasan('');
            }}>
              <i className="bi bi-x-lg me-1"></i>
              Batal
            </Button>
            <Button variant="success" type="submit" disabled={processing || !selectedJenisIzin}>
              {processing ? (
                <>
                  <Spinner animation="border" size="sm" className="me-1" />
                  Memproses...
                </>
              ) : (
                <>
                  <i className="bi bi-check-circle me-1"></i>
                  Buat & Setujui Izin
                </>
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Instructions */}
      <Card className="border-0">
        <Card.Header className="bg-white border-0">
          <h6 className="mb-0 fw-bold">
            <i className="bi bi-book text-primary me-2"></i>
            Panduan Penggunaan
          </h6>
        </Card.Header>
        <Card.Body>
          <Alert variant="success" className="mb-3">
            <i className="bi bi-lightning-fill me-2"></i>
            <strong>Fitur Auto-Approve</strong>
            <p className="mb-0 small">
              Santri yang scan QR Code akan langsung mendapatkan izin yang <strong>disetujui otomatis</strong> (tidak pending).
              Santri yang tidak scan harus menunggu persetujuan admin.
            </p>
          </Alert>

          <Row>
            <Col md={6}>
              <div className="d-flex align-items-start mb-3">
                <div className="me-3">
                  <Badge bg="primary" className="rounded-circle p-2">
                    <i className="bi bi-1"></i>
                  </Badge>
                </div>
                <div>
                  <strong className="d-block">Scan QR Code</strong>
                  <small className="text-muted">Arahkan kamera ke QR Code kartu santri</small>
                </div>
              </div>
            </Col>
            <Col md={6}>
              <div className="d-flex align-items-start mb-3">
                <div className="me-3">
                  <Badge bg="success" className="rounded-circle p-2">
                    <i className="bi bi-2"></i>
                  </Badge>
                </div>
                <div>
                  <strong className="d-block">Buat Izin (Jika di Dalam)</strong>
                  <small className="text-muted">Klik "Buat Izin Keluar" → Izin langsung disetujui!</small>
                </div>
              </div>
            </Col>
            <Col md={6}>
              <div className="d-flex align-items-start mb-3">
                <div className="me-3">
                  <Badge bg="warning" className="rounded-circle p-2">
                    <i className="bi bi-3"></i>
                  </Badge>
                </div>
                <div>
                  <strong className="d-block">Catat Keluar</strong>
                  <small className="text-muted">Klik "Catat Keluar" untuk mencatat santri keluar</small>
                </div>
              </div>
            </Col>
            <Col md={6}>
              <div className="d-flex align-items-start mb-3">
                <div className="me-3">
                  <Badge bg="info" className="rounded-circle p-2">
                    <i className="bi bi-4"></i>
                  </Badge>
                </div>
                <div>
                  <strong className="d-block">Catat Masuk</strong>
                  <small className="text-muted">Saat santri kembali, scan lagi dan klik "Catat Masuk"</small>
                </div>
              </div>
            </Col>
          </Row>
          <Alert variant="info" className="mb-0 mt-2">
            <i className="bi bi-info-circle me-2"></i>
            Jika QR Code tidak terbaca, gunakan opsi <strong>"Input Manual"</strong>
          </Alert>
          <Alert variant="warning" className="mb-0 mt-2">
            <i className="bi bi-shield-lock me-2"></i>
            <strong>Penting:</strong> Saat pertama kali scan, aplikasi akan meminta izin kamera.
            Pilih <strong>"Allow"</strong> atau <strong>"Izinkan"</strong>
          </Alert>
        </Card.Body>
      </Card>
    </Container>
  );
}

export default QRScanner;
