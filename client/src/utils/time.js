/** Returns "YYYY-MM-DD" for today in the given IANA timezone. */
export function todayInZone(timeZone = 'Asia/Kolkata') {
  const dtf = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return dtf.format(new Date());
}

/** Returns the current wall-clock time as "HH:mm" in the given timezone. */
export function nowInZone(timeZone = 'Asia/Kolkata') {
  const dtf = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return dtf.format(new Date()); // en-GB with h23 gives HH:mm
}

const toMin = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const toStr = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/**
 * Client-side mirror of the server's slot generator, used for the mentor's
 * slot preview panel. Produces the exact same grid the server would:
 * working hours + per-window session/break duration (falling back to the
 * profile defaults), minus existing bookings and past slots on today.
 */
export function generateSlotPreview({ ranges = [], booked = [], sessionDuration = 60, breakDuration = 20, date, timeZone = 'Asia/Kolkata' }) {
  if (!date || date < todayInZone(timeZone)) return [];
  const isToday = date === todayInZone(timeZone);
  const now = isToday ? nowInZone(timeZone) : '';
  const bookedMins = (booked || []).map((b) => ({ s: toMin(b.startTime), e: toMin(b.endTime) }));

  const slots = [];
  for (const range of ranges) {
    const dur = range.sessionDuration ?? sessionDuration;
    const brk = range.breakDuration ?? breakDuration;
    // A zero/negative duration would make the grid never advance (infinite loop)
    if (!(dur > 0)) continue;
    let current = toMin(range.startTime);
    const end = toMin(range.endTime);
    while (current + dur <= end) {
      const start = current;
      const stop = current + dur;
      const startStr = toStr(start);
      const endStr = toStr(stop);
      const blocked = bookedMins.some((b) => start < b.e && stop > b.s);
      if (!blocked && (!isToday || startStr > now)) {
        slots.push({ startTime: startStr, endTime: endStr });
      }
      current = stop + brk;
    }
  }
  return slots;
}

/** Minutes between two "HH:mm" times. */
export function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/** Adds days to a "YYYY-MM-DD" string. */
export function addDays(dateStr, days, timeZone = 'Asia/Kolkata') {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days, 12, 0, 0);
  const dtf = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return dtf.format(dt);
}

/** Formats "YYYY-MM-DD" to a readable date like "12 Aug 2026". */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Formats "HH:mm" to "4:30 PM". */
export function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Maps the backend-generated free slots for a mentor on a date to the list of
 * bookable start-times ("HH:mm") the UI renders. All slot math happens on the
 * server (working hours + session duration + break duration − existing
 * bookings), so the client only extracts the start times here.
 */
export function buildSlotStarts({ slots, date, timeZone }) {
  // Past dates can never have bookable slots
  if (date < todayInZone(timeZone)) return [];
  if (!Array.isArray(slots)) {
    // The backend always returns a generated `slots` array. If it's missing the
    // server is running old code — surface it instead of silently hiding slots.
    console.warn('[availability] API response is missing the generated `slots` array (server may be running old code).', { slots, date });
    return [];
  }
  return slots.map((s) => s.startTime);
}
