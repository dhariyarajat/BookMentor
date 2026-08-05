import { useEffect, useRef } from 'react';
import { renderGoogleButton, isGoogleConfigured } from '../utils/google.js';

/**
 * Renders Google's official sign-in button.
 * onSuccess receives the Google ID token.
 */
export default function GoogleButton({ onSuccess, onError, text = 'signin_with' }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      renderGoogleButton(ref.current, { onSuccess, onError, text });
    }
  }, [onSuccess, onError, text]);

  if (!isGoogleConfigured()) {
    return (
      <p className="rounded-xl bg-amber-50 px-4 py-3 text-center text-xs text-amber-700">
        ⚠️ Google login is not configured. Set <code>VITE_GOOGLE_CLIENT_ID</code> in client/.env
        and <code>GOOGLE_CLIENT_ID</code> in server/.env.
      </p>
    );
  }

  return <div ref={ref} className="flex justify-center" />;
}
