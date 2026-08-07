import { zonedTimeToUtc } from '../utils/time.js';

/**
 * Zoom Meeting integration (Server-to-Server OAuth).
 *
 * Credentials come from the backend .env only — ZOOM_ACCOUNT_ID,
 * ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET are never exposed to the client.
 *
 * Every public function is best-effort: failures are logged and null/undefined
 * is returned so callers (booking API, cron) never crash.
 */

const API_BASE = 'https://api.zoom.us/v2';
const TOKEN_URL = 'https://zoom.us/oauth/token';

// In-memory token cache with expiry; refreshed automatically when expired or
// when the API rejects the current token with 401.
let cachedToken = null;
let tokenExpiresAt = 0;

/** True when all three Zoom server-to-server credentials are present. */
export function isZoomConfigured() {
  return Boolean(
    process.env.ZOOM_ACCOUNT_ID &&
      process.env.ZOOM_CLIENT_ID &&
      process.env.ZOOM_CLIENT_SECRET
  );
}

/**
 * Fetches an access token via the account_credentials grant. Tokens are cached
 * in memory and refreshed 60s before expiry; forceRefresh is used when the API
 * responds 401 (token already invalid).
 */
async function getAccessToken(forceRefresh = false) {
  if (!isZoomConfigured()) return null;

  const now = Date.now();
  if (!forceRefresh && cachedToken && now < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const basicAuth = Buffer.from(
    `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
  ).toString('base64');

  const params = new URLSearchParams({
    grant_type: 'account_credentials',
    account_id: process.env.ZOOM_ACCOUNT_ID,
  });

  const res = await fetch(`${TOKEN_URL}?${params.toString()}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basicAuth}` },
  });
  if (!res.ok) {
    // Include Zoom's reason (e.g. disabled app, bad secret, missing scope) so
    // the server log pinpoints the real cause instead of a bare status code.
    const detail = await res.text().catch(() => '');
    throw new Error(`Zoom token request failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
  return cachedToken;
}

/**
 * Wraps a Zoom API call with a Bearer token. On a 401 the token is force
 * refreshed once and the request retried — transparently handling expiry.
 */
async function zoomFetch(path, options = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error('Zoom is not configured');

  const doFetch = async (bearer) =>
    fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const fresh = await getAccessToken(true);
    if (fresh) res = await doFetch(fresh);
  }
  return res;
}

/**
 * Creates a scheduled Zoom meeting for the given session.
 * Returns { zoomMeetingId, zoomJoinUrl, zoomStartUrl, zoomPassword } or null.
 */
export async function createZoomMeeting({ topic, date, startTime, endTime, timeZone }) {
  try {
    if (!isZoomConfigured()) return null;

    const start = zonedTimeToUtc(date, startTime, timeZone);
    const end = zonedTimeToUtc(date, endTime, timeZone);
    const durationMin = Math.max(1, Math.round((end - start) / 60000));

    const res = await zoomFetch('/users/me/meetings', {
      method: 'POST',
      body: JSON.stringify({
        topic,
        type: 2, // scheduled meeting
        start_time: start.toISOString().replace(/\.\d{3}Z$/, 'Z'),
        duration: durationMin,
        timezone: 'UTC', // start_time is sent in UTC, so the meeting is DST-safe
        settings: {
          join_before_host: true,
          waiting_room: false,
          host_video: true,
          participant_video: true,
          mute_upon_entry: false,
        },
      }),
    });

    if (!res.ok) {
      console.error('❌ Zoom create meeting failed:', res.status, await res.text());
      return null;
    }

    const data = await res.json();
    return {
      zoomMeetingId: String(data.id || ''),
      zoomJoinUrl: data.join_url || '',
      zoomStartUrl: data.start_url || '',
      zoomPassword: data.password || '',
    };
  } catch (err) {
    console.error('❌ createZoomMeeting error:', err.message);
    return null;
  }
}

/**
 * Deletes a Zoom meeting. Best-effort; a 404 (already gone) is treated as
 * success so cancel/reschedule cleanup never fails the request.
 */
export async function deleteZoomMeeting(meetingId) {
  if (!meetingId) return;
  try {
    if (!isZoomConfigured()) return;

    const res = await zoomFetch(`/meetings/${meetingId}`, { method: 'DELETE' });
    if (res.status === 404) return; // meeting already deleted
    if (!res.ok) {
      console.error(`❌ Zoom delete meeting failed (${res.status}): meeting ${meetingId} may need manual cleanup`, await res.text());
    }
  } catch (err) {
    console.error('❌ deleteZoomMeeting error:', err.message);
  }
}
