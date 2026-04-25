import { useState, useEffect } from 'react';
import { Container, Card, Form, Button, Alert } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '../App.css';

function Login({ onNavigate }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showVerificationNotice, setShowVerificationNotice] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, resendVerification } = useAuth();
  const [resending, setResending] = useState(false);

  const handleResendVerification = async () => {
    setResending(true);
    setError('');

    try {
      const result = await resendVerification();
      if (result.success) {
        setError('');
        alert('Email verifikasi telah dikirim ulang. Silakan cek inbox Anda.');
      } else {
        setError('Gagal mengirim ulang email verifikasi.');
      }
    } catch (err) {
      console.error('Resend verification error:', err);
      setError('Gagal mengirim ulang email verifikasi. Coba lagi.');
    } finally {
      setResending(false);
    }
  };

  // Google login removed per request

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Email dan password harus diisi!');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      setShowVerificationNotice(false);
      // AuthContext akan otomatis update dan App.jsx akan redirect
    } catch (err) {
      console.error('Login error:', err);
      let message = 'Gagal masuk. Periksa email dan password Anda.';

      if (err.message === 'Email not verified') {
        setShowVerificationNotice(true);
        message = 'Email belum diverifikasi. Silakan cek inbox Anda dan klik link verifikasi.';
      } else if (err.code === 'auth/user-not-found') {
        message = 'Akun tidak ditemukan. Silakan daftar terlebih dahulu.';
        setShowVerificationNotice(false);
      } else if (err.code === 'auth/wrong-password') {
        message = 'Password salah. Coba lagi.';
        setShowVerificationNotice(false);
      } else if (err.code === 'auth/invalid-email') {
        message = 'Format email tidak valid.';
        setShowVerificationNotice(false);
      } else if (err.code === 'auth/too-many-requests') {
        message = 'Terlalu banyak percobaan. Coba lagi nanti.';
        setShowVerificationNotice(false);
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="auth-container d-flex align-items-center justify-content-center" style={{ minHeight: '100vh', padding: '1rem' }}>
      <Card className="auth-card w-100" style={{ maxWidth: '400px', borderRadius: '20px' }}>
        <Card.Body className="p-4">
          {/* Logo & Title */}
          <div className="text-center mb-4">
            <img
              src="/logo app.png"
              alt="Logo"
              style={{
                height: '80px',
                width: 'auto',
                borderRadius: '16px',
                marginBottom: '1rem'
              }}
            />
            <h3 className="fw-bold mb-1">Selamat Datang</h3>
            <p className="text-muted small">Aplikasi Perizinan Santri</p>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="danger" className="border-0 small" onClose={() => { setError(''); setShowVerificationNotice(false); }} dismissible>
              <i className="bi bi-exclamation-triangle me-2"></i>
              {error}
            </Alert>
          )}

          {/* Verification Notice */}
          {showVerificationNotice && (
            <Alert variant="warning" className="border-0 small">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <i className="bi bi-envelope me-2"></i>
                  <strong>Email belum diverifikasi</strong>
                  <p className="mb-0 mt-1 small">
                    Silakan verifikasi email Anda terlebih dahulu.
                  </p>
                </div>
                <Button
                  variant="outline-warning"
                  size="sm"
                  className="rounded-pill ms-2"
                  onClick={handleResendVerification}
                  disabled={resending}
                >
                  {resending ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-send"></i>
                    </>
                  )}
                </Button>
              </div>
            </Alert>
          )}

          {/* Email Login Only - Google removed per request */}
          <div className="text-center text-muted small mb-3">
            Login dengan Email & Password
          </div>

          {/* Divider */}
          <div className="text-center mb-3">
            <span className="text-muted small"></span>
          </div>

          {/* Login Form */}
          <Form onSubmit={handleSubmit}>
            <div className="mb-3">
              <Form.Label className="small fw-bold">
                <i className="bi bi-envelope me-1"></i>
                Email
              </Form.Label>
              <Form.Control
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Masukkan email"
                required
                size="lg"
                className="rounded-pill"
              />
            </div>

            <div className="mb-4">
              <Form.Label className="small fw-bold">
                <i className="bi bi-lock me-1"></i>
                Password
              </Form.Label>
              <div className="position-relative">
                <Form.Control
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  required
                  size="lg"
                  className="rounded-pill pe-5"
                />
                <span
                  className="position-absolute top-50 end-0 translate-middle-y me-3"
                  style={{ cursor: 'pointer', zIndex: 10 }}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <i className={`bi ${showPassword ? 'bi-eye-slash text-primary' : 'bi-eye text-muted'}`}></i>
                </span>
              </div>
            </div>

            <Button
              variant="primary"
              type="submit"
              className="w-100 rounded-pill py-2 fw-bold"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  Memproses...
                </>
              ) : (
                <>
                  <i className="bi bi-box-arrow-in-right me-2"></i>
                  Masuk
                </>
              )}
            </Button>
          </Form>

          {/* Register Link */}
          <div className="text-center mt-4">
            <p className="text-muted small mb-0">
              Belum punya akun?{' '}
              <a
                href="#register"
                className="text-primary fw-bold text-decoration-none"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('register');
                }}
              >
                Daftar di sini
              </a>
            </p>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}

export default Login;
