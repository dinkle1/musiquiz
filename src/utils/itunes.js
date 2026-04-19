const cache = new Map()

export async function fetchPreviewUrl(title, artist) {
  // Use first artist only for better search results on collabs
  const primaryArtist = artist.split(/[,&]/)[0].trim()
  const key = `${title}||${primaryArtist}`
  if (cache.has(key)) return cache.get(key)

  const term = encodeURIComponent(`${primaryArtist} ${title}`)
  const url = `https://itunes.apple.com/search?term=${term}&entity=song&limit=10&media=music`

  try {
    const resp = await fetch(url)
    if (!resp.ok) { cache.set(key, null); return null }
    const data = await resp.json()
    const results = (data.results || []).filter((r) => r.previewUrl)

    const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const nt = norm(title)
    const na = norm(primaryArtist)

    // Exact title + artist
    let match = results.find((r) => norm(r.trackName) === nt && norm(r.artistName) === na)
    // Exact title only
    if (!match) match = results.find((r) => norm(r.trackName) === nt)
    // Title contains
    if (!match) match = results.find((r) => norm(r.trackName).includes(nt))
    // First available
    if (!match) match = results[0] ?? null

    const previewUrl = match?.previewUrl ?? null
    cache.set(key, previewUrl)
    return previewUrl
  } catch {
    cache.set(key, null)
    return null
  }
}

export function clearPreviewCache() {
  cache.clear()
}
