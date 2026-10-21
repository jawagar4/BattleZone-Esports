import { NavLink, Outlet } from 'react-router-dom';

const links = [['/admin', 'bi-speedometer2', 'Overview', true], ['/admin/tournaments', 'bi-trophy', 'Tournaments'], ['/admin/teams', 'bi-people', 'Teams'], ['/admin/payments', 'bi-credit-card', 'Payments'], ['/admin/users', 'bi-person-gear', 'Users'], ['/admin/audit', 'bi-journal-text', 'Audit log']];
export default function AdminLayout() {
  return (
    <div className="container bz-page">
      <div className="admin-shell">
        <nav className="sidebar bz-card d-flex flex-md-column gap-1 mb-3 mb-md-0" aria-label="Admin sections">
          {links.map(([to, icon, label, end]) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}><i className={`bi ${icon}`} />{label}</NavLink>)}
        </nav>
        <div className="admin-main"><Outlet /></div>
      </div>
    </div>
  );
}
