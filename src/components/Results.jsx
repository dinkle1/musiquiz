import { useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import StatsCard from './StatsCard.jsx'

const TIER_LABELS = ['1s', '3s', '5s', 'Full', 'Missed']
const TIER_COLORS = ['bg-green-500', 'bg-lime-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-600']
const TIER_TEXT = ['text-green-400', 'text-lime-400', 'text-yellow-400', 'text-orange-400', 'text-red-400']
const TIER_FULL_LABELS = ['Got it at 1 second', 'Got it at 3 seconds', 'Got it at 5 seconds', 'Got it at full preview', 'Missed']

export default function Results({ songList, results, playlist, onRestart, onPickNew }) {
  const statsCardRef = useRef(null)
  const [copying, setCopying] = useState(false)
  const [copyStatus, setCopyStatus] = useState(null)

  const total = results.length
  const tierCounts = [0, 0, 0, 0, 0]
  for (const r of results) {
    if (r.missed) tierCounts[4]++
    else if (r.tier !== null) tierCounts[r.tier]++
  }

  const known = total - tierCounts[4]
  const pct = total > 0 ? Math.round((known / total) * 100) : 0
  const playlistImg = playlist.images?.[0]?.url

  const songsByTier = tierCounts.map((_, ti) =>
    songList.filter((_, si) => {
      const r = results[si]
      if (ti === 4) return r.missed
      return !r.missed && r.tier === ti
    })
  )

  async function handleCopyImage() {
    if (copying || !statsCardRef.current) return
    setCopying(true)
    setCopyStatus(null)
    try {
      const canvas = await html2canvas(statsCardRef.current, {
        backgroundColor: '#0a0a0a',
        scale: 2,
        useCORS: true,
        logging: false,
      })
      canvas.toBlob(async (blob) => {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ])
          setCopyStatus('copied')
        } catch {
          // Fallback: download
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'clipd-results.png'
          a.click()
          URL.revokeObjectURL(url)
          setCopyStatus('downloaded')
        }
        setCopying(false)
        setTimeout(() => setCopyStatus(null), 3000)
      })
    } catch (err) {
      setCopying(false)
      setCopyStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8">
      <div className="max-w-lg mx-auto space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black text-white">
            <span className="text-green-500">Clipd</span>
          </h1>
          <div className="flex items-center justify-center gap-3 mt-2">
            {playlistImg && (
              <img src={playlistImg} alt={playlist.name} className="w-12 h-12 rounded-lg object-cover" />
            )}
            <div className="text-left">
              <p className="text-white font-semibold">{playlist.name}</p>
              <p className="text-gray-500 text-sm">{total} songs</p>
            </div>
          </div>
        </div>

        {/* Big stat */}
        <div className="bg-gray-900 rounded-2xl p-6 text-center">
          <div className="text-6xl font-black text-white">{pct}%</div>
          <p className="text-gray-400 mt-2">
            You knew <strong className="text-white">{known} of {total}</strong> songs
          </p>
        </div>

        {/* Stacked bar */}
        <div className="h-4 rounded-full overflow-hidden flex">
          {tierCounts.map((count, i) => {
            const w = total > 0 ? (count / total) * 100 : 0
            if (w === 0) return null
            return (
              <div
                key={i}
                className={`${TIER_COLORS[i]} transition-all`}
                style={{ width: `${w}%` }}
                title={`${TIER_FULL_LABELS[i]}: ${count}`}
              />
            )
          })}
        </div>

        {/* Tier counts */}
        <div className="grid grid-cols-5 gap-2">
          {tierCounts.map((count, i) => (
            <div key={i} className="bg-gray-900 rounded-xl p-3 text-center">
              <div className={`text-2xl font-bold ${TIER_TEXT[i]}`}>{count}</div>
              <div className="text-gray-500 text-xs mt-0.5">{TIER_LABELS[i]}</div>
            </div>
          ))}
        </div>

        {/* Song lists */}
        {songsByTier[0].length > 0 && (
          <SongSection
            title="🎯 Got at 1 second"
            songs={songsByTier[0]}
            colorClass="text-green-400"
          />
        )}

        {(songsByTier[3].length > 0 || songsByTier[4].length > 0) && (
          <SongSection
            title="😬 Needed full clip or missed"
            songs={[...songsByTier[3], ...songsByTier[4]]}
            colorClass="text-red-400"
          />
        )}

        {/* Share button */}
        <button
          onClick={handleCopyImage}
          disabled={copying}
          className="w-full py-3 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {copying ? (
            <>
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              Generating image…
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy results image
            </>
          )}
        </button>

        {copyStatus === 'copied' && (
          <p className="text-center text-green-400 text-sm">Image copied to clipboard!</p>
        )}
        {copyStatus === 'downloaded' && (
          <p className="text-center text-green-400 text-sm">Image downloaded!</p>
        )}
        {copyStatus === 'error' && (
          <p className="text-center text-red-400 text-sm">Couldn't copy image.</p>
        )}

        {/* Actions */}
        <div className="flex gap-3 pb-8">
          <button
            onClick={onRestart}
            className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-xl transition-colors"
          >
            Redo this playlist
          </button>
          <button
            onClick={onPickNew}
            className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-xl transition-colors"
          >
            Pick new playlist
          </button>
        </div>
      </div>

      {/* Off-screen stats card for html2canvas */}
      <StatsCard
        ref={statsCardRef}
        playlist={playlist}
        songList={songList}
        results={results}
      />
    </div>
  )
}

function SongSection({ title, songs, colorClass }) {
  return (
    <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
      <h3 className={`font-semibold text-sm ${colorClass}`}>{title}</h3>
      <ul className="space-y-2">
        {songs.map((song) => (
          <li key={song.id} className="flex items-center gap-3">
            {song.albumArt && (
              <img src={song.albumArt} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-white text-sm truncate">{song.title}</p>
              <p className="text-gray-500 text-xs truncate">{song.artist}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
