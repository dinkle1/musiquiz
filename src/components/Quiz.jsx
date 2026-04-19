import { useState, useEffect, useRef } from 'react'
import { fetchPlaylistTracks } from '../utils/spotify.js'
import { fetchPreviewUrl } from '../utils/itunes.js'
import { playClip, stopCurrentAudio, getRandomOffset, preloadAudio } from '../utils/audio.js'
import Autocomplete from './Autocomplete.jsx'

const CLIP_DURATIONS = [1, 3, 5, 30]
const TIER_LABELS = ['1s', '3s', '5s', 'Full']

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function Quiz({ token, playlist, onFinish, onLogout }) {
  const [songList, setSongList] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingError, setLoadingError] = useState(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [tierIndex, setTierIndex] = useState(0)
  const [results, setResults] = useState([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [guessState, setGuessState] = useState('idle')
  const [selectedSong, setSelectedSong] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [feedback, setFeedback] = useState(null)
  // iTunes preview URL state for current song
  const [currentPreviewUrl, setCurrentPreviewUrl] = useState(null)
  const [previewFetching, setPreviewFetching] = useState(false)
  const [noPreview, setNoPreview] = useState(false)

  const offsetRef = useRef({})
  const previewCacheRef = useRef({}) // songId -> url | null

  // Load tracks from Spotify on mount
  useEffect(() => {
    fetchPlaylistTracks(token, playlist.id)
      .then((tracks) => {
        if (tracks.length === 0) {
          setLoadingError('This playlist is empty.')
          return
        }
        const shuffled = shuffle(tracks)
        const list = shuffled.map((t) => ({
          id: t.id,
          title: t.name,
          artist: t.artists.map((a) => a.name).join(', '),
          albumArt: t.album.images?.[1]?.url || t.album.images?.[0]?.url,
        }))
        shuffled.forEach((t) => { offsetRef.current[t.id] = getRandomOffset() })
        setSongList(list)
        setResults(list.map(() => ({ tier: null, missed: false })))
      })
      .catch((err) => {
        if (err.message === 'UNAUTHORIZED') onLogout()
        else setLoadingError('Failed to load tracks.')
      })
      .finally(() => setLoading(false))
  }, [token, playlist.id, onLogout])

  // When the current song changes, fetch its iTunes preview and auto-play
  useEffect(() => {
    if (songList.length === 0 || loading) return
    const song = songList[currentIndex]
    if (!song) return

    let stale = false

    setTierIndex(0)
    setSubmitted(false)
    setSelectedSong(null)
    setFeedback(null)
    setGuessState('idle')
    setCurrentPreviewUrl(null)
    setNoPreview(false)
    stopCurrentAudio()

    const cached = previewCacheRef.current[song.id]
    const alreadyKnown = cached !== undefined

    if (!alreadyKnown) setPreviewFetching(true)

    ;(async () => {
      let url = alreadyKnown
        ? cached
        : await fetchPreviewUrl(song.title, song.artist)

      if (!alreadyKnown) previewCacheRef.current[song.id] = url ?? null
      if (stale) return

      setPreviewFetching(false)

      if (!url) {
        setNoPreview(true)
        return
      }

      setCurrentPreviewUrl(url)
      setIsPlaying(true)
      await playClip(url, offsetRef.current[song.id] ?? 0, CLIP_DURATIONS[0])
      if (!stale) setIsPlaying(false)
    })()

    // Pre-fetch next song's preview in background
    const next = songList[currentIndex + 1]
    if (next && previewCacheRef.current[next.id] === undefined) {
      fetchPreviewUrl(next.title, next.artist)
        .then((u) => {
          previewCacheRef.current[next.id] = u ?? null
          if (u) preloadAudio(u)
        })
        .catch(() => { previewCacheRef.current[next.id] = null })
    }

    return () => {
      stale = true
      stopCurrentAudio()
    }
  }, [currentIndex, songList.length, loading])

  const currentSong = songList[currentIndex]

  async function playCurrentClip(tIdx = tierIndex) {
    if (!currentPreviewUrl) return
    setIsPlaying(true)
    await playClip(currentPreviewUrl, offsetRef.current[currentSong.id] ?? 0, CLIP_DURATIONS[tIdx])
    setIsPlaying(false)
  }

  function handleSelect(song) {
    setSelectedSong(song)
  }

  function handleSubmit() {
    if (!selectedSong || submitted) return
    setSubmitted(true)

    const correct = selectedSong.id === currentSong.id
    if (correct) {
      setFeedback('correct')
      setGuessState('correct')
      stopCurrentAudio()
      const newResults = [...results]
      newResults[currentIndex] = { tier: tierIndex, missed: false }
      setResults(newResults)
      setTimeout(() => advanceToNext(newResults), 1500)
    } else {
      setFeedback('wrong')
      setGuessState('wrong')
      setSubmitted(false)
      setTimeout(() => setFeedback(null), 800)
    }
  }

  function handleExtend() {
    const nextTier = tierIndex + 1
    if (nextTier >= CLIP_DURATIONS.length) {
      setGuessState('revealed')
      stopCurrentAudio()
      const newResults = [...results]
      newResults[currentIndex] = { tier: null, missed: true }
      setResults(newResults)
      return
    }
    setTierIndex(nextTier)
    setSubmitted(false)
    setSelectedSong(null)
    playCurrentClip(nextTier)
  }

  function handleSkip() {
    setGuessState('revealed')
    stopCurrentAudio()
    const newResults = [...results]
    newResults[currentIndex] = { tier: null, missed: true }
    setResults(newResults)
  }

  function advanceToNext(finalResults) {
    stopCurrentAudio()
    if (currentIndex + 1 >= songList.length) {
      onFinish({ songList, results: finalResults, playlist })
    } else {
      setCurrentIndex((i) => i + 1)
    }
  }

  function handleNextAfterReveal() {
    stopCurrentAudio()
    if (currentIndex + 1 >= songList.length) {
      onFinish({ songList, results, playlist })
    } else {
      setCurrentIndex((i) => i + 1)
    }
  }

  function handleSkipNoPreview() {
    const newResults = [...results]
    newResults[currentIndex] = { tier: null, missed: true }
    setResults(newResults)
    if (currentIndex + 1 >= songList.length) {
      onFinish({ songList, results: newResults, playlist })
    } else {
      setCurrentIndex((i) => i + 1)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 gap-4">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400">Loading tracks…</p>
      </div>
    )
  }

  if (loadingError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
        <div className="text-center space-y-4">
          <p className="text-red-400">{loadingError}</p>
          <button onClick={() => onFinish(null)} className="text-green-500 underline">
            Back to playlists
          </button>
        </div>
      </div>
    )
  }

  const playlistImg = playlist.images?.[0]?.url
  const progress = Math.round((currentIndex / songList.length) * 100)
  const showAlbumArt = guessState === 'correct' || guessState === 'revealed'
  const isLastTier = tierIndex === CLIP_DURATIONS.length - 1

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header / progress */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        {playlistImg && (
          <img src={playlistImg} alt={playlist.name} className="w-8 h-8 rounded object-cover" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-gray-400 text-xs truncate">{playlist.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 flex-shrink-0">
              {currentIndex + 1} / {songList.length}
            </span>
          </div>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-6">

        {/* Album art placeholder / revealed art */}
        <div className="relative w-48 h-48 rounded-2xl overflow-hidden bg-gray-800 flex items-center justify-center">
          {showAlbumArt && currentSong?.albumArt ? (
            <img src={currentSong.albumArt} alt={currentSong.title} className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-gray-600">
              <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/>
              </svg>
              {isPlaying && (
                <div className="flex gap-1 items-end">
                  {[12, 20, 16, 24].map((h, i) => (
                    <div
                      key={i}
                      className="w-1.5 bg-green-500 rounded-full animate-bounce"
                      style={{ height: `${h}px`, animationDelay: `${i * 0.12}s` }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Song info after reveal */}
        {showAlbumArt && (
          <div className="text-center">
            <p className="text-white text-xl font-bold">{currentSong?.title}</p>
            <p className="text-gray-400 text-sm mt-1">{currentSong?.artist}</p>
            {guessState === 'correct' && (
              <p className="text-green-400 font-semibold mt-2">
                Got it at {TIER_LABELS[tierIndex]}! 🎉
              </p>
            )}
            {guessState === 'revealed' && (
              <p className="text-red-400 font-semibold mt-2">Better luck next time 😅</p>
            )}
          </div>
        )}

        {/* Feedback flash overlay */}
        {feedback && (
          <div className={`fixed inset-0 pointer-events-none flex items-center justify-center z-50 ${
            feedback === 'correct' ? 'bg-green-500/20' : 'bg-red-500/20'
          }`}>
            <div className={`text-4xl font-black ${
              feedback === 'correct' ? 'text-green-400' : 'text-red-400'
            }`}>
              {feedback === 'correct' ? '✓ Correct!' : '✗ Wrong'}
            </div>
          </div>
        )}

        {/* iTunes preview loading */}
        {previewFetching && guessState === 'idle' && (
          <div className="flex items-center gap-3 text-gray-400 text-sm">
            <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            Finding audio preview…
          </div>
        )}

        {/* No preview available for this song */}
        {noPreview && (
          <div className="w-full max-w-md bg-gray-900 rounded-2xl p-5 text-center space-y-3">
            <p className="text-gray-300 font-medium">"{currentSong?.title}"</p>
            <p className="text-gray-500 text-sm">{currentSong?.artist}</p>
            <p className="text-yellow-500 text-sm">No audio preview found for this song.</p>
            <button
              onClick={handleSkipNoPreview}
              className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Skip →
            </button>
          </div>
        )}

        {/* Quiz controls */}
        {!previewFetching && !noPreview && guessState !== 'correct' && guessState !== 'revealed' && (
          <div className="w-full max-w-md space-y-4">
            {/* Tier progress dots */}
            <div className="flex items-center justify-center gap-2">
              {CLIP_DURATIONS.map((d, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i < tierIndex ? 'bg-red-500 w-8' : i === tierIndex ? 'bg-green-500 w-12' : 'bg-gray-700 w-8'
                  }`}
                />
              ))}
            </div>

            <Autocomplete
              songs={songList}
              onSelect={handleSelect}
              disabled={isPlaying || previewFetching}
            />

            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={!selectedSong || isPlaying}
                className="flex-1 py-3 bg-green-500 hover:bg-green-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold rounded-xl transition-colors"
              >
                Submit
              </button>

              {!isLastTier ? (
                <button
                  onClick={handleExtend}
                  disabled={isPlaying}
                  className="px-4 py-3 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  Play {CLIP_DURATIONS[tierIndex + 1] === 30 ? 'full' : `${CLIP_DURATIONS[tierIndex + 1]}s`}
                </button>
              ) : (
                <button
                  onClick={handleSkip}
                  disabled={isPlaying}
                  className="px-4 py-3 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-400 text-sm font-semibold rounded-xl transition-colors"
                >
                  Give up
                </button>
              )}
            </div>

            <button
              onClick={() => playCurrentClip(tierIndex)}
              disabled={isPlaying || !currentPreviewUrl}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-300 flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
              Replay {tierIndex === 3 ? 'full preview' : `${CLIP_DURATIONS[tierIndex]}s clip`}
            </button>
          </div>
        )}

        {/* Next button after reveal */}
        {(guessState === 'revealed') && (
          <div className="w-full max-w-md">
            <button
              onClick={handleNextAfterReveal}
              className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-xl transition-colors"
            >
              {currentIndex + 1 >= songList.length ? 'See Results →' : 'Next Song →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
