export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="container bz-page d-flex align-items-start justify-content-center">
      <div className="w-100" style={{ maxWidth: 460 }}>
        <div className="bz-card">
          <h1 className="h3 mb-1">{title}</h1>
          {subtitle && <p className="text-muted">{subtitle}</p>}
          {children}
        </div>
        {footer && <div className="text-center text-muted mt-3 small">{footer}</div>}
      </div>
    </div>
  );
}
