import { useState, useEffect, useRef } from 'react'
import { fetchPlaylists, clearToken } from '../utils/spotify.js'
import { getDailyChartMeta } from '../utils/charts.js'
import ModSelector from './ModSelector.jsx'

const MODES = [
  { id: 'song',    label: 'Song Quiz',       desc: 'Guess the song' },
  { id: 'album',   label: 'Album Quiz',       desc: 'Guess the album' },
  { id: 'daily',   label: 'Daily Challenge',  desc: 'Global leaderboard' },
  { id: 'onevone', label: '1v1 Battle',        desc: 'Challenge a friend' },
]

const DAILY_PLAYLIST_MOCK = getDailyChartMeta()

export default function PlaylistPicker({ token, onSelect, onBattle, onLogout }) {
  const [playlists, setPlaylists]         = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [search, setSearch]               = useState('')
  const [gameMode, setGameMode]           = useState('song')
  const [activeMods, setActiveMods]       = useState(new Set())
  const [showMods, setShowMods]           = useState(false)
  const [pendingPlaylist, setPendingPlaylist] = useState(null)
  const onLogoutRef = useRef(onLogout)
  onLogoutRef.current = onLogout

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchPlaylists(token)
      .then(data => { if (!cancelled) setPlaylists(data) })
      .catch(err => {
        if (cancelled) return
        if (err.message === 'UNAUTHORIZED') onLogoutRef.current()
        else setError('Failed to load playlists.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token])

  function switchMode(id) {
    if (id === gameMode) return
    setGameMode(id)
    setPendingPlaylist(null)
    setShowMods(false)
  }

  function handlePlaylistClick(playlist) {
    if (gameMode === 'daily') {
      onSelect({ playlist: DAILY_PLAYLIST_MOCK, gameMode: 'daily', activeMods: new Set() })
      return
    }
    if (gameMode === 'onevone') { onBattle(); return }
    setPendingPlaylist(playlist)
    setShowMods(true)
  }

  function handleModConfirm() {
    setShowMods(false)
    if (pendingPlaylist) {
      onSelect({ playlist: pendingPlaylist, gameMode, activeMods })
      setPendingPlaylist(null)
    }
  }

  function toggleMod(id) {
    setActiveMods(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const filtered = playlists.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-2 border-[var(--green)] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading your library…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--bg)' }}>
        <div className="rounded-lg p-8 text-center space-y-4 max-w-sm" style={{ background: 'var(--bg-card)' }}>
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={() => onLogoutRef.current()} className="btn-secondary text-sm py-2 px-6">
            Try logging in again
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-black tracking-tight text-white">CLIPD</h1>
            <button
              onClick={() => { clearToken(); onLogoutRef.current() }}
              className="btn-icon text-sm px-3 py-1.5 rounded"
              style={{ border: '1px solid var(--border)' }}>
              Log out
            </button>
          </div>

          {/* Mode tabs */}
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-card)' }}>
            {MODES.map(m => (
              <button key={m.id} onClick={() => switchMode(m.id)}
                className="flex-1 py-2 px-3 rounded text-xs font-bold transition-all duration-200 cursor-pointer"
                style={{
                  background: gameMode === m.id ? 'var(--bg-hover)' : 'transparent',
                  color: gameMode === m.id ? 'var(--text)' : 'var(--muted)',
                }}>
                {m.label}
              </button>
            ))}
          </div>

          {/* Content */}
          {gameMode === 'daily' ? (
            <DailyPanel onSelect={() => handlePlaylistClick(null)} />
          ) : gameMode === 'onevone' ? (
            <BattlePanel onBattle={onBattle} />
          ) : (
            <>
              {/* Mode context banner */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg"
                   style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">
                    {gameMode === 'album' ? 'Album Quiz' : 'Song Quiz'}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    {gameMode === 'album'
                      ? 'Hear a clip — guess the album name'
                      : 'Hear a clip — guess the song title'}
                  </p>
                </div>
                <div className="w-2 h-2 rounded-full" style={{ background: 'var(--green)' }} />
              </div>

              {/* Search */}
              <div className="relative">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                     style={{ color: 'var(--muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search your playlists…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="sp-input pl-10"
                />
              </div>

              {/* Card grid */}
              {filtered.length === 0 ? (
                <p className="text-center py-16 text-sm" style={{ color: 'var(--muted)' }}>No playlists found.</p>
              ) : (
                <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                  {filtered.map(playlist => {
                    const img   = playlist.images?.[0]?.url
                    const count = playlist.tracks?.total ?? 0
                    return (
                      <button key={playlist.id} onClick={() => handlePlaylistClick(playlist)}
                        className="sp-card text-left group">
                        <div className="aspect-square rounded overflow-hidden mb-3" style={{ borderRadius: '4px' }}>
                          {img ? (
                            <img src={img} alt={playlist.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--bg-hover)' }}>
                              <svg className="w-10 h-10 opacity-30" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/>
                              </svg>
                            </div>
                          )}
                        </div>
                        <p className="text-white text-sm font-bold truncate">{playlist.name}</p>
                        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted)' }}>{count} songs</p>

                        {/* Hover play button */}
                        <div className="sp-card__play">
                          <svg className="w-5 h-5 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showMods && (
        <ModSelector
          activeMods={activeMods}
          onToggle={toggleMod}
          onClose={() => { setShowMods(false); setPendingPlaylist(null) }}
          onConfirm={handleModConfirm}
        />
      )}
    </>
  )
}

function BattlePanel({ onBattle }) {
  return (
    <div className="rounded-lg p-6 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div>
        <h3 className="text-xl font-black text-white tracking-tight">1v1 Battle</h3>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>First to guess wins each round</p>
      </div>
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        Create a lobby and share your code with a friend. Both of you hear the same clip simultaneously —
        first to guess correctly wins the round.
      </p>
      <button onClick={onBattle} className="btn-primary py-3 px-8">
        Enter Battle Lobby
      </button>
    </div>
  )
}

function DailyPanel({ onSelect }) {
  return (
    <div className="rounded-lg p-6 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div>
        <h3 className="text-xl font-black text-white tracking-tight">Daily Challenge</h3>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Deezer Top 50 · Resets at midnight EST</p>
      </div>
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        Guess 20 songs from today's chart. One attempt per day.
        Your score is posted to the global leaderboard.
      </p>
      <button onClick={onSelect} className="btn-primary py-3 px-8">
        Start Daily Challenge
      </button>
    </div>
  )
}
