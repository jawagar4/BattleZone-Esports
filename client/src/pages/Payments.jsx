import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { unwrap } from '../services/api';
import useFetch from '../hooks/useFetch';
import PaymentStatus from '../components/PaymentStatus';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import Loader from '../components/Loader';
import { useToast } from '../context/ToastContext';
import { fmtDateTime, inrPaise } from '../services/format';

export async function openReceipt(id, toast) {
  const w = window.open('', '_blank');
  try {
    const res = await api.get(`/payments/${id}/receipt`, { responseType: 'text', transformResponse: (d) => d });
    const url = URL.createObjectURL(new Blob([res.data], { type: 'text/html' }));
    if (w) w.location.href = url; else window.location.href = url;
  } catch (e) { w?.close(); toast.fromError(e); }
}

export default function Payments() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const { data, loading, error, reload } = useFetch(async () => { const r = await api.get('/payments/history', { params: { page, limit: 15, ...(status ? { status } : {}) } }); return { items: unwrap(r).items, meta: r.data.meta }; }, [page, status]);
  return (
    <div className="container bz-page">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h1 className="h2 mb-0">Payment history</h1>
        <select className="form-select w-auto" aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option><option value="success">Paid</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="refunded">Refunded</option>
        </select>
      </div>
      <div className="bz-card">
        {loading ? <Loader message="Loading payments…" /> : error ? <EmptyState icon="bi-wifi-off" title="Couldn't load payments" action={<button className="btn btn-ghost" onClick={() => reload()}>Try again</button>}>{error}</EmptyState> : data.items.length === 0 ? (
          <EmptyState icon="bi-receipt" title="No payments yet" action={<Link to="/tournaments" className="btn btn-bz">Browse tournaments</Link>}>Paid entries and their receipts will be listed here.</EmptyState>
        ) : (
          <>
            <div className="table-responsive"><table className="table bz-table stack-table"><thead><tr><th>Date</th><th>Tournament</th><th>Team</th><th>Amount</th><th>Transaction ID</th><th>Status</th><th /></tr></thead><tbody>
              {data.items.map((p) => (
                <tr key={p._id}><td data-label="Date">{fmtDateTime(p.createdAt)}</td><td data-label="Tournament">{p.tournamentId?.name}</td><td data-label="Team">{p.registrationId?.teamSnapshot?.teamName}</td><td data-label="Amount">{inrPaise(p.amount)}</td>
                  <td data-label="Transaction ID" className="small text-break">{p.gatewayPaymentId || p.gatewayOrderId}</td><td data-label="Status"><PaymentStatus status={p.status} /></td>
                  <td data-label="" className="actions text-end">{p.status === 'pending' && p.registrationId?.status === 'pending_payment' && <Link className="btn btn-bz btn-sm" to={`/checkout/${p.registrationId._id}`}>Pay</Link>}{['success', 'refunded', 'failed'].includes(p.status) && p.status !== 'failed' && <button className="btn btn-ghost btn-sm" onClick={() => openReceipt(p._id, toast)}><i className="bi bi-download" /> Receipt</button>}</td></tr>))}
            </tbody></table></div>
            <Pagination meta={data.meta} onPage={setPage} />
          </>)}
      </div>
    </div>
  );
}
