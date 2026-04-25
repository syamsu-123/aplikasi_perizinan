import { useState } from 'react';
import { Container, Card, Form, Button, Alert, ProgressBar } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '../App.css';

function Register({ onNavigate }) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ level: 0, text: '', color: 'light' });
  const [loading, setLoading] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const { register, resendVerification } = useAuth();
  const [resending, setResending] = useState(false);

  const handleResendVerification = async () => {
    setResending(true);
    setError('');
    setSuccess('');

    try {
      const result = await resendVerification();
      if (result.success) {
        setSuccess('Email verifikasi telah dikirim ulang. Silakan cek inbox Anda.');
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

  const checkPasswordStrength = (pass) => {
    if (!pass) return { level: 0, text: '', color: 'light' };

    const hasNumbers = /\d/.test(pass);
    const hasLetters = /[a-zA-Z]/.test(pass);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pass);

    if (pass.length < 6) {
      return { level: 1, text: 'Lemah', color: 'danger' };
    }
    if (pass.length >= 8 && hasLetters && hasNumbers && hasSpecial) {
      return { level: 3, text: 'Kuat', color: 'success' };
    }
    if (pass.length >= 6 && ((hasLetters && hasNumbers) || (hasLetters && hasSpecial))) {
      return { level: 2, text: 'Sedang', color: 'warning' };
    }
    return { level: 1, text: 'Lemah', color: 'danger' };
  };

  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    if (newPassword) {
      setPasswordStrength(checkPasswordStrength(newPassword));
    } else {
      setPasswordStrength({ level: 0, text: '', color: 'light' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validasi
    if (!displayName || !email || !password || !confirmPassword) {
      setError('Semua field harus diisi!');
      return;
    }

    if (password.length < 6) {
      setError('Password minimal 6 karakter!');
      return;
    }

    if (password !== confirmPassword) {
      setError('Password dan konfirmasi password tidak cocok!');
      return;
    }

    setLoading(true);
    try {
      await register(email, password, displayName);
      setRegistrationComplete(true);
      setSuccess('Akun berhasil dibuat! Silakan verifikasi email Anda sebelum login.');
    } catch (err) {
      console.error('Register error:', err);
      let message = 'Gagal mendaftar. Coba lagi.';

      if (err.code === 'auth/email-already-in-use') {
        message = 'Email sudah terdaftar. Silakan login.';
      } else if (err.code === 'auth/invalid-email') {
        message = 'Format email tidak valid.';
      } else if (err.code === 'auth/weak-password') {
        message = 'Password terlalu lemah. Minimal 6 karakter.';
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
            <div className="mb-3">
              <i className="bi bi-person-plus-fill" style={{ fontSize: '3rem', color: '#667eea' }}></i>
            </div>
            <h3 className="fw-bold mb-1">Daftar Akun</h3>
            <p className="text-muted small">Buat akun baru untuk melanjutkan</p>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="danger" className="border-0 small" onClose={() => setError('')} dismissible>
              <i className="bi bi-exclamation-triangle me-2"></i>
              {error}
            </Alert>
          )}

          {/* Success Alert */}
          {success && (
            <Alert variant="success" className="border-0 small" onClose={() => setSuccess('')} dismissible>
              <i className="bi bi-check-circle me-2"></i>
              {success}
            </Alert>
          )}

          {/* Register Form */}
          <Form onSubmit={handleSubmit}>
            <div className="mb-3">
              <Form.Label className="small fw-bold">
                <i className="bi bi-person me-1"></i>
                Nama Lengkap
              </Form.Label>
              <Form.Control
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Masukkan nama lengkap"
                required
                size="lg"
                className="rounded-pill"
              />
            </div>

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

            <div className="mb-3">
              <Form.Label className="small fw-bold">
                <i className="bi bi-lock me-1"></i>
                Password
              </Form.Label>
              <div className="position-relative">
                <Form.Control
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={handlePasswordChange}
                  placeholder="Minimal 6 karakter"
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
              {password.length > 0 && (
                <div className="mt-2">
                  <ProgressBar style={{ height: '6px' }}>
                    <ProgressBar variant={passwordStrength.color} now={passwordStrength.level >= 1 ? 33.3 : 0} key={1} />
                    <ProgressBar variant={passwordStrength.color} now={passwordStrength.level >= 2 ? 33.3 : 0} key={2} />
                    <ProgressBar variant={passwordStrength.color} now={passwordStrength.level >= 3 ? 33.3 : 0} key={3} />
                  </ProgressBar>
                  <small className="d-block mt-1">
                    Kekuatan: <span className={`fw-bold text-${passwordStrength.color}`}>{passwordStrength.text}</span>
                  </small>
                </div>
              )}
            </div>

            <div className="mb-4">
              <Form.Label className="small fw-bold">
                <i className="bi bi-lock-fill me-1"></i>
                Konfirmasi Password
              </Form.Label>
              <div className="position-relative">
                <Form.Control
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi password"
                  required
                  size="lg"
                  className="rounded-pill pe-5"
                />
                <span
                  className="position-absolute top-50 end-0 translate-middle-y me-3"
                  style={{ cursor: 'pointer', zIndex: 10 }}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <i className={`bi ${showConfirmPassword ? 'bi-eye-slash text-primary' : 'bi-eye text-muted'}`}></i>
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
                  <i className="bi bi-person-plus me-2"></i>
                  Daftar
                </>
              )}
            </Button>
          </Form>

          {/* Verification Message (shown after successful registration) */}
          {registrationComplete && (
            <div className="mt-4">
              <Card className="border-0 bg-light">
                <Card.Body className="p-3">
                  <div className="text-center">
                    <i className="bi bi-envelope-check" style={{ fontSize: '2.5rem', color: '#28a745' }}></i>
                    <h6 className="fw-bold mt-2 mb-2">Verifikasi Email Diperlukan</h6>
                    <p className="text-muted small mb-3">
                      Kami telah mengirimkan email verifikasi ke <strong>{email}</strong>.
                      Silakan cek inbox Anda dan klik link verifikasi sebelum login.
                    </p>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      className="rounded-pill mb-2"
                      onClick={handleResendVerification}
                      disabled={resending}
                    >
                      {resending ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                          Mengirim...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-send me-1"></i>
                          Kirim Ulang Email Verifikasi
                        </>
                      )}
                    </Button>
                    <div className="mt-2">
                      <a
                        href="#login"
                        className="text-primary fw-bold text-decoration-none small"
                        onClick={(e) => {
                          e.preventDefault();
                          onNavigate('login');
                        }}
                      >
                        <i className="bi bi-arrow-left me-1"></i>
                        Kembali ke Login
                      </a>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </div>
          )}

          {/* Login Link */}
          <div className="text-center mt-4">
            <p className="text-muted small mb-0">
              Sudah punya akun?{' '}
              <a
                href="#login"
                className="text-primary fw-bold text-decoration-none"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('login');
                }}
              >
                Masuk di sini
              </a>
            </p>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}

export default Register;
