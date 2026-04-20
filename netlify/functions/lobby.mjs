import { getStore } from '@netlify/blobs'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
function makeCode() {
  return Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('')
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { headers: CORS })

  const url = new URL(req.url)
  const action = url.searchParams.get('action')
  const code = url.searchParams.get('code')?.toUpperCase()
  const store = getStore('lobbies')

  // ── CREATE ────────────────────────────────────────
  if (action === 'create' && req.method === 'POST') {
    let body
    try { body = await req.json() } catch { return new Response('Bad JSON', { status: 400, headers: CORS }) }

    const lobbyCode = makeCode()
    const lobby = {
      code: lobbyCode,
      hostId: body.hostId,
      hostName: String(body.hostName || 'Host').slice(0, 20),
      guestId: null,
      guestName: null,
      playlistName: String(body.playlistName || '').slice(0, 80),
      songList: (body.songList || []).slice(0, 100).map(s => ({
        id: s.id,
        title: String(s.title || '').slice(0, 100),
        artist: String(s.artist || '').slice(0, 100),
        albumArt: String(s.albumArt || '').slice(0, 300),
        previewUrl: String(s.previewUrl || '').slice(0, 300),
      })),
      currentSong: 0,
      startAt: null,
      roundWinner: null,
      scores: { host: 0, guest: 0 },
      status: 'waiting', // waiting | ready | playing | finished
      createdAt: Date.now(),
    }

    await store.setJSON(`lobby-${lobbyCode}`, lobby, { metadata: { createdAt: Date.now() } })
    return Response.json({ code: lobbyCode }, { headers: CORS })
  }

  // ── JOIN ──────────────────────────────────────────
  if (action === 'join' && req.method === 'POST') {
    if (!code) return new Response('Missing code', { status: 400, headers: CORS })
    let body
    try { body = await req.json() } catch { return new Response('Bad JSON', { status: 400, headers: CORS }) }

    const lobby = await store.get(`lobby-${code}`, { type: 'json' })
    if (!lobby) return Response.json({ error: 'Lobby not found' }, { status: 404, headers: CORS })
    if (lobby.guestId && lobby.guestId !== body.guestId)
      return Response.json({ error: 'Lobby is full' }, { status: 409, headers: CORS })

    lobby.guestId = body.guestId
    lobby.guestName = String(body.guestName || 'Guest').slice(0, 20)
    if (lobby.status === 'waiting') lobby.status = 'ready'

    await store.setJSON(`lobby-${code}`, lobby)
    return Response.json(lobby, { headers: CORS })
  }

  // ── GET STATE ─────────────────────────────────────
  if (req.method === 'GET') {
    if (!code) return new Response('Missing code', { status: 400, headers: CORS })
    const lobby = await store.get(`lobby-${code}`, { type: 'json' })
    if (!lobby) return Response.json({ error: 'Not found' }, { status: 404, headers: CORS })
    return Response.json(lobby, { headers: CORS })
  }

  if (req.method === 'POST') {
    if (!code) return new Response('Missing code', { status: 400, headers: CORS })
    const lobby = await store.get(`lobby-${code}`, { type: 'json' })
    if (!lobby) return Response.json({ error: 'Not found' }, { status: 404, headers: CORS })

    let body
    try { body = await req.json() } catch { body = {} }

    // ── START ROUND ───────────────────────────────
    if (action === 'start') {
      if (body.hostId !== lobby.hostId) return new Response('Forbidden', { status: 403, headers: CORS })
      lobby.startAt = Date.now() + 3000 // 3-second countdown
      lobby.roundWinner = null
      lobby.status = 'playing'
      await store.setJSON(`lobby-${code}`, lobby)
      return Response.json(lobby, { headers: CORS })
    }

    // ── GUESS ─────────────────────────────────────
    if (action === 'guess') {
      // Only accept first correct guess per round
      if (lobby.roundWinner) return Response.json(lobby, { headers: CORS })
      const currentSong = lobby.songList[lobby.currentSong]
      if (!currentSong) return Response.json(lobby, { headers: CORS })

      const correct = body.songId === currentSong.id
      if (correct) {
        lobby.roundWinner = body.role // 'host' | 'guest'
        lobby.scores[body.role] = (lobby.scores[body.role] || 0) + 1
        await store.setJSON(`lobby-${code}`, lobby)
      }
      return Response.json({ correct, lobby }, { headers: CORS })
    }

    // ── NEXT SONG ─────────────────────────────────
    if (action === 'next') {
      if (body.hostId !== lobby.hostId) return new Response('Forbidden', { status: 403, headers: CORS })
      lobby.currentSong += 1
      lobby.startAt = null
      lobby.roundWinner = null
      if (lobby.currentSong >= lobby.songList.length) {
        lobby.status = 'finished'
      } else {
        lobby.status = 'ready'
      }
      await store.setJSON(`lobby-${code}`, lobby)
      return Response.json(lobby, { headers: CORS })
    }

    // ── UPDATE PREVIEW URL ────────────────────────
    if (action === 'setpreviews') {
      if (body.hostId !== lobby.hostId) return new Response('Forbidden', { status: 403, headers: CORS })
      const urls = body.previewUrls || {}
      lobby.songList = lobby.songList.map(s => ({
        ...s,
        previewUrl: urls[s.id] || s.previewUrl || '',
      }))
      await store.setJSON(`lobby-${code}`, lobby)
      return Response.json({ ok: true }, { headers: CORS })
    }
  }

  return new Response('Not found', { status: 404, headers: CORS })
}
