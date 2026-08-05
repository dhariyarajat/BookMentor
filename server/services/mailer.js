import nodemailer from 'nodemailer';

const ENABLED = process.env.EMAIL_ENABLED === 'true';

let transporter = null;
if (ENABLED) {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: Number(process.env.EMAIL_PORT) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

/**
 * Reusable email sender. Never throws into the caller when EMAIL_ENABLED is
 * off (dev mode logs instead); when enabled, errors propagate so callers can
 * decide how to handle them (the booking API logs & continues).
 */
export async function sendMail({ to, subject, html }) {
  if (!ENABLED) {
    console.log(`[mail:dev] → ${to} | ${subject}`);
    return { dev: true };
  }
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"MentorBook" <noreply@mentorbook.app>',
      to,
      subject,
      html,
    });
    console.log(`📧 Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error('❌ Email send failed:', err.message);
    throw err;
  }
}

/* ------------------------------ Templates ------------------------------ */

/** Escapes user-controlled values before interpolating them into HTML. */
function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function layout(title, bodyHtml) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1e293b;background:#f8fafc;border-radius:12px;">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:20px 24px;border-radius:10px 10px 0 0;">
      <h2 style="margin:0;font-size:20px;">${esc(title)}</h2>
    </div>
    <div style="background:#fff;padding:24px;border-radius:0 0 10px 10px;">
      ${bodyHtml}
    </div>
    <p style="font-size:12px;color:#94a3b8;text-align:center;margin-top:16px;">MentorBook — Learn from the best.</p>
  </div>`;
}

function tableRow(label, value) {
  return `<tr><td style="padding:8px 0;color:#64748b;width:38%;vertical-align:top;">${esc(label)}</td><td style="font-weight:600;">${value}</td></tr>`;
}

/**
 * Shared booking summary table. Fields are only rendered when present, so the
 * same builder works for student + mentor + reminder + completion emails.
 * Expected fields: mentorName, studentName, date, startTime, endTime, timeZone?,
 * bookingId?, status?, meetLink?, notes?
 */
function bookingSummary(b, extraRows = []) {
  const rows = [
    tableRow('Mentor', esc(b.mentorName)),
    tableRow('Student', esc(b.studentName)),
    tableRow('Date', esc(b.date)),
    tableRow('Time', `${esc(b.startTime)} – ${esc(b.endTime)} (${esc(b.timeZone || 'Asia/Kolkata')})`),
  ];
  if (b.bookingId) rows.push(tableRow('Booking ID', `<code style="font-size:12px;color:#6366f1;">${esc(b.bookingId)}</code>`));
  if (b.status) rows.push(tableRow('Status', esc(b.status)));
  if (b.meetLink)
    rows.push(
      tableRow('Meeting', `<a href="${esc(b.meetLink)}" style="color:#6366f1;font-weight:600;">Join Google Meet</a>`)
    );
  if (b.notes) rows.push(tableRow('Notes', esc(b.notes)));
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0;">${rows.join('')}${extraRows.join('')}</table>`;
}

export const emailTemplates = {
  /** Sent to the student right after a successful booking. */
  bookingConfirmed: (b) => ({
    subject: `✅ Session booked with ${b.mentorName}`,
    html: layout(
      'Booking Confirmed!',
      `<p>Hi <strong>${esc(b.studentName)}</strong>, your session with <strong>${esc(b.mentorName)}</strong> is confirmed.</p>
       ${bookingSummary(b)}
       <p style="font-size:13px;color:#64748b;">Need to reschedule or cancel? Login to your dashboard anytime.</p>`
    ),
  }),

  /** Sent to the mentor right after a student books. */
  mentorNewBooking: (b) => ({
    subject: `📅 New session booked by ${b.studentName}`,
    html: layout(
      'New Session Booking',
      `<p>Hi <strong>${esc(b.mentorName)}</strong>, you have a new session request.</p>
       <table style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0;">
         ${tableRow('Student Name', esc(b.studentName))}
         ${tableRow('Student Email', esc(b.studentEmail))}
         ${tableRow('Date', esc(b.date))}
         ${tableRow('Time', `${esc(b.startTime)} – ${esc(b.endTime)} (${esc(b.timeZone || 'Asia/Kolkata')})`)}
         ${tableRow('Booking ID', `<code style="font-size:12px;color:#6366f1;">${esc(b.bookingId)}</code>`)}
       </table>
       <p style="font-size:13px;color:#64748b;">Manage this session from your mentor dashboard.</p>`
    ),
  }),

  /** Sent to the student when a booking is cancelled. */
  bookingCancelled: (b) => ({
    subject: `❌ Session cancelled with ${b.mentorName}`,
    html: layout(
      'Booking Cancelled',
      `<p>Hi <strong>${esc(b.studentName)}</strong>, your session with <strong>${esc(b.mentorName)}</strong> on <strong>${esc(b.date)} at ${esc(b.startTime)}</strong> has been cancelled${b.cancelReason ? ` — <em>${esc(b.cancelReason)}</em>` : ''}.</p>
       ${bookingSummary(b)}
       <p style="font-size:13px;color:#64748b;">You can book another slot from the mentor's profile.</p>`
    ),
  }),

  /** Sent to the mentor when a booking is cancelled. */
  bookingCancelledForMentor: (b) => ({
    subject: `❌ Session cancelled by ${b.cancelledByName || b.studentName}`,
    html: layout(
      'Booking Cancelled',
      `<p>Hi <strong>${esc(b.mentorName)}</strong>, the session with <strong>${esc(b.studentName)}</strong> on <strong>${esc(b.date)} at ${esc(b.startTime)}</strong> has been cancelled${b.cancelReason ? ` — <em>${esc(b.cancelReason)}</em>` : ''}.</p>
       ${bookingSummary(b)}`
    ),
  }),

  /** Sent to the student when a booking is rescheduled. */
  bookingRescheduled: (b) => ({
    subject: `🔁 Session rescheduled — ${b.mentorName}`,
    html: layout(
      'Session Rescheduled',
      `<p>Hi <strong>${esc(b.studentName)}</strong>, your session with <strong>${esc(b.mentorName)}</strong> has been rescheduled.</p>
       ${bookingSummary(b)}`
    ),
  }),

  /** Sent to the mentor when a booking is rescheduled. */
  bookingRescheduledForMentor: (b) => ({
    subject: `🔁 Session rescheduled — ${b.studentName}`,
    html: layout(
      'Session Rescheduled',
      `<p>Hi <strong>${esc(b.mentorName)}</strong>, the session with <strong>${esc(b.studentName)}</strong> has been rescheduled.</p>
       ${bookingSummary(b)}`
    ),
  }),

  /** Sent to the student when the mentor marks the session as completed. */
  sessionCompleted: (b) => ({
    subject: `🎉 Session completed with ${b.mentorName}`,
    html: layout(
      'Session Completed',
      `<p>Hi <strong>${esc(b.studentName)}</strong>, your session with <strong>${esc(b.mentorName)}</strong> has been marked as completed.</p>
       ${bookingSummary(b)}
       <p style="font-size:13px;color:#64748b;">We hope it went great! You can leave a review to help other students choose the right mentor.</p>`
    ),
  }),

  /** Sent to the student 10 minutes before the session starts. */
  reminder: (b) => ({
    subject: '⏰ Reminder: Your mentoring session starts in 10 minutes',
    html: layout(
      'Upcoming Session Reminder',
      `<p>Hi <strong>${esc(b.studentName)}</strong>, your mentoring session with <strong>${esc(b.mentorName)}</strong> starts in <strong>10 minutes</strong>.</p>
       ${bookingSummary(b)}`
    ),
  }),

  /** Sent to the mentor 10 minutes before the session starts. */
  reminderForMentor: (b) => ({
    subject: `⏰ Reminder: Your mentoring session with ${b.studentName} starts in 10 minutes`,
    html: layout(
      'Upcoming Session Reminder',
      `<p>Hi <strong>${esc(b.mentorName)}</strong>, your mentoring session with <strong>${esc(b.studentName)}</strong> starts in <strong>10 minutes</strong>.</p>
       ${bookingSummary(b, b.studentEmail ? [tableRow('Student Email', esc(b.studentEmail))] : [])}`
    ),
  }),

  /** Sent when a user requests a password reset. */
  passwordReset: ({ name, resetUrl }) => ({
    subject: 'Reset Your MentorBook Password',
    html: layout(
      'Reset Your Password',
      `<p>Hi <strong>${esc(name)}</strong>,</p>
       <p>We received a request to reset your MentorBook password. Click the button below to choose a new one:</p>
       <p style="text-align:center;margin:24px 0;">
         <a href="${esc(resetUrl)}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;font-weight:600;padding:12px 28px;border-radius:10px;">Reset my password</a>
       </p>
       <p style="font-size:13px;color:#64748b;">This link is valid for <strong>15 minutes</strong> and can only be used once. If you didn't request this, you can safely ignore this email — your password will not change.</p>`
    ),
  }),
};

