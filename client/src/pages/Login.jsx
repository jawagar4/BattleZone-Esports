import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import Field from '../components/Field';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Login() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const [formError, setFormError] = useState('');
  const [unverified, setUnverified] = useState(false);

  const onSubmit = async (v) => {
    setFormError(''); setUnverified(false);
    try {
      const user = await login(v.email, v.password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
      nav(loc.state?.from || (user.role === 'admin' ? '/admin' : '/dashboard'), { replace: true });
    } catch (e) { setFormError(e.userMessage); setUnverified(e.apiCode === 'EMAIL_NOT_VERIFIED'); }
  };
  return (
    <AuthShell title="Sign in" subtitle="Pick up where you left off." footer={<>New here? <Link to="/register">Create an account</Link></>}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="d-grid gap-3">
        {formError && <div className="alert alert-danger py-2 mb-0" role="alert">{formError}{unverified && ' Check your inbox for the verification link.'}</div>}
        <Field label="Email" type="email" autoComplete="email" inputMode="email" {...register('email', { required: 'Enter your email', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email' } })} error={errors.email} />
        <Field label="Password" type="password" autoComplete="current-password" {...register('password', { required: 'Enter your password' })} error={errors.password} />
        <div className="text-end small"><Link to="/forgot-password">Forgot password?</Link></div>
        <button className="btn btn-bz" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </AuthShell>
  );
}
