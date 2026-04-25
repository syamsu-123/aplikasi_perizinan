import { useState, useEffect } from 'react';
import { Row, Col, Card, Container, Badge, Button } from 'react-bootstrap';
import { aksesAPI, izinAPI, santriAPI } from '../api';
import { usePopup } from '../components/Popup'; // Import usePopup
import moment from 'moment';
import 'bootstrap-icons/font/bootstrap-icons.css';

function Dashboard({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [todayLogs, setTodayLogs] = useState([]);
  const [izinStats, setIzinStats] = useState({ pending: 0, approved: 0, rejected: 0, completed: 0 });
  const [outsideSantri, setOutsideSantri] = useState([]);
  const [izinPulang, setIzinPulang] = useState([]);
  const [loading, setLoading] = useState(true);
  const [outsideWithIzin, setOutsideWithIzin] = useState(0);
  const [now, setNow] = useState(new Date());
  const [alert, setAlert] = useState(null);
  const [jenisIzinMap, setJenisIzinMap] = useState({}); // State baru untuk menyimpan map jenis izin

  // Update waktu setiap detik untuk countdown realtime
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchJenisIzinData(); // Panggil untuk memuat jenis izin
    fetchDashboardData();
  }, []);

  const fetchJenisIzinData = async () => {
    try {
      const res = await izinAPI.getJenisIzin();
      if (res.data.success) {
        const map = {};
        res.data.data.forEach(jenis => {
          map[jenis.id] = jenis.namaIzin || jenis.nama_izin;
        });
        setJenisIzinMap(map);
      }
    } catch (error) {
      console.error('Error fetching jenis izin for dashboard:', error);
    }
  };

  const _handleRefresh = async () => {
    setLoading(true);
    await fetchDashboardData();
    setLoading(false);
  };

  const formatRemainingTime = (tanggalSelesai) => {
    if (!tanggalSelesai) return { text: '-', color: 'text-muted' };
    const diffMs = new Date(tanggalSelesai) - now;
    if (diffMs <= 0) {
      const hours = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60));
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      if (days > 0) {
        return { text: `Terlambat ${days}h ${remainingHours}j`, color: 'text-danger fw-bold' };
      }
      return { text: `Terlambat ${hours}j ${Math.floor((Math.abs(diffMs) % (1000*60*60))/(1000*60))}m`, color: 'text-danger fw-bold' };
    }
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      return { text: `${days}h ${hours % 24}j`, color: 'text-success' };
    }
    return { text: `${hours}j ${minutes}m`, color: hours < 2 ? 'text-warning fw-bold' : 'text-success' };
  };

  const handleCompleteIzin = async (izinId) => {
    if (!window.confirm('Tandai izin ini sebagai selesai? Denda akan dikenakan jika telat.')) return;
    try {
      const res = await izinAPI.complete(izinId, new Date().toISOString());
      setAlert({ type: 'success', message: res.data.message });
      setTimeout(() => setAlert(null), 3000);
      fetchDashboardData();
    } catch (err) {
      setAlert({ type: 'danger', message: err.message });
      setTimeout(() => setAlert(null), 3000);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const [statsRes, logsRes, izinRes, santriRes] = await Promise.all([
        aksesAPI.getStats(),
        aksesAPI.getToday(),
        izinAPI.getAll(),
        santriAPI.getAll()
      ]);

      // Total santri dari Firebase Firestore
      let totalSantri = 0;
      if (santriRes.data.success) {
        totalSantri = santriRes.data.data.length;
      }

      // Hitung santri yang sedang di luar (berdasarkan akses terakhir)
      const accessData = statsRes.data.success ? statsRes.data.data : {};
      
      if (statsRes.data.success) {
        const statsData = statsRes.data.data;
        setStats({
          total_santri: totalSantri,
          inside_count: statsData.inside_count,
          outside_count: statsData.outside_count,
          today_logs: statsData.today_logs, // Use today_logs from stats
          outside_with_izin: statsData.outside_with_izin,
          outside_santri: statsData.outside_santri,
          izin_pulang: statsData.izin_pulang
        });
        setOutsideSantri(statsData.outside_santri || []); // Directly use from stats
        setIzinPulang(statsData.izin_pulang || []); // Directly use from stats
        setOutsideWithIzin(statsData.outside_with_izin || 0); // Directly use from stats
      }

      if (izinRes.data.success) {
        const izinList = izinRes.data.data;
        const counts = {
          pending: izinList.filter(i => i.status === 'pending').length,
          approved: izinList.filter(i => i.status === 'approved').length,
          rejected: izinList.filter(i => i.status === 'rejected').length,
          completed: izinList.filter(i => i.status === 'completed').length
        };
        setIzinStats(counts);
      }

      if (logsRes.data.success) { // Today logs
        // No need to enrich here, aksesAPI.record already stores santri_nama etc.
        setTodayLogs(logsRes.data.data.slice(0, 10));
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container>
        <div className="loading-state">
          <div>
            <div className="spinner-border text-primary mb-3" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="text-muted">Memuat dashboard...</p>
          </div>
        </div>
      </Container>
    );
  }

  const statCards = [
    {
      title: 'Total Santri',
      value: stats?.total_santri || 0,
      icon: 'bi-people',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      subtitle: 'Data santri aktif'
    },
    {
      title: 'Di Dalam Pondok',
      value: stats?.inside_count || 0,
      icon: 'bi-house-check',
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      subtitle: 'Santri hadir'
    },
    {
      title: 'Di Luar Pondok',
      value: stats?.outside_count || 0,
      icon: 'bi-person-walking',
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      subtitle: `Sedang izin: ${outsideWithIzin}`
    },
    {
      title: 'Akses Hari Ini',
      value: stats?.today_logs || 0,
      icon: 'bi-activity',
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      subtitle: 'Check in/out'
    }
  ];

  return (
    <Container className="page-content">
      {/* Page Header */}
      <div className="page-header d-flex justify-content-between align-items-center mb-4">
        <h2 className="page-title mb-0 d-flex align-items-center gap-2">
          <img 
            src="/logo app.png" 
            alt="Logo" 
            style={{
              height: '45px',
              width: 'auto',
              borderRadius: '8px'
            }}
          />
          <span>Dashboard</span>
        </h2>
        <div className="text-muted">
          <i className="bi bi-calendar3 me-2"></i>
          {moment().format('DD MMMM YYYY')}
        </div>
      </div>

      {/* Statistics Cards */}
      <Row className="mb-3 g-2">
        {statCards.map((stat, index) => (
          <Col md={6} sm={6} xs={6} key={index}>
            <Card
              className="stat-card border-0 h-100"
              style={{ background: stat.gradient }}
            >
              <Card.Body className="position-relative">
                <div>
                  <Card.Title className="text-white mb-1" style={{fontSize: '0.8rem'}}>
                    <i className={`bi ${stat.icon} me-1`}></i>
                    {stat.title}
                  </Card.Title>
                  <Card.Text className="fw-bold text-white mb-1" style={{fontSize: '1.5rem'}}>
                    {stat.value}
                  </Card.Text>
                  <small className="text-white" style={{ opacity: 0.9, fontSize: '0.65rem' }}>
                    {stat.subtitle}
                  </small>
                </div>
                <i className={`bi ${stat.icon} stat-icon text-white`}></i>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Alert */}
      {alert && (
        <Row>
          <Col>
            <div className={`alert alert-${alert.type} border-0 mb-3`} role="alert">
              <i className={`bi ${alert.type === 'success' ? 'bi-check-circle' : 'bi-exclamation-circle'} me-2`}></i>
              {alert.message}
            </div>
          </Col>
        </Row>
      )}

      {/* Izin Statistics Cards */}
      <Row className="mb-3">
        <Col>
          <Card className="border-0">
            <Card.Header className="bg-white border-0">
              <h5 className="mb-0">
                <i className="bi bi-file-earmark-text-fill text-primary me-2"></i>
                Statistik Perizinan
              </h5>
            </Card.Header>
            <Card.Body>
              <Row className="g-2">
                <Col xs={6}>
                  <Card className="border-0 h-100" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
                    <Card.Body className="text-center text-white">
                      <i className="bi bi-clock-hour-8" style={{ fontSize: '1.75rem', opacity: 0.9 }}></i>
                      <h5 className="fw-bold mt-1 mb-0" style={{fontSize: '1.25rem'}}>{izinStats.pending}</h5>
                      <p className="mb-0" style={{ opacity: 0.9, fontSize: '0.7rem' }}>Menunggu</p>
                    </Card.Body>
                  </Card>
                </Col>
                <Col xs={6}>
                  <Card className="border-0 h-100" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                    <Card.Body className="text-center text-white">
                      <i className="bi bi-check-circle" style={{ fontSize: '1.75rem', opacity: 0.9 }}></i>
                      <h5 className="fw-bold mt-1 mb-0" style={{fontSize: '1.25rem'}}>{izinStats.approved}</h5>
                      <p className="mb-0" style={{ opacity: 0.9, fontSize: '0.7rem' }}>Disetujui</p>
                    </Card.Body>
                  </Card>
                </Col>
                <Col xs={6}>
                  <Card className="border-0 h-100" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
                    <Card.Body className="text-center text-white">
                      <i className="bi bi-x-circle" style={{ fontSize: '1.75rem', opacity: 0.9 }}></i>
                      <h5 className="fw-bold mt-1 mb-0" style={{fontSize: '1.25rem'}}>{izinStats.rejected}</h5>
                      <p className="mb-0" style={{ opacity: 0.9, fontSize: '0.7rem' }}>Ditolak</p>
                    </Card.Body>
                  </Card>
                </Col>
                <Col xs={6}>
                  <Card className="border-0 h-100" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}>
                    <Card.Body className="text-center text-white">
                      <i className="bi bi-check2-square" style={{ fontSize: '1.75rem', opacity: 0.9 }}></i>
                      <h5 className="fw-bold mt-1 mb-0" style={{fontSize: '1.25rem'}}>{izinStats.completed}</h5>
                      <p className="mb-0" style={{ opacity: 0.9, fontSize: '0.7rem' }}>Selesai</p>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Santri Izin Pulang */}
      {izinPulang.length > 0 && (
        <Row className="mb-4">
          <Col>
            <Card className="border-0">
              <Card.Header className="bg-white border-0">
                <h5 className="mb-0">
                  <i className="bi bi-house-door-fill text-danger me-2"></i>
                  Santri Sedang Izin Pulang
                  <Badge bg="danger" className="ms-2">{izinPulang.length}</Badge>
                </h5>
              </Card.Header>
              <Card.Body className="p-0">
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th className="ps-4">No</th>
                        <th>Nama Santri</th>
                        <th>NIS</th>
                        <th>Kelas</th>
                        <th>Batas Waktu</th>
                        <th>Sisa Waktu</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {izinPulang.map((s, index) => {
                        const remaining = formatRemainingTime(s.izin_info?.tanggal_selesai);
                        return (
                          <tr key={s.izin_id || s.id}>
                            <td className="ps-4 fw-medium">{index + 1}</td>
                            <td>
                              <div className="d-flex align-items-center">
                                <div className="avatar-circle me-2">
                                  <i className="bi bi-person-circle text-muted"></i>
                                </div>
                                <span className="fw-medium">{s.nama}</span>
                              </div>
                            </td>
                            <td className="text-muted">{s.nis}</td>
                            <td>
                              <span className="badge bg-secondary">{s.kelas}</span>
                            </td>
                            <td>
                              <small className={remaining.color}>
                                {s.izin_info?.tanggal_selesai ? moment(s.izin_info.tanggal_selesai).format('DD/MM/YYYY HH:mm') : 'N/A'}
                              </small>
                            </td>
                            <td>
                              <span className={remaining.color}>
                                <i className="bi bi-clock me-1"></i>
                                {remaining.text}
                              </span>
                            </td>
                            <td>
                              <Button
                                variant="outline-warning"
                                size="sm"
                                onClick={() => handleCompleteIzin(s.izin_id)}
                              >
                                <i className="bi bi-check-circle me-1"></i>
                                Selesaikan
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Santri Sedang Keluar (Izin Keluar, Berobat, Keluarga) */}
      {outsideSantri.filter(s => s.izin_info?.jenis_izin_id !== 2).length > 0 && (
        <Row className="mb-4">
          <Col>
            <Card className="border-0">
              <Card.Header className="bg-white border-0">
                <h5 className="mb-0">
                  <i className="bi bi-person-walking text-warning me-2"></i>
                  Santri Sedang Di Luar Pondok
                  <Badge bg="warning" text="dark" className="ms-2">
                    {outsideSantri.filter(s => s.izin_info?.jenis_izin_id !== 2).length}
                  </Badge>
                </h5>
              </Card.Header>
              <Card.Body className="p-0">
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th className="ps-4">No</th>
                        <th>Nama Santri</th>
                        <th>NIS</th>
                        <th>Kelas</th>
                        <th>Jenis Izin</th>
                        <th>Batas Waktu</th>
                        <th>Sisa Waktu</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outsideSantri.filter(s => s.izin_info?.jenis_izin_id !== 2).map((s, index) => {
                        const remaining = formatRemainingTime(s.izin_info?.tanggal_selesai);
                        const namaIzin = s.izin_info?.nama_izin || jenisIzinMap[s.izin_info?.jenis_izin_id] || 'Lainnya';
                        return (
                          <tr key={s.izin_id || s.id}>
                            <td className="ps-4 fw-medium">{index + 1}</td>
                            <td>
                              <div className="d-flex align-items-center">
                                <div className="avatar-circle me-2">
                                  <i className="bi bi-person-circle text-muted"></i>
                                </div>
                                <span className="fw-medium">{s.nama}</span>
                              </div>
                            </td>
                            <td className="text-muted">{s.nis}</td>
                            <td>
                              <span className="badge bg-secondary">{s.kelas}</span>
                            </td>
                            <td className="text-muted">{namaIzin}</td>
                            <td>
                              <small className={remaining.color}>
                                {s.izin_info?.tanggal_selesai ? moment(s.izin_info.tanggal_selesai).format('DD/MM/YYYY HH:mm') : 'N/A'}
                              </small>
                            </td>
                            <td>
                              <span className={remaining.color}>
                                <i className="bi bi-clock me-1"></i>
                                {remaining.text}
                              </span>
                            </td>
                            <td>
                              <Button
                                variant="outline-warning"
                                size="sm"
                                onClick={() => handleCompleteIzin(s.izin_id)}
                              >
                                <i className="bi bi-check-circle me-1"></i>
                                Selesaikan
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Quick Actions */}
      <Row className="mb-3">
        <Col>
          <Card className="border-0">
            <Card.Header className="bg-white border-0">
              <h5 className="mb-0">
                <i className="bi bi-lightning-charge-fill text-warning me-2"></i>
                Aksi Cepat
              </h5>
            </Card.Header>
            <Card.Body>
              <Row className="g-2">
                <Col xs={6}>
                  <div
                    className="quick-action-card"
                    onClick={() => onNavigate?.('santri')}
                  >
                    <i className="bi bi-person-plus-fill action-icon text-primary"></i>
                    <p className="action-label">Tambah Santri</p>
                  </div>
                </Col>
                <Col xs={6}>
                  <div
                    className="quick-action-card"
                    onClick={() => onNavigate?.('scanner')}
                  >
                    <i className="bi bi-qr-code-scan action-icon text-success"></i>
                    <p className="action-label">Scan QR</p>
                  </div>
                </Col>
                <Col xs={6}>
                  <div
                    className="quick-action-card"
                    onClick={() => onNavigate?.('izin')}
                  >
                    <i className="bi bi-file-earmark-plus action-icon text-warning"></i>
                    <p className="action-label">Ajukan Izin</p>
                  </div>
                </Col>
                <Col xs={6}>
                  <div
                    className="quick-action-card"
                    onClick={() => onNavigate?.('reports')}
                  >
                    <i className="bi bi-file-earmark-spreadsheet action-icon text-info"></i>
                    <p className="action-label">Laporan</p>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Today's Activity */}
      <Row>
        <Col>
          <Card className="border-0">
            <Card.Header className="bg-white border-0 d-flex justify-content-between align-items-center">
              <h5 className="mb-0">
                <i className="bi bi-clock-history text-primary me-2"></i>
                Aktivitas Hari Ini
              </h5>
              <span 
                className="text-primary" 
                style={{ cursor: 'pointer' }}
                onClick={() => onNavigate?.('reports')}
              >
                <small className="text-primary">
                  Lihat Semua <i className="bi bi-arrow-right"></i>
                </small>
              </span>
            </Card.Header>
            <Card.Body className="p-0">
              {todayLogs.length === 0 ? (
                <div className="empty-state py-5">
                  <i className="bi bi-inbox"></i>
                  <p className="mb-0">Belum ada aktivitas hari ini</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th className="ps-4">Waktu</th>
                        <th>Nama Santri</th>
                        <th>NIS</th>
                        <th>Kelas</th>
                        <th>Jenis Akses</th>
                        <th>Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayLogs.map((log) => (
                        <tr key={log.id}>
                          <td className="ps-4">
                            <span className="fw-medium">
                              {moment(log.waktuAkses || log.waktu_akses || log.waktu).format('HH:mm')}
                            </span>
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
                            <span className={`badge-custom ${
                              log.jenis_akses === 'check_in' || log.jenis_akses === 'masuk'
                                ? 'bg-success'
                                : 'bg-danger'
                            }`}>
                              <i className={`bi bi-${
                                log.jenis_akses === 'check_in' || log.jenis_akses === 'masuk'
                                  ? 'arrow-down-left'
                                  : 'arrow-up-right'
                              }`}></i>
                              {log.jenis_akses.replace('_', ' ').toUpperCase()}
                            </span>
                          </td>
                          <td className="text-muted">
                            {log.keterangan || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default Dashboard;
