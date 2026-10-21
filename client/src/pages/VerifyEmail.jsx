import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { refresh } = useAuth();
  const [state, setState] = useState(token ? 'working' : 'missing');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!token) return;
    api.post('/auth/verify-email', { token }).then(() => { setState('ok'); refresh(); }).catch((e) => { setState('error'); setMsg(e.userMessage); });
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <AuthShell title="Email verification">
      {state === 'working' && <p className="text-muted mb-0" role="status">Verifying your email…</p>}
      {state === 'ok' && <><div className="alert alert-success" role="status">Your email is verified.</div><Link to="/dashboard" className="btn btn-bz w-100">Continue</Link></>}
      {state === 'error' && <><div className="alert alert-danger" role="alert">{msg}</div><Link to="/profile" className="btn btn-ghost w-100">Request a new link from your profile</Link></>}
      {state === 'missing' && <p className="text-muted mb-0">Open the verification link from your email.</p>}
    </AuthShell>
  );
}
