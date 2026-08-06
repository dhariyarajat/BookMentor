import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Pencil } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import client, { errMsg } from '../api/client.js';
import Avatar from '../components/Avatar.jsx';
import FloatingInput from '../components/FloatingInput.jsx';

const ROLE_LABEL = { student: 'Student', mentor: 'Mentor', admin: 'Admin' };
const ROLE_STYLE = {
  student: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  mentor: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  admin: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
};

export default function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();

  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [saving, setSaving] = useState(false);

  // Change password
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwErrors, setPwErrors] = useState({});
  const [changing, setChanging] = useState(false);

  const validatePw = () => {
    const e = {};
    if (!pw.current) e.current = 'Current password is required.';
    if (!pw.next) e.next = 'New password is required.';
    else if (pw.next.length < 6) e.next = 'Password must be at least 6 characters.';
    if (pw.confirm !== pw.next) e.confirm = 'Passwords do not match.';
    setPwErrors(e);
    return Object.keys(e).length === 0;
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (!validatePw()) return;
    setChanging(true);
    try {
      await client.patch('/auth/change-password', {
        currentPassword: pw.current,
        newPassword: pw.next,
        confirmPassword: pw.confirm,
      });
      toast('Password changed successfully!');
      setPw({ current: '', next: '', confirm: '' });
      setPwErrors({});
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setChanging(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast('Name cannot be empty.', 'error');
      return;
    }
    setSaving(true);
    try {
      const { data } = await client.patch('/auth/me', { name: name.trim(), avatar: avatar.trim() });
      setUser(data.user);
      toast('Profile updated!');
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="kicker">My account</p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Profile</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">Manage your account details.</p>

      {/* Identity card */}
      <div className="card mt-6 overflow-hidden">
        <div className="relative h-24 bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-800">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        </div>
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-end">
          <div className="-mt-16">
            <Avatar name={user?.name} src={user?.avatar} size="xl" className="!ring-4 !ring-white shadow-xl shadow-indigo-900/20 dark:!ring-slate-900" />
          </div>
          <div className="flex-1 pt-2 sm:pt-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">{user?.name}</h2>
              <span className={`chip ${ROLE_STYLE[user?.role] || ''}`}>{ROLE_LABEL[user?.role] || user?.role}</span>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{user?.email}</p>
          </div>
          {user?.role === 'mentor' && (
            <Link to="/mentor/profile" className="btn-secondary shrink-0">
              <Pencil className="h-4 w-4" /> Edit mentor profile
            </Link>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Edit profile */}
        <div className="card p-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit profile</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Update your display name and picture URL.</p>
          <form onSubmit={save} noValidate className="mt-5 space-y-4">
            <FloatingInput id="name" label="Full name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoComplete="name" />
            <FloatingInput id="avatar" label="Profile picture URL" value={avatar} onChange={(e) => setAvatar(e.target.value)} autoComplete="url" />
            <button type="submit" className="btn-primary w-full" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </div>

        {/* Change password */}
        <div className="card p-6">
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
            <Lock className="h-5 w-5 text-slate-400 dark:text-slate-500" /> Change password
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Verify your current password to set a new one.
          </p>
          <form onSubmit={changePassword} noValidate className="mt-5 space-y-4">
            <FloatingInput
              id="current-password"
              label="Current password"
              type="password"
              value={pw.current}
              onChange={(e) => setPw({ ...pw, current: e.target.value })}
              autoComplete="current-password"
              error={pwErrors.current}
            />
            <FloatingInput
              id="new-password"
              label="New password"
              type="password"
              value={pw.next}
              onChange={(e) => setPw({ ...pw, next: e.target.value })}
              minLength={6}
              autoComplete="new-password"
              error={pwErrors.next}
            />
            <FloatingInput
              id="confirm-password"
              label="Confirm new password"
              type="password"
              value={pw.confirm}
              onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
              autoComplete="new-password"
              error={pwErrors.confirm}
            />
            <button type="submit" className="btn-primary w-full" disabled={changing}>
              {changing ? 'Changing…' : 'Change password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
