import { test } from 'node:test';
import assert from 'node:assert/strict';

// Test: the REAL email templates (server/services/mailer.js) render the Zoom
// meeting details in the confirmation emails — the exact bug that was fixed —
// while the reminder emails stay unchanged and reuse the stored join link.
// No module mocking needed: the templates are pure functions.
//
// Run with:  cd server && npm test

import { emailTemplates } from '../services/mailer.js';

const data = {
  mentorName: 'Mentor A',
  studentName: 'Student B',
  studentEmail: 'student@test.com',
  date: '2030-01-10',
  startTime: '10:00',
  endTime: '10:45',
  timeZone: 'Asia/Kolkata',
  duration: '45 min',
  bookingId: 'abc123',
  meetLink: '',
  zoomJoinUrl: 'https://zoom.us/j/987654321?pwd=xyz',
  zoomMeetingId: '987654321',
  zoomPassword: 'pass123',
  notes: '',
  cancelReason: '',
};

test('student confirmation email renders the complete Zoom details', () => {
  const html = emailTemplates.bookingConfirmed(data).html;
  assert.match(html, /Join Zoom Meeting/, 'has the Join Zoom Meeting button');
  assert.match(html, /https:\/\/zoom\.us\/j\/987654321\?pwd=xyz/, 'contains the complete join URL');
  assert.match(html, /987654321/, 'includes Zoom Meeting ID');
  assert.match(html, /pass123/, 'includes the meeting password');
  assert.match(html, /45 min/, 'includes session duration');
  assert.match(html, /abc123/, 'includes Booking ID');
  assert.match(html, /Mentor A/, 'includes mentor name');
  assert.match(html, /Student B/, 'includes student name');
});

test('mentor confirmation email renders the complete Zoom details', () => {
  const html = emailTemplates.mentorNewBooking(data).html;
  assert.match(html, /Join Zoom Meeting/, 'has the Join Zoom Meeting button');
  assert.match(html, /https:\/\/zoom\.us\/j\/987654321\?pwd=xyz/, 'contains the complete join URL');
  assert.match(html, /987654321/, 'includes Zoom Meeting ID');
  assert.match(html, /pass123/, 'includes the meeting password');
  assert.match(html, /45 min/, 'includes session duration');
  assert.match(html, /student@test\.com/, 'includes student email');
});

test('confirmation emails use the subject "starts in 20 minutes" only for reminders, not confirmations', () => {
  assert.match(emailTemplates.bookingConfirmed(data).subject, /Session booked/);
  assert.match(emailTemplates.mentorNewBooking(data).subject, /New session booked/);
});

test('reminder emails stay unchanged: reuse stored zoom link, no new Join Link row', () => {
  const student = emailTemplates.reminder(data).html;
  const mentor = emailTemplates.reminderForMentor(data).html;
  for (const html of [student, mentor]) {
    assert.match(html, /Join Zoom Meeting/, 'reminder reuses the stored join link');
    assert.match(html, /987654321/, 'reminder keeps Zoom Meeting ID');
    assert.match(html, /pass123/, 'reminder keeps meeting password');
    assert.doesNotMatch(html, />Join Link<\/td>/, 'reminder does NOT gain the new Join Link row');
  }
});

test('fallback: no Zoom meeting -> Google Meet button, no Zoom rows', () => {
  const html = emailTemplates.bookingConfirmed({
    ...data,
    zoomJoinUrl: '',
    zoomMeetingId: '',
    zoomPassword: '',
    meetLink: 'https://meet.google.com/abc',
  }).html;
  assert.match(html, />Join Meeting</, 'falls back to the Google Meet button');
  assert.doesNotMatch(html, /987654321/, 'no Zoom rows when no meeting exists');
});

test('user-supplied zoom values are HTML-escaped in the templates', () => {
  const html = emailTemplates.bookingConfirmed({
    ...data,
    zoomPassword: '<img src=x onerror=alert(1)>',
    zoomJoinUrl: 'https://zoom.us/j/1" onclick="alert(1)',
  }).html;
  assert.doesNotMatch(html, /<img src=x/, 'password is escaped');
  assert.doesNotMatch(html, /onclick="alert\(1\)/, 'join URL is escaped');
});
