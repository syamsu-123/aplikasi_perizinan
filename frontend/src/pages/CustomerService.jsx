import { useState } from 'react';
import { Container, Card, Button, Form, Alert, Modal } from 'react-bootstrap';
import 'bootstrap-icons/font/bootstrap-icons.css';

// Kontak admin untuk pengiriman pesan
const ADMIN_CONTACTS = {
  whatsapp: '6281313800291', // Ganti dengan nomor WA admin sebenarnya
  email: 'tefa@smksalittihad.sch.id', // Ganti dengan email sebenarnya
  namaAdmin: 'Admin TEFA SMKS Al Ittihad'
};

function CustomerService() {
  const [formData, setFormData] = useState({
    nama: '',
    email: '',
    kategori: 'pertanyaan',
    pesan: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const newMessage = {
      ...formData,
      id: Date.now().toString(),
      tanggal: new Date().toISOString(),
      status: 'pending'
    };

    // Simpan pesan ke localStorage
    const messages = JSON.parse(localStorage.getItem('cs_messages') || '[]');
    messages.push(newMessage);
    localStorage.setItem('cs_messages', JSON.stringify(messages));
    
    setLastMessage(newMessage);
    setSubmitted(true);
    setFormData({ nama: '', email: '', kategori: 'pertanyaan', pesan: '' });
    setShowSendModal(true);
  };

  const sendViaWhatsApp = () => {
    if (!lastMessage) return;
    
    const kategoriLabel = {
      pertanyaan: 'Pertanyaan',
      masalah: 'Laporan Masalah',
      saran: 'Saran / Masukan',
      lainnya: 'Lainnya'
    };

    const text = `*${kategoriLabel[lastMessage.kategori]}*%0A%0A` +
      `Nama: ${lastMessage.nama}%0A` +
      `Email: ${lastMessage.email}%0A%0A` +
      `Pesan:%0A${lastMessage.pesan}`;
    
    const waUrl = `https://wa.me/${ADMIN_CONTACTS.whatsapp}?text=${text}`;
    window.open(waUrl, '_blank');
    setShowSendModal(false);
  };

  const sendViaEmail = () => {
    if (!lastMessage) return;
    
    const kategoriLabel = {
      pertanyaan: 'Pertanyaan',
      masalah: 'Laporan Masalah',
      saran: 'Saran / Masukan',
      lainnya: 'Lainnya'
    };

    const subject = encodeURIComponent(`[${kategoriLabel[lastMessage.kategori]}] - ${lastMessage.nama}`);
    const body = encodeURIComponent(
      `Nama: ${lastMessage.nama}\nEmail: ${lastMessage.email}\nKategori: ${kategoriLabel[lastMessage.kategori]}\n\nPesan:\n${lastMessage.pesan}`
    );
    
    const mailtoUrl = `mailto:${ADMIN_CONTACTS.email}?subject=${subject}&body=${body}`;
    window.location.href = mailtoUrl;
    setShowSendModal(false);
  };

  const getCategoryIcon = (kategori) => {
    const icons = {
      pertanyaan: 'bi-question-circle text-primary',
      masalah: 'bi-exclamation-triangle text-danger',
      saran: 'bi-lightbulb text-warning',
      lainnya: 'bi-chat-dots text-info'
    };
    return icons[kategori] || 'bi-chat-dots text-muted';
  };

  const getCategoryLabel = (kategori) => {
    const labels = {
      pertanyaan: 'Pertanyaan',
      masalah: 'Laporan Masalah',
      saran: 'Saran / Masukan',
      lainnya: 'Lainnya'
    };
    return labels[kategori] || kategori;
  };

  return (
    <Container className="page-content">
      {/* Page Header */}
      <div className="page-header mb-4">
        <h2 className="page-title mb-0">
          <i className="bi bi-headset"></i>
          Bantuan & Kontak
        </h2>
      </div>

      {/* Contact Info Cards */}
      <Card className="border-0 mb-4">
        <Card.Body>
          <h6 className="mb-3 fw-bold">
            <i className="bi bi-telephone text-primary me-2"></i>
            Kontak Cepat
          </h6>
          <div className="row text-center g-3">
            <div className="col-4">
              <Button
                variant="outline-success"
                className="w-100 p-3 border-0"
                onClick={() => window.open(`https://wa.me/${ADMIN_CONTACTS.whatsapp}`, '_blank')}
              >
                <i className="bi bi-whatsapp" style={{ fontSize: '1.75rem' }}></i>
                <p className="mb-0 mt-2 small fw-bold">WhatsApp</p>
              </Button>
            </div>
            <div className="col-4">
              <Button
                variant="outline-primary"
                className="w-100 p-3 border-0"
                onClick={() => window.location.href = `mailto:${ADMIN_CONTACTS.email}`}
              >
                <i className="bi bi-envelope" style={{ fontSize: '1.75rem' }}></i>
                <p className="mb-0 mt-2 small fw-bold">Email</p>
              </Button>
            </div>
            <div className="col-4">
              <div className="p-3 bg-light rounded">
                <i className="bi bi-clock text-warning" style={{ fontSize: '1.75rem' }}></i>
                <p className="mb-0 mt-2 small fw-bold">Jam Kerja</p>
                <small className="text-muted">08.00-17.00</small>
              </div>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Alert */}
      {submitted && (
        <Alert variant="success" className="border-0" onClose={() => setSubmitted(false)} dismissible>
          <i className="bi bi-check-circle me-2"></i>
          Pesan berhasil disimpan! Silakan kirim via WhatsApp atau Email untuk respon cepat.
        </Alert>
      )}

      {/* FAQ */}
      <Card className="border-0 mb-4">
        <Card.Header className="bg-white border-0">
          <h6 className="mb-0 fw-bold">
            <i className="bi bi-question-circle text-primary me-2"></i>
            Pertanyaan Umum (FAQ)
          </h6>
        </Card.Header>
        <Card.Body>
          <div className="mb-3">
            <strong className="small">1. Bagaimana cara menambah data santri?</strong>
            <p className="text-muted small mb-2">Buka menu Santri → klik "Tambah Santri" → isi form → simpan</p>
          </div>
          <div className="mb-3">
            <strong className="small">2. Bagaimana cara scan QR Code?</strong>
            <p className="text-muted small mb-2">Buka menu Scan QR → klik "Mulai Scan" → arahkan kamera ke QR Code santri</p>
          </div>
          <div className="mb-3">
            <strong className="small">3. Apa itu denda?</strong>
            <p className="text-muted small mb-2">Denda otomatis dihitung saat santri terlambat kembali dari izin. Bisa diatur di menu Denda</p>
          </div>
          <div className="mb-0">
            <strong className="small">4. Data tersimpan di mana?</strong>
            <p className="text-muted small mb-0">Semua data tersimpan lokal di perangkat (localStorage). Tidak perlu internet.</p>
          </div>
        </Card.Body>
      </Card>

      {/* Contact Form */}
      <Card className="border-0 mb-4">
        <Card.Header className="bg-white border-0">
          <h6 className="mb-0 fw-bold">
            <i className="bi bi-send text-primary me-2"></i>
            Kirim Pesan
          </h6>
        </Card.Header>
        <Card.Body>
          <Form onSubmit={handleSubmit}>
            <div className="mb-3">
              <Form.Label className="small fw-bold">
                <i className="bi bi-person me-1"></i>
                Nama Lengkap
              </Form.Label>
              <Form.Control
                type="text"
                value={formData.nama}
                onChange={(e) => setFormData({...formData, nama: e.target.value})}
                placeholder="Masukkan nama lengkap"
                required
              />
            </div>

            <div className="mb-3">
              <Form.Label className="small fw-bold">
                <i className="bi bi-envelope me-1"></i>
                Email
              </Form.Label>
              <Form.Control
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="Masukkan email"
                required
              />
            </div>

            <div className="mb-3">
              <Form.Label className="small fw-bold">
                <i className="bi bi-tag me-1"></i>
                Kategori
              </Form.Label>
              <Form.Select
                value={formData.kategori}
                onChange={(e) => setFormData({...formData, kategori: e.target.value})}
              >
                <option value="pertanyaan">Pertanyaan</option>
                <option value="masalah">Laporan Masalah</option>
                <option value="saran">Saran / Masukan</option>
                <option value="lainnya">Lainnya</option>
              </Form.Select>
            </div>

            <div className="mb-3">
              <Form.Label className="small fw-bold">
                <i className="bi bi-chat-dots me-1"></i>
                Pesan
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                value={formData.pesan}
                onChange={(e) => setFormData({...formData, pesan: e.target.value})}
                placeholder="Tulis kritik, saran, atau pertanyaan Anda di sini..."
                required
              />
            </div>

            <Button variant="primary" type="submit" className="w-100">
              <i className="bi bi-save me-1"></i>
              Simpan Pesan
            </Button>
          </Form>
        </Card.Body>
      </Card>

      {/* Info */}
      <Alert variant="info" className="border-0 small">
        <i className="bi bi-info-circle me-2"></i>
        <strong>Cara mengirim pesan:</strong><br />
        1. Klik <strong>"Simpan Pesan"</strong> untuk menyimpan ke perangkat<br />
        2. Pilih kirim via <strong>WhatsApp</strong> atau <strong>Email</strong> untuk respon cepat dari admin
      </Alert>

      {/* Modal Pilih Kirim */}
      <Modal show={showSendModal} onHide={() => setShowSendModal(false)} centered size="sm">
        <Modal.Header closeButton>
          <Modal.Title className="fs-6">
            <i className="bi bi-send-check text-success me-2"></i>
            Pesan Tersimpan!
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          {lastMessage && (
            <div className="mb-3 p-2 bg-light rounded">
              <i className={`bi ${getCategoryIcon(lastMessage.kategori)} fs-4 mb-2 d-block`}></i>
              <strong className="small d-block">{getCategoryLabel(lastMessage.kategori)}</strong>
              <span className="text-muted small">dari {lastMessage.nama}</span>
            </div>
          )}
          <p className="small text-muted mb-3">Pesan sudah disimpan di perangkat. Kirim sekarang ke admin?</p>
          
          <div className="d-grid gap-2">
            <Button variant="success" onClick={sendViaWhatsApp}>
              <i className="bi bi-whatsapp me-2"></i>
              Kirim via WhatsApp
            </Button>
            <Button variant="outline-primary" onClick={sendViaEmail}>
              <i className="bi bi-envelope me-2"></i>
              Kirim via Email
            </Button>
            <Button variant="outline-secondary" size="sm" onClick={() => setShowSendModal(false)}>
              <i className="bi bi-x-lg me-1"></i>
              Nanti Saja
            </Button>
          </div>
        </Modal.Body>
      </Modal>
    </Container>
  );
}

export default CustomerService;
