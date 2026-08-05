import { OAuth2Client } from 'google-auth-library';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

/**
 * Verifies a Google ID token (from Google Identity Services sign-in)
 * and returns the decoded profile payload.
 */
export async function verifyGoogleIdToken(idToken) {
  const client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET);
  const ticket = await client.verifyIdToken({
    idToken,
    audience: CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload) throw new Error('Invalid Google token payload');
  return payload;
}

/**
 * Returns an OAuth2Client that can refresh an access token
 * using a stored refresh token.
 */
export function getGoogleOAuthClient() {
  return new OAuth2Client(CLIENT_ID, CLIENT_SECRET);
}
