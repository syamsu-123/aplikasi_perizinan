import { useState, useEffect } from 'react';
import { Container, Card, Badge, Button } from 'react-bootstrap';
import { db, auth, firebaseConfig } from '../firebase';
import { collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { santriAPI, izinAPI, aksesAPI } from '../api';

function DebugPanel() {
  const [logs, setLogs] = useState([]);
  const [authUser, setAuthUser] = useState(null);
  const [tests, setTests] = useState({});

  const addLog = (type, message, color = 'text-muted') => {
    setLogs(prev => [...prev, { type, message, color, time: new Date().toLocaleTimeString() }]);
  };

  // Test 1: Auth State
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      addLog('AUTH', user ? `Logged in: ${user.email}` : 'Not logged in', user ? 'text-success' : 'text-danger');
    });
    return () => unsub();
  }, []);

  // Test 2: Firestore Connection
  const testFirestore = async () => {
    try {
      addLog('FIRESTORE', 'Testing connection...', 'text-info');
      setTests(prev => ({ ...prev, firestore: 'loading' }));

      const santriCol = collection(db, 'santri');
      const snap = await getDocs(santriCol);
      const count = snap.size;

      addLog('FIRESTORE', `Connected! Total santri: ${count}`, 'text-success');
      setTests(prev => ({ ...prev, firestore: 'ok', santriCount: count }));
    } catch (err) {
      addLog('FIRESTORE', `Error: ${err.code} - ${err.message}`, 'text-danger');
      setTests(prev => ({ ...prev, firestore: 'error', error: err.message }));
    }
  };

  // Test 3: Santri API
  const testSantriAPI = async () => {
    try {
      addLog('API', 'Testing santriAPI.getAll()...', 'text-info');
      const res = await santriAPI.getAll();
      const count = res.data?.data?.length || 0;
      addLog('API', `Santri API OK! Loaded: ${count} santri`, 'text-success');
      setTests(prev => ({ ...prev, santriAPI: 'ok', santriAPICount: count }));
    } catch (err) {
      addLog('API', `Error: ${err.message}`, 'text-danger');
      setTests(prev => ({ ...prev, santriAPI: 'error', error: err.message }));
    }
  };

  // Test 4: Jenis Izin
  const testJenisIzin = async () => {
    try {
      addLog('API', 'Testing izinAPI.getJenisIzin()...', 'text-info');
      const res = await izinAPI.getJenisIzin();
      const items = res.data?.data || [];
      const names = items.map(i => i.namaIzin).join(', ');
      addLog('API', `Jenis Izin OK! ${items.length} items: ${names}`, 'text-success');
      setTests(prev => ({ ...prev, jenisIzin: 'ok', jenisIzinItems: names }));
    } catch (err) {
      addLog('API', `Error: ${err.message}`, 'text-danger');
      setTests(prev => ({ ...prev, jenisIzin: 'error', error: err.message }));
    }
  };

  // Test 5: Stats/Dashboard
  const testStats = async () => {
    try {
      addLog('API', 'Testing aksesAPI.getStats()...', 'text-info');
      const res = await aksesAPI.getStats();
      const data = res.data?.data || {};
      addLog('API', `Stats OK! Total santri: ${data.total_santri || 0}, Outside: ${data.outside_count || 0}`, 'text-success');
      setTests(prev => ({ ...prev, stats: 'ok', statsData: data }));
    } catch (err) {
      addLog('API', `Error: ${err.message}`, 'text-danger');
      setTests(prev => ({ ...prev, stats: 'error', error: err.message }));
    }
  };

  // Test 6: Write test
  const testWrite = async () => {
    try {
      addLog('FIRESTORE', 'Testing write permission...', 'text-info');
      const testCol = collection(db, '_debug_test');
      await import('firebase/firestore').then(({ addDoc, serverTimestamp, deleteDoc, doc }) => {
        return addDoc(testCol, {
          test: true,
          timestamp: serverTimestamp(),
          deviceId: navigator.userAgent.substring(0, 50)
        }).then(async (ref) => {
          await deleteDoc(doc(db, '_debug_test', ref.id));
          addLog('FIRESTORE', 'Write + Delete OK!', 'text-success');
          setTests(prev => ({ ...prev, write: 'ok' }));
        });
      });
    } catch (err) {
      addLog('FIRESTORE', `Write Error: ${err.code} - ${err.message}`, 'text-danger');
      setTests(prev => ({ ...prev, write: 'error', error: err.message }));
    }
  };

  const runAllTests = async () => {
    setLogs([]);
    setTests({});
    addLog('SYSTEM', '=== Running All Tests ===', 'text-primary fw-bold');
    await testFirestore();
    await testSantriAPI();
    await testJenisIzin();
    await testStats();
    await testWrite();
    addLog('SYSTEM', '=== All Tests Complete ===', 'text-primary fw-bold');
  };

  return (
    <Container className="page-content">
      <div className="page-header mb-4">
        <h2 className="page-title">
          <i className="bi bi-bug me-2"></i>
          Debug Panel
        </h2>
        <p className="text-muted small">Cek koneksi Firebase & API</p>
      </div>

      {/* Firebase Config */}
      <Card className="border-0 mb-3">
        <Card.Body>
          <h6 className="fw-bold mb-2">
            <i className="bi bi-fire me-1"></i>
            Firebase Config
          </h6>
          <div className="small">
            <div><strong>Project ID:</strong> {firebaseConfig.projectId}</div>
            <div><strong>API Key:</strong> {firebaseConfig.apiKey?.substring(0, 10)}...</div>
            <div><strong>Auth Domain:</strong> {firebaseConfig.authDomain}</div>
          </div>
        </Card.Body>
      </Card>

      {/* Auth Status */}
      <Card className="border-0 mb-3">
        <Card.Body>
          <h6 className="fw-bold mb-2">
            <i className="bi bi-person-check me-1"></i>
            Auth Status
          </h6>
          {authUser ? (
            <div className="small">
              <Badge bg="success" className="me-2"><i className="bi bi-check-circle me-1"></i>Logged In</Badge>
              <div className="mt-1"><strong>Email:</strong> {authUser.email}</div>
              <div><strong>UID:</strong> {authUser.uid}</div>
            </div>
          ) : (
            <div className="small">
              <Badge bg="danger"><i className="bi bi-x-circle me-1"></i>Not Logged In</Badge>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Test Results */}
      <Card className="border-0 mb-3">
        <Card.Body>
          <h6 className="fw-bold mb-2">
            <i className="bi bi-clipboard-check me-1"></i>
            Test Results
          </h6>
          <table className="table table-sm small mb-0">
            <tbody>
              <tr>
                <td>Firebase Firestore</td>
                <td>
                  {tests.firestore === 'ok' ? (
                    <Badge bg="success">OK ({tests.santriCount} santri)</Badge>
                  ) : tests.firestore === 'loading' ? (
                    <Badge bg="info">Loading...</Badge>
                  ) : (
                    <Badge bg="danger">FAIL</Badge>
                  )}
                </td>
              </tr>
              <tr>
                <td>Santri API</td>
                <td>
                  {tests.santriAPI === 'ok' ? (
                    <Badge bg="success">OK ({tests.santriAPICount})</Badge>
                  ) : tests.santriAPI === 'loading' ? (
                    <Badge bg="info">Loading...</Badge>
                  ) : tests.santriAPI ? (
                    <Badge bg="danger">FAIL</Badge>
                  ) : (
                    <Badge bg="secondary">Not tested</Badge>
                  )}
                </td>
              </tr>
              <tr>
                <td>Jenis Izin API</td>
                <td>
                  {tests.jenisIzin === 'ok' ? (
                    <Badge bg="success">OK</Badge>
                  ) : tests.jenisIzin === 'loading' ? (
                    <Badge bg="info">Loading...</Badge>
                  ) : tests.jenisIzin ? (
                    <Badge bg="danger">FAIL</Badge>
                  ) : (
                    <Badge bg="secondary">Not tested</Badge>
                  )}
                </td>
              </tr>
              <tr>
                <td>Stats API (Dashboard)</td>
                <td>
                  {tests.stats === 'ok' ? (
                    <Badge bg="success">OK</Badge>
                  ) : tests.stats === 'loading' ? (
                    <Badge bg="info">Loading...</Badge>
                  ) : tests.stats ? (
                    <Badge bg="danger">FAIL</Badge>
                  ) : (
                    <Badge bg="secondary">Not tested</Badge>
                  )}
                </td>
              </tr>
              <tr>
                <td>Write Permission</td>
                <td>
                  {tests.write === 'ok' ? (
                    <Badge bg="success">OK</Badge>
                  ) : tests.write === 'loading' ? (
                    <Badge bg="info">Loading...</Badge>
                  ) : tests.write ? (
                    <Badge bg="danger">FAIL</Badge>
                  ) : (
                    <Badge bg="secondary">Not tested</Badge>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
          {tests.jenisIzinItems && (
            <div className="small mt-2 text-muted">Jenis Izin: {tests.jenisIzinItems}</div>
          )}
          {tests.error && (
            <div className="small mt-2 text-danger">{tests.error}</div>
          )}
        </Card.Body>
      </Card>

      {/* Action Buttons */}
      <div className="d-grid gap-2 mb-3">
        <Button variant="primary" onClick={runAllTests}>
          <i className="bi bi-play-circle me-1"></i>
          Run All Tests
        </Button>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" size="sm" onClick={testFirestore} className="flex-fill">
            Firestore
          </Button>
          <Button variant="outline-secondary" size="sm" onClick={testSantriAPI} className="flex-fill">
            Santri API
          </Button>
          <Button variant="outline-secondary" size="sm" onClick={testJenisIzin} className="flex-fill">
            Jenis Izin
          </Button>
          <Button variant="outline-secondary" size="sm" onClick={testStats} className="flex-fill">
            Stats
          </Button>
        </div>
      </div>

      {/* Logs */}
      {logs.length > 0 && (
        <Card className="border-0">
          <Card.Header className="bg-dark text-white">
            <i className="bi bi-terminal me-1"></i>
            Console Logs
          </Card.Header>
          <Card.Body className="p-0" style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <div className="small font-monospace">
              {logs.map((log, i) => (
                <div key={i} className="px-2 py-1 border-bottom">
                  <span className="text-muted">{log.time}</span>{' '}
                  <span className={log.color}>{log.message}</span>
                </div>
              ))}
            </div>
          </Card.Body>
        </Card>
      )}
    </Container>
  );
}

export default DebugPanel;
