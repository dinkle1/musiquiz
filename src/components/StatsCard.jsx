import { forwardRef } from 'react'

const TIER_COLORS = ['#00ff87', '#84cc16', '#f59e0b', '#f97316', '#ef4444']
const TIER_LABELS = ['1s', '3s', '5s', 'Full', 'Missed']

export default forwardRef(function StatsCard({ playlist, songList, results }, ref) {
  const total = results.length
  const tierCounts = [0, 0, 0, 0, 0]
  for (const r of results) {
    if (r.missed) tierCounts[4]++
    else if (r.tier !== null) tierCounts[r.tier]++
  }
  const known = total - tierCounts[4]
  const pct = total > 0 ? Math.round((known / total) * 100) : 0
  const playlistImg = playlist.images?.[0]?.url

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        left: '-9999px',
        top: 0,
        width: '600px',
        background: 'linear-gradient(135deg, #050510 0%, #0a0a1f 50%, #111128 100%)',
        color: 'white',
        fontFamily: "'Poppins', sans-serif",
        padding: '40px',
        borderRadius: '20px',
        boxSizing: 'border-box',
        border: '1px solid rgba(0,255,135,0.2)',
        boxShadow: '0 0 60px rgba(0,255,135,0.1)',
      }}
    >
      {/* Scanlines */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '20px', pointerEvents: 'none',
        background: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.05) 2px,rgba(0,0,0,0.05) 4px)',
      }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div style={{
          fontSize: '36px', fontWeight: '900', letterSpacing: '4px',
          fontFamily: "'Righteous', sans-serif",
          color: '#00ff87',
          textShadow: '0 0 20px rgba(0,255,135,0.6)',
        }}>
          CLIPD
        </div>
        {playlistImg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src={playlistImg} alt="" style={{ width: '52px', height: '52px', borderRadius: '10px', objectFit: 'cover' }} />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'white' }}>{playlist.name}</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>{total} songs</div>
            </div>
          </div>
        )}
      </div>

      {/* Big stat */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{
          fontSize: '72px', fontWeight: '900', lineHeight: 1,
          fontFamily: "'Righteous', sans-serif",
          color: '#00ff87',
          textShadow: '0 0 30px rgba(0,255,135,0.5)',
        }}>
          {pct}%
        </div>
        <div style={{ fontSize: '16px', color: '#94a3b8', marginTop: '8px' }}>
          I knew <strong style={{ color: 'white' }}>{known} of {total} songs</strong> in "{playlist.name}"
        </div>
      </div>

      {/* Stacked bar */}
      <div style={{ display: 'flex', height: '18px', borderRadius: '9px', overflow: 'hidden', marginBottom: '16px', background: '#1a1a38' }}>
        {tierCounts.map((count, i) => {
          const w = total > 0 ? (count / total) * 100 : 0
          if (w === 0) return null
          return <div key={i} style={{ width: `${w}%`, background: TIER_COLORS[i] }} />
        })}
      </div>

      {/* Tier breakdown */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '28px' }}>
        {tierCounts.map((count, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: TIER_COLORS[i] }} />
            <span style={{ fontSize: '13px', color: '#94a3b8' }}>
              {TIER_LABELS[i]}: <strong style={{ color: 'white' }}>{count}</strong>
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ fontSize: '12px', color: '#374151', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
        How well do you know your playlist? → clipd.netlify.app
      </div>
    </div>
  )
})
