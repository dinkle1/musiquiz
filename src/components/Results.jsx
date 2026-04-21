import { useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import StatsCard from './StatsCard.jsx'
import { MODS } from '../utils/mods.js'

const TIER_LABELS = ['1s', '3s', '5s', 'Full', 'Missed']
const TIER_COLORS = ['#1DB954', '#84cc16', '#f59e0b', '#f97316', '#ef4444']
const TIER_FULL   = ['Got at 1s', 'Got at 3s', 'Got at 5s', 'Got at full', 'Missed']

export default function Results({ songList, results, playlist, gameMode, activeMods = new Set(), onRestart, onPickNew, onLeaderboard }) {
  const statsCardRef = useRef(null)
  const [copying, setCopying]     = useState(false)
  const [copyStatus, setCopyStatus] = useState(null)

  const total = results.length
  const tierCounts = [0, 0, 0, 0, 0]
  for (const r of results) {
    if (r.missed) tierCounts[4]++
    else if (r.tier !== null) tierCounts[r.tier]++
  }
  const known = total - tierCounts[4]
  const pct   = total > 0 ? Math.round((known / total) * 100) : 0
  const score = total > 0
    ? Math.round((tierCounts[0]*4 + tierCounts[1]*3 + tierCounts[2]*2 + tierCounts[3]) / (total * 4) * 100)
    : 0

  const playlistImg  = playlist.images?.[0]?.url
  const activeModsList = [...activeMods]

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
    try {
      const canvas = await html2canvas(statsCardRef.current, {
        backgroundColor: '#121212', scale: 2, useCORS: true, logging: false,
      })
      canvas.toBlob(async blob => {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
          setCopyStatus('copied')
        } catch {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url; a.download = 'clipd-results.png'; a.click()
          URL.revokeObjectURL(url)
          setCopyStatus('downloaded')
        }
        setCopying(false)
        setTimeout(() => setCopyStatus(null), 3000)
      })
    } catch { setCopying(false); setCopyStatus('error') }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="max-w-lg mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="space-y-3">
          <h1 className="text-3xl font-black tracking-tight text-white">Your Results</h1>
          <div className="flex items-center gap-3">
            {playlistImg && (
              <img src={playlistImg} alt={playlist.name}
                className="w-12 h-12 object-cover flex-shrink-0" style={{ borderRadius: '4px' }} />
            )}
            <div className="min-w-0">
              <p className="text-white text-sm font-bold truncate">{playlist.name}</p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                {total} songs · {gameMode === 'album' ? 'Album Quiz' : gameMode === 'daily' ? 'Daily Challenge' : 'Song Quiz'}
              </p>
            </div>
          </div>

          {activeModsList.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {activeModsList.map(id => (
                <span key={id} className="px-2 py-1 rounded text-xs font-bold"
                  style={{ background: `${MODS[id].color}18`, border: `1px solid ${MODS[id].color}40`, color: MODS[id].color }}>
                  {MODS[id].icon} {id}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Score card */}
        <div className="rounded-lg p-8 text-center count-up"
             style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="text-7xl font-black tracking-tighter text-white mb-2">{pct}%</div>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            You knew <strong className="text-white">{known} of {total}</strong> songs
          </p>
          {gameMode === 'daily' && (
            <p className="text-sm font-bold mt-2" style={{ color: 'var(--green)' }}>
              Score: {score} pts
            </p>
          )}
        </div>

        {/* Stacked bar */}
        <div className="h-2 rounded-full overflow-hidden flex" style={{ background: 'var(--bg-press)' }}>
          {tierCounts.map((count, i) => {
            const w = total > 0 ? (count / total) * 100 : 0
            if (w === 0) return null
            return (
              <div key={i} className="transition-all duration-700"
                   style={{ width: `${w}%`, background: TIER_COLORS[i] }}
                   title={`${TIER_FULL[i]}: ${count}`} />
            )
          })}
        </div>

        {/* Tier grid */}
        <div className="grid grid-cols-5 gap-2">
          {tierCounts.map((count, i) => (
            <div key={i} className="rounded-lg p-3 text-center"
                 style={{ background: 'var(--bg-card)', border: `1px solid ${TIER_COLORS[i]}30` }}>
              <div className="text-xl font-black" style={{ color: TIER_COLORS[i] }}>{count}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{TIER_LABELS[i]}</div>
            </div>
          ))}
        </div>

        {/* Song lists */}
        {songsByTier[0].length > 0 && (
          <SongSection title="Nailed at 1 second" songs={songsByTier[0]} color="#1DB954" gameMode={gameMode} />
        )}
        {(songsByTier[3].length > 0 || songsByTier[4].length > 0) && (
          <SongSection title="Needed full clip or missed"
            songs={[...songsByTier[3], ...songsByTier[4]]} color="#ef4444" gameMode={gameMode} />
        )}

        {/* Share */}
        <button onClick={handleCopyImage} disabled={copying}
          className="btn-secondary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50">
          {copying ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating…</>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Share Results Image
            </>
          )}
        </button>
        {copyStatus === 'copied'     && <p className="text-center text-xs" style={{ color: 'var(--green)' }}>Copied to clipboard!</p>}
        {copyStatus === 'downloaded' && <p className="text-center text-xs" style={{ color: 'var(--green)' }}>Image saved!</p>}

        {/* Leaderboard */}
        {gameMode === 'daily' && onLeaderboard && (
          <button onClick={() => onLeaderboard(score, total)} className="btn-primary w-full justify-center py-3">
            Submit to Leaderboard
          </button>
        )}

        {/* Actions */}
        <div className="flex gap-3 pb-8">
          <button onClick={onRestart} className="btn-secondary flex-1 py-3 text-sm">Redo playlist</button>
          <button onClick={onPickNew} className="btn-secondary flex-1 py-3 text-sm">New playlist</button>
        </div>
      </div>

      <StatsCard ref={statsCardRef} playlist={playlist} songList={songList} results={results} />
    </div>
  )
}

function SongSection({ title, songs, color, gameMode }) {
  return (
    <div className="rounded-lg p-4 space-y-3"
         style={{ background: 'var(--bg-card)', border: `1px solid ${color}20` }}>
      <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color }}>{title}</h3>
      <ul className="space-y-2">
        {songs.map(song => (
          <li key={song.id} className="flex items-center gap-3">
            {song.albumArt && (
              <img src={song.albumArt} alt="" className="w-8 h-8 object-cover flex-shrink-0" style={{ borderRadius: '4px' }} />
            )}
            <div className="min-w-0">
              <p className="text-white text-sm truncate">
                {gameMode === 'album' ? song.albumName : song.title}
              </p>
              {gameMode !== 'album' && (
                <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{song.artist}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
