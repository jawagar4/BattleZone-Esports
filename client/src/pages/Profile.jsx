import { useForm } from 'react-hook-form';
import api, { unwrap } from '../services/api';
import Field from '../components/Field';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty } } = useForm({ defaultValues: { name: user.name, phone: user.phone } });
  const save = async (v) => { try { setUser(unwrap(await api.patch('/users/profile', v)).user); toast.success('Profile updated'); } catch (e) { toast.fromError(e); } };
  const resend = async () => { try { await api.post('/auth/resend-verification'); toast.success('Verification email sent'); } catch (e) { toast.fromError(e); } };
  return (
    <div className="container bz-page" style={{ maxWidth: 560 }}>
      <h1 className="h2 mb-3">Your profile</h1>
      <form className="bz-card d-grid gap-3" onSubmit={handleSubmit(save)} noValidate>
        <Field label="Full name" {...register('name', { required: 'Enter your name', minLength: { value: 2, message: 'Too short' } })} error={errors.name} />
        <Field label="Mobile number" type="tel" inputMode="numeric" {...register('phone', { required: 'Enter your number', pattern: { value: /^[6-9]\d{9}$/, message: 'Enter a valid 10-digit mobile number' } })} error={errors.phone} />
        <div><label className="form-label">Email</label><input className="form-control" value={user.email} disabled readOnly />
          <div className="small mt-1">{user.emailVerified ? <span style={{ color: 'var(--bz-green)' }}><i className="bi bi-check-circle" /> Verified</span> : <span className="text-muted">Not verified. <button type="button" className="btn btn-link p-0 align-baseline" onClick={resend}>Send verification email</button></span>}</div></div>
        <button className="btn btn-bz" disabled={isSubmitting || !isDirty}>{isSubmitting ? 'Saving…' : 'Save changes'}</button>
      </form>
    </div>
  );
}
