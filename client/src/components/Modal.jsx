import { useEffect, useRef } from 'react';

export default function Modal({ title, onClose, children, size }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="bz-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`bz-modal ${size || ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="bz-card">
          <div className="d-flex justify-content-between align-items-start mb-3 gap-3">
            <h5 className="mb-0">{title}</h5>
            <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close"><i className="bi bi-x-lg" /></button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
