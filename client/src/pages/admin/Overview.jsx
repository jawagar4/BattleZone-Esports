import { Link } from 'react-router-dom';
import api, { unwrap } from '../../services/api';
import useFetch from '../../hooks/useFetch';
import EmptyState from '../../components/EmptyState';
import Loader from '../../components/Loader';
import PaymentStatus from '../../components/PaymentStatus';
import { fmtDateTime, inrPaise } from '../../services/format';
import { PageHead } from './adminKit';

export default function Overview() {
  const { data: d, loading, error, reload } = useFetch(async () => unwrap(await api.get('/admin/dashboard')), []);
  if (loading) return <Loader message="Loading overview…" />;
  if (error) return <EmptyState icon="bi-wifi-off" title="Couldn't load the overview" action={<button className="btn btn-ghost" onClick={() => reload()}>Try again</button>}>{error}</EmptyState>;
  const cards = [['Players', d.totals.users], ['Teams', d.totals.teams], ['Tournaments', d.totals.tournaments], ['Successful payments', d.totals.successfulPayments], ['Pending payments', d.totals.pendingPayments], ['Revenue', inrPaise(d.revenue.gross)]];
  return (
    <>
      <PageHead title="Overview"><button className="btn btn-ghost btn-sm" onClick={() => reload(true)}><i className="bi bi-arrow-clockwise" /> Refresh</button></PageHead>
      <div className="row g-3 mb-4">{cards.map(([l, v]) => <div className="col-6 col-lg-4" key={l}><div className="bz-card"><div className="bz-stat">{v}</div><div className="text-muted small mt-1">{l}</div></div></div>)}</div>
      <div className="row g-3">
        <div className="col-12 col-xl-6"><section className="bz-card h-100"><h5>Slot occupancy</h5>
          {d.occupancy.length === 0 ? <p className="text-muted mb-0">No published tournaments.</p> : d.occupancy.map((t) => { const pct = Math.round((t.reservedSlots / t.maxTeams) * 100); return <div key={t._id} className="mb-3"><div className="d-flex justify-content-between small mb-1"><span>{t.name}</span><span className="text-muted">{t.reservedSlots}/{t.maxTeams} ({pct}%)</span></div><div className={`slot-meter ${pct > 80 ? 'low' : ''}`} role="img" aria-label={`${pct}% full`}><span style={{ width: `${pct}%` }} /></div></div>; })}</section></div>
        <div className="col-12 col-xl-6"><section className="bz-card h-100"><h5>Recent registrations</h5>
          {d.recentRegistrations.length === 0 ? <p className="text-muted mb-0">Nothing yet.</p> : d.recentRegistrations.map((r) => <div key={r._id} className="d-flex justify-content-between gap-2 py-2 border-top small" style={{ borderColor: 'var(--bz-line)' }}><span><b>{r.teamSnapshot?.teamName}</b><br /><span className="text-muted">{r.tournamentId?.name} · {r.captainId?.name}</span></span><PaymentStatus status={r.status} /></div>)}</section></div>
        <div className="col-12 col-xl-6"><section className="bz-card h-100"><h5>Live now</h5>{d.live.length === 0 ? <p className="text-muted mb-0">No live tournaments.</p> : d.live.map((t) => <div key={t._id} className="py-1"><Link to="/admin/tournaments">{t.name}</Link> <PaymentStatus status="live" /></div>)}</section></div>
        <div className="col-12 col-xl-6"><section className="bz-card h-100"><h5>Upcoming</h5>{d.upcoming.length === 0 ? <p className="text-muted mb-0">Nothing scheduled.</p> : d.upcoming.map((t) => <div key={t._id} className="d-flex justify-content-between py-1 small"><span>{t.name}</span><span className="text-muted">{fmtDateTime(t.tournamentStart)}</span></div>)}</section></div>
      </div>
    </>
  );
}
