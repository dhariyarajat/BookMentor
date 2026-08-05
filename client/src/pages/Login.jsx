import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import GoogleButton from '../components/GoogleButton.jsx';
import FloatingInput from '../components/FloatingInput.jsx';
import { errMsg } from '../api/client.js';

export default function Login() {
  const { login, googleLoginWithToken } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const goHome = (u) => navigate(u.role === 'mentor' ? '/mentor' : u.role === 'admin' ? '/admin' : '/mentors');

  const validate = () => {
    const e = {};
    if (!form.email.trim()) e.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Enter a valid email address.';
    if (!form.password) e.password = 'Password is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const u = await login(form.email.trim(), form.password);
      toast(`Welcome back, ${u.name.split(' ')[0]}! 🎉`);
      goHome(u);
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async (idToken) => {
    try {
      const u = await googleLoginWithToken(idToken);
      toast(`Signed in as ${u.name.split(' ')[0]}! 🎉`);
      goHome(u);
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4 py-14">
      <div className="pointer-events-none absolute -left-32 top-10 h-72 w-72 rounded-full bg-blue-100/60 blur-3xl dark:bg-blue-500/10" />
      <div className="pointer-events-none absolute -right-32 bottom-10 h-72 w-72 rounded-full bg-indigo-100/60 blur-3xl dark:bg-indigo-500/10" />

      <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-indigo-900/10 dark:border-slate-800 dark:bg-slate-900 lg:grid lg:grid-cols-2">
        {/* Brand panel */}
        <div className="relative hidden overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-800 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-indigo-400/20 blur-2xl" />
          <div className="relative">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-xl backdrop-blur">🎓</div>
            <h2 className="mt-6 text-2xl font-extrabold leading-snug">Welcome back to MentorBook</h2>
            <p className="mt-2 text-sm leading-relaxed text-indigo-100">
              Jump back into your sessions, check your upcoming meetings and keep growing with the best mentors.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-indigo-100">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-cyan-300">✓</span> Live slot booking, zero double-booking
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-cyan-300">✓</span> Auto-generated Google Meet links
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-cyan-300">✓</span> Smart reminders & rescheduling
              </li>
            </ul>
          </div>
          <p className="relative text-xs italic text-indigo-200">“The fastest way I've ever booked a 1-on-1 session.”</p>
        </div>

        {/* Form panel */}
        <div className="p-7 sm:p-10">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Log in</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Continue your mentorship journey.</p>

          <div className="mt-7">
            <GoogleButton onSuccess={handleGoogle} text="continue_with" />
          </div>

          <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" /> or <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <FloatingInput
              id="email"
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="email"
              error={errors.email}
            />
            <div>
              <FloatingInput
                id="password"
                label="Password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="current-password"
                error={errors.password}
              />
              <div className="mt-1.5 text-right">
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-indigo-600 transition hover:text-indigo-700 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  Forgot password?
                </Link>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full !py-3">
              {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              {loading ? 'Logging in…' : 'Log in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            New to MentorBook?{' '}
            <Link to="/register" className="font-semibold text-indigo-600 transition hover:text-indigo-700 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
