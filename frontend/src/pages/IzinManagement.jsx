import { useState, useEffect, useRef } from 'react';
import {
  Container, Card, Button, Table, Modal, Form, Badge,
  Row, Col, Alert, InputGroup
} from 'react-bootstrap';
import { izinAPI, santriAPI } from '../api';
import moment from 'moment';
import { useAuth } from '../context/AuthContext';
import 'bootstrap-icons/font/bootstrap-icons.css';

function IzinManagement() {
  const { user } = useAuth();
  const [izinList, setIzinList] = useState([]);
  const [jenisIzin, setJenisIzin] = useState([]);
  const [santriList, setSantriList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedIzin, setSelectedIzin] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [formData, setFormData] = useState({
    santri_id: '',
    jenis_izin_id: '',
    alasan: '',
    tanggal_mulai: '',
    tanggal_selesai: ''
  });
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });
  const [resetting, setResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [searchSantri, setSearchSantri] = useState('');
  const [showSantriDropdown, setShowSantriDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchData();

    // Close dropdown when clicking outside
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

  const handleReset = async () => {
    if (confirmText !== 'RESET_SEMUA_IZIN') {
      showAlert('danger', 'Teks konfirmasi tidak sesuai!');
      return;
    }

    setResetting(true);
    try {
      const response = await izinAPI.reset(confirmText);
      if (response.data.success) {
        showAlert('success', response.data.message);
        setShowResetModal(false);
        setConfirmText('');
        await fetchData();
      }
    } catch (error) {
      showAlert('danger', 'Error: ' + (error.response?.data?.message || error.message));
    } finally {
      setResetting(false);
    }
  };

  const fetchData = async () => {
    try {
      const [izinRes, jenisRes, santriRes] = await Promise.all([
        izinAPI.getAll(),
        izinAPI.getJenisIzin(),
        santriAPI.getAll()
      ]);

      console.log('--- DEBUG IzinManagement ---');
      console.log('izinRes:', izinRes);
      console.log('jenisRes:', jenisRes);
      console.log('santriRes:', santriRes);

      if (izinRes.data.success) setIzinList(izinRes.data.data);
      
      if (jenisRes.data.success) {
        console.log('Jenis Izin loaded:', JSON.stringify(jenisRes.data.data));
        setJenisIzin(jenisRes.data.data);
      } else {
        console.warn('Jenis Izin response not success:', jenisRes);
      }
      
      if (santriRes.data.success) {
        console.log('Santri loaded:', santriRes.data.data.length, 'records');
        setSantriList(santriRes.data.data);
      } else {
        console.warn('Santri response not success:', santriRes);
      }
      
      console.log('--- END DEBUG ---');
    } catch (error) {
      console.error('Error fetching data:', error);
      showAlert('danger', 'Gagal memuat data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleShowModal = () => {
    setFormData({
      santri_id: '',
      jenis_izin_id: '',
      alasan: '',
      tanggal_mulai: '',
      tanggal_selesai: ''
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSearchSantri('');
    setShowSantriDropdown(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('=== FORM SUBMIT DEBUG ===');
    console.log('formData:', JSON.stringify(formData, null, 2));
    console.log('tanggal_mulai:', formData.tanggal_mulai);
    console.log('tanggal_selesai:', formData.tanggal_selesai);
    console.log('jenis_izin_id:', formData.jenis_izin_id);
    
    // Cari nama jenis izin untuk debug
    const jenis = jenisIzin.find(j => j.id === formData.jenis_izin_id);
    console.log('Jenis Izin:', jenis?.namaIzin, 'durasiJam:', jenis?.durasiJam);
    
    try {
      const response = await izinAPI.create(formData);
      console.log('Create response:', response);
      if (response.data.success) {
        showAlert('success', response.data.message);
        handleCloseModal();
        fetchData();
      }
    } catch (error) {
      showAlert('danger', 'Error: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleApprove = async (id) => {
    if (window.confirm('Apakah Anda yakin ingin menyetujui izin ini?')) {
      try {
        await izinAPI.approve(id, { approvedBy: user?.displayName || user?.email || 'Admin' });
        showAlert('success', 'Izin berhasil disetujui!');
        fetchData();
      } catch (error) {
        showAlert('danger', 'Error: ' + error.message);
      }
    }
  };

  const handleReject = async (id) => {
    const reason = prompt('Alasan penolakan:');
    if (reason) {
      try {
        await izinAPI.reject(id, { approvedBy: user?.displayName || user?.email || 'Admin', rejectedReason: reason });
        showAlert('success', 'Izin ditolak!');
        fetchData();
      } catch (error) {
        showAlert('danger', 'Error: ' + error.message);
      }
    }
  };

  const handleComplete = async (id) => {
    const confirmed = window.confirm('Tandai izin ini sebagai selesai? Jika santri kembali terlambat, denda akan dikenakan otomatis.');
    if (!confirmed) return;
    try {
      const response = await izinAPI.complete(id, new Date().toISOString());
      if (response.data.success) {
        showAlert(response.data.message.includes('Denda') ? 'warning' : 'success', response.data.message);
        fetchData();
      }
    } catch (error) {
      showAlert('danger', 'Error: ' + error.message);
    }
  };

  const handleShowDetail = async (id) => {
    try {
      const response = await izinAPI.getById(id);
      if (response.data.success) {
        setSelectedIzin(response.data.data);
        setShowDetailModal(true);
      }
    } catch (error) {
      showAlert('danger', 'Error: ' + error.message);
    }
  };

  const filteredIzin = filterStatus === 'all'
    ? izinList
    : izinList.filter(i => i.status === filterStatus);

  const getStatusBadge = (status) => {
    const badges = {
      'pending': { class: 'bg-warning', icon: 'bi-hourglass-split', label: 'Pending' },
      'approved': { class: 'bg-success', icon: 'bi-check-circle', label: 'Disetujui' },
      'rejected': { class: 'bg-danger', icon: 'bi-x-circle', label: 'Ditolak' },
      'completed': { class: 'bg-info', icon: 'bi-check-all', label: 'Selesai' }
    };
    const badge = badges[status] || { class: 'bg-secondary', icon: 'bi-question-circle', label: status };
    return (
      <Badge className={badge.class}>
        <i className={`bi ${badge.icon} me-1`}></i>
        {badge.label}
      </Badge>
    );
  };

  const getStatusCount = (status) => {
    return izinList.filter(i => i.status === status).length;
  };

  /**
   * Hitung sisa waktu untuk izin yang approved
   */
  const getRemainingTime = (izin) => {
    if (!izin.tanggal_selesai || izin.status !== 'approved') return null;
    const now = new Date();
    const deadline = new Date(izin.tanggal_selesai);
    const diffMs = deadline - now;

    if (diffMs <= 0) return { expired: true, text: 'EXPIRED' };

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      return { expired: false, text: `${days}h ${hours % 24}j` };
    }
    return { expired: false, text: `${hours}j ${minutes}m` };
  };

  /**
   * Hitung denda yang akan dikenakan jika telat
   */
  const getEstimatedDenda = (izin) => {
    if (!izin.tanggal_selesai || izin.status !== 'approved') return null;
    const now = new Date();
    const deadline = new Date(izin.tanggal_selesai);

    if (now <= deadline) return null; // Belum telat

    const terlambatMs = now - deadline;
    const terlambatJam = Math.max(1, Math.floor(terlambatMs / (1000 * 60 * 60)));
    const terlambatHari = Math.ceil(terlambatJam / 24);

    const namaIzin = izin.jenis_izin_nama || '';
    if (namaIzin === 'Izin Keluar') {
      return terlambatJam * 5000;
    }
    return terlambatHari * 10000;
  };

  return (
    <Container className="page-content">
      {/* Page Header */}
      <div className="page-header d-flex justify-content-between align-items-center mb-4">
        <h2 className="page-title mb-0">
          <i className="bi bi-file-earmark-check"></i>
          Pengajuan Izin
        </h2>
        <div className="d-flex gap-2">
          <Button variant="outline-danger" onClick={() => setShowResetModal(true)}>
            <i className="bi bi-arrow-counterclockwise me-1"></i>
            Reset Data
          </Button>
          <Button variant="primary" onClick={handleShowModal}>
            <i className="bi bi-plus-lg"></i>
            Ajukan Izin
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

      {/* Status Cards */}
      <Row className="mb-3">
        <Col md={3} sm={6} xs={6}>
          <Card className="border-0 info-card">
            <Card.Body className="text-center">
              <i className="bi bi-hourglass-split text-warning" style={{ fontSize: '1.5rem' }}></i>
              <h5 className="mb-0 mt-1 fw-bold">{getStatusCount('pending')}</h5>
              <p className="mb-0 text-muted small">Pending</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6} xs={6}>
          <Card className="border-0 info-card">
            <Card.Body className="text-center">
              <i className="bi bi-check-circle text-success" style={{ fontSize: '1.5rem' }}></i>
              <h5 className="mb-0 mt-1 fw-bold">{getStatusCount('approved')}</h5>
              <p className="mb-0 text-muted small">Disetujui</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6} xs={6}>
          <Card className="border-0 info-card">
            <Card.Body className="text-center">
              <i className="bi bi-x-circle text-danger" style={{ fontSize: '1.5rem' }}></i>
              <h5 className="mb-0 mt-1 fw-bold">{getStatusCount('rejected')}</h5>
              <p className="mb-0 text-muted small">Ditolak</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6} xs={6}>
          <Card className="border-0 info-card">
            <Card.Body className="text-center">
              <i className="bi bi-check-all text-info" style={{ fontSize: '1.5rem' }}></i>
              <h5 className="mb-0 mt-1 fw-bold">{getStatusCount('completed')}</h5>
              <p className="mb-0 text-muted small">Selesai</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Filter */}
      <Card className="mb-4 border-0 filter-section">
        <Card.Body>
          <Row className="align-items-center">
            <Col md={3}>
              <Form.Label className="mb-0 fw-medium">
                <i className="bi bi-funnel me-2"></i>
                Filter Status:
              </Form.Label>
            </Col>
            <Col md={9}>
              <Form.Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{ maxWidth: '300px' }}
              >
                <option value="all">📋 Semua Izin</option>
                <option value="pending">⏳ Pending</option>
                <option value="approved">✅ Disetujui</option>
                <option value="rejected">❌ Ditolak</option>
                <option value="completed">✔️ Selesai</option>
              </Form.Select>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* List Izin */}
      <Card className="border-0">
        <Card.Body className="p-0">
          {loading ? (
            <div className="loading-state py-5">
              <div>
                <div className="spinner-border text-primary mb-3" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="text-muted">Memuat data izin...</p>
              </div>
            </div>
          ) : filteredIzin.length === 0 ? (
            <div className="empty-state py-5">
              <i className="bi bi-inbox"></i>
              <p className="mb-0">
                {filterStatus !== 'all' 
                  ? 'Tidak ada izin dengan status yang dipilih' 
                  : 'Belum ada pengajuan izin'}
              </p>
              {filterStatus === 'all' && (
                <Button variant="primary" className="mt-3" onClick={handleShowModal}>
                  <i className="bi bi-plus-lg"></i>
                  Ajukan Izin Pertama
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="table-responsive table-desktop-only d-none d-md-block">
                <Table striped hover responsive className="mb-0">
                  <thead>
                    <tr>
                      <th className="ps-4">No</th>
                      <th>Tanggal Pengajuan</th>
                      <th>Nama Santri</th>
                      <th>Kelas</th>
                      <th>Jenis Izin</th>
                      <th>Tanggal Mulai</th>
                      <th>Batas Waktu</th>
                      <th>Sisa Waktu</th>
                      <th>Status</th>
                      <th className="text-end pe-4">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIzin.map((izin, index) => {
                      const remaining = getRemainingTime(izin);
                      const estDenda = getEstimatedDenda(izin);
                      return (
                        <tr key={izin.id}>
                          <td className="ps-4 fw-medium">{index + 1}</td>
                          <td>
                            <small className="text-muted">
                              {moment(izin.createdAt?.toDate ? izin.createdAt.toDate() : izin.created_at).format('DD/MM/YYYY HH:mm')}
                            </small>
                          </td>
                          <td>
                            <div className="d-flex align-items-center">
                              <div className="avatar-circle me-2">
                                <i className="bi bi-person-circle text-muted"></i>
                              </div>
                              <span className="fw-medium">{izin.santri_nama}</span>
                            </div>
                          </td>
                          <td>
                            <span className="badge bg-secondary">{izin.santri_kelas}</span>
                          </td>
                          <td className="text-muted">{izin.jenis_izin_nama}</td>
                          <td>
                            <small className="text-muted">
                              {moment(izin.tanggal_mulai).format('DD/MM/YYYY HH:mm')}
                            </small>
                          </td>
                          <td>
                            {izin.tanggal_selesai ? (
                              <small className={remaining?.expired ? 'text-danger fw-bold' : 'text-muted'}>
                                {moment(izin.tanggal_selesai).format('DD/MM/YYYY HH:mm')}
                              </small>
                            ) : (
                              <small className="text-muted">-</small>
                            )}
                          </td>
                          <td>
                            {remaining && (
                              <Badge className={remaining.expired ? 'bg-danger' : 'bg-warning text-dark'}>
                                {remaining.expired && <i className="bi bi-exclamation-triangle me-1"></i>}
                                {remaining.text}
                              </Badge>
                            )}
                            {estDenda && (
                              <div className="text-danger small mt-1">
                                <i className="bi bi-cash-stack me-1"></i>
                                Denda: Rp{estDenda.toLocaleString('id-ID')}
                              </div>
                            )}
                          </td>
                          <td>{getStatusBadge(izin.status)}</td>
                          <td className="text-end pe-4">
                            <div className="btn-group-custom justify-content-end">
                              <Button
                                variant="outline-info"
                                size="sm"
                                onClick={() => handleShowDetail(izin.id)}
                                title="Detail"
                              >
                                <i className="bi bi-eye"></i>
                              </Button>
                              {izin.status === 'pending' && (
                                <>
                                  <Button
                                    variant="outline-success"
                                    size="sm"
                                    onClick={() => handleApprove(izin.id)}
                                    title="Setujui"
                                  >
                                    <i className="bi bi-check-lg"></i>
                                  </Button>
                                  <Button
                                    variant="outline-danger"
                                    size="sm"
                                    onClick={() => handleReject(izin.id)}
                                    title="Tolak"
                                  >
                                    <i className="bi bi-x-lg"></i>
                                  </Button>
                                </>
                              )}
                              {izin.status === 'approved' && (
                                <Button
                                  variant="outline-warning"
                                  size="sm"
                                  onClick={() => handleComplete(izin.id)}
                                  title="Selesaikan Izin"
                                >
                                  <i className="bi bi-check-circle"></i>
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="d-md-none p-2">
                {filteredIzin.map((izin) => {
                  const remaining = getRemainingTime(izin);
                  const estDenda = getEstimatedDenda(izin);
                  return (
                    <div key={izin.id} className="mobile-card-item">
                      <div className="mobile-card-header">
                        <div className="d-flex align-items-center">
                          <div className="avatar-circle me-2">
                            <i className="bi bi-person-circle text-primary"></i>
                          </div>
                          <div>
                            <strong className="d-block">{izin.santri_nama}</strong>
                            <small className="text-muted">{izin.santri_kelas}</small>
                          </div>
                        </div>
                        <div className="d-flex align-items-center gap-1">
                          {getStatusBadge(izin.status)}
                          {izin.status === 'approved' && remaining && (
                            <Badge className={remaining.expired ? 'bg-danger' : 'bg-warning text-dark'}>
                              {remaining.text}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="mobile-card-body">
                        <div className="mobile-card-row">
                          <span className="mobile-card-label">Jenis Izin</span>
                          <span className="mobile-card-value">{izin.jenis_izin_nama}</span>
                        </div>
                        <div className="mobile-card-row">
                          <span className="mobile-card-label">Batas Waktu</span>
                          <span className="mobile-card-value">
                            {izin.tanggal_selesai ? moment(izin.tanggal_selesai).format('DD/MM/YYYY HH:mm') : '-'}
                          </span>
                        </div>
                        {estDenda && (
                          <div className="mobile-card-row text-danger">
                            <span className="mobile-card-label">Estimasi Denda</span>
                            <span className="mobile-card-value fw-bold">Rp{estDenda.toLocaleString('id-ID')}</span>
                          </div>
                        )}
                      </div>
                      <div className="mobile-card-actions">
                        <Button
                          variant="outline-info"
                          size="sm"
                          onClick={() => handleShowDetail(izin.id)}
                        >
                          <i className="bi bi-eye me-1"></i>
                          Detail
                        </Button>
                        {izin.status === 'pending' && (
                          <>
                            <Button
                              variant="outline-success"
                              size="sm"
                              onClick={() => handleApprove(izin.id)}
                            >
                              <i className="bi bi-check-lg me-1"></i>
                              Setujui
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleReject(izin.id)}
                            >
                              <i className="bi bi-x-lg me-1"></i>
                              Tolak
                            </Button>
                          </>
                        )}
                        {izin.status === 'approved' && (
                          <Button
                            variant="outline-warning"
                            size="sm"
                            onClick={() => handleComplete(izin.id)}
                          >
                            <i className="bi bi-check-circle me-1"></i>
                            Selesaikan
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card.Body>
      </Card>

      {/* Modal Pengajuan Izin */}
      <Modal show={showModal} onHide={handleCloseModal} size="lg" className="modal-custom">
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-file-earmark-plus-fill me-2"></i>
            Ajukan Izin Baru
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Row>
              <Col md={6}>
                <div className="form-group-custom">
                  <Form.Label>
                    <i className="bi bi-person me-1"></i>
                    Nama Santri
                  </Form.Label>
                  <div ref={dropdownRef} style={{ position: 'relative' }}>
                    <Form.Control
                      type="text"
                      value={searchSantri}
                      onChange={(e) => {
                        setSearchSantri(e.target.value);
                        setShowSantriDropdown(true);
                        if (!e.target.value) {
                          setFormData({...formData, santri_id: ''});
                        }
                      }}
                      onFocus={() => setShowSantriDropdown(true)}
                      placeholder="Ketik untuk mencari santri..."
                      required
                    />
                    {showSantriDropdown && searchSantri && (
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
                        {santriList
                          .filter(s => 
                            s.nama.toLowerCase().includes(searchSantri.toLowerCase()) ||
                            s.nis.toLowerCase().includes(searchSantri.toLowerCase()) ||
                            s.kelas.toLowerCase().includes(searchSantri.toLowerCase())
                          )
                          .slice(0, 10)
                          .map(s => (
                            <div
                              key={s.id}
                              onClick={() => {
                                setFormData({...formData, santri_id: s.id});
                                setSearchSantri(`${s.nama} (${s.nis})`);
                                setShowSantriDropdown(false);
                              }}
                              style={{
                                padding: '10px 15px',
                                cursor: 'pointer',
                                borderBottom: '1px solid #f0f0f0'
                              }}
                              onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                              onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                            >
                              <div className="fw-medium">{s.nama}</div>
                              <small className="text-muted">NIS: {s.nis} | Kelas: {s.kelas}</small>
                            </div>
                          ))}
                        {santriList.filter(s => 
                          s.nama.toLowerCase().includes(searchSantri.toLowerCase()) ||
                          s.nis.toLowerCase().includes(searchSantri.toLowerCase()) ||
                          s.kelas.toLowerCase().includes(searchSantri.toLowerCase())
                        ).length === 0 && (
                          <div style={{ padding: '10px 15px', color: '#6c757d' }}>
                            <i className="bi bi-search me-1"></i>
                            Tidak ada santri ditemukan
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {formData.santri_id && (
                    <Form.Text className="text-success">
                      <i className="bi bi-check-circle me-1"></i>
                      Santri terpilih
                    </Form.Text>
                  )}
                </div>
              </Col>
              <Col md={6}>
                <div className="form-group-custom">
                  <Form.Label>
                    <i className="bi bi-tag me-1"></i>
                    Jenis Izin
                  </Form.Label>
                  <Form.Select
                    value={formData.jenis_izin_id}
                    onChange={(e) => setFormData({...formData, jenis_izin_id: e.target.value})}
                    required
                  >
                    <option value="">Pilih Jenis Izin</option>
                    {jenisIzin.length > 0 ? (
                      jenisIzin.map(j => (
                        <option key={j.id} value={j.id}>{j.namaIzin || j.nama_izin || 'Unknown'}</option>
                      ))
                    ) : (
                      <>
                        <option value="1">Izin Keluar</option>
                        <option value="2">Izin Pulang</option>
                        <option value="3">Izin Berobat</option>
                        <option value="4">Izin Keluarga</option>
                      </>
                    )}
                  </Form.Select>
                  {jenisIzin.length === 0 && (
                    <Form.Text className="text-muted">
                      <i className="bi bi-info-circle me-1"></i>
                      Menggunakan data default (belum terhubung ke Firebase)
                    </Form.Text>
                  )}
                </div>
              </Col>
            </Row>
            <div className="form-group-custom">
              <Form.Label>
                <i className="bi bi-card-text me-1"></i>
                Alasan
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={formData.alasan}
                onChange={(e) => setFormData({...formData, alasan: e.target.value})}
                placeholder="Jelaskan alasan pengajuan izin..."
                required
              />
            </div>
            <Row>
              <Col md={6}>
                <div className="form-group-custom">
                  <Form.Label>
                    <i className="bi bi-calendar-event me-1"></i>
                    Tanggal Mulai
                  </Form.Label>
                  <Form.Control
                    type="datetime-local"
                    value={formData.tanggal_mulai}
                    onChange={(e) => setFormData({...formData, tanggal_mulai: e.target.value})}
                    required
                  />
                </div>
              </Col>
              <Col md={6}>
                <div className="form-group-custom">
                  <Form.Label>
                    <i className="bi bi-calendar-check me-1"></i>
                    Tanggal Selesai
                  </Form.Label>
                  <Form.Control
                    type="datetime-local"
                    value={formData.tanggal_selesai}
                    onChange={(e) => setFormData({...formData, tanggal_selesai: e.target.value})}
                    required
                  />
                </div>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={handleCloseModal}>
              <i className="bi bi-x-lg me-1"></i>
              Batal
            </Button>
            <Button variant="primary" type="submit">
              <i className="bi bi-send me-1"></i>
              Ajukan
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal Detail Izin */}
      <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} className="modal-custom">
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-file-earmark-text me-2"></i>
            Detail Pengajuan Izin
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedIzin && (
            <div className="timeline">
              <div className="timeline-item">
                <div className="timeline-item-content">
                  <Row>
                    <Col md={6}>
                      <div className="d-flex align-items-center mb-2">
                        <i className="bi bi-person-circle text-primary me-2" style={{ fontSize: '1.5rem' }}></i>
                        <div>
                          <small className="text-muted d-block">Nama Santri</small>
                          <strong>{selectedIzin.santri_nama}</strong>
                        </div>
                      </div>
                    </Col>
                    <Col md={6}>
                      <div className="d-flex align-items-center mb-2">
                        <i className="bi bi-card-text text-primary me-2" style={{ fontSize: '1.5rem' }}></i>
                        <div>
                          <small className="text-muted d-block">NIS</small>
                          <strong>{selectedIzin.santri_nis}</strong>
                        </div>
                      </div>
                    </Col>
                  </Row>
                </div>
              </div>
              
              <div className="timeline-item">
                <div className="timeline-item-content">
                  <Row>
                    <Col md={6}>
                      <div className="d-flex align-items-center mb-2">
                        <i className="bi bi-tag text-primary me-2" style={{ fontSize: '1.5rem' }}></i>
                        <div>
                          <small className="text-muted d-block">Jenis Izin</small>
                          <strong>{selectedIzin.jenis_izin_nama}</strong>
                        </div>
                      </div>
                    </Col>
                    <Col md={6}>
                      <div className="d-flex align-items-center mb-2">
                        <i className="bi bi-calendar-event text-primary me-2" style={{ fontSize: '1.5rem' }}></i>
                        <div>
                          <small className="text-muted d-block">Periode</small>
                          <strong>
                            {moment(selectedIzin.tanggal_mulai).format('DD/MM/YYYY HH:mm')}
                            {' - '}
                            {moment(selectedIzin.tanggal_selesai).format('DD/MM/YYYY HH:mm')}
                          </strong>
                        </div>
                      </div>
                    </Col>
                  </Row>
                </div>
              </div>
              
              <div className="timeline-item">
                <div className="timeline-item-content">
                  <div className="d-flex align-items-center mb-2">
                    <i className="bi bi-chat-left-text text-primary me-2" style={{ fontSize: '1.5rem' }}></i>
                    <div>
                      <small className="text-muted d-block">Alasan</small>
                      <p className="mb-0">{selectedIzin.alasan}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="timeline-item">
                <div className="timeline-item-content">
                  <div className="d-flex align-items-center mb-2">
                    <i className="bi bi-toggle-on text-primary me-2" style={{ fontSize: '1.5rem' }}></i>
                    <div>
                      <small className="text-muted d-block">Status</small>
                      <div className="mt-1">{getStatusBadge(selectedIzin.status)}</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {selectedIzin.approved_by && (
                <div className="timeline-item">
                  <div className="timeline-item-content">
                    <div className="d-flex align-items-center mb-2">
                      <i className="bi bi-person-check text-success me-2" style={{ fontSize: '1.5rem' }}></i>
                      <div>
                        <small className="text-muted d-block">Disetujui Oleh</small>
                        <strong>{selectedIzin.approved_by}</strong>
                      </div>
                    </div>
                    <div className="d-flex align-items-center">
                      <i className="bi bi-clock text-success me-2" style={{ fontSize: '1.5rem' }}></i>
                      <div>
                        <small className="text-muted d-block">Tanggal Persetujuan</small>
                        <strong>{moment(selectedIzin.approved_at).format('DD/MM/YYYY HH:mm')}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowDetailModal(false)}>
            <i className="bi bi-x-lg me-1"></i>
            Tutup
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Reset Data Izin */}
      <Modal show={showResetModal} onHide={() => { setShowResetModal(false); setConfirmText(''); }} centered className="modal-custom">
        <Modal.Header closeButton className="border-0">
          <Modal.Title>
            <i className="bi bi-exclamation-triangle-fill text-danger me-2"></i>
            Reset Semua Data Izin
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="danger" className="border-0">
            <i className="bi bi-info-circle-fill me-2"></i>
            <strong>Peringatan!</strong>
            <p className="mb-0 mt-1 small">
              Tindakan ini akan menghapus SEMUA data pengajuan izin secara permanen dan tidak dapat dikembalikan.
            </p>
          </Alert>
          
          <div className="form-group-custom mt-3">
            <Form.Label className="small fw-bold">
              <i className="bi bi-shield-lock me-1"></i>
              Ketik "RESET_SEMUA_IZIN" untuk konfirmasi
            </Form.Label>
            <Form.Control
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Ketik: RESET_SEMUA_IZIN"
              className="mt-2"
              autoFocus
            />
          </div>

          <div className="mt-3 small text-muted">
            <i className="bi bi-file-earmark-x me-1"></i>
            Data yang akan direset: <strong>{izinList.length} pengajuan izin</strong>
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
            disabled={resetting || confirmText !== 'RESET_SEMUA_IZIN'}
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

export default IzinManagement;
