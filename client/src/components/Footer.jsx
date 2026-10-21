import { Link } from 'react-router-dom';
import { APP_NAME, Logo } from './Navbar';

export default function Footer() {
  const email = import.meta.env.VITE_SUPPORT_EMAIL ;
  const phone = import.meta.env.VITE_SUPPORT_PHONE ;
  return (
    <footer style={{ borderTop: '1px solid var(--bz-line)', background: 'var(--bz-char)' }} className="mt-5 ">
      <div className="container py-5">
        <div className="row g-4">
          <div className="col-12 col-md-5">
            <div className="bz-brand mb-2"><Logo />{APP_NAME}</div>
            <p className="text-muted small mb-0" style={{ maxWidth: 380 }}>Register your squad, pay your entry fee and get match times on your phone. Organisers run the lobbies; we run the paperwork.</p>
          </div>
          <div className="col-6 col-md-3">
            <h6>Play</h6>
            <ul className="list-unstyled small d-grid gap-2 mb-0">
              <li><Link to="/tournaments">Tournaments</Link></li><li><Link to="/register">Create an account</Link></li><li><Link to="/#faq">FAQ</Link></li>
            </ul>
          </div>
          <div className="col-6 col-md-4">
            <h6>Contact</h6>
            <ul className="list-unstyled small d-grid gap-2 mb-3">
  <li className="d-flex align-items-center gap-2">
    <i className="bi bi-envelope flex-shrink-0" />
    <a href={`mailto:${email}`} className="text-break">{email}</a>
  </li>

  {phone && (
    <li className="d-flex align-items-center gap-2">
      <i className="bi bi-telephone flex-shrink-0" />
      <span>{phone}</span>
    </li>
  )}
</ul>
            <div className="d-flex gap-3 fs-5">
              
              <a href="https://youtube.com" aria-label="YouTube" target="_blank" rel="noreferrer"><i className="bi bi-youtube" /></a>
              <a href="https://instagram.com/battlezone_offl?xtok=MXZjd2J1em5hbWJoMw%3D%3D" aria-label="Instagram" target="_blank" rel="noreferrer"><i className="bi bi-instagram" /></a>
              <a href="https://t.me/BattleZone_no1" aria-label="X" target="_blank" rel="noreferrer"><i className="bi bi-telegram" /></a>
              <a href="https://whatsapp.com/channel/0029VbDFx8s89ineFPFwVg3x" aria-label="X" target="_blank" rel="noreferrer"><i className="bi bi-whatsapp" /></a>
            </div>
          </div>
        </div>
        <hr style={{ borderColor: 'var(--bz-line)' }} />
        <div className="d-flex flex-column flex-md-row justify-content-between gap-2 small text-muted">
          <span>© {new Date().getFullYear()} {APP_NAME}</span>
          <span className="d-flex gap-3"><Link to="/privacy">Privacy policy</Link><Link to="/terms">Terms and conditions</Link></span>
        </div>
      </div>
    </footer>
  );
}
