import { useState, useEffect, useRef, useCallback } from 'react'
import { getLobby, startRound, submitGuess, nextSong } from '../utils/lobby.js'
import { playClip, stopCurrentAudio, setVolume, getVolume } from '../utils/audio.js'
import Autocomplete from './Autocomplete.jsx'

const POLL_MS = 600

function Countdown({ startAt }) {
  const [remaining, setRemaining] = useState(null)
  useEffect(() => {
    const update = () => {
      const ms = startAt - Date.now()
      setRemaining(ms > 0 ? Math.ceil(ms / 1000) : 0)
    }
    update()
    const id = setInterval(update, 100)
    return () => clearInterval(id)
  }, [startAt])
  if (remaining === null || remaining === 0) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div
        className="text-9xl font-black tier-pop"
        key={remaining}
        style={{ fontFamily: 'Righteous', color: 'var(--neon)', textShadow: '0 0 40px rgba(0,255,135,0.8)' }}
      >
        {remaining}
      </div>
    </div>
  )
}

export default function OneVOne({ code, role, playerId, playerName, onBack }) {
  const [lobby, setLobby] = useState(null)
  const [error, setError] = useState(null)
  const [selectedSong, setSelectedSong] = useState(null)
  const [guessResult, setGuessResult] = useState(null) // 'win'|'lose'|null
  const [isPlaying, setIsPlaying] = useState(false)
  const [clipStarted, setClipStarted] = useState(false)
  const [volume, setVolumeState] = useState(getVolume())
  const [copied, setCopied] = useState(false)
  const clipStartedAtRef = useRef(null)
  const prevStatusRef = useRef(null)
  const prevSongRef = useRef(null)
  const pollRef = useRef(null)

  const currentSong = lobby?.songList?.[lobby?.currentSong]
  const isHost = role === 'host'
  const myScore = role === 'host' ? lobby?.scores?.host ?? 0 : lobby?.scores?.guest ?? 0
  const theirScore = role === 'host' ? lobby?.scores?.guest ?? 0 : lobby?.scores?.host ?? 0
  const theirName = role === 'host' ? lobby?.guestName : lobby?.hostName

  // Poll lobby state
  const poll = useCallback(async () => {
    const data = await getLobby(code)
    if (!data || data.error) { setError('Lobby not found.'); return }
    setLobby(data)

    // Detect song change → reset round state
    if (data.currentSong !== prevSongRef.current) {
      prevSongRef.current = data.currentSong
      setSelectedSong(null)
      setGuessResult(null)
      setClipStarted(false)
      clipStartedAtRef.current = null
      stopCurrentAudio()
    }

    // Detect round start → play clip
    if (data.startAt && !clipStartedAtRef.current) {
      clipStartedAtRef.current = data.startAt
      const delay = data.startAt - Date.now()
      if (delay > 0) {
        setTimeout(() => playRoundClip(data), delay)
      } else {
        playRoundClip(data)
      }
    }

    // If round over but we're still "playing"
    if (data.roundWinner && guessResult === null) {
      const won = data.roundWinner === role
      setGuessResult(won ? 'win' : 'lose')
      stopCurrentAudio()
    }
  }, [code, role, guessResult])

  async function playRoundClip(data) {
    const song = data.songList?.[data.currentSong]
    if (!song?.previewUrl) { setClipStarted(true); return }
    setClipStarted(true)
    setIsPlaying(true)
    // Calculate how much time has already elapsed (for desync recovery)
    const elapsed = Math.max(0, (Date.now() - data.startAt) / 1000)
    await playClip(song.previewUrl, elapsed, 30 - elapsed)
    setIsPlaying(false)
  }

  useEffect(() => {
    poll()
    pollRef.current = setInterval(poll, POLL_MS)
    return () => { clearInterval(pollRef.current); stopCurrentAudio() }
  }, [poll])

  async function handleSubmitGuess() {
    if (!selectedSong || guessResult) return
    const { correct, lobby: updated } = await submitGuess(code, { role, songId: selectedSong.id })
    if (correct) {
      setGuessResult('win')
      stopCurrentAudio()
    } else {
      setGuessResult('wrong-guess') // different from 'lose' — wrong guess, keep trying
      setTimeout(() => setGuessResult(null), 800)
      setSelectedSong(null)
    }
    if (updated) setLobby(updated)
  }

  async function handleStartRound() {
    if (!isHost) return
    const updated = await startRound(code, playerId)
    setLobby(updated)
  }

  async function handleNextSong() {
    if (!isHost) return
    stopCurrentAudio()
    const updated = await nextSong(code, playerId)
    setLobby(updated)
  }

  function handleVolumeChange(e) {
    const v = parseFloat(e.target.value)
    setVolumeState(v)
    setVolume(v)
  }

  function copyCode() {
    navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  if (error) {
    return (
      <div className="min-h-screen grid-bg flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-red-400">{error}</p>
        <button onClick={onBack} className="text-[var(--neon)] underline cursor-pointer">Go back</button>
      </div>
    )
  }

  if (!lobby) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[var(--pink)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const total = lobby.songList?.length ?? 0
  const songNum = lobby.currentSong + 1
  const progress = total > 0 ? (lobby.currentSong / total) * 100 : 0

  // Waiting for guest to join
  if (lobby.status === 'waiting') {
    return (
      <div className="min-h-screen grid-bg flex flex-col items-center justify-center gap-6 px-4">
        <div className="text-center space-y-2">
          <h2 className="text-3xl" style={{ fontFamily: 'Righteous', color: 'var(--pink)' }}>Waiting for opponent…</h2>
          <p className="text-[var(--muted)] text-sm">Share this code with your friend</p>
        </div>
        <button
          onClick={copyCode}
          className="text-6xl font-black tracking-widest cursor-pointer hover:scale-105 transition-transform"
          style={{ fontFamily: 'Righteous', color: 'var(--neon)', textShadow: '0 0 30px rgba(0,255,135,0.5)' }}
        >
          {code}
        </button>
        {copied && <p className="text-[var(--neon)] text-sm">Copied!</p>}
        <div className="w-8 h-8 border-2 border-[var(--pink)] border-t-transparent rounded-full animate-spin" />
        <button onClick={onBack} className="text-[var(--muted)] hover:text-white transition-colors cursor-pointer text-sm">Cancel</button>
      </div>
    )
  }

  // Finished
  if (lobby.status === 'finished') {
    const iWon = myScore > theirScore
    const tied = myScore === theirScore
    return (
      <div className="min-h-screen grid-bg flex flex-col items-center justify-center gap-6 px-4">
        <div className="text-center space-y-4 slide-up">
          <div className="text-7xl">{tied ? '🤝' : iWon ? '🏆' : '💀'}</div>
          <h2
            className="text-5xl"
            style={{
              fontFamily: 'Righteous',
              color: tied ? 'var(--amber)' : iWon ? 'var(--neon)' : 'var(--red)',
            }}
          >
            {tied ? "IT'S A TIE!" : iWon ? 'YOU WIN!' : 'YOU LOSE!'}
          </h2>
          <div className="flex gap-6 justify-center text-center">
            <div>
              <div className="text-4xl font-black" style={{ fontFamily: 'Righteous', color: 'var(--neon)' }}>{myScore}</div>
              <div className="text-sm text-[var(--muted)]">{playerName}</div>
            </div>
            <div className="text-2xl self-center text-[var(--muted)]">vs</div>
            <div>
              <div className="text-4xl font-black" style={{ fontFamily: 'Righteous', color: 'var(--pink)' }}>{theirScore}</div>
              <div className="text-sm text-[var(--muted)]">{theirName}</div>
            </div>
          </div>
        </div>
        <button onClick={onBack}
          className="px-8 py-3 rounded-xl font-bold cursor-pointer"
          style={{ background: 'var(--neon)', color: 'black', fontFamily: 'Righteous' }}>
          Back to Menu
        </button>
      </div>
    )
  }

  const roundOver = !!lobby.roundWinner
  const roundWinnerName = lobby.roundWinner === 'host' ? lobby.hostName : lobby.guestName
  const iWonRound = lobby.roundWinner === role

  return (
    <div className="min-h-screen grid-bg flex flex-col" style={{ fontFamily: 'Poppins, sans-serif' }}>
      {lobby.startAt && <Countdown startAt={lobby.startAt} />}

      {/* Wrong guess flash */}
      {guessResult === 'wrong-guess' && (
        <div className="fixed inset-0 pointer-events-none z-40 correct-flash" style={{ background: 'rgba(239,68,68,0.15)' }} />
      )}

      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Scores */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-center">
            <div className="text-xl font-black" style={{ fontFamily: 'Righteous', color: 'var(--neon)' }}>{myScore}</div>
            <div className="text-xs text-[var(--muted)] truncate max-w-16">{playerName}</div>
          </div>
          <div className="text-[var(--muted)] px-2" style={{ fontFamily: 'Righteous' }}>vs</div>
          <div className="text-center">
            <div className="text-xl font-black" style={{ fontFamily: 'Righteous', color: 'var(--pink)' }}>{theirScore}</div>
            <div className="text-xs text-[var(--muted)] truncate max-w-16">{theirName || '…'}</div>
          </div>
        </div>

        {/* Progress */}
        <div className="flex-1 min-w-0 mx-2">
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-3)' }}>
            <div className="h-full rounded-full transition-all duration-500"
                 style={{ width: `${progress}%`, background: 'var(--pink)', boxShadow: '0 0 8px var(--pink)' }} />
          </div>
          <p className="text-xs text-[var(--muted)] mt-1 text-center">{songNum}/{total}</p>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <svg className="w-3.5 h-3.5 text-[var(--muted)]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
          </svg>
          <input type="range" min="0" max="1" step="0.05" value={volume} onChange={handleVolumeChange} className="w-16" />
        </div>
      </div>

      {/* Code badge */}
      <div className="text-center py-1">
        <button onClick={copyCode}
          className="text-xs cursor-pointer transition-colors"
          style={{ color: copied ? 'var(--neon)' : 'var(--muted)', fontFamily: 'Righteous' }}>
          {copied ? 'Copied!' : `Code: ${code}`}
        </button>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 gap-5">

        {/* Album art */}
        <div className="relative w-48 h-48 rounded-2xl overflow-hidden flex items-center justify-center"
             style={{ background: 'var(--bg-2)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {currentSong?.albumArt ? (
            <img
              src={currentSong.albumArt}
              alt=""
              className={roundOver ? 'bloom w-full h-full object-cover' : 'w-full h-full object-cover'}
              style={!roundOver ? { filter: 'blur(22px) brightness(0.5) saturate(0.5)', transform: 'scale(1.1)' } : {}}
            />
          ) : (
            <svg className="w-16 h-16 opacity-20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/>
            </svg>
          )}

          {/* Waveform when playing */}
          {isPlaying && !roundOver && (
            <div className="absolute inset-0 flex items-center justify-center gap-1" style={{ zIndex: 2 }}>
              {[18,28,22,32,20,26,24,30,16].map((h, i) => (
                <div key={i} className="wave-bar"
                  style={{ '--h': `${h}px`, height: '4px', animationDelay: `${i*0.09}s`, animationDuration: `${0.6+i*0.05}s` }} />
              ))}
            </div>
          )}
        </div>

        {/* Round result */}
        {roundOver && (
          <div className="text-center slide-up space-y-1">
            <div
              className="text-2xl font-bold"
              style={{ fontFamily: 'Righteous', color: iWonRound ? 'var(--neon)' : 'var(--pink)' }}
            >
              {iWonRound ? '🎯 You got it!' : `${roundWinnerName} got it!`}
            </div>
            <div className="text-white">{currentSong?.title}</div>
            <div className="text-sm" style={{ color: 'var(--muted)' }}>{currentSong?.artist}</div>
          </div>
        )}

        {/* Waiting states */}
        {lobby.status === 'ready' && !lobby.startAt && (
          <div className="text-center space-y-4 w-full max-w-md slide-up">
            {isHost ? (
              <button
                onClick={handleStartRound}
                className="w-full py-4 rounded-xl font-bold text-black cursor-pointer transition-all"
                style={{ background: 'var(--pink)', fontFamily: 'Righteous', boxShadow: '0 0 24px rgba(244,114,182,0.4)' }}
              >
                ▶ Start Round {songNum}
              </button>
            ) : (
              <div className="flex items-center justify-center gap-3 text-[var(--muted)]">
                <div className="w-4 h-4 border-2 border-[var(--pink)] border-t-transparent rounded-full animate-spin" />
                Waiting for {lobby.hostName} to start…
              </div>
            )}
          </div>
        )}

        {/* Clip playing — guess input */}
        {clipStarted && !roundOver && lobby.startAt && (
          <div className="w-full max-w-md space-y-3 slide-up">
            <Autocomplete
              songs={lobby.songList || []}
              onSelect={setSelectedSong}
              disabled={!!guessResult && guessResult !== 'wrong-guess'}
              placeholder="Who's first? Search for the song…"
            />
            <button
              onClick={handleSubmitGuess}
              disabled={!selectedSong}
              className="w-full py-3 rounded-xl font-bold cursor-pointer transition-all disabled:opacity-40"
              style={{
                background: selectedSong ? 'var(--pink)' : 'var(--bg-3)',
                color: selectedSong ? 'black' : 'var(--muted)',
                fontFamily: 'Righteous',
                boxShadow: selectedSong ? '0 0 20px rgba(244,114,182,0.4)' : 'none',
              }}
            >
              Submit Guess ⚡
            </button>
            {guessResult === 'win' && (
              <p className="text-center font-bold text-[var(--neon)]" style={{ fontFamily: 'Righteous' }}>
                🎯 Correct — waiting for server…
              </p>
            )}
          </div>
        )}

        {/* Round over — next button (host only) */}
        {roundOver && (
          <div className="w-full max-w-md slide-up">
            {isHost ? (
              <button
                onClick={handleNextSong}
                className="w-full py-3 rounded-xl font-bold text-black cursor-pointer transition-all"
                style={{ background: 'var(--neon)', fontFamily: 'Righteous' }}
              >
                {lobby.currentSong + 1 >= total ? 'Finish Match →' : 'Next Song →'}
              </button>
            ) : (
              <p className="text-center text-[var(--muted)] text-sm">
                Waiting for {lobby.hostName} to continue…
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
