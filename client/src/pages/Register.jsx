import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import Field from '../components/Field';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Register() {
  const { register, handleSubmit, watch, setError, formState: { errors, isSubmitting } } = useForm();
  const { register: signUp } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [done, setDone] = useState(null);

  const onSubmit = async (v) => {
    try {
      const res = await signUp({ ...v, acceptTerms: !!v.acceptTerms });
      toast.success('Account created');
      if (res.emailVerificationRequired) setDone('verify'); else nav('/dashboard', { replace: true });
    } catch (e) {
      (e.fieldErrors || []).forEach((d) => d.field && setError(d.field, { message: d.message }));
      toast.error(e.userMessage);
    }
  };
  if (done === 'verify') return <AuthShell title="Check your email" subtitle="We sent you a verification link. Open it, then sign in."><Link to="/login" className="btn btn-bz w-100">Go to sign in</Link></AuthShell>;
  return (
    <AuthShell title="Create your account" subtitle="One account for every tournament." footer={<>Already registered? <Link to="/login">Sign in</Link></>}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="d-grid gap-3">
        <Field label="Full name" autoComplete="name" {...register('name', { required: 'Enter your name', minLength: { value: 2, message: 'Name is too short' } })} error={errors.name} />
        <Field label="Email" type="email" autoComplete="email" inputMode="email" {...register('email', { required: 'Enter your email', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email' } })} error={errors.email} />
        <Field label="Mobile number" type="tel" autoComplete="tel-national" inputMode="numeric" hint="10-digit Indian mobile number" {...register('phone', { required: 'Enter your mobile number', pattern: { value: /^[6-9]\d{9}$/, message: 'Enter a valid 10-digit mobile number' } })} error={errors.phone} />
        <Field label="Password" type="password" autoComplete="new-password" hint="At least 8 characters with a letter and a number" {...register('password', { required: 'Create a password', minLength: { value: 8, message: 'Use at least 8 characters' }, validate: (p) => (/[A-Za-z]/.test(p) && /\d/.test(p)) || 'Include a letter and a number' })} error={errors.password} />
        <Field label="Confirm password" type="password" autoComplete="new-password" {...register('confirmPassword', { required: 'Confirm your password', validate: (v) => v === watch('password') || 'Passwords do not match' })} error={errors.confirmPassword} />
        <div>
          <div className="form-check">
            <input id="terms" type="checkbox" className={`form-check-input ${errors.acceptTerms ? 'is-invalid' : ''}`} {...register('acceptTerms', { required: 'Accept the terms to continue' })} />
            <label htmlFor="terms" className="form-check-label small">I agree to the <Link to="/terms" target="_blank">terms and conditions</Link> and <Link to="/privacy" target="_blank">privacy policy</Link></label>
          </div>
          {errors.acceptTerms && <div className="invalid-feedback">{errors.acceptTerms.message}</div>}
        </div>
        <button className="btn btn-bz" disabled={isSubmitting}>{isSubmitting ? 'Creating account…' : 'Create account'}</button>
      </form>
    </AuthShell>
  );
}
