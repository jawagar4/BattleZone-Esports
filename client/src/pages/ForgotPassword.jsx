import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import Field from '../components/Field';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

export default function ForgotPassword() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();
  const [sent, setSent] = useState(false);
  const toast = useToast();
  const onSubmit = async (v) => { try { await api.post('/auth/forgot-password', v); setSent(true); } catch (e) { toast.fromError(e); } };
  return (
    <AuthShell title="Reset your password" subtitle="Enter your email and we'll send a reset link." footer={<Link to="/login">Back to sign in</Link>}>
      {sent ? <div className="alert alert-success mb-0" role="status">If that email has an account, a reset link is on its way. It expires in 30 minutes.</div> : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="d-grid gap-3">
          <Field label="Email" type="email" autoComplete="email" {...register('email', { required: 'Enter your email' })} error={errors.email} />
          <button className="btn btn-bz" disabled={isSubmitting}>{isSubmitting ? 'Sending…' : 'Send reset link'}</button>
        </form>
      )}
    </AuthShell>
  );
}
