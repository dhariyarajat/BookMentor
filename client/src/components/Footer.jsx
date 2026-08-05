import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 py-10 sm:px-6 lg:flex-row">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-sm shadow-md shadow-indigo-600/20">
            🎓
          </span>
          <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
            Mentor
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Book</span>
          </span>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          <Link to="/mentors" className="text-slate-500 transition hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400">
            Find mentors
          </Link>
          <Link to="/login" className="text-slate-500 transition hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400">
            Log in
          </Link>
          <Link to="/register" className="text-slate-500 transition hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400">
            Sign up
          </Link>
        </nav>

        <div className="flex flex-col items-center gap-1.5 text-center text-xs text-slate-400 lg:items-end lg:text-right dark:text-slate-500">
          <p>Learn from the best — book 1-on-1 sessions with expert mentors.</p>
          <p>© {new Date().getFullYear()} MentorBook</p>
        </div>
      </div>
    </footer>
  );
}
