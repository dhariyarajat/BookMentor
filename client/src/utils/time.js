/** Returns "YYYY-MM-DD" for today in the given IANA timezone. */
export function todayInZone(timeZone = 'Asia/Kolkata') {
  const dtf = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return dtf.format(new Date());
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
 * Builds a list of bookable slot start-times ("HH:mm") for a mentor's
 * availability on a date. Skips slots that overlap booked ranges or that
 * already passed (when the date is today).
 */
export function buildSlotStarts({ ranges, booked, sessionDuration = 60, date, timeZone }) {
  // Past dates can never have bookable slots
  if (date < todayInZone(timeZone)) return [];
  const isToday = date === todayInZone(timeZone);
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const toMin = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const toStr = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

  // Mandatory 20-minute gap after every session (mirrors the server rule)
  const BUFFER_MINUTES = 20;

  const starts = [];
  for (const range of ranges) {
    const rStart = toMin(range.startTime);
    const rEnd = toMin(range.endTime);
    for (let s = rStart; s + sessionDuration <= rEnd; s += sessionDuration) {
      const e = s + sessionDuration;
      // skip if it overlaps a booked session or violates the 20-minute buffer
      const conflicts = booked.some((b) => {
        const bs = toMin(b.startTime);
        const be = toMin(b.endTime);
        if (s < be && e > bs) return true; // overlaps a booked session
        if (s >= be && s < be + BUFFER_MINUTES) return true; // starts too soon after a booked session
        if (e <= bs && e > bs - BUFFER_MINUTES) return true; // a booked session starts too soon after this one
        return false;
      });
      if (conflicts) continue;
      // skip past slots if booking for today
      if (isToday && s <= nowMin) continue;
      starts.push(toStr(s));
    }
  }
  return starts;
}
