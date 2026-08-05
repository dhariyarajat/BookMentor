import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import Avatar from './Avatar.jsx';

const ROLE_LABEL = { student: 'Student', mentor: 'Mentor', admin: 'Admin' };

function MoonIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.5 12.5A7.5 7.5 0 017.5 2.5 7.5 7.5 0 1017.5 12.5z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M3.9 3.9l1.4 1.4M14.7 14.7l1.4 1.4M16.1 3.9l-1.4 1.4M5.3 14.7l-1.4 1.4" />
    </svg>
  );
}

// Independent instances in the desktop bar and mobile menu — never share one element.
function ThemeToggleButton() {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    setOpen(false);
  };

  const navItems = [
    { to: '/mentors', label: 'Find mentors', show: true },
    { to: '/dashboard', label: 'My sessions', show: user?.role === 'student' },
    { to: '/mentor', label: 'Dashboard', show: user?.role === 'mentor' },
    { to: '/admin', label: 'Admin', show: user?.role === 'admin' },
    { to: '/profile', label: 'Profile', show: !!user },
  ].filter((i) => i.show);

  const linkCls = ({ isActive }) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive
        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
    }`;

  const homeLink = user ? (user.role === 'mentor' ? '/mentor' : user.role === 'admin' ? '/admin' : '/dashboard') : '/';

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/85 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/85">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-lg shadow-md shadow-indigo-600/30">
            🎓
          </span>
          <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
            Mentor
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Book</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={linkCls}>
              {item.label}
            </NavLink>
          ))}
        </div>

        {/* Desktop actions */}
        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggleButton />
          {user ? (
            <>
              <Link to={homeLink}>
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 transition hover:border-indigo-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-800">
                  <Avatar name={user.name} src={user.avatar} size="sm" />
                  <span className="hidden max-w-[110px] truncate text-sm font-semibold text-slate-700 sm:block dark:text-slate-200">
                    {user.name.split(' ')[0]}
                  </span>
                  <span className="hidden rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-600 sm:block dark:bg-indigo-500/15 dark:text-indigo-300">
                    {ROLE_LABEL[user.role] || user.role}
                  </span>
                </div>
              </Link>
              <button onClick={handleLogout} className="btn-ghost !px-3 !py-2 text-sm">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost !px-4">
                Log in
              </Link>
              <Link to="/register" className="btn-primary !px-4">
                Get started
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 md:hidden dark:text-slate-300 dark:hover:bg-slate-800"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          {open ? (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h10" />
            </svg>
          )}
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="animate-fade-in border-t border-slate-100 bg-white px-4 pb-4 pt-2 md:hidden dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
            {user ? (
              <div className="flex items-center gap-2">
                <Avatar name={user.name} src={user.avatar} size="sm" />
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{user.name}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                    {ROLE_LABEL[user.role] || user.role}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">Welcome to MentorBook</p>
            )}
            <div className="flex items-center gap-2">
              <ThemeToggleButton />
              {user ? (
                <button onClick={handleLogout} className="btn-secondary !px-3 !py-2 text-sm">
                  Logout
                </button>
              ) : null}
            </div>
          </div>
          {!user && (
            <div className="mt-3 flex gap-2">
              <Link to="/login" onClick={() => setOpen(false)} className="btn-secondary flex-1">
                Log in
              </Link>
              <Link to="/register" onClick={() => setOpen(false)} className="btn-primary flex-1">
                Get started
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
