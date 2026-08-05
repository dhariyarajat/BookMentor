import { getGoogleOAuthClient } from '../config/google.js';

/**
 * Returns a fresh (non-expired) access token for a user, refreshing
 * their stored token when needed. Returns null when no tokens stored.
 */
export async function getFreshAccessToken(user) {
  if (!user.googleRefreshToken) return null;

  const now = Date.now();
  if (user.googleAccessToken && user.googleTokenExpiry && now < user.googleTokenExpiry - 60_000) {
    return user.googleAccessToken;
  }

  try {
    const client = getGoogleOAuthClient();
    client.setCredentials({ refresh_token: user.googleRefreshToken });
    const { credentials } = await client.refreshAccessToken();
    user.googleAccessToken = credentials.access_token;
    user.googleTokenExpiry = credentials.expiry_date || Date.now() + 3600_000;
    await user.save({ validateBeforeSave: false });
    return credentials.access_token;
  } catch (err) {
    console.error('❌ Google token refresh failed:', err.message);
    return null;
  }
}

/**
 * Creates a Google Calendar event with a Google Meet conference link.
 * Returns { meetLink, eventId } or null (best-effort; booking still succeeds).
 */
export async function createMeetLink({ user, summary, start, end, attendeeEmails = [] }) {
  try {
    const accessToken = await getFreshAccessToken(user);
    if (!accessToken) return null;

    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary,
        description: 'Booked via MentorBook',
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        attendees: attendeeEmails.map((email) => ({ email })),
        conferenceData: {
          createRequest: {
            requestId: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      }),
    });

    if (!res.ok) {
      console.error('❌ Calendar event creation failed:', res.status, await res.text());
      return null;
    }

    const event = await res.json();
    return {
      meetLink: event.hangoutLink || event.htmlLink || '',
      eventId: event.id || '',
    };
  } catch (err) {
    console.error('❌ createMeetLink error:', err.message);
    return null;
  }
}

/** Best-effort deletion of a calendar event (on cancel/reschedule). */
export async function deleteCalendarEvent(user, eventId) {
  if (!eventId) return;
  try {
    const accessToken = await getFreshAccessToken(user);
    if (!accessToken) return;
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
    );
  } catch (err) {
    console.error('❌ Calendar event delete failed:', err.message);
  }
}
