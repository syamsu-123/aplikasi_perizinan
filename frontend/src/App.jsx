import { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { Container, Button } from 'react-bootstrap';
import { App as CapacitorApp } from '@capacitor/app';
import SplashScreen from './components/SplashScreen';
import { PopupProvider } from './components/Popup';
import { AuthProvider, useAuth } from './context/AuthContext';
import { initStorage } from './storage';
import { isAdmin } from './utils/roles';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './App.css';

// Lazy load halaman untuk Code Splitting (mengurangi ukuran bundle awal)
const Dashboard = lazy(() => import('./pages/Dashboard'));
const SantriManagement = lazy(() => import('./pages/SantriManagement'));
const IzinManagement = lazy(() => import('./pages/IzinManagement'));
const QRScanner = lazy(() => import('./pages/QRScanner'));
const Reports = lazy(() => import('./pages/Reports'));
const DendaManagement = lazy(() => import('./pages/DendaManagement'));
const About = lazy(() => import('./pages/About'));
const CustomerService = lazy(() => import('./pages/CustomerService'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const DebugPanel = lazy(() => import('./pages/DebugPanel'));

function AppContent() {
  const [showSplash, setShowSplash] = useState(true);
  const [authPage, setAuthPage] = useState(null); // 'login' | 'register' | null
  const [activePage, setActivePage] = useState('dashboard');
  const [reloading, setReloading] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const touchStartY = useRef(0);
  const touchEndY = useRef(0);

  const { user, loading: authLoading, logout } = useAuth();

  useEffect(() => {
    initStorage();
  }, []);

  const handleSplashFinish = () => {
    setShowSplash(false);
    // Setelah splash selesai, cek apakah sudah login
    // Jika authLoading selesai dan user null, arahkan ke login
    if (!authLoading && !user) {
      setAuthPage('login');
    }
  };

  const handleLogoutConfirm = () => {
    setShowLogoutConfirm(true);
  };

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    await logout();
    setAuthPage('login');
  };

  // Watch for auth state changes after splash
  useEffect(() => {
    if (!showSplash) {
      if (user) {
        setAuthPage(null); // Sudah login, tampilkan halaman utama
      } else if (!authLoading) {
        setAuthPage('login'); // Belum login, tampilkan login
      }
    }
  }, [user, authLoading, showSplash]);

  const handleReload = useCallback(async () => {
    if (reloading) return;
    setReloading(true);
    initStorage();
    await new Promise(r => setTimeout(r, 800));
    setReloading(false);
  }, [reloading]);

  // Pull down to reload
  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e) => {
    touchEndY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = () => {
    const distance = touchEndY.current - touchStartY.current;
    if (distance > 120 && window.scrollY <= 5 && !reloading) {
      handleReload();
    }
    touchStartY.current = 0;
    touchEndY.current = 0;
  };

  // Handle Hardware Back Button di Android
  useEffect(() => {
    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      // Jika sedang ada modal, tutup modalnya atau abaikan
      if (showLogoutConfirm) return setShowLogoutConfirm(false);
      if (showExitConfirm) return setShowExitConfirm(false);
      
      if (activePage === 'dashboard') {
        setShowExitConfirm(true); // Tampilkan pop-up konfirmasi keluar
      } else {
        setActivePage('dashboard'); // Jika di menu lain, kembali ke halaman utama
      }
    });

    return () => { listenerPromise.then(listener => listener.remove()); };
  }, [activePage, showLogoutConfirm, showExitConfirm]);

  const handleExitApp = () => CapacitorApp.exitApp();

  // Show splash screen
  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  const authLoadingFallback = (
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
    </div>
  );

  // Show login page
  if (authPage === 'login') {
    return (
      <Suspense fallback={authLoadingFallback}>
        <Login onNavigate={setAuthPage} />
      </Suspense>
    );
  }

  // Show register page
  if (authPage === 'register') {
    return (
      <Suspense fallback={authLoadingFallback}>
        <Register onNavigate={setAuthPage} />
      </Suspense>
    );
  }

  // Show main app (user is logged in)
  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard onNavigate={setActivePage} />;
      case 'santri': return <SantriManagement />;
      case 'izin': return <IzinManagement />;
      case 'scanner': return <QRScanner />;
      case 'reports': return <Reports />;
      case 'denda': return <DendaManagement />;
      case 'about': return <About />;
      case 'cs': return <CustomerService />;
      case 'debug': return isAdmin(user) ? <DebugPanel /> : <Dashboard onNavigate={setActivePage} />;
      default: return <Dashboard />;
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Home', icon: 'bi-house', iconFilled: 'bi-house-fill' },
    { id: 'santri', label: 'Santri', icon: 'bi-people', iconFilled: 'bi-people-fill' },
    { id: 'scanner', label: 'Scan QR', icon: 'bi-qr-code', iconFilled: 'bi-qr-code-scan' },
    { id: 'izin', label: 'Izin', icon: 'bi-file-earmark-text', iconFilled: 'bi-file-earmark-text-fill' },
    { id: 'reports', label: 'Laporan', icon: 'bi-bar-chart', iconFilled: 'bi-bar-chart-fill' },
    { id: 'denda', label: 'Denda', icon: 'bi-cash-coin', iconFilled: 'bi-cash-coin' },
  ];

  return (
    <div
      className="App"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Reload Indicator */}
      {reloading && (
        <div className="reload-indicator">
          <div className="spinner-border spinner-border-sm text-primary me-2" role="status" />
          <span>Reload...</span>
        </div>
      )}

      {/* Header */}
      <header className="app-header">
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <img
              src="/logo app.png"
              alt="Logo"
              style={{ height: '36px', width: 'auto', borderRadius: '8px' }}
            />
            <span className="fw-bold app-title">Perizinan Santri</span>
          </div>
          <div className="d-flex gap-3 header-actions">
            <span onClick={() => setActivePage('about')} className="header-action-btn" title="About">
              <i className="bi bi-info-circle"></i>
            </span>
            <span onClick={() => setActivePage('cs')} className="header-action-btn" title="Bantuan">
              <i className="bi bi-headset"></i>
            </span>
            {isAdmin(user) && (
              <span onClick={() => setActivePage('debug')} className="header-action-btn" title="Debug">
                <i className="bi bi-bug"></i>
              </span>
            )}
            <span onClick={handleLogoutConfirm} className="header-action-btn" title="Logout">
              <i className="bi bi-box-arrow-right"></i>
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <Container fluid className="main-content px-3">
        <Suspense fallback={
          <div className="d-flex align-items-center justify-content-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
          </div>
        }>
          {renderPage()}
        </Suspense>
      </Container>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        {navItems.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={`bottom-nav-item ${activePage === item.id ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); setActivePage(item.id); }}
          >
            <i className={`icon bi ${activePage === item.id ? item.iconFilled : item.icon}`}></i>
            <span>{item.label}</span>
          </a>
        ))}
      </nav>

      {/* Footer */}
      <footer className="text-center text-muted py-3 mt-4 d-none d-md-block small">
        &copy; {new Date().getFullYear()} Aplikasi Perizinan Santri — Made with <i className="bi bi-heart-fill text-danger"></i>
      </footer>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }} role="dialog">
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content" style={{ borderRadius: '16px' }}>
              <div className="modal-body text-center p-4">
                <div className="mb-3">
                  <i className="bi bi-box-arrow-right text-danger" style={{ fontSize: '3rem' }}></i>
                </div>
                <h5 className="fw-bold mb-2">Keluar dari Akun?</h5>
                <p className="text-muted small mb-4">
                  Apakah Anda yakin akan keluar dari akun ini?
                </p>
                <div className="d-grid gap-2">
                  <Button variant="danger" onClick={handleLogout} className="rounded-pill fw-bold">
                    <i className="bi bi-check-lg me-1"></i>
                    Ya, Keluar
                  </Button>
                  <Button variant="outline-secondary" onClick={() => setShowLogoutConfirm(false)} className="rounded-pill">
                    <i className="bi bi-x-lg me-1"></i>
                    Batal
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Exit App Confirmation Modal */}
      {showExitConfirm && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }} role="dialog">
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content" style={{ borderRadius: '16px' }}>
              <div className="modal-body text-center p-4">
                <div className="mb-3">
                  <i className="bi bi-door-open text-warning" style={{ fontSize: '3rem' }}></i>
                </div>
                <h5 className="fw-bold mb-2">Keluar Aplikasi?</h5>
                <p className="text-muted small mb-4">
                  Apakah Anda ingin keluar dari aplikasi?
                </p>
                <div className="d-grid gap-2">
                  <Button variant="warning" onClick={handleExitApp} className="rounded-pill fw-bold text-white">
                    <i className="bi bi-check-lg me-1"></i>
                    Ya, Keluar
                  </Button>
                  <Button variant="outline-secondary" onClick={() => setShowExitConfirm(false)} className="rounded-pill">
                    <i className="bi bi-x-lg me-1"></i>
                    Batal
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <PopupProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </PopupProvider>
  );
}

export default App;
