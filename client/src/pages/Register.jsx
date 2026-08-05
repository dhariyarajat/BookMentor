import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import GoogleButton from '../components/GoogleButton.jsx';
import FloatingInput from '../components/FloatingInput.jsx';
import { errMsg } from '../api/client.js';

const ROLES = [
  { value: 'student', icon: '🎯', title: 'I\u2019m a Student', desc: 'I want to learn from mentors' },
  { value: 'mentor', icon: '🎓', title: 'I\u2019m a Mentor', desc: 'I want to share my expertise' },
];

export default function Register() {
  const { register, googleLoginWithToken } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [role, setRole] = useState('student');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const goHome = (u) => navigate(u.role === 'mentor' ? '/mentor' : u.role === 'admin' ? '/admin' : '/mentors');

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required.';
    if (!form.email.trim()) e.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Enter a valid email address.';
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
      const u = await register({ name: form.name.trim(), email: form.email.trim(), password: form.password, role });
      toast(`Welcome to MentorBook, ${u.name.split(' ')[0]}! 🎉`);
      goHome(u);
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async (idToken) => {
    try {
      const u = await googleLoginWithToken(idToken, role);
      toast(`Signed up with Google as ${u.name.split(' ')[0]}! 🎉`);
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
            <h2 className="mt-6 text-2xl font-extrabold leading-snug">Start your mentorship journey</h2>
            <p className="mt-2 text-sm leading-relaxed text-indigo-100">
              Join free as a student or a mentor. Set your hours, book sessions and grow — all in one place.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-indigo-100">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-cyan-300">✓</span> Free forever — no hidden fees
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-cyan-300">✓</span> Sign up with email or Google
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-cyan-300">✓</span> Mentor profiles approved by admins
              </li>
            </ul>
          </div>
          <p className="relative text-xs italic text-indigo-200">“MentorBook helped me land my first internship.”</p>
        </div>

        {/* Form panel */}
        <div className="p-7 sm:p-10">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Create your account</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Join as a student or a mentor — it&apos;s free.</p>

          <div className="mt-7">
            <div className="grid grid-cols-2 gap-3">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className={`rounded-xl border-2 p-4 text-left transition-all duration-200 ${
                    role === r.value
                      ? 'border-indigo-500 bg-indigo-50 shadow-sm ring-2 ring-indigo-100 dark:border-indigo-400 dark:bg-indigo-500/10 dark:ring-indigo-500/20'
                      : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/40 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-500/5'
                  }`}
                >
                  <div className="text-2xl">{r.icon}</div>
                  <div className={`mt-2 text-sm font-bold ${role === r.value ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-200'}`}>
                    {r.title}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <GoogleButton onSuccess={handleGoogle} text="signup_with" />
          </div>

          <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" /> or <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <FloatingInput
              id="name"
              label="Full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoComplete="name"
              error={errors.name}
            />
            <FloatingInput
              id="email"
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="email"
              error={errors.email}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FloatingInput
                id="password"
                label="Password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                minLength={6}
                autoComplete="new-password"
                error={errors.password}
              />
              <FloatingInput
                id="confirm"
                label="Confirm password"
                type="password"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                autoComplete="new-password"
                error={errors.confirm}
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full !py-3">
              {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-indigo-600 transition hover:text-indigo-700 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
