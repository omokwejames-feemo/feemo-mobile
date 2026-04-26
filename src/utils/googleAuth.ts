import * as AuthSession from 'expo-auth-session'
import * as Google from 'expo-auth-session/providers/google'
import * as SecureStore from 'expo-secure-store'
import * as WebBrowser from 'expo-web-browser'

WebBrowser.maybeCompleteAuthSession()

const KEYS = {
  accessToken:  'feemo_google_access_token',
  refreshToken: 'feemo_google_refresh_token',
  expiresAt:    'feemo_google_expires_at',
}

export interface GoogleTokens {
  accessToken: string
  refreshToken: string | null
  expiresAt: number  // Unix ms
}

// ─── secure storage helpers ───────────────────────────────────────────────────

export async function saveTokens(tokens: GoogleTokens): Promise<void> {
  await SecureStore.setItemAsync(KEYS.accessToken,  tokens.accessToken)
  await SecureStore.setItemAsync(KEYS.expiresAt,    String(tokens.expiresAt))
  if (tokens.refreshToken) {
    await SecureStore.setItemAsync(KEYS.refreshToken, tokens.refreshToken)
  }
}

export async function loadTokens(): Promise<GoogleTokens | null> {
  const [access, refresh, expiresAt] = await Promise.all([
    SecureStore.getItemAsync(KEYS.accessToken),
    SecureStore.getItemAsync(KEYS.refreshToken),
    SecureStore.getItemAsync(KEYS.expiresAt),
  ])
  if (!access || !expiresAt) return null
  return { accessToken: access, refreshToken: refresh, expiresAt: Number(expiresAt) }
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.accessToken),
    SecureStore.deleteItemAsync(KEYS.refreshToken),
    SecureStore.deleteItemAsync(KEYS.expiresAt),
  ])
}

// ─── token refresh ────────────────────────────────────────────────────────────

async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
  if (!clientId) throw new Error('Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID')

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  })
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`)
  const data = await res.json()
  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt:    Date.now() + data.expires_in * 1000,
  }
}

// ─── get valid token (auto-refresh if needed) ─────────────────────────────────

export async function getValidAccessToken(): Promise<string | null> {
  const tokens = await loadTokens()
  if (!tokens) return null

  const BUFFER = 2 * 60 * 1000   // refresh 2 min before expiry
  if (Date.now() < tokens.expiresAt - BUFFER) return tokens.accessToken

  if (!tokens.refreshToken) { await clearTokens(); return null }

  const refreshed = await refreshAccessToken(tokens.refreshToken)
  await saveTokens(refreshed)
  return refreshed.accessToken
}

// ─── React hook — call inside a component ────────────────────────────────────

export function useGoogleSignIn() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId:        process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId:     process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    scopes: [
      'openid',
      'profile',
      'email',
      'https://www.googleapis.com/auth/drive.file',
    ],
  })

  async function signIn(): Promise<GoogleTokens | null> {
    const result = await promptAsync()
    if (result.type !== 'success') return null

    const { authentication } = result
    if (!authentication) return null

    const tokens: GoogleTokens = {
      accessToken:  authentication.accessToken,
      refreshToken: authentication.refreshToken ?? null,
      expiresAt:    authentication.expirationDate
        ? new Date(authentication.expirationDate).getTime()
        : Date.now() + 3600 * 1000,
    }
    await saveTokens(tokens)
    return tokens
  }

  return { request, response, signIn }
}
