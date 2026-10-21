import { forwardRef } from 'react';

const Field = forwardRef(function Field({ label, error, hint, as = 'input', children, id, className = '', ...rest }, ref) {
  const inputId = id || `f-${(label || rest.name || '').toString().replace(/\W+/g, '-').toLowerCase()}`;
  const Tag = as;
  const cls = `${as === 'select' ? 'form-select' : 'form-control'} ${error ? 'is-invalid' : ''}`;
  return (
    <div className={className}>
      {label && <label htmlFor={inputId} className="form-label">{label}</label>}
      <Tag id={inputId} ref={ref} className={cls} aria-invalid={!!error} aria-describedby={error ? `${inputId}-err` : undefined} {...rest}>{children}</Tag>
      {hint && !error && <div className="form-text text-muted">{hint}</div>}
      {error && <div id={`${inputId}-err`} className="invalid-feedback">{error.message || error}</div>}
    </div>
  );
});
export default Field;
