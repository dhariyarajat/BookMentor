/**
 * Converts a wall-clock time ("YYYY-MM-DD" + "HH:mm") in a given IANA
 * timezone into a JS Date (UTC instant). Works regardless of the server's
 * own timezone and handles DST transitions.
 *
 * Algorithm (same idea as date-fns-tz): express the wanted wall clock as a
 * pseudo-UTC timestamp, probe that instant with the target zone to learn what
 * the zone's clock actually reads there, then shift by the difference.
 */
export function zonedTimeToUtc(dateStr, timeStr, timeZone = 'Asia/Kolkata') {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);

  const desiredWall = Date.UTC(y, mo - 1, d, h, mi, 0, 0);

  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(dtf.formatToParts(new Date(desiredWall)).map((p) => [p.type, p.value]));
  const wallAtProbe = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );

  return new Date(desiredWall + (desiredWall - wallAtProbe));
}

/** Returns the current wall-clock time as "HH:mm" in the given timezone. */
export function nowInZone(timeZone = 'Asia/Kolkata') {
  const dtf = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return dtf.format(new Date()); // en-GB with h23 gives HH:mm
}

/** Returns today's date as "YYYY-MM-DD" in the given timezone. */
export function todayInZone(timeZone = 'Asia/Kolkata') {
  const dtf = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return dtf.format(new Date()); // en-CA gives YYYY-MM-DD
}

/** Adds N days to a "YYYY-MM-DD" string and returns "YYYY-MM-DD". */
export function addDays(dateStr, days, timeZone = 'Asia/Kolkata') {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days, 12, 0, 0); // noon avoids DST edge cases
  const dtf = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return dtf.format(dt);
}

/** Session length in whole minutes, computed from "HH:mm" start/end times. */
export function durationMinutes(startTime, endTime) {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

export function addMinutesToTime(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}
