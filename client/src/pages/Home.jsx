import { Link } from 'react-router-dom';
import useFetch from '../hooks/useFetch';
import api, { unwrap } from '../services/api';
import CountdownTimer from '../components/CountdownTimer';
import TournamentCard from '../components/TournamentCard';
import { CardSkeleton } from '../components/Loader';
import EmptyState from '../components/EmptyState';
import GameArt from '../components/GameArt';
import PaymentStatus from '../components/PaymentStatus';
import { GAMES } from '../services/games';
import { inr } from '../services/format';
import { testimonials } from '../content/testimonials';
import { faq } from '../content/faq';
import { APP_NAME } from '../components/Navbar';

const STEPS = [
  ['Create your account', 'Sign up with your email and mobile number.'],
  ['Build your squad', 'Add every player with their in-game name and player ID.'],
  ['Pay the entry fee', 'Pay securely with UPI, card or net banking.'],
  ['Get match alerts', 'Confirmation, schedule and reminders arrive in your dashboard.'],
];

export default function Home() {
  const upcoming = useFetch(async () => unwrap(await api.get('/tournaments', { params: { limit: 6, sort: 'date' } })), []);
  const done = useFetch(async () => unwrap(await api.get('/tournaments', { params: { limit: 3, status: 'completed' } })), []);
  const items = upcoming.data?.items || [];
  const featured = items.find((t) => t.phase === 'registration_open') || items.find((t) => t.phase === 'upcoming') || items[0];

  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="row align-items-center g-4 g-lg-5">
            <div className="col-12 col-lg-7">
              <h1 className="hero-title mb-3"><span>Compete.</span><span>Conquer.</span><span>Become a Champion.</span></h1>
              <p className="lead text-muted mb-4" style={{ maxWidth: 520 }}>Enter BGMI, Free Fire, Valorant and more. Register your squad, pay your entry fee and get match times on your phone.</p>
              <div className="d-flex flex-column flex-sm-row gap-2">
                <Link to="/register" className="btn btn-bz btn-lg">Register now</Link>
                <Link to="/tournaments" className="btn btn-ghost btn-lg">Explore tournaments</Link>
              </div>
            </div>
            <div className="col-12 col-lg-5">
              <div className="bz-card lobby">
                {upcoming.loading ? <div className="p-4 text-muted">Loading the next lobby…</div> : featured ? (
                  <>
                    <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                      <div><div className="text-muted small">Next lobby · {featured.game}</div><h4 className="mb-0">{featured.name}</h4></div>
                      <PaymentStatus status={featured.phase} kind="phase" />
                    </div>
                    <div className="mb-3"><CountdownTimer large target={featured.phase === 'registration_open' ? featured.registrationEnd : featured.phase === 'upcoming' ? featured.registrationStart : featured.tournamentStart} label="Countdown" /></div>
                    <div className="small text-muted mb-1">{featured.phase === 'registration_open' ? 'until registration closes' : featured.phase === 'upcoming' ? 'until registration opens' : 'until kick-off'}</div>
                    <div className="d-flex justify-content-between my-3"><span>Entry <b>{inr(featured.entryFee)}</b></span><span>Prize pool <b style={{ color: 'var(--bz-green)' }}>{inr(featured.prizePool)}</b></span><span><b>{featured.availableSlots}</b> slots left</span></div>
                    <Link to={`/tournaments/${featured._id}`} className="btn btn-bz w-100">View tournament</Link>
                  </>
                ) : <div className="p-3 text-muted">No tournaments are scheduled right now. Check back soon.</div>}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bz-section" id="upcoming">
        <div className="container">
          <div className="d-flex justify-content-between align-items-end mb-4 flex-wrap gap-2">
            <div><h2 className="bz-section-title">Upcoming tournaments</h2><p className="text-muted mb-0">Fees, prize pools and open slots, updated live.</p></div>
            <Link to="/tournaments" className="btn btn-ghost btn-sm">See all</Link>
          </div>
          {upcoming.loading ? <CardSkeleton /> : upcoming.error ? (
            <EmptyState icon="bi-wifi-off" title="Couldn't load tournaments" action={<button className="btn btn-ghost" onClick={() => upcoming.reload()}>Try again</button>}>{upcoming.error}</EmptyState>
          ) : items.length === 0 ? <EmptyState icon="bi-trophy" title="No tournaments yet">New events are posted here as soon as organisers publish them.</EmptyState> : (
            <div className="row g-3">{items.map((t) => <div className="col-12 col-md-6 col-lg-4" key={t._id}><TournamentCard t={t} /></div>)}</div>
          )}
        </div>
      </section>

      <section className="bz-section" style={{ background: 'var(--bz-char)' }}>
        <div className="container">
          <h2 className="bz-section-title">Popular games</h2>
          <p className="text-muted mb-4">Team sizes from 1 to 6, set per tournament.</p>
          <div className="row g-3">
            {GAMES.filter((g) => g.name !== 'Other').map((g) => (
              <div className="col-6 col-md-4 col-lg" key={g.name}>
                <Link to={`/tournaments?game=${encodeURIComponent(g.name)}`} className="bz-card flush glow d-block h-100">
                  <GameArt game={g.name} style={{ width: '100%', height: 96, display: 'block' }} />
                  <div className="p-3"><div className="fw-semibold text-white">{g.name}</div><small className="text-muted">Teams of {g.sizes.join(', ')}</small></div>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bz-section">
        <div className="container">
          <h2 className="bz-section-title">How to participate</h2>
          <div className="row g-3 mt-2">
            {STEPS.map(([title, text], i) => (
              <div className="col-12 col-sm-6 col-lg-3" key={title}>
                <div className="bz-card h-100"><div className="bz-display" style={{ color: 'var(--bz-blue)', fontSize: '1.7rem' }}>{i + 1}</div><h5 className="mt-2">{title}</h5><p className="text-muted small mb-0">{text}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bz-section" style={{ background: 'var(--bz-char)' }}>
        <div className="container">
          <h2 className="bz-section-title">Recent results</h2>
          <p className="text-muted mb-4">Completed tournaments. Open one to see match results and standings.</p>
          {done.loading ? <CardSkeleton count={3} /> : (done.data?.items || []).length === 0 ? (
            <EmptyState icon="bi-flag" title="No completed tournaments yet">Results will appear here once the first event finishes.</EmptyState>
          ) : <div className="row g-3">{done.data.items.map((t) => <div className="col-12 col-md-6 col-lg-4" key={t._id}><TournamentCard t={t} /></div>)}</div>}
        </div>
      </section>

      <section className="bz-section">
        <div className="container">
          <h2 className="bz-section-title">What players say</h2>
          <div className="row g-3 mt-1">
            {testimonials.map((t, i) => (
              <div className="col-12 col-md-4" key={i}><figure className="bz-card h-100 mb-0"><blockquote className="mb-3">“{t.quote}”</blockquote><figcaption className="text-muted small">{t.name}, {t.role}</figcaption></figure></div>
            ))}
          </div>
        </div>
      </section>

      <section className="bz-section" id="faq" style={{ background: 'var(--bz-char)' }}>
        <div className="container" style={{ maxWidth: 820 }}>
          <h2 className="bz-section-title mb-4">Frequently asked questions</h2>
          <div className="d-grid gap-2">
            {faq.map(([q, a]) => (
              <details key={q} className="bz-card" style={{ padding: '0.9rem 1.1rem' }}>
                <summary className="fw-semibold" style={{ cursor: 'pointer' }}>{q}</summary>
                <p className="text-muted mt-2 mb-0">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bz-section text-center">
        <div className="container"><h2 className="bz-section-title">Your squad is waiting</h2><p className="text-muted">Join {APP_NAME} and lock your slot before it fills.</p><Link to="/register" className="btn btn-bz btn-lg">Create account</Link></div>
      </section>
    </>
  );
}
