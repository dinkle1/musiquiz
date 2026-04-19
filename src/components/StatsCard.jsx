import { forwardRef } from 'react'

const TIER_COLORS = ['#1DB954', '#8BC34A', '#FFC107', '#FF9800', '#F44336']
const TIER_LABELS = ['1 second', '3 seconds', '5 seconds', 'Full preview', 'Missed']

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
        top: '0',
        width: '600px',
        background: '#0a0a0a',
        color: 'white',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: '40px',
        borderRadius: '16px',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
        <div style={{ fontSize: '28px', fontWeight: '900', color: '#1DB954', letterSpacing: '-1px' }}>
          Clipd
        </div>
        <div style={{ flex: 1 }} />
        {playlistImg && (
          <img src={playlistImg} alt="" style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }} />
        )}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: 'white' }}>{playlist.name}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>{total} songs</div>
        </div>
      </div>

      {/* Big stat */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ fontSize: '64px', fontWeight: '900', color: 'white', lineHeight: 1 }}>
          {pct}%
        </div>
        <div style={{ fontSize: '18px', color: '#aaa', marginTop: '8px' }}>
          I knew <strong style={{ color: 'white' }}>{known} of {total} songs</strong> in "{playlist.name}"
        </div>
      </div>

      {/* Stacked bar */}
      <div style={{ display: 'flex', height: '16px', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
        {tierCounts.map((count, i) => {
          const w = total > 0 ? (count / total) * 100 : 0
          if (w === 0) return null
          return (
            <div key={i} style={{ width: `${w}%`, background: TIER_COLORS[i] }} />
          )
        })}
      </div>

      {/* Tier breakdown */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '32px' }}>
        {tierCounts.map((count, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: TIER_COLORS[i] }} />
            <span style={{ fontSize: '13px', color: '#ccc' }}>
              {TIER_LABELS[i]}: <strong style={{ color: 'white' }}>{count}</strong>
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ fontSize: '12px', color: '#444', borderTop: '1px solid #1a1a1a', paddingTop: '16px' }}>
        How well do you know your playlist? → clipd.netlify.app
      </div>
    </div>
  )
})
