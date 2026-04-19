import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchPlaylistTracks } from '../utils/spotify.js'
import { playClip, stopCurrentAudio, getRandomOffset, loadAudioBuffer } from '../utils/audio.js'
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
  const [tracks, setTracks] = useState([])
  const [songList, setSongList] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingError, setLoadingError] = useState(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [tierIndex, setTierIndex] = useState(0)
  const [results, setResults] = useState([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [guessState, setGuessState] = useState('idle') // idle | correct | wrong | revealed
  const [selectedSong, setSelectedSong] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [feedback, setFeedback] = useState(null) // 'correct' | 'wrong'
  const [preloading, setPreloading] = useState(false)
  const offsetRef = useRef({})

  useEffect(() => {
    fetchPlaylistTracks(token, playlist.id)
      .then((t) => {
        if (t.length === 0) {
          setLoadingError('This playlist has no previewable songs. Try another playlist.')
          return
        }
        const shuffled = shuffle(t)
        setTracks(shuffled)
        const list = shuffled.map((track) => ({
          id: track.id,
          title: track.name,
          artist: track.artists.map((a) => a.name).join(', '),
          albumArt: track.album.images?.[1]?.url || track.album.images?.[0]?.url,
          previewUrl: track.preview_url,
        }))
        setSongList(list)
        // Pre-assign offsets
        shuffled.forEach((t) => {
          offsetRef.current[t.id] = getRandomOffset(t.preview_url)
        })
        setResults(shuffled.map(() => ({ tier: null, missed: false })))
      })
      .catch((err) => {
        if (err.message === 'UNAUTHORIZED') onLogout()
        else setLoadingError('Failed to load tracks.')
      })
      .finally(() => setLoading(false))
  }, [token, playlist.id, onLogout])

  // Preload next track
  useEffect(() => {
    if (songList.length === 0) return
    const next = songList[currentIndex + 1]
    if (next?.previewUrl) {
      loadAudioBuffer(next.previewUrl).catch(() => {})
    }
  }, [currentIndex, songList])

  const currentSong = songList[currentIndex]
  const currentTrack = tracks[currentIndex]

  async function playCurrentClip(tIdx = tierIndex) {
    if (!currentSong?.previewUrl) return
    setIsPlaying(true)
    const duration = CLIP_DURATIONS[tIdx]
    const offset = offsetRef.current[currentSong.id] ?? 0
    await playClip(currentSong.previewUrl, offset, duration)
    setIsPlaying(false)
  }

  useEffect(() => {
    if (songList.length > 0 && !loading) {
      setTierIndex(0)
      setSubmitted(false)
      setSelectedSong(null)
      setFeedback(null)
      setGuessState('idle')
      playCurrentClip(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, songList.length, loading])

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
      // Show answer — missed
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
    // After full preview, user gives up
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
    const newResults = results[currentIndex].tier === null && results[currentIndex].missed
      ? results
      : results
    stopCurrentAudio()
    if (currentIndex + 1 >= songList.length) {
      onFinish({ songList, results, playlist })
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
      {/* Header */}
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

        {/* Album art — shown after guess */}
        <div className="relative w-48 h-48 rounded-2xl overflow-hidden bg-gray-800 flex items-center justify-center">
          {showAlbumArt && currentSong?.albumArt ? (
            <img
              src={currentSong.albumArt}
              alt={currentSong.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-gray-600">
              <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/>
              </svg>
              {isPlaying && (
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="w-1 bg-green-500 rounded-full animate-bounce"
                      style={{ height: `${12 + i * 4}px`, animationDelay: `${i * 0.1}s` }}
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

        {/* Feedback flash */}
        {feedback && (
          <div
            className={`fixed inset-0 pointer-events-none flex items-center justify-center z-50 ${
              feedback === 'correct' ? 'bg-green-500/20' : 'bg-red-500/20'
            }`}
          >
            <div className={`text-4xl font-black ${
              feedback === 'correct' ? 'text-green-400' : 'text-red-400'
            }`}>
              {feedback === 'correct' ? '✓ Correct!' : '✗ Wrong'}
            </div>
          </div>
        )}

        {/* Controls */}
        {guessState !== 'correct' && guessState !== 'revealed' && (
          <div className="w-full max-w-md space-y-4">
            {/* Tier indicator */}
            <div className="flex items-center justify-center gap-2">
              {CLIP_DURATIONS.map((d, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i < tierIndex
                      ? 'bg-red-500 w-8'
                      : i === tierIndex
                      ? 'bg-green-500 w-12'
                      : 'bg-gray-700 w-8'
                  }`}
                />
              ))}
            </div>

            <Autocomplete
              songs={songList}
              onSelect={handleSelect}
              disabled={isPlaying || guessState === 'correct' || guessState === 'revealed'}
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
              disabled={isPlaying}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-300 flex items-center justify-center gap-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
              Replay {tierIndex === 3 ? 'full preview' : `${CLIP_DURATIONS[tierIndex]}s clip`}
            </button>
          </div>
        )}

        {/* Next button after result */}
        {(guessState === 'correct' || guessState === 'revealed') && (
          <div className="w-full max-w-md">
            {guessState === 'revealed' && (
              <button
                onClick={handleNextAfterReveal}
                className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-xl transition-colors"
              >
                {currentIndex + 1 >= songList.length ? 'See Results →' : 'Next Song →'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
