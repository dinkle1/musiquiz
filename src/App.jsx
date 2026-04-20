import { useState, useEffect, useCallback } from 'react'
import { exchangeCodeForToken, getStoredToken, clearToken } from './utils/spotify.js'
import { stopCurrentAudio, clearAudioCache } from './utils/audio.js'
import { clearPreviewCache } from './utils/itunes.js'
import Login from './components/Login.jsx'
import PlaylistPicker from './components/PlaylistPicker.jsx'
import Quiz from './components/Quiz.jsx'
import Results from './components/Results.jsx'
import Leaderboard from './components/Leaderboard.jsx'
import Lobby from './components/Lobby.jsx'
import OneVOne from './components/OneVOne.jsx'

export default function App() {
  const [token, setToken] = useState(null)
  const [screen, setScreen] = useState('login') // login | playlists | quiz | results | leaderboard | lobby | onevone
  const [selectedPlaylist, setSelectedPlaylist] = useState(null)
  const [gameMode, setGameMode] = useState('song')
  const [activeMods, setActiveMods] = useState(new Set())
  const [quizResult, setQuizResult] = useState(null)
  const [leaderboardData, setLeaderboardData] = useState(null) // { score, totalSongs }
  const [lobbyInfo, setLobbyInfo] = useState(null) // { code, role, playerId, playerName }
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
    setLobbyInfo(null)
    setLeaderboardData(null)
    setGameMode('song')
    setActiveMods(new Set())
  }, [])

  const handlePlaylistSelect = useCallback(({ playlist, gameMode: mode, activeMods: mods }) => {
    setSelectedPlaylist(playlist)
    setGameMode(mode)
    setActiveMods(mods)
    setScreen('quiz')
  }, [])

  const handleBattle = useCallback(() => {
    setScreen('lobby')
  }, [])

  const handleJoinBattle = useCallback(() => {
    setScreen('lobby-join')
  }, [])

  const handleLobbyReady = useCallback((info) => {
    setLobbyInfo(info)
    setScreen('onevone')
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

  const handleLeaderboard = useCallback((score, totalSongs) => {
    setLeaderboardData({ score, totalSongs })
    setScreen('leaderboard')
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
    setGameMode('song')
    setActiveMods(new Set())
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

  if (screen === 'login') return <Login onJoinBattle={handleJoinBattle} />

  if (screen === 'playlists') {
    return (
      <PlaylistPicker
        token={token}
        onSelect={handlePlaylistSelect}
        onBattle={handleBattle}
        onLogout={handleLogout}
      />
    )
  }

  if (screen === 'quiz' && selectedPlaylist) {
    return (
      <Quiz
        key={`${selectedPlaylist.id}-${gameMode}`}
        token={token}
        playlist={selectedPlaylist}
        gameMode={gameMode}
        activeMods={activeMods}
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
        gameMode={gameMode}
        activeMods={activeMods}
        onRestart={handleRestart}
        onPickNew={handlePickNew}
        onLeaderboard={handleLeaderboard}
      />
    )
  }

  if (screen === 'leaderboard') {
    return (
      <Leaderboard
        pendingScore={leaderboardData?.score ?? null}
        totalSongs={leaderboardData?.totalSongs ?? 0}
        onBack={() => setScreen('playlists')}
      />
    )
  }

  if (screen === 'lobby') {
    return (
      <Lobby
        token={token}
        onLobbyReady={handleLobbyReady}
        onBack={() => setScreen('playlists')}
      />
    )
  }

  if (screen === 'lobby-join') {
    return (
      <Lobby
        token={null}
        joinOnly
        onLobbyReady={handleLobbyReady}
        onBack={() => setScreen('login')}
      />
    )
  }

  if (screen === 'onevone' && lobbyInfo) {
    return (
      <OneVOne
        code={lobbyInfo.code}
        role={lobbyInfo.role}
        playerId={lobbyInfo.playerId}
        playerName={lobbyInfo.playerName}
        onBack={() => setScreen('playlists')}
      />
    )
  }

  return <Login />
}
