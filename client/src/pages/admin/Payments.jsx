import { useState } from 'react';
import api, { unwrap } from '../../services/api';
import PaymentStatus from '../../components/PaymentStatus';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import Loader from '../../components/Loader';
import Modal from '../../components/Modal';
import { useToast, useConfirm } from '../../context/ToastContext';
import { fmtDateTime, inrPaise } from '../../services/format';
import { openReceipt } from '../Payments';
import { PageHead, useAdminList, downloadCsv } from './adminKit';

export default function Payments() {
  const toast = useToast(); const confirm = useConfirm();
  const [f, setF] = useState({ search: '', status: '', from: '', to: '' });
  const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v));
  const { data, loading, error, reload, setPage, resetPage } = useAdminList('/admin/payments', params);
  const [refund, setRefund] = useState(null); const [reason, setReason] = useState(''); const [cancelReg, setCancelReg] = useState(true);
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); resetPage(); };

  const doRefund = async () => {
    try { await api.post(`/admin/payments/${refund._id}/refund`, { reason, cancelRegistration: cancelReg }); toast.success('Refund initiated'); setRefund(null); setReason(''); reload(true); } catch (e) { toast.fromError(e); }
  };
  const reconcile = async (p) => {
    if (!(await confirm({ title: 'Check with Razorpay?', message: 'We will ask the gateway whether this order was actually captured. A payment is only marked successful if the gateway confirms it.', confirmText: 'Check now' }))) return;
    try { const r = unwrap(await api.post(`/admin/payments/${p._id}/reconcile`)); r.changed ? toast.success('Gateway confirmed the payment. Registration updated.') : toast.info(r.message || 'No change'); reload(true); } catch (e) { toast.fromError(e); }
  };
  return (
    <>
      <PageHead title="Payments"><button className="btn btn-ghost btn-sm" onClick={() => downloadCsv('/admin/payments/export', params, 'payments.csv', toast)}><i className="bi bi-download" /> Export CSV</button></PageHead>
      <div className="bz-card mb-3"><div className="row g-2">
        <div className="col-12 col-md-4"><input className="form-control" type="search" placeholder="Team or registration ID" aria-label="Search payments" value={f.search} onChange={set('search')} /></div>
        <div className="col-12 col-md-2"><select className="form-select" aria-label="Status" value={f.status} onChange={set('status')}><option value="">Any status</option><option value="success">Paid</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="refunded">Refunded</option></select></div>
        <div className="col-6 col-md-3"><input className="form-control" type="date" aria-label="From date" value={f.from} onChange={set('from')} /></div>
        <div className="col-6 col-md-3"><input className="form-control" type="date" aria-label="To date" value={f.to} onChange={set('to')} /></div>
      </div></div>
      <div className="bz-card">
        {loading ? <Loader message="Loading payments…" /> : error ? <EmptyState icon="bi-wifi-off" title="Couldn't load payments">{error}</EmptyState> : data.items.length === 0 ? <EmptyState icon="bi-receipt" title="No payments match" /> : (
          <><div className="table-responsive"><table className="table bz-table stack-table"><thead><tr><th>Date</th><th>Team</th><th>Tournament</th><th>Amount</th><th>Gateway IDs</th><th>Status</th><th /></tr></thead><tbody>
            {data.items.map((p) => <tr key={p._id}><td data-label="Date">{fmtDateTime(p.createdAt)}</td><td data-label="Team">{p.registrationId?.teamSnapshot?.teamName}<div className="small text-muted">{p.userId?.name}</div></td><td data-label="Tournament">{p.tournamentId?.name}</td><td data-label="Amount">{inrPaise(p.amount)}</td>
              <td data-label="Gateway IDs" className="small text-break text-muted">{p.gatewayOrderId}<br />{p.gatewayPaymentId}{p.verifiedVia && <><br />via {p.verifiedVia}</>}</td><td data-label="Status"><PaymentStatus status={p.status} /></td>
              <td data-label="" className="actions text-end">
                {['pending', 'failed'].includes(p.status) && <button className="btn btn-ghost btn-sm me-1" onClick={() => reconcile(p)}>Check gateway</button>}
                {p.status === 'success' && <><button className="btn btn-ghost btn-sm me-1" onClick={() => openReceipt(p._id, toast)}>Receipt</button><button className="btn btn-danger-soft btn-sm" onClick={() => setRefund(p)}>Refund</button></>}</td></tr>)}
          </tbody></table></div><Pagination meta={data.meta} onPage={setPage} /></>)}
      </div>
      {refund && (
        <Modal title="Refund payment" onClose={() => setRefund(null)}>
          <p className="text-muted">Refund {inrPaise(refund.amount)} to the player's original payment method through Razorpay.</p>
          <label className="form-label" htmlFor="rr">Reason (recorded in the audit log)</label>
          <input id="rr" className="form-control mb-3" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="form-check mb-3"><input id="cr" type="checkbox" className="form-check-input" checked={cancelReg} onChange={(e) => setCancelReg(e.target.checked)} /><label htmlFor="cr" className="form-check-label">Also cancel the registration and free the slot</label></div>
          <div className="d-flex justify-content-end gap-2"><button className="btn btn-ghost" onClick={() => setRefund(null)}>Cancel</button><button className="btn btn-danger-soft" disabled={reason.trim().length < 3} onClick={doRefund}>Refund</button></div>
        </Modal>)}
    </>
  );
}
