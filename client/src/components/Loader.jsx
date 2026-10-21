export function LogoMark({ size = 64 }) {
  return (
    <svg className="loader-logo" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M12 14h26l14 14v8L38 50H12z" stroke="#2f7bff" />
      <path d="M22 24h14l6 6-6 6H22z" stroke="#35f28b" />
    </svg>
  );
}
export default function Loader({ message = 'Loading…', fullscreen = false }) {
  return (
    <div className={`loader-wrap ${fullscreen ? 'fullscreen' : ''}`} role="status" aria-live="polite">
      <div>
        <LogoMark />
        <div className="loader-bar" />
        <div className="text-muted small">{message}</div>
      </div>
    </div>
  );
}
export function Skeleton({ h = 16, w = '100%', className = '' }) {
  return <div className={`skeleton ${className}`} style={{ height: h, width: w }} aria-hidden="true" />;
}
export function CardSkeleton({ count = 3 }) {
  return (
    <div className="row g-3" aria-busy="true" aria-label="Loading tournaments">
      {Array.from({ length: count }, (_, i) => (
        <div className="col-12 col-md-6 col-lg-4" key={i}>
          <div className="bz-card flush"><Skeleton h={150} /><div className="p-3 d-grid gap-2"><Skeleton h={20} w="70%" /><Skeleton h={14} w="45%" /><Skeleton h={40} /><Skeleton h={44} /></div></div>
        </div>
      ))}
    </div>
  );
}
