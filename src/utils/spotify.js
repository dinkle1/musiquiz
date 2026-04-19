import { generateCodeVerifier, generateCodeChallenge } from './pkce.js'

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI || window.location.origin
const SCOPES = 'playlist-read-private playlist-read-collaborative'
const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize'
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token'
const API_BASE = 'https://api.spotify.com/v1'

export async function startAuthFlow() {
  const verifier = await generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)

  localStorage.setItem('pkce_verifier', verifier)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  })

  window.location.href = `${AUTH_ENDPOINT}?${params}`
}

export async function exchangeCodeForToken(code) {
  const verifier = localStorage.getItem('pkce_verifier')

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: verifier,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to exchange code for token')
  }

  const data = await response.json()
  const expiresAt = Date.now() + data.expires_in * 1000

  localStorage.setItem('spotify_token', data.access_token)
  localStorage.setItem('spotify_token_expires', expiresAt.toString())
  localStorage.removeItem('pkce_verifier')

  return data.access_token
}

export function getStoredToken() {
  const token = localStorage.getItem('spotify_token')
  const expiresAt = parseInt(localStorage.getItem('spotify_token_expires') || '0', 10)

  if (!token || Date.now() >= expiresAt) {
    return null
  }
  return token
}

export function clearToken() {
  localStorage.removeItem('spotify_token')
  localStorage.removeItem('spotify_token_expires')
}

async function apiFetch(path, token) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    if (response.status === 401) {
      clearToken()
      throw new Error('UNAUTHORIZED')
    }
    throw new Error(`Spotify API error: ${response.status}`)
  }

  return response.json()
}

export async function fetchPlaylists(token) {
  const playlists = []
  let url = '/me/playlists?limit=50'

  while (url) {
    const data = await apiFetch(url, token)
    playlists.push(...data.items.filter(Boolean))
    url = data.next ? data.next.replace(API_BASE, '') : null
  }

  return playlists
}

export async function fetchPlaylistTracks(token, playlistId) {
  const allTracks = []
  let url = `/playlists/${playlistId}/tracks?limit=100`

  while (url) {
    const data = await apiFetch(url, token)
    for (const item of data.items) {
      if (item?.track?.id) {
        allTracks.push(item.track)
      }
    }
    url = data.next ? data.next.replace(API_BASE, '') : null
  }

  const withPreviews = allTracks.filter((t) => t.preview_url)

  // Return tracks with previews if any exist, otherwise return all tracks
  // so callers can show a meaningful count and error
  return { tracks: withPreviews, total: allTracks.length }
}

export async function fetchPlaylist(token, playlistId) {
  return apiFetch(`/playlists/${playlistId}?fields=id,name,images,tracks(total)`, token)
}
