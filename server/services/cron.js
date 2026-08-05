import cron from 'node-cron';
import Booking from '../models/Booking.js';
import { sendMail, emailTemplates } from './mailer.js';
import { zonedTimeToUtc, todayInZone, addDays } from '../utils/time.js';

// One reminder per booking, sent when the session is ~10 minutes away. The job
// runs every minute; the reminderSent guard guarantees a single send. The first
// run inside the window happens at the 10-minute tick; the window stays open
// until 7 minutes so that a failed send is retried on each subsequent run (per
// the reliability requirement) instead of being skipped forever.
const REMINDER_WINDOW_MIN = 7;
const REMINDER_WINDOW_MAX = 10;

/**
 * Checks every confirmed, un-reminded booking and emails both parties 10
 * minutes before the session. Exported separately so it can be invoked
 * directly in tests / one-off scripts.
 */
export async function sendReminders() {
  const now = Date.now();

  // Efficiency pre-filter: a session starting within the next 10 minutes can
  // only be dated today/tomorrow in its own timezone, and a booking's local
  // date can differ from Asia/Kolkata by at most ~1 day. Scanning today ±1 day
  // covers every timezone while keeping each run small. (Indexed in Booking.)
  const today = todayInZone('Asia/Kolkata');
  const bookings = await Booking.find({
    status: 'confirmed', // ignores cancelled & completed
    reminderSent: { $ne: true }, // ignores already-reminded bookings
    date: { $gte: addDays(today, -1), $lte: addDays(today, 2) },
  })
    .populate('mentor', 'name email')
    .populate('student', 'name email');

  for (const b of bookings) {
    const timeZone = b.timeZone || 'Asia/Kolkata';
    const start = zonedTimeToUtc(b.date, b.startTime, timeZone);
    const minsToStart = (start.getTime() - now) / 60000;
    // Primary send at ~10 minutes before start; retries while still > 7 min out.
    if (minsToStart <= REMINDER_WINDOW_MIN || minsToStart > REMINDER_WINDOW_MAX) continue;

    const mentor = b.mentor;
    const student = b.student;
    if (!mentor || !student) continue;

    const data = {
      mentorName: mentor.name,
      studentName: student.name,
      studentEmail: student.email,
      date: b.date,
      startTime: b.startTime,
      endTime: b.endTime,
      timeZone,
      meetLink: b.meetLink,
      notes: b.notes,
      bookingId: b._id.toString(),
    };

    // Send to both independently; a failure on one side must not crash the job.
    const results = await Promise.allSettled([
      sendMail({ to: student.email, ...emailTemplates.reminder(data) }),
      sendMail({ to: mentor.email, ...emailTemplates.reminderForMentor(data) }),
    ]);
    const allSucceeded = results.every((r) => r.status === 'fulfilled');
    for (const r of results) {
      if (r.status === 'rejected') console.error('❌ Reminder email failed:', r.reason?.message || r.reason);
    }

    // Only mark as reminded when BOTH emails went out; otherwise leave the flag
    // false so the next cron run retries.
    if (allSucceeded) {
      b.reminderSent = true;
      await b.save();
    }
  }
}

export function startCronJobs() {
  if (process.env.DISABLE_CRON === 'true') {
    console.log('⏰ Cron jobs disabled (DISABLE_CRON=true)');
    return;
  }

  // Every minute -> send 10-minute reminders for sessions starting soon
  cron.schedule('* * * * *', async () => {
    try {
      await sendReminders();
    } catch (err) {
      console.error('❌ Reminder cron error:', err.message);
    }
  });

  // Daily at 3 AM -> auto-complete confirmed bookings that ended in the past
  cron.schedule('0 3 * * *', async () => {
    try {
      // Only scan bookings up to today (lexicographic works for zero-padded dates)
      const latestDate = todayInZone('Asia/Kolkata');
      const bookings = await Booking.find({ status: 'confirmed', date: { $lte: latestDate } });
      let completed = 0;
      for (const b of bookings) {
        const end = zonedTimeToUtc(b.date, b.endTime, b.timeZone || 'Asia/Kolkata');
        if (end.getTime() + 30 * 60000 < Date.now()) {
          b.status = 'completed';
          await b.save();
          completed++;
        }
      }
      if (completed) console.log(`✅ Auto-completed ${completed} past bookings`);
    } catch (err) {
      console.error('❌ Auto-complete cron error:', err.message);
    }
  });

  console.log('⏰ Cron jobs started (1-min reminders + auto-complete)');
}
