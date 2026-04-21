import { forwardRef } from 'react'

const TIER_COLORS = ['#1DB954', '#84cc16', '#f59e0b', '#f97316', '#ef4444']
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
        background: '#121212',
        color: 'white',
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        padding: '40px',
        borderRadius: '12px',
        boxSizing: 'border-box',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div style={{
          fontSize: '36px', fontWeight: '900', letterSpacing: '4px',
          fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
          color: '#1DB954',
        }}>
          CLIPD
        </div>
        {playlistImg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src={playlistImg} alt="" style={{ width: '52px', height: '52px', borderRadius: '4px', objectFit: 'cover' }} />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: 'white' }}>{playlist.name}</div>
              <div style={{ fontSize: '12px', color: '#B3B3B3' }}>{total} songs</div>
            </div>
          </div>
        )}
      </div>

      {/* Big stat */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{
          fontSize: '72px', fontWeight: '900', lineHeight: 1,
          color: '#1DB954',
        }}>
          {pct}%
        </div>
        <div style={{ fontSize: '16px', color: '#B3B3B3', marginTop: '8px' }}>
          I knew <strong style={{ color: 'white' }}>{known} of {total} songs</strong> in "{playlist.name}"
        </div>
      </div>

      {/* Stacked bar */}
      <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', marginBottom: '16px', background: '#282828' }}>
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
            <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: TIER_COLORS[i] }} />
            <span style={{ fontSize: '13px', color: '#B3B3B3' }}>
              {TIER_LABELS[i]}: <strong style={{ color: 'white' }}>{count}</strong>
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ fontSize: '12px', color: '#B3B3B3', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
        How well do you know your playlist? → clipd.netlify.app
      </div>
    </div>
  )
})
