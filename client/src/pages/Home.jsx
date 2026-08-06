import { Link } from 'react-router-dom';
import { ArrowRight, Bell, CalendarDays, ShieldCheck, Star, Video, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const FEATURES = [
  { icon: CalendarDays, title: 'Flexible Availability', desc: 'Mentors set today\u2019s free hours or a recurring weekly schedule in one click.' },
  { icon: Zap, title: 'Instant Booking', desc: 'See live free slots and book in seconds. First come, first served — no double bookings.' },
  { icon: Video, title: 'Google Meet, Auto-linked', desc: 'Every session gets a Google Meet link automatically so you can just join.' },
  { icon: Bell, title: 'Smart Reminders', desc: 'Email confirmations, reschedule alerts and session reminders for both sides.' },
  { icon: Star, title: 'Ratings & Reviews', desc: 'Rate your mentor after each session and help others choose better.' },
  { icon: ShieldCheck, title: 'Trusted & Approved', desc: 'Mentors are vetted by admins. Cancel or reschedule anytime with transparency.' },
];

const STEPS = [
  { n: '01', title: 'Sign up', desc: 'As a student or a mentor — with email or one tap with Google.' },
  { n: '02', title: 'Set your hours', desc: 'Mentors publish today\u2019s slots or a repeating weekly schedule.' },
  { n: '03', title: 'Book a session', desc: 'Students pick a live free slot and instantly confirm the booking.' },
  { n: '04', title: 'Meet & grow', desc: 'Join the auto-generated Google Meet link. Learn, teach and review.' },
];

export default function Home() {
  const { user } = useAuth();

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-indigo-700 to-indigo-900">
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '28px 28px' }}
        />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <span className="animate-fade-in-up inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-100 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
              1-on-1 mentoring platform
            </span>
            <h1
              className="animate-fade-in-up mt-6 text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl"
              style={{ animationDelay: '0.1s' }}
            >
              Book a session with
              <span className="block bg-gradient-to-r from-cyan-200 via-blue-100 to-indigo-200 bg-clip-text text-transparent">
                mentors who get you
              </span>
            </h1>
            <p className="animate-fade-in-up mx-auto mt-6 max-w-xl text-lg text-indigo-100" style={{ animationDelay: '0.2s' }}>
              Browse expert mentors, see their live free slots and book instantly. Perfect for interview prep, career
              guidance, DSA, web development and more.
            </p>
            <div className="animate-fade-in-up mt-8 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: '0.3s' }}>
              {user ? (
                <Link
                  to={user.role === 'mentor' ? '/mentor' : '/mentors'}
                  className="btn bg-white !px-8 !py-3 !text-base text-indigo-700 shadow-lg shadow-indigo-900/30 hover:bg-blue-50 hover:shadow-xl"
                >
                  {user.role === 'mentor' ? 'Open your dashboard' : 'Find a mentor'}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="btn bg-white !px-8 !py-3 !text-base text-indigo-700 shadow-lg shadow-indigo-900/30 hover:bg-blue-50 hover:shadow-xl"
                  >
                    Get started free
                  </Link>
                  <Link
                    to="/mentors"
                    className="btn border border-white/30 !px-8 !py-3 !text-base text-white backdrop-blur hover:bg-white/10"
                  >
                    Browse mentors
                  </Link>
                </>
              )}
            </div>
            <div className="animate-fade-in-up mt-10 flex items-center justify-center gap-6 text-sm text-indigo-100" style={{ animationDelay: '0.4s' }}>
              <span>
                <strong className="text-white">2 roles</strong> · Student & Mentor
              </span>
              <span className="h-4 w-px bg-white/30" />
              <span>
                <strong className="text-white">1 tap</strong> · Google sign-in
              </span>
              <span className="h-4 w-px bg-white/30" />
              <span>
                <strong className="text-white">100%</strong> · Free to book
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="text-center">
          <p className="kicker">Why MentorBook</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            Everything you need to mentor & learn
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-500 dark:text-slate-400">
            A simple, fast booking experience — built for both sides of the table.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-600/10 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/40"
            >
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-indigo-500/10 dark:to-blue-500/10" />
              <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-md shadow-indigo-600/25 transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110">
                <f.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="relative mt-4 text-lg font-bold text-slate-900 dark:text-white">{f.title}</h3>
              <p className="relative mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white py-20 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center">
            <p className="kicker">How it works</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">From sign-up to session</h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-500 dark:text-slate-400">Four simple steps — and you're learning.</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="group relative rounded-2xl border border-slate-100 bg-slate-50/60 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:bg-white hover:shadow-lg dark:border-slate-800 dark:bg-slate-800/60 dark:hover:border-indigo-500/40 dark:hover:bg-slate-800"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-extrabold text-white shadow-md shadow-indigo-600/25 transition-transform duration-300 group-hover:scale-110">
                  {s.n}
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-14 text-center shadow-xl shadow-indigo-600/25">
          <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-blue-300/20 blur-2xl" />
          <h2 className="relative text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Ready to grow?</h2>
          <p className="relative mx-auto mt-3 max-w-md text-indigo-100">
            Join MentorBook today — whether you want to teach what you know or learn from the best.
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/register" className="btn bg-white !px-8 !py-3 text-indigo-700 shadow-lg hover:bg-blue-50 hover:shadow-xl">
              Create account
            </Link>
            <Link to="/mentors" className="btn border border-white/40 text-white hover:bg-white/10">
              Explore mentors
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
