import { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, MailCheck } from 'lucide-react';
import client, { errMsg } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import FloatingInput from '../components/FloatingInput.jsx';

export default function ForgotPassword() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return setError('Email is required.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return setError('Enter a valid email address.');
    setError('');
    setLoading(true);
    try {
      await client.post('/auth/forgot-password', { email: trimmed });
      setSent(true);
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
            <KeyRound className="h-6 w-6 text-white" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
            {sent ? 'Check your inbox' : 'Forgot password?'}
          </h1>
          <p className="mx-auto mt-1.5 max-w-xs text-sm text-indigo-100">
            {sent
              ? 'If an account exists for that email, the reset link is on its way.'
              : 'Enter your registered email and we’ll send you a reset link.'}
          </p>
        </div>

        <div className="p-7 sm:p-8">
          {sent ? (
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10">
                <MailCheck className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="mt-4 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                We sent a reset link to <strong className="text-slate-700 dark:text-slate-200">{email.trim()}</strong>.
                The link expires in <strong className="text-slate-700 dark:text-slate-200">15 minutes</strong> and can be used only once.
              </p>
              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                Didn’t get it? Check your spam folder or try again.
              </p>
              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  className="btn-primary w-full"
                  onClick={() => setSent(false)}
                >
                  Resend link
                </button>
                <Link to="/login" className="btn-secondary w-full">Back to login</Link>
              </div>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <FloatingInput
                  id="email"
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  error={error}
                />
                <button type="submit" disabled={loading} className="btn-primary w-full !py-3">
                  {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                  {loading ? 'Sending link…' : 'Send reset link'}
                </button>
              </form>
              <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
                Remembered it?{' '}
                <Link to="/login" className="font-semibold text-indigo-600 transition hover:text-indigo-700 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300">
                  Log in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
