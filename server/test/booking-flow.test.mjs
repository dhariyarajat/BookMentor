import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import AppError from '../utils/appError.js';

// Test: the create-booking flow (server/controllers/bookingController.js) with
// the Zoom API mocked at the module boundary. Covers:
//   1. Meeting created BEFORE the booking is saved (happy path)
//   2. Abort on Zoom API failure (no booking, no emails, proper 503)
//   3. Orphan cleanup when the booking save fails after the meeting exists
//   4. Fallback when Zoom is not configured (Google Meet flow preserved)
//
// Run with:  cd server && npm test
//
// Uses Node's built-in test runner (node:test) + mock.module() — no external
// test dependencies required.

// Resolve mock specifiers to absolute file URLs relative to THIS test file so
// they match the exact URLs the controller imports, whatever the cwd is.
const here = (rel) => new URL(rel, import.meta.url).href;

/* ------------------------------ fakes ---------------------------------- */

const calls = {
  order: [], // ['zoom:create', 'booking:create', 'email', ...] — proves ordering
  zoomCreate: [],
  zoomDelete: [],
  bookingCreate: [],
  emailData: [],
  emails: [],
};

let zoomConfigured = true;
let zoomCreateImpl = null; // (args) => meeting object | null
let bookingCreateImpl = null; // (data) => throws on simulated save failure

const MENTOR_ID = '507f1f77bcf86cd799439011';
const STUDENT_ID = '507f1f77bcf86cd799439022';

const mentor = {
  _id: { toString: () => MENTOR_ID },
  name: 'Mentor A',
  email: 'mentor@test.com',
  role: 'mentor',
  isActive: true,
  isApproved: true,
  googleRefreshToken: 'dummy-google-token', // lets the Google Meet fallback run
};

const profile = {
  timeZone: 'Asia/Kolkata',
  sessionDuration: 45,
  breakDuration: 10,
  blockedDates: [],
};

const SLOT = { startTime: '10:00', endTime: '10:45' };

const MEETING = {
  zoomMeetingId: '999000111',
  zoomJoinUrl: 'https://zoom.us/j/999000111',
  zoomStartUrl: 'https://zoom.us/s/999000111',
  zoomPassword: 'pw123',
};

/* -------------------- module mocks (before import) --------------------- */

mock.module(here('../services/zoom.js'), {
  namedExports: {
    isZoomConfigured: () => zoomConfigured,
    createZoomMeeting: async (args) => {
      calls.order.push('zoom:create');
      calls.zoomCreate.push(args);
      return zoomCreateImpl ? zoomCreateImpl(args) : null;
    },
    deleteZoomMeeting: async (id) => {
      calls.order.push('zoom:delete');
      calls.zoomDelete.push(id);
    },
  },
});

mock.module(here('../services/slotService.js'), {
  namedExports: {
    getSlotsForDate: async () => ({ slots: [SLOT] }),
    findSlotConflict: async () => null,
    isSlotInPast: () => false,
  },
});

mock.module(here('../services/mailer.js'), {
  namedExports: {
    sendMail: async ({ to }) => {
      calls.order.push('email');
      calls.emails.push(to);
      return { dev: true };
    },
    emailTemplates: {
      bookingConfirmed: (d) => {
        calls.emailData.push(d);
        return { subject: '✅ booked', html: 'student confirmation' };
      },
      mentorNewBooking: (d) => {
        calls.emailData.push(d);
        return { subject: '📅 new booking', html: 'mentor confirmation' };
      },
    },
  },
});

mock.module(here('../services/meeting.js'), {
  namedExports: {
    createMeetLink: async () => ({ meetLink: 'https://meet.google.com/abc', eventId: 'evt1' }),
    deleteCalendarEvent: async () => {},
  },
});

mock.module(here('../models/User.js'), { defaultExport: { findById: async () => mentor } });
mock.module(here('../models/MentorProfile.js'), { defaultExport: { findOne: async () => profile } });
mock.module(here('../models/Booking.js'), {
  defaultExport: {
    create: async (data) => {
      calls.order.push('booking:create');
      calls.bookingCreate.push(data);
      if (bookingCreateImpl) bookingCreateImpl(data);
      return makeBookingDoc(data);
    },
  },
});

// Import the controller under test — only valid AFTER the mocks are set.
const { createBooking } = await import(here('../controllers/bookingController.js'));

/* ------------------------------ helpers -------------------------------- */

function makeBookingDoc(data) {
  const doc = {
    _id: { toString: () => 'booking123' },
    status: 'confirmed',
    meetLink: '',
    calendarEventId: '',
    ...data,
    save: async function () {},
    toObject: function () {
      const copy = { ...this };
      delete copy.save;
      delete copy.toObject;
      return copy;
    },
  };
  return doc;
}

function makeReq(overrides = {}) {
  return {
    body: { mentorId: MENTOR_ID, date: '2030-01-10', startTime: '10:00', notes: '', ...(overrides.body || {}) },
    user: { _id: STUDENT_ID, name: 'Student B', email: 'student@test.com', ...(overrides.user || {}) },
  };
}

function makeRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => ({ json: (body) => { res.statusCode = code; res.body = body; } });
  res.json = (body) => { res.body = body; };
  return res;
}

function makeNext() {
  const next = (err) => {
    next.error = err;
  };
  next.error = null;
  return next;
}

beforeEach(() => {
  for (const key of Object.keys(calls)) calls[key].length = 0;
  zoomConfigured = true;
  zoomCreateImpl = null;
  bookingCreateImpl = null;
});

/* ------------------------------- tests --------------------------------- */

test('happy path: meeting created BEFORE save, booking stores zoom details, emails sent after, host URL never exposed', async () => {
  zoomCreateImpl = async () => ({ ...MEETING });
  const req = makeReq();
  const res = makeRes();
  const next = makeNext();

  await createBooking(req, res, next);

  assert.equal(next.error, null);
  // Meeting first, then booking save, then the two confirmation emails.
  assert.deepEqual(calls.order, ['zoom:create', 'booking:create', 'email', 'email']);

  // Meeting created for the exact session.
  assert.equal(calls.zoomCreate.length, 1);
  const zoomArgs = calls.zoomCreate[0];
  assert.equal(zoomArgs.date, '2030-01-10');
  assert.equal(zoomArgs.startTime, '10:00');
  assert.equal(zoomArgs.endTime, '10:45');
  assert.equal(zoomArgs.timeZone, 'Asia/Kolkata');
  assert.match(zoomArgs.topic, /Student B ↔ Mentor A/);

  // Booking saved with ALL Zoom details.
  const saved = calls.bookingCreate[0];
  assert.equal(saved.zoomMeetingId, MEETING.zoomMeetingId);
  assert.equal(saved.zoomJoinUrl, MEETING.zoomJoinUrl);
  assert.equal(saved.zoomStartUrl, MEETING.zoomStartUrl);
  assert.equal(saved.zoomPassword, MEETING.zoomPassword);
  assert.equal(saved.zoomCreated, true);
  assert.ok(saved.zoomCreatedAt instanceof Date);

  // Response: 201 + zoomStartUrl (host link) stripped from the client payload.
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.message, 'Session booked successfully!');
  assert.equal(res.body.booking.zoomMeetingId, MEETING.zoomMeetingId);
  assert.equal(res.body.booking.zoomStartUrl, undefined);

  // Both confirmation emails received the zoom payload.
  assert.deepEqual(calls.emails, ['student@test.com', 'mentor@test.com']);
  for (const d of calls.emailData) {
    assert.equal(d.zoomJoinUrl, MEETING.zoomJoinUrl);
    assert.equal(d.zoomMeetingId, MEETING.zoomMeetingId);
    assert.equal(d.zoomPassword, MEETING.zoomPassword);
    assert.equal(d.duration, '45 min');
  }
});

test('abort: Zoom API failure -> booking NOT saved, NO emails, proper 503 error', async () => {
  zoomCreateImpl = async () => null; // configured, but the API call failed
  const req = makeReq();
  const res = makeRes();
  const next = makeNext();

  await createBooking(req, res, next);

  assert.equal(calls.zoomCreate.length, 1, 'zoom creation was attempted');
  assert.equal(calls.bookingCreate.length, 0, 'booking must NOT be saved');
  assert.equal(calls.emails.length, 0, 'no confirmation emails');
  assert.equal(calls.zoomDelete.length, 0, 'nothing was created, nothing to clean up');
  assert.equal(res.statusCode, null, 'no success response');
  assert.ok(next.error instanceof AppError, 'a proper AppError is forwarded');
  assert.equal(next.error.statusCode, 503);
  assert.match(next.error.message, /Zoom meeting could not be created/);
});

test('orphan cleanup: booking save fails (slot taken) after meeting created -> meeting deleted, 409, no emails', async () => {
  zoomCreateImpl = async () => ({ ...MEETING });
  bookingCreateImpl = () => {
    const err = new Error('E11000 duplicate key');
    err.code = 11000;
    throw err;
  };
  const req = makeReq();
  const res = makeRes();
  const next = makeNext();

  await createBooking(req, res, next);

  assert.equal(calls.zoomCreate.length, 1);
  assert.equal(calls.zoomDelete.length, 1);
  assert.equal(calls.zoomDelete[0], MEETING.zoomMeetingId, 'orphaned meeting must be deleted');
  assert.equal(calls.emails.length, 0, 'no confirmation emails after a failed save');
  assert.ok(next.error instanceof AppError, 'a proper AppError is forwarded');
  assert.equal(next.error.statusCode, 409);
  assert.match(next.error.message, /just taken/);
});

test('fallback: Zoom NOT configured -> booking still succeeds without zoom (Google Meet flow preserved)', async () => {
  zoomConfigured = false;
  const req = makeReq();
  const res = makeRes();
  const next = makeNext();

  await createBooking(req, res, next);

  assert.equal(calls.zoomCreate.length, 0, 'no zoom call when unconfigured');
  assert.equal(next.error, null);
  assert.equal(res.statusCode, 201);

  const saved = calls.bookingCreate[0];
  assert.equal(saved.zoomMeetingId, '');
  assert.equal(saved.zoomCreated, false);
  assert.equal(saved.zoomCreatedAt, null);

  // Confirmation emails still go out, and the Google Meet link was attached.
  assert.deepEqual(calls.emails, ['student@test.com', 'mentor@test.com']);
  assert.equal(res.body.booking.meetLink, 'https://meet.google.com/abc');
});
