const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export const isGoogleConfigured = () => Boolean(CLIENT_ID);

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.events', // needed for Google Meet link auto-generation
].join(' ');

let scriptLoaded = false;

function loadGsiScript() {
  return new Promise((resolve) => {
    if (window.google?.accounts) return resolve();
    const existing = document.querySelector('script[src*="gsi/client"]');
    if (existing) {
      existing.addEventListener('load', resolve);
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = resolve;
    document.head.appendChild(s);
  });
}

/**
 * Shows the Google sign-in popup and resolves with a Google ID token.
 */
export function signInWithGoogle() {
  return new Promise((resolve, reject) => {
    if (!isGoogleConfigured()) {
      reject(new Error('Google Client ID is not configured (VITE_GOOGLE_CLIENT_ID).'));
      return;
    }
    loadGsiScript().then(() => {
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (res) => (res?.credential ? resolve(res.credential) : reject(new Error('Google sign-in cancelled'))),
        auto_select: false,
      });
      window.google.accounts.id.prompt((notification) => {
        // One-tap may be suppressed; fall back to full popup.
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          window.google.accounts.oauth2
            .initTokenClient({
              client_id: CLIENT_ID,
              scope: SCOPES,
              prompt: 'select_account',
              callback: (resp) => (resp?.access_token ? resolve(resp.id_token) : reject(new Error('Google sign-in cancelled'))),
            })
            .requestAccessToken();
        }
      });
    });
  });
}

/**
 * Asks the user for Google Calendar permission and resolves with
 * { accessToken, refreshToken, expiryDate }. Used by mentors so the server
 * can auto-create Google Meet links for booked sessions.
 */
export function requestCalendarTokens() {
  return new Promise((resolve, reject) => {
    if (!isGoogleConfigured()) {
      reject(new Error('Google Client ID is not configured.'));
      return;
    }
    loadGsiScript().then(() => {
      window.google.accounts.oauth2
        .initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          access_type: 'offline',
          prompt: 'consent',
          callback: (resp) => {
            if (resp?.access_token) {
              resolve({
                accessToken: resp.access_token,
                refreshToken: resp.refresh_token || '',
                expiryDate: resp.expires_in ? Date.now() + resp.expires_in * 1000 : Date.now() + 3600_000,
              });
            } else {
              reject(new Error('Google Calendar permission was not granted.'));
            }
          },
        })
        .requestAccessToken();
    });
  });
}

/** Renders Google's official branded sign-in button into a container. */
export function renderGoogleButton(container, { onSuccess, onError, text = 'signin_with' } = {}) {
  if (!isGoogleConfigured()) return;
  loadGsiScript().then(() => {
    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: (res) => (res?.credential ? onSuccess(res.credential) : onError?.(new Error('Google sign-in cancelled'))),
      auto_select: false,
    });
    window.google.accounts.id.renderButton(container, {
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text,
      width: container.clientWidth || 320,
    });
  });
}
