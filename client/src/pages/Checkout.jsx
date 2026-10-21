import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { unwrap } from '../services/api';
import useFetch from '../hooks/useFetch';
import CountdownTimer from '../components/CountdownTimer';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';
import PaymentStatus from '../components/PaymentStatus';
import { useToast, useConfirm } from '../context/ToastContext';
import { inrPaise, fmtDateTime } from '../services/format';

function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve; s.onerror = () => reject(new Error('Could not load the payment window. Check your connection.'));
    document.body.appendChild(s);
  });
}

export default function Checkout() {
  const { registrationId } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, loading, error, reload } = useFetch(async () => unwrap(await api.get(`/registrations/${registrationId}`)), [registrationId]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const poll = useRef(null);
  useEffect(() => { document.body.classList.add('has-pay-bar'); return () => { document.body.classList.remove('has-pay-bar'); clearInterval(poll.current); }; }, []);

  if (loading) return <Loader message="Loading your registration…" />;
  if (error) return <div className="container bz-page"><EmptyState icon="bi-exclamation-triangle" title="Registration not found">{error}</EmptyState></div>;
  const { registration: r, fee, payments } = data;
  const t = r.tournamentId;
  const lastPayment = payments[0];

  // Webhooks can confirm a payment before the browser callback arrives, so poll briefly for the server's verdict.
  const waitForConfirmation = () => {
    setMsg('Verifying your payment…');
    let tries = 0;
    clearInterval(poll.current);
    poll.current = setInterval(async () => {
      tries += 1;
      try {
        const fresh = unwrap(await api.get(`/registrations/${registrationId}`));
        if (fresh.registration.status !== 'pending_payment') { clearInterval(poll.current); setMsg(''); toast.success('Payment verified'); reload(true); }
      } catch { /* keep trying */ }
      if (tries > 20) { clearInterval(poll.current); setMsg('Still waiting for the bank. If money left your account, your slot will be confirmed automatically, or contact support with your registration ID.'); }
    }, 3000);
  };

  const pay = async () => {
    setBusy(true); setMsg('');
    try {
      await loadRazorpay();
      const o = unwrap(await api.post('/payments/create-order', { registrationId: r._id }));
      const rzp = new window.Razorpay({
        key: o.keyId, amount: o.amount, currency: o.currency, order_id: o.orderId, name: import.meta.env.VITE_APP_NAME || 'BattleZone Esports',
        description: `${t.name} · ${r.teamSnapshot.teamName}`, prefill: o.prefill, theme: { color: '#2f7bff' },
        modal: { ondismiss: () => setBusy(false) },
        handler: async (resp) => {
          try { await api.post('/payments/verify', resp); toast.success('Payment verified. You are in!'); reload(true); }
          catch (e) { toast.error(e.userMessage); waitForConfirmation(); }
          finally { setBusy(false); }
        },
      });
      rzp.on('payment.failed', (f) => { toast.error(f.error?.description || 'Payment failed. You can try again.'); setBusy(false); reload(true); });
      rzp.open();
    } catch (e) {
      toast.fromError(e);
      if (e.apiCode === 'HOLD_EXPIRED') nav(`/tournaments/${t._id}`);
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!(await confirm({ title: 'Release this slot?', message: 'Your team will lose its reserved slot. You can register again if slots remain.', confirmText: 'Release slot', danger: true }))) return;
    try { await api.delete(`/registrations/${r._id}`); toast.success('Registration cancelled'); nav(`/tournaments/${t._id}`); } catch (e) { toast.fromError(e); }
  };

  const done = r.status !== 'pending_payment';
  return (
    <div className="container bz-page" style={{ maxWidth: 760 }}>
      <h1 className="h2 mb-3">{done ? 'Registration' : 'Complete your payment'}</h1>
      <div className="bz-card mb-3">
        <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
          <div><div className="text-muted small">Tournament</div><div className="fw-semibold">{t.name}</div><div className="text-muted small mt-2">Team</div><div className="fw-semibold">{r.teamSnapshot.teamName} <span className="text-muted fw-normal">({r.teamSnapshot.size} players)</span></div></div>
          <div className="text-end"><PaymentStatus status={r.status} /><div className="small text-muted mt-2">ID <b className="text-white">{r.registrationId}</b></div><div className="small text-muted">Starts {fmtDateTime(t.tournamentStart)}</div></div>
        </div>
      </div>

      {r.status === 'pending_payment' && (
        <>
          <div className="bz-card mb-3">
            <h5>Entry fee breakdown</h5>
            <ul className="list-unstyled mb-0 d-grid gap-2">
              <li className="d-flex justify-content-between"><span>Entry fee</span><span>{inrPaise(fee.entryFee)}</span></li>
              {fee.platformFee > 0 && <li className="d-flex justify-content-between"><span>Platform fee</span><span>{inrPaise(fee.platformFee)}</span></li>}
              {fee.tax > 0 && <li className="d-flex justify-content-between"><span>Tax</span><span>{inrPaise(fee.tax)}</span></li>}
              <li className="d-flex justify-content-between fw-bold border-top pt-2" style={{ borderColor: 'var(--bz-line)' }}><span>Total payable</span><span style={{ color: 'var(--bz-green)' }}>{inrPaise(fee.total)}</span></li>
            </ul>
          </div>
          {r.holdExpiresAt && <div className="bz-card mb-3 d-flex justify-content-between align-items-center flex-wrap gap-2"><span>Slot held for</span><CountdownTimer target={r.holdExpiresAt} doneLabel="Hold expired" label="Slot hold" /></div>}
          {lastPayment?.status === 'failed' && <div className="alert alert-danger" role="alert">Your last payment attempt failed{lastPayment.failureReason ? `: ${lastPayment.failureReason}` : ''}. You can try again.</div>}
          {msg && <div className="alert alert-info" role="status">{msg}</div>}
          <div className="d-none d-md-flex gap-2"><button className="btn btn-bz btn-lg flex-grow-1" onClick={pay} disabled={busy}>{busy ? 'Opening payment…' : `Pay ${inrPaise(fee.total)}`}</button><button className="btn btn-ghost btn-lg" onClick={cancel}>Release slot</button></div>
          <div className="mobile-pay-bar d-md-none d-flex gap-2"><button className="btn btn-ghost" onClick={cancel} aria-label="Release slot"><i className="bi bi-trash" /></button><button className="btn btn-bz flex-grow-1" onClick={pay} disabled={busy}>{busy ? 'Opening…' : `Pay ${inrPaise(fee.total)}`}</button></div>
          <p className="text-muted small mt-3"><i className="bi bi-shield-lock" /> Payments are processed by Razorpay (UPI, cards, net banking). Your slot is confirmed only after we verify the payment on our server.</p>
        </>
      )}

      {r.status === 'confirmed' && <div className="bz-card text-center"><i className="bi bi-patch-check-fill" style={{ fontSize: '2.5rem', color: 'var(--bz-green)' }} /><h4 className="mt-2">You're confirmed</h4><p className="text-muted">Registration ID <b className="text-white">{r.registrationId}</b>. Match times and reminders will show on your dashboard.</p><div className="d-flex gap-2 justify-content-center flex-wrap"><Link to="/dashboard" className="btn btn-bz">Go to dashboard</Link>{r.paymentId && <Link to="/payments" className="btn btn-ghost">View receipt</Link>}</div></div>}
      {r.status === 'pending_approval' && <div className="alert alert-info">Payment received. An organiser will approve your entry soon; you'll be notified.</div>}
      {['expired', 'cancelled', 'rejected'].includes(r.status) && <EmptyState icon="bi-x-circle" title={`Registration ${r.status}`} action={<Link to={`/tournaments/${t._id}`} className="btn btn-ghost">Back to tournament</Link>}>This registration no longer holds a slot.</EmptyState>}
    </div>
  );
}
