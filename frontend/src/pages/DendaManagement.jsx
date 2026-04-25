import { useState, useEffect } from 'react';
import {
  Container, Row, Col, Badge, Button, Modal, Form, Card
} from 'react-bootstrap';
import { aksesAPI } from '../api';
import moment from 'moment';
import 'moment/locale/id';
import { usePopup } from '../components/Popup';
import 'bootstrap-icons/font/bootstrap-icons.css';

moment.locale('id');

function DendaManagement() {
  const { showAlert, showConfirm } = usePopup();
  const [dendaList, setDendaList] = useState([]);
  const [dendaStats, setDendaStats] = useState({ total_denda: 0, total_nominal: 0, denda_terlambat: 0 });
  const [dendaConfig, setDendaConfig] = useState({ denda_per_hari: 10000, denda_per_jam: 5000, denda_minimum: 5000, denda_mode: 'per_hari' });
  const [loading, setLoading] = useState(true);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configForm, setConfigForm] = useState({ denda_per_hari: 10000, denda_per_jam: 5000, denda_minimum: 5000, denda_mode: 'per_hari' });
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [dendaRes, statsRes, configRes] = await Promise.all([
        aksesAPI.getDenda(),
        aksesAPI.getDendaStats(),
        aksesAPI.getDendaConfig()
      ]);

      console.log('=== DEBUG DENDA ===');
      console.log('dendaRes:', dendaRes);
      console.log('dendaRes.data:', dendaRes.data);
      console.log('dendaRes.data.data:', dendaRes.data?.data);
      console.log('dendaRes.data.data.length:', dendaRes.data?.data?.length);
      if (dendaRes.data?.data?.length > 0) {
        console.log('First denda record:', JSON.stringify(dendaRes.data.data[0], null, 2));
      }

      if (dendaRes.data.success) setDendaList(dendaRes.data.data);
      if (statsRes.data.success) setDendaStats(statsRes.data.data);
      if (configRes.data.success) {
        setDendaConfig(configRes.data.data);
        setConfigForm(configRes.data.data);
      }
      console.log('=== END DEBUG DENDA ===');
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatRupiah = (jumlah) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(jumlah);
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    if (configForm.denda_minimum < 5000) {
      showAlert('danger', 'Denda minimum tidak boleh kurang dari Rp 5.000');
      return;
    }
    setSaving(true);
    try {
      // Izin Keluar selalu FIXED Rp 5.000/jam, tidak bisa diubah
      const configToSend = {
        ...configForm,
        denda_per_jam: 5000 // Force tetap 5000 untuk Izin Keluar
      };
      const response = await aksesAPI.updateDendaConfig(configToSend);
      if (response.data.success) {
        setDendaConfig(response.data.data);
        setShowConfigModal(false);
        showAlert('success', 'Konfigurasi denda berhasil diupdate!\n\nCatatan: Denda Izin Keluar tetap Rp 5.000/jam (FIXED)');
      }
    } catch (error) {
      showAlert('danger', 'Error: ' + (error.response?.data?.message || error.message));
    } finally {
      setSaving(false);
    }
  };

  const handleMarkLunas = async (id) => {
    const ok = await showConfirm({
      title: 'Tandai Lunas?',
      message: 'Apakah Anda yakin ingin menandai denda ini sebagai LUNAS?',
      icon: 'bi-check-circle-fill text-success',
      confirmText: 'Ya, Lunas'
    });
    if (!ok) return;
    try {
      const response = await aksesAPI.markDendaLunas(id);
      if (response.data.success) {
        showAlert('success', 'Denda berhasil ditandai sebagai LUNAS!');
        fetchData();
      }
    } catch (error) {
      showAlert('danger', 'Error: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleResetDenda = async () => {
    const ok = await showConfirm({
      title: 'Reset Semua Denda?',
      message: 'Semua data denda akan dihapus permanen dan tidak bisa dikembalikan!',
      icon: 'bi-exclamation-triangle-fill text-danger',
      requireInput: true,
      expectedInput: 'RESET_SEMUA_DENDA',
      inputPlaceholder: 'Ketik: RESET_SEMUA_DENDA',
      confirmText: 'Reset Sekarang',
      confirmVariant: 'danger'
    });

    if (ok === null || ok === false) return; // Abaikan jika user klik batal

    if (ok !== 'RESET_SEMUA_DENDA') {
      showAlert('danger', 'Teks konfirmasi tidak sesuai!');
      return;
    }
    setResetting(true);
    try {
      const response = await aksesAPI.resetDenda(ok);
      if (response.data.success) {
        showAlert('success', response.data.message);
        fetchData();
      }
    } catch (error) {
      showAlert('danger', 'Error: ' + (error.response?.data?.message || error.message));
    } finally {
      setResetting(false);
    }
  };

  const belumLunas = dendaList.filter(d => d.status !== 'lunas');
  const sudahLunas = dendaList.filter(d => d.status === 'lunas');

  return (
    <div className="page-container">
      {/* Header */}
      <div className="denda-header">
        <div>
          <h4 className="mb-1 fw-bold">
            <i className="bi bi-cash-coin text-primary me-2"></i>
            Denda Santri
          </h4>
          <p className="text-muted mb-0 small">Kelola denda keterlambatan santri</p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Button variant="outline-danger" size="sm" onClick={handleResetDenda} disabled={resetting} className="px-3">
            <i className="bi bi-arrow-counterclockwise me-1"></i>
            <span className="d-none d-sm-inline">{resetting ? 'Reset...' : 'Reset'}</span>
          </Button>
          <Button variant="outline-primary" size="sm" onClick={() => setShowConfigModal(true)} className="px-3">
            <i className="bi bi-gear me-1"></i>
            <span className="d-none d-sm-inline">Pengaturan</span>
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="info-banner mb-3">
        <div className="d-flex align-items-start">
          <i className="bi bi-info-circle-fill fs-5 me-2 text-primary"></i>
          <div className="small">
            <strong>Mode:</strong> {dendaConfig.denda_mode === 'per_jam' ? 'Per Jam' : 'Per Hari'} — {formatRupiah(dendaConfig.denda_mode === 'per_jam' ? dendaConfig.denda_per_jam : dendaConfig.denda_per_hari)}/keterlambatan
            <br />
            <span className="text-muted">Minimum: {formatRupiah(dendaConfig.denda_minimum)}</span>
            <hr className="my-2" />
            <strong className="text-danger"><i className="bi bi-lock-fill me-1"></i>Izin Keluar:</strong> <span className="text-danger">Denda FIXED Rp 5.000/jam</span> (tidak dapat diubah)
            <br />
            <small className="text-muted">Denda di atas hanya berlaku untuk Izin Pulang, Berobat, dan Keluarga</small>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <Row className="g-2 mb-3">
        <Col xs={4}>
          <div className="stat-box stat-blue text-center">
            <i className="bi bi-file-earmark-text fs-4 mb-1"></i>
            <div className="stat-value fw-bold">{dendaStats.total_denda || 0}</div>
            <div className="stat-label small">Total</div>
          </div>
        </Col>
        <Col xs={4}>
          <div className="stat-box stat-green text-center">
            <i className="bi bi-cash-stack fs-4 mb-1"></i>
            <div className="stat-value fw-bold text-success">{formatRupiah(dendaStats.total_nominal || 0)}</div>
            <div className="stat-label small">Nominal</div>
          </div>
        </Col>
        <Col xs={4}>
          <div className="stat-box stat-red text-center">
            <i className="bi bi-clock-history fs-4 mb-1"></i>
            <div className="stat-value fw-bold text-danger">{dendaStats.denda_terlambat || 0}</div>
            <div className="stat-label small">Belum Lunas</div>
          </div>
        </Col>
      </Row>

      {/* Loading */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary mb-2" role="status" />
          <p className="text-muted small mb-0">Memuat data denda...</p>
        </div>
      ) : dendaList.length === 0 ? (
        <div className="text-center py-5">
          <i className="bi bi-check-circle text-success display-6"></i>
          <p className="mb-0 mt-2 small text-muted">Belum ada data denda</p>
          <small className="text-muted">Santri yang kembali tepat waktu tidak terkena denda</small>
        </div>
      ) : (
        <>
          {/* Belum Lunas */}
          {belumLunas.length > 0 && (
            <div className="mb-3">
              <h6 className="fw-bold mb-2">
                <Badge bg="danger" className="me-1">{belumLunas.length}</Badge>
                Belum Lunas
              </h6>
              {belumLunas.map((d) => (
                <DendaCard key={d.id} d={d} formatRupiah={formatRupiah} onMarkLunas={handleMarkLunas} />
              ))}
            </div>
          )}

          {/* Sudah Lunas */}
          {sudahLunas.length > 0 && (
            <div>
              <h6 className="fw-bold mb-2">
                <Badge bg="success" className="me-1">{sudahLunas.length}</Badge>
                Sudah Lunas
              </h6>
              {sudahLunas.map((d) => (
                <DendaCard key={d.id} d={d} formatRupiah={formatRupiah} onMarkLunas={handleMarkLunas} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Config Modal */}
      <Modal show={showConfigModal} onHide={() => setShowConfigModal(false)} centered>
        <Modal.Header closeButton className="border-0 pb-2">
          <Modal.Title className="fs-5">
            <i className="bi bi-gear-fill text-primary me-2"></i>Pengaturan Denda
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSaveConfig}>
          <Modal.Body className="pt-0">
            {/* Info Izin Keluar */}
            <div className="alert alert-danger border-0 mb-3" style={{ fontSize: '0.85rem' }}>
              <i className="bi bi-lock-fill me-1"></i>
              <strong>Izin Keluar:</strong> Denda <strong>Rp 5.000/jam</strong> (FIXED - tidak dapat diubah)
            </div>

            <div className="mb-3">
              <Form.Label className="small fw-bold">Mode Perhitungan</Form.Label>
              <Form.Select value={configForm.denda_mode} onChange={(e) => setConfigForm({...configForm, denda_mode: e.target.value})}>
                <option value="per_hari">Per Hari</option>
                <option value="per_jam">Per Jam</option>
              </Form.Select>
              <Form.Text className="text-muted">
                Berlaku untuk: Izin Pulang, Berobat, Keluarga
              </Form.Text>
            </div>
            {configForm.denda_mode === 'per_hari' && (
              <div className="mb-3">
                <Form.Label className="small fw-bold">Denda Per Hari (Rp)</Form.Label>
                <Form.Control type="number" value={configForm.denda_per_hari} onChange={(e) => setConfigForm({...configForm, denda_per_hari: parseInt(e.target.value)})} min="5000" step="1000" required />
                <Form.Text className="text-muted">
                  Minimum: Rp 5.000
                </Form.Text>
              </div>
            )}
            {configForm.denda_mode === 'per_jam' && (
              <div className="mb-3">
                <Form.Label className="small fw-bold">Denda Per Jam (Rp)</Form.Label>
                <Form.Control 
                  type="number" 
                  value={configForm.denda_per_jam} 
                  onChange={(e) => setConfigForm({...configForm, denda_per_jam: parseInt(e.target.value)})} 
                  min="5000" 
                  step="1000" 
                  required 
                  disabled 
                />
                <Form.Text className="text-muted">
                  <i className="bi bi-info-circle me-1"></i>
                  Field ini disabled karena Izin Keluar menggunakan denda FIXED Rp 5.000/jam
                </Form.Text>
              </div>
            )}
            <div className="mb-3">
              <Form.Label className="small fw-bold">Denda Minimum (Rp)</Form.Label>
              <Form.Control type="number" value={configForm.denda_minimum} onChange={(e) => setConfigForm({...configForm, denda_minimum: parseInt(e.target.value)})} min="5000" step="1000" required />
              <Form.Text className="text-muted">
                Denda minimum yang dikenakan
              </Form.Text>
            </div>
          </Modal.Body>
          <Modal.Footer className="border-0 pt-0">
            <Button variant="outline-secondary" size="sm" onClick={() => setShowConfigModal(false)} disabled={saving} className="px-3">Batal</Button>
            <Button variant="primary" size="sm" type="submit" disabled={saving} className="px-3">
              {saving ? <><span className="spinner-border spinner-border-sm me-1" />Menyimpan...</> : 'Simpan'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}

function DendaCard({ d, formatRupiah, onMarkLunas }) {
  // Support both old and new field names
  const santriNama = d.santri_nama || d.santriNama || '-';
  const santriNis = d.santri_nis || d.santriNis || '-';
  const santriKelas = d.santri_kelas || d.santriKelas || '-';
  const jenisIzin = d.jenis_izin_nama || d.jenisIzin || d.jenis_izin || '-';
  const jamTerlambat = d.jam_terlambat || d.terlambatJam || 0;
  const hariTerlambat = d.hari_terlambat || d.terlambatHari || 0;
  const jumlahDenda = d.jumlah_denda || d.jumlahDenda || 0;
  const dendaMode = d.dendaMode || d.mode || 'per_hari';
  const tanggalDenda = d.tanggalDenda || d.tanggal_denda || d.createdAt?.toDate?.() || d.created_at;
  const status = d.status || 'belum_lunas';
  const alasan = d.alasan || d.keterangan || '';

  // Deteksi apakah ini Izin Keluar dari keterangan
  const isIzinKeluar = alasan?.includes('Izin Keluar') || alasan?.includes('FIXED');

  console.log('[DendaCard] Rendering denda:', JSON.stringify({
    santriNama, santriNis, santriKelas, jenisIzin, jamTerlambat, hariTerlambat, jumlahDenda, dendaMode, status, tanggalDenda, isIzinKeluar
  }));

  return (
    <Card className="border-0 mb-2 shadow-sm">
      <Card.Body className="p-3">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <div>
            <div className="fw-bold small">{santriNama}</div>
            <div className="text-muted small">{santriNis} • {santriKelas}</div>
            <div className="text-muted small mt-1">
              <i className="bi bi-file-earmark-text me-1"></i>
              {jenisIzin}
            </div>
          </div>
          <Badge bg={status === 'lunas' ? 'success' : 'danger'}>{status === 'lunas' ? 'LUNAS' : 'BELUM LUNAS'}</Badge>
        </div>
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <div className="small">
              <Badge bg={hariTerlambat > 1 ? 'danger' : 'warning'} className="me-1">
                <i className="bi bi-clock me-1"></i>
                {hariTerlambat > 0 ? `${hariTerlambat} hari terlambat` : `${jamTerlambat} jam terlambat`}
              </Badge>
              {isIzinKeluar ? (
                <span className="badge bg-danger ms-1">
                  <i className="bi bi-lock-fill me-1"></i>
                  FIXED Rp5.000/jam
                </span>
              ) : (
                <span className="text-muted small ms-1">
                  ({dendaMode === 'per_jam' ? 'Rp5.000/jam' : 'Rp10.000/hari'})
                </span>
              )}
            </div>
            {alasan && <div className="text-muted small mt-1"><i className="bi bi-chat-left-text me-1"></i>{alasan}</div>}
            {tanggalDenda && (
              <div className="text-muted small mt-1">
                <i className="bi bi-calendar-event me-1"></i>
                {moment(tanggalDenda).format('DD/MM/YYYY')}
              </div>
            )}
          </div>
          <div className="text-end">
            <div className="fw-bold text-danger small">{formatRupiah(jumlahDenda)}</div>
            {status !== 'lunas' && (
              <Button variant="outline-success" size="sm" onClick={() => onMarkLunas(d.id)} className="px-3 py-1 mt-1">
                <i className="bi bi-check-lg me-1"></i>Lunas
              </Button>
            )}
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}

export default DendaManagement;
