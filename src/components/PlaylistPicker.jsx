import { useState, useEffect, useRef } from 'react'
import { fetchPlaylists, clearToken } from '../utils/spotify.js'
import { getDailyChartMeta } from '../utils/charts.js'
import ModSelector from './ModSelector.jsx'

const MODES = [
  { id: 'song',    label: 'Song Quiz',       icon: '🎵', desc: 'Guess the song' },
  { id: 'album',   label: 'Album Quiz',       icon: '💿', desc: 'Guess the album' },
  { id: 'daily',   label: 'Daily Challenge',  icon: '🏆', desc: 'Global leaderboard' },
  { id: 'onevone', label: '1v1 Battle',        icon: '⚔', desc: 'Challenge a friend' },
]

const DAILY_PLAYLIST_MOCK = getDailyChartMeta()

export default function PlaylistPicker({ token, onSelect, onBattle, onLogout }) {
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [gameMode, setGameMode] = useState('song')
  const [activeMods, setActiveMods] = useState(new Set())
  const [showMods, setShowMods] = useState(false)
  const [pendingPlaylist, setPendingPlaylist] = useState(null)
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
        else setError('Failed to load playlists.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token])

  function handlePlaylistClick(playlist) {
    if (gameMode === 'daily') {
      onSelect({ playlist: DAILY_PLAYLIST_MOCK, gameMode: 'daily', activeMods: new Set() })
      return
    }
    if (gameMode === 'onevone') return
    setPendingPlaylist(playlist)
    setShowMods(true)
  }

  function switchMode(id) {
    if (id === gameMode) return
    setGameMode(id)
    setPendingPlaylist(null)
    setShowMods(false)
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
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filtered = playlists.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-[var(--neon)] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-[var(--muted)] tracking-wider text-sm">Loading playlists…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center px-4">
        <div className="glass rounded-2xl p-8 text-center space-y-4 max-w-sm">
          <p className="text-red-400">{error}</p>
          <button onClick={() => onLogoutRef.current()}
            className="text-[var(--neon)] underline cursor-pointer">Try logging in again</button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen grid-bg px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-4xl text-[var(--neon)] neon-text" style={{ fontFamily: 'Righteous' }}>
              CLIPD
            </h1>
            <button
              onClick={() => { clearToken(); onLogoutRef.current() }}
              className="text-sm text-[var(--muted)] hover:text-white transition-colors cursor-pointer px-3 py-1 rounded-lg"
              style={{ border: '1px solid rgba(255,255,255,0.1)' }}
            >
              Log out
            </button>
          </div>

          {/* Mode tabs */}
          <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl" style={{ background: 'var(--bg-2)' }}>
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => switchMode(m.id)}
                className="relative py-3 px-2 rounded-xl text-center transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neon)]"
                style={{
                  background: gameMode === m.id ? 'var(--bg-3)' : 'transparent',
                  boxShadow: gameMode === m.id ? '0 0 20px rgba(0,255,135,0.15)' : 'none',
                }}
              >
                <div className="text-lg">{m.icon}</div>
                <div
                  className="text-xs font-bold mt-0.5"
                  style={{
                    fontFamily: 'Righteous',
                    color: gameMode === m.id ? 'var(--neon)' : 'var(--muted)',
                  }}
                >
                  {m.label}
                </div>
                {gameMode === m.id && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                       style={{ background: 'var(--neon)', boxShadow: '0 0 8px var(--neon)' }} />
                )}
              </button>
            ))}
          </div>

          {gameMode === 'daily' ? (
            <DailyModePanel onSelect={() => handlePlaylistClick(null)} />
          ) : gameMode === 'onevone' ? (
            <BattleModePanel onBattle={onBattle} />
          ) : (
            <>
              <div
                className="rounded-xl px-4 py-3 flex items-center gap-3"
                style={{
                  background: gameMode === 'album' ? 'rgba(168,85,247,0.08)' : 'rgba(0,255,135,0.06)',
                  border: `1px solid ${gameMode === 'album' ? 'rgba(168,85,247,0.3)' : 'rgba(0,255,135,0.25)'}`,
                }}
              >
                <span className="text-xl">{gameMode === 'album' ? '💿' : '🎵'}</span>
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold" style={{ fontFamily: 'Righteous' }}>
                    {gameMode === 'album' ? 'Album Quiz' : 'Song Quiz'}
                  </p>
                  <p className="text-xs" style={{ color: gameMode === 'album' ? 'var(--purple)' : 'var(--neon)' }}>
                    {gameMode === 'album' ? 'Guess the album from a clip' : 'Guess the song from a clip'}
                  </p>
                </div>
              </div>

              <input
                type="text"
                placeholder={gameMode === 'album' ? 'Search playlists for Album Quiz…' : 'Search playlists for Song Quiz…'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-[var(--neon)]"
                style={{
                  background: 'var(--bg-2)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'var(--text)',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--neon)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
              />

              {filtered.length === 0 ? (
                <p className="text-center text-[var(--muted)] py-12">No playlists found.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {filtered.map((playlist) => {
                    const img = playlist.images?.[0]?.url
                    const count = playlist.tracks?.total ?? 0
                    return (
                      <button
                        key={playlist.id}
                        onClick={() => handlePlaylistClick(playlist)}
                        className="group rounded-xl overflow-hidden text-left transition-all duration-200 cursor-pointer"
                        style={{
                          background: 'var(--bg-2)',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.border = '1px solid rgba(0,255,135,0.4)'
                          e.currentTarget.style.boxShadow = '0 0 20px rgba(0,255,135,0.1)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.border = '1px solid rgba(255,255,255,0.06)'
                          e.currentTarget.style.boxShadow = 'none'
                        }}
                      >
                        <div className="aspect-square bg-[var(--bg-3)] overflow-hidden">
                          {img ? (
                            <img
                              src={img}
                              alt={playlist.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[var(--muted)]">
                              <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/>
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="text-white text-sm font-medium truncate">{playlist.name}</p>
                          <p className="text-[var(--muted)] text-xs mt-0.5">{count} songs</p>
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

function BattleModePanel({ onBattle }) {
  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl p-6 space-y-4"
        style={{ background: 'var(--bg-2)', border: '1px solid rgba(244,114,182,0.3)', boxShadow: '0 0 30px rgba(244,114,182,0.1)' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-4xl">⚔</span>
          <div>
            <h3 className="text-xl text-white" style={{ fontFamily: 'Righteous' }}>1v1 Battle</h3>
            <p className="text-[var(--muted)] text-sm">First to guess wins each round</p>
          </div>
        </div>
        <p className="text-[var(--muted)] text-sm">
          Create a lobby and share your code with a friend. Both of you hear the same clip simultaneously —
          first to guess correctly wins the round. Best of your song list wins the match.
        </p>
        <button
          onClick={onBattle}
          className="w-full py-3 rounded-xl font-bold cursor-pointer transition-all duration-200"
          style={{
            background: 'rgba(244,114,182,0.2)',
            border: '1px solid var(--pink)',
            color: 'var(--pink)',
            fontFamily: 'Righteous',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(244,114,182,0.35)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(244,114,182,0.2)' }}
        >
          Enter Battle Lobby ⚔
        </button>
      </div>
    </div>
  )
}

function DailyModePanel({ onSelect }) {
  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl p-6 space-y-4"
        style={{ background: 'var(--bg-2)', border: '1px solid rgba(168,85,247,0.3)', boxShadow: '0 0 30px rgba(168,85,247,0.1)' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-4xl">🏆</span>
          <div>
            <h3 className="text-xl text-white" style={{ fontFamily: 'Righteous' }}>Daily Challenge</h3>
            <p className="text-[var(--muted)] text-sm">Apple Music Top 50 · Resets at midnight EST</p>
          </div>
        </div>
        <p className="text-[var(--muted)] text-sm">
          Guess 20 songs from today's Apple Music Top 50. One attempt per day.
          Your score is posted to the global leaderboard.
        </p>
        <button
          onClick={onSelect}
          className="w-full py-3 rounded-xl font-bold cursor-pointer transition-all duration-200"
          style={{
            background: 'rgba(168,85,247,0.2)',
            border: '1px solid var(--purple)',
            color: 'var(--purple)',
            fontFamily: 'Righteous',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(168,85,247,0.35)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(168,85,247,0.2)' }}
        >
          Start Daily Challenge →
        </button>
      </div>
    </div>
  )
}
