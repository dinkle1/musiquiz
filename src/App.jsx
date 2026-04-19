import { useState, useEffect, useCallback } from 'react'
import { exchangeCodeForToken, getStoredToken, clearToken } from './utils/spotify.js'
import { stopCurrentAudio, clearAudioCache } from './utils/audio.js'
import { clearPreviewCache } from './utils/itunes.js'
import Login from './components/Login.jsx'
import PlaylistPicker from './components/PlaylistPicker.jsx'
import Quiz from './components/Quiz.jsx'
import Results from './components/Results.jsx'

export default function App() {
  const [token, setToken] = useState(null)
  const [screen, setScreen] = useState('login') // login | playlists | quiz | results
  const [selectedPlaylist, setSelectedPlaylist] = useState(null)
  const [quizResult, setQuizResult] = useState(null)
  const [authError, setAuthError] = useState(null)

  // Handle OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const error = params.get('error')

    if (error) {
      setAuthError('Spotify login was denied or failed.')
      window.history.replaceState({}, '', '/')
      return
    }

    if (code) {
      window.history.replaceState({}, '', '/')
      exchangeCodeForToken(code)
        .then((t) => {
          setToken(t)
          setScreen('playlists')
        })
        .catch(() => setAuthError('Failed to complete login. Please try again.'))
      return
    }

    // Check stored token
    const stored = getStoredToken()
    if (stored) {
      setToken(stored)
      setScreen('playlists')
    }
  }, [])

  const handleLogout = useCallback(() => {
    clearToken()
    clearAudioCache()
    clearPreviewCache()
    stopCurrentAudio()
    setToken(null)
    setScreen('login')
    setSelectedPlaylist(null)
    setQuizResult(null)
  }, [])

  const handlePlaylistSelect = useCallback((playlist) => {
    setSelectedPlaylist(playlist)
    setScreen('quiz')
  }, [])

  const handleQuizFinish = useCallback((result) => {
    if (!result) {
      setScreen('playlists')
      return
    }
    stopCurrentAudio()
    setQuizResult(result)
    setScreen('results')
  }, [])

  const handleRestart = useCallback(() => {
    clearAudioCache()
    clearPreviewCache()
    setScreen('quiz')
  }, [])

  const handlePickNew = useCallback(() => {
    clearAudioCache()
    clearPreviewCache()
    setSelectedPlaylist(null)
    setScreen('playlists')
  }, [])

  if (authError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 gap-4 px-4">
        <p className="text-red-400 text-center">{authError}</p>
        <button
          onClick={() => setAuthError(null)}
          className="px-6 py-3 bg-green-500 text-black font-bold rounded-full"
        >
          Try again
        </button>
      </div>
    )
  }

  if (screen === 'login') return <Login />

  if (screen === 'playlists') {
    return (
      <PlaylistPicker
        token={token}
        onSelect={handlePlaylistSelect}
        onLogout={handleLogout}
      />
    )
  }

  if (screen === 'quiz' && selectedPlaylist) {
    return (
      <Quiz
        token={token}
        playlist={selectedPlaylist}
        onFinish={handleQuizFinish}
        onLogout={handleLogout}
      />
    )
  }

  if (screen === 'results' && quizResult) {
    return (
      <Results
        songList={quizResult.songList}
        results={quizResult.results}
        playlist={quizResult.playlist}
        onRestart={handleRestart}
        onPickNew={handlePickNew}
      />
    )
  }

  return <Login />
}
