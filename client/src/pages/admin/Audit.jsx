import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import Loader from '../../components/Loader';
import { fmtDateTime } from '../../services/format';
import { PageHead, useAdminList } from './adminKit';

export default function Audit() {
  const { data, loading, error, setPage } = useAdminList('/admin/audit-logs');
  return (
    <>
      <PageHead title="Audit log" />
      <div className="bz-card">
        {loading ? <Loader message="Loading audit log…" /> : error ? <EmptyState icon="bi-wifi-off" title="Couldn't load the audit log">{error}</EmptyState> : data.items.length === 0 ? <EmptyState icon="bi-journal-text" title="No admin actions recorded yet" /> : (
          <><div className="table-responsive"><table className="table bz-table stack-table"><thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Entity</th><th>Changes</th></tr></thead><tbody>
            {data.items.map((l) => <tr key={l._id}><td data-label="When">{fmtDateTime(l.createdAt)}</td><td data-label="Admin">{l.adminId?.name || '—'}</td><td data-label="Action"><code>{l.action}</code></td><td data-label="Entity">{l.entityType} <span className="text-muted small">{l.entityId.slice(-6)}</span></td><td data-label="Changes" className="small text-break" style={{ maxWidth: 360 }}>{l.changes ? JSON.stringify(l.changes).slice(0, 220) : '—'}</td></tr>)}
          </tbody></table></div><Pagination meta={data.meta} onPage={setPage} /></>)}
      </div>
    </>
  );
}
