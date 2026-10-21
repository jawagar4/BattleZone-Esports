import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import api, { assetUrl, unwrap } from '../services/api';
import useFetch from '../hooks/useFetch';
import Modal from '../components/Modal';
import Field from '../components/Field';
import EmptyState from '../components/EmptyState';
import PaymentStatus from '../components/PaymentStatus';
import { CardSkeleton } from '../components/Loader';
import { useToast, useConfirm } from '../context/ToastContext';
import { fmtDateTime } from '../services/format';

function MemberForm({ initial, onSave, onCancel }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ defaultValues: initial || { name: '', inGameName: '', playerId: '', contact: '' } });
  return (
    <form onSubmit={handleSubmit(onSave)} noValidate className="row g-2">
      <Field className="col-12 col-sm-6" label="Full name" {...register('name', { required: 'Required' })} error={errors.name} />
      <Field className="col-12 col-sm-6" label="In-game username" {...register('inGameName', { required: 'Required' })} error={errors.inGameName} />
      <Field className="col-12 col-sm-6" label="Player ID" {...register('playerId', { required: 'Required', pattern: { value: /^[A-Za-z0-9_\-#.]{3,40}$/, message: 'Use 3–40 letters, numbers or _ - # .' } })} error={errors.playerId} />
      <Field className="col-12 col-sm-6" label="Phone or email (optional)" {...register('contact')} />
      <div className="col-12 d-flex gap-2 justify-content-end"><button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button><button className="btn btn-bz" disabled={isSubmitting}>Save player</button></div>
    </form>
  );
}

export default function MyTeams() {
  const toast = useToast(); const confirm = useConfirm();
  const { data, loading, error, reload } = useFetch(async () => unwrap(await api.get('/teams/my-teams')).items, []);
  const [open, setOpen] = useState(null); // team being managed
  const [editing, setEditing] = useState(null); // { member | 'new' }
  const [name, setName] = useState('');

  const act = async (fn, ok) => { try { await fn(); if (ok) toast.success(ok); await reload(true); setOpen((o) => o && null); } catch (e) { toast.fromError(e); } };
  const manage = async (id) => { try { setOpen(unwrap(await api.get(`/teams/${id}`))); setName(''); setEditing(null); } catch (e) { toast.fromError(e); } };
  const refreshOpen = async () => { await reload(true); if (open) setOpen(unwrap(await api.get(`/teams/${open.team._id}`))); };
  const saveMember = async (v) => {
    try {
      if (editing === 'new') await api.post(`/teams/${open.team._id}/members`, v); else await api.patch(`/teams/${open.team._id}/members/${editing._id}`, v);
      toast.success('Player saved'); setEditing(null); await refreshOpen();
    } catch (e) { toast.fromError(e); }
  };
  const removeMember = async (m) => {
    if (!(await confirm({ title: `Remove ${m.inGameName}?`, message: 'The team size must stay within what your tournaments allow.', confirmText: 'Remove', danger: true }))) return;
    try { await api.delete(`/teams/${open.team._id}/members/${m._id}`); toast.success('Player removed'); await refreshOpen(); } catch (e) { toast.fromError(e); }
  };
  const rename = async () => { try { await api.patch(`/teams/${open.team._id}`, { teamName: name }); toast.success('Team renamed'); setName(''); await refreshOpen(); } catch (e) { toast.fromError(e); } };
  const logo = async (file) => { if (!file) return; const fd = new FormData(); fd.append('image', file); try { await api.post(`/teams/${open.team._id}/logo`, fd); toast.success('Logo updated'); await refreshOpen(); } catch (e) { toast.fromError(e); } };
  const del = async (t) => { if (await confirm({ title: `Delete ${t.teamName}?`, message: 'This cannot be undone.', confirmText: 'Delete team', danger: true })) act(() => api.delete(`/teams/${t._id}`), 'Team deleted'); };

  return (
    <div className="container bz-page">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2 mt-5"><h1 className="h2 mb-0">My teams</h1><Link to="/tournaments" className="btn btn-bz">Register for a tournament</Link></div>
      {loading ? <CardSkeleton count={3} /> : error ? <EmptyState icon="bi-wifi-off" title="Couldn't load teams" action={<button className="btn btn-ghost" onClick={() => reload()}>Try again</button>}>{error}</EmptyState> : data.length === 0 ? (
        <EmptyState icon="bi-people" title="No teams yet" action={<Link to="/tournaments" className="btn btn-bz">Find a tournament</Link>}>Teams are created while you register for a tournament.</EmptyState>
      ) : (
        <div className="row g-3">{data.map((t) => (
          <div className="col-12 col-md-6 col-lg-4" key={t._id}>
            <div className="bz-card h-100 d-flex flex-column gap-3">
              <div className="d-flex gap-3 align-items-center">{t.logoUrl ? <img className="team-logo" src={assetUrl(t.logoUrl)} alt="" /> : <div className="team-logo d-grid" style={{ placeItems: 'center' }}><i className="bi bi-shield-shaded" /></div>}<div><h5 className="mb-0">{t.teamName}</h5><small className="text-muted">{t.game} · {t.members.length} players</small></div>{t.status === 'suspended' && <PaymentStatus status="suspended" />}</div>
              <div className="small text-muted">{t.members.map((m) => m.inGameName).join(', ')}</div>
              <div className="small">{t.registrations?.length ? t.registrations.map((r) => <div key={r._id} className="d-flex justify-content-between"><span>{r.tournamentId?.name}</span><PaymentStatus status={r.status} /></div>) : <span className="text-muted">Not entered in any tournament</span>}</div>
              <div className="d-flex gap-2 mt-auto"><button className="btn btn-ghost btn-sm flex-grow-1" onClick={() => manage(t._id)}>Manage</button><button className="btn btn-danger-soft btn-sm" onClick={() => del(t)} aria-label={`Delete ${t.teamName}`}><i className="bi bi-trash" /></button></div>
            </div>
          </div>))}</div>
      )}

      {open && (
        <Modal title={open.team.teamName} size="lg" onClose={() => setOpen(null)}>
          <div className="row g-2 mb-3 align-items-end">
            <div className="col-12 col-md-5"><label className="form-label" htmlFor="rn">Rename team</label><div className="input-group"><input id="rn" className="form-control" value={name} onChange={(e) => setName(e.target.value)} placeholder={open.team.teamName} /><button className="btn btn-ghost" disabled={!name.trim()} onClick={rename}>Save</button></div></div>
            <div className="col-12 col-md-5"><label className="form-label" htmlFor="lg">Team logo</label><input id="lg" type="file" accept="image/jpeg,image/png,image/webp" className="form-control" onChange={(e) => logo(e.target.files[0])} /></div>
          </div>
          <div className="d-flex justify-content-between align-items-center mb-2"><h6 className="mb-0">Players</h6>{!editing && open.team.members.length < 6 && <button className="btn btn-ghost btn-sm" onClick={() => setEditing('new')}><i className="bi bi-plus-lg" /> Add player</button>}</div>
          {editing ? <div className="member-block"><MemberForm initial={editing === 'new' ? null : editing} onSave={saveMember} onCancel={() => setEditing(null)} /></div> : (
            <div className="table-responsive"><table className="table bz-table stack-table"><thead><tr><th>Name</th><th>In-game</th><th>Player ID</th><th /></tr></thead><tbody>
              {open.team.members.map((m) => <tr key={m._id}><td data-label="Name">{m.name} {m.isCaptain && <span className="chip chip-confirmed">Captain</span>}</td><td data-label="In-game">{m.inGameName}</td><td data-label="Player ID">{m.playerId}</td><td data-label="" className="actions text-end"><button className="btn btn-ghost btn-sm me-1" onClick={() => setEditing(m)}>Edit</button>{!m.isCaptain && <button className="btn btn-danger-soft btn-sm" onClick={() => removeMember(m)}>Remove</button>}</td></tr>)}
            </tbody></table></div>)}
          <h6 className="mt-3">Registrations</h6>
          {open.registrations.length === 0 ? <p className="text-muted small mb-0">None yet. Edits lock for each tournament once its registration closes.</p> : open.registrations.map((r) => <div key={r._id} className="d-flex justify-content-between flex-wrap gap-2 py-2 border-top small" style={{ borderColor: 'var(--bz-line)' }}><span><b>{r.tournamentId?.name}</b> · {r.registrationId} · starts {fmtDateTime(r.tournamentId?.tournamentStart)}</span><PaymentStatus status={r.status} /></div>)}
        </Modal>
      )}
    </div>
  );
}
