/**
 * Gmail OAuth Authentication
 *
 * Handles OAuth 2.0 token management for Gmail API access including:
 * - Creating OAuth2 client
 * - Token refresh logic
 * - Authorization URL generation
 */

import { google } from 'googleapis';

export interface GmailTokens {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string | null;
  token_type?: string | null;
  expiry_date?: number | null;
}

/**
 * Creates a Gmail OAuth2 client with credentials from environment variables
 */
export function createOAuth2Client() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/api/admin/gmail/callback';

  if (!clientId || !clientSecret) {
    throw new Error('GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set in environment variables');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generates authorization URL for OAuth flow
 *
 * Required scope: gmail.modify (read, send, delete, and manage labels)
 */
export function getAuthorizationUrl(oauth2Client: ReturnType<typeof createOAuth2Client>): string {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // Get refresh token
    scope: ['https://www.googleapis.com/auth/gmail.modify'],
    prompt: 'consent', // Force consent screen to get refresh token
  });
}

/**
 * Exchanges authorization code for tokens
 */
export async function getTokensFromCode(
  oauth2Client: ReturnType<typeof createOAuth2Client>,
  code: string
): Promise<GmailTokens> {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Sets tokens on OAuth2 client
 */
export function setTokens(
  oauth2Client: ReturnType<typeof createOAuth2Client>,
  tokens: GmailTokens
): void {
  // Filter out null values to match Credentials type
  const credentials = {
    access_token: tokens.access_token ?? undefined,
    refresh_token: tokens.refresh_token ?? undefined,
    scope: tokens.scope ?? undefined,
    token_type: tokens.token_type ?? undefined,
    expiry_date: tokens.expiry_date ?? undefined,
  };
  oauth2Client.setCredentials(credentials);
}

/**
 * Gets authenticated OAuth2 client with tokens from environment
 *
 * Automatically refreshes tokens if expired
 */
export async function getAuthenticatedClient(): Promise<ReturnType<typeof createOAuth2Client>> {
  const oauth2Client = createOAuth2Client();

  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  const accessToken = process.env.GMAIL_ACCESS_TOKEN;

  if (!refreshToken) {
    throw new Error(
      'GMAIL_REFRESH_TOKEN not found. Please complete OAuth setup via /admin/gmail-setup'
    );
  }

  // Set credentials
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
    access_token: accessToken || undefined,
  });

  // Auto-refresh tokens if needed
  oauth2Client.on('tokens', (tokens) => {
    // In production, you'd want to save the new tokens to a database
    // For now, they're only used in-memory and will be refreshed on next run
    if (tokens.refresh_token) {
      console.log('New refresh token received:', tokens.refresh_token.substring(0, 20) + '...');
    }
  });

  // Verify credentials by checking if we need to refresh
  try {
    const tokenInfo = await oauth2Client.getAccessToken();
    if (!tokenInfo.token) {
      throw new Error('Failed to get access token');
    }
  } catch (error) {
    throw new Error(
      `Failed to authenticate with Gmail API: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  return oauth2Client;
}

/**
 * Refreshes the access token using refresh token
 */
export async function refreshAccessToken(
  oauth2Client: ReturnType<typeof createOAuth2Client>
): Promise<GmailTokens> {
  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials;
}

/**
 * Revokes tokens (for logout/disconnect)
 */
export async function revokeTokens(
  oauth2Client: ReturnType<typeof createOAuth2Client>
): Promise<void> {
  await oauth2Client.revokeCredentials();
}
