import { startAuthFlow } from '../utils/spotify.js'

export default function Login({ onJoinBattle }) {
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm space-y-8">

        {/* Logo */}
        <div className="text-center space-y-2">
          <h1 className="text-6xl font-black tracking-tighter text-white">CLIPD</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            How well do you know your playlists?
          </p>
        </div>

        {/* Feature list */}
        <ul className="space-y-3">
          {[
            ['Music note icon', 'Pick any playlist from your Spotify library'],
            ['Headphones icon', 'Hear a 1-second clip — then guess the song'],
            ['Trophy icon',     'Compete in the daily global challenge'],
            ['Sword icon',      'Challenge friends to a 1v1 battle'],
          ].map(([_, text]) => (
            <li key={text} className="flex items-center gap-3 text-sm" style={{ color: 'var(--muted)' }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--green)' }} />
              {text}
            </li>
          ))}
        </ul>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2">
          {['osu! Mods', 'Daily Challenge', 'Global Leaderboard', '1v1 Battle', 'Album Quiz'].map(f => (
            <span key={f} className="px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: 'rgba(29,185,84,0.12)', border: '1px solid rgba(29,185,84,0.35)', color: 'var(--green)' }}>
              {f}
            </span>
          ))}
        </div>

        {/* CTA */}
        {!clientId ? (
          <div className="rounded-lg p-4 text-xs text-red-400"
               style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <strong>Missing config:</strong> Set{' '}
            <code className="bg-red-900/30 px-1 rounded">VITE_SPOTIFY_CLIENT_ID</code> in{' '}
            <code className="bg-red-900/30 px-1 rounded">.env</code>
          </div>
        ) : (
          <button onClick={startAuthFlow}
            className="btn-primary w-full justify-center py-4 text-sm">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            Connect with Spotify
          </button>
        )}

        <p className="text-center text-xs" style={{ color: 'var(--muted)' }}>
          Read-only access · No changes to your library
        </p>

        <div className="text-center space-y-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>No Spotify? Got an invite code?</p>
          <button onClick={onJoinBattle} className="btn-secondary text-sm py-2.5 px-6">
            Join a 1v1 Battle →
          </button>
        </div>
      </div>
    </div>
  )
}
