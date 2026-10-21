import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Modal from '../components/Modal';

const Ctx = createContext(null);
export const useToast = () => useContext(Ctx).toast;
export const useConfirm = () => useContext(Ctx).confirm;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const id = useRef(0);

  const push = useCallback((type, message) => {
    const key = ++id.current;
    setToasts((t) => [...t.slice(-3), { key, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.key !== key)), type === 'error' ? 6500 : 4000);
  }, []);
  const toast = useMemo(() => ({
    success: (m) => push('success', m), error: (m) => push('error', m), info: (m) => push('info', m),
    fromError: (e) => push('error', e?.userMessage || e?.message || 'Something went wrong'),
  }), [push]);
  const confirm = useCallback((opts) => new Promise((resolve) => setDialog({ ...opts, resolve })), []);
  const close = (v) => { dialog.resolve(v); setDialog(null); };

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}
      <div className="bz-toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.key} className={`bz-toast ${t.type}`}>
            <i className={`bi ${t.type === 'success' ? 'bi-check-circle-fill text-success' : t.type === 'error' ? 'bi-exclamation-octagon-fill text-danger' : 'bi-info-circle-fill text-info'}`} />
            <div>{t.message}</div>
          </div>
        ))}
      </div>
      {dialog && (
        <Modal title={dialog.title || 'Are you sure?'} onClose={() => close(false)}>
          <p className="text-muted">{dialog.message}</p>
          <div className="d-flex gap-2 justify-content-end flex-wrap">
            <button className="btn btn-ghost" onClick={() => close(false)}>{dialog.cancelText || 'Keep it'}</button>
            <button className={`btn ${dialog.danger ? 'btn-danger-soft' : 'btn-bz'}`} onClick={() => close(true)}>{dialog.confirmText || 'Confirm'}</button>
          </div>
        </Modal>
      )}
    </Ctx.Provider>
  );
}
