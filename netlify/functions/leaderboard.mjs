import { getStore } from '@netlify/blobs'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function getESTDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { headers: CORS })

  const store = getStore('leaderboard')
  const today = getESTDate()
  const key = `day-${today}`

  if (req.method === 'GET') {
    const data = (await store.get(key, { type: 'json' })) ?? []
    const sorted = data.sort((a, b) => b.score - a.score).slice(0, 100)
    return Response.json(sorted, { headers: CORS })
  }

  if (req.method === 'POST') {
    let body
    try { body = await req.json() } catch { return new Response('Bad JSON', { status: 400, headers: CORS }) }

    const existing = (await store.get(key, { type: 'json' })) ?? []
    existing.push({
      username: String(body.username ?? 'Anonymous').trim().slice(0, 24) || 'Anonymous',
      score: Math.min(100, Math.max(0, Math.round(Number(body.score) || 0))),
      totalSongs: Math.max(0, Math.round(Number(body.totalSongs) || 0)),
      timestamp: Date.now(),
    })
    await store.setJSON(key, existing)
    return Response.json({ ok: true }, { headers: CORS })
  }

  return new Response('Method Not Allowed', { status: 405, headers: CORS })
}
