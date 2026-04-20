import { useEffect, useState } from 'react'
import { startAuthFlow } from '../utils/spotify.js'

export default function Login() {
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID
  const [glitchActive, setGlitchActive] = useState(false)

  useEffect(() => {
    const id = setInterval(() => {
      setGlitchActive(true)
      setTimeout(() => setGlitchActive(false), 400)
    }, 4000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-screen grid-bg flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[var(--purple)] opacity-5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-[var(--neon)] opacity-5 blur-3xl pointer-events-none" />

      <div className="max-w-md w-full space-y-8 relative z-10">
        {/* Title */}
        <div className="text-center space-y-3">
          <div className="relative inline-block">
            <h1
              data-text="CLIPD"
              className={`text-8xl font-bold tracking-widest neon-text text-[var(--neon)] ${glitchActive ? 'glitch-title' : ''}`}
              style={{ fontFamily: 'Righteous, sans-serif' }}
            >
              CLIPD
            </h1>
          </div>
          <p className="text-[var(--muted)] text-sm tracking-[0.3em] uppercase">
            How well do you know your playlists?
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2">
          {['1s clips', 'Fuzzy search', 'osu! Mods', 'Daily Challenge', 'Leaderboard'].map((f) => (
            <span
              key={f}
              className="px-3 py-1 rounded-full text-xs font-medium"
              style={{
                background: 'rgba(168,85,247,0.1)',
                border: '1px solid rgba(168,85,247,0.3)',
                color: 'var(--purple)',
              }}
            >
              {f}
            </span>
          ))}
        </div>

        {/* How it works */}
        <div className="glass rounded-2xl p-5 space-y-3">
          {[
            ['🎵', 'Pick a playlist from your library'],
            ['🎧', 'Hear a short clip — 1 second to start'],
            ['🔍', 'Search and guess the song'],
            ['💀', 'Try mods like Sudden Death or Double Time'],
            ['🏆', 'Compete in the daily global challenge'],
          ].map(([icon, text]) => (
            <div key={text} className="flex items-center gap-3 text-sm text-[var(--muted)]">
              <span className="text-base w-6 text-center">{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>

        {!clientId ? (
          <div className="rounded-xl p-4 text-sm text-red-400"
               style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <strong>Missing config:</strong> Set <code className="bg-red-900/30 px-1 rounded">VITE_SPOTIFY_CLIENT_ID</code> in <code className="bg-red-900/30 px-1 rounded">.env</code>
          </div>
        ) : (
          <button
            onClick={startAuthFlow}
            className="w-full py-4 px-6 rounded-2xl font-bold text-lg text-black transition-all duration-200 flex items-center justify-center gap-3 cursor-pointer neon-pulse"
            style={{ background: 'var(--neon)', fontFamily: 'Righteous, sans-serif' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 40px rgba(0,255,135,0.6)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = ''}
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            Connect with Spotify
          </button>
        )}

        <p className="text-center text-xs text-[var(--muted)]">
          Read-only access · No modifications to your library
        </p>
      </div>
    </div>
  )
}
