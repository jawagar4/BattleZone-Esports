import { useState } from 'react';
import { useForm } from 'react-hook-form';
import api, { assetUrl, unwrap } from '../../services/api';
import PaymentStatus from '../../components/PaymentStatus';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import Loader from '../../components/Loader';
import Modal from '../../components/Modal';
import Field from '../../components/Field';
import { useToast, useConfirm } from '../../context/ToastContext';
import { GAMES } from '../../services/games';
import { fmtDateTime, toLocalInput, inr } from '../../services/format';
import useFetch from '../../hooks/useFetch';
import { PageHead, useAdminList } from './adminKit';

const toForm = (t) => t ? ({
  name: t.name, game: t.game, description: t.description || '', rules: (t.rules || []).join('\n'), gameMode: t.gameMode || '', map: t.map || '',
  sizes: t.allowedTeamSizes.map(String), entryFee: t.entryFee, prizePool: t.prizePool, prizes: (t.prizeDistribution || []).map((p) => `${p.place}: ${p.amount}`).join('\n'),
  maxTeams: t.maxTeams, registrationStart: toLocalInput(t.registrationStart), registrationEnd: toLocalInput(t.registrationEnd), tournamentStart: toLocalInput(t.tournamentStart),
  refundPolicy: t.refundPolicy || '', manualApproval: t.manualApproval, autoGenerateSchedule: t.autoGenerateSchedule, teamsPerMatch: t.teamsPerMatch, matchIntervalMinutes: t.matchIntervalMinutes, status: t.status,
}) : { game: 'BGMI', sizes: ['4'], entryFee: 0, prizePool: 0, maxTeams: 16, teamsPerMatch: 2, matchIntervalMinutes: 45, status: 'draft', manualApproval: false, autoGenerateSchedule: false };

function TournamentForm({ tournament, onClose, onSaved }) {
  const toast = useToast();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ defaultValues: toForm(tournament) });
  const save = async (v) => {
    const body = {
      name: v.name, game: v.game, description: v.description, rules: v.rules.split('\n').map((s) => s.trim()).filter(Boolean), gameMode: v.gameMode, map: v.map,
      allowedTeamSizes: v.sizes.map(Number), entryFee: Number(v.entryFee), prizePool: Number(v.prizePool), maxTeams: Number(v.maxTeams),
      prizeDistribution: (v.prizes || '').split('\n').map((l) => l.split(':')).filter((p) => p.length === 2 && !Number.isNaN(Number(p[1]))).map(([place, amount]) => ({ place: place.trim(), amount: Number(amount) })),
      registrationStart: new Date(v.registrationStart).toISOString(), registrationEnd: new Date(v.registrationEnd).toISOString(), tournamentStart: new Date(v.tournamentStart).toISOString(),
      refundPolicy: v.refundPolicy || undefined, manualApproval: !!v.manualApproval, autoGenerateSchedule: !!v.autoGenerateSchedule, teamsPerMatch: Number(v.teamsPerMatch), matchIntervalMinutes: Number(v.matchIntervalMinutes), status: v.status,
    };
    try {
      tournament ? await api.patch(`/admin/tournaments/${tournament._id}`, body) : await api.post('/admin/tournaments', body);
      toast.success(tournament ? 'Tournament updated' : 'Tournament created'); onSaved();
    } catch (e) { toast.error(e.userMessage); }
  };
  const req = { required: 'Required' };
  return (
    <Modal title={tournament ? 'Edit tournament' : 'New tournament'} size="lg" onClose={onClose}>
      <form onSubmit={handleSubmit(save)} noValidate className="row g-3">
        <Field className="col-12 col-md-8" label="Name" {...register('name', req)} error={errors.name} />
        <Field as="select" className="col-12 col-md-4" label="Game" {...register('game')}>{GAMES.map((g) => <option key={g.name}>{g.name}</option>)}</Field>
        <Field as="textarea" rows={2} className="col-12" label="Description" {...register('description')} />
        <Field className="col-6" label="Game mode" {...register('gameMode')} /><Field className="col-6" label="Map" {...register('map')} />
        <div className="col-12"><div className="form-label">Allowed team sizes (1 to 6)</div><div className="d-flex gap-3 flex-wrap">{[1, 2, 3, 4, 5, 6].map((n) => <div className="form-check" key={n}><input id={`sz${n}`} type="checkbox" value={String(n)} className="form-check-input" {...register('sizes', { validate: (v) => (v && v.length > 0) || 'Choose at least one size' })} /><label htmlFor={`sz${n}`} className="form-check-label">{n}</label></div>)}</div>{errors.sizes && <div className="invalid-feedback">{errors.sizes.message}</div>}</div>
        <Field className="col-4" label="Entry fee (₹)" type="number" min="0" {...register('entryFee', { required: 'Required', min: 0 })} error={errors.entryFee} />
        <Field className="col-4" label="Prize pool (₹)" type="number" min="0" {...register('prizePool', { required: 'Required', min: 0 })} error={errors.prizePool} />
        <Field className="col-4" label="Max teams" type="number" min="2" {...register('maxTeams', { required: 'Required', min: { value: 2, message: 'At least 2' } })} error={errors.maxTeams} />
        <Field className="col-12 col-md-4" label="Registration opens" type="datetime-local" {...register('registrationStart', req)} error={errors.registrationStart} />
        <Field className="col-12 col-md-4" label="Registration closes" type="datetime-local" {...register('registrationEnd', req)} error={errors.registrationEnd} />
        <Field className="col-12 col-md-4" label="Match start" type="datetime-local" {...register('tournamentStart', req)} error={errors.tournamentStart} />
        <div className="col-12 text-muted small">Times are in your device's time zone and stored as exact moments; players see them in India time (Asia/Kolkata).</div>
        <Field as="textarea" rows={4} className="col-12 col-md-6" label="Rules (one per line)" {...register('rules')} />
        <Field as="textarea" rows={4} className="col-12 col-md-6" label="Prize distribution (e.g. 1st: 25000)" {...register('prizes')} />
        <Field as="textarea" rows={2} className="col-12" label="Refund policy" {...register('refundPolicy')} />
        <Field className="col-6 col-md-3" label="Teams per match" type="number" min="2" {...register('teamsPerMatch')} />
        <Field className="col-6 col-md-3" label="Minutes between matches" type="number" min="5" {...register('matchIntervalMinutes')} />
        <Field as="select" className="col-12 col-md-6" label="Status" {...register('status')}><option value="draft">Draft (hidden)</option><option value="published">Published</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></Field>
        <div className="col-12 d-flex gap-4 flex-wrap">
          <div className="form-check"><input id="ma" type="checkbox" className="form-check-input" {...register('manualApproval')} /><label htmlFor="ma" className="form-check-label">Approve entries manually after payment</label></div>
          <div className="form-check"><input id="ag" type="checkbox" className="form-check-input" {...register('autoGenerateSchedule')} /><label htmlFor="ag" className="form-check-label">Generate the match schedule when registration closes</label></div>
        </div>
        <div className="col-12 d-flex justify-content-end gap-2"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-bz" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save tournament'}</button></div>
      </form>
    </Modal>
  );
}

function Registrations({ t, onClose }) {
  const toast = useToast(); const confirm = useConfirm();
  const [page, setPage] = useState(1);
  const { data, loading, reload } = useFetch(async () => { const r = await api.get(`/tournaments/${t._id}/registrations`, { params: { page, limit: 20 } }); return { items: unwrap(r).items, meta: r.data.meta }; }, [t._id, page]);
  const act = async (r, action, label) => {
    const refundable = action !== 'approve';
    if (!(await confirm({ title: `${label} ${r.teamSnapshot?.teamName}?`, message: action === 'approve' ? 'The team will be confirmed.' : 'The slot is freed and the captain is notified. A paid entry is refunded for rejections; for cancellations choose below.', confirmText: label, danger: refundable }))) return;
    let body = {};
    if (action === 'cancel') body = { refund: await confirm({ title: 'Refund the entry fee?', message: 'Refund the payment to the player through Razorpay?', confirmText: 'Refund', cancelText: 'No refund' }) };
    try { await api.post(`/admin/registrations/${r._id}/${action}`, body); toast.success(`${label} done`); reload(true); } catch (e) { toast.fromError(e); }
  };
  return (
    <Modal title={`Registrations · ${t.name}`} size="lg" onClose={onClose}>
      {loading ? <Loader message="Loading registrations…" /> : data.items.length === 0 ? <EmptyState icon="bi-people" title="No registrations yet" /> : (
        <><div className="table-responsive"><table className="table bz-table stack-table"><thead><tr><th>ID</th><th>Team</th><th>Captain</th><th>Payment</th><th>Status</th><th /></tr></thead><tbody>
          {data.items.map((r) => <tr key={r._id}><td data-label="ID">{r.registrationId}</td><td data-label="Team">{r.teamId?.teamName || r.teamSnapshot?.teamName}</td><td data-label="Captain">{r.captainId?.name}<div className="small text-muted">{r.captainId?.phone}</div></td><td data-label="Payment">{r.paymentId ? <PaymentStatus status={r.paymentId.status} /> : '—'}</td><td data-label="Status"><PaymentStatus status={r.status} /></td>
            <td data-label="" className="actions text-end">{r.status === 'pending_approval' && <><button className="btn btn-bz btn-sm me-1" onClick={() => act(r, 'approve', 'Approve')}>Approve</button><button className="btn btn-danger-soft btn-sm" onClick={() => act(r, 'reject', 'Reject')}>Reject</button></>}{['confirmed', 'suspended', 'pending_payment'].includes(r.status) && <button className="btn btn-danger-soft btn-sm" onClick={() => act(r, 'cancel', 'Cancel')}>Cancel</button>}</td></tr>)}
        </tbody></table></div><Pagination meta={data.meta} onPage={setPage} /></>)}
    </Modal>
  );
}

function Matches({ t, onClose }) {
  const toast = useToast(); const confirm = useConfirm();
  const { data, loading, reload } = useFetch(async () => unwrap(await api.get(`/admin/tournaments/${t._id}/matches`)).items, [t._id]);
  const generate = async () => {
    if (!(await confirm({ title: 'Generate schedule?', message: 'Confirmed teams are grouped into round 1 matches. Existing unplayed round 1 matches are replaced.', confirmText: 'Generate' }))) return;
    try { const r = unwrap(await api.post(`/admin/tournaments/${t._id}/matches/generate`)); toast.success(`${r.created} matches created`); reload(true); } catch (e) { toast.fromError(e); }
  };
  const setStatus = async (m, status) => { try { await api.patch(`/admin/tournaments/${t._id}/matches/${m._id}`, { status }); reload(true); } catch (e) { toast.fromError(e); } };
  const setWinner = async (m, winnerTeamId) => { try { await api.patch(`/admin/tournaments/${t._id}/matches/${m._id}`, { status: 'completed', result: { winnerTeamId } }); toast.success('Result saved'); reload(true); } catch (e) { toast.fromError(e); } };
  return (
    <Modal title={`Matches · ${t.name}`} size="lg" onClose={onClose}>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2"><span className="text-muted small">Schedules and results are recorded here; gameplay happens in the game itself.</span><button className="btn btn-bz btn-sm" onClick={generate}>Generate schedule</button></div>
      {loading ? <Loader message="Loading matches…" /> : data.length === 0 ? <EmptyState icon="bi-calendar-event" title="No matches yet">Generate a schedule from confirmed teams.</EmptyState> : (
        <div className="d-grid gap-2">{data.map((m) => <div key={m._id} className="member-block mb-0">
          <div className="d-flex justify-content-between flex-wrap gap-2"><b>{m.label || `Round ${m.round}`}</b><span className="text-muted small">{fmtDateTime(m.scheduledAt, t.timezone)}</span><PaymentStatus status={m.status} /></div>
          <div className="small text-muted my-1">{m.participatingTeams.map((x) => x.teamName).join(', ')}</div>
          <div className="d-flex gap-2 flex-wrap align-items-center">
            {m.status === 'scheduled' && <button className="btn btn-ghost btn-sm" onClick={() => setStatus(m, 'live')}>Mark live</button>}
            {m.status !== 'completed' && m.participatingTeams.length > 0 && <select className="form-select form-select-sm w-auto" aria-label="Declare winner" defaultValue="" onChange={(e) => e.target.value && setWinner(m, e.target.value)}><option value="">Declare winner…</option>{m.participatingTeams.map((x) => <option key={x._id} value={x._id}>{x.teamName}</option>)}</select>}
            {m.status === 'completed' && m.result?.winnerTeamId && <span className="small" style={{ color: 'var(--bz-green)' }}>Winner: {m.participatingTeams.find((x) => x._id === m.result.winnerTeamId)?.teamName}</span>}
          </div></div>)}</div>)}
    </Modal>
  );
}

export default function Tournaments() {
  const toast = useToast(); const confirm = useConfirm();
  const [search, setSearch] = useState(''); const [status, setStatus] = useState('');
  const { data, loading, error, reload, setPage, resetPage } = useAdminList('/admin/tournaments', { search, status });
  const [form, setForm] = useState(null); const [regs, setRegs] = useState(null); const [matches, setMatches] = useState(null);

  const patch = async (t, body, ok) => { try { await api.patch(`/admin/tournaments/${t._id}`, body); toast.success(ok); reload(true); } catch (e) { toast.fromError(e); } };
  const cancel = async (t) => { if (await confirm({ title: `Cancel ${t.name}?`, message: 'Registration closes and players are notified. Refund paid entries from Payments.', confirmText: 'Cancel tournament', danger: true })) patch(t, { status: 'cancelled' }, 'Tournament cancelled'); };
  const del = async (t) => { if (!(await confirm({ title: `Delete ${t.name}?`, message: 'Only tournaments with no active registrations can be deleted.', confirmText: 'Delete', danger: true }))) return; try { await api.delete(`/admin/tournaments/${t._id}`); toast.success('Deleted'); reload(true); } catch (e) { toast.fromError(e); } };
  const banner = async (t, file) => { if (!file) return; const fd = new FormData(); fd.append('image', file); try { await api.post(`/admin/tournaments/${t._id}/banner`, fd); toast.success('Banner updated'); reload(true); } catch (e) { toast.fromError(e); } };
  const reschedule = async (t) => { const v = window.prompt('New match start (YYYY-MM-DD HH:MM, your device time)', toLocalInput(t.tournamentStart).replace('T', ' ')); if (!v) return; const d = new Date(v.replace(' ', 'T')); if (Number.isNaN(d.getTime())) return toast.error('That date is not valid'); patch(t, { tournamentStart: d.toISOString() }, 'Rescheduled. Entrants were notified.'); };

  return (
    <>
      <PageHead title="Tournaments"><button className="btn btn-bz btn-sm" onClick={() => setForm('new')}><i className="bi bi-plus-lg" /> New tournament</button></PageHead>
      <div className="bz-card mb-3"><div className="row g-2">
        <div className="col-12 col-md-7"><input className="form-control" type="search" placeholder="Search tournaments" aria-label="Search" value={search} onChange={(e) => { setSearch(e.target.value); resetPage(); }} /></div>
        <div className="col-12 col-md-5"><select className="form-select" aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }}><option value="">Any lifecycle</option><option value="draft">Draft</option><option value="published">Published</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></div>
      </div></div>
      <div className="bz-card">
        {loading ? <Loader message="Loading tournaments…" /> : error ? <EmptyState icon="bi-wifi-off" title="Couldn't load tournaments">{error}</EmptyState> : data.items.length === 0 ? <EmptyState icon="bi-trophy" title="No tournaments" action={<button className="btn btn-bz" onClick={() => setForm('new')}>Create the first one</button>} /> : (
          <><div className="table-responsive"><table className="table bz-table stack-table"><thead><tr><th>Tournament</th><th>Fee / prize</th><th>Slots</th><th>Starts</th><th>Phase</th><th /></tr></thead><tbody>
            {data.items.map((t) => <tr key={t._id}>
              <td data-label="Tournament"><b>{t.name}</b><div className="small text-muted">{t.game}{t.bannerUrl && <> · <a href={assetUrl(t.bannerUrl)} target="_blank" rel="noreferrer">banner</a></>}</div></td>
              <td data-label="Fee / prize">{inr(t.entryFee)} / {inr(t.prizePool)}</td><td data-label="Slots">{t.reservedSlots}/{t.maxTeams}</td><td data-label="Starts">{fmtDateTime(t.tournamentStart)}</td><td data-label="Phase"><PaymentStatus status={t.phase} kind="phase" /></td>
              <td data-label="" className="actions text-end"><div className="d-flex gap-1 flex-wrap justify-content-md-end">
                <button className="btn btn-ghost btn-sm" onClick={() => setForm(t)}>Edit</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setRegs(t)}>Entries</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setMatches(t)}>Matches</button>
                {t.status === 'draft' && <button className="btn btn-bz btn-sm" onClick={() => patch(t, { status: 'published' }, 'Published')}>Publish</button>}
                {t.status === 'published' && <button className="btn btn-ghost btn-sm" onClick={() => patch(t, { status: 'draft' }, 'Unpublished')}>Unpublish</button>}
                {t.status === 'published' && <button className="btn btn-ghost btn-sm" onClick={() => patch(t, { isPaused: !t.isPaused }, t.isPaused ? 'Registration resumed' : 'Registration paused')}>{t.isPaused ? 'Resume' : 'Pause'}</button>}
                {['draft', 'published'].includes(t.status) && <button className="btn btn-ghost btn-sm" onClick={() => reschedule(t)}>Reschedule</button>}
                {t.status === 'published' && <button className="btn btn-ghost btn-sm" onClick={() => patch(t, { status: 'completed' }, 'Marked completed')}>Complete</button>}
                <label className="btn btn-ghost btn-sm mb-0">Banner<input type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => banner(t, e.target.files[0])} /></label>
                {!['cancelled', 'completed'].includes(t.status) && <button className="btn btn-danger-soft btn-sm" onClick={() => cancel(t)}>Cancel</button>}
                <button className="btn btn-danger-soft btn-sm" onClick={() => del(t)} aria-label={`Delete ${t.name}`}><i className="bi bi-trash" /></button>
              </div></td></tr>)}
          </tbody></table></div><Pagination meta={data.meta} onPage={setPage} /></>)}
      </div>
      {form && <TournamentForm tournament={form === 'new' ? null : form} onClose={() => setForm(null)} onSaved={() => { setForm(null); reload(true); }} />}
      {regs && <Registrations t={regs} onClose={() => setRegs(null)} />}
      {matches && <Matches t={matches} onClose={() => setMatches(null)} />}
    </>
  );
}
