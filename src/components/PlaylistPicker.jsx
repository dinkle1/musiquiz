import { useState, useEffect, useRef } from 'react'
import { fetchPlaylists, clearToken } from '../utils/spotify.js'

export default function PlaylistPicker({ token, onSelect, onLogout }) {
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const onLogoutRef = useRef(onLogout)
  onLogoutRef.current = onLogout

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchPlaylists(token)
      .then((data) => { if (!cancelled) setPlaylists(data) })
      .catch((err) => {
        if (cancelled) return
        if (err.message === 'UNAUTHORIZED') onLogoutRef.current()
        else setError('Failed to load playlists. Please try again.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token])

  const filtered = playlists.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400">Loading your playlists…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
        <div className="text-center space-y-4">
          <p className="text-red-400">{error}</p>
          <button onClick={onLogout} className="text-green-500 underline">
            Try logging in again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Clipd</h1>
            <p className="text-gray-400 mt-1">Pick a playlist to get quizzed</p>
          </div>
          <button
            onClick={() => { clearToken(); onLogout() }}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            Log out
          </button>
        </div>

        <input
          type="text"
          placeholder="Search playlists…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500"
        />

        {filtered.length === 0 ? (
          <p className="text-center text-gray-500 py-12">No playlists found.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filtered.map((playlist) => {
              const img = playlist.images?.[0]?.url
              const count = playlist.tracks?.total ?? 0
              return (
                <button
                  key={playlist.id}
                  onClick={() => onSelect(playlist)}
                  className="group bg-gray-900 hover:bg-gray-800 rounded-xl overflow-hidden transition-colors duration-150 text-left"
                >
                  <div className="aspect-square bg-gray-800 overflow-hidden">
                    {img ? (
                      <img
                        src={img}
                        alt={playlist.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600">
                        <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/>
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-white text-sm font-medium truncate">{playlist.name}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{count} songs</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
