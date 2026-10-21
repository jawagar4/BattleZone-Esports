import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import api, { unwrap } from '../../services/api';
import useFetch from '../../hooks/useFetch';
import PaymentStatus from '../../components/PaymentStatus';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import Loader from '../../components/Loader';
import Modal from '../../components/Modal';
import Field from '../../components/Field';
import MemberFields from '../../components/MemberFields';
import { useToast, useConfirm } from '../../context/ToastContext';
import { GAMES } from '../../services/games';
import { PageHead, useAdminList, downloadCsv } from './adminKit';

function TeamEditor({ team, onClose, onSaved }) {
  const toast = useToast();
  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm({ defaultValues: { teamName: team.teamName, members: team.members.map(({ name, inGameName, playerId, contact }) => ({ name, inGameName, playerId, contact: contact || '' })) } });
  const { fields, append, remove } = useFieldArray({ control, name: 'members' });
  const save = async (v) => {
    try {
      const idx = team.members.findIndex((m) => m.isCaptain);
      await api.patch(`/admin/teams/${team._id}`, { teamName: v.teamName, members: v.members.map((m, i) => ({ ...m, isCaptain: i === Math.max(0, idx) })) });
      toast.success('Team updated and logged'); onSaved();
    } catch (e) { toast.fromError(e); }
  };
  return (
    <Modal title={`Edit ${team.teamName}`} size="lg" onClose={onClose}>
      <form onSubmit={handleSubmit(save)} noValidate>
        <Field label="Team name" className="mb-3" {...register('teamName', { required: 'Required' })} error={errors.teamName} />
        {fields.map((f, i) => <div key={f.id}><MemberFields register={register} errors={errors} prefix={`members.${i}`} index={i} isCaptain={team.members[i]?.isCaptain} />{fields.length > 1 && !team.members[i]?.isCaptain && <button type="button" className="btn btn-danger-soft btn-sm mb-3" onClick={() => remove(i)}>Remove player {i + 1}</button>}</div>)}
        {fields.length < 6 && <button type="button" className="btn btn-ghost btn-sm mb-3" onClick={() => append({ name: '', inGameName: '', playerId: '', contact: '' })}><i className="bi bi-plus-lg" /> Add player</button>}
        <p className="text-muted small">Admin edits bypass the registration-deadline lock but must still fit each tournament's allowed team sizes. Every change is written to the audit log.</p>
        <div className="d-flex justify-content-end gap-2"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-bz" disabled={isSubmitting}>Save changes</button></div>
      </form>
    </Modal>
  );
}

export default function Teams() {
  const toast = useToast(); const confirm = useConfirm();
  const [f, setF] = useState({ search: '', game: '', tournamentId: '' });
  const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v));
  const { data, loading, error, reload, setPage, resetPage } = useAdminList('/admin/teams', params);
  const tournaments = useFetch(async () => unwrap(await api.get('/admin/tournaments', { params: { limit: 100 } })).items, []);
  const [view, setView] = useState(null); const [edit, setEdit] = useState(null);
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); resetPage(); };

  const open = async (id, mode) => { try { const d = unwrap(await api.get(`/admin/teams/${id}`)); mode === 'edit' ? setEdit(d.team) : setView(d); } catch (e) { toast.fromError(e); } };
  const toggle = async (t) => {
    const s = t.status === 'active' ? 'suspended' : 'active';
    if (!(await confirm({ title: s === 'suspended' ? `Suspend ${t.teamName}?` : `Reinstate ${t.teamName}?`, message: s === 'suspended' ? 'Their confirmed entries are suspended and the captain is notified.' : 'Their entries return to confirmed.', confirmText: s === 'suspended' ? 'Suspend' : 'Reinstate', danger: s === 'suspended' }))) return;
    try { await api.patch(`/admin/teams/${t._id}`, { status: s }); toast.success('Team updated'); reload(true); } catch (e) { toast.fromError(e); }
  };
  return (
    <>
      <PageHead title="Teams"><button className="btn btn-ghost btn-sm" onClick={() => downloadCsv('/admin/teams/export', params, 'teams.csv', toast)}><i className="bi bi-download" /> Export CSV</button></PageHead>
      <div className="bz-card mb-3"><div className="row g-2">
        <div className="col-12 col-md-4"><input className="form-control" type="search" placeholder="Team name or captain" aria-label="Search teams" value={f.search} onChange={set('search')} /></div>
        <div className="col-6 col-md-3"><select className="form-select" aria-label="Game" value={f.game} onChange={set('game')}><option value="">All games</option>{GAMES.map((g) => <option key={g.name}>{g.name}</option>)}</select></div>
        <div className="col-6 col-md-5"><select className="form-select" aria-label="Tournament" value={f.tournamentId} onChange={set('tournamentId')}><option value="">All tournaments</option>{(tournaments.data || []).map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}</select></div>
      </div></div>
      <div className="bz-card">
        {loading ? <Loader message="Loading teams…" /> : error ? <EmptyState icon="bi-wifi-off" title="Couldn't load teams">{error}</EmptyState> : data.items.length === 0 ? <EmptyState icon="bi-people" title="No teams match" /> : (
          <><div className="table-responsive"><table className="table bz-table stack-table"><thead><tr><th>Team</th><th>Game</th><th>Captain</th><th>Players</th><th>Status</th><th /></tr></thead><tbody>
            {data.items.map((t) => <tr key={t._id}><td data-label="Team">{t.teamName}</td><td data-label="Game">{t.game}</td><td data-label="Captain">{t.captainId?.name}<div className="small text-muted">{t.captainId?.email}</div></td><td data-label="Players">{t.members.length}</td><td data-label="Status"><PaymentStatus status={t.status} /></td>
              <td data-label="" className="actions text-end"><button className="btn btn-ghost btn-sm me-1" onClick={() => open(t._id, 'view')}>View</button><button className="btn btn-ghost btn-sm me-1" onClick={() => open(t._id, 'edit')}>Edit</button><button className={`btn btn-sm ${t.status === 'active' ? 'btn-danger-soft' : 'btn-ghost'}`} onClick={() => toggle(t)}>{t.status === 'active' ? 'Suspend' : 'Reinstate'}</button></td></tr>)}
          </tbody></table></div><Pagination meta={data.meta} onPage={setPage} /></>)}
      </div>
      {view && <Modal title={view.team.teamName} size="lg" onClose={() => setView(null)}>
        <p className="text-muted small">{view.team.game} · Captain {view.team.captainId?.name} ({view.team.captainId?.phone})</p>
        <div className="table-responsive"><table className="table bz-table stack-table"><thead><tr><th>Name</th><th>In-game</th><th>Player ID</th><th>Contact</th></tr></thead><tbody>{[...view.team.members, ...(view.team.substitute ? [{ ...view.team.substitute, _id: 'sub', name: `${view.team.substitute.name} (sub)` }] : [])].map((m) => <tr key={m._id}><td data-label="Name">{m.name}</td><td data-label="In-game">{m.inGameName}</td><td data-label="Player ID">{m.playerId}</td><td data-label="Contact">{m.contact || '—'}</td></tr>)}</tbody></table></div>
        <h6 className="mt-3">Registrations</h6>{view.registrations.length === 0 ? <p className="text-muted small mb-0">None.</p> : view.registrations.map((r) => <div key={r._id} className="d-flex justify-content-between py-1 small"><span>{r.tournamentId?.name} · {r.registrationId}</span><PaymentStatus status={r.status} /></div>)}
      </Modal>}
      {edit && <TeamEditor team={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(true); }} />}
    </>
  );
}
