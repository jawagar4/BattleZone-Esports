import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import api, { unwrap } from '../services/api';
import useFetch from '../hooks/useFetch';
import useSocketEvent from '../hooks/useSocket';
import { useAuth } from '../context/AuthContext';
import CountdownTimer from '../components/CountdownTimer';
import PaymentStatus from '../components/PaymentStatus';
import EmptyState from '../components/EmptyState';
import { Skeleton } from '../components/Loader';
import { fmtDateTime, inrPaise } from '../services/format';

export default function Dashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(async () => unwrap(await api.get('/users/dashboard')), []);
  const refresh = useCallback(() => reload(true), [reload]);
  useSocketEvent('notification', refresh);
  useSocketEvent('tournament:update', refresh);

  const markAll = async () => { await api.post('/notifications/read-all'); reload(true); };
  if (loading) return <div className="container bz-page"><Skeleton h={40} w="50%" className="mb-4" /><div className="row g-3">{[0, 1, 2].map((i) => <div className="col-12 col-md-4" key={i}><Skeleton h={90} /></div>)}</div></div>;
  if (error) return <div className="container bz-page"><EmptyState icon="bi-wifi-off" title="Couldn't load your dashboard" action={<button className="btn btn-ghost" onClick={() => reload()}>Try again</button>}>{error}</EmptyState></div>;
  const d = data;
  const stats = [['Tournaments joined', d.stats.tournamentsJoined], ['Teams', d.stats.teams], ['Total paid', inrPaise(d.stats.totalPaid)]];

  return (
    <div className="container bz-page">
      <div className="d-flex align-items-center gap-3 mb-4 flex-wrap mt-5">
        <div className="avatar " aria-hidden="true">{user.name[0].toUpperCase()}</div>
        <div className="flex-grow-1"><h1 className="h3 mb-0">Welcome back, {user.name.split(' ')[0]}</h1><div className="text-muted small">{user.email}</div></div>
        <Link to="/profile" className="btn btn-ghost btn-sm">Edit profile</Link>
      </div>

      <div className="row g-3 mb-4">
        {stats.map(([l, v]) => <div className="col-12 col-sm-4" key={l}><div className="bz-card"><div className="bz-stat">{v}</div><div className="text-muted small mt-1">{l}</div></div></div>)}
      </div>

      {d.nextTournament && (
        <div className="bz-card mb-4 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div><div className="text-muted small">Your next tournament</div><h4 className="mb-0"><Link to={`/tournaments/${d.nextTournament._id}`} className="text-white">{d.nextTournament.name}</Link></h4><div className="text-muted small">{fmtDateTime(d.nextTournament.tournamentStart)}</div></div>
          <CountdownTimer target={d.nextTournament.tournamentStart} large label="Time until your tournament" />
        </div>
      )}

      <div className="row g-4">
        <div className="col-12 col-lg-7 d-grid gap-4 align-content-start">
          <section className="bz-card">
            <h5>Registrations</h5>
            {d.registrations.length === 0 ? <EmptyState icon="bi-trophy" title="No registrations yet" action={<Link to="/tournaments" className="btn btn-bz">Find a tournament</Link>}>Pick a tournament and register your team.</EmptyState> : (
              <div className="table-responsive"><table className="table bz-table stack-table"><thead><tr><th>Tournament</th><th>Team</th><th>Status</th><th /></tr></thead><tbody>
                {d.registrations.map((r) => (
                  <tr key={r._id}><td data-label="Tournament">{r.tournamentId ? <Link to={`/tournaments/${r.tournamentId._id}`}>{r.tournamentId.name}</Link> : '—'}</td><td data-label="Team">{r.teamSnapshot?.teamName}</td><td data-label="Status"><PaymentStatus status={r.status} /></td>
                    <td data-label="" className="text-end">{r.status === 'pending_payment' && <Link className="btn btn-bz btn-sm" to={`/checkout/${r._id}`}>Pay now</Link>}</td></tr>))}
              </tbody></table></div>)}
          </section>
          <section className="bz-card">
            <h5>Upcoming matches</h5>
            {d.upcomingMatches.length === 0 ? <p className="text-muted mb-0">No matches scheduled yet. Times appear here once organisers publish them.</p> : (
              <ul className="list-unstyled d-grid gap-2 mb-0">{d.upcomingMatches.map((m) => <li key={m._id} className="member-block mb-0 d-flex justify-content-between gap-2 flex-wrap"><span><b>{m.label || `Round ${m.round}`}</b> <span className="text-muted">· {m.tournamentId?.name}</span></span><span className="text-muted">{fmtDateTime(m.scheduledAt)}</span></li>)}</ul>)}
          </section>
          <section className="bz-card">
            <div className="d-flex justify-content-between align-items-center mb-2"><h5 className="mb-0">Recent payments</h5><Link to="/payments" className="small">All payments</Link></div>
            {d.recentPayments.length === 0 ? <p className="text-muted mb-0">No payments yet.</p> : d.recentPayments.map((p) => <div key={p._id} className="d-flex justify-content-between py-2 border-top" style={{ borderColor: 'var(--bz-line)' }}><span>{inrPaise(p.amount)}</span><PaymentStatus status={p.status} /></div>)}
          </section>
        </div>
        <aside className="col-12 col-lg-5">
          <section className="bz-card">
            <div className="d-flex justify-content-between align-items-center mb-2"><h5 className="mb-0">Notifications {d.unreadNotifications > 0 && <span className="notif-dot">{d.unreadNotifications}</span>}</h5>{d.unreadNotifications > 0 && <button className="btn btn-ghost btn-sm" onClick={markAll}>Mark all read</button>}</div>
            {d.notifications.length === 0 ? <p className="text-muted mb-0">Confirmations, reminders and organiser announcements show up here.</p> : (
              <ul className="list-unstyled d-grid gap-2 mb-0">{d.notifications.map((n) => <li key={n._id} className="member-block mb-0" style={{ opacity: n.readAt ? 0.65 : 1 }}><div className="fw-semibold">{n.title}</div><div className="small text-muted">{n.message}</div><div className="small text-muted mt-1">{fmtDateTime(n.createdAt)}</div></li>)}</ul>)}
          </section>
        </aside>
      </div>
    </div>
  );
}
