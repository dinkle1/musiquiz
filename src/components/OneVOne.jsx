import { useState, useEffect, useRef, useCallback } from 'react'
import { getLobby, startRound, submitGuess, nextSong } from '../utils/lobby.js'
import { playClip, stopCurrentAudio, setVolume, getVolume } from '../utils/audio.js'
import Autocomplete from './Autocomplete.jsx'

const POLL_MS          = 600
const AUTO_START_SECS  = 10

function Countdown({ startAt }) {
  const [remaining, setRemaining] = useState(null)
  useEffect(() => {
    const update = () => {
      const ms = startAt - Date.now()
      setRemaining(ms > 0 ? Math.ceil(ms / 1000) : 0)
    }
    update()
    const id = setInterval(update, 200)
    return () => clearInterval(id)
  }, [startAt])
  if (!remaining) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="text-9xl font-black text-white tier-pop" key={remaining}
           style={{ textShadow: '0 0 40px rgba(29,185,84,0.8)' }}>
        {remaining}
      </div>
    </div>
  )
}

export default function OneVOne({ code, role, playerId, playerName, onBack }) {
  const [lobby, setLobby]             = useState(null)
  const [error, setError]             = useState(null)
  const [selectedSong, setSelectedSong] = useState(null)
  const [guessResult, setGuessResult] = useState(null) // 'win'|'lose'|'wrong'|null
  const [isPlaying, setIsPlaying]     = useState(false)
  const [clipStarted, setClipStarted] = useState(false)
  const [volume, setVolumeState]      = useState(getVolume())
  const [copied, setCopied]           = useState(false)
  const [autoCountdown, setAutoCountdown] = useState(null) // seconds remaining for auto-start
  const [isPaused, setIsPaused]       = useState(false)
  const [isAdvancing, setIsAdvancing] = useState(false)

  const clipStartedAtRef  = useRef(null)
  const prevSongRef       = useRef(null)
  const pollRef           = useRef(null)
  const autoTimerRef      = useRef(null)
  const lobbyRef          = useRef(null) // stable ref to latest lobby

  const isHost    = role === 'host'
  const lobby_    = lobby
  const myScore   = role === 'host' ? lobby_?.scores?.host ?? 0 : lobby_?.scores?.guest ?? 0
  const theirScore = role === 'host' ? lobby_?.scores?.guest ?? 0 : lobby_?.scores?.host ?? 0
  const theirName = role === 'host' ? lobby_?.guestName : lobby_?.hostName
  const currentSong = lobby_?.songList?.[lobby_?.currentSong]
  const total     = lobby_?.songList?.length ?? 0
  const songNum   = (lobby_?.currentSong ?? 0) + 1
  const roundOver = !!lobby_?.roundWinner

  // Keep lobbyRef in sync
  useEffect(() => { lobbyRef.current = lobby_ }, [lobby_])

  // Clear auto-timer on unmount
  useEffect(() => () => {
    clearInterval(autoTimerRef.current)
    stopCurrentAudio()
  }, [])

  // Auto-start countdown (host only, when round is over and not the last song)
  useEffect(() => {
    if (!isHost || !roundOver || isPaused || isAdvancing) return
    const lob = lobbyRef.current
    if (!lob || lob.status === 'finished') return
    const isLast = (lob.currentSong ?? 0) + 1 >= total
    if (isLast) return

    let secs = AUTO_START_SECS
    setAutoCountdown(secs)

    autoTimerRef.current = setInterval(() => {
      secs--
      setAutoCountdown(secs)
      if (secs <= 0) {
        clearInterval(autoTimerRef.current)
        setAutoCountdown(null)
        autoAdvance()
      }
    }, 1000)

    return () => { clearInterval(autoTimerRef.current); setAutoCountdown(null) }
  }, [roundOver, isPaused]) // re-run when pause toggled or round changes

  async function autoAdvance() {
    if (isAdvancing) return
    setIsAdvancing(true)
    try {
      const updated = await nextSong(code, playerId)
      setLobby(updated)
      // Short delay then start round
      await new Promise(r => setTimeout(r, 400))
      const started = await startRound(code, playerId)
      setLobby(started)
    } catch { /* poll will recover */ }
    setIsAdvancing(false)
    setIsPaused(false)
    setGuessResult(null)
    setSelectedSong(null)
  }

  function handlePause() {
    clearInterval(autoTimerRef.current)
    setAutoCountdown(null)
    setIsPaused(true)
  }

  function handleResume() {
    setIsPaused(false)
    // The useEffect will restart the countdown when isPaused flips
  }

  // Poll loop
  const poll = useCallback(async () => {
    const data = await getLobby(code)
    if (!data || data.error) { setError('Lobby not found.'); return }

    // Detect song change → reset round state
    if (data.currentSong !== prevSongRef.current) {
      prevSongRef.current = data.currentSong
      setSelectedSong(null)
      setGuessResult(null)
      setClipStarted(false)
      setAutoCountdown(null)
      setIsPaused(false)
      setIsAdvancing(false)
      clearInterval(autoTimerRef.current)
      clipStartedAtRef.current = null
      stopCurrentAudio()
    }

    setLobby(data)

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

    // Detect round winner from server (if we haven't set it locally)
    if (data.roundWinner && guessResult === null) {
      setGuessResult(data.roundWinner === role ? 'win' : 'lose')
      stopCurrentAudio()
    }
  }, [code, role, guessResult])

  async function playRoundClip(data) {
    const song = data.songList?.[data.currentSong]
    if (!song?.previewUrl) { setClipStarted(true); return }
    setClipStarted(true)
    setIsPlaying(true)
    const elapsed = Math.max(0, (Date.now() - data.startAt) / 1000)
    await playClip(song.previewUrl, elapsed, 30 - elapsed)
    setIsPlaying(false)
  }

  useEffect(() => {
    poll()
    pollRef.current = setInterval(poll, POLL_MS)
    return () => clearInterval(pollRef.current)
  }, [poll])

  async function handleSubmitGuess() {
    if (!selectedSong || (guessResult && guessResult !== 'wrong')) return
    const { correct, lobby: updated } = await submitGuess(code, { role, songId: selectedSong.id })
    if (correct) {
      setGuessResult('win')
      stopCurrentAudio()
    } else {
      setGuessResult('wrong')
      setTimeout(() => { setGuessResult(null); setSelectedSong(null) }, 700)
    }
    if (updated) setLobby(updated)
  }

  async function handleStartRound() {
    if (!isHost) return
    const updated = await startRound(code, playerId)
    setLobby(updated)
  }

  async function handleNextSong() {
    if (!isHost || isAdvancing) return
    clearInterval(autoTimerRef.current)
    setAutoCountdown(null)
    setIsAdvancing(true)
    try {
      const updated = await nextSong(code, playerId)
      setLobby(updated)
    } catch { /* poll recovers */ }
    setIsAdvancing(false)
  }

  function handleVolumeChange(e) {
    const v = parseFloat(e.target.value)
    setVolumeState(v)
    setVolume(v)
  }

  function copyCode() {
    navigator.clipboard.writeText(code)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6"
           style={{ background: 'var(--bg)' }}>
        <p className="text-red-400 text-sm">{error}</p>
        <button onClick={onBack} className="btn-secondary py-2 px-6 text-sm">Go back</button>
      </div>
    )
  }

  if (!lobby_) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="w-10 h-10 border-2 border-[var(--green)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Waiting for guest
  if (lobby_.status === 'waiting') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-6"
           style={{ background: 'var(--bg)' }}>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-white tracking-tight">Waiting for opponent…</h2>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Share this code with your friend</p>
        </div>
        <button onClick={copyCode}
          className="text-6xl font-black tracking-widest text-white cursor-pointer hover:opacity-80 transition-opacity">
          {code}
        </button>
        {copied && <p className="text-sm" style={{ color: 'var(--green)' }}>Copied!</p>}
        <div className="w-6 h-6 border-2 border-[var(--green)] border-t-transparent rounded-full animate-spin" />
        <button onClick={onBack} className="btn-icon text-sm">Cancel</button>
      </div>
    )
  }

  // Finished
  if (lobby_.status === 'finished') {
    const iWon = myScore > theirScore
    const tied = myScore === theirScore
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-6"
           style={{ background: 'var(--bg)' }}>
        <div className="text-center space-y-5 slide-up">
          <h2 className="text-5xl font-black tracking-tight"
              style={{ color: tied ? '#f59e0b' : iWon ? 'var(--green)' : '#ef4444' }}>
            {tied ? "TIE!" : iWon ? 'YOU WIN!' : 'YOU LOSE!'}
          </h2>
          <div className="flex gap-10 justify-center text-center">
            <div>
              <div className="text-4xl font-black text-white">{myScore}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{playerName}</div>
            </div>
            <div className="text-xl self-center" style={{ color: 'var(--muted)' }}>vs</div>
            <div>
              <div className="text-4xl font-black text-white">{theirScore}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{theirName}</div>
            </div>
          </div>
        </div>
        <button onClick={onBack} className="btn-primary py-3 px-8">Back to Menu</button>
      </div>
    )
  }

  const roundWinnerName = lobby_.roundWinner === 'host' ? lobby_.hostName : lobby_.guestName
  const iWonRound = lobby_.roundWinner === role
  const progress  = total > 0 ? (lobby_.currentSong / total) * 100 : 0
  const isLast    = (lobby_.currentSong ?? 0) + 1 >= total

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* 3-second pre-round countdown */}
      {lobby_.startAt && <Countdown startAt={lobby_.startAt} />}

      {/* Wrong guess flash — suppressed during 3s countdown */}
      {guessResult === 'wrong' && !lobby_.startAt && (
        <div className="fixed inset-0 pointer-events-none z-40 correct-flash"
             style={{ background: 'rgba(239,68,68,0.12)' }} />
      )}

      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
        {/* Scores */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-center">
            <div className="text-xl font-black text-white">{myScore}</div>
            <div className="text-xs truncate max-w-[64px]" style={{ color: 'var(--green)' }}>{playerName}</div>
          </div>
          <div className="text-sm" style={{ color: 'var(--muted)' }}>vs</div>
          <div className="text-center">
            <div className="text-xl font-black text-white">{theirScore}</div>
            <div className="text-xs truncate max-w-[64px]" style={{ color: 'var(--muted)' }}>{theirName || '…'}</div>
          </div>
        </div>

        {/* Progress */}
        <div className="flex-1 min-w-0 mx-2">
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-press)' }}>
            <div className="h-full rounded-full transition-all duration-500"
                 style={{ width: `${progress}%`, background: 'var(--green)' }} />
          </div>
          <p className="text-xs text-center mt-1" style={{ color: 'var(--muted)' }}>{songNum}/{total}</p>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <svg className="w-4 h-4" style={{ color: 'var(--muted)' }} fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
          </svg>
          <input type="range" min="0" max="1" step="0.05" value={volume}
            onChange={handleVolumeChange} className="w-16" />
        </div>
      </div>

      {/* Lobby code */}
      <div className="text-center py-1">
        <button onClick={copyCode} className="btn-icon text-xs"
                style={{ color: copied ? 'var(--green)' : 'var(--muted)' }}>
          {copied ? 'Copied!' : `Code: ${code}`}
        </button>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-6 gap-6">

        {/* Album art */}
        <div className="relative w-48 h-48 overflow-hidden flex items-center justify-center flex-shrink-0"
             style={{ background: 'var(--bg-card)', borderRadius: '4px' }}>
          {currentSong?.albumArt ? (
            <img src={currentSong.albumArt} alt=""
              className={`w-full h-full object-cover ${roundOver ? 'bloom' : ''}`}
              style={!roundOver ? { filter: 'blur(20px) brightness(0.5)', transform: 'scale(1.1)' } : {}} />
          ) : (
            <svg className="w-14 h-14 opacity-20" style={{ color: 'var(--muted)' }} fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/>
            </svg>
          )}
          {isPlaying && !roundOver && (
            <div className="absolute inset-0 flex items-center justify-center gap-1" style={{ zIndex: 2 }}>
              {[18,26,20,30,18,24,22,28,16].map((h, i) => (
                <div key={i} className="wave-bar"
                  style={{ '--h': `${h}px`, height: '4px', animationDelay: `${i*0.09}s`, animationDuration: `${0.6+i*0.05}s` }} />
              ))}
            </div>
          )}
        </div>

        {/* Round result */}
        {roundOver && (
          <div className="text-center slide-up space-y-1">
            <div className="text-xl font-black tracking-tight"
                 style={{ color: iWonRound ? 'var(--green)' : '#ef4444' }}>
              {iWonRound ? 'You got it!' : `${roundWinnerName} got it!`}
            </div>
            <div className="text-white font-bold">{currentSong?.title}</div>
            <div className="text-sm" style={{ color: 'var(--muted)' }}>{currentSong?.artist}</div>
          </div>
        )}

        {/* Waiting for round start */}
        {lobby_.status === 'ready' && !lobby_.startAt && !roundOver && (
          <div className="w-full max-w-sm text-center slide-up">
            {isHost ? (
              <button onClick={handleStartRound} className="btn-primary w-full justify-center py-4">
                Start Round {songNum}
              </button>
            ) : (
              <div className="flex items-center justify-center gap-3 text-sm" style={{ color: 'var(--muted)' }}>
                <div className="w-4 h-4 border-2 border-[var(--green)] border-t-transparent rounded-full animate-spin" />
                Waiting for {lobby_.hostName} to start…
              </div>
            )}
          </div>
        )}

        {/* Guess input */}
        {clipStarted && !roundOver && lobby_.startAt && (
          <div className="w-full max-w-sm space-y-3 slide-up">
            <Autocomplete
              key={lobby_.currentSong}
              songs={lobby_.songList || []}
              onSelect={setSelectedSong}
              disabled={guessResult === 'win'}
              placeholder="Search for the song…"
            />
            <button onClick={handleSubmitGuess}
              disabled={!selectedSong || guessResult === 'win'}
              className="btn-primary w-full justify-center py-3 disabled:opacity-40">
              Submit Guess
            </button>
            {guessResult === 'win' && (
              <p className="text-center text-sm font-bold" style={{ color: 'var(--green)' }}>
                Correct — waiting for confirmation…
              </p>
            )}
          </div>
        )}

        {/* Round over controls */}
        {roundOver && (
          <div className="w-full max-w-sm space-y-3 slide-up">
            {isHost ? (
              <>
                {/* Auto-start countdown */}
                {autoCountdown !== null && !isPaused && !isLast && (
                  <div className="flex items-center justify-between rounded-lg px-4 py-3 text-sm"
                       style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--muted)' }}>
                      Next round in <strong className="text-white">{autoCountdown}s</strong>
                    </span>
                    <button onClick={handlePause} className="btn-secondary text-xs py-1.5 px-4">Pause</button>
                  </div>
                )}
                {isPaused && !isLast && (
                  <div className="flex items-center justify-between rounded-lg px-4 py-3 text-sm"
                       style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--muted)' }}>Auto-start paused</span>
                    <button onClick={handleResume} className="btn-primary text-xs py-1.5 px-4">Resume</button>
                  </div>
                )}
                <button onClick={handleNextSong} disabled={isAdvancing}
                  className="btn-primary w-full justify-center py-3 disabled:opacity-40">
                  {isAdvancing ? 'Loading…' : isLast ? 'Finish Match' : 'Next Song →'}
                </button>
              </>
            ) : (
              <p className="text-center text-sm" style={{ color: 'var(--muted)' }}>
                Waiting for {lobby_.hostName} to continue…
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
