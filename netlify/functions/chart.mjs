const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=3600',
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { headers: CORS })

  try {
    const resp = await fetch('https://api.deezer.com/chart/0/tracks?limit=50')
    if (!resp.ok) throw new Error(`Deezer ${resp.status}`)
    const data = await resp.json()

    const tracks = (data.data || [])
      .filter(t => t.preview) // only tracks with preview URLs
      .map(t => ({
        id: String(t.id),
        name: t.title,
        artists: [{ name: t.artist?.name || '' }],
        album: {
          name: t.album?.title || t.title,
          images: [
            { url: t.album?.cover_xl || t.album?.cover_big || t.album?.cover_medium || '' },
            { url: t.album?.cover_medium || '' },
          ],
        },
        previewUrl: t.preview,
      }))

    return Response.json(tracks, { headers: CORS })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 502, headers: CORS })
  }
}
