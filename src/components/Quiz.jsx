import { useState, useEffect, useRef } from 'react'
import { fetchPlaylistTracks } from '../utils/spotify.js'
import { fetchPreviewUrl } from '../utils/itunes.js'
import { fetchDailyChart } from '../utils/charts.js'
import { playClip, stopCurrentAudio, getRandomOffset, preloadAudio, setVolume, getVolume } from '../utils/audio.js'
import { getModConfig, MODS } from '../utils/mods.js'
import Autocomplete from './Autocomplete.jsx'

const BASE_CLIP_DURATIONS = [1, 3, 5, 30]
const TIER_LABELS  = ['1s', '3s', '5s', 'Full']
const TIER_COLORS  = ['#1DB954', '#84cc16', '#f59e0b', '#f97316']
const CORRECT_MSGS = ['PERFECT!', 'NICE!', 'GOT IT!', 'YES!', 'FIRE!']
const DAILY_SONG_COUNT = 20

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function Particles({ active, onDone }) {
  const colors = ['#1DB954','#a855f7','#f472b6','#f59e0b','#3b82f6','#00ffff']
  const particles = useRef(
    Array.from({ length: 36 }, (_, i) => ({
      angle: (i / 36) * 360 + Math.random() * 15,
      dist:  70 + Math.random() * 110,
      color: colors[i % colors.length],
      size:  4 + Math.random() * 5,
      rot:   Math.random() * 720 - 360,
      delay: Math.random() * 0.15,
    }))
  )

  useEffect(() => {
    if (active) {
      const t = setTimeout(onDone, 1100)
      return () => clearTimeout(t)
    }
  }, [active, onDone])

  if (!active) return null

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center" style={{ zIndex: 30 }}>
      {particles.current.map((p, i) => {
        const rad = (p.angle * Math.PI) / 180
        return (
          <div
            key={i}
            className="particle absolute"
            style={{
              '--tx': `${Math.cos(rad) * p.dist}px`,
              '--ty': `${Math.sin(rad) * p.dist}px`,
              '--tr': `${p.rot}deg`,
              width: p.size, height: p.size,
              background: p.color,
              animationDelay: `${p.delay}s`,
              borderRadius: i % 2 ? '50%' : '2px',
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

  const [songList, setSongList]           = useState([])
  const [albumList, setAlbumList]         = useState([])
  const [loading, setLoading]             = useState(true)
  const [loadingError, setLoadingError]   = useState(null)
  const [currentIndex, setCurrentIndex]   = useState(0)
  const [tierIndex, setTierIndex]         = useState(0)
  const [results, setResults]             = useState([])
  const [isPlaying, setIsPlaying]         = useState(false)
  const [guessState, setGuessState]       = useState('idle')
  const [selectedSong, setSelectedSong]   = useState(null)
  const [feedback, setFeedback]           = useState(null)
  const [currentPreviewUrl, setCurrentPreviewUrl] = useState(null)
  const [previewFetching, setPreviewFetching]     = useState(false)
  const [noPreview, setNoPreview]         = useState(false)
  const [showParticles, setShowParticles] = useState(false)
  const [correctMsg, setCorrectMsg]       = useState('')
  const [showFlash, setShowFlash]         = useState(false)
  const [flashColor, setFlashColor]       = useState('#1DB954')
  const [streak, setStreak]               = useState(0)
  const [gameOver, setGameOver]           = useState(null)
  const [volume, setVolumeState]          = useState(getVolume())
  const [hiddenArt, setHiddenArt]         = useState(false)
  const [artKey, setArtKey]               = useState(0)

  const offsetRef       = useRef({})
  const previewCacheRef = useRef({})
  const resultsRef      = useRef([])

  // ── Load tracks ──────────────────────────────────
  useEffect(() => {
    const loader = gameMode === 'daily'
      ? fetchDailyChart()
      : fetchPlaylistTracks(token, playlist.id)

    loader
      .then((tracks) => {
        if (tracks.length === 0) { setLoadingError('This playlist is empty.'); return }
        let shuffled = shuffle(tracks)
        if (gameMode === 'daily') shuffled = shuffled.slice(0, DAILY_SONG_COUNT)

        const list = shuffled
          .filter(t => t.id && t.name && t.album)
          .map(t => ({
            id:         t.id,
            title:      t.name,
            artist:     t.artists?.map(a => a.name).join(', ') || '',
            albumArt:   t.album.images?.[1]?.url || t.album.images?.[0]?.url || '',
            albumName:  t.album.name || '',
            previewUrl: t.previewUrl || null,
          }))

        list.forEach(s => {
          offsetRef.current[s.id] = getRandomOffset()
          // Pre-seed cache with known preview URLs (e.g., from Deezer chart)
          if (s.previewUrl) previewCacheRef.current[s.id] = s.previewUrl
        })

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
        else setLoadingError('Failed to load tracks. ' + err.message)
      })
      .finally(() => setLoading(false))
  }, [token, playlist.id, gameMode, onLogout])

  // ── Song change → fetch preview + auto-play ───────
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
    return gameMode === 'album' ? song.id === currentSong.albumName : song.id === currentSong.id
  }

  async function handleSubmit() {
    if (!selectedSong) return
    const correct = isCorrectGuess(selectedSong)

    if (correct) {
      const msg = CORRECT_MSGS[Math.floor(Math.random() * CORRECT_MSGS.length)]
      setCorrectMsg(msg)
      setFeedback('correct')
      setGuessState('correct')
      setShowParticles(true)
      setShowFlash(true)
      setFlashColor('#1DB954')
      setTimeout(() => setShowFlash(false), 500)
      const newStreak = streak + 1
      setStreak(newStreak)
      const newResults = [...resultsRef.current]
      newResults[currentIndex] = { tier: tierIndex, missed: false }
      resultsRef.current = newResults
      setResults(newResults)

      if (currentPreviewUrl) {
        setIsPlaying(true)
        await playClip(currentPreviewUrl, offsetRef.current[currentSong.id] ?? 0, 5, { rate: mods.playbackRate })
        setIsPlaying(false)
      }
      advanceToNext(newResults)
    } else {
      setFeedback('wrong')
      setShowFlash(true)
      setFlashColor('#ef4444')
      setTimeout(() => { setShowFlash(false); setFeedback(null) }, 500)
      setStreak(0)
      if (mods.suddenDeath) { triggerGameOver('sd'); return }
    }
  }

  function handleExtend() {
    if (mods.perfect) { triggerGameOver('pf'); return }
    const nextTier = tierIndex + 1
    if (nextTier >= CLIP_DURATIONS.length) { revealAnswer(); return }
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
    newResults[currentIndex] = mods.noFail ? { tier: 3, missed: false } : { tier: null, missed: true }
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
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'var(--bg)' }}>
        <div className="w-10 h-10 rounded-full border-2 border-[var(--green)] border-t-transparent animate-spin" />
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading tracks…</p>
      </div>
    )
  }

  if (loadingError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--bg)' }}>
        <div className="rounded-lg p-6 text-center space-y-4 max-w-sm" style={{ background: 'var(--bg-card)' }}>
          <p className="text-red-400 text-sm">{loadingError}</p>
          <button onClick={() => onFinish(null)} className="btn-secondary text-sm px-6 py-2">Back</button>
        </div>
      </div>
    )
  }

  const progress = currentIndex / songList.length * 100
  const showAlbumArt = guessState === 'correct' || guessState === 'revealed'
  const isLastTier   = tierIndex === CLIP_DURATIONS.length - 1
  const activeModsList = [...activeMods]
  const searchList = gameMode === 'album' ? albumList : songList

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>

      {/* Flash overlay */}
      {showFlash && (
        <div className="fixed inset-0 pointer-events-none correct-flash z-40"
             style={{ background: `${flashColor}18` }} />
      )}

      {/* Game Over overlay */}
      {gameOver && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center"
             style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)' }}>
          <div className="text-center space-y-6 px-6 slide-up max-w-sm">
            <div className="text-6xl font-black" style={{ fontFamily: 'monospace' }}>
              {gameOver.reason === 'sd' ? '💀' : '✨'}
            </div>
            <h2 className="text-4xl font-black text-white tracking-tight">
              {gameOver.reason === 'sd' ? 'SUDDEN DEATH' : 'PERFECT FAIL'}
            </h2>
            <p style={{ color: 'var(--muted)' }} className="text-sm">
              {gameOver.reason === 'sd'
                ? `You guessed ${gameOver.songIndex} song${gameOver.songIndex !== 1 ? 's' : ''} correctly.`
                : 'You extended the clip — session over.'}
            </p>
            <button
              onClick={() => onFinish({ songList, results: resultsRef.current, playlist, gameMode })}
              className="btn-primary w-full justify-center"
            >
              See Results
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{playlist.name}</p>
            {activeModsList.length > 0 && (
              <div className="flex gap-1 flex-shrink-0">
                {activeModsList.map(id => (
                  <span key={id} className="text-xs px-1.5 py-0.5 rounded font-bold"
                    style={{
                      background: `${MODS[id].color}20`,
                      border: `1px solid ${MODS[id].color}50`,
                      color: MODS[id].color,
                    }}
                    title={MODS[id].desc}>
                    {id}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-press)' }}>
              <div className="h-full rounded-full transition-all duration-500"
                   style={{ width: `${progress}%`, background: 'var(--green)' }} />
            </div>
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted)' }}>
              {currentIndex + 1}/{songList.length}
            </span>
          </div>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--muted)' }}>
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
          </svg>
          <input type="range" min="0" max="1" step="0.05" value={volume}
            onChange={handleVolumeChange} className="w-20 range-green"
            style={{ '--pct': `${volume * 100}%` }} />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-6 relative">

        {/* Streak */}
        {streak >= 2 && !showParticles && (
          <div className="absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold tier-pop"
               style={{ background: 'rgba(29,185,84,0.15)', border: '1px solid var(--green)', color: 'var(--green)' }}>
            {streak}× STREAK
          </div>
        )}

        {/* Album art */}
        <div className="relative w-52 h-52 rounded overflow-hidden flex items-center justify-center flex-shrink-0"
             style={{ background: 'var(--bg-card)', borderRadius: '4px' }}>
          {currentSong?.albumArt ? (
            <>
              <img
                key={artKey}
                src={currentSong.albumArt}
                alt=""
                className={`w-full h-full object-cover transition-all duration-500 ${showAlbumArt ? 'bloom' : ''}`}
                style={!showAlbumArt && !hiddenArt
                  ? { filter: 'blur(20px) brightness(0.5) saturate(0.5)', transform: 'scale(1.1)' }
                  : hiddenArt && !showAlbumArt
                  ? { filter: 'blur(20px) brightness(0.5)', opacity: 0, transition: 'opacity 1s ease' }
                  : {}}
              />
              {isPlaying && !showAlbumArt && (
                <div className="absolute inset-0 flex items-center justify-center gap-1" style={{ zIndex: 2 }}>
                  {[18,26,20,30,18,24,22,28,16].map((h, i) => (
                    <div key={i} className="wave-bar"
                      style={{ '--h': `${h}px`, height: '4px', animationDelay: `${i * 0.09}s`, animationDuration: `${0.6 + i * 0.05}s` }} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-3" style={{ color: 'var(--muted)' }}>
              <svg className="w-14 h-14 opacity-25" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/>
              </svg>
              {isPlaying && (
                <div className="flex gap-1 items-end">
                  {[18,26,20,28,16].map((h, i) => (
                    <div key={i} className="wave-bar" style={{ '--h': `${h}px`, height: '4px', animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
              )}
            </div>
          )}
          <Particles active={showParticles} onDone={() => setShowParticles(false)} />
        </div>

        {/* Correct */}
        {guessState === 'correct' && (
          <div className="text-center slide-up space-y-1">
            <div className="text-2xl font-black tracking-tight" style={{ color: 'var(--green)' }}>{correctMsg}</div>
            <div className="text-white font-bold text-lg">{currentSong?.title}</div>
            <div className="text-sm" style={{ color: 'var(--muted)' }}>{currentSong?.artist}</div>
            <div className="inline-block mt-1 px-3 py-1 rounded-full text-xs font-bold"
                 style={{ background: `${TIER_COLORS[tierIndex]}20`, border: `1px solid ${TIER_COLORS[tierIndex]}`, color: TIER_COLORS[tierIndex] }}>
              Got it at {TIER_LABELS[tierIndex]}!
            </div>
          </div>
        )}

        {/* Revealed */}
        {guessState === 'revealed' && (
          <div className="text-center slide-up space-y-1">
            <div className="text-xl font-black text-red-400 tracking-tight">
              {gameMode === 'album' ? currentSong?.albumName : currentSong?.title}
            </div>
            {gameMode !== 'album' && <div className="text-sm" style={{ color: 'var(--muted)' }}>{currentSong?.artist}</div>}
          </div>
        )}

        {/* Fetching */}
        {previewFetching && guessState === 'idle' && (
          <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--muted)' }}>
            <div className="w-4 h-4 rounded-full border-2 border-[var(--green)] border-t-transparent animate-spin" />
            Finding audio…
          </div>
        )}

        {/* No preview */}
        {noPreview && (
          <div className="w-full max-w-sm rounded-lg p-5 text-center space-y-3 slide-up"
               style={{ background: 'var(--bg-card)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <p className="text-white font-medium text-sm">{currentSong?.title}</p>
            <p className="text-amber-400 text-xs">No audio preview available.</p>
            <button onClick={handleSkipNoPreview} className="btn-secondary text-sm py-2 px-6 w-full">Skip</button>
          </div>
        )}

        {/* Controls */}
        {!previewFetching && !noPreview && guessState !== 'correct' && guessState !== 'revealed' && (
          <div className="w-full max-w-sm space-y-4 slide-up">

            {/* Tier dots */}
            <div className="flex items-center justify-center gap-2">
              {CLIP_DURATIONS.map((d, i) => (
                <div key={i} className="h-1 rounded-full transition-all duration-300"
                  style={{
                    width: i === tierIndex ? '44px' : '28px',
                    background: i < tierIndex ? '#ef4444' : i === tierIndex ? TIER_COLORS[i] : 'var(--bg-press)',
                  }} />
              ))}
              <span className="text-xs ml-1" style={{ color: 'var(--muted)' }}>{TIER_LABELS[tierIndex]}</span>
            </div>

            <Autocomplete
              key={currentIndex}
              songs={searchList}
              onSelect={setSelectedSong}
              disabled={previewFetching}
              placeholder={gameMode === 'album' ? 'Search for the album…' : 'Search for the song…'}
            />

            <div className="flex gap-3">
              <button onClick={handleSubmit} disabled={!selectedSong}
                className="btn-primary flex-1 justify-center py-3 text-sm"
                style={!selectedSong ? { background: 'var(--bg-hover)', color: 'var(--muted)' } : {}}>
                Submit
              </button>
              {!isLastTier && (
                <button onClick={handleExtend} disabled={isPlaying}
                  className="btn-secondary py-3 px-4 text-sm disabled:opacity-40">
                  {mods.perfect ? '⚠ Extend' : `+${CLIP_DURATIONS[tierIndex + 1] === 30 ? 'Full' : `${CLIP_DURATIONS[tierIndex + 1]}s`}`}
                </button>
              )}
            </div>

            <div className="flex items-center justify-between">
              <button onClick={() => playCurrentClip(tierIndex)}
                disabled={isPlaying || !currentPreviewUrl}
                className="btn-icon text-sm flex items-center gap-1.5 disabled:opacity-40">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                Replay {tierIndex === 3 ? 'full' : `${CLIP_DURATIONS[tierIndex]}s`}
              </button>
              <button onClick={handleSkip} className="btn-icon text-sm hover:!text-red-400">
                {mods.perfect ? '⚠ Give up' : 'Give up'}
              </button>
            </div>
          </div>
        )}

        {/* Next after reveal */}
        {guessState === 'revealed' && (
          <div className="w-full max-w-sm slide-up">
            <button onClick={handleNextAfterReveal} className="btn-secondary w-full py-3 text-sm">
              {currentIndex + 1 >= songList.length ? 'See Results' : 'Next Song →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
