import { useState, useEffect, useRef } from 'react';
import {
  Container, Card, Table, Form, Row, Col, Button,
  Alert, InputGroup, Badge, Modal
} from 'react-bootstrap';
import { aksesAPI, santriAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { isAdmin } from '../utils/roles';
import moment from 'moment';
import 'bootstrap-icons/font/bootstrap-icons.css';

function Reports() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [santriList, setSantriList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    santri_id: '',
    santri_search: '',
    jenis_akses: '',
    bulan: moment().format('MM'),
    tahun: moment().format('YYYY'),
    tanggal_dari: moment().startOf('month').format('YYYY-MM-DD'),
    tanggal_sampai: moment().format('YYYY-MM-DD')
  });
  const [exporting, setExporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });
  const [showSantriDropdown, setShowSantriDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Check if user is admin - if not, show access denied
  const userIsAdmin = isAdmin(user);

  if (!userIsAdmin) {
    return (
      <Container className="page-content">
        <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '60vh' }}>
          <Card className="border-0 text-center p-5">
            <Card.Body>
              <i className="bi bi-shield-lock-fill text-danger" style={{ fontSize: '4rem' }}></i>
              <h3 className="mt-3 fw-bold">Akses Ditolak</h3>
              <p className="text-muted">
                Halaman Laporan hanya dapat diakses oleh akun administrator.
              </p>
              <p className="text-muted small">
                Silakan hubungi administrator jika Anda membutuhkan akses.
              </p>
            </Card.Body>
          </Card>
        </div>
      </Container>
    );
  }

  const fetchInitialData = async () => {
    try {
      const [santriRes] = await Promise.all([
        santriAPI.getAll()
      ]);

      if (santriRes.data.success) {
        setSantriList(santriRes.data.data);
      }

      await fetchLogs();
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowSantriDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const showAlert = (type, message) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert({ show: false, type: '', message: '' }), 3000);
  };

  const fetchLogs = async () => {
    try {
      const params = {};

      if (filters.santri_id) params.santri_id = filters.santri_id;
      if (filters.jenis_akses) params.jenis_akses = filters.jenis_akses;
      if (filters.tanggal_dari) params.tanggal_dari = filters.tanggal_dari;
      if (filters.tanggal_sampai) params.tanggal_sampai = filters.tanggal_sampai;
      // Pass search term to API for client-side filtering after server-side date filter
      if (filters.santri_search && !filters.santri_id) {
        params.santri_search = filters.santri_search;
      }

      const response = await aksesAPI.getAll(params);
      if (response.data.success) {
        setLogs(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handlePeriodeChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => {
      const newFilters = { ...prev, [name]: value };
      const dateStr = `${newFilters.tahun}-${newFilters.bulan}-01`;
      newFilters.tanggal_dari = moment(dateStr).startOf('month').format('YYYY-MM-DD');
      
      // Jika bulan/tahun sama dengan saat ini, batas tanggal selesai adalah hari ini. Jika tidak, akhir bulan tersebut.
      if (newFilters.bulan === moment().format('MM') && newFilters.tahun === moment().format('YYYY')) {
        newFilters.tanggal_sampai = moment().format('YYYY-MM-DD');
      } else {
        newFilters.tanggal_sampai = moment(dateStr).endOf('month').format('YYYY-MM-DD');
      }
      return newFilters;
    });
  };

  const handleApplyFilter = () => {
    fetchLogs();
    showAlert('info', 'Filter diterapkan');
  };

  const handleResetFilter = () => {
    setFilters({
      santri_id: '',
      santri_search: '',
      jenis_akses: '',
      bulan: moment().format('MM'),
      tahun: moment().format('YYYY'),
      tanggal_dari: moment().startOf('month').format('YYYY-MM-DD'),
      tanggal_sampai: moment().format('YYYY-MM-DD')
    });
    fetchLogs();
    showAlert('info', 'Filter direset');
  };

  const handleSantriSearch = (value) => {
    setFilters(prev => ({
      ...prev,
      santri_search: value,
      santri_id: ''
    }));
    setShowSantriDropdown(true);
  };

  const selectSantri = (santri) => {
    setFilters(prev => ({
      ...prev,
      santri_id: santri.id,
      santri_search: `${santri.nama} (${santri.nis})`
    }));
    setShowSantriDropdown(false);
  };

  const filteredSantri = santriList.filter(s =>
    s.nama.toLowerCase().includes(filters.santri_search.toLowerCase()) ||
    s.nis.toLowerCase().includes(filters.santri_search.toLowerCase()) ||
    s.kelas.toLowerCase().includes(filters.santri_search.toLowerCase())
  );

  const handleRefresh = async () => {
    setLoading(true);
    await fetchInitialData();
    setLoading(false);
    showAlert('success', 'Data berhasil diperbarui!');
  };

  const handleReset = async () => {
    if (confirmText !== 'RESET_SEMUA_DATA') {
      showAlert('danger', 'Teks konfirmasi tidak sesuai!');
      return;
    }

    setResetting(true);
    try {
      const response = await aksesAPI.reset(confirmText);
      if (response.data.success) {
        showAlert('success', response.data.message);
        setShowResetModal(false);
        setConfirmText('');
        await fetchLogs();
        await fetchInitialData();
      }
    } catch (error) {
      showAlert('danger', 'Error: ' + (error.response?.data?.message || error.message));
    } finally {
      setResetting(false);
    }
  };

  const exportToCSV = async () => {
    setExporting(true);
    try {
      const headers = ['No', 'Waktu', 'Nama Santri', 'NIS', 'Kelas', 'Jenis Izin', 'Jenis Akses', 'Keterangan'];
      const csvData = logs.map((log, index) => [
        index + 1,
        moment(log.waktuAkses || log.waktu_akses || log.waktu).format('DD/MM/YYYY HH:mm:ss'),
        log.santri_nama || '-',
        log.santri_nis || '-',
        log.santri_kelas || '-',
        log.jenis_izin_nama || 'Tanpa Izin',
        (log.jenisAkses || log.jenis_akses || log.tipe || '').replace('_', ' ').toUpperCase(),
        log.keterangan || '-'
      ]);

      let csvContent = "\uFEFF"; // BOM for Excel UTF-8
      csvContent += headers.join(",") + "\n";

      csvData.forEach(row => {
        csvContent += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",") + "\n";
      });

      // Pakai Blob agar tidak ada limit ukuran
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `laporan-akses-${moment().format('YYYYMMDD-HHmmss')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showAlert('success', 'Laporan berhasil diexport!');
    } catch (error) {
      showAlert('danger', 'Error saat export: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  const getJenisAksesBadge = (jenis) => {
    switch (jenis) {
      case 'masuk':
      case 'check_in':
        return <Badge bg="success"><i className="bi bi-arrow-down-left me-1"></i> MASUK</Badge>;
      case 'keluar':
      case 'check_out':
        return <Badge bg="danger"><i className="bi bi-arrow-up-right me-1"></i> KELUAR</Badge>;
      case 'izin_disetujui':
        return <Badge bg="info" text="dark"><i className="bi bi-patch-check me-1"></i> IZIN DISETUJUI</Badge>;
      case 'izin_ditolak':
        return <Badge bg="warning" text="dark"><i className="bi bi-patch-exclamation me-1"></i> IZIN DITOLAK</Badge>;
      case 'denda_lunas':
        return <Badge bg="primary"><i className="bi bi-cash-coin me-1"></i> DENDA LUNAS</Badge>;
      default:
        return <Badge bg="secondary">{String(jenis || '').replace(/_/g, ' ').toUpperCase()}</Badge>;
    }
  };

  const masukCount = logs.filter(l => {
    const j = l.jenisAkses || l.jenis_akses;
    return j === 'masuk' || j === 'check_in';
  }).length;
  const keluarCount = logs.filter(l => {
    const j = l.jenisAkses || l.jenis_akses;
    return j === 'keluar' || j === 'check_out';
  }).length;

  return (
    <Container className="page-content">
      {/* Page Header */}
      <div className="page-header d-flex justify-content-between align-items-center mb-4">
        <h2 className="page-title mb-0">
          <i className="bi bi-bar-chart"></i>
          Laporan Santri
        </h2>
        <div className="d-flex gap-2">
          <Button variant="outline-danger" onClick={() => setShowResetModal(true)}>
            <i className="bi bi-arrow-counterclockwise me-1"></i>
            Reset Data
          </Button>
          <Button variant="outline-primary" onClick={handleRefresh} disabled={loading}>
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                Loading...
              </>
            ) : (
              <>
                <i className="bi bi-arrow-clockwise me-1"></i>
                Refresh
              </>
            )}
          </Button>
          <Button variant="success" onClick={exportToCSV} disabled={exporting}>
            {exporting ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                Exporting...
              </>
            ) : (
              <>
                <i className="bi bi-file-earmark-spreadsheet me-1"></i>
                Export CSV
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Alert */}
      {alert.show && (
        <Alert 
          variant={alert.type} 
          className="border-0 mb-3"
          onClose={() => setAlert({ show: false, type: '', message: '' })} 
          dismissible
        >
          {alert.message}
        </Alert>
      )}

      {/* Statistics Cards */}
      <Row className="mb-3">
        <Col md={4} sm={6} xs={6}>
          <Card className="border-0 info-card">
            <Card.Body className="text-center">
              <i className="bi bi-file-earmark-text text-primary" style={{ fontSize: '1.75rem' }}></i>
              <h5 className="mb-0 mt-1 fw-bold">{logs.length}</h5>
              <p className="mb-0 text-muted small">Total Record</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4} sm={6} xs={6}>
          <Card className="border-0 info-card">
            <Card.Body className="text-center">
              <i className="bi bi-arrow-down-left text-success" style={{ fontSize: '1.75rem' }}></i>
              <h5 className="mb-0 mt-1 fw-bold text-success">{masukCount}</h5>
              <p className="mb-0 text-muted small">Total Masuk</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4} sm={6} xs={6}>
          <Card className="border-0 info-card">
            <Card.Body className="text-center">
              <i className="bi bi-arrow-up-right text-danger" style={{ fontSize: '1.75rem' }}></i>
              <h5 className="mb-0 mt-1 fw-bold text-danger">{keluarCount}</h5>
              <p className="mb-0 text-muted small">Total Keluar</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card className="mb-3 border-0 filter-section">
        <Card.Header className="bg-white border-0">
          <h6 className="mb-0 fw-bold">
            <i className="bi bi-search me-2"></i>
            Cari Laporan Santri
          </h6>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col xs={12} sm={6} md={3} className="mb-3 mb-md-0">
              <div className="form-group-custom" ref={dropdownRef}>
                <Form.Label>
                  <i className="bi bi-person me-1"></i>
                  Nama Santri
                </Form.Label>
                <Form.Control
                  type="text"
                  value={filters.santri_search}
                  onChange={(e) => handleSantriSearch(e.target.value)}
                  onFocus={() => setShowSantriDropdown(true)}
                  placeholder="Ketik nama/NIS..."
                />
                {showSantriDropdown && filters.santri_search && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      maxHeight: '200px',
                      overflowY: 'auto',
                      backgroundColor: 'white',
                      border: '1px solid #dee2e6',
                      borderRadius: '0.375rem',
                      zIndex: 1000,
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}
                  >
                    {filteredSantri.slice(0, 10).map(s => (
                      <div
                        key={s.id}
                        onClick={() => selectSantri(s)}
                        style={{
                          padding: '10px 15px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f0f0f0'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                      >
                        <div className="fw-medium">{s.nama}</div>
                        <small className="text-muted">NIS: {s.nis} | Kelas: {s.kelas}</small>
                      </div>
                    ))}
                    {filteredSantri.length === 0 && (
                      <div style={{ padding: '10px 15px', color: '#6c757d' }}>
                        <i className="bi bi-search me-1"></i>
                        Tidak ada santri ditemukan
                      </div>
                    )}
                  </div>
                )}
                {filters.santri_id && (
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 mt-1"
                    onClick={() => {
                      setFilters(prev => ({ ...prev, santri_id: '', santri_search: '' }));
                    }}
                  >
                    <i className="bi bi-x-circle text-danger"></i> Hapus filter
                  </Button>
                )}
              </div>
            </Col>
            <Col xs={12} sm={6} md={3} className="mb-3 mb-md-0">
              <div className="form-group-custom">
                <Form.Label>
                  <i className="bi bi-arrow-left-right me-1"></i>
                  Jenis Akses
                </Form.Label>
                <Form.Select
                  name="jenis_akses"
                  value={filters.jenis_akses}
                  onChange={handleFilterChange}
                >
                  <option value="">Semua Jenis</option>
                  <option value="masuk">Masuk</option>
                  <option value="keluar">Keluar</option>
                  <option value="izin_disetujui">Izin Disetujui</option>
                  <option value="izin_ditolak">Izin Ditolak</option>
                  <option value="denda_lunas">Denda Lunas</option>
                </Form.Select>
              </div>
            </Col>
            <Col xs={12} sm={6} md={3} className="mb-3 mb-md-0">
              <div className="form-group-custom">
                <Form.Label>
                  <i className="bi bi-calendar-month me-1"></i>
                  Bulan
                </Form.Label>
                <Form.Select name="bulan" value={filters.bulan} onChange={handlePeriodeChange}>
                  <option value="01">Januari</option>
                  <option value="02">Februari</option>
                  <option value="03">Maret</option>
                  <option value="04">April</option>
                  <option value="05">Mei</option>
                  <option value="06">Juni</option>
                  <option value="07">Juli</option>
                  <option value="08">Agustus</option>
                  <option value="09">September</option>
                  <option value="10">Oktober</option>
                  <option value="11">November</option>
                  <option value="12">Desember</option>
                </Form.Select>
              </div>
            </Col>
            <Col xs={12} sm={6} md={3}>
              <div className="form-group-custom">
                <Form.Label>
                  <i className="bi bi-calendar-year me-1"></i>
                  Tahun
                </Form.Label>
                <Form.Select name="tahun" value={filters.tahun} onChange={handlePeriodeChange}>
                  {Array.from({ length: 5 }, (_, i) => moment().year() - 2 + i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </Form.Select>
              </div>
            </Col>
          </Row>
          <Row className="mt-3">
            <Col xs={12} sm={6} md={3} className="mb-3 mb-md-0">
              <div className="form-group-custom">
                <Form.Label>
                  <i className="bi bi-calendar3 me-1"></i>
                  Tanggal Mulai
                </Form.Label>
                <Form.Control
                  type="date"
                  name="tanggal_dari"
                  value={filters.tanggal_dari}
                  onChange={handleFilterChange}
                />
              </div>
            </Col>
            <Col xs={12} sm={6} md={3} className="mb-3 mb-md-0">
              <div className="form-group-custom">
                <Form.Label>
                  <i className="bi bi-calendar-check me-1"></i>
                  Tanggal Selesai
                </Form.Label>
                <Form.Control
                  type="date"
                  name="tanggal_sampai"
                  value={filters.tanggal_sampai}
                  onChange={handleFilterChange}
                />
              </div>
            </Col>
            <Col xs={12} sm={12} md={6} className="d-flex align-items-end">
              <InputGroup>
                <Button variant="primary" onClick={handleApplyFilter}>
                  <i className="bi bi-search me-1"></i>
                  Cari Data
                </Button>
                <Button variant="outline-secondary" onClick={handleResetFilter}>
                  <i className="bi bi-arrow-counterclockwise me-1"></i>
                  Reset Filter
                </Button>
              </InputGroup>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Data Table */}
      <Card className="border-0">
        <Card.Header className="bg-white border-0 d-flex justify-content-between align-items-center">
          <h6 className="mb-0 fw-bold">
            <i className="bi bi-table me-2"></i>
            Laporan Santri
          </h6>
          <Badge bg="primary" className="px-3 py-2">
            <i className="bi bi-database me-1"></i>
            {logs.length} Record
          </Badge>
        </Card.Header>
        <Card.Body className="p-0">
          {loading ? (
            <div className="loading-state py-5">
              <div>
                <div className="spinner-border text-primary mb-3" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="text-muted">Memuat data akses...</p>
              </div>
            </div>
          ) : logs.length === 0 ? (
            <div className="empty-state py-5">
              <i className="bi bi-inbox"></i>
              <p className="mb-0">Belum ada data akses untuk periode yang dipilih</p>
            </div>
          ) : (
            <div className="table-responsive" style={{maxHeight: '600px', overflowY: 'auto'}}>
              <Table striped hover responsive className="mb-0">
                <thead className="sticky-top">
                  <tr>
                    <th className="ps-4">No</th>
                    <th>Waktu</th>
                    <th>Nama Santri</th>
                    <th>NIS</th>
                    <th>Kelas</th>
                    <th>Jenis Izin</th>
                    <th>Jenis Akses</th>
                    <th>Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, index) => (
                    <tr key={log.id}>
                      <td className="ps-4 fw-medium">{index + 1}</td>
                      <td>
                        <div className="d-flex align-items-center">
                          <i className="bi bi-clock text-muted me-2"></i>
                          <span className="fw-medium">
                            {moment(log.waktuAkses || log.waktu_akses || log.waktu).format('DD/MM/YYYY HH:mm:ss')}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <div className="avatar-circle me-2">
                            <i className="bi bi-person-circle text-muted"></i>
                          </div>
                          <span className="fw-medium">{log.santri_nama}</span>
                        </div>
                      </td>
                      <td className="text-muted">{log.santri_nis}</td>
                      <td>
                        <span className="badge bg-secondary">{log.santri_kelas}</span>
                      </td>
                      <td>
                        {log.jenis_izin_nama ? (
                          <span className="badge bg-info">{log.jenis_izin_nama}</span>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td>
                        {getJenisAksesBadge(log.jenisAkses || log.jenis_akses)}
                      </td>
                      <td className="text-muted">
                        {log.keterangan || <span className="text-muted">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Period Info */}
      <Row className="mt-4">
        <Col md={6}>
          <Card className="border-0">
            <Card.Header className="bg-white border-0">
              <h6 className="mb-0 fw-bold">
                <i className="bi bi-calendar-range text-primary me-2"></i>
                Periode Laporan
              </h6>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col xs={6}>
                  <div className="text-center p-3">
                    <i className="bi bi-calendar-event text-primary" style={{ fontSize: '2rem' }}></i>
                    <p className="text-muted small mb-1 mt-2">Dari</p>
                    <strong className="d-block">
                      {moment(filters.tanggal_dari).format('DD MMMM YYYY')}
                    </strong>
                  </div>
                </Col>
                <Col xs={6}>
                  <div className="text-center p-3">
                    <i className="bi bi-calendar-check text-success" style={{ fontSize: '2rem' }}></i>
                    <p className="text-muted small mb-1 mt-2">Sampai</p>
                    <strong className="d-block">
                      {moment(filters.tanggal_sampai).format('DD MMMM YYYY')}
                    </strong>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="border-0">
            <Card.Header className="bg-white border-0">
              <h6 className="mb-0 fw-bold">
                <i className="bi bi-pie-chart text-primary me-2"></i>
                Ringkasan
              </h6>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col xs={6}>
                  <div className="text-center p-3">
                    <div className="bg-success bg-opacity-10 rounded-circle d-inline-flex p-3 mb-2">
                      <i className="bi bi-arrow-down-left text-success" style={{ fontSize: '2rem' }}></i>
                    </div>
                    <h3 className="mb-0 text-success fw-bold">{masukCount}</h3>
                    <p className="text-muted small mb-0">Akses Masuk</p>
                  </div>
                </Col>
                <Col xs={6}>
                  <div className="text-center p-3">
                    <div className="bg-danger bg-opacity-10 rounded-circle d-inline-flex p-3 mb-2">
                      <i className="bi bi-arrow-up-right text-danger" style={{ fontSize: '2rem' }}></i>
                    </div>
                    <h3 className="mb-0 text-danger fw-bold">{keluarCount}</h3>
                    <p className="text-muted small mb-0">Akses Keluar</p>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Modal Reset Data */}
      <Modal show={showResetModal} onHide={() => { setShowResetModal(false); setConfirmText(''); }} centered className="modal-custom">
        <Modal.Header closeButton className="border-0">
          <Modal.Title>
            <i className="bi bi-exclamation-triangle-fill text-danger me-2"></i>
            Reset Semua Data Akses
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="danger" className="border-0">
            <i className="bi bi-info-circle-fill me-2"></i>
            <strong>Peringatan!</strong>
            <p className="mb-0 mt-1 small">
              Tindakan ini akan menghapus SEMUA data akses log secara permanen dan tidak dapat dikembalikan.
            </p>
          </Alert>
          
          <div className="form-group-custom mt-3">
            <Form.Label className="small fw-bold">
              <i className="bi bi-shield-lock me-1"></i>
              Ketik "RESET_SEMUA_DATA" untuk konfirmasi
            </Form.Label>
            <Form.Control
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Ketik: RESET_SEMUA_DATA"
              className="mt-2"
              autoFocus
            />
          </div>

          <div className="mt-3 small text-muted">
            <i className="bi bi-database-x me-1"></i>
            Data yang akan direset: <strong>{logs.length} record</strong>
          </div>
        </Modal.Body>
        <Modal.Footer className="border-0">
          <Button 
            variant="outline-secondary" 
            onClick={() => { setShowResetModal(false); setConfirmText(''); }}
            disabled={resetting}
          >
            <i className="bi bi-x-lg me-1"></i>
            Batal
          </Button>
          <Button 
            variant="danger" 
            onClick={handleReset}
            disabled={resetting || confirmText !== 'RESET_SEMUA_DATA'}
          >
            {resetting ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                Mereset...
              </>
            ) : (
              <>
                <i className="bi bi-trash me-1"></i>
                Reset Sekarang
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

export default Reports;
