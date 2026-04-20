const BASE = '/.netlify/functions/lobby'

export function getPlayerId() {
  let id = localStorage.getItem('clipd_player_id')
  if (!id) {
    id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
    localStorage.setItem('clipd_player_id', id)
  }
  return id
}

export function getPlayerName() {
  return localStorage.getItem('clipd_player_name') || ''
}

export function setPlayerName(name) {
  localStorage.setItem('clipd_player_name', name.slice(0, 20))
}

export async function createLobby({ hostId, hostName, playlistName, songList }) {
  const res = await fetch(`${BASE}?action=create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostId, hostName, playlistName, songList }),
  })
  if (!res.ok) throw new Error('Failed to create lobby')
  return res.json()
}

export async function joinLobby(code, { guestId, guestName }) {
  const res = await fetch(`${BASE}?action=join&code=${code}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guestId, guestName }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to join lobby')
  return data
}

export async function getLobby(code) {
  const res = await fetch(`${BASE}?code=${code}`)
  if (res.status === 404) return null
  return res.json()
}

export async function startRound(code, hostId) {
  const res = await fetch(`${BASE}?action=start&code=${code}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostId }),
  })
  return res.json()
}

export async function submitGuess(code, { role, songId }) {
  const res = await fetch(`${BASE}?action=guess&code=${code}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, songId }),
  })
  return res.json()
}

export async function nextSong(code, hostId) {
  const res = await fetch(`${BASE}?action=next&code=${code}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostId }),
  })
  return res.json()
}

export async function setPreviewUrls(code, hostId, previewUrls) {
  const res = await fetch(`${BASE}?action=setpreviews&code=${code}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostId, previewUrls }),
  })
  return res.json()
}
