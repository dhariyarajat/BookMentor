import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, TriangleAlert } from 'lucide-react';
import client, { errMsg } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { EXPERTISE_TAGS } from '../data/expertise.js';
import Avatar from '../components/Avatar.jsx';
import StarRating from '../components/StarRating.jsx';
import Pagination from '../components/Pagination.jsx';
import EmptyState from '../components/EmptyState.jsx';

function MentorCardSkeleton() {
  return (
    <div className="card overflow-hidden p-6">
      <div className="flex items-start gap-4">
        <div className="h-20 w-20 shrink-0 animate-pulse rounded-full bg-slate-200/70 dark:bg-slate-800" />
        <div className="flex-1 space-y-3 pt-1">
          <div className="h-4 w-2/3 animate-pulse rounded-full bg-slate-200/70 dark:bg-slate-800" />
          <div className="h-3 w-1/2 animate-pulse rounded-full bg-slate-200/70 dark:bg-slate-800" />
          <div className="h-3 w-1/3 animate-pulse rounded-full bg-slate-200/70 dark:bg-slate-800" />
        </div>
      </div>
      <div className="mt-5 space-y-2.5">
        <div className="h-6 w-3/4 animate-pulse rounded-full bg-slate-200/70 dark:bg-slate-800" />
        <div className="h-6 w-2/3 animate-pulse rounded-full bg-slate-200/70 dark:bg-slate-800" />
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
        <div className="h-3 w-1/3 animate-pulse rounded-full bg-slate-200/70 dark:bg-slate-800" />
        <div className="h-4 w-16 animate-pulse rounded-full bg-slate-200/70 dark:bg-slate-800" />
      </div>
    </div>
  );
}

export default function BrowseMentors() {
  const { user } = useAuth();
  const [mentors, setMentors] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expertise, setExpertise] = useState([]);
  const [minRating, setMinRating] = useState(0);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [sort, setSort] = useState('rating');

  // Debounce the search box
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchMentors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: debouncedSearch,
        expertise: expertise.join(','),
        minRating,
        online: onlineOnly ? 'true' : '',
        sort,
        page,
        limit: 9,
      });
      const { data } = await client.get(`/mentors?${params}`);
      setMentors(data.mentors);
      setTotal(data.total);
      setPages(data.pages);
      setError('');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, expertise, minRating, onlineOnly, sort, page]);

  useEffect(() => {
    fetchMentors();
  }, [fetchMentors]);

  const toggleExpertise = (tag) => {
    setExpertise((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="kicker">Mentor directory</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Find your mentor</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">{total} verified mentors ready to help you grow.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className="input !w-auto">
            <option value="rating">Top rated</option>
            <option value="experience">Most experienced</option>
            <option value="newest">Newest</option>
          </select>
          <select value={minRating} onChange={(e) => { setMinRating(Number(e.target.value)); setPage(1); }} className="input !w-auto">
            <option value={0}>Any rating</option>
            <option value={4}>4★ & up</option>
            <option value={4.5}>4.5★ & up</option>
          </select>
          <button
            onClick={() => { setOnlineOnly((v) => !v); setPage(1); }}
            aria-pressed={onlineOnly}
            className={`chip border transition-all duration-150 ${
              onlineOnly
                ? 'border-emerald-500 bg-emerald-600 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-emerald-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-emerald-500/50 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300'
            }`}
          >
            <span className="mr-1 inline-flex h-1.5 w-1.5 rounded-full bg-current opacity-80" />
            Online now
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mt-6">
        <svg
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="9" cy="9" r="6" />
          <path d="M13.5 13.5L18 18" />
        </svg>
        <input
          className="input !py-3 pl-11"
          placeholder="Search mentors by name… (e.g. Aarav, Priya)"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {/* Expertise chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        {EXPERTISE_TAGS.slice(0, 12).map((tag) => (
          <button
            key={tag}
            onClick={() => toggleExpertise(tag)}
            className={`chip border transition-all duration-150 ${
              expertise.includes(tag)
                ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300'
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <MentorCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="mt-8">
          <EmptyState icon={TriangleAlert} title="Something went wrong" subtitle={error} />
        </div>
      ) : mentors.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={Search}
            title="No mentors found"
            subtitle="Try changing your search or clearing some filters."
            action={
              <button
                className="btn-secondary"
                onClick={() => { setSearch(''); setDebouncedSearch(''); setExpertise([]); setMinRating(0); setOnlineOnly(false); }}
              >
                Clear filters
              </button>
            }
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {mentors.map((m) => (
            <div
              key={m.id}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-600/10 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/40"
            >
              <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 to-indigo-600 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="flex items-start gap-4 p-6">
                <div className="relative shrink-0">
                  <Avatar name={m.name} src={m.avatar} size="lg" />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-slate-900 ${
                      m.isOnline ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                    title={m.isOnline ? 'Online' : 'Offline'}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-lg font-bold text-slate-900 transition group-hover:text-indigo-700 dark:text-white dark:group-hover:text-indigo-300">
                    {m.name}
                  </h3>
                  <p className="truncate text-sm text-slate-500 dark:text-slate-400">{m.headline || 'Mentor'}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <StarRating value={Math.round(m.ratingAvg)} size="text-sm" />
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {m.ratingAvg.toFixed(1)} ({m.ratingCount})
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-1 flex-col px-6 pb-5">
                <div className="flex flex-wrap gap-1.5">
                  {m.expertise.slice(0, 3).map((e) => (
                    <span key={e} className="chip bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/30">
                      {e}
                    </span>
                  ))}
                  {m.expertise.length > 3 && (
                    <span className="chip bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      +{m.expertise.length - 3}
                    </span>
                  )}
                </div>
                <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {m.experienceYears} yrs exp · {m.sessionDuration} min
                  </span>
                </div>
              </div>
              <div className="mt-auto flex gap-2 border-t border-slate-100 p-4 dark:border-slate-800">
                <Link
                  to={`/mentors/${m.id}`}
                  className="btn-secondary flex-1 !px-3 !py-2 text-center text-sm"
                >
                  View Profile
                </Link>
                {user?.role === 'student' && (
                  <Link
                    to={`/mentors/${m.id}`}
                    className="btn-primary flex-1 !px-3 !py-2 text-center text-sm"
                  >
                    Book Mentor
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination page={page} pages={pages} onChange={setPage} />
    </div>
  );
}
