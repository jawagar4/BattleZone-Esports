import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { unwrap } from '../services/api';
import useFetch from '../hooks/useFetch';
import Field from '../components/Field';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';
import MemberFields from '../components/MemberFields';
import { useToast } from '../context/ToastContext';
import { fmtDateTime, inr, inrPaise } from '../services/format';

const blank = () => ({ name: '', inGameName: '', playerId: '', contact: '' });

export default function TeamRegistration() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data, loading, error } = useFetch(async () => {
    const [t, teams] = await Promise.all([api.get(`/tournaments/${id}`), api.get('/teams/my-teams')]);
    return { ...unwrap(t), teams: unwrap(teams).items };
  }, [id]);

  const [mode, setMode] = useState('new');
  const [existingId, setExistingId] = useState('');
  const [logo, setLogo] = useState(null);
  const [captainIdx, setCaptainIdx] = useState(0);
  const [hasSub, setHasSub] = useState(false);
  const [busy, setBusy] = useState(false);
  const { register, control, handleSubmit, watch, setError, formState: { errors } } = useForm({ defaultValues: { teamName: '', teamSize: '', members: [], substitute: blank() } });
  const { fields, replace } = useFieldArray({ control, name: 'members' });
  const size = Number(watch('teamSize')) || 0;

  const t = data?.tournament;
  // Grow or shrink the player forms to match the selected size, keeping what was typed.
  useEffect(() => {
    if (!size) return;
    const cur = control._formValues.members || [];
    replace(Array.from({ length: size }, (_, i) => cur[i] || blank()));
    if (captainIdx >= size) setCaptainIdx(0);
  }, [size]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <Loader message="Preparing registration…" />;
  if (error) return <div className="container bz-page"><EmptyState icon="bi-exclamation-triangle" title="Couldn't load this tournament">{error}</EmptyState></div>;
  if (t.phase !== 'registration_open') return <div className="container bz-page"><EmptyState icon="bi-lock" title="Registration isn't open" action={<Link className="btn btn-ghost" to={`/tournaments/${id}`}>Back to tournament</Link>}>This tournament is currently {t.phase.replace('_', ' ')}.</EmptyState></div>;

  const eligible = data.teams.filter((x) => x.game === t.game && t.allowedTeamSizes.includes(x.members.length) && x.status === 'active');
  const feeText = data.fee.total > 0 ? `${inrPaise(data.fee.total)} to pay` : 'No payment needed';

  const submit = async (v) => {
    setBusy(true);
    try {
      let teamId = existingId;
      if (mode === 'new') {
        const members = v.members.map((m, i) => ({ ...m, isCaptain: i === captainIdx }));
        const body = { teamName: v.teamName, game: t.game, teamSize: size, members };
        if (hasSub && v.substitute.name) body.substitute = v.substitute;
        const team = unwrap(await api.post('/teams', body)).team;
        teamId = team._id;
        if (logo) { const fd = new FormData(); fd.append('image', logo); await api.post(`/teams/${teamId}/logo`, fd).catch(() => toast.info('Team created, but the logo could not be uploaded. Add it from My teams.')); }
      } else if (!teamId) { toast.error('Choose a team to register'); return; }
      const r = unwrap(await api.post(`/tournaments/${id}/register`, { teamId }));
      if (r.requiresPayment) nav(`/checkout/${r.registration._id}`); else { toast.success('You are in! Registration confirmed.'); nav('/dashboard'); }
    } catch (e) {
      (e.fieldErrors || []).forEach((d) => d.field && setError(d.field, { message: d.message }));
      toast.error(e.userMessage);
    } finally { setBusy(false); }
  };

  return (
    <div className="container bz-page " style={{ maxWidth: 860 }}>
      <Link to={`/tournaments/${id}`} className="small "><i className="bi bi-arrow-left " /> {t.name}</Link>
      <h1 className="h2 mt-2">Register your team</h1>
      <p className="text-muted">{t.game} · {inr(t.entryFee)} entry · closes {fmtDateTime(t.registrationEnd, t.timezone)}</p>

      <div className="btn-group w-100 mb-3" role="group" aria-label="Team source">
        <button type="button" className={`btn ${mode === 'new' ? 'btn-bz' : 'btn-ghost'}`} onClick={() => setMode('new')}>New team</button>
        <button type="button" className={`btn ${mode === 'existing' ? 'btn-bz' : 'btn-ghost'}`} onClick={() => setMode('existing')}>Existing team ({eligible.length})</button>
      </div>

      <form onSubmit={handleSubmit(submit)} noValidate>
        {mode === 'existing' ? (
          <div className="bz-card">
            {eligible.length === 0 ? <EmptyState icon="bi-people" title="No eligible teams">You need a {t.game} team with {t.allowedTeamSizes.join(' or ')} players. Create a new one instead.</EmptyState> : (
              <div className="d-grid gap-2">{eligible.map((x) => (
                <label key={x._id} className="member-block d-flex gap-3 align-items-center mb-0" style={{ cursor: 'pointer', borderColor: existingId === x._id ? 'var(--bz-green)' : undefined }}>
                  <input type="radio" name="existing" className="form-check-input mt-0" checked={existingId === x._id} onChange={() => setExistingId(x._id)} />
                  <div><div className="fw-semibold">{x.teamName}</div><small className="text-muted">{x.members.length} players: {x.members.map((m) => m.inGameName).join(', ')}</small></div>
                </label>))}</div>)}
          </div>
        ) : (
          <>
            <div className="bz-card mb-3">
              <div className="row g-3">
                <Field className="col-12 col-md-6" label="Team name" {...register('teamName', { required: 'Enter a team name', minLength: { value: 2, message: 'Too short' }, maxLength: { value: 40, message: 'Max 40 characters' } })} error={errors.teamName} />
                <Field as="select" className="col-12 col-md-6" label="Team size" {...register('teamSize', { required: 'Choose a team size' })} error={errors.teamSize}>
                  <option value="">Select size</option>
                  {t.allowedTeamSizes.slice().sort().map((n) => <option key={n} value={n}>{n} {n === 1 ? 'player' : 'players'}</option>)}
                </Field>
                
              </div>
            </div>
            {size === 0 && <p className="text-muted">Choose a team size to add your players.</p>}
            {fields.map((f, i) => (
              <div key={f.id}>
                <MemberFields register={register} errors={errors} prefix={`members.${i}`} index={i} isCaptain={i === captainIdx} />
                {size > 1 && i !== captainIdx && <button type="button" className="btn btn-ghost btn-sm mb-3" onClick={() => setCaptainIdx(i)}>Make player {i + 1} captain</button>}
              </div>
            ))}
            {size > 0 && (
              <div className="mb-3">
                <div className="form-check mb-2">
                  <input id="sub" type="checkbox" className="form-check-input" checked={hasSub} onChange={(e) => setHasSub(e.target.checked)} />
                  <label htmlFor="sub" className="form-check-label">Add a substitute player</label></div>
                {hasSub && <MemberFields register={register} errors={errors} prefix="substitute" index={0} label="Substitute" optional />}
              </div>
            )}
          </>
        )}
        <div className="sticky-cta">
          <div className="d-flex flex-column flex-sm-row gap-2 align-items-sm-center justify-content-between">
            <span className="text-muted small">{feeText}. Your slot is held for a few minutes while you pay.</span>
            <button className="btn btn-bz" disabled={busy || (mode === 'new' && !size)}>{busy ? 'Saving…' : 'Continue'}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
