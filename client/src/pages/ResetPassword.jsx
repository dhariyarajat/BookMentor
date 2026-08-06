import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import client, { errMsg } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import FloatingInput from '../components/FloatingInput.jsx';

export default function ResetPassword() {
  const { token } = useParams();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.password) e.password = 'Password is required.';
    else if (form.password.length < 6) e.password = 'Password must be at least 6 characters.';
    if (form.confirm !== form.password) e.confirm = 'Passwords do not match.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await client.post(`/auth/reset-password/${token}`, {
        password: form.password,
        confirmPassword: form.confirm,
      });
      toast('Password reset successful! Log in with your new password.');
      navigate('/login');
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4 py-14">
      <div className="pointer-events-none absolute -left-32 top-10 h-72 w-72 rounded-full bg-blue-100/60 blur-3xl dark:bg-blue-500/10" />
      <div className="pointer-events-none absolute -right-32 bottom-10 h-72 w-72 rounded-full bg-indigo-100/60 blur-3xl dark:bg-indigo-500/10" />

      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-indigo-900/10 dark:border-slate-800 dark:bg-slate-900">
        {/* Gradient header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-800 px-8 py-8 text-center text-white">
          <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <LockKeyhole className="h-6 w-6 text-white" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Set a new password</h1>
          <p className="mx-auto mt-1.5 max-w-xs text-sm text-indigo-100">
            Choose a strong password you haven’t used before. Minimum 6 characters.
          </p>
        </div>

        <div className="p-7 sm:p-8">
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <FloatingInput
              id="password"
              label="New password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              minLength={6}
              autoComplete="new-password"
              error={errors.password}
            />
            <FloatingInput
              id="confirm"
              label="Confirm new password"
              type="password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              autoComplete="new-password"
              error={errors.confirm}
            />
            <button type="submit" disabled={loading} className="btn-primary w-full !py-3">
              {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              {loading ? 'Resetting…' : 'Reset password'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            <Link to="/login" className="font-semibold text-indigo-600 transition hover:text-indigo-700 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300">
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
