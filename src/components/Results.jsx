import { useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import StatsCard from './StatsCard.jsx'
import { MODS } from '../utils/mods.js'

const TIER_LABELS  = ['1s', '3s', '5s', 'Full', 'Missed']
const TIER_COLORS  = ['#00ff87', '#84cc16', '#f59e0b', '#f97316', '#ef4444']
const TIER_FULL    = ['Got at 1 sec', 'Got at 3 sec', 'Got at 5 sec', 'Got at full', 'Missed']

export default function Results({ songList, results, playlist, gameMode, activeMods = new Set(), onRestart, onPickNew, onLeaderboard }) {
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

  // Weighted score for leaderboard
  const score = total > 0
    ? Math.round((tierCounts[0]*4 + tierCounts[1]*3 + tierCounts[2]*2 + tierCounts[3]*1) / (total*4) * 100)
    : 0

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
    try {
      const canvas = await html2canvas(statsCardRef.current, {
        backgroundColor: '#050510', scale: 2, useCORS: true, logging: false,
      })
      canvas.toBlob(async (blob) => {
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

  const activeModsList = [...activeMods]

  return (
    <div className="min-h-screen grid-bg px-4 py-8" style={{ fontFamily: 'Poppins, sans-serif' }}>
      <div className="max-w-lg mx-auto space-y-5">

        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-5xl neon-text" style={{ fontFamily: 'Righteous', color: 'var(--neon)' }}>
            CLIPD
          </h1>
          <div className="flex items-center justify-center gap-3">
            {playlistImg && (
              <img src={playlistImg} alt={playlist.name}
                className="w-12 h-12 rounded-xl object-cover" style={{ boxShadow: '0 0 16px rgba(0,255,135,0.2)' }} />
            )}
            <div className="text-left">
              <p className="text-white font-semibold">{playlist.name}</p>
              <p className="text-[var(--muted)] text-sm">{total} songs · {gameMode === 'album' ? 'Album Quiz' : 'Song Quiz'}</p>
            </div>
          </div>

          {activeModsList.length > 0 && (
            <div className="flex justify-center gap-2 flex-wrap">
              {activeModsList.map(id => (
                <span key={id} className="mod-badge px-2 py-1 rounded-lg text-xs font-bold"
                  style={{ background: `${MODS[id].color}22`, border: `1px solid ${MODS[id].color}55`, color: MODS[id].color, fontFamily: 'Righteous' }}
                  title={`${MODS[id].name} — ${MODS[id].desc}`}>
                  {MODS[id].icon} {id}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Big score */}
        <div
          className="rounded-3xl p-8 text-center space-y-2 count-up"
          style={{ background: 'var(--bg-2)', border: '1px solid rgba(0,255,135,0.2)', boxShadow: '0 0 40px rgba(0,255,135,0.08)' }}
        >
          <div
            className="text-7xl font-black neon-text"
            style={{ fontFamily: 'Righteous', color: 'var(--neon)' }}
          >
            {pct}%
          </div>
          <p className="text-[var(--muted)]">
            You knew <strong className="text-white">{known} of {total}</strong> songs
          </p>
          {gameMode === 'daily' && (
            <p className="text-[var(--purple)] text-sm font-semibold">
              Leaderboard score: {score} pts
            </p>
          )}
        </div>

        {/* Stacked bar */}
        <div
          className="h-5 rounded-full overflow-hidden flex"
          style={{ background: 'var(--bg-3)' }}
        >
          {tierCounts.map((count, i) => {
            const w = total > 0 ? (count / total) * 100 : 0
            if (w === 0) return null
            return (
              <div
                key={i}
                className="transition-all duration-1000"
                style={{
                  width: `${w}%`,
                  background: TIER_COLORS[i],
                  boxShadow: `0 0 12px ${TIER_COLORS[i]}88`,
                }}
                title={`${TIER_FULL[i]}: ${count}`}
              />
            )
          })}
        </div>

        {/* Tier grid */}
        <div className="grid grid-cols-5 gap-2">
          {tierCounts.map((count, i) => (
            <div
              key={i}
              className="rounded-2xl p-3 text-center"
              style={{
                background: `${TIER_COLORS[i]}12`,
                border: `1px solid ${TIER_COLORS[i]}33`,
              }}
            >
              <div className="text-2xl font-bold" style={{ fontFamily: 'Righteous', color: TIER_COLORS[i] }}>{count}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{TIER_LABELS[i]}</div>
            </div>
          ))}
        </div>

        {/* Song lists */}
        {songsByTier[0].length > 0 && (
          <SongSection title="🎯 Nailed at 1 second" songs={songsByTier[0]} color="#00ff87" gameMode={gameMode} />
        )}
        {(songsByTier[3].length > 0 || songsByTier[4].length > 0) && (
          <SongSection title="😬 Needed full clip or missed" songs={[...songsByTier[3], ...songsByTier[4]]} color="#ef4444" gameMode={gameMode} />
        )}

        {/* Share */}
        <button
          onClick={handleCopyImage}
          disabled={copying}
          className="btn-press w-full py-3 rounded-xl font-bold cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: 'var(--neon)', color: 'black', fontFamily: 'Righteous' }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 30px rgba(0,255,135,0.5)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
        >
          {copying ? (
            <><div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> Generating…</>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy results image
            </>
          )}
        </button>

        {copyStatus === 'copied'     && <p className="text-center text-sm" style={{ color: 'var(--neon)' }}>Copied to clipboard!</p>}
        {copyStatus === 'downloaded' && <p className="text-center text-sm" style={{ color: 'var(--neon)' }}>Image downloaded!</p>}

        {/* Leaderboard CTA for daily mode */}
        {gameMode === 'daily' && onLeaderboard && (
          <button
            onClick={() => onLeaderboard(score, total)}
            className="w-full py-3 rounded-xl font-bold cursor-pointer transition-all duration-200"
            style={{ background: 'rgba(168,85,247,0.2)', border: '1px solid var(--purple)', color: 'var(--purple)', fontFamily: 'Righteous' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(168,85,247,0.35)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(168,85,247,0.2)'}
          >
            🏆 Submit to Leaderboard →
          </button>
        )}

        {/* Actions */}
        <div className="flex gap-3 pb-8">
          <button onClick={onRestart}
            className="btn-press flex-1 py-3 rounded-xl font-semibold cursor-pointer transition-colors duration-200"
            style={{ background: 'var(--bg-2)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text)' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--neon)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
          >
            Redo playlist
          </button>
          <button onClick={onPickNew}
            className="btn-press flex-1 py-3 rounded-xl font-semibold cursor-pointer transition-colors duration-200"
            style={{ background: 'var(--bg-2)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text)' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--neon)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
          >
            New playlist
          </button>
        </div>
      </div>

      <StatsCard ref={statsCardRef} playlist={playlist} songList={songList} results={results} />
    </div>
  )
}

function SongSection({ title, songs, color, gameMode }) {
  return (
    <div className="rounded-2xl p-4 space-y-3"
         style={{ background: 'var(--bg-2)', border: `1px solid ${color}22` }}>
      <h3 className="text-sm font-semibold" style={{ color }}>{title}</h3>
      <ul className="space-y-2">
        {songs.map((song) => (
          <li key={song.id} className="flex items-center gap-3">
            {song.albumArt && <img src={song.albumArt} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />}
            <div className="min-w-0">
              <p className="text-white text-sm truncate">
                {gameMode === 'album' ? song.albumName : song.title}
              </p>
              <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                {gameMode !== 'album' && song.artist}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
