// Deezer Top Chart — proxied via Netlify function (avoids CORS).
// Tracks include previewUrl directly — no iTunes Search needed.

let cache = null
let cacheDate = null

function todayEST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

export async function fetchDailyChart() {
  const today = todayEST()
  if (cache && cacheDate === today) return cache

  const resp = await fetch('/.netlify/functions/chart')
  if (!resp.ok) throw new Error('Failed to load daily chart.')
  const tracks = await resp.json()
  if (tracks.error) throw new Error(tracks.error)

  cache = tracks
  cacheDate = today
  return tracks
}

export function getDailyChartMeta() {
  return {
    id: 'deezer-daily',
    name: 'Deezer Top 50',
    images: [{ url: '' }],
    tracks: { total: 50 },
  }
}
