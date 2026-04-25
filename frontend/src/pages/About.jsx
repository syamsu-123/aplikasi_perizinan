import { Container, Card, Row, Col, Button } from 'react-bootstrap';
import 'bootstrap-icons/font/bootstrap-icons.css';

function About() {
  return (
    <Container className="page-content">
      {/* Page Header */}
      <div className="page-header mb-4">
        <h2 className="page-title mb-0">
          <i className="bi bi-info-circle"></i>
          Tentang Aplikasi
        </h2>
      </div>

      {/* App Info Card */}
      <Card className="border-0 mb-4">
        <Card.Body className="text-center p-4">
          <img
            src="/logo app.png"
            alt="Logo"
            style={{
              height: '100px',
              width: 'auto',
              borderRadius: '16px',
              marginBottom: '1rem'
            }}
          />
          <h3 className="fw-bold mb-1">Aplikasi Perizinan Santri</h3>
          <p className="text-muted mb-2">Versi 1.0.0</p>
          <p className="text-muted small">
            Dibangun dengan React + Capacitor untuk Android
          </p>
        </Card.Body>
      </Card>

      {/* Description */}
      <Card className="border-0 mb-4">
        <Card.Header className="bg-white border-0">
          <h6 className="mb-0 fw-bold">
            <i className="bi bi-book text-primary me-2"></i>
            Deskripsi
          </h6>
        </Card.Header>
        <Card.Body>
          <p className="text-muted">
            Aplikasi Perizinan Santri adalah sistem manajemen perizinan digital untuk pondok pesantren.
            Aplikasi ini membantu pengurus pondok dalam mengelola:
          </p>
          <ul className="text-muted">
            <li>Data santri (nama, NIS, kelas)</li>
            <li>Pengajuan dan persetujuan izin (Izin Keluar & Izin Pulang)</li>
            <li>Scan QR Code untuk check in/out</li>
            <li>Sistem denda otomatis untuk keterlambatan</li>
            <li>Laporan dan rekap data</li>
          </ul>
          <p className="text-muted fw-bold">
            Aplikasi ini menggunakan Firebase Firestore sebagai backend, sehingga memerlukan koneksi internet untuk sinkronisasi data.
          </p>
        </Card.Body>
      </Card>

      {/* Features */}
      <Card className="border-0 mb-4">
        <Card.Header className="bg-white border-0">
          <h6 className="mb-0 fw-bold">
            <i className="bi bi-star text-warning me-2"></i>
            Fitur Utama
          </h6>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col xs={6} className="mb-3">
              <div className="text-center">
                <i className="bi bi-people text-primary" style={{ fontSize: '2.5rem' }}></i>
                <h6 className="mt-2 mb-1">Manajemen Santri</h6>
                <small className="text-muted">CRUD data santri + QR Code</small>
              </div>
            </Col>
            <Col xs={6} className="mb-3">
              <div className="text-center">
                <i className="bi bi-file-earmark-check text-success" style={{ fontSize: '2.5rem' }}></i>
                <h6 className="mt-2 mb-1">Perizinan</h6>
                <small className="text-muted">Pengajuan & approval izin</small>
              </div>
            </Col>
            <Col xs={6} className="mb-3">
              <div className="text-center">
                <i className="bi bi-qr-code-scan text-warning" style={{ fontSize: '2.5rem' }}></i>
                <h6 className="mt-2 mb-1">QR Scanner</h6>
                <small className="text-muted">Scan QR untuk akses masuk/keluar</small>
              </div>
            </Col>
            <Col xs={6} className="mb-3">
              <div className="text-center">
                <i className="bi bi-cash-coin text-danger" style={{ fontSize: '2.5rem' }}></i>
                <h6 className="mt-2 mb-1">Denda</h6>
                <small className="text-muted">Hitung denda otomatis</small>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Tech Stack */}
      <Card className="border-0 mb-4">
        <Card.Header className="bg-white border-0">
          <h6 className="mb-0 fw-bold">
            <i className="bi bi-code-slash text-info me-2"></i>
            Teknologi
          </h6>
        </Card.Header>
        <Card.Body>
          <div className="d-flex flex-wrap gap-2">
            <span className="badge bg-primary">React 19</span>
            <span className="badge bg-info">Vite</span>
            <span className="badge bg-success">Capacitor 8</span>
            <span className="badge bg-warning text-dark">Bootstrap 5</span>
            <span className="badge bg-secondary">Firebase Firestore</span>
            <span className="badge bg-dark">Firebase Auth</span>
          </div>
        </Card.Body>
      </Card>

      {/* Developer Team */}
      <Card className="border-0 mb-4">
        <Card.Header className="bg-white border-0">
          <h6 className="mb-0 fw-bold">
            <i className="bi bi-laptop text-success me-2"></i>
            Tim Developer
          </h6>
        </Card.Header>
        <Card.Body>
          <div className="text-center mb-3">
            <h5 className="fw-bold text-primary mb-1">Tim TEFA SMKS Al Ittihad</h5>
            <p className="text-muted small mb-0">Teaching Factory - SMK Swasta Al Ittihad</p>
          </div>
          
          <div className="developer-info mb-3 p-3 rounded" style={{ background: '#f8f9fa' }}>
            <div className="d-flex align-items-center justify-content-center mb-2">
              <i className="bi bi-person-badge text-primary me-2" style={{ fontSize: '1.5rem' }}></i>
              <div>
                <strong className="d-block">Pembina</strong>
                <span className="text-muted">Ust. Ari Kurniawan</span>
              </div>
            </div>
          </div>

          <div className="developer-members">
            <h6 className="text-center fw-bold mb-3">
              <i className="bi bi-people-fill text-success me-2"></i>
              Anggota Tim
            </h6>
            <div className="row g-3">
              <div className="col-6">
                <div className="member-card p-3 rounded text-center" style={{ background: 'white', border: '1px solid #e9ecef' }}>
                  <div className="member-avatar mb-2">
                    <i className="bi bi-person-circle text-primary" style={{ fontSize: '2.5rem' }}></i>
                  </div>
                  <h6 className="mb-0 fw-bold">M. Syamsu Maulida</h6>
                  <small className="text-muted">Developer</small>
                </div>
              </div>
              <div className="col-6">
                <div className="member-card p-3 rounded text-center" style={{ background: 'white', border: '1px solid #e9ecef' }}>
                  <div className="member-avatar mb-2">
                    <i className="bi bi-person-circle text-success" style={{ fontSize: '2.5rem' }}></i>
                  </div>
                  <h6 className="mb-0 fw-bold">M. Azam</h6>
                  <small className="text-muted">Developer</small>
                </div>
              </div>
              <div className="col-6">
                <div className="member-card p-3 rounded text-center" style={{ background: 'white', border: '1px solid #e9ecef' }}>
                  <div className="member-avatar mb-2">
                    <i className="bi bi-person-circle text-info" style={{ fontSize: '2.5rem' }}></i>
                  </div>
                  <h6 className="mb-0 fw-bold">Dimas Aditiya Saepul</h6>
                  <small className="text-muted">Developer</small>
                </div>
              </div>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Copyright */}
      <div className="text-center text-muted small mt-4">
        <p className="mb-1">&copy; {new Date().getFullYear()} Aplikasi Perizinan Santri</p>
        <p className="mb-0">Dibuat dengan <i className="bi bi-heart-fill text-danger"></i> oleh Tim TEFA SMKS Al Ittihad</p>
      </div>
    </Container>
  );
}

export default About;
