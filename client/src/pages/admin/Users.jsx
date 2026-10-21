import { useState } from 'react';
import api from '../../services/api';
import PaymentStatus from '../../components/PaymentStatus';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import Loader from '../../components/Loader';
import { useToast, useConfirm } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { fmtDate } from '../../services/format';
import { PageHead, useAdminList } from './adminKit';

export default function Users() {
  const toast = useToast(); const confirm = useConfirm(); const { user: me } = useAuth();
  const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [role, setRole] = useState('');
  const { data, loading, error, reload, setPage, resetPage } = useAdminList('/admin/users', { search, status, role });
  const patch = async (u, body, title, message) => {
    if (!(await confirm({ title, message, confirmText: 'Confirm', danger: true }))) return;
    try { await api.patch(`/admin/users/${u._id}`, body); toast.success('User updated'); reload(true); } catch (e) { toast.fromError(e); }
  };
  return (
    <>
      <PageHead title="Users" />
      <div className="bz-card mb-3"><div className="row g-2">
        <div className="col-12 col-md-5"><input className="form-control" type="search" placeholder="Search name, email or phone" aria-label="Search users" value={search} onChange={(e) => { setSearch(e.target.value); resetPage(); }} /></div>
        <div className="col-6 col-md-3"><select className="form-select" aria-label="Account status" value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }}><option value="">Any status</option><option value="active">Active</option><option value="suspended">Suspended</option></select></div>
        <div className="col-6 col-md-3"><select className="form-select" aria-label="Role" value={role} onChange={(e) => { setRole(e.target.value); resetPage(); }}><option value="">Any role</option><option value="player">Players</option><option value="admin">Admins</option></select></div>
      </div></div>
      <div className="bz-card">
        {loading ? <Loader message="Loading users…" /> : error ? <EmptyState icon="bi-wifi-off" title="Couldn't load users">{error}</EmptyState> : data.items.length === 0 ? <EmptyState icon="bi-people" title="No users match" /> : (
          <><div className="table-responsive"><table className="table bz-table stack-table"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th><th>Joined</th><th /></tr></thead><tbody>
            {data.items.map((u) => <tr key={u._id}><td data-label="Name">{u.name}</td><td data-label="Email" className="text-break">{u.email}</td><td data-label="Phone">{u.phone}</td><td data-label="Role">{u.role}</td><td data-label="Status"><PaymentStatus status={u.accountStatus} /></td><td data-label="Joined">{fmtDate(u.createdAt)}</td>
              <td data-label="" className="actions text-end">{u._id !== me._id && <>
                {u.accountStatus === 'active' ? <button className="btn btn-danger-soft btn-sm me-1" onClick={() => patch(u, { accountStatus: 'suspended' }, `Suspend ${u.name}?`, 'They will be signed out and unable to sign in.')}>Suspend</button> : <button className="btn btn-ghost btn-sm me-1" onClick={() => patch(u, { accountStatus: 'active' }, `Reactivate ${u.name}?`, 'They will be able to sign in again.')}>Reactivate</button>}
                <button className="btn btn-ghost btn-sm" onClick={() => patch(u, { role: u.role === 'admin' ? 'player' : 'admin' }, u.role === 'admin' ? `Remove admin from ${u.name}?` : `Make ${u.name} an admin?`, 'This changes what they can access and signs them out everywhere.')}>{u.role === 'admin' ? 'Make player' : 'Make admin'}</button></>}</td></tr>)}
          </tbody></table></div><Pagination meta={data.meta} onPage={setPage} /></>)}
      </div>
    </>
  );
}
