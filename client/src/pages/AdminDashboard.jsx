import { useCallback, useEffect, useState } from 'react';
import { Calendar, CheckCircle2, Clock, GraduationCap, Inbox, Target, Users, XCircle } from 'lucide-react';
import client, { errMsg } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import Avatar from '../components/Avatar.jsx';
import { SkeletonStat } from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Pagination from '../components/Pagination.jsx';
import { formatDate, formatTime } from '../utils/time.js';
import { BOOKING_STATUS_STYLE } from '../utils/status.js';

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="card group p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-md shadow-indigo-600/20 transition-transform duration-200 group-hover:scale-110">
          <Icon className="h-5 w-5 text-white" strokeWidth={2.2} />
        </span>
        <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{value}</span>
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);

  const [users, setUsers] = useState([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userPages, setUserPages] = useState(1);
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [usersLoading, setUsersLoading] = useState(true);
  const [acting, setActing] = useState('');

  const loadStats = useCallback(async () => {
    try {
      const { data } = await client.get('/admin/stats');
      setStats(data.stats);
      setRecent(data.recentBookings);
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }, [toast]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams({ role: roleFilter, search, page: userPage, limit: 10 });
      const { data } = await client.get(`/admin/users?${params}`);
      setUsers(data.users);
      setUserTotal(data.total);
      setUserPages(data.pages);
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setUsersLoading(false);
    }
  }, [roleFilter, search, userPage, toast]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const updateUser = async (id, payload, label) => {
    setActing(id + label);
    try {
      await client.patch(`/admin/users/${id}`, payload);
      toast(`User ${label}d.`);
      loadUsers();
      loadStats();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setActing('');
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="kicker">Administration</p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Admin panel</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">Manage users, approve mentors and monitor bookings.</p>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {stats ? (
          <>
            <StatCard icon={GraduationCap} label="Mentors" value={stats.mentors ?? '—'} />
            <StatCard icon={Target} label="Students" value={stats.students ?? '—'} />
            <StatCard icon={Calendar} label="Total bookings" value={stats.bookings ?? '—'} />
            <StatCard icon={CheckCircle2} label="Confirmed" value={stats.confirmedBookings ?? '—'} />
            <StatCard icon={XCircle} label="Cancelled" value={stats.cancelledBookings ?? '—'} />
            <StatCard icon={Clock} label="Free slots" value={stats.totalSlots ?? '—'} />
          </>
        ) : (
          Array.from({ length: 6 }).map((_, i) => <SkeletonStat key={i} />)
        )}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Users */}
        <div className="card p-6 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Users</h2>
            <div className="flex flex-wrap gap-2">
              <input className="input !w-auto !py-2" placeholder="Search name…" value={search} onChange={(e) => { setSearch(e.target.value); setUserPage(1); }} />
              <select className="input !w-auto !py-2" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setUserPage(1); }}>
                <option value="">All roles</option>
                <option value="student">Students</option>
                <option value="mentor">Mentors</option>
                <option value="admin">Admins</option>
              </select>
              <span className="self-center text-xs text-slate-400 dark:text-slate-500">{userTotal} result(s)</span>
            </div>
          </div>

          {usersLoading ? (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-10 w-10 animate-pulse rounded-full bg-slate-200/70 dark:bg-slate-800" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-1/3 animate-pulse rounded-full bg-slate-200/70 dark:bg-slate-800" />
                    <div className="h-3 w-1/2 animate-pulse rounded-full bg-slate-200/70 dark:bg-slate-800" />
                  </div>
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="mt-4">
              <EmptyState icon={Users} title="No users found" />
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-400 dark:border-slate-700 dark:text-slate-500">
                    <th className="pb-3">User</th>
                    <th className="pb-3">Role</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-slate-100 transition hover:bg-indigo-50/30 dark:border-slate-800 dark:hover:bg-indigo-500/5">
                      <td className="py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} src={u.avatar} size="sm" />
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-100">{u.name}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`chip ${u.role === 'admin' ? 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-100 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30' : u.role === 'mentor' ? 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/30' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-col items-start gap-1">
                          {u.role === 'mentor' && (
                            <span className={`chip ${u.isApproved ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30' : 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30'}`}>
                              {u.isApproved ? 'approved' : 'pending'}
                            </span>
                          )}
                          {!u.isActive && <span className="chip bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30">banned</span>}
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1.5">
                          {u.role === 'mentor' && (
                            <button
                              className="btn-secondary !px-2.5 !py-1 !text-xs"
                              disabled={acting === u.id + 'approve'}
                              onClick={() => updateUser(u.id, { isApproved: !u.isApproved }, u.isApproved ? 'unapprov' : 'approv')}
                            >
                              {u.isApproved ? 'Unapprove' : 'Approve'}
                            </button>
                          )}
                          <button
                            className={`${u.isActive ? 'btn-danger' : 'btn-primary'} !px-2.5 !py-1 !text-xs`}
                            disabled={acting === u.id + 'ban'}
                            onClick={() => updateUser(u.id, { isActive: !u.isActive }, u.isActive ? 'ban' : 'unban')}
                          >
                            {u.isActive ? 'Ban' : 'Unban'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={userPage} pages={userPages} onChange={setUserPage} />
        </div>

        {/* Recent bookings */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent bookings</h2>
          {recent.length === 0 ? (
            <div className="mt-4">
              <EmptyState icon={Inbox} title="No bookings yet" />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {recent.map((b) => (
                <div key={b._id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 text-sm transition hover:border-indigo-100 hover:bg-white hover:shadow-sm dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-indigo-500/40 dark:hover:bg-slate-800">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{b.student?.name} → {b.mentor?.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{formatDate(b.date)} · {formatTime(b.startTime)}</p>
                  <span className={`chip mt-1.5 ${BOOKING_STATUS_STYLE[b.status] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                    {b.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
