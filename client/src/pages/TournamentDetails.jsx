import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { assetUrl, unwrap } from '../services/api';
import useFetch from '../hooks/useFetch';
import useSocketEvent from '../hooks/useSocket';
import { useAuth } from '../context/AuthContext';
import CountdownTimer from '../components/CountdownTimer';
import PaymentStatus from '../components/PaymentStatus';
import GameArt from '../components/GameArt';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';
import { fmtDateTime, inr, inrPaise } from '../services/format';

export default function TournamentDetails() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(async () => unwrap(await api.get(`/tournaments/${id}`)), [id]);
  const [live, setLive] = useState(null);
  const onUpdate = useCallback((u) => { if (u.id === id) { setLive(u); } }, [id]);
  useSocketEvent('tournament:update', onUpdate, { room: id });

  if (loading) return <Loader message="Loading tournament…" />;
  if (error) return <div className="container bz-page"><EmptyState icon="bi-exclamation-triangle" title="Tournament not found" action={<Link to="/tournaments" className="btn btn-ghost">Browse tournaments</Link>}>{error}</EmptyState></div>;

  const t = { ...data.tournament, ...(live ? { reservedSlots: live.reservedSlots, availableSlots: live.availableSlots, phase: live.phase || data.tournament.phase } : {}) };
  const offset = new Date(data.serverTime).getTime() - Date.now();
  const canRegister = t.phase === 'registration_open';
  const target = t.phase === 'upcoming' ? t.registrationStart : t.phase === 'registration_open' ? t.registrationEnd : t.tournamentStart;
  const label = t.phase === 'upcoming' ? 'Registration opens in' : t.phase === 'registration_open' ? 'Registration closes in' : 'Kick-off in';
  const go = () => (user ? nav(`/tournaments/${t._id}/register`) : nav('/login', { state: { from: `/tournaments/${t._id}/register` } }));
  const ctaText = { registration_open: 'Register team', upcoming: 'Registration not open yet', full: 'Tournament is full', registration_closed: 'Registration closed', live: 'Tournament in progress', completed: 'Tournament finished', cancelled: 'Tournament cancelled', paused: 'Registration paused' }[t.phase];

  return (
    <div className="container bz-page">
      <div className="bz-card flush mb-4">
        <div style={{ height: 'clamp(150px, 28vw, 260px)', position: 'relative' }}>
          {t.bannerUrl ? <img src={assetUrl(t.bannerUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <GameArt game={t.game} style={{ width: '100%', height: '100%' }} />}
        </div>
        <div className="p-3 p-md-4 d-flex flex-column flex-lg-row justify-content-between gap-3">
          <div><div className="d-flex gap-2 align-items-center mb-2 flex-wrap"><PaymentStatus status={t.phase} kind="phase" /><span className="text-muted small">{t.game}{t.gameMode ? ` · ${t.gameMode}` : ''}{t.map ? ` · ${t.map}` : ''}</span></div><h1 className="h2 mb-2">{t.name}</h1>{t.description && <p className="text-muted mb-0" style={{ maxWidth: 640 }}>{t.description}</p>}</div>
          {['upcoming', 'registration_open', 'full', 'registration_closed', 'paused'].includes(t.phase) && <div><div className="text-muted small mb-1">{label}</div><CountdownTimer large target={target} offset={offset} label={label} /></div>}
        </div>
      </div>

      <div className="row g-4">
        <div className="col-12 col-lg-8 d-grid gap-4 align-content-start">
          <section className="bz-card"><h4>Schedule</h4>
            <dl className="row mb-0 small">
              <dt className="col-5 col-sm-4 text-muted fw-normal">Registration opens</dt><dd className="col-7 col-sm-8">{fmtDateTime(t.registrationStart, t.timezone)}</dd>
              <dt className="col-5 col-sm-4 text-muted fw-normal">Registration closes</dt><dd className="col-7 col-sm-8">{fmtDateTime(t.registrationEnd, t.timezone)}</dd>
              <dt className="col-5 col-sm-4 text-muted fw-normal">Match start</dt><dd className="col-7 col-sm-8">{fmtDateTime(t.tournamentStart, t.timezone)} <span className="text-muted">({t.timezone})</span></dd>
            </dl>
          </section>
          <section className="bz-card"><h4>Rules</h4>{t.rules?.length ? <ol className="mb-0 ps-3 d-grid gap-2">{t.rules.map((r, i) => <li key={i}>{r}</li>)}</ol> : <p className="text-muted mb-0">Rules will be posted before registration closes.</p>}</section>
          {t.prizeDistribution?.length > 0 && <section className="bz-card"><h4>Prize distribution</h4><div className="row g-2">{t.prizeDistribution.map((p) => <div className="col-6 col-sm-4" key={p.place}><div className="member-block mb-0 text-center"><div className="text-muted small">{p.place}</div><div className="bz-stat" style={{ color: 'var(--bz-green)', fontSize: '1.4rem' }}>{inr(p.amount)}</div></div></div>)}</div></section>}
          <section className="bz-card"><h4>Matches</h4>
            {data.matches.length === 0 ? <p className="text-muted mb-0">The match schedule will appear here once it's published.</p> : (
              <div className="table-responsive"><table className="table bz-table stack-table"><thead><tr><th>Match</th><th>Time</th><th>Teams</th><th>Status</th></tr></thead><tbody>
                {data.matches.map((m) => <tr key={m._id}><td data-label="Match">{m.label || `Round ${m.round}`}</td><td data-label="Time">{fmtDateTime(m.scheduledAt, t.timezone)}</td><td data-label="Teams">{m.participatingTeams.length} teams</td><td data-label="Status"><PaymentStatus status={m.status} /></td></tr>)}
              </tbody></table></div>)}
          </section>
          <section className="bz-card"><h4>Refund policy</h4><p className="text-muted mb-0">{t.refundPolicy}</p></section>
        </div>

        <aside className="col-12 col-lg-4">
          <div className="bz-card" style={{ position: 'sticky', top: 90 }}>
            <div className="row g-2 text-center mb-3">
              <div className="col-6"><div className="bz-stat">{inr(t.entryFee)}</div><small className="text-muted">Entry fee</small></div>
              <div className="col-6"><div className="bz-stat" style={{ color: 'var(--bz-green)' }}>{inr(t.prizePool)}</div><small className="text-muted">Prize pool</small></div>
            </div>
            <ul className="list-unstyled small d-grid gap-2 mb-3">
              <li className="d-flex justify-content-between"><span className="text-muted">Team size</span><b>{t.allowedTeamSizes.join(' or ')} players</b></li>
              <li className="d-flex justify-content-between"><span className="text-muted">Slots left</span><b>{t.availableSlots} of {t.maxTeams}</b></li>
              {data.fee.total > 0 && <li className="d-flex justify-content-between"><span className="text-muted">You pay</span><b>{inrPaise(data.fee.total)}</b></li>}
            </ul>
            <div className={`slot-meter mb-3 ${t.reservedSlots / t.maxTeams > 0.8 ? 'low' : ''}`}><span style={{ width: `${Math.min(100, (t.reservedSlots / t.maxTeams) * 100)}%` }} /></div>
            <button className="btn btn-bz w-100" disabled={!canRegister} onClick={go}>{ctaText}</button>
            {!user && canRegister && <div className="text-muted small mt-2 text-center">You'll sign in first.</div>}
          </div>
        </aside>
      </div>
    </div>
  );
}
