export default function EmptyState({ icon = 'bi-inbox', title, children, action }) {
  return <div className="empty"><i className={`bi ${icon}`} /><h5 className="text-white">{title}</h5>{children && <p className="mb-3">{children}</p>}{action}</div>;
}
