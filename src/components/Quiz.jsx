import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchPlaylistTracks } from '../utils/spotify.js'
import { fetchPreviewUrl } from '../utils/itunes.js'
import { playClip, stopCurrentAudio, getRandomOffset, preloadAudio, setVolume, getVolume } from '../utils/audio.js'
import { getModConfig, MODS } from '../utils/mods.js'
import Autocomplete from './Autocomplete.jsx'

const BASE_CLIP_DURATIONS = [1, 3, 5, 30]
const TIER_LABELS = ['1s', '3s', '5s', 'Full']

const TIER_COLORS = ['#00ff87', '#84cc16', '#f59e0b', '#f97316']
const CORRECT_MESSAGES = ['PERFECT!', 'NICE!', 'GOT IT!', 'YES!', 'FIRE!']

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function Particles({ active, onDone }) {
  const colors = ['#00ff87','#a855f7','#f472b6','#f59e0b','#3b82f6','#00ffff']
  const particles = useRef(
    Array.from({ length: 40 }, (_, i) => ({
      angle: (i / 40) * 360 + Math.random() * 20,
      dist: 80 + Math.random() * 120,
      color: colors[i % colors.length],
      size: 4 + Math.random() * 6,
      rot: Math.random() * 720 - 360,
      delay: Math.random() * 0.2,
    }))
  )

  useEffect(() => {
    if (active) {
      const t = setTimeout(onDone, 1200)
      return () => clearTimeout(t)
    }
  }, [active, onDone])

  if (!active) return null

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center" style={{ zIndex: 30 }}>
      {particles.current.map((p, i) => {
        const rad = (p.angle * Math.PI) / 180
        const tx = `${Math.cos(rad) * p.dist}px`
        const ty = `${Math.sin(rad) * p.dist}px`
        return (
          <div
            key={i}
            className="particle absolute"
            style={{
              '--tx': tx,
              '--ty': ty,
              '--tr': `${p.rot}deg`,
              width: p.size,
              height: p.size,
              background: p.color,
              boxShadow: `0 0 6px ${p.color}`,
              animationDelay: `${p.delay}s`,
              borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            }}
          />
        )
      })}
    </div>
  )
}

export default function Quiz({ token, playlist, gameMode, activeMods, onFinish, onLogout }) {
  const mods = getModConfig(activeMods)
  const CLIP_DURATIONS = [mods.initialClip, 3, 5, 30]

  const [songList, setSongList] = useState([])
  const [albumList, setAlbumList] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingError, setLoadingError] = useState(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [tierIndex, setTierIndex] = useState(0)
  const [results, setResults] = useState([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [guessState, setGuessState] = useState('idle')
  const [selectedSong, setSelectedSong] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [currentPreviewUrl, setCurrentPreviewUrl] = useState(null)
  const [previewFetching, setPreviewFetching] = useState(false)
  const [noPreview, setNoPreview] = useState(false)
  const [showParticles, setShowParticles] = useState(false)
  const [correctMsg, setCorrectMsg] = useState('')
  const [showFlash, setShowFlash] = useState(false)
  const [flashColor, setFlashColor] = useState('#00ff87')
  const [streak, setStreak] = useState(0)
  const [gameOver, setGameOver] = useState(null) // { reason, songIndex }
  const [volume, setVolumeState] = useState(getVolume())
  const [hiddenArt, setHiddenArt] = useState(false)
  const [artKey, setArtKey] = useState(0)

  const offsetRef = useRef({})
  const previewCacheRef = useRef({})
  const resultsRef = useRef([])

  useEffect(() => {
    fetchPlaylistTracks(token, playlist.id)
      .then((tracks) => {
        if (tracks.length === 0) { setLoadingError('This playlist is empty.'); return }
        const shuffled = shuffle(tracks)
        const list = shuffled.map(t => ({
          id: t.id,
          title: t.name,
          artist: t.artists.map(a => a.name).join(', '),
          albumArt: t.album.images?.[1]?.url || t.album.images?.[0]?.url,
          albumName: t.album.name,
        }))
        shuffled.forEach(t => { offsetRef.current[t.id] = getRandomOffset() })

        const uniqueAlbums = [...new Map(
          list.map(s => [s.albumName, { id: s.albumName, title: s.albumName, artist: '', albumArt: s.albumArt }])
        ).values()]

        setSongList(list)
        setAlbumList(uniqueAlbums)
        const initial = list.map(() => ({ tier: null, missed: false }))
        setResults(initial)
        resultsRef.current = initial
      })
      .catch(err => {
        if (err.message === 'UNAUTHORIZED') onLogout()
        else setLoadingError('Failed to load tracks.')
      })
      .finally(() => setLoading(false))
  }, [token, playlist.id, onLogout])

  // When song changes, fetch preview and auto-play
  useEffect(() => {
    if (songList.length === 0 || loading) return
    const song = songList[currentIndex]
    if (!song) return

    let stale = false
    setTierIndex(0)
    setSelectedSong(null)
    setFeedback(null)
    setGuessState('idle')
    setCurrentPreviewUrl(null)
    setNoPreview(false)
    setHiddenArt(false)
    setArtKey(k => k + 1)
    stopCurrentAudio()

    const alreadyCached = previewCacheRef.current[song.id] !== undefined
    if (!alreadyCached) setPreviewFetching(true)

    ;(async () => {
      let url = alreadyCached
        ? previewCacheRef.current[song.id]
        : await fetchPreviewUrl(song.title, song.artist)

      if (!alreadyCached) previewCacheRef.current[song.id] = url ?? null
      if (stale) return
      setPreviewFetching(false)

      if (!url) { setNoPreview(true); return }

      setCurrentPreviewUrl(url)
      setIsPlaying(true)
      await playClip(url, offsetRef.current[song.id] ?? 0, CLIP_DURATIONS[0], { rate: mods.playbackRate })
      if (!stale) setIsPlaying(false)
    })()

    // HD mod — hide art after 3s
    if (mods.hidden) {
      const t = setTimeout(() => { if (!stale) setHiddenArt(true) }, 3000)
      return () => { stale = true; clearTimeout(t); stopCurrentAudio() }
    }

    // Prefetch next
    const next = songList[currentIndex + 1]
    if (next && previewCacheRef.current[next.id] === undefined) {
      fetchPreviewUrl(next.title, next.artist)
        .then(u => { previewCacheRef.current[next.id] = u ?? null; if (u) preloadAudio(u) })
        .catch(() => { previewCacheRef.current[next.id] = null })
    }

    return () => { stale = true; stopCurrentAudio() }
  }, [currentIndex, songList.length, loading])

  const currentSong = songList[currentIndex]

  async function playCurrentClip(tIdx = tierIndex) {
    if (!currentPreviewUrl) return
    setIsPlaying(true)
    await playClip(currentPreviewUrl, offsetRef.current[currentSong.id] ?? 0, CLIP_DURATIONS[tIdx], { rate: mods.playbackRate })
    setIsPlaying(false)
  }

  function handleVolumeChange(e) {
    const v = parseFloat(e.target.value)
    setVolumeState(v)
    setVolume(v)
  }

  function isCorrectGuess(song) {
    if (gameMode === 'album') return song.id === currentSong.albumName
    return song.id === currentSong.id
  }

  async function handleSubmit() {
    if (!selectedSong) return

    const correct = isCorrectGuess(selectedSong)
    if (correct) {
      // Correct!
      const msg = CORRECT_MESSAGES[Math.floor(Math.random() * CORRECT_MESSAGES.length)]
      setCorrectMsg(msg)
      setFeedback('correct')
      setGuessState('correct')
      setShowParticles(true)
      setShowFlash(true)
      setFlashColor('#00ff87')
      setTimeout(() => setShowFlash(false), 600)

      const newStreak = streak + 1
      setStreak(newStreak)

      const newResults = [...resultsRef.current]
      newResults[currentIndex] = { tier: tierIndex, missed: false }
      resultsRef.current = newResults
      setResults(newResults)

      // Victory clip replay
      if (currentPreviewUrl) {
        setIsPlaying(true)
        await playClip(currentPreviewUrl, offsetRef.current[currentSong.id] ?? 0, 5, { rate: mods.playbackRate })
        setIsPlaying(false)
      }
      advanceToNext(newResults)
    } else {
      // Wrong
      setFeedback('wrong')
      setShowFlash(true)
      setFlashColor('#ef4444')
      setTimeout(() => { setShowFlash(false); setFeedback(null) }, 600)
      setStreak(0)

      // Sudden Death / Perfect mod
      if (mods.suddenDeath) {
        triggerGameOver('sd')
        return
      }
    }
  }

  function handleExtend() {
    if (mods.perfect) { triggerGameOver('pf'); return }
    const nextTier = tierIndex + 1
    if (nextTier >= CLIP_DURATIONS.length) {
      revealAnswer()
      return
    }
    setTierIndex(nextTier)
    setSelectedSong(null)
    setStreak(0)
    playCurrentClip(nextTier)
  }

  function handleSkip() {
    if (mods.perfect) { triggerGameOver('pf'); return }
    revealAnswer()
    setStreak(0)
  }

  function revealAnswer() {
    setGuessState('revealed')
    stopCurrentAudio()
    const newResults = [...resultsRef.current]
    if (mods.noFail) {
      newResults[currentIndex] = { tier: 3, missed: false }
    } else {
      newResults[currentIndex] = { tier: null, missed: true }
    }
    resultsRef.current = newResults
    setResults(newResults)
  }

  function triggerGameOver(reason) {
    stopCurrentAudio()
    const newResults = [...resultsRef.current]
    newResults[currentIndex] = { tier: null, missed: true }
    resultsRef.current = newResults
    setResults(newResults)
    setGameOver({ reason, songIndex: currentIndex })
  }

  function advanceToNext(finalResults) {
    stopCurrentAudio()
    if (currentIndex + 1 >= songList.length) {
      onFinish({ songList, results: finalResults, playlist, gameMode })
    } else {
      setCurrentIndex(i => i + 1)
    }
  }

  function handleNextAfterReveal() {
    stopCurrentAudio()
    if (currentIndex + 1 >= songList.length) {
      onFinish({ songList, results: resultsRef.current, playlist, gameMode })
    } else {
      setCurrentIndex(i => i + 1)
    }
  }

  function handleSkipNoPreview() {
    const newResults = [...resultsRef.current]
    newResults[currentIndex] = { tier: null, missed: true }
    resultsRef.current = newResults
    setResults(newResults)
    if (currentIndex + 1 >= songList.length) {
      onFinish({ songList, results: newResults, playlist, gameMode })
    } else {
      setCurrentIndex(i => i + 1)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen grid-bg flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-2 border-[var(--neon)] border-t-transparent rounded-full animate-spin" />
        <p className="text-[var(--muted)] tracking-wider text-sm">Loading tracks…</p>
      </div>
    )
  }

  if (loadingError) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center px-4">
        <div className="glass rounded-2xl p-8 text-center space-y-4">
          <p className="text-red-400">{loadingError}</p>
          <button onClick={() => onFinish(null)} className="text-[var(--neon)] underline cursor-pointer">Back</button>
        </div>
      </div>
    )
  }

  const progress = (currentIndex / songList.length) * 100
  const showAlbumArt = guessState === 'correct' || guessState === 'revealed'
  const isLastTier = tierIndex === CLIP_DURATIONS.length - 1
  const activeModsList = [...activeMods]

  // Album mode search list
  const searchList = gameMode === 'album'
    ? albumList
    : songList

  return (
    <div className="min-h-screen grid-bg flex flex-col" style={{ fontFamily: 'Poppins, sans-serif' }}>

      {/* Correct flash overlay */}
      {showFlash && (
        <div
          className="fixed inset-0 pointer-events-none correct-flash z-40"
          style={{ background: `${flashColor}18` }}
        />
      )}

      {/* Game Over overlay */}
      {gameOver && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center"
             style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}>
          <div className="text-center space-y-6 px-6 slide-up">
            <div className="text-7xl">
              {gameOver.reason === 'sd' ? '💀' : '✨'}
            </div>
            <h2 className="text-5xl text-red-500" style={{ fontFamily: 'Righteous', textShadow: '0 0 30px rgba(239,68,68,0.6)' }}>
              {gameOver.reason === 'sd' ? 'SUDDEN DEATH' : 'PERFECT FAIL'}
            </h2>
            <p className="text-[var(--muted)]">
              {gameOver.reason === 'sd'
                ? `You got ${gameOver.songIndex} song${gameOver.songIndex !== 1 ? 's' : ''} before missing.`
                : 'You extended the clip — session over.'}
            </p>
            <button
              onClick={() => onFinish({ songList, results: resultsRef.current, playlist, gameMode })}
              className="px-8 py-3 rounded-xl font-bold cursor-pointer transition-all"
              style={{ background: 'var(--neon)', color: 'black', fontFamily: 'Righteous' }}
            >
              See Results →
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[var(--muted)] text-xs truncate">{playlist.name}</p>
            {activeModsList.length > 0 && (
              <div className="flex gap-1">
                {activeModsList.map(id => (
                  <span
                    key={id}
                    className="text-xs px-1.5 py-0.5 rounded font-bold"
                    style={{ background: `${MODS[id].color}22`, color: MODS[id].color, fontFamily: 'Righteous' }}
                  >
                    {id}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-3)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: 'var(--neon)', boxShadow: '0 0 8px var(--neon)' }}
              />
            </div>
            <span className="text-xs text-[var(--muted)] flex-shrink-0">{currentIndex + 1}/{songList.length}</span>
          </div>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <svg className="w-4 h-4 text-[var(--muted)]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
          </svg>
          <input
            type="range" min="0" max="1" step="0.05"
            value={volume}
            onChange={handleVolumeChange}
            className="w-20"
          />
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-6 relative">

        {/* Streak badge */}
        {streak >= 2 && !showParticles && (
          <div
            className="absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold tier-pop"
            style={{
              background: 'rgba(0,255,135,0.15)',
              border: '1px solid var(--neon)',
              color: 'var(--neon)',
              fontFamily: 'Righteous',
            }}
          >
            🔥 {streak}× STREAK
          </div>
        )}

        {/* Album art */}
        <div
          className="relative w-52 h-52 rounded-2xl overflow-hidden flex items-center justify-center"
          style={{ background: 'var(--bg-2)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          {currentSong?.albumArt ? (
            <>
              <img
                key={artKey}
                src={currentSong.albumArt}
                alt=""
                className={`w-full h-full object-cover transition-all duration-700 ${showAlbumArt ? 'bloom' : ''}`}
                style={!showAlbumArt && !hiddenArt
                  ? { filter: 'blur(22px) brightness(0.55) saturate(0.6)', transform: 'scale(1.1)' }
                  : hiddenArt && !showAlbumArt
                  ? { filter: 'blur(22px) brightness(0.55) saturate(0.6)', transform: 'scale(1.1)', opacity: 0, transition: 'opacity 1s ease' }
                  : {}}
              />
              {/* Waveform overlay when playing */}
              {isPlaying && !showAlbumArt && (
                <div className="absolute inset-0 flex items-center justify-center gap-1" style={{ zIndex: 2 }}>
                  {[18,28,22,32,20,26,24,30,16].map((h, i) => (
                    <div
                      key={i}
                      className="wave-bar"
                      style={{
                        '--h': `${h}px`,
                        height: '4px',
                        animationDelay: `${i * 0.09}s`,
                        animationDuration: `${0.6 + i * 0.05}s`,
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 text-[var(--muted)]">
              <svg className="w-16 h-16 opacity-30" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/>
              </svg>
              {isPlaying && (
                <div className="flex gap-1 items-end">
                  {[18,28,22,32,20].map((h, i) => (
                    <div key={i} className="wave-bar" style={{ '--h': `${h}px`, height: '4px', animationDelay: `${i*0.1}s` }} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Particles */}
          <Particles active={showParticles} onDone={() => setShowParticles(false)} />
        </div>

        {/* Correct message */}
        {guessState === 'correct' && (
          <div className="text-center slide-up space-y-1">
            <div
              className="text-3xl font-bold neon-text"
              style={{ fontFamily: 'Righteous', color: 'var(--neon)' }}
            >
              {correctMsg}
            </div>
            <div className="text-white text-lg font-semibold">{currentSong?.title}</div>
            <div className="text-[var(--muted)] text-sm">{currentSong?.artist}</div>
            <div
              className="inline-block px-3 py-1 rounded-full text-xs font-bold mt-1"
              style={{
                background: `${TIER_COLORS[tierIndex]}22`,
                border: `1px solid ${TIER_COLORS[tierIndex]}`,
                color: TIER_COLORS[tierIndex],
                fontFamily: 'Righteous',
              }}
            >
              Got it at {TIER_LABELS[tierIndex]}!
            </div>
          </div>
        )}

        {/* Revealed answer */}
        {guessState === 'revealed' && (
          <div className="text-center slide-up space-y-1">
            <div className="text-2xl font-bold text-red-400" style={{ fontFamily: 'Righteous' }}>
              {gameMode === 'album' ? currentSong?.albumName : currentSong?.title}
            </div>
            {gameMode !== 'album' && <div className="text-[var(--muted)] text-sm">{currentSong?.artist}</div>}
          </div>
        )}

        {/* Preview fetching */}
        {previewFetching && guessState === 'idle' && (
          <div className="flex items-center gap-3 text-[var(--muted)] text-sm">
            <div className="w-4 h-4 border-2 border-[var(--neon)] border-t-transparent rounded-full animate-spin" />
            Finding audio…
          </div>
        )}

        {/* No preview */}
        {noPreview && (
          <div
            className="w-full max-w-md rounded-2xl p-5 text-center space-y-3 slide-up"
            style={{ background: 'var(--bg-2)', border: '1px solid rgba(245,158,11,0.3)' }}
          >
            <p className="text-white font-medium">{currentSong?.title}</p>
            <p className="text-amber-400 text-sm">No audio preview found for this song.</p>
            <button onClick={handleSkipNoPreview}
              className="w-full py-2 rounded-xl text-sm font-semibold cursor-pointer transition-colors"
              style={{ background: 'var(--bg-3)', color: 'var(--text)' }}>
              Skip →
            </button>
          </div>
        )}

        {/* Quiz controls */}
        {!previewFetching && !noPreview && guessState !== 'correct' && guessState !== 'revealed' && (
          <div className="w-full max-w-md space-y-4 slide-up">
            {/* Tier dots */}
            <div className="flex items-center justify-center gap-2">
              {CLIP_DURATIONS.map((d, i) => (
                <div
                  key={i}
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: i === tierIndex ? '48px' : '32px',
                    background: i < tierIndex ? '#ef4444' : i === tierIndex ? TIER_COLORS[i] : 'var(--bg-3)',
                    boxShadow: i === tierIndex ? `0 0 8px ${TIER_COLORS[i]}` : 'none',
                  }}
                />
              ))}
              <span className="text-xs text-[var(--muted)] ml-1">{TIER_LABELS[tierIndex]}</span>
            </div>

            <Autocomplete
              key={currentIndex}
              songs={searchList}
              onSelect={setSelectedSong}
              disabled={previewFetching}
              placeholder={gameMode === 'album' ? 'Search for the album…' : 'Search for the song…'}
            />

            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={!selectedSong}
                className="flex-1 py-3 rounded-xl font-bold text-black cursor-pointer transition-all duration-200 disabled:cursor-not-allowed"
                style={{
                  background: selectedSong ? 'var(--neon)' : 'var(--bg-3)',
                  color: selectedSong ? 'black' : 'var(--muted)',
                  fontFamily: 'Righteous',
                  boxShadow: selectedSong ? '0 0 20px rgba(0,255,135,0.3)' : 'none',
                }}
              >
                Submit
              </button>

              {!isLastTier && (
                <button
                  onClick={handleExtend}
                  disabled={isPlaying}
                  className="px-4 py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-200 disabled:opacity-50"
                  style={{
                    background: 'var(--bg-2)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'var(--text)',
                    fontFamily: 'Righteous',
                  }}
                >
                  {mods.perfect ? '⚠ Extend' : `Play ${CLIP_DURATIONS[tierIndex + 1] === 30 ? 'full' : `${CLIP_DURATIONS[tierIndex + 1]}s`}`}
                </button>
              )}
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => playCurrentClip(tierIndex)}
                disabled={isPlaying || !currentPreviewUrl}
                className="flex items-center gap-1.5 text-sm cursor-pointer transition-colors disabled:opacity-40"
                style={{ color: 'var(--muted)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--neon)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                Replay {tierIndex === 3 ? 'full' : `${CLIP_DURATIONS[tierIndex]}s`}
              </button>

              <button
                onClick={handleSkip}
                className="text-sm cursor-pointer transition-colors"
                style={{ color: 'var(--muted)' }}
                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}
              >
                {mods.perfect ? '⚠ Give up' : 'Give up'}
              </button>
            </div>
          </div>
        )}

        {/* Next after reveal */}
        {guessState === 'revealed' && (
          <div className="w-full max-w-md slide-up">
            <button
              onClick={handleNextAfterReveal}
              className="w-full py-3 rounded-xl font-bold cursor-pointer transition-all duration-200"
              style={{
                background: 'var(--bg-2)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text)',
                fontFamily: 'Righteous',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--neon)'; e.currentTarget.style.color = 'var(--neon)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--text)' }}
            >
              {currentIndex + 1 >= songList.length ? 'See Results →' : 'Next Song →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
