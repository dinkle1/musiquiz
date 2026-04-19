import { startAuthFlow } from '../utils/spotify.js'

export default function Login() {
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-950">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="space-y-3">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-green-500 mb-2">
            <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/>
            </svg>
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-white">Clipd</h1>
          <p className="text-lg text-gray-400">
            How well do you know your Spotify playlists?
          </p>
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 space-y-4 text-left">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">How it works</h2>
          <ul className="space-y-3">
            {[
              ['🎵', 'Pick a playlist from your Spotify library'],
              ['🎧', 'Hear a 1-second audio clip from each song'],
              ['🔍', 'Type your guess — fuzzy search helps you find it'],
              ['📊', 'See how well you really know your music'],
            ].map(([icon, text]) => (
              <li key={text} className="flex items-start gap-3 text-gray-300">
                <span className="text-xl">{icon}</span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {!clientId ? (
          <div className="bg-red-900/40 border border-red-700 rounded-xl p-4 text-sm text-red-300">
            <strong>Missing config:</strong> Set <code className="bg-red-900/50 px-1 rounded">VITE_SPOTIFY_CLIENT_ID</code> in your <code className="bg-red-900/50 px-1 rounded">.env</code> file.
          </div>
        ) : (
          <button
            onClick={startAuthFlow}
            className="w-full py-4 px-6 bg-green-500 hover:bg-green-400 active:bg-green-600 text-black font-bold text-lg rounded-full transition-colors duration-150 flex items-center justify-center gap-3"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            Connect with Spotify
          </button>
        )}

        <p className="text-xs text-gray-600">
          We only read your playlists — we never modify anything.
        </p>
      </div>
    </div>
  )
}
