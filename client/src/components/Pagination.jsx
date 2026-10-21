export default function Pagination({ meta, onPage }) {
  if (!meta || meta.pages <= 1) return null;
  return (
    <nav className="d-flex justify-content-between align-items-center mt-3" aria-label="Pagination">
      <button className="btn btn-ghost btn-sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}><i className="bi bi-chevron-left" /> Previous</button>
      <span className="text-muted small">Page {meta.page} of {meta.pages} · {meta.total} total</span>
      <button className="btn btn-ghost btn-sm" disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)}>Next <i className="bi bi-chevron-right" /></button>
    </nav>
  );
}
