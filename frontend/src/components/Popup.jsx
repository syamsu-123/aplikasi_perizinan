import { useState, createContext, useContext } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';

const PopupContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const usePopup = () => useContext(PopupContext);

export function PopupProvider({ children }) {
  const [alertPopup, setAlertPopup] = useState(null);
  const [confirmPopup, setConfirmPopup] = useState(null);

  const showAlert = (type, message, title = '') => {
    return new Promise((resolve) => {
      setAlertPopup({ type, message, title: title || (type === 'success' ? 'Berhasil' : type === 'danger' ? 'Error' : 'Info'), resolve });
    });
  };

  const showConfirm = (options) => {
    return new Promise((resolve) => {
      setConfirmPopup({ ...options, resolve });
    });
  };

  const closeAlert = () => {
    if (alertPopup) {
      alertPopup.resolve();
      setAlertPopup(null);
    }
  };

  const closeConfirm = (value) => {
    if (confirmPopup) {
      confirmPopup.resolve(value);
      setConfirmPopup(null);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'success': return 'bi-check-circle-fill text-success';
      case 'danger': return 'bi-x-circle-fill text-danger';
      case 'warning': return 'bi-exclamation-triangle-fill text-warning';
      default: return 'bi-info-circle-fill text-primary';
    }
  };

  return (
    <PopupContext.Provider value={{ showAlert, showConfirm }}>
      {children}

      {/* Alert Popup */}
      {alertPopup && (
        <Modal show={!!alertPopup} onHide={closeAlert} centered className="popup-modal">
          <Modal.Body className="text-center p-4">
            <i className={`bi ${getIcon(alertPopup.type)}`} style={{ fontSize: '3.5rem' }}></i>
            {alertPopup.title && <h5 className="fw-bold mt-3 mb-1">{alertPopup.title}</h5>}
            <p className="text-muted mb-0 small">{alertPopup.message}</p>
          </Modal.Body>
          <Modal.Footer className="border-0 pt-0 justify-content-center">
            <Button variant={alertPopup.type === 'danger' ? 'danger' : 'primary'} size="sm" onClick={closeAlert} className="px-4">
              OK
            </Button>
          </Modal.Footer>
        </Modal>
      )}

      {/* Confirm Popup */}
      {confirmPopup && (
        <Modal show={!!confirmPopup} onHide={() => closeConfirm(false)} centered className="popup-modal">
          <Modal.Body className="text-center p-4">
            <i className={`bi ${confirmPopup.icon || 'bi-question-circle-fill text-warning'}`} style={{ fontSize: '3.5rem' }}></i>
            {confirmPopup.title && <h5 className="fw-bold mt-3 mb-1">{confirmPopup.title}</h5>}
            <p className="text-muted mb-0 small">{confirmPopup.message}</p>

            {/* Input konfirmasi jika perlu */}
            {confirmPopup.requireInput && (
              <Form.Control
                type="text"
                className="mt-3"
                placeholder={confirmPopup.inputPlaceholder || 'Ketik konfirmasi...'}
                value={confirmPopup.inputValue || ''}
                onChange={(e) => setConfirmPopup({...confirmPopup, inputValue: e.target.value})}
                autoFocus
              />
            )}
          </Modal.Body>
          <Modal.Footer className="border-0 pt-0 justify-content-center gap-2">
            <Button variant="outline-secondary" size="sm" onClick={() => closeConfirm(false)}>
              {confirmPopup.cancelText || 'Batal'}
            </Button>
            <Button
              variant={confirmPopup.confirmVariant || 'primary'}
              size="sm"
              onClick={() => {
                if (confirmPopup.requireInput) {
                  closeConfirm(confirmPopup.inputValue || '');
                } else {
                  closeConfirm(true);
                }
              }}
              disabled={confirmPopup.requireInput && confirmPopup.inputValue !== confirmPopup.expectedInput}
            >
              {confirmPopup.confirmText || 'Ya, Lanjutkan'}
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </PopupContext.Provider>
  );
}
