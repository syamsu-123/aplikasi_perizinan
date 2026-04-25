import { useEffect, useState } from 'react';
import { Container, Spinner } from 'react-bootstrap';
import 'bootstrap-icons/font/bootstrap-icons.css';

function SplashScreen({ onFinish }) {
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Progress animation
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 2;
      });
    }, 30);

    // Fade out after 2.5 seconds
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, 2500);

    // Finish splash screen
    const finishTimer = setTimeout(() => {
      onFinish();
    }, 3000);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div 
      className={`splash-screen d-flex align-items-center justify-content-center text-white ${
        fadeOut ? 'fade-out' : ''
      }`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        zIndex: 9999,
        transition: 'opacity 0.5s ease-out',
        opacity: fadeOut ? 0 : 1
      }}
    >
      <Container className="text-center">
        {/* Logo Animation */}
        <div className="mb-4" style={{
          animation: 'bounceIn 1s ease-out'
        }}>
          <div 
            className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
            style={{
              width: '140px',
              height: '140px',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              border: '4px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
              overflow: 'hidden'
            }}
          >
            <img 
              src="/logo app.png" 
              alt="Logo"
              style={{
                width: '120px',
                height: '120px',
                objectFit: 'contain'
              }}
            />
          </div>
        </div>

        {/* App Name */}
        <h1 
          className="fw-bold mb-2"
          style={{
            fontSize: '2rem',
            animation: 'fadeInUp 0.8s ease-out 0.3s both'
          }}
        >
          Aplikasi Perizinan Santri
        </h1>
        
        <p 
          className="mb-4 opacity-75"
          style={{
            fontSize: '1rem',
            animation: 'fadeInUp 0.8s ease-out 0.5s both'
          }}
        >
          Sistem Manajemen Keluar Masuk Perizinan
        </p>

        {/* Loading Progress */}
        <div 
          className="mx-auto mb-3"
          style={{
            maxWidth: '200px',
            animation: 'fadeInUp 0.8s ease-out 0.7s both'
          }}
        >
          <div className="progress" style={{ height: '6px' }}>
            <div 
              className="progress-bar bg-white"
              role="progressbar"
              style={{ 
                width: `${progress}%`,
                transition: 'width 0.03s ease-out'
              }}
              aria-valuenow={progress}
              aria-valuemin="0"
              aria-valuemax="100"
            ></div>
          </div>
          <small className="mt-2 d-block opacity-75">
            Memuat aplikasi... {progress}%
          </small>
        </div>

        {/* Loading Spinner */}
        <div 
          className="mt-3"
          style={{
            animation: 'fadeInUp 0.8s ease-out 0.9s both'
          }}
        >
          <Spinner 
            animation="border" 
            variant="light" 
            size="sm" 
            className="me-2"
          />
          <small className="opacity-75">Menyiapkan aplikasi</small>
        </div>

        {/* Footer */}
        <div 
          className="mt-4 small opacity-50"
          style={{
            animation: 'fadeInUp 0.8s ease-out 1.1s both'
          }}
        >
          <i className="bi bi-shield-check me-1"></i>
          Versi 1.0.0
        </div>
      </Container>

      {/* CSS Animations */}
      <style>{`
        @keyframes bounceIn {
          0% {
            transform: scale(0.3);
            opacity: 0;
          }
          50% {
            transform: scale(1.05);
          }
          70% {
            transform: scale(0.9);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .splash-screen.fade-out {
          opacity: 0;
          pointer-events: none;
        }

        .progress {
          background-color: rgba(255, 255, 255, 0.2);
          border-radius: 10px;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}

export default SplashScreen;
