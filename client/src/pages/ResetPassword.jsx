import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import Field from '../components/Field';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm();
  const toast = useToast();
  const nav = useNavigate();
  const onSubmit = async (v) => {
    try { await api.post('/auth/reset-password', { token, password: v.password }); toast.success('Password updated. Sign in with the new one.'); nav('/login'); }
    catch (e) { toast.fromError(e); }
  };
  if (!token) return <AuthShell title="Link missing" subtitle="Open the reset link from your email, or request a new one."><Link to="/forgot-password" className="btn btn-bz w-100">Request a new link</Link></AuthShell>;
  return (
    <AuthShell title="Choose a new password">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="d-grid gap-3">
        <Field label="New password" type="password" autoComplete="new-password" {...register('password', { required: 'Enter a new password', minLength: { value: 8, message: 'Use at least 8 characters' }, validate: (p) => (/[A-Za-z]/.test(p) && /\d/.test(p)) || 'Include a letter and a number' })} error={errors.password} />
        <Field label="Confirm password" type="password" autoComplete="new-password" {...register('confirm', { validate: (v) => v === watch('password') || 'Passwords do not match' })} error={errors.confirm} />
        <button className="btn btn-bz" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Update password'}</button>
      </form>
    </AuthShell>
  );
}
