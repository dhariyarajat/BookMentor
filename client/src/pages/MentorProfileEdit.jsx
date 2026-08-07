import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save } from 'lucide-react';
import client, { errMsg } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { EXPERTISE_TAGS } from '../data/expertise.js';
import Spinner from '../components/Spinner.jsx';

const TIMEZONES = ['Asia/Kolkata', 'Asia/Karachi', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'UTC'];

const SESSION_PRESETS = [15, 20, 30, 45, 60, 75, 90, 120];
const BUFFER_PRESETS = [0, 5, 10, 15, 20, 25, 30, 45, 60];

export default function MentorProfileEdit() {
  const toast = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    headline: '',
    bio: '',
    expertise: [],
    experienceYears: 0,
    sessionDuration: 60,
    breakDuration: 20,
    timeZone: 'Asia/Kolkata',
    location: '',
    languages: [],
  });
  const [langInput, setLangInput] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await client.get('/mentors/me');
        const m = data.mentor;
        setForm({
          headline: m.headline || '',
          bio: m.bio || '',
          expertise: m.expertise || [],
          experienceYears: m.experienceYears || 0,
          sessionDuration: m.sessionDuration || 60,
          breakDuration: m.breakDuration ?? 20,
          timeZone: m.timeZone || 'Asia/Kolkata',
          location: m.location || '',
          languages: m.languages || [],
        });
      } catch (err) {
        toast(errMsg(err), 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const toggleExpertise = (tag) => {
    setForm((f) => ({
      ...f,
      expertise: f.expertise.includes(tag) ? f.expertise.filter((t) => t !== tag) : [...f.expertise, tag],
    }));
  };

  const addLanguage = () => {
    const v = langInput.trim();
    if (v && !form.languages.includes(v)) {
      setForm((f) => ({ ...f, languages: [...f.languages, v] }));
      setLangInput('');
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await client.patch('/mentors/me', form);
      toast('Profile saved!');
      navigate('/mentor');
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="kicker">Mentor profile</p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Tell students about you</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">Tell students who you are and how they can learn from you.</p>

      <div className="card mt-6 space-y-6 p-6 sm:p-8">
        <div>
          <label className="label">Headline</label>
          <input
            className="input"
            maxLength={120}
            placeholder="e.g. Senior Frontend Engineer @ Google · 8 yrs experience"
            value={form.headline}
            onChange={(e) => setForm({ ...form, headline: e.target.value })}
          />
        </div>

        <div>
          <label className="label">Bio</label>
          <textarea
            className="input min-h-[120px] resize-none"
            maxLength={2000}
            placeholder="Tell students about your background, teaching style and what you can help with…"
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
        </div>

        <div className="grid gap-5 border-t border-slate-100 pt-6 sm:grid-cols-2 dark:border-slate-800">
          <div>
            <label className="label">Experience (years)</label>
            <input type="number" min={0} max={60} className="input" value={form.experienceYears} onChange={(e) => setForm({ ...form, experienceYears: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Session length (min)</label>
            <div className="flex flex-wrap gap-1.5">
              {SESSION_PRESETS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setForm({ ...form, sessionDuration: d })}
                  className={`chip border transition-all duration-150 ${
                    form.sessionDuration === d
                      ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500/50 dark:hover:text-indigo-300'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={10}
                max={240}
                step={1}
                className="input !w-28 !py-2"
                value={form.sessionDuration}
                onChange={(e) => setForm({ ...form, sessionDuration: Number(e.target.value) })}
              />
              <span className="text-[11px] text-slate-400 dark:text-slate-500">10–240 min · step 1</span>
            </div>
          </div>
          <div>
            <label className="label">Break between sessions (min)</label>
            <div className="flex flex-wrap gap-1.5">
              {BUFFER_PRESETS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setForm({ ...form, breakDuration: d })}
                  className={`chip border transition-all duration-150 ${
                    form.breakDuration === d
                      ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500/50 dark:hover:text-indigo-300'
                  }`}
                >
                  {d === 0 ? 'None' : d}
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={120}
                step={1}
                className="input !w-28 !py-2"
                value={form.breakDuration}
                onChange={(e) => setForm({ ...form, breakDuration: Number(e.target.value) })}
              />
              <span className="text-[11px] text-slate-400 dark:text-slate-500">0–120 min · step 1</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
              Free slots are generated from your working hours with this gap after every session.
            </p>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6 dark:border-slate-800">
          <label className="label">Expertise</label>
          <div className="flex flex-wrap gap-2">
            {EXPERTISE_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleExpertise(tag)}
                className={`chip border transition-all duration-150 ${
                  form.expertise.includes(tag)
                    ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-5 border-t border-slate-100 pt-6 sm:grid-cols-2 dark:border-slate-800">
          <div>
            <label className="label">Time zone</label>
            <select className="input" value={form.timeZone} onChange={(e) => setForm({ ...form, timeZone: e.target.value })}>
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Location</label>
            <input className="input" placeholder="e.g. Bengaluru, India (or Remote)" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6 dark:border-slate-800">
          <label className="label">Languages</label>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="e.g. Hindi, English"
              value={langInput}
              onChange={(e) => setLangInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLanguage())}
            />
            <button type="button" className="btn-secondary" onClick={addLanguage}>Add</button>
          </div>
          {form.languages.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {form.languages.map((l) => (
                <span key={l} className="chip bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/30">
                  {l}
                  <button className="ml-1.5 text-indigo-300 transition hover:text-rose-500 dark:text-indigo-400 dark:hover:text-rose-400" onClick={() => setForm((f) => ({ ...f, languages: f.languages.filter((x) => x !== l) }))}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 border-t border-slate-100 pt-6 dark:border-slate-800">
          <button className="btn-secondary" onClick={() => navigate('/mentor')}>Back</button>
          <button className="btn-primary flex-1" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : (<><Save className="h-4 w-4" /> Save profile</>)}
          </button>
        </div>
      </div>
    </div>
  );
}
