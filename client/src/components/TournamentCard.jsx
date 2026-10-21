import { Link } from 'react-router-dom';
import GameArt from './GameArt';
import PaymentStatus from './PaymentStatus';
import CountdownTimer from './CountdownTimer';
import { assetUrl } from '../services/api';
import { fmtDateTime, inr } from '../services/format';

export default function TournamentCard({ t }) {
  const slotsPct = Math.min(100, Math.round((t.reservedSlots / t.maxTeams) * 100));
  const target = t.phase === 'upcoming' ? t.registrationStart : t.phase === 'registration_open' ? t.registrationEnd : t.tournamentStart;
  const countdownLabel = t.phase === 'upcoming' ? 'Registration opens in' : t.phase === 'registration_open' ? 'Registration closes in' : 'Starts in';
  const showTimer = ['upcoming', 'registration_open', 'full', 'registration_closed', 'paused'].includes(t.phase);
  return (
    <article className="bz-card flush glow h-100 d-flex flex-column">
      <div className="t-banner">
        {t.bannerUrl ? <img src={assetUrl(t.bannerUrl)} alt="" loading="lazy" /> : <GameArt game={t.game} style={{ width: '100%', height: '100%' }} />}
        <PaymentStatus status={t.phase} kind="phase" />
      </div>
      <div className="p-3 d-flex flex-column gap-3 flex-grow-1">
        <div>
          <div className="text-muted small">{t.game}{t.gameMode ? ` · ${t.gameMode}` : ''}</div>
          <h5 className="mb-0 mt-1"><Link to={`/tournaments/${t._id}`} className="text-white stretched-link">{t.name}</Link></h5>
        </div>
        <div className="row g-2 text-center">
          <div className="col-4"><div className="bz-stat" style={{ fontSize: '1.15rem' }}>{inr(t.entryFee)}</div><small className="text-muted">Entry</small></div>
          <div className="col-4"><div className="bz-stat" style={{ fontSize: '1.15rem', color: 'var(--bz-green)' }}>{inr(t.prizePool)}</div><small className="text-muted">Prize pool</small></div>
          <div className="col-4"><div className="bz-stat" style={{ fontSize: '1.15rem' }}>{t.allowedTeamSizes.join('/')}</div><small className="text-muted">Players</small></div>
        </div>
        <div>
          <div className="d-flex justify-content-between small mb-1"><span className="text-muted">Slots</span><span>{t.availableSlots} of {t.maxTeams} left</span></div>
          <div className={`slot-meter ${slotsPct > 80 ? 'low' : ''}`} role="img" aria-label={`${t.availableSlots} of ${t.maxTeams} slots available`}><span style={{ width: `${slotsPct}%` }} /></div>
        </div>
        <div className="mt-auto small text-muted">
          {showTimer ? (<div className="d-flex flex-column gap-1"><span>{countdownLabel}</span><CountdownTimer target={target} label={countdownLabel} /></div>) : <span><i className="bi bi-clock" /> {fmtDateTime(t.tournamentStart, t.timezone)}</span>}
        </div>
      </div>
    </article>
  );
}
