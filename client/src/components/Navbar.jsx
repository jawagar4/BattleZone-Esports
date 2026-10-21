import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import useSocketEvent, { resetSocket } from '../hooks/useSocket';
import api, { unwrap } from '../services/api';

export const APP_NAME = import.meta.env.VITE_APP_NAME;
export function Logo() {
  return (<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M12 14h26l14 14v8L38 50H12z" fill="#2f7bff" /><path d="M22 24h14l6 6-6 6H22z" fill="#35f28b" /></svg>);
}

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => { setOpen(false); }, [loc.pathname]);
  useEffect(() => {
    if (!user) { setUnread(0); return; }
    api.get('/users/dashboard').then((r) => setUnread(unwrap(r).unreadNotifications)).catch(() => {});
  }, [user]);
  const onNotification = useCallback((n) => { setUnread((c) => c + 1); toast.info(`${n.title}: ${n.message}`); }, [toast]);
  useSocketEvent('notification', onNotification, { enabled: !!user });

  const signOut = async () => { await logout(); resetSocket(); toast.success('Signed out'); nav('/'); };
  const L = ({ to, children, end }) => <NavLink to={to} end={end} className={({ isActive }) => `bz-link ${isActive ? 'active' : ''}`}>{children}</NavLink>;

  return (
    <header className="bz-nav">
      <a href="#main" className="skip-link">Skip to content</a>
      <div className="container d-flex align-items-center justify-content-between py-2">
        <Link to="/" className="bz-brand"><Logo />{APP_NAME}</Link>
        <button className="btn btn-ghost d-lg-none" aria-expanded={open} aria-controls="main-nav" aria-label="Toggle navigation" onClick={() => setOpen(!open)}>
          <i className={`bi ${open ? 'bi-x-lg' : 'bi-list'}`} />
        </button>
        <nav id="main-nav" className={`${open ? 'd-block' : 'd-none'} d-lg-flex align-items-lg-center gap-lg-1 w-100 w-lg-auto position-absolute position-lg-static start-0 top-100 p-3 p-lg-0`}
          style={open ? { background: 'var(--bz-void)', borderBottom: '1px solid var(--bz-line)' } : undefined}>
          <L to="/" end>Home</L>
          <L to="/tournaments">Tournaments</L>
          {user && <L to="/dashboard">Dashboard</L>}
          {user && <L to="/teams">My teams</L>}
          {user && <L to="/payments">Payments</L>}
          {isAdmin && <L to="/admin">Admin</L>}
          <div className="d-lg-flex gap-2 ms-lg-3 mt-3 mt-lg-0">
            {user ? (
              <>
                <Link to="/profile" className="btn btn-ghost btn-sm mb-2 mb-lg-0 w-100"><i className="bi bi-person-circle" /> {user.name.split(' ')[0]}{unread > 0 && <span className="notif-dot" aria-label={`${unread} unread notifications`}>{unread}</span>}</Link>
                <button className="btn btn-ghost btn-sm w-100" onClick={signOut}>Sign out</button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost btn-sm mb-2 mb-lg-0 w-100">Sign in</Link>
                <Link to="/register" className="btn btn-bz btn-sm w-100">Register</Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
