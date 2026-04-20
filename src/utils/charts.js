// Apple Music RSS — free, no-auth, daily-updated top songs chart.
// Returns a normalized track list compatible with Quiz.jsx.

const CHART_URL = 'https://rss.applemarketingtools.com/api/v2/us/music/most-played/50/songs.json'

let chartCache = null
let chartCacheDate = null

function todayEST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

export async function fetchDailyChart() {
  const today = todayEST()
  if (chartCache && chartCacheDate === today) return chartCache

  const resp = await fetch(CHART_URL)
  if (!resp.ok) throw new Error('Failed to load daily chart.')
  const data = await resp.json()

  const entries = data?.feed?.results ?? []
  const tracks = entries.map((e) => ({
    id: e.id,
    name: e.name,
    artists: [{ name: e.artistName }],
    album: {
      name: e.collectionName || e.name,
      images: [
        { url: e.artworkUrl100?.replace('100x100bb', '600x600bb') || e.artworkUrl100 },
        { url: e.artworkUrl100 },
      ],
    },
  }))

  chartCache = tracks
  chartCacheDate = today
  return tracks
}

export function getDailyChartMeta() {
  return {
    id: 'apple-daily',
    name: 'Apple Music Top 50 · US',
    images: [{ url: 'https://music.apple.com/assets/favicon/favicon-180.png' }],
    tracks: { total: 50 },
  }
}
