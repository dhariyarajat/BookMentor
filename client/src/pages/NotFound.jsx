import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="relative flex min-h-[65vh] flex-col items-center justify-center overflow-hidden px-4 py-16 text-center">
      <div className="pointer-events-none absolute -left-24 top-16 h-64 w-64 rounded-full bg-blue-100/60 blur-3xl dark:bg-blue-500/10" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-64 w-64 rounded-full bg-indigo-100/60 blur-3xl dark:bg-indigo-500/10" />
      <div className="relative">
        <p className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-8xl font-black tracking-tight text-transparent">
          404
        </p>
        <div className="mt-4 flex justify-center">
          <Compass className="h-16 w-16 text-slate-400 dark:text-slate-500" strokeWidth={1.5} />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold text-slate-900 dark:text-white">This page took a detour</h1>
        <p className="mx-auto mt-2 max-w-md text-slate-500 dark:text-slate-400">
          The page you're looking for doesn't exist. Let's get you back on track.
        </p>
        <Link to="/" className="btn-primary mt-8">
          Back to home
        </Link>
      </div>
    </div>
  );
}
